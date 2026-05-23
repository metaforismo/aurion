// Small client-side animation utilities for the HUD. Keep this file pure-React
// / pure-DOM — no engine imports, no zustand bindings — so it can be reused
// by any leaf component without dragging in store state.
//
// Today this exports:
//   - `prefersReducedMotion()` — synchronous probe of the OS / user setting.
//     Returns `false` during SSR so server-rendered markup matches the first
//     client paint (no hydration mismatch).
//   - `useCountUp(target)` — eases a numeric readout from its previous value
//     to a new target over ~600ms using `requestAnimationFrame`. Honours the
//     reduced-motion preference (snaps instantly). Cancels the in-flight
//     animation if `target` changes mid-tween so two rapid updates don't
//     fight each other.
//
// Intentionally minimal: no spring physics, no easing presets, no event bus.
// The HUD doesn't need anything more — when it does, extend here.
//
//
// Performance note: the hook only re-renders when the displayed integer
// actually changes (we round on every frame), so a tween from 12,300,000 →
// 12,400,000 produces at most ~100k integer transitions in 600ms — but the
// `setState` short-circuits when the rounded value is equal to the previous
// frame's value, so React sees ~60 renders, not 100k. Tabular-num typography
// keeps the digits from shifting horizontally during the tween.
'use client';

import { useEffect, useRef, useState } from 'react';

/** Duration of the count-up tween in milliseconds. */
const COUNT_UP_DURATION_MS = 600;

/**
 * Synchronously probe `prefers-reduced-motion: reduce`. SSR-safe — returns
 * `false` if `window.matchMedia` is unavailable so the first client render
 * matches server markup. Callers that need to re-evaluate on preference
 * change should subscribe via their own `matchMedia` listener — this helper
 * is intentionally one-shot.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Ease-out cubic — pleasant deceleration for counters / progress bars. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Smoothly animate a numeric readout from its previous value to the new
 * `target` over ~600ms using `requestAnimationFrame`. Useful for the
 * Treasury value where abrupt jumps under-sell positive tax-revenue ticks
 * and over-sell single weekly drains.
 *
 * - On first render: returns `target` immediately (no startup tween).
 * - On `target` change: tweens from the last displayed value.
 * - On rapid successive changes: cancels the in-flight raf and re-tweens
 *   from the current displayed value (no jump-cuts).
 * - On `prefers-reduced-motion: reduce`: snaps to `target` instantly.
 * - On unmount: cancels the in-flight raf.
 *
 * The returned value is always an integer (we round on every frame) so the
 * caller can format it with `Intl.NumberFormat` without floating-point
 * jitter.
 */
export function useCountUp(target: number): number {
  // `display` is what we render this frame; `displayRef` mirrors it so the
  // raf callback can read the latest value without re-creating the effect
  // when `display` changes (which would cancel the tween prematurely).
  const safeTarget = Number.isFinite(target) ? Math.round(target) : 0;
  const [display, setDisplay] = useState<number>(safeTarget);
  const displayRef = useRef<number>(safeTarget);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Nothing to tween — already there.
    if (displayRef.current === safeTarget) return;

    // Honour reduced motion: snap to target via a single rAF tick. We
    // deliberately defer the setState (rather than calling it inline) to
    // avoid triggering a cascading render from inside the effect body —
    // ESLint's `react-hooks/set-state-in-effect` rule flags the inline form.
    if (prefersReducedMotion()) {
      const id = requestAnimationFrame(() => {
        displayRef.current = safeTarget;
        setDisplay(safeTarget);
      });
      return () => {
        cancelAnimationFrame(id);
      };
    }

    // Cancel any in-flight tween so two rapid updates don't fight.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const start = performance.now();
    const from = displayRef.current;
    const to = safeTarget;
    const delta = to - from;

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / COUNT_UP_DURATION_MS);
      const eased = easeOutCubic(progress);
      const next = Math.round(from + delta * eased);

      // Only commit a re-render if the rounded readout actually changed —
      // tabular-num typography means anything else is wasted work.
      if (next !== displayRef.current) {
        displayRef.current = next;
        setDisplay(next);
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        // Snap to the exact target on the final frame (rounding above can
        // leave us one off if the easing curve never quite reaches 1.0
        // before the timeline cutoff).
        if (displayRef.current !== to) {
          displayRef.current = to;
          setDisplay(to);
        }
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [safeTarget]);

  return display;
}

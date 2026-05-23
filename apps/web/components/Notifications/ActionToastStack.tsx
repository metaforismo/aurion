// Bottom-centre success-toast stack for player actions (UN propose, nuclear
// launch, bloc join/leave). Reads from `useGameStore.actionToasts` and
// auto-dismisses each entry after a fixed window. Engine errors continue to
// flow through the existing inline-banner path in PanelTabs — this component
// is for SUCCESS confirmations only.
//
// Single source of toast UI behaviour: AchievementToast and VictoryToast
// have their own dedicated visuals; we keep this stack visually quieter so
// the (more semantically heavy) achievement / victory toasts can stand out.
//
// Motion: each toast enters from the right (translateX(20px) → 0 + opacity
// 0 → 1 over 200ms ease-out) and exits via the same axis reversed
// (translateX(0) → 16px + opacity 1 → 0 over 160ms ease-in). When a toast in
// the middle of the stack is dismissed the survivors animate downward via a
// CSS transition on `margin-top` so the gap is filled smoothly rather than
// snapping.
//
// To support an exit animation we keep dismissed toasts mounted locally for
// the duration of their slide-out (160ms), then unmount. The store's source
// of truth (actionToasts) is consulted during render to discover both new
// arrivals and ones we should start animating out — using the "adjusting
// state during render" pattern so we stay compatible with the project's
// `react-hooks/set-state-in-effect` lint rule.

'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/cn';
import { useGameStore, type ActionToast } from '../../lib/store';

const AUTO_DISMISS_MS = 3_500;
const EXIT_DURATION_MS = 160;

// Editorial toast: solid bg, single deep shadow, ink hierarchy via the
// per-tone left rule + text colour. No tinted fill.
const TONE_CLASS = {
  success: 'border-l-2 border-success text-success',
  info: 'border-l-2 border-info text-info',
  warning: 'border-l-2 border-warning text-warning',
} as const;

type Visible = {
  toast: ActionToast;
  state: 'open' | 'exiting';
};

/**
 * Pure reconciler — pre-existing local list + current store list → next
 * local list. Adds newcomers in `open` state (CSS animation kicks in on
 * mount), marks vanished entries as `exiting` so they can play their
 * slide-out before being purged by the exit-timer effect.
 *
 * Exposed so the reconciliation can run during render (rather than in an
 * effect that would trigger a cascading re-render).
 */
function reconcile(
  prev: readonly Visible[],
  toasts: readonly ActionToast[],
): Visible[] {
  const storeIds = new Set(toasts.map((t) => t.id));
  const prevIds = new Set(prev.map((v) => v.toast.id));

  // 1. Keep / mark-exiting existing entries.
  const next: Visible[] = prev.map((v) => {
    if (storeIds.has(v.toast.id)) {
      // A re-appearing id (rare — usually never since ids monotonically
      // increment) is treated as still-open.
      return v.state === 'exiting' ? { toast: v.toast, state: 'open' } : v;
    }
    return v.state === 'exiting' ? v : { toast: v.toast, state: 'exiting' };
  });

  // 2. Append newcomers.
  for (const t of toasts) {
    if (!prevIds.has(t.id)) next.push({ toast: t, state: 'open' });
  }

  return next;
}

/**
 * Cheap equality so we don't trigger a setState when the reconciler returns
 * a list that's logically identical to the one we already hold.
 */
function listEqual(a: readonly Visible[], b: readonly Visible[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ax = a[i];
    const bx = b[i];
    if (!ax || !bx) return false;
    if (ax.toast.id !== bx.toast.id) return false;
    if (ax.state !== bx.state) return false;
  }
  return true;
}

export function ActionToastStack() {
  const toasts = useGameStore((s) => s.actionToasts);
  const dismiss = useGameStore((s) => s.dismissActionToast);

  // Locally retained list — mirrors the store but keeps removed entries
  // around for EXIT_DURATION_MS so we can play their slide-out.
  const [visible, setVisible] = useState<Visible[]>([]);
  const exitTimersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  // "Adjusting state during render" pattern. We compute the reconciled list
  // synchronously from the latest `toasts` prop and only call setState when
  // it differs from what we already hold. React will discard the in-flight
  // render and re-run with the new state — same frame, no extra paint, and
  // no `set-state-in-effect` lint violation.
  const reconciled = reconcile(visible, toasts);
  if (!listEqual(visible, reconciled)) {
    setVisible(reconciled);
  }

  // For each exiting toast, schedule its hard unmount after the animation
  // window. We key the timer map by id so a re-entering toast doesn't kill
  // an in-flight unmount for a different id.
  useEffect(() => {
    const timers = exitTimersRef.current;
    for (const v of visible) {
      if (v.state !== 'exiting') continue;
      if (timers.has(v.toast.id)) continue;
      const handle = setTimeout(() => {
        // Use the functional updater — by the time the timer fires, `visible`
        // may have changed. We also delete from `timers` here so a future
        // re-entry can re-schedule.
        setVisible((prev) => prev.filter((p) => p.toast.id !== v.toast.id));
        timers.delete(v.toast.id);
      }, EXIT_DURATION_MS);
      timers.set(v.toast.id, handle);
    }
    // Clean up timers for ids that are no longer exiting (resurrected).
    for (const [id, handle] of timers) {
      const stillExiting = visible.some(
        (v) => v.toast.id === id && v.state === 'exiting',
      );
      if (!stillExiting) {
        clearTimeout(handle);
        timers.delete(id);
      }
    }
  }, [visible]);

  // Cleanup all timers on unmount.
  useEffect(() => {
    const timers = exitTimersRef.current;
    return () => {
      for (const h of timers.values()) clearTimeout(h);
      timers.clear();
    };
  }, []);

  // One auto-dismiss timer per live toast.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => dismiss(t.id), AUTO_DISMISS_MS),
    );
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [toasts, dismiss]);

  if (visible.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'pointer-events-none fixed bottom-4 left-1/2 z-40 flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4',
      )}
    >
      {visible.map((v) => {
        const exiting = v.state === 'exiting';
        // Slide-in on mount; slide-out when state flips to "exiting". Both
        // animations use `both` fill mode so the end-state sticks after the
        // keyframes finish — important for the brief overlap with the auto
        // dismissal window.
        const animation = exiting
          ? `toast-slide-out ${EXIT_DURATION_MS}ms cubic-bezier(0.4, 0, 1, 1) both`
          : 'toast-slide-in 200ms cubic-bezier(0, 0, 0.2, 1) both';
        return (
          <div
            key={v.toast.id}
            data-state={exiting ? 'closed' : 'open'}
            style={{
              boxShadow: 'var(--shadow-lg)',
              animation,
              // Smooths the stack reflow that happens when a sibling above
              // is unmounted — the `gap-2` between flex children otherwise
              // teleports the survivors instantly.
              transition: 'margin-top 200ms cubic-bezier(0, 0, 0.2, 1)',
            }}
            className={cn(
              'pointer-events-auto rounded-sm border border-border bg-bg px-3 py-2 text-xs font-medium',
              TONE_CLASS[v.toast.tone ?? 'success'],
            )}
          >
            {v.toast.message}
          </div>
        );
      })}
    </div>
  );
}

export default ActionToastStack;

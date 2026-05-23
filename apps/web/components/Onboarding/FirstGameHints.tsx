// First-game hint overlay. Three or four small annotated callouts pointing
// at the HUD speed controls, the first left-rail tab, the centre of the map
// and the right-rail notification stream. Light-touch, non-blocking:
//
//   - The backdrop is `pointer-events-none` so the player can still drive
//     the UI while the hints are visible.
//   - Auto-dismisses after 8 seconds OR on a "Capito" click OR on any
//     mousedown / keydown on the document (the brief is "any click" — we
//     extend it to keyboard so keyboard-first players aren't trapped).
//   - Skips itself entirely when the localStorage flag is set or while the
//     TutorialOverlay is on screen (we don't want two annotation layers
//     fighting for attention).
//   - Persists `aurion.onboarded = "true"` on dismiss so subsequent runs
//     never re-trigger the overlay.
//
// Anchor resolution mirrors the pattern in `useResolvedAnchor` from
// TutorialOverlay: we querySelector on mount, retry once on rAF, and
// re-resolve on resize / scroll so layout shifts don't strand the callouts.

'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import { cn } from '../../lib/cn';

/** localStorage flag. Once truthy, the overlay never renders. */
const ONBOARDED_FLAG_KEY = 'aurion.onboarded';
/** Auto-dismiss timeout. */
const AUTO_DISMISS_MS = 8000;

/** Each hint binds an i18n key to a CSS selector and a placement strategy.
 * `placement` controls where the callout sits relative to the anchor box. */
type HintPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

type HintDefinition = {
  id: 'speed' | 'panels' | 'map' | 'notifications';
  /** i18n key under `onboarding.hints.*`. */
  i18nKey: string;
  /** CSS selector resolved at mount-time. The selectors below are intentionally
   * stable structural picks that match the production DOM:
   *   - speed         → the speed-control role=group inside the HUD header.
   *   - panels        → the first `<button role="tab">` in the left rail.
   *   - map           → the WorldMap region wrapper (also reused by the
   *                     existing TutorialOverlay).
   *   - notifications → the right-rail aside.  */
  selector: string;
  placement: HintPlacement;
};

const HINTS: readonly HintDefinition[] = [
  {
    id: 'speed',
    i18nKey: 'speed',
    selector: 'header div[role="group"]',
    placement: 'bottom',
  },
  {
    id: 'panels',
    i18nKey: 'panels',
    selector: 'aside[aria-label] button[role="tab"]',
    placement: 'right',
  },
  {
    id: 'map',
    i18nKey: 'map',
    selector: 'div[role="region"]:has(svg)',
    placement: 'center',
  },
  {
    id: 'notifications',
    i18nKey: 'notifications',
    selector: 'aside[data-rail-mode]',
    placement: 'left',
  },
];

/** Callout box geometry — tuned to match the brief's "small floating
 * callout" description. Used in placement math below. */
const CALLOUT_W = 220; // px
const CALLOUT_H = 64; // approximate; clamping below keeps us on-screen
const ANCHOR_GAP = 12; // distance from the anchor's edge

type Rect = { top: number; left: number; width: number; height: number };

export function FirstGameHints() {
  const t = useTranslations('onboarding');

  // Three-state mount gate:
  //   null    → still reading the localStorage flag (renders nothing)
  //   true    → we should display the hints
  //   false   → user has already been onboarded (renders nothing)
  const [shouldShow, setShouldShow] = useState<boolean | null>(null);
  // Anchored rects keyed by hint id. Empty when an anchor failed to resolve.
  const [rects, setRects] = useState<Partial<Record<HintDefinition['id'], Rect>>>({});
  // Suppress while the tutorial modal is on screen. We detect it cheaply via
  // a CSS selector after mount — the tutorial overlay uses a fixed wrapper
  // with `role="presentation"`, but we lean on `role="dialog"` because the
  // anchored variant renders only the card (no presentation wrapper).
  const [tutorialActive, setTutorialActive] = useState(false);

  // Hydration. We always set state from inside the effect so SSR and the
  // first client paint agree (nothing visible).
  useEffect(() => {
    let onboarded = false;
    try {
      onboarded = window.localStorage.getItem(ONBOARDED_FLAG_KEY) === 'true';
    } catch {
      // localStorage blocked → behave as if already onboarded to avoid
      // re-prompting every reload.
      onboarded = true;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShouldShow(!onboarded);
  }, []);

  const dismiss = useCallback(() => {
    setShouldShow(false);
    try {
      window.localStorage.setItem(ONBOARDED_FLAG_KEY, 'true');
    } catch {
      // Best-effort.
    }
  }, []);

  // Detect an active TutorialOverlay (it mounts a `role="dialog"` with
  // `aria-modal="true"` for the intro / outro frames, and an anchored
  // tooltip card otherwise). We re-poll on a short interval so the overlay
  // appearing AFTER us is also caught — the tutorial loads its dismissed
  // flag asynchronously from IndexedDB.
  useEffect(() => {
    if (shouldShow !== true) return;
    const check = () => {
      const dlg = document.querySelector('[role="dialog"][aria-modal="true"]');
      setTutorialActive(dlg !== null);
    };
    check();
    const id = window.setInterval(check, 400);
    return () => window.clearInterval(id);
  }, [shouldShow]);

  // Resolve anchors once mounted. Re-resolves on resize so a viewport flip
  // (orientation, devtools) keeps the callouts pinned.
  useEffect(() => {
    if (shouldShow !== true) return;
    let frame = 0;

    const resolve = () => {
      const next: Partial<Record<HintDefinition['id'], Rect>> = {};
      for (const hint of HINTS) {
        let el: Element | null = null;
        try {
          el = document.querySelector(hint.selector);
        } catch {
          el = null;
        }
        if (!el) continue;
        const r = el.getBoundingClientRect();
        next[hint.id] = {
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        };
      }
      setRects(next);
    };

    // Initial pass — wait a frame so layout has settled (especially the
    // notification rail, which publishes its width via a state update).
    frame = window.requestAnimationFrame(() => {
      resolve();
      // Second pass shortly after to catch the rail width settling.
      window.setTimeout(resolve, 200);
    });

    const onWindow = () => resolve();
    window.addEventListener('resize', onWindow);
    window.addEventListener('scroll', onWindow, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', onWindow);
      window.removeEventListener('scroll', onWindow, true);
    };
  }, [shouldShow]);

  // Auto-dismiss timer plus global "any user input" dismisser. We attach
  // both at the same time so whichever fires first wins. `dismiss` is a
  // stable useCallback (no captured state) so it's safe in the dep array.
  useEffect(() => {
    if (shouldShow !== true || tutorialActive) return;
    const timeout = window.setTimeout(() => dismiss(), AUTO_DISMISS_MS);

    const onInput = (e: Event) => {
      // Clicks on the "Capito" button itself bubble here — we want them to
      // trigger dismiss too, so no special case is needed. The button
      // already calls dismiss directly, so this is just belt-and-braces.
      if (e.type === 'keydown') {
        const k = e as KeyboardEvent;
        // Modifier-only key presses (Shift, Ctrl etc.) shouldn't dismiss.
        if (k.key === 'Shift' || k.key === 'Control' || k.key === 'Alt' || k.key === 'Meta') {
          return;
        }
      }
      dismiss();
    };
    // `capture: true` so we run before the underlying handlers — but we
    // never preventDefault, so the click still reaches its target.
    window.addEventListener('mousedown', onInput, true);
    window.addEventListener('keydown', onInput, true);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('mousedown', onInput, true);
      window.removeEventListener('keydown', onInput, true);
    };
  }, [shouldShow, tutorialActive, dismiss]);

  // Pre-compute the positioned callouts. Memoised so we don't churn on every
  // render — only when the resolved rects change.
  const positionedHints = useMemo(() => {
    if (typeof window === 'undefined') return [];
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    return HINTS.map((hint) => {
      const rect = rects[hint.id];
      if (!rect) return null;
      const { top, left } = positionCallout(rect, hint.placement, viewportW, viewportH);
      return { hint, top, left };
    }).filter(
      (v): v is { hint: HintDefinition; top: number; left: number } => v !== null,
    );
  }, [rects]);

  if (shouldShow !== true) return null;
  if (tutorialActive) return null;
  if (positionedHints.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30"
      role="presentation"
      aria-hidden="false"
      data-testid="first-game-hints"
    >
      {positionedHints.map(({ hint, top, left }) => (
        <HintCallout
          key={hint.id}
          top={top}
          left={left}
          text={t(`hints.${hint.i18nKey}` as Parameters<typeof t>[0])}
        />
      ))}
      <button
        type="button"
        onClick={dismiss}
        className={cn(
          'pointer-events-auto fixed bottom-4 right-4 rounded-md border border-accent bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent shadow-lg',
          'transition hover:bg-accent/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        {t('dismiss')}
      </button>
    </div>
  );
}

function HintCallout({
  top,
  left,
  text,
}: {
  top: number;
  left: number;
  text: string;
}) {
  const style: CSSProperties = {
    top,
    left,
    width: CALLOUT_W,
    animation: 'onboarding-pulse 1.6s ease-in-out infinite',
  };
  return (
    <div
      role="note"
      style={style}
      className={cn(
        'pointer-events-none fixed rounded-md border border-accent/60 bg-bg/95 px-3 py-2 text-[11px] leading-relaxed text-fg shadow-xl',
        'backdrop-blur-sm',
      )}
    >
      {text}
    </div>
  );
}

/** Compute the top/left for the callout based on the anchor rect and the
 * desired placement, clamping against the viewport so the box stays visible
 * even when the anchor sits near an edge. */
function positionCallout(
  rect: Rect,
  placement: HintPlacement,
  viewportW: number,
  viewportH: number,
): { top: number; left: number } {
  let top = 0;
  let left = 0;
  switch (placement) {
    case 'top':
      top = rect.top - CALLOUT_H - ANCHOR_GAP;
      left = rect.left + rect.width / 2 - CALLOUT_W / 2;
      break;
    case 'bottom':
      top = rect.top + rect.height + ANCHOR_GAP;
      left = rect.left + rect.width / 2 - CALLOUT_W / 2;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - CALLOUT_H / 2;
      left = rect.left - CALLOUT_W - ANCHOR_GAP;
      break;
    case 'right':
      top = rect.top + rect.height / 2 - CALLOUT_H / 2;
      left = rect.left + rect.width + ANCHOR_GAP;
      break;
    case 'center':
      top = rect.top + rect.height / 2 - CALLOUT_H / 2;
      left = rect.left + rect.width / 2 - CALLOUT_W / 2;
      break;
  }
  // Clamp inside the viewport with an 8px margin so the callout never gets
  // clipped at the edge.
  const margin = 8;
  top = Math.max(margin, Math.min(viewportH - CALLOUT_H - margin, top));
  left = Math.max(margin, Math.min(viewportW - CALLOUT_W - margin, left));
  return { top, left };
}

export default FirstGameHints;

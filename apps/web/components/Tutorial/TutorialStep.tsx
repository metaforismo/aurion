'use client';

// Anchored tooltip card used by the first-time tutorial. Renders a positioned
// card with a small triangular arrow pointing at a target DOM element. Owns:
//   - position computation (top/bottom/left/right of the anchor rect)
//   - viewport clamping so the card never spills off-screen
//   - focus trap inside the card (Tab cycles within the buttons)
//   - role="tooltip" semantics for screen readers
//
// The component is purely presentational w.r.t. the tutorial state machine —
// navigation buttons are passed in from TutorialOverlay.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import { cn } from '../../lib/cn';

export type TutorialStepPosition = 'top' | 'bottom' | 'left' | 'right';

export type TutorialStepProps = {
  /** Resolved DOM element to anchor against. Pass `null` to fall back to a
   * centred presentation (used when the selector misses the anchor). */
  anchor: Element | null;
  /** Visible heading. */
  title: string;
  /** Body copy. */
  body: string;
  /** Side of the anchor where the card should appear. */
  position: TutorialStepPosition;
  /** "Step N of M" label rendered in the header. */
  stepLabel: string;
  /** Localised label for the back button. Hidden when omitted. */
  prevLabel?: string;
  /** Localised label for the next/forward button. */
  nextLabel: string;
  /** Localised label for the skip-everything button. */
  skipLabel: string;
  /** Called when the player presses the next/forward button. */
  onNext: () => void;
  /** Called when the player presses the back button. Omit to hide the button. */
  onPrev?: () => void;
  /** Called when the player presses skip. */
  onSkip: () => void;
};

const TOOLTIP_GAP_PX = 12;
const VIEWPORT_PADDING_PX = 12;
const CARD_WIDTH_PX = 360;

type Placement = {
  /** Final card position in viewport coordinates. */
  x: number;
  y: number;
  /** Where the arrow should appear on the card. Mirrors `position` but is
   * recomputed so the arrow points back at the anchor centre even after we
   * clamp the card inside the viewport. */
  arrowSide: TutorialStepPosition;
  /** Arrow offset along the card edge, in CSS pixels from the card's
   * top-left corner. */
  arrowOffset: number;
};

export function TutorialStep({
  anchor,
  title,
  body,
  position,
  stepLabel,
  prevLabel,
  nextLabel,
  skipLabel,
  onNext,
  onPrev,
  onSkip,
}: TutorialStepProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const compute = useCallback((): Placement | null => {
    const card = cardRef.current;
    if (!card) return null;
    const cardRect = card.getBoundingClientRect();
    const cardW = cardRect.width || CARD_WIDTH_PX;
    const cardH = cardRect.height || 200;

    if (!anchor) {
      // No anchor → centre the card and hide the arrow by placing it offscreen.
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return {
        x: Math.max(VIEWPORT_PADDING_PX, (vw - cardW) / 2),
        y: Math.max(VIEWPORT_PADDING_PX, (vh - cardH) / 2),
        arrowSide: position,
        arrowOffset: -100,
      };
    }

    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const anchorCenterX = rect.left + rect.width / 2;
    const anchorCenterY = rect.top + rect.height / 2;

    let x = 0;
    let y = 0;
    switch (position) {
      case 'top':
        x = anchorCenterX - cardW / 2;
        y = rect.top - cardH - TOOLTIP_GAP_PX;
        break;
      case 'bottom':
        x = anchorCenterX - cardW / 2;
        y = rect.bottom + TOOLTIP_GAP_PX;
        break;
      case 'left':
        x = rect.left - cardW - TOOLTIP_GAP_PX;
        y = anchorCenterY - cardH / 2;
        break;
      case 'right':
        x = rect.right + TOOLTIP_GAP_PX;
        y = anchorCenterY - cardH / 2;
        break;
    }

    // Clamp inside the viewport so the card is always reachable.
    const minX = VIEWPORT_PADDING_PX;
    const maxX = vw - cardW - VIEWPORT_PADDING_PX;
    const minY = VIEWPORT_PADDING_PX;
    const maxY = vh - cardH - VIEWPORT_PADDING_PX;
    x = Math.min(Math.max(x, minX), Math.max(minX, maxX));
    y = Math.min(Math.max(y, minY), Math.max(minY, maxY));

    // Arrow offset = where the anchor centre falls along the card edge.
    let arrowOffset = 0;
    if (position === 'top' || position === 'bottom') {
      arrowOffset = anchorCenterX - x;
    } else {
      arrowOffset = anchorCenterY - y;
    }
    // Clamp the arrow so it always sits inside the card edge with a small
    // safety margin (it has its own width).
    const arrowMin = 16;
    const arrowMax =
      position === 'top' || position === 'bottom' ? cardW - 16 : cardH - 16;
    arrowOffset = Math.min(Math.max(arrowOffset, arrowMin), arrowMax);

    return { x, y, arrowSide: position, arrowOffset };
  }, [anchor, position]);

  // Compute placement after layout and on every relevant change. We also
  // re-measure on window resize / scroll so the tooltip tracks elements that
  // the player may have nudged via zoom or panel resizing. The DOM (anchor
  // bounding rect, viewport size) is an external system here — we
  // synchronise the resolved geometry into React state, so the lint rule
  // about setState in effects is a false positive (same exception used in
  // `lib/ticker.ts` and `components/Map/WorldMap.tsx`).
  useLayoutEffect(() => {
    const next = compute();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next) setPlacement(next);
  }, [compute]);

  useEffect(() => {
    const handler = () => {
      const next = compute();
      if (next) setPlacement(next);
    };
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [compute]);

  // Focus the primary action when the card mounts so keyboard users can
  // immediately advance with Enter / Space.
  useEffect(() => {
    nextButtonRef.current?.focus();
  }, []);

  // Tab trap inside the card (mirrors the Modal primitive's behaviour).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const card = cardRef.current;
    if (!card) return;
    const focusables = Array.from(
      card.querySelectorAll<HTMLElement>('button:not([disabled])'),
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || !card.contains(active)) {
        e.preventDefault();
        last?.focus();
      }
    } else if (active === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  const placed = placement;
  const arrowSide = placed?.arrowSide ?? position;

  return (
    <div
      ref={cardRef}
      role="tooltip"
      aria-live="polite"
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed',
        left: placed ? `${placed.x}px` : '50%',
        top: placed ? `${placed.y}px` : '50%',
        transform: placed ? undefined : 'translate(-50%, -50%)',
        width: `${CARD_WIDTH_PX}px`,
        maxWidth: 'calc(100vw - 24px)',
      }}
      className={cn(
        'pointer-events-auto z-50 flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-4 text-sm text-fg shadow-2xl outline-none transition-opacity duration-200',
        placed ? 'opacity-100' : 'opacity-0',
      )}
    >
      {/* Arrow — rendered as an absolutely positioned diamond, half outside
          the card. We rotate by 45° and pick the visible faces with shadows
          via border colors so the arrow inherits the card's chrome. */}
      {placed && placed.arrowOffset >= 0 ? (
        <span
          aria-hidden
          className="absolute h-3 w-3 rotate-45 border border-border bg-surface-1"
          style={arrowStyle(arrowSide, placed.arrowOffset)}
        />
      ) : null}

      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        <span className="text-[11px] uppercase tracking-wider text-fg-faint">
          {stepLabel}
        </span>
      </header>
      <p className="text-sm leading-relaxed text-fg-muted">{body}</p>
      <footer className="mt-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-md px-2 py-1 text-xs text-fg-faint transition hover:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
        >
          {skipLabel}
        </button>
        <div className="flex items-center gap-2">
          {prevLabel && onPrev ? (
            <button
              type="button"
              onClick={onPrev}
              className="rounded-md border border-border px-3 py-1 text-xs text-fg-muted transition hover:border-border-strong hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
            >
              {prevLabel}
            </button>
          ) : null}
          <button
            ref={nextButtonRef}
            type="button"
            onClick={onNext}
            className="rounded-md border border-accent bg-accent/15 px-3 py-1 text-xs font-semibold text-accent transition hover:bg-accent/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {nextLabel}
          </button>
        </div>
      </footer>
    </div>
  );
}

function arrowStyle(
  side: TutorialStepPosition,
  offset: number,
): React.CSSProperties {
  // Arrow is a 12px square rotated 45°. Half of it must sit outside the card,
  // so we offset by -6px on the relevant axis.
  switch (side) {
    case 'top':
      // Card is below the anchor → arrow sits on the top edge of the card.
      return {
        top: -6,
        left: offset - 6,
        // Hide the inner two faces by clipping the bottom-right edges.
        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 50%, 0 100%)',
      };
    case 'bottom':
      // Card is above the anchor → arrow sits on the bottom edge.
      return {
        bottom: -6,
        left: offset - 6,
        clipPath: 'polygon(0 0, 50% 50%, 100% 0, 100% 100%, 0 100%)',
      };
    case 'left':
      // Card is to the right of the anchor → arrow sits on the left edge.
      return {
        left: -6,
        top: offset - 6,
        clipPath: 'polygon(0 0, 50% 50%, 0 100%, 100% 100%, 100% 0)',
      };
    case 'right':
      // Card is to the left of the anchor → arrow sits on the right edge.
      return {
        right: -6,
        top: offset - 6,
        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 50% 50%)',
      };
  }
}

export default TutorialStep;

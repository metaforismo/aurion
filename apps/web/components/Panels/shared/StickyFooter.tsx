// Sticky footer rendered inside each panel container. Pins the panel's
// primary action so it's always reachable without scrolling the panel body.
//
// Layout:
//   - position: sticky at the bottom of the scrollable panel container.
//   - hairline top border (border-border) so it visually detaches from the
//     scrolled content.
//   - small backdrop blur + bg-bg/95 so the action stays legible when long
//     content scrolls behind it on slow scroll-end frames.
//
// Children are rendered as-is so panels can drop in an ActionButton or any
// other clickable surface they want to pin.

'use client';

import type { ReactNode } from 'react';

import { cn } from '../../../lib/cn';

export type StickyFooterProps = {
  /** Pinned action(s) to render. Usually a single ActionButton. */
  children: ReactNode;
  /** Optional helper line shown above the action (e.g. "Pick a region first"). */
  hint?: ReactNode;
  /** Additional className applied to the outer footer. */
  className?: string;
};

export function StickyFooter({ children, hint, className }: StickyFooterProps) {
  return (
    <div
      // negative margin pulls the footer to the panel container's edges so
      // the hairline rule spans full-width regardless of the parent's padding.
      className={cn(
        'sticky bottom-0 z-10 -mx-4 mt-2 flex flex-col gap-1.5 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur-sm',
        className,
      )}
    >
      {hint ? (
        <p className="text-[11px] leading-tight text-fg-faint">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

export default StickyFooter;

// Disclosure — thin wrapper around the native `<details>` element used to
// hide secondary panel content behind a "Più dettagli" expander.
//
// Why a separate component (and not Section): Section is open by default,
// reads as a sub-header, and uses a styled button. Disclosure is closed by
// default, reads as supplementary information, and uses native semantics so
// browser search ("Find in page") picks up the contents even when collapsed.
//
// Visual contract: a hairline border-top, the summary row uses small-caps
// with a trailing chevron that rotates open. Content area has padding-top
// and a default `space-y-3`. Caller can override via className.

'use client';

import type { ReactNode } from 'react';

import { cn } from '../../../lib/cn';

export type DisclosureProps = {
  /** Visible summary text — typically a "Più dettagli" / "More details" label. */
  summary: ReactNode;
  /** Body content rendered when expanded. */
  children: ReactNode;
  /** Initial open state. Defaults to false (collapsed). */
  defaultOpen?: boolean;
  /** Optional trailing badge (e.g. count) rendered to the right of the summary. */
  trailing?: ReactNode;
  /** Additional className for the outer <details>. */
  className?: string;
  /** Additional className applied to the content wrapper. */
  contentClassName?: string;
};

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  trailing,
  className,
  contentClassName,
}: DisclosureProps) {
  return (
    <details
      className={cn('group flex flex-col border-t border-border', className)}
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary
        className={cn(
          // Native <summary> shows a marker by default — strip it so we can
          // own the chevron. `cursor-pointer` keeps the affordance.
          'flex cursor-pointer list-none items-center justify-between gap-2 pt-3 pb-2 text-fg-muted transition hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
          '[&::-webkit-details-marker]:hidden',
        )}
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
          <span
            aria-hidden
            className="inline-block h-3 w-3 transition-transform group-open:rotate-90"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-fg-faint">
              <path fill="currentColor" d="M4 2.5v7l4-3.5z" />
            </svg>
          </span>
          {summary}
        </span>
        {trailing ? (
          <span className="font-mono text-[11px] text-fg-faint">{trailing}</span>
        ) : null}
      </summary>
      <div className={cn('pt-3 pb-3 space-y-3', contentClassName)}>
        {children}
      </div>
    </details>
  );
}

export default Disclosure;

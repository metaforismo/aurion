// Collapsible section primitive used in panels for "Recent events", filters,
// or any sub-grouping of content. Open by default; remembers state via React
// (no global persistence needed).

'use client';

import { useState, type ReactNode } from 'react';

import { cn } from '../../../lib/cn';

export type SectionProps = {
  /** Visible header text. */
  title: ReactNode;
  /** Optional subtitle/badge to the right of the title (e.g. count). */
  trailing?: ReactNode;
  /** Children rendered inside the collapsible body. */
  children: ReactNode;
  /** Initial open state. Defaults to true. */
  defaultOpen?: boolean;
  /** Additional className on the root <section>. */
  className?: string;
};

export function Section({
  title,
  trailing,
  children,
  defaultOpen = true,
  className,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={cn('flex flex-col border-t border-border', className)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-0 py-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          <span
            aria-hidden
            className={cn(
              'inline-block h-3 w-3 transition-transform',
              open ? 'rotate-90' : 'rotate-0',
            )}
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-fg-faint">
              <path
                fill="currentColor"
                d="M4 2.5v7l4-3.5z"
              />
            </svg>
          </span>
          {title}
        </span>
        {trailing ? (
          <span className="text-[11px] font-mono text-fg-faint">{trailing}</span>
        ) : null}
      </button>
      {open ? <div className="pb-3 pt-1">{children}</div> : null}
    </section>
  );
}

export default Section;

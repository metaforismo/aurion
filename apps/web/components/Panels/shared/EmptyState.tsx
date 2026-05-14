// Tiny "no data" placeholder used by panel sections.

'use client';

import type { ReactNode } from 'react';

import { cn } from '../../../lib/cn';

export type EmptyStateProps = {
  /** Visible message. */
  children: ReactNode;
  /** Additional className for spacing tweaks. */
  className?: string;
};

export function EmptyState({ children, className }: EmptyStateProps) {
  return (
    <p
      className={cn(
        'rounded-md border border-dashed border-slate-800 px-3 py-3 text-center text-xs text-slate-500',
        className,
      )}
    >
      {children}
    </p>
  );
}

export default EmptyState;

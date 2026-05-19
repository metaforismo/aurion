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
        'px-1 py-3 text-xs italic text-fg-faint',
        className,
      )}
    >
      {children}
    </p>
  );
}

export default EmptyState;

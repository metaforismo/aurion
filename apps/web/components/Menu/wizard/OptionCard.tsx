'use client';

// Radio cards: the wizard's one input. A group behaves like native radios
// (arrow keys move and select, one tab stop) but each option is a card with
// room for the facts that make the choice an informed one. Options are
// divs (not buttons) so they may hold block content such as stat grids.

import { Check, type LucideIcon } from 'lucide-react';
import { useId, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '../../../lib/cn';

const NEXT_KEYS = ['ArrowDown', 'ArrowRight'];
const PREV_KEYS = ['ArrowUp', 'ArrowLeft'];

export function RadioCards({
  label,
  className,
  children,
}: {
  /** Accessible group name. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const forward = NEXT_KEYS.includes(e.key);
    if (!forward && !PREV_KEYS.includes(e.key)) return;
    const options = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])'),
    );
    if (options.length === 0) return;
    e.preventDefault();
    const current = options.indexOf(document.activeElement as HTMLElement);
    const next = options[(current + (forward ? 1 : -1) + options.length) % options.length];
    next?.focus();
    next?.click();
  };
  return (
    <div role="radiogroup" aria-label={label} className={className} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

export function OptionCard({
  checked,
  onSelect,
  title,
  description,
  icon: Icon,
  leading,
  badges,
  disabledReason,
  testId,
  className,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Replaces the icon tile (e.g. a nation's colour swatch). */
  leading?: ReactNode;
  badges?: ReactNode;
  /** When set the option can't be chosen, and this says why. */
  disabledReason?: ReactNode;
  testId?: string;
  className?: string;
  /** Extra facts under the description. */
  children?: ReactNode;
}) {
  const titleId = useId();
  const descId = useId();
  const disabled = disabledReason !== undefined && disabledReason !== null;
  return (
    <div
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      aria-labelledby={titleId}
      aria-describedby={descId}
      data-testid={testId}
      tabIndex={checked ? 0 : -1}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          if (!disabled) onSelect();
        }
      }}
      className={cn(
        'group relative flex w-full cursor-pointer flex-col gap-2 rounded-xl border p-3.5 text-left transition-colors',
        checked
          ? 'border-accent/60 bg-accent/[0.09] shadow-[inset_0_0_0_1px_rgba(232,180,90,0.25)]'
          : 'border-white/[0.09] bg-white/[0.03]',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : !checked && 'hover:border-white/25 hover:bg-white/[0.06]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
    >
      <span className="flex w-full items-start gap-3">
        {leading ??
          (Icon ? (
            <span
              aria-hidden
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors',
                checked
                  ? 'border-accent/50 bg-accent/15 text-accent'
                  : 'border-white/10 bg-white/[0.04] text-fg-muted',
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          ) : null)}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span id={titleId} className="text-[15px] font-semibold leading-tight text-fg">
              {title}
            </span>
            {badges}
          </span>
          <span
            id={descId}
            className="mt-1 block text-pretty text-xs leading-relaxed text-fg-muted"
          >
            {description}
            {disabled ? <span className="mt-1 block text-warning">{disabledReason}</span> : null}
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors',
            checked ? 'border-accent bg-accent text-black' : 'border-white/20 text-transparent',
          )}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      </span>
      {children}
    </div>
  );
}

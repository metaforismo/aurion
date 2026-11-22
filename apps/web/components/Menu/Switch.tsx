'use client';

import { cn } from '../../lib/cn';

/** On/off switch. Name it with `labelledBy` (and `describedBy` for the hint). */
export function Switch({
  checked,
  onChange,
  labelledBy,
  describedBy,
  disabled,
  tone = 'accent',
  testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  labelledBy: string;
  describedBy?: string;
  disabled?: boolean;
  /** `danger` for switches that make the game harsher. */
  tone?: 'accent' | 'danger';
  testId?: string;
}) {
  const on =
    tone === 'danger' ? 'border-[#ff5d4d]/60 bg-[#ff5d4d]/40' : 'border-accent/60 bg-accent/40';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      data-testid={testId}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        checked ? on : 'border-white/20 bg-white/10',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-[left] motion-reduce:transition-none',
          checked ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  );
}

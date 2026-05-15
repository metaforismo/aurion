// Labelled progress bar primitive used across all 6 panels.
// Pure presentational, no store access.

'use client';

import type { ReactNode } from 'react';

import { cn } from '../../../lib/cn';

export type StatBarTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info';

const TONE_FILL: Record<StatBarTone, string> = {
  neutral: 'bg-fg-muted',
  positive: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

const TONE_TEXT: Record<StatBarTone, string> = {
  neutral: 'text-fg',
  positive: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

export type StatBarProps = {
  /** Visible label rendered above the bar. */
  label: ReactNode;
  /** Current numeric value. Used to compute the bar fill. */
  value: number;
  /** Maximum value the bar represents. Defaults to 100. */
  max?: number;
  /** Optional minimum value (defaults to 0). Useful for ranges like -100..+100. */
  min?: number;
  /** Pre-formatted value to display on the right (e.g. "67%"). Falls back to value. */
  valueLabel?: ReactNode;
  /** Visual color hint. Defaults to "neutral". */
  tone?: StatBarTone;
  /** Optional additional className for the wrapper. */
  className?: string;
  /** Aria label override. Falls back to a string built from `label` if it's a string. */
  ariaLabel?: string;
};

export function StatBar({
  label,
  value,
  max = 100,
  min = 0,
  valueLabel,
  tone = 'neutral',
  className,
  ariaLabel,
}: StatBarProps) {
  const range = max - min;
  const safeRange = range > 0 ? range : 1;
  const normalized = Math.max(0, Math.min(1, (value - min) / safeRange));
  const widthPct = `${(normalized * 100).toFixed(2)}%`;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-fg">{label}</span>
        <span className={cn('font-mono numeric-tabular', TONE_TEXT[tone])}>
          {valueLabel ?? value}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={
          ariaLabel ?? (typeof label === 'string' ? label : undefined)
        }
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className={cn('h-full rounded-full transition-[width]', TONE_FILL[tone])}
          style={{ width: widthPct }}
        />
      </div>
    </div>
  );
}

export default StatBar;

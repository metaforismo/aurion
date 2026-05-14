// Action button used to dispatch player actions from panels.
//
// Responsibilities:
//   - Renders a clickable button with optional cost / hint metadata.
//   - Disables itself when validation fails and surfaces the disabled
//     reason via aria + tooltip-like helper text.
//   - Calls onClick — if it returns a Promise<string[]> (the convention
//     established by `useGameStore.applyAction`), any non-empty error
//     array is propagated to the parent's `onErrors` handler so panels
//     can surface a toast.

'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useState } from 'react';

import { cn } from '../../../lib/cn';

export type ActionButtonTone = 'primary' | 'neutral' | 'danger';

const TONE_STYLES: Record<ActionButtonTone, { enabled: string; pressed: string }> = {
  primary: {
    enabled:
      'border-indigo-500 bg-indigo-500/10 text-indigo-100 hover:border-indigo-400 hover:bg-indigo-500/20',
    pressed: 'bg-indigo-500/30',
  },
  neutral: {
    enabled:
      'border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-600 hover:bg-slate-800',
    pressed: 'bg-slate-800',
  },
  danger: {
    enabled:
      'border-rose-700 bg-rose-950/40 text-rose-100 hover:border-rose-500 hover:bg-rose-900/40',
    pressed: 'bg-rose-900/60',
  },
};

export type ActionButtonProps = {
  /** Visible label. */
  children: ReactNode;
  /** Click handler. May return a list of i18n error keys. */
  onClick: (event: MouseEvent<HTMLButtonElement>) => void | string[] | Promise<void | string[]>;
  /** Disable + announce the reason if provided. */
  disabledReason?: string | null;
  /** Optional cost / hint shown to the right of the label (e.g. "$ 100M"). */
  cost?: ReactNode;
  /** Optional small description below the label. */
  hint?: ReactNode;
  /** Visual style. Defaults to "neutral". */
  tone?: ActionButtonTone;
  /** Optional callback fired with non-empty error arrays returned by onClick. */
  onErrors?: (errors: string[]) => void;
  /** Force-disable from the parent regardless of disabledReason. */
  disabled?: boolean;
  /** Additional className. */
  className?: string;
};

export function ActionButton({
  children,
  onClick,
  disabledReason,
  cost,
  hint,
  tone = 'neutral',
  onErrors,
  disabled,
  className,
}: ActionButtonProps) {
  const [busy, setBusy] = useState(false);
  const isDisabled = disabled || !!disabledReason || busy;

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    setBusy(true);
    try {
      const result = await onClick(event);
      if (Array.isArray(result) && result.length > 0 && onErrors) {
        onErrors(result);
      }
    } catch (err) {
      // Surface unexpected throws so the user is not left wondering why
      // nothing happened. We funnel through onErrors when possible, else
      // log to console so it's visible in dev.
      const message = err instanceof Error ? err.message : String(err);
      if (onErrors) onErrors([`errors.unexpected:${message}`]);
      else console.warn('[ActionButton] action threw', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      title={disabledReason ?? undefined}
      className={cn(
        'flex w-full flex-col items-stretch gap-0.5 rounded-md border px-3 py-2 text-left text-xs transition',
        isDisabled
          ? 'cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500'
          : TONE_STYLES[tone].enabled,
        busy ? TONE_STYLES[tone].pressed : null,
        className,
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{children}</span>
        {cost ? <span className="font-mono text-[11px] opacity-80">{cost}</span> : null}
      </span>
      {hint ? (
        <span className="text-[11px] leading-tight opacity-70">{hint}</span>
      ) : null}
      {disabledReason ? (
        <span className="text-[11px] italic leading-tight text-slate-500">
          {disabledReason}
        </span>
      ) : null}
    </button>
  );
}

export default ActionButton;

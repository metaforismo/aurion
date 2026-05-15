// Bottom-right toast for Eternal-mode milestone victories that fire AFTER
// the celebratory first-victory modal has already been acknowledged. Pops
// when the store sets `pendingVictoryToast` to a non-null id and
// auto-dismisses after 4 seconds.
//
// Mirrors the visual / interaction shape of AchievementToast so the player
// sees a familiar "you unlocked something" surface — only the icon, copy
// and accent colour differ.

'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { VictoryConditionId } from '@aurion/engine';

import { cn } from '../../lib/cn';
import { useGameStore } from '../../lib/store';

const AUTO_DISMISS_MS = 4_000;

export function VictoryToast() {
  const pending = useGameStore((s) => s.pendingVictoryToast);
  const dismiss = useGameStore((s) => s.dismissVictoryToast);
  const t = useTranslations('notifications.victoryToast');
  const tVictory = useTranslations('victory');

  // Auto-dismiss timer. Reset whenever `pending` changes so back-to-back
  // milestones each get a full window before being cleared.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!pending) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      dismiss();
    }, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pending, dismiss]);

  // ESC dismisses too — keeps the keyboard ergonomics consistent with the
  // achievement toast.
  useEffect(() => {
    if (!pending) return;
    if (typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pending, dismiss]);

  if (!pending) return null;

  const id = pending as VictoryConditionId;
  const conditionName = safeT(tVictory, `${id}.name`, id);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]',
        'rounded-xl border-2 border-accent bg-surface-1 shadow-2xl',
        'animate-in fade-in slide-in-from-bottom-2 duration-200',
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-base text-accent',
          )}
        >
          {/* Trophy glyph — kept as inline text so we don't pull in an icon
              dependency for a single tiny accent. */}
          {'\u{1F3C6}'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
            {t('unlocked')}
          </p>
          <p className="text-sm font-semibold text-fg">{conditionName}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="close"
          className="rounded-md border border-transparent p-1 text-fg-muted transition hover:border-border-strong hover:text-fg"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L8.94 10l-4.72 4.72a.75.75 0 1 0 1.06 1.06L10 11.06l4.72 4.72a.75.75 0 0 0 1.06-1.06L11.06 10l4.72-4.72a.75.75 0 0 0-1.06-1.06L10 8.94 5.28 4.22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Resolve a translation key, falling back to a literal when the key is
 * missing. next-intl returns the raw key on miss; we detect that and use the
 * provided fallback so we never render `victory.economic.name` to the user.
 */
function safeT(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any) => string,
  key: string,
  fallback: string,
): string {
  try {
    const value = t(key);
    return value === key ? fallback : value;
  } catch {
    return fallback;
  }
}

export default VictoryToast;

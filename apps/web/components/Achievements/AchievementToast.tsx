// Bottom-right achievement toast. Pops in when the store sets
// `pendingAchievementToast` to a non-null id, auto-dismisses after 4 seconds,
// and supports manual dismissal via a close button (or pressing Escape).

'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { AchievementDef } from '@aurion/engine';
import { BUILTIN_ACHIEVEMENTS } from '@aurion/engine';

import { cn } from '../../lib/cn';
import { useGameStore } from '../../lib/store';

const AUTO_DISMISS_MS = 4_000;

/**
 * Tier→token mapping for the toast border accent. Mirrors AchievementBadge so
 * a player can recognise tier at a glance without reading the label.
 */
const TIER_BORDER: Record<AchievementDef['tier'], string> = {
  bronze: 'border-warning',
  silver: 'border-border-strong',
  gold: 'border-accent',
};

const TIER_ACCENT: Record<AchievementDef['tier'], string> = {
  bronze: 'text-warning',
  silver: 'text-fg-muted',
  gold: 'text-accent',
};

export function AchievementToast() {
  const pending = useGameStore((s) => s.pendingAchievementToast);
  const dismiss = useGameStore((s) => s.dismissAchievementToast);
  const t = useTranslations();
  const tToast = useTranslations('achievements.toast');
  const tList = useTranslations('achievements.list');

  // Look up the matching def once per `pending` change.
  const def = useMemo<AchievementDef | null>(() => {
    if (!pending) return null;
    return BUILTIN_ACHIEVEMENTS.find((a) => a.id === pending) ?? null;
  }, [pending]);

  // Auto-dismiss timer. Reset whenever `pending` changes so back-to-back
  // unlocks each get a full window before being cleared.
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

  // ESC dismisses too.
  useEffect(() => {
    if (!pending) return;
    if (typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pending, dismiss]);

  if (!pending || !def) return null;

  const name = t(def.nameKey);
  const description = t(def.descKey);
  const tierLabel = tList(`tier.${def.tier}`);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]',
        'rounded-xl border-2 bg-surface-1 shadow-2xl',
        'animate-in fade-in slide-in-from-bottom-2 duration-200',
        TIER_BORDER[def.tier],
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-base',
            TIER_ACCENT[def.tier],
          )}
        >
          {tierIcon(def.tier)}
        </span>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wider',
              TIER_ACCENT[def.tier],
            )}
          >
            {tToast('unlocked')} · {tierLabel}
          </p>
          <p className="text-sm font-semibold text-fg">{name}</p>
          <p className="mt-1 text-xs text-fg-muted line-clamp-2">{description}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={tToast('dismiss')}
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

function tierIcon(tier: AchievementDef['tier']): string {
  switch (tier) {
    case 'bronze':
      return '*';
    case 'silver':
      return '+';
    case 'gold':
      return '#';
  }
}

export default AchievementToast;

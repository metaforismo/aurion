// Trophy toast. Appears when the store queues `pendingAchievementToast`,
// leaves on its own after a few seconds, and can be closed with the button
// or Escape. Mounted by the play screen.

'use client';

import { BUILTIN_ACHIEVEMENTS, type AchievementDef } from '@aurion/engine';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';

import { IconButton } from '../ui';
import { useGameStore } from '../../lib/store';
import { Medal, TIER_COLOR } from './Medal';

const AUTO_DISMISS_MS = 5_000;

export function AchievementToast() {
  const pending = useGameStore((s) => s.pendingAchievementToast);
  const dismiss = useGameStore((s) => s.dismissAchievementToast);
  const t = useTranslations();
  const tToast = useTranslations('achievements.toast');
  const tList = useTranslations('achievements.list');

  const def = useMemo<AchievementDef | null>(
    () => (pending ? (BUILTIN_ACHIEVEMENTS.find((a) => a.id === pending) ?? null) : null),
    [pending],
  );

  // Each unlock gets its own full window (the play screen plays the chime).
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [pending, dismiss]);

  if (!pending || !def) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="achievement-toast"
      // Slides in from the right; the global reduced-motion rule makes it a cut.
      style={{ animation: 'toast-slide-in 220ms cubic-bezier(0, 0, 0.2, 1) both' }}
      className="glass-panel fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: TIER_COLOR[def.tier] }}
      />
      <div className="flex items-center gap-3 py-3 pl-4 pr-2">
        <Medal tier={def.tier} size={40} />
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: TIER_COLOR[def.tier] }}
          >
            {tToast('unlocked')} · {tList(`tier.${def.tier}`)}
          </p>
          <p className="truncate text-sm font-semibold text-fg">{t(def.nameKey)}</p>
          <p className="line-clamp-2 text-xs leading-relaxed text-fg-muted">{t(def.descKey)}</p>
        </div>
        <IconButton icon={X} label={tToast('dismiss')} onClick={dismiss} className="self-start" />
      </div>
    </div>
  );
}

export default AchievementToast;

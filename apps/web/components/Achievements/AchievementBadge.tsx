// Compact tier-coloured chip used in achievement lists and on the toast.

'use client';

import { useTranslations } from 'next-intl';
import type { AchievementDef } from '@aurion/engine';

import { cn } from '../../lib/cn';

export type AchievementBadgeProps = {
  achievement: AchievementDef;
  /**
   * When false, render the locked silhouette with the localised "Locked"
   * placeholder name. Defaults to true (= unlocked).
   */
  unlocked?: boolean;
  /** Optional className appended to the outer chip. */
  className?: string;
};

/**
 * Tier→token mapping. We deliberately use semantic Tailwind tokens so the
 * chip respects light/dark themes without per-tier overrides.
 *   - bronze → warning (amber)
 *   - silver → fg-muted (neutral)
 *   - gold   → accent (brand highlight)
 */
const TIER_STYLES: Record<AchievementDef['tier'], { ring: string; chip: string; dot: string }> = {
  bronze: {
    ring: 'border-warning/40',
    chip: 'bg-warning/15 text-warning',
    dot: 'bg-warning',
  },
  silver: {
    ring: 'border-border-strong',
    chip: 'bg-surface-2 text-fg-muted',
    dot: 'bg-fg-muted',
  },
  gold: {
    ring: 'border-accent',
    chip: 'bg-accent/15 text-accent',
    dot: 'bg-accent',
  },
};

export function AchievementBadge({
  achievement,
  unlocked = true,
  className,
}: AchievementBadgeProps) {
  const t = useTranslations();
  const tList = useTranslations('achievements.list');
  const styles = TIER_STYLES[achievement.tier];

  const showSecret = achievement.hidden && !unlocked;
  const name = showSecret
    ? tList('locked')
    : t(achievement.nameKey);
  const tierLabel = tList(`tier.${achievement.tier}`);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
        styles.ring,
        unlocked ? styles.chip : 'bg-surface-1 text-fg-faint',
        className,
      )}
      aria-label={`${tierLabel} — ${name}`}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-2 w-2 rounded-full',
          unlocked ? styles.dot : 'bg-fg-faint/40',
        )}
      />
      <span className="uppercase tracking-wider text-[10px] opacity-70">
        {tierLabel}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

export default AchievementBadge;

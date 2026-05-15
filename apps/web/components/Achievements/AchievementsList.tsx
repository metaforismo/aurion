// Full-catalogue achievement list. Renders every entry from BUILTIN_ACHIEVEMENTS
// with locked entries greyed out as silhouettes and hidden entries displayed
// as "???" until unlocked. Used on the home page or a dedicated route.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AchievementDef, AchievementId } from '@aurion/engine';
import { BUILTIN_ACHIEVEMENTS } from '@aurion/engine';

import { cn } from '../../lib/cn';
import {
  getUnlockedAchievements,
  type UnlockedAchievement,
} from '../../lib/persistence';

export type AchievementsListProps = {
  /** Optional explicit unlocked set; when omitted we read from IndexedDB. */
  unlockedIds?: ReadonlySet<AchievementId>;
  /** Optional className appended to the outer container. */
  className?: string;
};

const TIER_BORDER: Record<AchievementDef['tier'], string> = {
  bronze: 'border-warning/40',
  silver: 'border-border-strong',
  gold: 'border-accent',
};

const TIER_TEXT: Record<AchievementDef['tier'], string> = {
  bronze: 'text-warning',
  silver: 'text-fg-muted',
  gold: 'text-accent',
};

const TIER_ICON_BG: Record<AchievementDef['tier'], string> = {
  bronze: 'bg-warning/15',
  silver: 'bg-surface-2',
  gold: 'bg-accent/15',
};

export function AchievementsList({
  unlockedIds,
  className,
}: AchievementsListProps) {
  const tList = useTranslations('achievements.list');
  const t = useTranslations();

  const [hydrated, setHydrated] = useState<ReadonlySet<AchievementId> | null>(
    unlockedIds ?? null,
  );

  // Lazy hydrate from IndexedDB only when no explicit prop is given.
  useEffect(() => {
    if (unlockedIds) return;
    let cancelled = false;
    void getUnlockedAchievements()
      .then((rows: UnlockedAchievement[]) => {
        if (cancelled) return;
        setHydrated(new Set(rows.map((r) => r.id)));
      })
      .catch(() => {
        if (cancelled) return;
        setHydrated(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [unlockedIds]);

  const unlocked: ReadonlySet<AchievementId> = unlockedIds ?? hydrated ?? new Set();

  const items = useMemo(() => {
    // Stable order: tier (bronze → silver → gold), then alphabetical id.
    const tierWeight: Record<AchievementDef['tier'], number> = {
      bronze: 0,
      silver: 1,
      gold: 2,
    };
    return [...BUILTIN_ACHIEVEMENTS].sort((a, b) => {
      const tw = tierWeight[a.tier] - tierWeight[b.tier];
      if (tw !== 0) return tw;
      return a.id.localeCompare(b.id);
    });
  }, []);

  const totalUnlocked = items.filter((i) => unlocked.has(i.id)).length;

  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-surface-1/50 p-4',
        className,
      )}
      aria-label={tList('title')}
    >
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">
          {tList('title')}
        </h2>
        <span className="numeric-tabular font-mono text-xs text-fg-faint">
          {totalUnlocked}/{items.length}
        </span>
      </header>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((def) => {
          const isUnlocked = unlocked.has(def.id);
          const showSecret = def.hidden === true && !isUnlocked;
          const name = showSecret ? tList('locked') : t(def.nameKey);
          const description = showSecret ? '' : t(def.descKey);
          return (
            <li
              key={def.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 transition',
                isUnlocked
                  ? cn('bg-surface-1', TIER_BORDER[def.tier])
                  : 'border-border bg-bg/40 opacity-70',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  isUnlocked ? cn(TIER_ICON_BG[def.tier], TIER_TEXT[def.tier]) : 'bg-surface-2 text-fg-faint',
                )}
              >
                {isUnlocked ? tierGlyph(def.tier) : '?'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={cn(
                      'truncate text-sm font-semibold',
                      isUnlocked ? 'text-fg' : 'text-fg-faint',
                    )}
                  >
                    {name}
                  </p>
                  <span
                    className={cn(
                      'shrink-0 text-[10px] uppercase tracking-wider',
                      isUnlocked ? TIER_TEXT[def.tier] : 'text-fg-faint',
                    )}
                  >
                    {tList(`tier.${def.tier}`)}
                  </span>
                </div>
                {description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">
                    {description}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function tierGlyph(tier: AchievementDef['tier']): string {
  switch (tier) {
    case 'bronze':
      return '*';
    case 'silver':
      return '+';
    case 'gold':
      return '#';
  }
}

export default AchievementsList;

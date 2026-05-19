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

// Editorial pass: list rows lose their tinted background. Tier is rendered
// via the colour of the small-caps tier label + the glyph ink; the row keeps
// only a hairline divider via `divide-y` on the parent list.
const TIER_TEXT: Record<AchievementDef['tier'], string> = {
  bronze: 'text-warning',
  silver: 'text-fg-muted',
  gold: 'text-accent',
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
        'flex flex-col gap-3 border border-border bg-bg p-4',
        className,
      )}
      aria-label={tList('title')}
    >
      <header className="flex items-baseline justify-between border-b border-border pb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {tList('title')}
        </h2>
        <span className="numeric-tabular font-mono text-xs text-fg-faint">
          {totalUnlocked}/{items.length}
        </span>
      </header>
      <ol className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
        {items.map((def) => {
          const isUnlocked = unlocked.has(def.id);
          const showSecret = def.hidden === true && !isUnlocked;
          const name = showSecret ? tList('locked') : t(def.nameKey);
          const description = showSecret ? '' : t(def.descKey);
          return (
            <li
              key={def.id}
              className={cn(
                'flex items-start gap-3 border-b border-border py-3 transition sm:border-b-0 sm:border-t',
                isUnlocked ? null : 'opacity-60',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex h-5 w-5 shrink-0 items-center justify-center font-mono text-sm font-bold',
                  isUnlocked ? TIER_TEXT[def.tier] : 'text-fg-faint',
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
                      'shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em]',
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

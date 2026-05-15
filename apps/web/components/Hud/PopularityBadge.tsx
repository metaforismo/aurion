// Popularity display. 0..100 scale with a coloured indicator dot:
//   < 30 → red (danger)   30..60 → amber (caution)   > 60 → green (healthy).

'use client';

import { useTranslations } from 'next-intl';

import { cn } from '../../lib/cn';
import { selectPlayerCountry, useGameStore } from '../../lib/store';

export function PopularityBadge() {
  const player = useGameStore(selectPlayerCountry);
  const t = useTranslations('hud');

  const popularity = Math.round(player?.politics.popularity ?? 0);
  const tone =
    popularity < 30
      ? 'bg-danger'
      : popularity <= 60
        ? 'bg-warning'
        : 'bg-success';

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-bg/40 px-3 py-1.5">
      <span
        className={cn('inline-block h-2.5 w-2.5 rounded-full', tone)}
        aria-hidden="true"
      />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
        {t('popularity')}
      </span>
      <span className="numeric-tabular font-mono text-sm text-fg">
        {popularity}%
      </span>
    </div>
  );
}

export default PopularityBadge;

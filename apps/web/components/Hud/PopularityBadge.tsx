// Popularity display. 0..100 scale with a coloured value:
//   < 30 → red (danger)   30..60 → amber (warning)   > 60 → green (healthy).
//
// Visual: inline label + percentage. No background, no border, no dot — the
// number itself carries the colour so the row reads like a Bloomberg
// terminal ticker rather than a kit of chips.

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
      ? 'text-danger'
      : popularity <= 60
        ? 'text-warning'
        : 'text-success';

  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
        {t('popularity')}
      </span>
      <span className={cn('numeric-tabular font-mono text-sm', tone)}>
        {popularity}%
      </span>
    </div>
  );
}

export default PopularityBadge;

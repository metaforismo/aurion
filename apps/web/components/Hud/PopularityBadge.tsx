// Popularity display. 0..100 scale with a coloured value driven by the
// player's standing:
//
//   < 30  → red    (danger)
//   30-49 → amber  (warning)
//   50-69 → fg     (neutral / "in the safe zone")
//   ≥ 70  → green  (success)
//
// Visual: muted star icon + percentage. The verbose "POPOLARITÀ" caps label
// is replaced by a `Star` glyph so the chip occupies less horizontal space
// — the percentage is unambiguous in context, and the icon does the
// signalling. The number itself carries the colour so the row reads like a
// Bloomberg terminal ticker rather than a kit of chips.

'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '../../lib/cn';
import { selectPlayerCountry, useGameStore } from '../../lib/store';

export function PopularityBadge() {
  const player = useGameStore(selectPlayerCountry);
  const t = useTranslations('hud');

  const popularity = Math.round(player?.politics.popularity ?? 0);
  // Four-band scale: a single mid-zone ("fg") between the warning band and
  // the success band so the player has visible headroom before "safe" turns
  // into "thriving". The star icon stays muted regardless of value — it's a
  // glyph anchor, not part of the signal.
  const tone =
    popularity < 30
      ? 'text-danger'
      : popularity < 50
        ? 'text-warning'
        : popularity < 70
          ? 'text-fg'
          : 'text-success';

  return (
    <div className="flex items-baseline gap-2" title={t('popularity')}>
      <Star
        aria-hidden="true"
        className="h-3.5 w-3.5 self-center text-fg-faint"
      />
      <span className="sr-only">{t('popularity')}</span>
      <span className={cn('numeric-tabular font-mono text-sm', tone)}>
        {popularity}%
      </span>
    </div>
  );
}

export default PopularityBadge;

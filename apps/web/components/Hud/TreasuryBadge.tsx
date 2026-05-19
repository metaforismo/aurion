// Treasury display. Shows the player's current treasury formatted as a
// thousand-separated euro amount, plus a coloured weekly delta arrow so the
// player can see at a glance whether they're hemorrhaging money.
//
// Formatting note: we deliberately drop `notation: 'compact'` on the delta
// to avoid the unit-duplication smell of "13,2 Mld €  ▲ +550,4 Mln €". The
// main value still carries the `€` so the row stays self-describing, while
// the weekly delta is rendered as a bare signed integer with thousands
// separators — the surrounding label ("Treasury") supplies the unit.
//
// Visual: inline label + value + delta. No card chrome — the parent HUD owns
// the row. The delta uses ▲ / ▼ glyphs coloured by `success` / `danger`; the
// treasury value itself turns `danger` only when actually negative, so the
// player isn't yelled at for a tight-but-positive budget.

'use client';

import { useFormatter, useTranslations } from 'next-intl';

import { cn } from '../../lib/cn';
import { selectPlayerCountry, useGameStore } from '../../lib/store';

export function TreasuryBadge() {
  const player = useGameStore(selectPlayerCountry);
  const t = useTranslations('hud');
  const format = useFormatter();

  const treasury = player?.economy.treasury ?? 0;
  const weekly = player?.economy.weeklyIncome ?? 0;
  const isNegative = treasury < 0;

  // Main treasury: thousands-separated EUR, no compact notation. We keep the
  // currency style here so the value is self-identifying without a label.
  const treasuryFormatted = format.number(Math.round(treasury), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

  // Weekly delta: bare signed integer with thousands separators. The
  // adjacent treasury value (and the small-caps label) already establish the
  // unit — duplicating "€" would over-decorate the row.
  const weeklyFormatted = format.number(Math.round(weekly), {
    maximumFractionDigits: 0,
    signDisplay: 'always',
  });

  const deltaClass =
    weekly > 0
      ? 'text-success'
      : weekly < 0
        ? 'text-danger'
        : 'text-fg-muted';
  const arrow = weekly > 0 ? '▲' : weekly < 0 ? '▼' : '·';

  return (
    <div className="flex items-baseline gap-2" title={t('treasury')}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
        {t('treasury')}
      </span>
      <span
        className={cn(
          'numeric-tabular font-mono text-sm',
          isNegative ? 'text-danger' : 'text-fg',
        )}
      >
        {treasuryFormatted}
      </span>
      <span className={cn('numeric-tabular font-mono text-[11px]', deltaClass)}>
        <span aria-hidden="true">{arrow}</span> {weeklyFormatted}
        <span className="sr-only">/ {t('perWeek')}</span>
      </span>
    </div>
  );
}

export default TreasuryBadge;

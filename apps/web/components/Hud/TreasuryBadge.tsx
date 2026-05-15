// Treasury display. Shows the player's current treasury formatted as compact
// currency, plus a coloured weekly delta arrow so the player can see at a
// glance whether they're hemorrhaging money.

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

  const treasuryFormatted = format.number(Math.round(treasury), {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  const weeklyFormatted = format.number(Math.round(weekly), {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
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
    <div
      className="flex items-baseline gap-2 rounded-md border border-border bg-bg/40 px-3 py-1.5"
      title={t('treasury')}
    >
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

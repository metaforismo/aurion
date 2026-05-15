// In-game calendar badge. The engine ticks once per in-game week; we map the
// raw tick to a `Week N · Year M` label. Year/week math lives here so the rest
// of the HUD can stay simple.

'use client';

import { useTranslations } from 'next-intl';

import { useGameStore } from '../../lib/store';

const WEEKS_PER_YEAR = 52;

export function DateBadge() {
  const tick = useGameStore((s) => s.state?.tick ?? 0);
  const t = useTranslations('hud');

  const year = Math.floor(tick / WEEKS_PER_YEAR) + 1;
  const week = (tick % WEEKS_PER_YEAR) + 1;

  return (
    <div className="flex items-baseline gap-2 rounded-md border border-border bg-bg/40 px-3 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
        {t('dateLabel')}
      </span>
      <span className="numeric-tabular font-mono text-sm text-fg">
        {t('dateValue', { week, year })}
      </span>
    </div>
  );
}

export default DateBadge;

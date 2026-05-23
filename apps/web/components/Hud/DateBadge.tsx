// In-game calendar badge. The engine ticks once per in-game week; we map the
// raw tick to a compact `S{week} · {Mon} {year}` label. Year / week / month
// math lives here so the rest of the HUD can stay simple.
//
// Visual: flat inline icon + value pair — no border, no background. A muted
// calendar glyph replaces the redundant "DATA" caps label (the value format
// already implies a date). The HUD parent supplies any separator. The value
// is mono / tabular so it doesn't visually shift as the week ticks.
//
// Format rationale: the previous "Settimana 14 · Anno 1" reads like a debug
// counter. Mapping the week to a month name ("S14 · Apr 1") gives the
// player a real-world calendar anchor while keeping the row compact enough
// for the 52px HUD strip. Month is computed by dividing the 52-week year
// into 12 equal slices — close enough for game-feel; we don't try to mirror
// real ISO week numbers because the engine has no concept of a wall clock.
//
// Accessibility: we keep the legacy long-form ("Week W · Year Y") inside an
// `sr-only` span so screen readers still narrate the full date AND existing
// e2e selectors that match `/(Settimana|Week)\s+\d+\s*[·•|]\s*(Anno|Year)\s+\d+/`
// continue to find it in the header's textContent.

'use client';

import { Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useGameStore } from '../../lib/store';

const WEEKS_PER_YEAR = 52;
const WEEKS_PER_MONTH = WEEKS_PER_YEAR / 12; // ≈ 4.333 — kept fractional so
                                             // months tile evenly across a year.

/** 12 month i18n keys under `hud.months.*`, indexed Jan=0 → Dec=11. */
const MONTH_KEYS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

export function DateBadge() {
  const tick = useGameStore((s) => s.state?.tick ?? 0);
  const t = useTranslations('hud');
  const tMonths = useTranslations('hud.months');

  const year = Math.floor(tick / WEEKS_PER_YEAR) + 1;
  const week = (tick % WEEKS_PER_YEAR) + 1;

  // Map week-in-year → month index (0..11). Each calendar month spans
  // ~4.333 weeks so we floor the ratio. Clamp to [0, 11] defensively — the
  // engine guarantees `tick % 52` is in range, but a corrupted save could
  // surface a NaN tick.
  const monthIndex = clampMonth(
    Math.floor((week - 1) / WEEKS_PER_MONTH),
  );
  const monthKey = MONTH_KEYS[monthIndex] ?? 'jan';
  const month = tMonths(monthKey);

  return (
    <div className="flex items-baseline gap-2" title={t('dateLabel')}>
      <Calendar
        aria-hidden="true"
        className="h-3.5 w-3.5 self-center text-fg-faint"
      />
      <span className="sr-only">{t('dateLabel')}</span>
      <span className="numeric-tabular font-mono text-sm text-fg">
        {t('dateCompact', { week, month, year })}
      </span>
      {/* Legacy long-form label — invisible, but kept in the DOM so screen
          readers narrate the full date and any e2e spec that parses the
          historical "(Settimana|Week) N · (Anno|Year) M" pattern from the
          header text keeps matching. */}
      <span className="sr-only">
        {t('dateValue', { week, year })}
      </span>
    </div>
  );
}

function clampMonth(i: number): number {
  if (!Number.isFinite(i) || i < 0) return 0;
  if (i > 11) return 11;
  return i;
}

export default DateBadge;

'use client';

// Run statistics: small multiples, one measure per chart (never two scales
// on one plot). Each is a single 2px line with its latest value stated in
// text, a crosshair + readout on hover or arrow keys, and the same numbers
// available as a table.

import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { HistorySample } from '@aurion/engine';

import { money, percent } from '../../lib/format';
import { useGameStore } from '../../lib/store';

/** Series hue: validated for the dark surface (lightness band, contrast). */
const LINE = '#3d9bd6';
const W = 280;
const H = 96;
const PAD = { top: 8, right: 10, bottom: 4, left: 2 };

type SeriesKey = 'gdp' | 'treasury' | 'popularity' | 'kardashev' | 'rank';

type Series = {
  key: SeriesKey;
  value: (s: HistorySample) => number;
  format: (v: number) => string;
  /** Rank reads better with first place at the top. */
  inverted?: boolean;
};

const EMPTY: readonly HistorySample[] = [];

export function RunCharts() {
  const t = useTranslations('stats');
  const locale = useLocale();
  const history = useGameStore((s) => s.state?.history ?? EMPTY);

  const series = useMemo<Series[]>(
    () => [
      { key: 'gdp', value: (s) => s.gdp, format: (v) => money(v, locale) },
      { key: 'treasury', value: (s) => s.treasury, format: (v) => money(v, locale) },
      { key: 'popularity', value: (s) => s.popularity, format: (v) => percent(v / 100, locale) },
      { key: 'kardashev', value: (s) => s.kardashev, format: (v) => v.toFixed(2) },
      { key: 'rank', value: (s) => s.rank, format: (v) => t('rankValue', { rank: Math.round(v) }), inverted: true },
    ],
    [locale, t],
  );

  if (history.length < 2) {
    return <p className="text-sm text-fg-faint">{t('empty')}</p>;
  }

  const when = (tick: number) => t('weekOf', { year: Math.floor(tick / 52) + 1, week: (tick % 52) + 1 });

  return (
    <div className="flex flex-col gap-4" data-testid="run-charts">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {series.map((s) => (
          <Chart key={s.key} series={s} history={history} name={t(`series.${s.key}`)} when={when} />
        ))}
      </div>
      <details className="text-xs text-fg-muted">
        <summary className="cursor-pointer rounded px-1 py-0.5 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          {t('table')}
        </summary>
        <div className="thin-scroll mt-2 max-h-56 overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[oklch(0.16_0.016_255)] text-fg-faint">
              <tr>
                <th scope="col" className="px-2 py-1 font-medium">{t('when')}</th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="px-2 py-1 text-right font-medium">
                    {t(`series.${s.key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.tick} className="border-t border-white/[0.06]">
                  <th scope="row" className="whitespace-nowrap px-2 py-1 font-normal text-fg-faint">{when(h.tick)}</th>
                  {series.map((s) => (
                    <td key={s.key} className="numeric-tabular px-2 py-1 text-right font-mono text-fg">
                      {s.format(s.value(h))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Chart({
  series,
  history,
  name,
  when,
}: {
  series: Series;
  history: readonly HistorySample[];
  name: string;
  when: (tick: number) => string;
}) {
  const t = useTranslations('stats');
  const titleId = useId();
  const [active, setActive] = useState<number | null>(null);

  const values = history.map(series.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (history.length - 1)) * innerW;
  const y = (v: number) => {
    const share = (v - min) / span;
    return PAD.top + (series.inverted ? share : 1 - share) * innerH;
  };
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const last = history.length - 1;
  const shown = active ?? last;
  const sample = history[shown]!;

  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / innerW) * last);
    setActive(Math.max(0, Math.min(last, i)));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(last);
    else if (step !== 0) setActive(Math.max(0, Math.min(last, (active ?? last) + step)));
    else return;
    e.preventDefault();
  };

  return (
    <figure className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span id={titleId} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {name}
        </span>
        {/* The readout: the latest value, or the one under the crosshair. */}
        <span className="text-right leading-tight" aria-live="polite">
          <span className="numeric-tabular block font-mono text-sm font-semibold text-fg">
            {series.format(series.value(sample))}
          </span>
          <span className="block text-[10px] text-fg-faint">{when(sample.tick)}</span>
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        tabIndex={0}
        aria-labelledby={titleId}
        aria-label={t('chartLabel', {
          name,
          from: series.format(values[0]!),
          to: series.format(values[last]!),
        })}
        className="mt-2 block w-full touch-none rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        onPointerMove={fromPointer}
        onPointerDown={fromPointer}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
      >
        {/* Recessive baseline; no gridlines needed at this size. */}
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <path d={path} fill="none" stroke={LINE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {active !== null ? (
          <line x1={x(shown)} x2={x(shown)} y1={PAD.top - 4} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        ) : null}
        {/* Marker with a surface ring so it reads on top of the line. */}
        <circle cx={x(shown)} cy={y(values[shown]!)} r="4.5" fill={LINE} stroke="oklch(0.14 0.015 255)" strokeWidth="2" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-fg-faint">
        <span>{t('year', { n: Math.floor(history[0]!.tick / 52) + 1 })}</span>
        <span>{t('year', { n: Math.floor(history[last]!.tick / 52) + 1 })}</span>
      </div>
    </figure>
  );
}

export default RunCharts;

'use client';

// Sparkline of weekly income for the running session.

import { useLocale, useTranslations } from 'next-intl';

import { money } from '../../../lib/format';

import type { IncomeSample } from './history';

const W = 240;
const H = 40;
const PAD = 3;

export function IncomeTrend({ samples }: { samples: readonly IncomeSample[] }) {
  const t = useTranslations('panelEconomy.trend');
  const locale = useLocale();

  if (samples.length < 3) {
    return <p className="text-[11px] leading-snug text-fg-faint">{t('collecting')}</p>;
  }

  const values = samples.map((s) => s.income);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max === min;
  const span = max - min || 1;
  const stepX = (W - PAD * 2) / (values.length - 1);
  const points = values.map((v, i) => ({
    x: PAD + i * stepX,
    // A steady income sits mid-height instead of hugging an edge.
    y: flat ? H / 2 : PAD + (1 - (v - min) / span) * (H - PAD * 2),
  }));
  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const first = values[0]!;
  const last = values[values.length - 1]!;
  const end = points[points.length - 1]!;
  const stroke = last >= first ? 'var(--color-success)' : 'var(--color-danger)';

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-10 w-full"
        role="img"
        aria-label={t('aria', {
          weeks: samples.length,
          from: money(first, locale),
          to: money(last, locale),
        })}
      >
        <polygon
          points={`${PAD},${H} ${line} ${W - PAD},${H}`}
          fill={stroke}
          opacity={0.12}
        />
        <polyline
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={end.x} cy={end.y} r={2.5} fill={stroke} />
      </svg>
      <figcaption className="mt-0.5 flex justify-between gap-2 whitespace-nowrap font-mono text-[10px] text-fg-faint">
        <span>{t('span', { weeks: samples.length })}</span>
        <span>
          {flat ? t('flat') : t('range', { min: money(min, locale), max: money(max, locale) })}
        </span>
      </figcaption>
    </figure>
  );
}

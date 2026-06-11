// PanelHero — progressive-disclosure hero card for left-rail panels.
//
// Purpose: combat cognitive overload by surfacing ONE big number + at most
// three small inline quick-stats per panel. Every secondary surface lives
// inside a <Disclosure> ("Più dettagli") below. The hero is intentionally
// minimal — title, value, optional trend chip — and acts as the visual
// anchor of the panel.
//
// Tokens used:
//   - Title: small caps, `text-fg-muted`, with the 1px accent rule on the
//     left (mirrors the editorial style of `Section`).
//   - Value: `text-3xl`, mono-tabular for numerals (so digits don't dance).
//   - Delta chip: hairline border, semantic tone, inline arrow + value.
//   - Quick stats: a single row of 2–3 label/value pairs, all small.

'use client';

import type { ReactNode } from 'react';

import { cn } from '../../../lib/cn';
import { tone, type Tone } from '../../../lib/theme';

export type PanelHeroQuickStat = {
  /** Short label rendered above the value (UPPERCASE small-caps). */
  label: ReactNode;
  /** Inline value. Numbers render in mono-tabular by default. */
  value: ReactNode;
};

export type PanelHeroDelta = {
  /** Numeric value driving the chip's tone — positive = success, negative = danger, 0 = muted. */
  value: number;
  /** Pre-formatted label rendered to the right of the arrow (e.g. "+12 / wk"). */
  label: ReactNode;
};

export type PanelHeroProps = {
  /** Panel name (small caps). */
  title: ReactNode;
  /** BIG hero value (numeric or scalar). */
  value: ReactNode;
  /** Optional trend chip (small inline arrow + label). */
  delta?: PanelHeroDelta;
  /** Up to 3 inline mini-stats rendered below the hero value. */
  quickStats?: readonly PanelHeroQuickStat[];
  /** Optional explicit semantic tone for the hero value colour. Defaults to neutral. */
  valueTone?: Tone;
  /** Additional className for the outer wrapper. */
  className?: string;
  /** Forwarded testid so panels can stably target the hero in E2E specs. */
  'data-testid'?: string;
};

export function PanelHero({
  title,
  value,
  delta,
  quickStats,
  valueTone = 'neutral',
  className,
  'data-testid': dataTestId,
}: PanelHeroProps) {
  return (
    <section
      data-testid={dataTestId}
      className={cn('flex flex-col gap-2 pb-3', className)}
    >
      {/* Title row — 1px accent rule + small-caps label. */}
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-[1.05em] w-px bg-accent"
        />
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {title}
        </h3>
      </div>

      {/* Hero value + optional delta chip on the same baseline. */}
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'font-mono text-3xl leading-none numeric-tabular',
            tone(valueTone),
          )}
        >
          {value}
        </span>
        {delta ? <DeltaChip delta={delta} /> : null}
      </div>

      {/* Quick stats — a single row of label/value pairs. Hard-capped at 3
          so a caller passing a longer list can't collapse the hero layout. */}
      {quickStats && quickStats.length > 0 ? (
        <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-0.5">
          {quickStats.slice(0, 3).map((stat, i) => (
            <div key={i} className="flex items-baseline gap-1.5">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                {stat.label}
              </dt>
              <dd className="font-mono text-xs text-fg numeric-tabular">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

function DeltaChip({ delta }: { delta: PanelHeroDelta }) {
  const arrow = delta.value > 0 ? '▲' : delta.value < 0 ? '▼' : '·';
  const toneClass =
    delta.value > 0
      ? 'border-success/50 text-success'
      : delta.value < 0
        ? 'border-danger/50 text-danger'
        : 'border-border text-fg-muted';
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[11px] numeric-tabular',
        toneClass,
      )}
    >
      <span aria-hidden>{arrow}</span>
      <span>{delta.label}</span>
    </span>
  );
}

export default PanelHero;

'use client';

// The settlement on the Moon or Mars: how many people live there, how much
// room is left, and the mandate that decides what it sends home.

import {
  COLONY_FOCUSES,
  colonyOutput,
  getColonyStatus,
  type ColonyBody,
  type ColonyFocus,
} from '@aurion/engine';
import { ArrowDown, Factory, FlaskConical, Scale, ShoppingBag, type LucideIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Fragment, useState } from 'react';

import { cn } from '../../lib/cn';
import { compactNumber, money } from '../../lib/format';
import { useGameStore } from '../../lib/store';
import { Meter, Segmented } from '../ui';

import TerritorySection from './TerritorySection';

const ICON: Record<ColonyFocus, LucideIcon> = {
  balanced: Scale,
  science: FlaskConical,
  industry: Factory,
  trade: ShoppingBag,
};

export default function ColonyCard({
  body,
  selectedSector,
  nameOf,
  onVisit,
}: {
  body: ColonyBody;
  /** The sector picked on the surface; picking one opens the territory tab. */
  selectedSector: string | null;
  nameOf: (countryId: string) => string;
  /** Go down to the surface and look at the base. */
  onVisit: () => void;
}) {
  const t = useTranslations('cosmos.colony');
  const locale = useLocale();
  const state = useGameStore((s) => s.state);
  const applyAction = useGameStore((s) => s.applyAction);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'mandate' | 'territory'>('mandate');
  // Picking a sector on the surface brings its tab forward (derived state).
  const [seen, setSeen] = useState(selectedSector);
  if (seen !== selectedSector) {
    setSeen(selectedSector);
    if (selectedSector) setTab('territory');
  }

  const colony = state ? getColonyStatus(state, body) : null;
  if (!state || !colony) return null;
  const unit = state.cosmos?.unit ?? 0;
  const locked = colony.focusLockedFor > 0;
  const number = (n: number, digits = 1) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits, signDisplay: 'exceptZero' }).format(n);

  /** What a mandate would send home at today's population. */
  const yieldOf = (focus: ColonyFocus): string[] => {
    const o = colonyOutput(colony.population, focus, unit);
    const parts: string[] = [];
    if (o.research > 0) parts.push(t('yield.research', { v: number(o.research) }));
    if (o.income > 0) parts.push(t('yield.income', { v: money(o.income, locale) }));
    if (o.projectSpeed > 0) parts.push(t('yield.speed', { v: number(o.projectSpeed * 100) }));
    return parts;
  };

  const choose = async (focus: ColonyFocus) => {
    if (busy || locked || focus === colony.focus) return;
    setBusy(true);
    try {
      await applyAction({ type: 'setColonyFocus', body, focus });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={t(`title.${body}`)}
      data-testid={`colony-${body}`}
      className="glass-panel absolute bottom-28 z-10 w-[min(27rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl p-3.5 lg:bottom-20"
      style={{ left: 'var(--stage-center, 50%)', animation: 'rise-in 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both' }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-fg">{t(`title.${body}`)}</h3>
          <button
            type="button"
            onClick={onVisit}
            data-testid={`colony-${body}-visit`}
            className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-black transition-colors hover:bg-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ArrowDown aria-hidden className="h-3 w-3" />
            {t('visit')}
          </button>
        </div>
        <p className="numeric-tabular font-mono text-[11px] text-fg-muted" data-testid={`colony-${body}-population`}>
          {t('people', {
            n: compactNumber(colony.population, locale),
            cap: compactNumber(colony.capacity, locale),
          })}
        </p>
      </div>
      <Meter
        className="mt-2"
        tone="info"
        value={colony.capacity > 0 ? colony.population / colony.capacity : 0}
      />
      <p className="mt-1.5 text-[11px] leading-snug text-fg-faint">
        {colony.population < colony.capacity ? t('growing') : t('full')}
      </p>

      <Segmented
        size="sm"
        label={t('tabs')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'mandate' as const, label: t('tab.mandate') },
          { value: 'territory' as const, label: t('tab.territory') },
        ]}
        className="mt-2.5 flex"
      />

      {tab === 'territory' ? (
        <div className="mt-2.5">
          <TerritorySection
            state={state}
            body={body}
            population={colony.population}
            selected={selectedSector}
            nameOf={nameOf}
          />
        </div>
      ) : (
        <>
      <div role="radiogroup" aria-label={t('mandate')} className="mt-2.5 grid grid-cols-2 gap-1.5">
        {COLONY_FOCUSES.map((focus) => {
          const Icon = ICON[focus];
          const active = focus === colony.focus;
          return (
            <button
              key={focus}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={locked && !active}
              data-testid={`colony-${body}-focus-${focus}`}
              onClick={() => void choose(focus)}
              className={cn(
                'flex min-w-0 items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                active
                  ? 'border-[#5cc8ff]/50 bg-[#5cc8ff]/10'
                  : locked
                    ? 'cursor-not-allowed border-white/[0.06] opacity-60'
                    : 'border-white/[0.08] bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.07]',
              )}
            >
              <Icon aria-hidden className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-[#8ad8ff]' : 'text-fg-muted')} />
              <span className="min-w-0">
                <span className="block text-[12px] font-medium text-fg">{t(`focus.${focus}`)}</span>
                <span className="numeric-tabular block text-[11px] leading-snug text-fg-muted">
                  {/* Each figure stays whole when the line wraps. */}
                  {yieldOf(focus).map((part, i) => (
                    <Fragment key={part}>
                      {i > 0 ? ' · ' : null}
                      <span className="whitespace-nowrap">{part}</span>
                    </Fragment>
                  ))}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-fg-faint">
        {locked ? t('locked', { weeks: colony.focusLockedFor }) : t('hint')}
      </p>
        </>
      )}
    </section>
  );
}

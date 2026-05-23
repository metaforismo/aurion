// Economy system panel.
// Reads the player country's economy slice and dispatches:
//   - setTaxRate (debounced via slider commit)
//   - invest (target: 'infra' | 'economy')
//
// Layout follows the progressive-disclosure pattern:
//   - PanelHero shows the BIG treasury value + a weekly-income delta chip
//     and inline quick-stats (PIL, Aliquota).
//   - Primary actions ("Investi" + "Cambia aliquota") sit just under the
//     hero, with the existing sticky footer pinning the most common CTA.
//   - All secondary surfaces (sector composition bars, tax slider, invest
//     composer, income sparkline) live inside <Disclosure> blocks that
//     default to collapsed.

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EconomySectors } from '@aurion/engine';

import { cn } from '../../lib/cn';
import {
  selectPlayerCountry,
  useGameStore,
  type GameStoreState,
} from '../../lib/store';
import { ActionButton } from './shared/ActionButton';
import { Disclosure } from './shared/Disclosure';
import { EmptyState } from './shared/EmptyState';
import { PanelHero } from './shared/PanelHero';
import { StatBar } from './shared/StatBar';
import { StickyFooter } from './shared/StickyFooter';

const SECTOR_KEYS: readonly (keyof EconomySectors)[] = [
  'agriculture',
  'industry',
  'services',
  'tech',
];

const SECTOR_TONES: Record<keyof EconomySectors, 'positive' | 'warning' | 'info' | 'neutral'> = {
  agriculture: 'positive',
  industry: 'warning',
  services: 'info',
  tech: 'neutral',
};

export function EconomyPanel({
  onErrors,
}: {
  onErrors?: (errors: string[]) => void;
}) {
  const t = useTranslations('panelEconomy');
  const tShared = useTranslations('panelShared');
  const fmt = useFormatter();

  const player = useGameStore(selectPlayerCountry);
  const applyAction = useGameStore((s: GameStoreState) => s.applyAction);

  // Local pending rate scrubbed by the slider. We reset it via the React
  // "derived state" pattern — when the engine-committed taxRate changes, we
  // drop our pending value (no useEffect needed; this avoids cascading renders).
  const engineTaxRate = player?.economy.taxRate ?? 0;
  const [pendingRate, setPendingRate] = useState<number | null>(null);
  const [lastSeenEngineRate, setLastSeenEngineRate] = useState<number>(engineTaxRate);
  if (lastSeenEngineRate !== engineTaxRate) {
    setLastSeenEngineRate(engineTaxRate);
    if (pendingRate !== null) setPendingRate(null);
  }

  const [investAmount, setInvestAmount] = useState<string>('');

  // Debounce slider commits: only dispatch after the user has stopped
  // scrubbing for ~250ms. Keeps the engine from re-running per pixel.
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (pendingRate === null) return undefined;
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    const target = pendingRate;
    debounceRef.current = window.setTimeout(() => {
      void applyAction({ type: 'setTaxRate', rate: target }).then((errors) => {
        if (errors.length > 0) onErrors?.(errors);
      });
    }, 250);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [pendingRate, applyAction, onErrors]);

  // Naive linear projection: weeklyIncome scales ~ linearly with taxRate.
  // We extrapolate from the current ratio (income/taxRate) so the preview
  // matches whatever the engine currently models. This is an *informational*
  // estimate only — the engine remains source of truth.
  const liveRate = pendingRate ?? engineTaxRate;
  const projectedIncome = useMemo(() => {
    if (!player) return 0;
    const e = player.economy;
    if (e.taxRate <= 0) return e.weeklyIncome;
    const ratio = e.weeklyIncome / e.taxRate;
    return ratio * liveRate;
  }, [player, liveRate]);

  if (!player) {
    return (
      <div className="p-4">
        <EmptyState>{tShared('noPlayer')}</EmptyState>
      </div>
    );
  }

  const economy = player.economy;
  const ratePctLabel = fmt.number(liveRate / 100, { style: 'percent' });

  const treasury = economy.treasury;
  const investAmountNum = Number(investAmount);
  const investAmountInvalid =
    investAmount === '' ||
    !Number.isFinite(investAmountNum) ||
    investAmountNum <= 0;
  const investAmountTooHigh = investAmountNum > treasury;

  const investHelpText = investAmountInvalid
    ? null
    : investAmountTooHigh
      ? tShared('insufficientTreasury')
      : null;

  const handleInvest = (target: 'infra' | 'economy') => async () => {
    if (investAmountInvalid || investAmountTooHigh) return;
    const errors = await applyAction({
      type: 'invest',
      target,
      amount: investAmountNum,
    });
    if (errors.length > 0) {
      onErrors?.(errors);
    } else {
      setInvestAmount('');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Progressive-disclosure hero: BIG treasury value, weekly-income delta
          chip, quick-stats (PIL + aliquota). The 4 sector bars, tax slider
          and sparkline live below in a collapsed <Disclosure>. */}
      <PanelHero
        title={t('title')}
        value={fmt.number(treasury)}
        valueTone="success"
        delta={{
          value: economy.weeklyIncome,
          label: t('weeklyDelta', {
            value: fmt.number(economy.weeklyIncome, {
              maximumFractionDigits: 0,
            }),
          }),
        }}
        quickStats={[
          { label: t('gdp'), value: fmt.number(economy.gdp) },
          { label: t('taxRate'), value: `${Math.round(economy.taxRate)}%` },
        ]}
      />

      {/* Collapsed secondary content — sectors, fiscal policy, investments,
          income trend. Keeps the rail tidy on first open. */}
      <Disclosure summary={tShared('moreDetails')} trailing={t('details')}>
        {/* Sectors. We highlight the dominant share with `text-fg`; the
            smaller shares fade to `text-fg-muted` so the eye snaps to the
            economy's centre of gravity at a glance. */}
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {t('sectors.title')}
          </div>
          <ul className="flex flex-col gap-2">
            {(() => {
              const dominant = SECTOR_KEYS.reduce<keyof EconomySectors>(
                (best, k) =>
                  economy.sectors[k] > economy.sectors[best] ? k : best,
                SECTOR_KEYS[0]!,
              );
              return SECTOR_KEYS.map((s) => (
                <li key={s}>
                  <StatBar
                    label={
                      <span className={s === dominant ? 'text-fg' : 'text-fg-muted'}>
                        {t(`sectors.${s}`)}
                      </span>
                    }
                    value={economy.sectors[s] * 100}
                    max={100}
                    valueLabel={fmt.number(economy.sectors[s], { style: 'percent', maximumFractionDigits: 1 })}
                    tone={SECTOR_TONES[s]}
                    ariaLabel={t(`sectors.${s}`)}
                  />
                </li>
              ));
            })()}
          </ul>
        </div>

        {/* Fiscal policy — tax rate slider */}
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {t('tax.title')}
          </div>
          <div className="flex items-center justify-between text-xs text-fg">
            <label htmlFor="economy-tax-rate" className="font-medium">
              {t('tax.label')}
            </label>
            <span className="font-mono numeric-tabular text-fg">
              {ratePctLabel}
            </span>
          </div>
          <input
            id="economy-tax-rate"
            type="range"
            min={0}
            max={100}
            step={1}
            value={liveRate}
            onChange={(e) => setPendingRate(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <p className="text-[11px] text-fg-faint">
            {t('tax.preview', {
              income: fmt.number(projectedIncome, { maximumFractionDigits: 2 }),
            })}
          </p>
        </div>

        {/* Investments — amount input + 2 invest buttons. */}
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {t('invest.title')}
          </div>
          <label htmlFor="economy-invest-amount" className="text-xs text-fg">
            {t('invest.amountLabel')}
          </label>
          <input
            id="economy-invest-amount"
            inputMode="decimal"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            value={investAmount}
            onChange={(e) => setInvestAmount(e.target.value)}
            className={cn(
              'rounded-sm border bg-transparent px-2 py-1 font-mono numeric-tabular text-xs text-fg outline-none transition focus:border-accent focus-visible:border-accent',
              investAmountTooHigh ? 'border-danger' : 'border-border',
            )}
            aria-invalid={investAmountTooHigh || undefined}
            aria-describedby={investHelpText ? 'economy-invest-help' : undefined}
          />
          {investHelpText ? (
            <p
              id="economy-invest-help"
              className="text-[11px] text-danger"
              role="status"
            >
              {investHelpText}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              tone="primary"
              cost={investAmount ? fmt.number(investAmountNum) : null}
              disabledReason={
                investAmountInvalid
                  ? tShared('enterAmount')
                  : investAmountTooHigh
                    ? tShared('insufficientTreasury')
                    : null
              }
              onClick={handleInvest('infra')}
              onErrors={onErrors}
            >
              {t('invest.infra')}
            </ActionButton>
            <ActionButton
              tone="primary"
              cost={investAmount ? fmt.number(investAmountNum) : null}
              disabledReason={
                investAmountInvalid
                  ? tShared('enterAmount')
                  : investAmountTooHigh
                    ? tShared('insufficientTreasury')
                    : null
              }
              onClick={handleInvest('economy')}
              onErrors={onErrors}
            >
              {t('invest.economy')}
            </ActionButton>
          </div>
        </div>

        {/* Income trend (recent weekly income — derived from rolling history) */}
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {t('history.title')}
          </div>
          <IncomeSparkline weeklyIncome={economy.weeklyIncome} />
          <p className="text-[11px] text-fg-faint">{t('history.note')}</p>
        </div>
      </Disclosure>

      {/* Sticky primary action — duplicates the "Invest in economy" button
          above so it's always reachable without scrolling. Disabled until the
          player has entered a valid amount; the helper hint explains why. */}
      <StickyFooter
        hint={
          investAmountInvalid
            ? tShared('stickyAction.economyHint')
            : null
        }
      >
        <ActionButton
          tone="primary"
          cost={investAmount ? fmt.number(investAmountNum) : null}
          disabledReason={
            investAmountInvalid
              ? tShared('enterAmount')
              : investAmountTooHigh
                ? tShared('insufficientTreasury')
                : null
          }
          onClick={handleInvest('economy')}
          onErrors={onErrors}
        >
          {t('invest.economy')}
        </ActionButton>
      </StickyFooter>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Inline sparkline — keeps a small ring buffer in component state of recent
 * weeklyIncome samples observed while this panel is mounted. We can't access
 * historical engine snapshots without a dedicated selector, so this is a
 * "live" trace that grows as the player watches the panel.
 */
function IncomeSparkline({ weeklyIncome }: { weeklyIncome: number }) {
  const t = useTranslations('panelEconomy');
  const [history, setHistory] = useState<number[]>([weeklyIncome]);
  const lastSampleRef = useRef<number>(weeklyIncome);

  useEffect(() => {
    if (lastSampleRef.current === weeklyIncome) return;
    lastSampleRef.current = weeklyIncome;
    setHistory((prev) => {
      const next = [...prev, weeklyIncome];
      return next.length > 12 ? next.slice(next.length - 12) : next;
    });
  }, [weeklyIncome]);

  if (history.length < 2) {
    return (
      <p className="text-[11px] text-fg-faint">{t('history.empty')}</p>
    );
  }

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const w = 200;
  const h = 36;
  const stepX = w / Math.max(history.length - 1, 1);
  const points = history
    .map((v, i) => {
      const y = h - ((v - min) / range) * h;
      const x = i * stepX;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const trendingUp =
    history[history.length - 1]! >= history[0]!;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-9 w-full"
      role="img"
      aria-label={t('history.label')}
    >
      <polyline
        fill="none"
        stroke={trendingUp ? 'var(--color-success)' : 'var(--color-danger)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default EconomyPanel;

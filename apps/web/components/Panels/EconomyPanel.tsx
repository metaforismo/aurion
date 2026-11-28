'use client';

// Economy panel. Leads with the treasury and what it moves by each week,
// explains where that income comes from, then offers the two levers the
// engine has: the tax rate and investments.

import { AlertTriangle, ChevronRight, Rocket, TrendingDown, TrendingUp } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  COSMOS_PROJECTS,
  effectiveProjectCost,
  getProjectStatus,
  type EconomySectors,
  type InvestTarget,
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import { money, percent } from '../../lib/format';
import { selectActiveDifficulty, selectPlayerCountry, useGameStore } from '../../lib/store';
import { Card, Chip, Row, SectionTitle } from '../ui';

import { IncomeBreakdownCard } from './economy/IncomeBreakdownCard';
import { IncomeTrend } from './economy/IncomeTrend';
import { InvestCard } from './economy/InvestCard';
import { TaxCard } from './economy/TaxCard';
import { WorksSection } from './economy/WorksSection';
import { useIncomeHistory } from './economy/history';
import {
  SERVICES_SECTOR_BONUS,
  TECH_SECTOR_BONUS,
  gdpRank,
  incomeBreakdown,
  investPreview,
} from './economy/model';
import { signedMoney } from './economy/money';
import { useEngineAction } from './economy/useEngineAction';

/** Weeks the treasury may stay negative before the game is lost (checkWinLoss.ts). */
const LOSS_NEGATIVE_TREASURY_WEEKS = 26;

const SECTORS: readonly (keyof EconomySectors)[] = ['agriculture', 'industry', 'services', 'tech'];
// One hue, four steps: sectors are a composition, not a state.
const SECTOR_FILL: Record<keyof EconomySectors, string> = {
  agriculture: 'bg-white/25',
  industry: 'bg-white/45',
  services: 'bg-white/70',
  tech: 'bg-white',
};

export function EconomyPanel({ onErrors }: { onErrors?: (errors: string[]) => void }) {
  const t = useTranslations('panelEconomy');
  const tCosmos = useTranslations('cosmos');
  const locale = useLocale();
  const fmt = useFormatter();
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const player = useGameStore(selectPlayerCountry);
  const difficulty = useGameStore(selectActiveDifficulty);
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  const history = useIncomeHistory();
  const run = useEngineAction('panelEconomy', onErrors);

  const incomeMul = difficulty?.modifiers.playerIncome ?? 1;
  const lossTolerance = difficulty?.modifiers.lossToleranceWeeks ?? 1;

  const breakdown = useMemo(
    () => (state && player ? incomeBreakdown(player, state, incomeMul) : null),
    [state, player, incomeMul],
  );

  // Megaprojects are the big one-off expense: show what is being built and
  // the cheapest one the player could start next.
  const megaprojects = useMemo(() => {
    if (!state?.cosmos) return null;
    const techs = scenario?.techTree ?? [];
    const next = COSMOS_PROJECTS.filter((def) => getProjectStatus(state, def, techs).status === 'available')
      .map((def) => ({ def, price: effectiveProjectCost(state, def) }))
      .sort((a, b) => a.price - b.price)[0];
    return { building: state.cosmos.active.length, next };
  }, [state, scenario]);

  if (!state || !player || !breakdown) return null;

  const { treasury, gdp, taxRate, sectors } = player.economy;
  const rank = gdpRank(state);
  const net = breakdown.net;

  const redWeeks = state._loseStreaks?.negativeTreasuryWeeks ?? 0;
  const redLimit = Math.ceil(LOSS_NEGATIVE_TREASURY_WEEKS * lossTolerance);
  const runway = net < 0 && treasury > 0 ? Math.floor(treasury / -net) : null;

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="economy-panel">
      {/* ---- Treasury ---------------------------------------------------- */}
      <section
        aria-label={t('hero.treasury')}
        className="rounded-xl border border-accent/25 bg-gradient-to-br from-accent/[0.09] via-transparent to-transparent p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
            {t('hero.treasury')}
          </h3>
          <Chip tone={net < 0 ? 'danger' : 'success'} icon={net < 0 ? TrendingDown : TrendingUp}>
            <span className="numeric-tabular font-mono" data-testid="economy-net-income">
              {signedMoney(net, locale)}
            </span>{' '}
            {t('perWeek')}
          </Chip>
        </div>
        <p
          className={cn(
            'numeric-tabular mt-2 font-mono text-4xl font-semibold leading-none',
            treasury < 0 ? 'text-[#ff8a7d]' : 'text-fg',
          )}
          data-testid="economy-treasury"
        >
          {money(treasury, locale, 2)}
        </p>
        <div className="mt-3">
          <IncomeTrend samples={history} />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-fg-faint">{t('hero.gdp')}</dt>
            <dd className="numeric-tabular font-mono text-sm text-fg">{money(gdp, locale)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-fg-faint">{t('hero.rank')}</dt>
            <dd className={cn('numeric-tabular font-mono text-sm', rank.rank === 1 ? 'text-accent' : 'text-fg')}>
              {t('hero.rankValue', { rank: rank.rank, total: rank.total })}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-fg-faint">{t('hero.taxRate')}</dt>
            <dd className="numeric-tabular font-mono text-sm text-fg">{Math.round(taxRate)}%</dd>
          </div>
        </dl>
      </section>

      {treasury < 0 ? (
        <Card tone="danger" role="alert" className="flex gap-2.5">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#ff8a7d]" />
          <p className="text-xs leading-relaxed text-fg">
            {t('warning.inTheRed', { weeks: redWeeks, left: Math.max(0, redLimit - redWeeks), limit: redLimit })}
          </p>
        </Card>
      ) : runway !== null ? (
        <Card tone="warning" className="flex gap-2.5">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed text-fg">{t('warning.runway', { weeks: runway, limit: redLimit })}</p>
        </Card>
      ) : null}

      {/* ---- Where the money comes from ---------------------------------- */}
      <section aria-label={t('sources.title')} className="flex flex-col gap-2">
        <SectionTitle aside={t('perWeek')}>{t('sources.title')}</SectionTitle>
        <IncomeBreakdownCard
          breakdown={breakdown}
          taxRate={taxRate}
          onOpenDiplomacy={() => setSelectedPanel('diplomacy')}
        />
      </section>

      {/* ---- Tax rate ---------------------------------------------------- */}
      <section aria-label={t('tax.title')} className="flex flex-col gap-2">
        <SectionTitle>{t('tax.title')}</SectionTitle>
        <TaxCard
          rate={taxRate}
          currentNet={net}
          projectNet={(rate) => incomeBreakdown(player, state, incomeMul, { taxRate: rate }).net}
          onApply={(rate) => run({ type: 'setTaxRate', rate })}
        />
      </section>

      {/* ---- Investments ------------------------------------------------- */}
      <section aria-label={t('invest.title')} className="flex flex-col gap-2">
        <SectionTitle>{t('invest.title')}</SectionTitle>
        <p className="-mt-1 text-[11px] leading-snug text-fg-faint">{t('invest.intro')}</p>
        <InvestCard
          player={player}
          preview={(target: InvestTarget, amount: number) => investPreview(player, state, incomeMul, target, amount)}
          onInvest={(target, amount) => run({ type: 'invest', target, amount }, 'sfx.coin')}
        />
      </section>

      {/* ---- National works -------------------------------------------- */}
      <WorksSection run={run} />

      {/* ---- Sector mix -------------------------------------------------- */}
      <section aria-label={t('sectors.title')} className="flex flex-col gap-2">
        <SectionTitle>{t('sectors.title')}</SectionTitle>
        <Card>
          <div className="flex h-2 gap-px overflow-hidden rounded-full" aria-hidden>
            {SECTORS.map((id) => (
              <div key={id} className={SECTOR_FILL[id]} style={{ width: `${sectors[id] * 100}%` }} />
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            {SECTORS.map((id) => (
              <div key={id} className="flex items-center gap-2">
                <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', SECTOR_FILL[id])} />
                <dt className="min-w-0 flex-1 truncate text-[12px] text-fg-muted">{t(`sectors.${id}`)}</dt>
                <dd className="numeric-tabular font-mono text-[12px] text-fg">{percent(sectors[id], locale)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-snug text-fg-faint">
            {t('sectors.note', {
              services: fmt.number(SERVICES_SECTOR_BONUS * 10, { maximumFractionDigits: 1 }),
              tech: fmt.number(TECH_SECTOR_BONUS * 10, { maximumFractionDigits: 1 }),
            })}
          </p>
        </Card>
      </section>

      {/* ---- Megaprojects ------------------------------------------------ */}
      {megaprojects ? (
        <section aria-label={t('mega.title')} className="flex flex-col gap-2">
          <SectionTitle>{t('mega.title')}</SectionTitle>
          <Row
            testId="economy-open-cosmos"
            onClick={() => setSelectedPanel('cosmos')}
            leading={<Rocket aria-hidden className="h-4 w-4 text-[#8ad8ff]" />}
            title={t('mega.building', { n: megaprojects.building })}
            subtitle={
              // Project names are long: let this line wrap instead of cutting the price off.
              <span className="whitespace-normal">
                {megaprojects.next
                  ? t('mega.next', {
                      name: tCosmos(`projects.${megaprojects.next.def.id}.name`),
                      // Keep "€" and the figure on one line.
                      price: money(megaprojects.next.price, locale).replace(' ', '\u00a0'),
                    })
                  : t('mega.none')}
              </span>
            }
            trailing={<ChevronRight aria-hidden className="h-4 w-4 text-fg-faint" />}
          />
        </section>
      ) : null}
    </div>
  );
}

export default EconomyPanel;

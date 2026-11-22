'use client';

// Internal politics panel. Leads with popularity — the number that ends the
// game when it collapses — and where it is heading, then the government,
// the national policies, and the five factions whose mood drives it all.

import { AlertTriangle, Landmark, Newspaper, TrendingDown, TrendingUp } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { EventTag, FactionId } from '@aurion/engine';

import { cn } from '../../lib/cn';
import { money } from '../../lib/format';
import type { ScenarioId } from '../../lib/scenarios';
import { selectActiveDifficulty, selectPlayerCountry, useGameStore } from '../../lib/store';
import { Card, Chip, EmptyState, SectionTitle, type Tone } from '../ui';

import { PoliciesSection } from './PoliciesSection';
import { useEngineAction } from './economy/useEngineAction';
import { FactionCard } from './politics/FactionCard';
import {
  FACTIONS,
  GOVERNMENT_BONUS,
  HOSTILE_THRESHOLD,
  LOSS_ALL_FACTIONS_HOSTILE_WEEKS,
  LOSS_LOW_POPULARITY_WEEKS,
  LOW_POPULARITY_THRESHOLD,
  PLACATE_BOOST,
  PLACATE_COST,
  factionDrift,
  factionMood,
  influenceShare,
  lossLimit,
  mostUrgentFaction,
  policiesFor,
  popularityOutlook,
} from './politics/model';
import { useScenarioMessages } from './shared/useScenarioMessages';

/** Events with one of these tags are listed as political news. */
const POLITICAL_TAGS: ReadonlySet<EventTag> = new Set<EventTag>(['politics', 'faction', 'social']);
const NEWS_LIMIT = 8;
/** Below this the panel starts warning, well before the real threshold. */
const UNEASY_POPULARITY = 25;

export function PoliticsPanel({ onErrors }: { onErrors?: (errors: string[]) => void }) {
  const t = useTranslations('panelPolitics');
  const locale = useLocale();
  const fmt = useFormatter();
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const player = useGameStore(selectPlayerCountry);
  const difficulty = useGameStore(selectActiveDifficulty);
  const { t: tScenario } = useScenarioMessages((scenario?.id as ScenarioId | undefined) ?? null);
  const run = useEngineAction('panelPolitics', onErrors);
  const [busy, setBusy] = useState<FactionId | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const news = useMemo(() => {
    if (!state || !scenario) return [];
    const byId = new Map(scenario.eventPool.map((def) => [def.id, def]));
    return state.events
      .map((event) => ({ event, def: byId.get(event.definitionId) }))
      .filter(({ def }) => def?.tags?.some((tag) => POLITICAL_TAGS.has(tag)))
      .slice(-NEWS_LIMIT)
      .reverse();
  }, [state, scenario]);

  if (!state || !player) return null;

  const { popularity, factions, governmentType } = player.politics;
  const treasury = player.economy.treasury;
  const tolerance = difficulty?.modifiers.lossToleranceWeeks ?? 1;
  const mood = factionMood(player);
  const outlook = popularityOutlook(player, state, mood);
  const hostile = FACTIONS.filter((id) => factions[id].satisfaction < HOSTILE_THRESHOLD).length;
  const urgent = mostUrgentFaction(player);
  const canAfford = treasury >= PLACATE_COST;

  const popLimit = lossLimit(LOSS_LOW_POPULARITY_WEEKS, tolerance);
  const popWeeks = state._loseStreaks?.lowPopularityWeeks ?? 0;
  const hostileLimit = lossLimit(LOSS_ALL_FACTIONS_HOSTILE_WEEKS, tolerance);
  const hostileWeeks = state._loseStreaks?.allFactionsAngryWeeks ?? 0;
  const inCrisis = popularity < LOW_POPULARITY_THRESHOLD;
  const allHostile = hostile === FACTIONS.length;

  const standing: { tone: Tone; key: 'crisis' | 'uneasy' | 'steady' | 'strong' } = inCrisis
    ? { tone: 'danger', key: 'crisis' }
    : popularity < UNEASY_POPULARITY
      ? { tone: 'warning', key: 'uneasy' }
      : popularity < 60
        ? { tone: 'neutral', key: 'steady' }
        : { tone: 'success', key: 'strong' };

  const pct = (n: number) => `${Math.round(n)}%`;
  const weekly = fmt.number(outlook.weekly, { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
  const rising = outlook.weekly >= 0.05;
  const falling = outlook.weekly <= -0.05;

  const placate = async (id: FactionId) => {
    const before = factions[id].satisfaction;
    setBusy(id);
    const ok = await run({ type: 'placateFaction', factionId: id }, 'sfx.coin');
    setBusy(null);
    if (ok) {
      setAnnouncement(
        t('placate.done', { name: t(`faction.${id}.name`), value: pct(Math.min(100, before + PLACATE_BOOST)) }),
      );
    }
  };

  const governmentNudges = Object.entries(GOVERNMENT_BONUS[governmentType]) as [FactionId, number][];

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="politics-panel">
      {/* ---- Popularity -------------------------------------------------- */}
      <section
        aria-label={t('hero.popularity')}
        className={cn(
          'rounded-xl border bg-gradient-to-br via-transparent to-transparent p-4',
          inCrisis ? 'border-[#ff5d4d]/40 from-[#ff5d4d]/[0.12]' : 'border-accent/25 from-accent/[0.09]',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
            {t('hero.popularity')}
          </h3>
          <Chip tone={standing.tone}>{t(`standing.${standing.key}`)}</Chip>
        </div>
        <div className="mt-2 flex items-end gap-3">
          <span
            className={cn(
              'numeric-tabular font-mono text-4xl font-semibold leading-none',
              inCrisis ? 'text-[#ff8a7d]' : standing.tone === 'warning' ? 'text-warning' : 'text-fg',
            )}
            data-testid="politics-popularity"
          >
            {pct(popularity)}
          </span>
          <span
            className={cn(
              'flex items-center gap-1 pb-1 font-mono text-[11px]',
              rising ? 'text-success' : falling ? 'text-[#ff8a7d]' : 'text-fg-faint',
            )}
          >
            {rising ? <TrendingUp aria-hidden className="h-3.5 w-3.5" /> : null}
            {falling ? <TrendingDown aria-hidden className="h-3.5 w-3.5" /> : null}
            {t('hero.weekly', { points: weekly })}
          </span>
        </div>

        {/* Gauge: the red stretch is the zone that topples the government. */}
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(popularity)}
          aria-label={t('hero.popularity')}
          className="relative mt-3 h-2 rounded-full bg-white/10"
        >
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-l-full bg-[#ff5d4d]/35"
            style={{ width: `${LOW_POPULARITY_THRESHOLD}%` }}
          />
          <div
            aria-hidden
            className={cn(
              'absolute inset-y-0 left-0 rounded-full transition-[width] duration-500',
              inCrisis ? 'bg-[#ff5d4d]' : standing.tone === 'warning' ? 'bg-warning' : 'bg-accent',
            )}
            style={{ width: `${Math.max(1.5, popularity)}%` }}
          />
          <div
            aria-hidden
            className="absolute -inset-y-1 w-0.5 rounded-full bg-fg/80"
            style={{ left: `${Math.max(0, Math.min(100, outlook.settlesAt))}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-fg-faint" aria-hidden>
          <span className="text-[#ff8a7d]">{t('hero.crisisMark', { pct: LOW_POPULARITY_THRESHOLD })}</span>
          <span>100%</span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-fg-muted">
          {t('hero.settles', { pct: pct(outlook.settlesAt) })}
        </p>

        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-fg-faint">{t('hero.government')}</dt>
            <dd className="truncate text-sm text-fg">{t(`government.${governmentType}.name`)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-fg-faint">{t('hero.mood')}</dt>
            <dd className="numeric-tabular font-mono text-sm text-fg">{pct(mood)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-fg-faint">{t('hero.hostile')}</dt>
            <dd
              className={cn('numeric-tabular font-mono text-sm', hostile > 0 ? 'text-[#ff8a7d]' : 'text-fg')}
              data-testid="politics-hostile"
            >
              {hostile}/{FACTIONS.length}
            </dd>
          </div>
        </dl>
      </section>

      {/* ---- How this ends the game -------------------------------------- */}
      <Card
        tone={inCrisis || allHostile ? 'danger' : popularity < UNEASY_POPULARITY || hostile >= 3 ? 'warning' : 'neutral'}
        role={inCrisis || allHostile ? 'alert' : undefined}
        data-testid="politics-danger"
      >
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
          {t('danger.title')}
        </p>
        <ul className="mt-2 flex flex-col gap-2 text-[12px] leading-snug">
          <li className={inCrisis ? 'text-fg' : 'text-fg-muted'}>
            {inCrisis
              ? t('danger.popularityActive', {
                  pct: LOW_POPULARITY_THRESHOLD,
                  weeks: popWeeks,
                  left: Math.max(0, popLimit - popWeeks),
                })
              : t('danger.popularity', { pct: LOW_POPULARITY_THRESHOLD, weeks: popLimit })}
          </li>
          <li className={allHostile ? 'text-fg' : 'text-fg-muted'}>
            {allHostile
              ? t('danger.factionsActive', {
                  pct: HOSTILE_THRESHOLD,
                  weeks: hostileWeeks,
                  left: Math.max(0, hostileLimit - hostileWeeks),
                })
              : t('danger.factions', { pct: HOSTILE_THRESHOLD, weeks: hostileLimit, hostile })}
          </li>
        </ul>
      </Card>

      {/* ---- Government -------------------------------------------------- */}
      <section aria-label={t('government.title')} className="flex flex-col gap-2">
        <SectionTitle>{t('government.title')}</SectionTitle>
        <Card className="flex gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-fg-muted">
            <Landmark aria-hidden className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-fg">{t(`government.${governmentType}.name`)}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{t(`government.${governmentType}.desc`)}</p>
            <ul className="mt-2 flex flex-wrap gap-1">
              {governmentNudges.map(([id, delta]) => (
                <li key={id}>
                  <Chip tone={delta > 0 ? 'success' : 'danger'}>
                    {t(`faction.${id}.name`)}{' '}
                    {fmt.number(delta, { maximumFractionDigits: 2, signDisplay: 'always' })}
                  </Chip>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[10px] text-fg-faint">{t('government.nudgeNote')}</p>
          </div>
        </Card>
      </section>

      {/* ---- National policies ------------------------------------------- */}
      <PoliciesSection onErrors={onErrors} />

      {/* ---- Factions ---------------------------------------------------- */}
      <section aria-label={t('factions.title')} className="flex flex-col gap-2">
        <SectionTitle aside={t('factions.count', { n: FACTIONS.length })}>{t('factions.title')}</SectionTitle>
        <p className="-mt-1 text-[11px] leading-snug text-fg-faint">
          {t('factions.intro', { cost: money(PLACATE_COST, locale), points: PLACATE_BOOST })}
        </p>
        {canAfford ? null : (
          <p className="text-[11px] leading-snug text-warning" data-testid="politics-cannot-afford">
            {t('placate.blocked', { cost: money(PLACATE_COST, locale), treasury: money(treasury, locale) })}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {FACTIONS.map((id) => (
            <FactionCard
              key={id}
              id={id}
              satisfaction={factions[id].satisfaction}
              share={influenceShare(player, id)}
              drift={factionDrift(player, state, id)}
              government={governmentType}
              policies={state.policies ? policiesFor(id) : null}
              urgent={id === urgent}
              canAfford={canAfford}
              busy={busy === id}
              onPlacate={() => void placate(id)}
            />
          ))}
        </ul>
        <p role="status" aria-live="polite" className={announcement ? 'text-[11px] text-success' : 'sr-only'}>
          {announcement}
        </p>
      </section>

      {/* ---- Political news ---------------------------------------------- */}
      <section aria-label={t('news.title')} className="flex flex-col gap-2">
        <SectionTitle aside={news.length > 0 ? String(news.length) : undefined}>{t('news.title')}</SectionTitle>
        {news.length === 0 ? (
          <EmptyState icon={Newspaper}>{t('news.empty')}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {news.map(({ event, def }, i) => (
              <li
                key={`${event.definitionId}-${event.firedAtTick}-${i}`}
                className="flex items-baseline justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2"
              >
                <span className="min-w-0 truncate text-[13px] text-fg">{tScenario(def?.nameKey)}</span>
                <span className="numeric-tabular shrink-0 font-mono text-[11px] text-fg-faint">
                  {t('news.week', { week: event.firedAtTick })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default PoliticsPanel;

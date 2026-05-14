// Politics system panel.
// - Big popularity dial
// - 5 faction rows with satisfaction + influence + "placate" action
// - Government type display
// - Recent political events list (events tagged as politics-related)

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { FactionId, GameEvent, GovernmentType } from '@aurion/engine';

import { cn } from '../../lib/cn';
import {
  selectPlayerCountry,
  useGameStore,
  type GameStoreState,
} from '../../lib/store';
import { ScenarioId } from '../../lib/scenarios';
import { ActionButton } from './shared/ActionButton';
import { EmptyState } from './shared/EmptyState';
import { Section } from './shared/Section';
import { StatBar } from './shared/StatBar';
import { useScenarioMessages } from './shared/useScenarioMessages';

const FACTION_IDS: readonly FactionId[] = [
  'army',
  'business',
  'religious',
  'populist',
  'reformist',
];

// Mirror engine's PLACATE_COST so we can show the cost in the UI without
// importing engine internals (only constants — pure data).
const PLACATE_COST = 100_000_000;

const GOVERNMENT_LABEL: Record<GovernmentType, string> = {
  democracy: 'panelPolitics.government.democracy',
  autocracy: 'panelPolitics.government.autocracy',
  oligarchy: 'panelPolitics.government.oligarchy',
  theocracy: 'panelPolitics.government.theocracy',
  monarchy: 'panelPolitics.government.monarchy',
};

export function PoliticsPanel({
  onErrors,
}: {
  onErrors?: (errors: string[]) => void;
}) {
  const t = useTranslations('panelPolitics');
  const tShared = useTranslations('panelShared');
  const tRoot = useTranslations();
  const fmt = useFormatter();

  const player = useGameStore(selectPlayerCountry);
  const state = useGameStore((s: GameStoreState) => s.state);
  const scenario = useGameStore((s: GameStoreState) => s.scenario);
  const applyAction = useGameStore((s: GameStoreState) => s.applyAction);

  const scenarioId = (scenario?.id ?? null) as ScenarioId | null;
  const { t: tScenario } = useScenarioMessages(scenarioId);

  // Politics-related events: best-effort by definitionId substring match
  // ("faction", "popularity", "election", "coup", "scandal"). Engines that
  // tag events explicitly later can refine this filter.
  const politicalEvents = useMemo<GameEvent[]>(() => {
    if (!state) return [];
    const POLITICS_HINT = /(faction|popular|elect|coup|scandal|protest|riot|polit|rally)/i;
    return state.events
      .filter((ev) => POLITICS_HINT.test(ev.definitionId))
      .slice(-8)
      .reverse();
  }, [state]);

  if (!player || !state) {
    return (
      <div className="p-4">
        <EmptyState>{tShared('noPlayer')}</EmptyState>
      </div>
    );
  }

  const politics = player.politics;
  const treasury = player.economy.treasury;

  const handlePlacate = (factionId: FactionId) => async () => {
    const errors = await applyAction({ type: 'placateFaction', factionId });
    return errors;
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Popularity dial */}
      <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <PopularityDial value={politics.popularity} />
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            {t('popularity')}
          </div>
          <div className="font-mono text-2xl text-amber-300 tabular-nums">
            {Math.round(politics.popularity)}%
          </div>
        </div>
      </div>

      {/* Government type */}
      <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {t('governmentType')}
        </span>
        <span className="font-mono text-xs text-slate-200">
          {tRoot(GOVERNMENT_LABEL[politics.governmentType])}
        </span>
      </div>

      {/* Factions */}
      <Section title={t('factions.title')}>
        <ul className="flex flex-col gap-3">
          {FACTION_IDS.map((fid) => {
            const f = politics.factions[fid];
            const cantAfford = treasury < PLACATE_COST;
            return (
              <li
                key={fid}
                className="flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-900/30 p-2"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-slate-200">
                    {t(`faction.${fid}`)}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {t('factions.influence', { n: Math.round(f.influence) })}
                  </span>
                </div>
                <StatBar
                  label={t('factions.satisfaction')}
                  value={f.satisfaction}
                  valueLabel={`${Math.round(f.satisfaction)}%`}
                  tone={
                    f.satisfaction >= 60
                      ? 'positive'
                      : f.satisfaction >= 30
                        ? 'warning'
                        : 'danger'
                  }
                />
                <ActionButton
                  tone="primary"
                  cost={fmt.number(PLACATE_COST)}
                  disabledReason={
                    cantAfford ? tShared('insufficientTreasury') : null
                  }
                  onClick={handlePlacate(fid)}
                  onErrors={onErrors}
                >
                  {t('factions.placate')}
                </ActionButton>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Recent political events */}
      <Section
        title={t('events.title')}
        trailing={`${politicalEvents.length}`}
      >
        {politicalEvents.length === 0 ? (
          <EmptyState>{t('events.empty')}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-1 text-xs">
            {politicalEvents.map((ev, i) => (
              <li
                key={`${ev.definitionId}-${ev.firedAtTick}-${i}`}
                className="flex items-baseline justify-between gap-2 rounded border border-slate-800 px-2 py-1"
              >
                <span className="truncate text-slate-200">
                  {tScenario(`event.${ev.definitionId}.name`) || ev.definitionId}
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  {t('events.atTick', { tick: ev.firedAtTick })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/** Simple SVG semicircle "dial" gauge for popularity. */
function PopularityDial({ value }: { value: number }) {
  const t = useTranslations('panelPolitics');
  const clamped = Math.max(0, Math.min(100, value));
  const angle = (clamped / 100) * Math.PI; // 0..π
  const r = 50;
  const cx = 60;
  const cy = 60;
  // arc from (cx-r, cy) to (cx + r*cos(π-angle), cy - r*sin(π-angle)) but we
  // want angle starting from left side going clockwise. Simpler: compute end
  // point with angle from -π (left) to 0 (right).
  const endX = cx + r * Math.cos(Math.PI - angle);
  const endY = cy - r * Math.sin(Math.PI - angle);
  const largeArc = angle > Math.PI / 2 ? 1 : 0;
  const stroke =
    clamped >= 60 ? '#34d399' : clamped >= 30 ? '#fbbf24' : '#f87171';

  return (
    <svg
      viewBox="0 0 120 70"
      className="h-20 w-32"
      role="img"
      aria-label={t('popularity')}
    >
      {/* background arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#1e293b"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {clamped > 0 ? (
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

// Unused export guard — keeps cn in the import set when the dial becomes
// configurable. (Avoids a lint warning during incremental development.)
void cn;

export default PoliticsPanel;

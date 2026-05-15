// Politics system panel.
// - Big popularity dial
// - 5 faction rows with satisfaction + influence + "placate" action
// - Government type display
// - Recent political events list (filtered by EventTag taxonomy)

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type {
  EventDefinition,
  EventTag,
  FactionId,
  GameEvent,
  GovernmentType,
} from '@aurion/engine';

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

/**
 * Tags this panel cares about. Any event whose definition carries at least
 * one of these tags shows up in the "Recent political events" list. Update
 * this set rather than reach into event ids.
 */
const POLITICS_TAGS: ReadonlySet<EventTag> = new Set<EventTag>([
  'politics',
  'faction',
  'social',
]);

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

  // Build a lookup of definitionId -> tags from the scenario's eventPool so
  // we can filter the recent-events log by the EventTag taxonomy. Falls back
  // to an empty tag list when an event id is missing from the pool (defensive
  // — keeps the panel usable mid-hot-reload).
  const tagsByDefinitionId = useMemo<Map<string, readonly EventTag[]>>(() => {
    const map = new Map<string, readonly EventTag[]>();
    if (!scenario) return map;
    for (const def of scenario.eventPool as readonly EventDefinition[]) {
      map.set(def.id, def.tags ?? []);
    }
    return map;
  }, [scenario]);

  // Politics-related events: keep any whose definition carries a tag in
  // POLITICS_TAGS. Cap to the most recent 8 for readability.
  const politicalEvents = useMemo<GameEvent[]>(() => {
    if (!state) return [];
    return state.events
      .filter((ev) => {
        const tags = tagsByDefinitionId.get(ev.definitionId) ?? [];
        return tags.some((tag) => POLITICS_TAGS.has(tag));
      })
      .slice(-8)
      .reverse();
  }, [state, tagsByDefinitionId]);

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

  // Pick a semantic tone for the popularity readout itself. The dial uses the
  // accent token unconditionally so the gauge stays visually anchored.
  const popularityTone =
    politics.popularity >= 60
      ? 'text-success'
      : politics.popularity >= 30
        ? 'text-warning'
        : 'text-danger';

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Popularity dial */}
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface/40 p-4">
        <PopularityDial value={politics.popularity} />
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-fg-faint">
            {t('popularity')}
          </div>
          <div
            className={cn(
              'numeric-tabular font-mono text-2xl',
              popularityTone,
            )}
          >
            {Math.round(politics.popularity)}%
          </div>
        </div>
      </div>

      {/* Government type */}
      <div className="flex items-center justify-between rounded-md border border-border bg-surface/40 px-3 py-2">
        <span className="text-[10px] uppercase tracking-wider text-fg-faint">
          {t('governmentType')}
        </span>
        <span className="font-mono text-xs text-fg">
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
                className="flex flex-col gap-2 rounded-md border border-border bg-surface/30 p-2"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-fg">
                    {t(`faction.${fid}`)}
                  </span>
                  <span className="numeric-tabular font-mono text-[11px] text-fg-faint">
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
                className="flex items-baseline justify-between gap-2 rounded border border-border px-2 py-1"
              >
                <span className="truncate text-fg">
                  {tScenario(`event.${ev.definitionId}.name`) || ev.definitionId}
                </span>
                <span className="numeric-tabular font-mono text-[10px] text-fg-faint">
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

/**
 * Simple SVG semicircle "dial" gauge for popularity. The active arc uses the
 * brand accent token so the gauge harmonises with the rest of the HUD; the
 * track uses the standard border token. Colour intent (good / bad) lives on
 * the numeric readout above, not on the dial itself.
 */
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
        stroke="var(--color-border)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {clamped > 0 ? (
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

export default PoliticsPanel;

// Space Race sub-panel rendered inside the ResearchPanel as a tab.
//
// Reads `state.spaceMilestones` (populated by the engine when scenario techs
// declare `prestigeFirst` / `prestigeFollow`) and renders a leaderboard:
//   - per milestone: name, status (first achiever / follower / in progress /
//     locked), the chronological list of achievers with the tick they hit it
//     and the prestige reward.
//
// When the active scenario does not track milestones (e.g. Quick Start) the
// panel surfaces an empty state instead of failing.

'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type {
  CountryId,
  SpaceMilestoneEntry,
  TechDefinition,
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import { ScenarioId } from '../../lib/scenarios';
import {
  selectPlayerCountry,
  useGameStore,
  type GameStoreState,
} from '../../lib/store';
import { toneChip } from '../../lib/theme';

import { EmptyState } from './shared/EmptyState';
import { Section } from './shared/Section';
import { useScenarioMessages } from './shared/useScenarioMessages';

type MilestoneStatus = 'first' | 'follower' | 'inProgress' | 'locked';

// Editorial pass: status conveyed by a thin left rule + the status chip, not
// a tinted fill. The label text borrows the matching token so the chip stays
// readable on its own.
const STATUS_TONE: Record<MilestoneStatus, string> = {
  first: 'border-l-2 border-success',
  follower: 'border-l-2 border-info',
  inProgress: 'border-l-2 border-accent',
  locked: 'border-l-2 border-border opacity-60',
};

const STATUS_TEXT: Record<MilestoneStatus, string> = {
  first: 'text-success',
  follower: 'text-info',
  inProgress: 'text-accent',
  locked: 'text-fg-faint',
};

const STATUS_GLYPH: Record<MilestoneStatus, string> = {
  first: '\u{2705}', // ✅
  follower: '\u{1F948}', // 🥈
  inProgress: '\u{1F680}', // 🚀
  locked: '\u{1F512}', // 🔒
};

export function SpaceRacePanel() {
  const t = useTranslations('panelSpaceRace');
  const tShared = useTranslations('panelShared');

  const player = useGameStore(selectPlayerCountry);
  const scenario = useGameStore((s: GameStoreState) => s.scenario);
  const state = useGameStore((s: GameStoreState) => s.state);

  const scenarioId = (scenario?.id ?? null) as ScenarioId | null;
  const { t: tScenario } = useScenarioMessages(scenarioId);

  // Resolve the set of milestone tech definitions from the scenario tech tree.
  // A "milestone" is any tech that declares prestigeFirst / prestigeFollow.
  const milestoneTechs = useMemo<TechDefinition[]>(() => {
    if (!scenario) return [];
    return scenario.techTree.filter(
      (tech) =>
        typeof tech.prestigeFirst === 'number' ||
        typeof tech.prestigeFollow === 'number',
    );
  }, [scenario]);

  if (!player || !scenario) {
    return (
      <div className="p-4">
        <EmptyState>{tShared('noPlayer')}</EmptyState>
      </div>
    );
  }

  // The engine only initialises `spaceMilestones` for scenarios that declare
  // milestone techs. When undefined (or empty) we surface the documented
  // empty state — players still see the tech tree tab next door.
  if (!state?.spaceMilestones || milestoneTechs.length === 0) {
    return (
      <div className="p-4">
        <EmptyState>{t('noMilestones')}</EmptyState>
      </div>
    );
  }

  const playerId = player.id;
  const milestoneState = state.spaceMilestones;
  const activeTechId = player.science.activeResearch;
  const completed = new Set(player.science.completedTechs);

  return (
    <div className="flex flex-col gap-4 p-4">
      <Section title={t('title')} trailing={`${milestoneTechs.length}`}>
        <ul className="flex flex-col divide-y divide-border">
          {milestoneTechs.map((tech) => {
            const entry: SpaceMilestoneEntry | undefined =
              milestoneState[tech.id];
            const status = computeStatus({
              entry,
              playerId,
              isCompletedByPlayer: completed.has(tech.id),
              isPlayerActive: activeTechId === tech.id,
            });
            return (
              <li key={tech.id}>
                <MilestoneCard
                  tech={tech}
                  entry={entry}
                  status={status}
                  techName={tScenario(tech.nameKey)}
                  techDescription={tScenario(tech.descriptionKey)}
                  countriesLookup={state.countries}
                  scenarioGetter={tScenario}
                />
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status resolution
// ---------------------------------------------------------------------------

function computeStatus({
  entry,
  playerId,
  isCompletedByPlayer,
  isPlayerActive,
}: {
  entry: SpaceMilestoneEntry | undefined;
  playerId: CountryId;
  isCompletedByPlayer: boolean;
  isPlayerActive: boolean;
}): MilestoneStatus {
  if (entry?.firstAchieverCountryId === playerId) return 'first';
  if (isCompletedByPlayer) return 'follower';
  if (isPlayerActive) return 'inProgress';
  return 'locked';
}

// ---------------------------------------------------------------------------
// Milestone card
// ---------------------------------------------------------------------------

function MilestoneCard({
  tech,
  entry,
  status,
  techName,
  techDescription,
  countriesLookup,
  scenarioGetter,
}: {
  tech: TechDefinition;
  entry: SpaceMilestoneEntry | undefined;
  status: MilestoneStatus;
  techName: string;
  techDescription: string;
  countriesLookup: Record<string, { id: CountryId; nameKey: string }>;
  scenarioGetter: (key: string | undefined | null) => string;
}) {
  const t = useTranslations('panelSpaceRace');
  const glyph = STATUS_GLYPH[status];
  const tone = STATUS_TONE[status];
  const statusText = STATUS_TEXT[status];

  const firstAchieverId = entry?.firstAchieverCountryId ?? null;
  const firstAchievedAtTick = entry?.firstAchievedAtTick ?? null;
  const achievers = entry?.achievers ?? [];
  // Followers are everyone after the first achiever, in chronological order.
  const followers = firstAchieverId
    ? achievers.filter((id) => id !== firstAchieverId)
    : achievers;

  const resolveCountryName = (id: CountryId) => {
    const country = countriesLookup[id];
    if (!country) return id;
    return scenarioGetter(country.nameKey) || id;
  };

  return (
    <article className={cn('flex flex-col gap-2 py-3 pl-3', tone)}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h4 className="text-sm font-semibold leading-tight text-fg">{techName}</h4>
          {techDescription ? (
            <p className="text-[11px] leading-snug text-fg-muted">
              {techDescription}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            'shrink-0 font-mono text-[10px] uppercase tracking-[0.14em]',
            statusText,
          )}
          aria-label={t(`status.${status}`)}
        >
          <span aria-hidden="true" className="mr-1">
            {glyph}
          </span>
          {t(`status.${status}`)}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {typeof tech.prestigeFirst === 'number' ? (
          <span className={cn('rounded-sm px-2 py-0.5 text-[10px]', toneChip('success'))}>
            {t('prestigeFirst', { value: tech.prestigeFirst })}
          </span>
        ) : null}
        {typeof tech.prestigeFollow === 'number' ? (
          <span className={cn('rounded-sm px-2 py-0.5 text-[10px]', toneChip('info'))}>
            {t('prestigeFollow', { value: tech.prestigeFollow })}
          </span>
        ) : null}
      </div>

      {firstAchieverId ? (
        <p className="text-[11px] text-fg">
          {t('achievedAt', {
            country: resolveCountryName(firstAchieverId),
            tick: firstAchievedAtTick ?? 0,
          })}
        </p>
      ) : (
        <p className="text-[11px] italic text-fg-faint">{t('notYetAchieved')}</p>
      )}

      {followers.length > 0 ? (
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {t('achievers', { count: followers.length })}
          </span>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-fg-muted">
            {followers.map((id, idx) => (
              <li key={`${id}-${idx}`} title={id}>
                {resolveCountryName(id)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

export default SpaceRacePanel;

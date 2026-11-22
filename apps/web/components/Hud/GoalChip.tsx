'use client';

// "What am I trying to do?" — a compact, always-visible readout of the
// active mode's goal and how close the player is. Space Race gets a
// head-to-head bar against the leading rival, since that is the whole game.

import { Crown, Flag, Rocket, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DETHRONE_CLIMB_WEEKS,
  DETHRONE_HOLD_TO_WIN_WEEKS,
  DETHRONE_OUT_OF_TOP3_WEEKS,
  spaceRaceLeader,
  spaceRaceProgress,
  type GameState,
  type Scenario,
  type VictoryRule,
} from '@aurion/engine';

import type { ScenarioId } from '../../lib/scenarios';
import { useGameStore, type PanelId } from '../../lib/store';
import { useScenarioMessages } from '../Panels/shared/useScenarioMessages';

function gdpRank(state: GameState): number {
  const sorted = Object.values(state.countries).sort((a, b) => b.economy.gdp - a.economy.gdp);
  return sorted.findIndex((c) => c.id === state.playerCountryId) + 1;
}

function allyCount(state: GameState): number {
  const me = state.playerCountryId;
  return Object.values(state.relations).filter(
    (r) => (r.countryA === me || r.countryB === me) && r.treaties.includes('alliance'),
  ).length;
}

type Goal = { text: string; progress?: number; panel: PanelId };

export function GoalChip() {
  const t = useTranslations('hud.goal');
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  const { t: tScenario } = useScenarioMessages((scenario?.id as ScenarioId | undefined) ?? null);
  if (!state || !scenario) return null;

  const mode = state.gameMode ?? 'classic';
  // Odyssey and Chronicles have their own HUD widgets.
  if (mode === 'eternal' || mode === 'era-paced') return null;

  if (mode === 'space-race') {
    const cosmos = state.cosmos;
    if (!cosmos) return null;
    const mine = spaceRaceProgress(cosmos.completed);
    const leader = spaceRaceLeader(cosmos);
    const leaderCountry = leader ? state.countries[leader.countryId] : undefined;
    const rivalName = leaderCountry ? tScenario(leaderCountry.nameKey) : t('race.noRival');
    const behind = leader !== null && leader.progress > mine;
    return (
      <button
        type="button"
        data-testid="hud-goal"
        onClick={() => setSelectedPanel('cosmos')}
        title={t('race.hint')}
        aria-label={`${t('race.title')}: ${t('race.you')} ${Math.round(mine * 100)}%, ${rivalName} ${Math.round((leader?.progress ?? 0) * 100)}%`}
        className="hidden items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:flex"
      >
        <Rocket aria-hidden className={`h-4 w-4 ${behind ? 'text-[#ff8a7d]' : 'text-accent'}`} />
        <span className="flex w-36 flex-col gap-1">
          {[
            { label: t('race.you'), value: mine, fill: 'bg-accent' },
            { label: rivalName, value: leader?.progress ?? 0, fill: 'bg-[#ff5d4d]' },
          ].map((row) => (
            <span key={row.label} className="flex items-center gap-1.5 text-[10px] leading-none">
              <span className="w-14 truncate text-left text-fg-muted">{row.label}</span>
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                <span
                  className={`block h-full rounded-full transition-[width] duration-700 ${row.fill}`}
                  style={{ width: `${Math.max(2, row.value * 100)}%` }}
                />
              </span>
              <span className="numeric-tabular w-7 text-right font-mono text-fg">
                {Math.round(row.value * 100)}%
              </span>
            </span>
          ))}
        </span>
      </button>
    );
  }

  let goal: Goal | null = null;
  if (mode === 'dethrone') {
    const streaks = state._dethroneStreaks;
    const out = streaks?.outOfTop3Weeks ?? 0;
    const held = streaks?.heldWeeks ?? 0;
    const years = (weeks: number) => (weeks / 52).toFixed(1);
    if (!streaks?.everOnPodium) {
      goal = {
        text: t('throneClimb', { rank: gdpRank(state), years: years(Math.max(0, DETHRONE_CLIMB_WEEKS - out)) }),
        progress: 1 - out / DETHRONE_CLIMB_WEEKS,
        panel: 'economy',
      };
    } else if (out > 0) {
      goal = {
        text: t('throneOut', { years: years(Math.max(0, DETHRONE_OUT_OF_TOP3_WEEKS - out)) }),
        progress: 1 - out / DETHRONE_OUT_OF_TOP3_WEEKS,
        panel: 'economy',
      };
    } else {
      goal = {
        text: t('throne', { held: years(held), target: Math.round(DETHRONE_HOLD_TO_WIN_WEEKS / 52) }),
        progress: held / DETHRONE_HOLD_TO_WIN_WEEKS,
        panel: 'economy',
      };
    }
  } else {
    const def = scenario.victoryConditions.find((v) => v.id === state.selectedVictoryCondition);
    goal = def ? describeRule(def.rule, state, scenario, t, tScenario) : null;
  }
  if (!goal) return null;
  const Icon = mode === 'dethrone' ? Crown : goal.panel === 'cosmos' ? Rocket : goal.panel === 'diplomacy' ? Flag : Target;

  return (
    <button
      type="button"
      data-testid="hud-goal"
      onClick={() => setSelectedPanel(goal.panel)}
      title={t('open')}
      className="hidden max-w-[15rem] items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:flex"
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0 text-accent" />
      <span className="flex min-w-0 flex-col gap-1 leading-none">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-faint">{t('label')}</span>
        <span className="truncate text-xs text-fg">{goal.text}</span>
        {goal.progress !== undefined ? (
          <span aria-hidden className="block h-[3px] w-full overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-accent transition-[width] duration-700"
              style={{ width: `${Math.max(3, Math.min(1, goal.progress) * 100)}%` }}
            />
          </span>
        ) : null}
      </span>
    </button>
  );
}

function describeRule(
  rule: VictoryRule,
  state: GameState,
  scenario: Scenario,
  t: ReturnType<typeof useTranslations<'hud.goal'>>,
  tScenario: (key: string) => string,
): Goal | null {
  switch (rule.kind) {
    case 'gdpRank': {
      const rank = gdpRank(state);
      const total = Object.keys(state.countries).length;
      return {
        text: `${t('rank', { rank })} · ${t('rankTarget', { n: rule.rankAtMost })}`,
        progress: total > 1 ? 1 - (rank - rule.rankAtMost) / (total - 1) : 1,
        panel: 'economy',
      };
    }
    case 'controlNCountries': {
      const n = allyCount(state) + 1;
      return { text: t('allies', { n, target: rule.n }), progress: n / rule.n, panel: 'diplomacy' };
    }
    case 'allianceCoverage': {
      const total = Math.max(1, Object.keys(state.countries).length - 1);
      const pct = Math.round((allyCount(state) / total) * 100);
      return {
        text: t('coverage', { pct, target: rule.minPercent }),
        progress: pct / rule.minPercent,
        panel: 'diplomacy',
      };
    }
    case 'completeTech': {
      const tech = scenario.techTree.find((x) => x.id === rule.techId);
      return { text: t('tech', { name: tech ? tScenario(tech.nameKey) : rule.techId }), panel: 'research' };
    }
    case 'kardashev': {
      const value = state.cosmos?.kardashev ?? 0.7;
      return {
        text: t('kardashev', { value: value.toFixed(2), target: rule.atLeast.toFixed(1) }),
        progress: (value - 0.7) / Math.max(0.01, rule.atLeast - 0.7),
        panel: 'cosmos',
      };
    }
    case 'and':
    case 'or': {
      // Show the leg the player is furthest along on.
      const legs = rule.rules
        .map((r) => describeRule(r, state, scenario, t, tScenario))
        .filter((g): g is Goal => g !== null);
      return legs.sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0] ?? null;
    }
  }
}

export default GoalChip;

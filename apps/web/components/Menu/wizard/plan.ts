// The expedition plan: every choice the new-game flow collects, with
// recommended defaults so the game can start from any step.

import type { DifficultyTuning, GameMode, Scenario, VictoryConditionId } from '@aurion/engine';

import type { ScenarioId } from '../../../lib/scenarios';
import { modeMeta, RECOMMENDED_MODE, type ModeMeta } from '../modes';
import { isIronMan, worldHasEras } from './insight';
import type { Worlds } from './useWorlds';

export type StepId = 'mode' | 'world' | 'nation' | 'victory' | 'difficulty' | 'launch';

export type Plan = {
  mode: GameMode;
  worldId: ScenarioId;
  /** Remembered per world, so going back and forth never loses a pick. */
  nationByWorld: Partial<Record<ScenarioId, string>>;
  /** Only used by Campaign; other modes fix their own. */
  victory: VictoryConditionId;
  difficultyId: string;
  ironMan: boolean;
  /** Optional custom save name; empty = let the game name it. */
  saveName: string;
};

export const RECOMMENDED_WORLD: ScenarioId = 'ascesa-aurion';
export const RECOMMENDED_VICTORY: VictoryConditionId = 'economic';
export const RECOMMENDED_DIFFICULTY = 'normal';
/** First world offered when a mode needs historical eras. */
export const DEFAULT_ERA_WORLD: ScenarioId = 'mondo-contemporaneo';

export const DEFAULT_PLAN: Plan = {
  mode: RECOMMENDED_MODE,
  worldId: RECOMMENDED_WORLD,
  nationByWorld: {},
  victory: RECOMMENDED_VICTORY,
  difficultyId: RECOMMENDED_DIFFICULTY,
  ironMan: false,
  saveName: '',
};

export function stepsFor(mode: GameMode): StepId[] {
  return modeMeta(mode).choosesVictory
    ? ['mode', 'world', 'nation', 'victory', 'difficulty', 'launch']
    : ['mode', 'world', 'nation', 'difficulty', 'launch'];
}

/** The plan with every default filled in against the loaded world data. */
export type ResolvedPlan = {
  mode: ModeMeta;
  scenario: Scenario | undefined;
  nationId: string | undefined;
  victory: VictoryConditionId;
  /** Presets the player picks between (Iron Man is a separate switch). */
  presets: DifficultyTuning[];
  ironPreset: DifficultyTuning | undefined;
  /** The preset that will actually be sent to the engine. */
  difficulty: DifficultyTuning | undefined;
  ironMan: boolean;
};

export function resolvePlan(plan: Plan, worlds: Worlds): ResolvedPlan {
  const mode = modeMeta(plan.mode);
  const scenario = worlds[plan.worldId];
  const picked = plan.nationByWorld[plan.worldId];
  const nationId =
    scenario && picked && scenario.playableCountries.includes(picked)
      ? picked
      : scenario?.playableCountries[0];

  const all = scenario?.difficulties ?? [];
  const presets = all.filter((d) => !isIronMan(d));
  const ironPreset = all.find(isIronMan);
  const base =
    presets.find((d) => d.id === plan.difficultyId) ??
    presets.find((d) => d.id === RECOMMENDED_DIFFICULTY) ??
    presets[0];
  const ironMan = plan.ironMan && ironPreset !== undefined;

  return {
    mode,
    scenario,
    nationId,
    victory: mode.choosesVictory ? plan.victory : mode.fixedVictory,
    presets,
    ironPreset,
    difficulty: ironMan ? ironPreset : base,
    ironMan,
  };
}

/** Switching to a mode that needs eras moves the plan to a world that has them. */
export function withMode(plan: Plan, mode: GameMode, worlds: Worlds): Plan {
  const needsEras = modeMeta(mode).needsEras;
  const worldId =
    needsEras && !worldHasEras(plan.worldId, worlds[plan.worldId])
      ? DEFAULT_ERA_WORLD
      : plan.worldId;
  return { ...plan, mode, worldId };
}

/** What every step receives. */
export type StepProps = {
  plan: Plan;
  resolved: ResolvedPlan;
  worlds: Worlds;
  failed: ReadonlySet<ScenarioId>;
  /** Apply a choice made on `step` and mark that step as decided. */
  update: (step: StepId, patch: (prev: Plan) => Plan) => void;
};

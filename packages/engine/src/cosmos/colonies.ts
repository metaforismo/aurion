// Colonies. Once a megaproject puts people on the Moon or Mars, the
// settlement there becomes a place of its own: its population grows toward
// what its buildings can house, and the player gives it a mandate —
// science, industry or trade — that decides what it sends home.

import type {
  ApplyActionResult,
  ColonyBody,
  ColonyFocus,
  ColonyState,
  CountryId,
  GameState,
} from '../types.js';
import { COSMOS_PROJECTS } from './projects.js';

export const COLONY_BODIES: readonly ColonyBody[] = ['moon', 'mars'];
export const COLONY_FOCUSES: readonly ColonyFocus[] = ['balanced', 'science', 'industry', 'trade'];

/** Weeks between two changes of mandate for the same colony. */
export const COLONY_FOCUS_COOLDOWN_TICKS = 26;
/** Share of the housing a new colony fills on the day it opens. */
export const COLONY_FOUNDING_SHARE = 0.1;
/** Weekly growth rate of a nearly empty colony (logistic toward capacity). */
export const COLONY_GROWTH_PER_TICK = 0.02;

/**
 * What a colony yields per point of size, by mandate. Size is the order of
 * magnitude of its population (see `colonySize`).
 *  - research: points added to the active research every week
 *  - income:   cosmos cost units (1% of starting GDP) paid in every week
 *  - speed:    megaproject construction speed
 */
export const COLONY_YIELD: Record<ColonyFocus, { research: number; income: number; speed: number }> = {
  balanced: { research: 0.3, income: 0.012, speed: 0.01 },
  science: { research: 0.9, income: 0, speed: 0 },
  industry: { research: 0, income: 0, speed: 0.03 },
  trade: { research: 0, income: 0.036, speed: 0 },
};

export type ColonyOutput = { research: number; income: number; projectSpeed: number };

/** People the completed projects on a body can house. */
export function colonyCapacity(completed: readonly string[], body: ColonyBody): number {
  let total = 0;
  for (const def of COSMOS_PROJECTS) {
    if (def.body === body && completed.includes(def.id)) total += def.effects.colonists ?? 0;
  }
  return total;
}

/** A colony's weight: 2 at a hundred people, 6 at a million. */
export function colonySize(population: number): number {
  return population > 0 ? Math.log10(population + 1) : 0;
}

/** What a colony of this size sends home under a mandate; `unit` is the cosmos cost unit. */
export function colonyOutput(population: number, focus: ColonyFocus, unit: number): ColonyOutput {
  const size = colonySize(population);
  const y = COLONY_YIELD[focus];
  return {
    research: size * y.research,
    income: Math.round(size * y.income * unit),
    projectSpeed: size * y.speed,
  };
}

/** Everything the player's colonies send home this week. */
export function colonyModifiers(state: GameState): ColonyOutput {
  const out: ColonyOutput = { research: 0, income: 0, projectSpeed: 0 };
  const cosmos = state.cosmos;
  if (!cosmos?.colonies) return out;
  for (const body of COLONY_BODIES) {
    const colony = cosmos.colonies[body];
    if (!colony) continue;
    const o = colonyOutput(colony.population, colony.focus, cosmos.unit);
    out.research += o.research;
    out.income += o.income;
    out.projectSpeed += o.projectSpeed;
  }
  return out;
}

export type ColonyStatus = {
  body: ColonyBody;
  population: number;
  capacity: number;
  focus: ColonyFocus;
  /** Weeks until the mandate can be changed again (0 = now). */
  focusLockedFor: number;
  output: ColonyOutput;
};

/** The colony on a body, or null while nobody lives there. */
export function getColonyStatus(state: GameState, body: ColonyBody): ColonyStatus | null {
  const cosmos = state.cosmos;
  const colony = cosmos?.colonies?.[body];
  if (!cosmos || !colony) return null;
  return {
    body,
    population: colony.population,
    capacity: colonyCapacity(cosmos.completed, body),
    focus: colony.focus,
    focusLockedFor: Math.max(0, colony.focusChangedAtTick + COLONY_FOCUS_COOLDOWN_TICKS - state.tick),
    output: colonyOutput(colony.population, colony.focus, cosmos.unit),
  };
}

/**
 * Weekly step: found colonies where housing now exists, grow the ones that
 * are there, and deliver what they produce to the player.
 */
export function tickColonies(state: GameState): GameState {
  const cosmos = state.cosmos;
  if (!cosmos) return state;
  let colonies = cosmos.colonies;
  let changed = false;
  for (const body of COLONY_BODIES) {
    const capacity = colonyCapacity(cosmos.completed, body);
    if (capacity <= 0) continue;
    const current = colonies?.[body];
    let next: ColonyState;
    if (!current) {
      next = {
        focus: 'balanced',
        // A fresh colony may be given its first mandate straight away.
        focusChangedAtTick: state.tick - COLONY_FOCUS_COOLDOWN_TICKS,
        population: Math.max(1, Math.round(capacity * COLONY_FOUNDING_SHARE)),
      };
    } else if (current.population < capacity) {
      const growth = current.population * COLONY_GROWTH_PER_TICK * (1 - current.population / capacity);
      next = { ...current, population: Math.min(capacity, current.population + Math.max(1, Math.round(growth))) };
    } else {
      continue;
    }
    colonies = { ...(colonies ?? {}), [body]: next };
    changed = true;
  }

  let next: GameState = changed ? { ...state, cosmos: { ...cosmos, colonies } } : state;
  const yields = colonyModifiers(next);
  const player = next.countries[next.playerCountryId];
  if (!player || (yields.income === 0 && yields.research === 0)) return next;

  if (yields.income !== 0) {
    next = {
      ...next,
      countries: {
        ...next.countries,
        [player.id]: { ...player, economy: { ...player.economy, treasury: player.economy.treasury + yields.income } },
      },
    };
  }
  // Research lands on whatever is being worked on; idle labs waste it.
  const progress = next.techTreeProgress[player.id];
  if (yields.research > 0 && progress?.activeResearch) {
    next = {
      ...next,
      techTreeProgress: {
        ...next.techTreeProgress,
        [player.id]: { ...progress, accumulatedPoints: progress.accumulatedPoints + yields.research },
      },
    };
  }
  return next;
}

export function applySetColonyFocus(
  state: GameState,
  action: { type: 'setColonyFocus'; body: ColonyBody; focus: ColonyFocus },
  countryId: CountryId,
): ApplyActionResult {
  if (countryId !== state.playerCountryId) return { state, errors: ['errors.colony.playerOnly'] };
  const cosmos = state.cosmos;
  const colony = cosmos?.colonies?.[action.body];
  if (!cosmos || !colony) return { state, errors: ['errors.colony.none'] };
  if (!COLONY_FOCUSES.includes(action.focus)) return { state, errors: ['errors.colony.unknownFocus'] };
  if (colony.focus === action.focus) return { state, errors: ['errors.colony.sameFocus'] };
  if (state.tick < colony.focusChangedAtTick + COLONY_FOCUS_COOLDOWN_TICKS) {
    return { state, errors: ['errors.colony.cooldown'] };
  }
  return {
    state: {
      ...state,
      cosmos: {
        ...cosmos,
        colonies: {
          ...cosmos.colonies,
          [action.body]: { ...colony, focus: action.focus, focusChangedAtTick: state.tick },
        },
      },
    },
    errors: [],
  };
}

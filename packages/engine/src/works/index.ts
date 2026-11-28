// National works: facilities the player builds and upgrades at home with
// money — a university that trains engineers, data centres, power plants, a
// fusion test reactor, a particle collider hunting dark matter. Each level
// costs more and takes longer than the last; when it is finished its effects
// land once (GDP, research, popularity, intelligence, Kardashev rating).
// Costs are in cosmos units (1% of the starting GDP), so the catalogue
// suits a small island and a superpower alike.
//
// Pure TS, no DOM.
import type {
  Action,
  ApplyActionResult,
  CountryId,
  GameState,
  WorkBuild,
  WorkDef,
  WorkId,
  WorksState,
} from '../types.js';

export const WORKS: readonly WorkDef[] = [
  { id: 'university', cost: 3, durationTicks: 8, maxLevel: 3, effects: { research: 1.5, popularity: 1 } },
  { id: 'hospital', cost: 3, durationTicks: 6, maxLevel: 3, effects: { popularity: 3 } },
  { id: 'datacenter', cost: 4, durationTicks: 6, maxLevel: 3, effects: { research: 1, gdpMul: 1.02 } },
  { id: 'exchange', cost: 4, durationTicks: 6, maxLevel: 3, effects: { gdpMul: 1.03 } },
  { id: 'airport', cost: 5, durationTicks: 10, maxLevel: 3, effects: { gdpMul: 1.025, popularity: 0.5 } },
  { id: 'solar', cost: 2, durationTicks: 4, maxLevel: 3, effects: { gdpMul: 1.015, kardashev: 0.002, popularity: 0.5 } },
  { id: 'nuclear', cost: 7, durationTicks: 14, maxLevel: 3, effects: { gdpMul: 1.04, kardashev: 0.004 } },
  {
    id: 'fusion_lab', cost: 8, durationTicks: 16, maxLevel: 3,
    effects: { research: 1.2, kardashev: 0.003 }, requires: { work: 'university', level: 1 },
  },
  {
    id: 'observatory', cost: 4, durationTicks: 8, maxLevel: 3,
    effects: { research: 0.8, popularity: 0.5 },
  },
  {
    id: 'collider', cost: 14, durationTicks: 24, maxLevel: 3,
    effects: { research: 3, popularity: 1.5 }, requires: { work: 'university', level: 2 },
  },
  { id: 'intel_hq', cost: 3, durationTicks: 6, maxLevel: 3, effects: { spies: 1, counterIntel: 0.05 } },
];

/** Works the player can have under construction at once. */
export const WORK_SLOTS = 2;
/** Each level costs this much more than the one before. */
export const WORK_LEVEL_COST = 1.7;
/** …and takes this much longer. */
export const WORK_LEVEL_TIME = 1.3;
/** Share of the price returned when a build is cancelled. */
export const WORK_CANCEL_REFUND = 0.5;

export function getWork(id: WorkId): WorkDef | undefined {
  return WORKS.find((w) => w.id === id);
}

export function emptyWorks(): WorksState {
  return { levels: {}, active: [], finished: [] };
}

function unitOf(state: GameState): number {
  if (state.cosmos) return state.cosmos.unit;
  const gdp = state.countries[state.playerCountryId]?.economy.gdp ?? 1e9;
  return Math.max(1, Math.round(gdp / 100));
}

export function workLevel(state: GameState, id: WorkId): number {
  return state.works?.levels[id] ?? 0;
}

/** Price of building `level` of a work. */
export function workCost(state: GameState, def: WorkDef, level: number): number {
  return Math.round(def.cost * unitOf(state) * WORK_LEVEL_COST ** (level - 1));
}

/** Weeks `level` of a work takes. */
export function workDuration(def: WorkDef, level: number): number {
  return Math.round(def.durationTicks * WORK_LEVEL_TIME ** (level - 1));
}

export type WorkStatus =
  | { status: 'maxed'; level: number }
  | { status: 'building'; level: number; build: WorkBuild }
  | { status: 'locked'; level: number; requires: { work: WorkId; level: number } }
  | { status: 'available'; level: number; cost: number; duration: number; affordable: boolean; slotFree: boolean };

export function workStatus(state: GameState, def: WorkDef): WorkStatus {
  const level = workLevel(state, def.id);
  const build = state.works?.active.find((b) => b.workId === def.id);
  if (build) return { status: 'building', level, build };
  if (level >= def.maxLevel) return { status: 'maxed', level };
  if (def.requires && workLevel(state, def.requires.work) < def.requires.level) {
    return { status: 'locked', level, requires: def.requires };
  }
  const cost = workCost(state, def, level + 1);
  const treasury = state.countries[state.playerCountryId]?.economy.treasury ?? 0;
  return {
    status: 'available',
    level,
    cost,
    duration: workDuration(def, level + 1),
    affordable: treasury >= cost,
    slotFree: (state.works?.active.length ?? 0) < WORK_SLOTS,
  };
}

export type BuildWorkAction = Extract<Action, { type: 'buildWork' }>;
export type CancelWorkAction = Extract<Action, { type: 'cancelWork' }>;

export function applyBuildWork(state: GameState, action: BuildWorkAction, countryId: CountryId): ApplyActionResult {
  if (countryId !== state.playerCountryId) return { state, errors: ['errors.works.playerOnly'] };
  const def = getWork(action.workId);
  if (!def) return { state, errors: ['errors.works.unknown'] };
  const status = workStatus(state, def);
  if (status.status === 'building') return { state, errors: ['errors.works.alreadyBuilding'] };
  if (status.status === 'maxed') return { state, errors: ['errors.works.maxed'] };
  if (status.status === 'locked') return { state, errors: ['errors.works.locked'] };
  if (!status.slotFree) return { state, errors: ['errors.works.noFreeSlot'] };
  if (!status.affordable) return { state, errors: ['errors.works.insufficientTreasury'] };
  const player = state.countries[countryId];
  if (!player) return { state, errors: ['errors.country.notFound'] };
  const works = state.works ?? emptyWorks();
  return {
    state: {
      ...state,
      countries: {
        ...state.countries,
        [countryId]: { ...player, economy: { ...player.economy, treasury: player.economy.treasury - status.cost } },
      },
      works: {
        ...works,
        active: [
          ...works.active,
          {
            workId: def.id,
            toLevel: status.level + 1,
            startedAtTick: state.tick,
            totalTicks: status.duration,
            remainingTicks: status.duration,
            paid: status.cost,
          },
        ],
      },
    },
    errors: [],
  };
}

export function applyCancelWork(state: GameState, action: CancelWorkAction, countryId: CountryId): ApplyActionResult {
  if (countryId !== state.playerCountryId) return { state, errors: ['errors.works.playerOnly'] };
  const works = state.works;
  const build = works?.active.find((b) => b.workId === action.workId);
  const player = state.countries[countryId];
  if (!works || !build || !player) return { state, errors: ['errors.works.notBuilding'] };
  const refund = Math.round(build.paid * WORK_CANCEL_REFUND);
  return {
    state: {
      ...state,
      countries: {
        ...state.countries,
        [countryId]: { ...player, economy: { ...player.economy, treasury: player.economy.treasury + refund } },
      },
      works: { ...works, active: works.active.filter((b) => b.workId !== action.workId) },
    },
    errors: [],
  };
}

/** How far along a build is, 0..1. */
export function workProgress(build: WorkBuild): number {
  return build.totalTicks <= 0 ? 1 : 1 - build.remainingTicks / build.totalTicks;
}

/** One week of construction; finished levels apply their effects. */
export function tickWorks(state: GameState): GameState {
  const works = state.works;
  if (!works || works.active.length === 0) return state;
  let next = state;
  const active: WorkBuild[] = [];
  const levels = { ...works.levels };
  const finished = [...works.finished];
  for (const build of works.active) {
    const remaining = build.remainingTicks - 1;
    if (remaining > 0) {
      active.push({ ...build, remainingTicks: remaining });
      continue;
    }
    levels[build.workId] = build.toLevel;
    finished.push({ workId: build.workId, level: build.toLevel, tick: state.tick });
    next = applyWorkEffects(next, build.workId);
  }
  return { ...next, works: { levels, active, finished: finished.slice(-12) } };
}

function applyWorkEffects(state: GameState, id: WorkId): GameState {
  const def = getWork(id);
  const player = state.countries[state.playerCountryId];
  if (!def || !player) return state;
  const fx = def.effects;
  const intel = player.intelligence;
  return {
    ...state,
    countries: {
      ...state.countries,
      [player.id]: {
        ...player,
        economy: { ...player.economy, gdp: Math.round(player.economy.gdp * (fx.gdpMul ?? 1)) },
        science: { ...player.science, researchOutput: player.science.researchOutput + (fx.research ?? 0) },
        politics: {
          ...player.politics,
          popularity: Math.max(0, Math.min(100, player.politics.popularity + (fx.popularity ?? 0))),
        },
        intelligence: {
          ...intel,
          spyCount: intel.spyCount + (fx.spies ?? 0),
          counterIntelLevel: Math.min(1, intel.counterIntelLevel + (fx.counterIntel ?? 0)),
        },
      },
    },
    cosmos: state.cosmos && fx.kardashev ? { ...state.cosmos, kardashev: state.cosmos.kardashev + fx.kardashev } : state.cosmos,
  };
}

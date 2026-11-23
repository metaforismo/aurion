// Cosmos system — megaprojects, off-world expansion and the Kardashev scale.
//
// The long game: after (and alongside) the terrestrial power struggle the
// player funds megaprojects that push their civilisation up the Kardashev
// ladder — Type I (a planet's worth of energy), Type II (a star's worth) and
// the first step toward the stars. Rival nations run the same ladder at
// their own pace, so "who gets there first" stays a live race.
//
// Engine integration:
//   - `initCosmos(state)`            — createGame (and lazily for old saves).
//   - `applyStartProject` / `applyCancelProject` — player actions.
//   - `tickCosmos(state, ctx)`       — advances construction + rival race.
//   - selectors (`getProjectStatus`, `cosmosSlots`, …) for UI and AI.
//
// Pure functions only: inputs are never mutated.

import { queueReputationDelta } from '../reputation/index.js';
import type {
  Action,
  ActiveBlocId,
  ApplyActionResult,
  CosmosBodyId,
  CosmosLogEntry,
  CosmosProjectDef,
  CosmosProjectId,
  CosmosRival,
  CosmosState,
  Country,
  CountryId,
  GameState,
  TechDefinition,
} from '../types.js';
import { policyModifiers } from '../policies/index.js';
import { colonyModifiers, tickColonies } from './colonies.js';
import { COSMOS_PROJECTS, KARDASHEV_START, getCosmosProject } from './projects.js';

export { COSMOS_PROJECTS, KARDASHEV_START, getCosmosProject };

/** i18n key for reputation gained by winning a leg of the space race. */
export const COSMOS_REASON_FIRST = 'rep.reason.cosmosFirst';
/** Share of the paid cost returned when a build is cancelled. */
export const CANCEL_REFUND_SHARE = 0.5;
/** Maximum entries kept in the completion log. */
const LOG_LIMIT = 40;
/** Base rival progress per tick, in cost units. */
const RIVAL_BASE_RATE = 0.042;
/** Each completed project compounds a rival's pace by this factor. */
const RIVAL_COMPOUND = 1.065;
/** Rivals only bank a fraction of a project's GDP multiplier. */
const RIVAL_GDP_SHARE = 0.35;

// ---------------------------------------------------------------------------
// Kardashev helpers
// ---------------------------------------------------------------------------

/** Sagan's interpolation, inverted: rating → captured power in watts. */
export function kardashevToWatts(rating: number): number {
  return 10 ** (rating * 10 + 6);
}

/** 0 = pre-planetary, 1 = Type I, 2 = Type II, 3 = Type III. */
export function kardashevType(rating: number): 0 | 1 | 2 | 3 {
  if (rating >= 3) return 3;
  if (rating >= 2) return 2;
  if (rating >= 1) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initCosmos(state: GameState): CosmosState {
  const player = state.countries[state.playerCountryId];
  const unit = Math.max(1, Math.round((player?.economy.gdp ?? 1e9) / 100));
  const rivals: Record<CountryId, CosmosRival> = {};
  for (const id of Object.keys(state.countries)) {
    if (id === state.playerCountryId) continue;
    rivals[id] = { completed: [], points: 0 };
  }
  return {
    unit,
    kardashev: KARDASHEV_START,
    completed: [],
    active: [],
    rivals,
    firsts: {},
    log: [],
  };
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Share (0..1) of the scenario's space branch the country has researched. */
export function spaceTechShare(
  country: Country | undefined,
  techCatalog: readonly TechDefinition[],
): number {
  const space = techCatalog.filter((t) => t.branch === 'space');
  if (space.length === 0) return 1;
  if (!country) return 0;
  const done = space.filter((t) => country.science.completedTechs.includes(t.id)).length;
  return done / space.length;
}

/** How many megaprojects the player may build at the same time. */
export function cosmosSlots(cosmos: CosmosState): number {
  let slots = 1;
  for (const id of cosmos.completed) slots += getCosmosProject(id)?.effects.slots ?? 0;
  return slots;
}

/** List price of a project for this save, before policy discounts. */
export function projectCost(cosmos: CosmosState, def: CosmosProjectDef): number {
  return Math.round(def.cost * cosmos.unit);
}

/** Each ally shares the bill: this much off per alliance… */
export const ALLY_PROJECT_DISCOUNT = 0.04;
/** …up to this much in total. */
export const ALLY_PROJECT_DISCOUNT_CAP = 0.2;

export type ProjectCostBreakdown = {
  /** Catalogue price for this save. */
  list: number;
  /** Share taken off by national policies (0.12 = 12%). */
  policyDiscount: number;
  /** Share taken off because allies co-fund the project. */
  allyDiscount: number;
  /** Number of alliances counted. */
  allies: number;
  /** What the player pays. */
  final: number;
};

/** How the price of a megaproject is built up right now. */
export function projectCostBreakdown(state: GameState, def: CosmosProjectDef): ProjectCostBreakdown {
  const cosmos = state.cosmos ?? initCosmos(state);
  const list = projectCost(cosmos, def);
  const me = state.playerCountryId;
  const allies = Object.values(state.relations).filter(
    (r) => (r.countryA === me || r.countryB === me) && r.treaties.includes('alliance'),
  ).length;
  const allyDiscount = Math.min(ALLY_PROJECT_DISCOUNT_CAP, allies * ALLY_PROJECT_DISCOUNT);
  const policyDiscount = Math.min(0.5, Math.max(0, -policyModifiers(state).projectCostMul));
  return {
    list,
    policyDiscount,
    allyDiscount,
    allies,
    final: Math.round(list * (1 - policyDiscount) * (1 - allyDiscount)),
  };
}

/** What the player actually pays right now (policies and allies applied). */
export function effectiveProjectCost(state: GameState, def: CosmosProjectDef): number {
  return projectCostBreakdown(state, def).final;
}

/** People living off-world. */
export function cosmosColonists(cosmos: CosmosState): number {
  let total = 0;
  for (const id of cosmos.completed) total += getCosmosProject(id)?.effects.colonists ?? 0;
  return total;
}

/** Bodies where the player has at least one finished project. */
export function settledBodies(cosmos: CosmosState): CosmosBodyId[] {
  const seen = new Set<CosmosBodyId>(['earth']);
  for (const id of cosmos.completed) {
    const def = getCosmosProject(id);
    if (def) seen.add(def.body);
  }
  return Array.from(seen);
}

export type CosmosProjectStatus =
  | { status: 'done' }
  | { status: 'building'; remainingTicks: number; progress: number }
  | { status: 'available'; affordable: boolean; slotFree: boolean }
  | {
      status: 'locked';
      missingProjects: CosmosProjectId[];
      /** Space-tech share still required (0 when satisfied). */
      missingTechShare: number;
    };

export function getProjectStatus(
  state: GameState,
  def: CosmosProjectDef,
  techCatalog: readonly TechDefinition[] = [],
): CosmosProjectStatus {
  const cosmos = state.cosmos ?? initCosmos(state);
  if (cosmos.completed.includes(def.id)) return { status: 'done' };
  const active = cosmos.active.find((a) => a.projectId === def.id);
  if (active) {
    return {
      status: 'building',
      remainingTicks: active.remainingTicks,
      progress: 1 - active.remainingTicks / Math.max(1, def.durationTicks),
    };
  }
  const missingProjects = def.requires.filter((r) => !cosmos.completed.includes(r));
  const player = state.countries[state.playerCountryId];
  const share = spaceTechShare(player, techCatalog);
  const needed = def.minSpaceTechShare ?? 0;
  const missingTechShare = share + 1e-9 >= needed ? 0 : needed;
  if (missingProjects.length > 0 || missingTechShare > 0) {
    return { status: 'locked', missingProjects, missingTechShare };
  }
  return {
    status: 'available',
    affordable: (player?.economy.treasury ?? 0) >= effectiveProjectCost(state, def),
    slotFree: cosmos.active.length < cosmosSlots(cosmos),
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type StartProjectAction = Extract<Action, { type: 'startProject' }>;
export type CancelProjectAction = Extract<Action, { type: 'cancelProject' }>;

export function applyStartProject(
  state: GameState,
  action: StartProjectAction,
  countryId: CountryId,
  techCatalog: readonly TechDefinition[] = [],
): ApplyActionResult {
  if (countryId !== state.playerCountryId) {
    return { state, errors: ['errors.cosmos.playerOnly'] };
  }
  const def = getCosmosProject(action.projectId);
  if (!def) return { state, errors: ['errors.cosmos.unknownProject'] };
  const cosmos = state.cosmos ?? initCosmos(state);
  const withCosmos: GameState = state.cosmos ? state : { ...state, cosmos };
  const status = getProjectStatus(withCosmos, def, techCatalog);
  if (status.status === 'done') return { state, errors: ['errors.cosmos.alreadyDone'] };
  if (status.status === 'building') return { state, errors: ['errors.cosmos.alreadyBuilding'] };
  if (status.status === 'locked') {
    return {
      state,
      errors: [
        status.missingProjects.length > 0
          ? 'errors.cosmos.missingPrerequisite'
          : 'errors.cosmos.missingSpaceTech',
      ],
    };
  }
  if (!status.slotFree) return { state, errors: ['errors.cosmos.noFreeSlot'] };
  if (!status.affordable) return { state, errors: ['errors.cosmos.insufficientTreasury'] };

  const player = state.countries[countryId];
  if (!player) return { state, errors: ['errors.country.notFound'] };
  const price = effectiveProjectCost(withCosmos, def);
  return {
    state: {
      ...state,
      countries: {
        ...state.countries,
        [countryId]: {
          ...player,
          economy: { ...player.economy, treasury: player.economy.treasury - price },
        },
      },
      cosmos: {
        ...cosmos,
        active: [
          ...cosmos.active,
          {
            projectId: def.id,
            startedAtTick: state.tick,
            remainingTicks: def.durationTicks,
            paid: price,
          },
        ],
      },
    },
    errors: [],
  };
}

export function applyCancelProject(
  state: GameState,
  action: CancelProjectAction,
  countryId: CountryId,
): ApplyActionResult {
  if (countryId !== state.playerCountryId) {
    return { state, errors: ['errors.cosmos.playerOnly'] };
  }
  const cosmos = state.cosmos;
  const active = cosmos?.active.find((a) => a.projectId === action.projectId);
  const player = state.countries[countryId];
  if (!cosmos || !active || !player) return { state, errors: ['errors.cosmos.notBuilding'] };
  const refund = Math.round(active.paid * CANCEL_REFUND_SHARE);
  return {
    state: {
      ...state,
      countries: {
        ...state.countries,
        [countryId]: {
          ...player,
          economy: { ...player.economy, treasury: player.economy.treasury + refund },
        },
      },
      cosmos: {
        ...cosmos,
        active: cosmos.active.filter((a) => a.projectId !== action.projectId),
      },
    },
    errors: [],
  };
}

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------

export type CosmosTickContext = {
  /** Difficulty multiplier applied to rival progress (aiResearchSpeed). */
  rivalSpeed?: number;
};

export function tickCosmos(state: GameState, ctx: CosmosTickContext = {}): GameState {
  let next: GameState = state.cosmos ? state : { ...state, cosmos: initCosmos(state) };
  next = advancePlayerProjects(next);
  next = tickColonies(next);
  next = advanceRivals(next, ctx.rivalSpeed ?? 1);
  return next;
}

function pushLog(log: CosmosLogEntry[], entry: CosmosLogEntry): CosmosLogEntry[] {
  const out = [...log, entry];
  return out.length > LOG_LIMIT ? out.slice(out.length - LOG_LIMIT) : out;
}

function advancePlayerProjects(state: GameState): GameState {
  const cosmos = state.cosmos;
  if (!cosmos || cosmos.active.length === 0) return state;

  // Policies can speed construction up: the fractional part is carried so a
  // 25% bonus means exactly one extra week of work every four.
  const speed =
    1 + policyModifiers(state).projectSpeed + colonyModifiers(state).projectSpeed + (state.policies?.speedCarry ?? 0);
  const work = Math.floor(speed);
  const carry = speed - work;

  const stillActive = [];
  const finished: CosmosProjectDef[] = [];
  for (const a of cosmos.active) {
    const remaining = a.remainingTicks - work;
    const def = getCosmosProject(a.projectId);
    if (remaining <= 0 && def) finished.push(def);
    else if (def) stillActive.push({ ...a, remainingTicks: remaining });
  }
  let next: GameState = {
    ...state,
    cosmos: { ...cosmos, active: stillActive },
    ...(state.policies ? { policies: { ...state.policies, speedCarry: carry } } : {}),
  };
  for (const def of finished) next = completeForPlayer(next, def);
  return next;
}

function completeForPlayer(state: GameState, def: CosmosProjectDef): GameState {
  const cosmos = state.cosmos;
  const player = state.countries[state.playerCountryId];
  if (!cosmos || !player) return state;
  const fx = def.effects;
  const first = cosmos.firsts[def.id] === undefined;

  let rating = cosmos.kardashev + (fx.kardashev ?? 0);
  if (fx.kardashevFloor !== undefined) rating = Math.max(rating, fx.kardashevFloor);

  const prestige = first ? (fx.prestige ?? 0) : 0;
  const popularity = Math.max(
    0,
    Math.min(100, player.politics.popularity + (fx.popularity ?? 0) + prestige * 0.15),
  );
  const updatedPlayer: Country = {
    ...player,
    economy: {
      ...player.economy,
      gdp: Math.round(player.economy.gdp * (fx.gdpMul ?? 1)),
    },
    science: {
      ...player.science,
      researchOutput: player.science.researchOutput + (fx.research ?? 0),
    },
    politics: { ...player.politics, popularity },
  };

  let next: GameState = {
    ...state,
    countries: { ...state.countries, [player.id]: updatedPlayer },
    cosmos: {
      ...cosmos,
      kardashev: rating,
      completed: [...cosmos.completed, def.id],
      firsts: first ? { ...cosmos.firsts, [def.id]: player.id } : cosmos.firsts,
      log: pushLog(cosmos.log, {
        tick: state.tick,
        countryId: player.id,
        projectId: def.id,
        first,
      }),
    },
  };

  if (prestige > 0 && next.reputation) {
    for (const blocId of Object.keys(next.reputation) as ActiveBlocId[]) {
      next = queueReputationDelta(next, {
        bloc: blocId,
        delta: prestige * 0.5,
        reasonKey: COSMOS_REASON_FIRST,
        queuedAtTick: state.tick,
      });
    }
  }
  return next;
}

/** Next project a rival will attempt: first unfinished one with prereqs met. */
function nextRivalProject(rival: CosmosRival): CosmosProjectDef | undefined {
  return COSMOS_PROJECTS.find(
    (p) =>
      !rival.completed.includes(p.id) &&
      p.requires.every((r) => rival.completed.includes(r)),
  );
}

function advanceRivals(state: GameState, rivalSpeed: number): GameState {
  const cosmos = state.cosmos;
  if (!cosmos) return state;

  // Rival pace scales with how its economy compares to the player's opening
  // economy — superpowers race ahead, small states lag behind.
  const playerBaseGdp = cosmos.unit * 100;
  let rivals = cosmos.rivals;
  let firsts = cosmos.firsts;
  let log = cosmos.log;
  let countries = state.countries;
  let changed = false;

  for (const [id, country] of Object.entries(state.countries)) {
    if (id === state.playerCountryId) continue;
    const rival = rivals[id] ?? { completed: [], points: 0 };
    const target = nextRivalProject(rival);
    if (!target) continue;

    const weight = Math.sqrt(Math.max(0.05, country.economy.gdp / playerBaseGdp));
    const science = 1 + Math.min(2, country.science.researchOutput / 20);
    const compound = RIVAL_COMPOUND ** rival.completed.length;
    const gain = RIVAL_BASE_RATE * Math.min(6, weight) * science * compound * rivalSpeed;
    let points = rival.points + gain;
    let completed = rival.completed;

    if (points >= target.cost) {
      points -= target.cost;
      completed = [...completed, target.id];
      const first = firsts[target.id] === undefined;
      if (first) firsts = { ...firsts, [target.id]: id };
      log = pushLog(log, { tick: state.tick, countryId: id, projectId: target.id, first });
      const mul = 1 + ((target.effects.gdpMul ?? 1) - 1) * RIVAL_GDP_SHARE;
      countries = {
        ...countries,
        [id]: {
          ...country,
          economy: { ...country.economy, gdp: Math.round(country.economy.gdp * mul) },
        },
      };
    }
    rivals = { ...rivals, [id]: { completed, points } };
    changed = true;
  }

  if (!changed) return state;
  return { ...state, countries, cosmos: { ...cosmos, rivals, firsts, log } };
}

/** Highest stage a rival (or the player) has a finished project in. */
export function highestStage(completed: readonly CosmosProjectId[]): number {
  let stage = -1;
  for (const id of completed) stage = Math.max(stage, getCosmosProject(id)?.stage ?? -1);
  return stage;
}

// ---------------------------------------------------------------------------
// Space Race mode
// ---------------------------------------------------------------------------

/** The project that ends a Space Race run (Kardashev Type I). */
export const SPACE_RACE_GOAL: CosmosProjectId = 'earth_planetary_grid';

/** The goal plus everything it transitively requires. */
export const SPACE_RACE_PATH: readonly CosmosProjectId[] = (() => {
  const seen = new Set<CosmosProjectId>();
  const visit = (id: CosmosProjectId) => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const r of getCosmosProject(id)?.requires ?? []) visit(r);
  };
  visit(SPACE_RACE_GOAL);
  return COSMOS_PROJECTS.filter((p) => seen.has(p.id)).map((p) => p.id);
})();

/** Share (0..1) of the Space Race path a civilisation has completed. */
export function spaceRaceProgress(completed: readonly CosmosProjectId[]): number {
  const done = SPACE_RACE_PATH.filter((id) => completed.includes(id)).length;
  return done / SPACE_RACE_PATH.length;
}

/** The rival closest to the goal, or null when there are no rivals. */
export function spaceRaceLeader(
  cosmos: CosmosState,
): { countryId: CountryId; progress: number } | null {
  let best: { countryId: CountryId; progress: number } | null = null;
  for (const [countryId, rival] of Object.entries(cosmos.rivals)) {
    const progress = spaceRaceProgress(rival.completed);
    if (!best || progress > best.progress) best = { countryId, progress };
  }
  return best;
}

/** 'won' / 'lost' once the race is decided, otherwise null. */
export function spaceRaceOutcome(state: GameState): 'won' | 'lost' | null {
  const cosmos = state.cosmos;
  if (!cosmos) return null;
  if (cosmos.completed.includes(SPACE_RACE_GOAL)) return 'won';
  for (const rival of Object.values(cosmos.rivals)) {
    if (rival.completed.includes(SPACE_RACE_GOAL)) return 'lost';
  }
  return null;
}

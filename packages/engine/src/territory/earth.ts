// Territory on Earth. The world is made of real countries; a scenario gives
// some of them to its nations as their home ground, and the rest are
// unaligned. A nation can bring an unaligned country next to land it already
// holds into its sphere as a protectorate. Rivals do the same, so the map
// fills up, and a capitulation hands a protectorate to the winner.

import { clamp } from '../actions/helpers.js';
import { createRng } from '../rng.js';
import type {
  ApplyActionResult,
  Country,
  CountryId,
  GameState,
  Scenario,
  TerritoryHolding,
} from '../types.js';
import { EARTH_TERRITORIES, type EarthTerritory } from './earthData.js';

/** Cost of a first protectorate the size of Italy, in cosmos units (1% of starting GDP). */
export const PROTECTORATE_BASE_COST = 14;
/** Each protectorate already held makes the next this much dearer. */
export const PROTECTORATE_COST_GROWTH = 0.25;
/** Weeks to integrate a protectorate the size of Italy. */
export const PROTECTORATE_BASE_TICKS = 30;
/** GDP a protectorate the size of Italy adds, in cosmos units. */
export const PROTECTORATE_GDP_UNITS = 5;
/** Attitude lost with every nation that borders the land taken. */
export const PROTECTORATE_NEIGHBOUR_PENALTY = 5;
/** Weekly chance that a given AI nation starts absorbing a neighbour. */
export const RIVAL_PROTECTORATE_CHANCE_PER_TICK = 1 / 170;
/** What an AI nation's economy gains, as a share of its GDP, per unit of weight. */
const RIVAL_GDP_SHARE = 0.02;

const BY_ID = new Map(EARTH_TERRITORIES.map((t) => [t.id, t]));

export function getEarthTerritory(id: string): EarthTerritory | undefined {
  return BY_ID.get(id);
}

/** Home ground of each nation in a scenario: territory id → country id. */
function homes(scenario: Scenario | undefined): Readonly<Record<string, CountryId>> {
  return scenario?.homeTerritories ?? {};
}

/** Who holds a territory: its home nation, whoever made it a protectorate, or nobody. */
export function territoryOwner(state: GameState, scenario: Scenario | undefined, id: string): CountryId | null {
  return homes(scenario)[id] ?? state.territories?.[id]?.owner ?? null;
}

/** Every territory a nation holds, home ground first. */
export function heldTerritories(state: GameState, scenario: Scenario | undefined, owner: CountryId): string[] {
  const home = Object.entries(homes(scenario))
    .filter(([, c]) => c === owner)
    .map(([id]) => id);
  const taken = Object.entries(state.territories ?? {})
    .filter(([, h]) => h.owner === owner)
    .map(([id]) => id);
  return [...home, ...taken];
}

/** Protectorates only (home ground cannot be lost or counted). */
export function protectorates(state: GameState, owner: CountryId): string[] {
  return Object.entries(state.territories ?? {})
    .filter(([, h]) => h.owner === owner)
    .map(([id]) => id);
}

function unitOf(state: GameState): number {
  const player = state.countries[state.playerCountryId];
  return state.cosmos?.unit ?? (player ? player.economy.gdp * 0.01 : 0);
}

export function protectorateCost(state: GameState, id: string): number {
  const t = BY_ID.get(id);
  if (!t) return 0;
  const held = protectorates(state, state.playerCountryId).length;
  return Math.round(PROTECTORATE_BASE_COST * t.weight * (1 + PROTECTORATE_COST_GROWTH * held) * unitOf(state));
}

export function protectorateDuration(id: string): number {
  const t = BY_ID.get(id);
  return t ? Math.round(PROTECTORATE_BASE_TICKS * (0.6 + 0.4 * t.weight)) : 0;
}

/** GDP the player gains for good when the protectorate is integrated. */
export function protectorateGdpGain(state: GameState, id: string): number {
  const t = BY_ID.get(id);
  return t ? Math.round(PROTECTORATE_GDP_UNITS * t.weight * unitOf(state)) : 0;
}

export type TerritoryStatus = {
  def: EarthTerritory;
  owner: CountryId | null;
  /** A nation's home ground: never up for grabs. */
  home: boolean;
  /** Unaligned, and next to land the player holds. */
  claimable: boolean;
  /** Being integrated by the player right now. */
  inProgress: boolean;
};

export function getTerritoryStatus(state: GameState, scenario: Scenario | undefined, id: string): TerritoryStatus | null {
  const def = BY_ID.get(id);
  if (!def) return null;
  const owner = territoryOwner(state, scenario, id);
  const mine = new Set(heldTerritories(state, scenario, state.playerCountryId));
  return {
    def,
    owner,
    home: homes(scenario)[id] !== undefined,
    claimable: owner === null && def.neighbours.some((n) => mine.has(n)),
    inProgress: state.territoryWork?.id === id,
  };
}

/** Everything the player could make a protectorate today. */
export function claimableTerritories(state: GameState, scenario: Scenario | undefined): string[] {
  const mine = heldTerritories(state, scenario, state.playerCountryId);
  const out = new Set<string>();
  for (const id of mine) {
    for (const n of BY_ID.get(id)?.neighbours ?? []) {
      if (territoryOwner(state, scenario, n) === null) out.add(n);
    }
  }
  return [...out].sort();
}

export function applyClaimTerritory(
  state: GameState,
  action: { type: 'claimTerritory'; territoryId: string },
  countryId: CountryId,
  scenario: Scenario | undefined,
): ApplyActionResult {
  if (countryId !== state.playerCountryId) return { state, errors: ['errors.territory.playerOnly'] };
  const status = getTerritoryStatus(state, scenario, action.territoryId);
  if (!status) return { state, errors: ['errors.territory.unknownSector'] };
  if (status.owner) return { state, errors: ['errors.territory.taken'] };
  if (!status.claimable) return { state, errors: ['errors.territory.notAdjacent'] };
  if (state.territoryWork) return { state, errors: ['errors.territory.busy'] };
  const player = state.countries[countryId];
  const cost = protectorateCost(state, action.territoryId);
  if (!player || player.economy.treasury < cost) return { state, errors: ['errors.territory.insufficientTreasury'] };
  return {
    state: {
      ...state,
      countries: {
        ...state.countries,
        [player.id]: { ...player, economy: { ...player.economy, treasury: player.economy.treasury - cost } },
      },
      territoryWork: { id: action.territoryId, remainingTicks: protectorateDuration(action.territoryId) },
    },
    errors: [],
  };
}

/** Nations (other than the taker) whose land borders a territory. */
function borderingNations(state: GameState, scenario: Scenario | undefined, id: string, except: CountryId): CountryId[] {
  const out = new Set<CountryId>();
  for (const n of BY_ID.get(id)?.neighbours ?? []) {
    const owner = territoryOwner(state, scenario, n);
    if (owner && owner !== except) out.add(owner);
  }
  return [...out];
}

/** Hand a territory to a nation, with the economy it brings and the resentment it causes. */
function annex(state: GameState, scenario: Scenario | undefined, id: string, owner: CountryId, gdpGain: number): GameState {
  const taker = state.countries[owner];
  if (!taker) return state;
  const relations = { ...state.relations };
  for (const other of borderingNations(state, scenario, id, owner)) {
    const key = owner < other ? `${owner}::${other}` : `${other}::${owner}`;
    const rel = relations[key as keyof typeof relations];
    if (rel) {
      relations[key as keyof typeof relations] = {
        ...rel,
        attitude: clamp(rel.attitude - PROTECTORATE_NEIGHBOUR_PENALTY, -100, 100),
      };
    }
  }
  const holding: TerritoryHolding = { owner, sinceTick: state.tick };
  const grown: Country = { ...taker, economy: { ...taker.economy, gdp: taker.economy.gdp + gdpGain } };
  return {
    ...state,
    relations,
    countries: { ...state.countries, [owner]: grown },
    territories: { ...(state.territories ?? {}), [id]: holding },
  };
}

/** Weekly step: finish the player's integration, and let rivals expand. */
export function tickEarthTerritory(state: GameState, scenario: Scenario | undefined): GameState {
  if (!scenario?.homeTerritories) return state;
  let next = state;

  const work = next.territoryWork;
  if (work) {
    if (work.remainingTicks > 1) {
      next = { ...next, territoryWork: { ...work, remainingTicks: work.remainingTicks - 1 } };
    } else {
      // A rival may have moved in while the paperwork was being done.
      const free = territoryOwner(next, scenario, work.id) === null;
      next = { ...next, territoryWork: null };
      if (free) next = annex(next, scenario, work.id, next.playerCountryId, protectorateGdpGain(next, work.id));
    }
  }

  // Rivals: one roll per AI nation a week, on a stream of its own.
  const rng = createRng(`${state.rngSeed}::earthTerritory::${state.tick}`);
  for (const country of Object.values(next.countries).sort((a, b) => a.id.localeCompare(b.id))) {
    if (country.id === next.playerCountryId || !country.aiPersonality) continue;
    if (rng.next() >= RIVAL_PROTECTORATE_CHANCE_PER_TICK) continue;
    const reserved = next.territoryWork?.id;
    const options = new Set<string>();
    for (const id of heldTerritories(next, scenario, country.id)) {
      for (const n of BY_ID.get(id)?.neighbours ?? []) {
        if (n !== reserved && territoryOwner(next, scenario, n) === null) options.add(n);
      }
    }
    if (options.size === 0) continue;
    const target = rng.pick([...options].sort());
    const weight = BY_ID.get(target)?.weight ?? 1;
    next = annex(next, scenario, target, country.id, Math.round(country.economy.gdp * RIVAL_GDP_SHARE * weight));
  }
  return next;
}

/**
 * Spoils of a capitulation: the loser's most recent protectorate goes to the
 * winner. Returns the state unchanged when the loser has none.
 */
export function cedeProtectorate(state: GameState, loser: CountryId, winner: CountryId): { state: GameState; ceded: string | null } {
  const mine = Object.entries(state.territories ?? {})
    .filter(([, h]) => h.owner === loser)
    .sort((a, b) => b[1].sinceTick - a[1].sinceTick || a[0].localeCompare(b[0]));
  const pick = mine[0];
  if (!pick) return { state, ceded: null };
  return {
    state: {
      ...state,
      territories: { ...state.territories, [pick[0]]: { owner: winner, sinceTick: state.tick } },
    },
    ceded: pick[0],
  };
}

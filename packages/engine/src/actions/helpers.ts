// Shared helpers for action reducers and tick. Pure utilities only.

import { relationKey } from '../createGame.js';
import type {
  Country,
  CountryId,
  GameState,
  Relation,
  RelationKey,
} from '../types.js';

export function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/** Replace one country in the countries map immutably. */
export function withCountry(state: GameState, country: Country): GameState {
  return {
    ...state,
    countries: { ...state.countries, [country.id]: country },
  };
}

export function withRelation(state: GameState, relation: Relation): GameState {
  const key = relationKey(relation.countryA, relation.countryB);
  return {
    ...state,
    relations: { ...state.relations, [key]: relation },
  };
}

export function getRelation(
  state: GameState,
  a: CountryId,
  b: CountryId,
): Relation | undefined {
  if (a === b) return undefined;
  const key = relationKey(a, b);
  return state.relations[key];
}

export function ensureRelation(
  state: GameState,
  a: CountryId,
  b: CountryId,
): { state: GameState; relation: Relation; key: RelationKey } {
  const key = relationKey(a, b);
  const existing = state.relations[key];
  if (existing) return { state, relation: existing, key };
  const [ca, cb] = a < b ? [a, b] : [b, a];
  const relation: Relation = {
    countryA: ca,
    countryB: cb,
    attitude: 0,
    treaties: [],
    atWar: false,
  };
  return {
    state: { ...state, relations: { ...state.relations, [key]: relation } },
    relation,
    key,
  };
}

/** Get a country by id, throws if missing (only call after validation). */
export function mustCountry(state: GameState, id: CountryId): Country {
  const c = state.countries[id];
  if (!c) throw new Error(`Country not found: ${id}`);
  return c;
}

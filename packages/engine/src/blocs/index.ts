// Bloc politics: NATO-style alliance groups. Phase 3 — Wave 9.
//
// The engine tracks a fixed (scenario-declared) set of blocs. Each bloc has:
//   - a member roster (countries with `country.blocId === bloc.id`)
//   - a leader (highest gdp + military weight) recomputed periodically
//   - a foundedAtTick stamp from scenario.startTick
//
// Membership transitions happen for AI countries only — the player's bloc is
// changed via the explicit `joinBloc` / `leaveBloc` reducers. Defection is
// driven by attitude average toward members of the current bloc: if it falls
// too low for too long, the country leaves the bloc and becomes unaligned.
//
// All Phase 3 fields on GameState are optional. `tickBlocs` is a no-op when
// `state.blocs` is undefined (scenario without blocs).

import type {
  ActiveBlocId,
  Bloc,
  BlocState,
  Country,
  CountryId,
  GameState,
  Scenario,
} from '../types.js';
import { getRelation } from '../actions/helpers.js';

/** How often (in ticks) we recompute leaders for every bloc. */
export const LEADER_RECOMPUTE_INTERVAL_TICKS = 12;

/** Attitude threshold under which an AI country considers leaving its bloc. */
export const DEFECTION_ATTITUDE_THRESHOLD = -20;

/** GDP weight when ranking candidates for bloc leadership. */
const GDP_LEADER_WEIGHT = 1;
/** Military-size weight (per soldier) when ranking leadership candidates. */
const MILITARY_LEADER_WEIGHT_PER_UNIT = 1000;

/**
 * Build the initial BlocState from the scenario declarations. Returns
 * `undefined` when the scenario has no blocs at all (Phase 3 not in use).
 *
 * Members are seeded from `ScenarioBlocInit.foundingMembers`. Leader is
 * either the explicit `leaderCountryId` (if present and a member) or the
 * member ranked top by `gdp + armySize * 1000`. With 0 members → `null`.
 */
export function initBlocs(scenario: Scenario, startTick: number): BlocState | undefined {
  if (!scenario.blocs || scenario.blocs.length === 0) return undefined;

  // First pass: build a country lookup by id from scenario.countries so we
  // can rank candidates without needing GameState yet.
  const countryById = new Map<CountryId, (typeof scenario.countries)[number]>();
  for (const c of scenario.countries) countryById.set(c.id, c);

  const out = {} as BlocState;
  for (const init of scenario.blocs) {
    const members = init.foundingMembers.filter((id) => countryById.has(id));
    let leader: CountryId | null = null;
    if (init.leaderCountryId && members.includes(init.leaderCountryId)) {
      leader = init.leaderCountryId;
    } else if (members.length > 0) {
      let bestScore = -Infinity;
      for (const id of members) {
        const c = countryById.get(id);
        if (!c) continue;
        const score = leaderScoreInit(c.economy.gdp, c.military.armySize);
        if (score > bestScore) {
          bestScore = score;
          leader = id;
        }
      }
    }
    const bloc: Bloc = {
      id: init.id,
      nameKey: init.nameKey,
      leaderCountryId: leader,
      memberCountryIds: members,
      foundedAtTick: startTick,
    };
    out[init.id] = bloc;
  }
  return out;
}

/**
 * Recompute the leader of every bloc using current country state.
 * Pure: returns a new BlocState; never mutates inputs.
 *
 * If a bloc has 0 members → leader stays `null` (no auto-disband, by spec —
 * we want re-population to remain possible).
 */
export function recomputeLeaders(
  blocs: BlocState,
  countries: Record<CountryId, Country>,
): BlocState {
  const out = {} as BlocState;
  for (const id of Object.keys(blocs) as ActiveBlocId[]) {
    const bloc = blocs[id];
    if (!bloc) continue;
    if (bloc.memberCountryIds.length === 0) {
      out[id] = { ...bloc, leaderCountryId: null };
      continue;
    }
    let bestScore = -Infinity;
    let leader: CountryId | null = null;
    for (const memberId of bloc.memberCountryIds) {
      const c = countries[memberId];
      if (!c) continue;
      const score = leaderScoreInit(c.economy.gdp, c.military.armySize);
      if (score > bestScore) {
        bestScore = score;
        leader = memberId;
      }
    }
    out[id] = { ...bloc, leaderCountryId: leader };
  }
  return out;
}

/**
 * Tick the bloc system: every LEADER_RECOMPUTE_INTERVAL_TICKS ticks,
 * recompute leaders for every bloc; on every tick, evaluate AI defections.
 * No-op when `state.blocs` is undefined.
 */
export function tickBlocs(state: GameState): GameState {
  if (!state.blocs) return state;
  let blocs = state.blocs;

  // 1. Periodic leader recompute.
  if (state.tick % LEADER_RECOMPUTE_INTERVAL_TICKS === 0) {
    blocs = recomputeLeaders(blocs, state.countries);
  }

  // 2. Defection check for AI countries only.
  let countriesPatched: Record<CountryId, Country> | null = null;
  for (const id of Object.keys(blocs) as ActiveBlocId[]) {
    const bloc = blocs[id];
    if (!bloc) continue;
    const newMembers: CountryId[] = [];
    let mutated = false;
    for (const memberId of bloc.memberCountryIds) {
      const country = (countriesPatched ?? state.countries)[memberId];
      if (!country) continue;
      // Player country: never auto-defect (player explicitly leaves via leaveBloc).
      if (country.id === state.playerCountryId) {
        newMembers.push(memberId);
        continue;
      }
      // Compute average attitude toward all *other* members in the bloc.
      const others = bloc.memberCountryIds.filter((m) => m !== memberId);
      if (others.length === 0) {
        newMembers.push(memberId);
        continue;
      }
      let total = 0;
      let n = 0;
      for (const otherId of others) {
        const rel = getRelation(state, memberId, otherId);
        if (!rel) continue;
        total += rel.attitude;
        n++;
      }
      const avg = n > 0 ? total / n : 0;
      if (avg <= DEFECTION_ATTITUDE_THRESHOLD) {
        // Defect: remove from bloc & strip blocId on the country.
        if (!countriesPatched) countriesPatched = { ...state.countries };
        const { blocId: _omitted, ...rest } = country;
        void _omitted;
        countriesPatched[memberId] = rest;
        mutated = true;
      } else {
        newMembers.push(memberId);
      }
    }
    if (mutated) {
      blocs = {
        ...blocs,
        [id]: { ...bloc, memberCountryIds: newMembers },
      };
    }
  }

  // 3. After defections, re-run leader recompute if anyone left a bloc this
  //    tick (so we don't carry a stale leader pointer that's no longer a member).
  if (countriesPatched !== null) {
    blocs = recomputeLeaders(blocs, countriesPatched);
  }

  if (countriesPatched === null && blocs === state.blocs) {
    return state;
  }
  return {
    ...state,
    ...(countriesPatched !== null ? { countries: countriesPatched } : {}),
    blocs,
  };
}

/**
 * Helper used by reducers and AI — returns `true` iff `countryId` is currently
 * a member of `blocId` according to the bloc roster (not just the
 * `country.blocId` field, which can lag for one tick).
 */
export function isMemberOf(state: GameState, countryId: CountryId, blocId: ActiveBlocId): boolean {
  const bloc = state.blocs?.[blocId];
  if (!bloc) return false;
  return bloc.memberCountryIds.includes(countryId);
}

function leaderScoreInit(gdp: number, armySize: number): number {
  return gdp * GDP_LEADER_WEIGHT + armySize * MILITARY_LEADER_WEIGHT_PER_UNIT;
}

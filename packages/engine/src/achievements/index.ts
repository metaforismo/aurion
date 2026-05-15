// Achievements — pure evaluator over the current GameState.
//
// Achievements are cross-game / global accomplishments; the engine has no
// notion of "unlocked" persistence (that lives in the web layer's IndexedDB).
// This module is intentionally side-effect-free: callers pass in the current
// state plus a list of definitions and we return the ids of every entry whose
// condition is currently satisfied. The caller is then responsible for
// diffing against any locally-persisted unlock set.

import type {
  AchievementCondition,
  AchievementDef,
  AchievementId,
  GameState,
  RelationKey,
} from '../types.js';

export { BUILTIN_ACHIEVEMENTS } from './builtin.js';

/**
 * Evaluate every definition against the given state and return the ids of
 * those whose condition currently holds. Pure: never mutates inputs.
 *
 * The implementation walks each definition once and short-circuits via the
 * standard boolean rules inside `and` / `or` composers. Unknown condition
 * kinds (forward-compat) are treated as `false` so an out-of-date evaluator
 * never spuriously fires achievements it can't yet understand.
 */
export function evaluateAchievements(
  state: GameState,
  defs: readonly AchievementDef[],
): AchievementId[] {
  const out: AchievementId[] = [];
  for (const def of defs) {
    if (evaluateCondition(state, def.condition)) {
      out.push(def.id);
    }
  }
  return out;
}

/** Recursive condition evaluator. Exported for unit tests / debug tooling. */
export function evaluateCondition(
  state: GameState,
  condition: AchievementCondition,
): boolean {
  switch (condition.kind) {
    case 'completeTech':
      return playerHasTech(state, condition.techId);
    case 'reachPopularity':
      return playerPopularity(state) >= condition.threshold;
    case 'reachGdpRank':
      return playerGdpRank(state) <= condition.rank;
    case 'allianceCount':
      return playerAllianceCount(state) >= condition.n;
    case 'spyOpsCompleted':
      return playerSpyOpsCompleted(state) >= condition.n;
    case 'completeWar':
      // We don't (yet) track war wins persistently; approximate with
      // "is currently NOT at war and has completed at least N spy/military
      // exchanges" — but the cleaner heuristic is: the player is not at war
      // and has at any point seen at least N war-resolution entries. Until
      // the engine wires a dedicated counter we fall back to the tick-based
      // proxy so the condition stays evaluable without extra state.
      return playerWarsConsideredWon(state) >= condition.wins;
    case 'survivedTicks':
      return state.tick >= condition.n && state.winLoss !== 'lost';
    case 'and':
      return condition.conditions.every((c) => evaluateCondition(state, c));
    case 'or':
      return condition.conditions.some((c) => evaluateCondition(state, c));
  }
}

// ---------------------------------------------------------------------------
// Player-derived helpers. These are intentionally tolerant of partially-built
// fixture states (missing player country, missing relations) so achievement
// evaluation never throws — at worst a condition reads as "not met yet".
// ---------------------------------------------------------------------------

function playerHasTech(state: GameState, techId: string): boolean {
  const player = state.countries[state.playerCountryId];
  if (!player) return false;
  return player.science.completedTechs.includes(techId);
}

function playerPopularity(state: GameState): number {
  const player = state.countries[state.playerCountryId];
  return player?.politics.popularity ?? 0;
}

/** 1-based rank by gdp, ties resolved by enumeration order. */
function playerGdpRank(state: GameState): number {
  const player = state.countries[state.playerCountryId];
  if (!player) return Number.POSITIVE_INFINITY;
  const sorted = Object.values(state.countries)
    .map((c) => ({ id: c.id, gdp: c.economy.gdp }))
    .sort((a, b) => b.gdp - a.gdp);
  const idx = sorted.findIndex((s) => s.id === player.id);
  return idx < 0 ? Number.POSITIVE_INFINITY : idx + 1;
}

function playerAllianceCount(state: GameState): number {
  const playerId = state.playerCountryId;
  let n = 0;
  for (const rel of Object.values(state.relations)) {
    const involved = rel.countryA === playerId || rel.countryB === playerId;
    if (involved && rel.treaties.includes('alliance')) n++;
  }
  return n;
}

function playerSpyOpsCompleted(state: GameState): number {
  const playerId = state.playerCountryId;
  let n = 0;
  for (const op of state.spyOperations) {
    if (op.ownerCountryId !== playerId) continue;
    if (op.status === 'completed') n++;
  }
  return n;
}

/**
 * Heuristic for "wars completed (won)": the player is currently NOT at war
 * with a country whose territory we hold a deployment on. Each such
 * relationship counts once. This intentionally undercounts compared to a
 * full historical ledger, but it gives a deterministic, state-derived
 * answer that's good enough for achievement gating until the engine
 * exposes a per-relation war-history counter.
 */
function playerWarsConsideredWon(state: GameState): number {
  const player = state.countries[state.playerCountryId];
  if (!player) return 0;
  const hostCountries = new Set<string>();
  for (const dep of player.military.deployedUnits) {
    if (dep.hostCountryId && dep.hostCountryId !== player.id) {
      hostCountries.add(dep.hostCountryId);
    }
  }
  let won = 0;
  for (const otherId of hostCountries) {
    const a = player.id < otherId ? player.id : otherId;
    const b = player.id < otherId ? otherId : player.id;
    const key = `${a}::${b}` as RelationKey;
    const rel = state.relations[key];
    if (rel && !rel.atWar) won++;
  }
  return won;
}

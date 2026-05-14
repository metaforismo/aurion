// Win/Loss evaluation. Pure given input state.

import { getStreaks, withStreaks } from './internal.js';
import type {
  Country,
  GameState,
  Scenario,
  VictoryRule,
  WinLossState,
} from './types.js';

export const LOSS_LOW_POPULARITY_WEEKS = 12;
export const LOSS_NEGATIVE_TREASURY_WEEKS = 26;
export const LOSS_CAPITAL_OCCUPIED_WEEKS = 4;
export const LOSS_ALL_FACTIONS_ANGRY_WEEKS = 6;

const ALL_FACTIONS_ANGRY_THRESHOLD = 20;
const LOW_POP_THRESHOLD = 10;

/**
 * Update the win/loss streaks from current state, decide the WinLossState,
 * and return a new state with the updated streaks attached and `winLoss` set.
 *
 * The optional `victoryRule` lets callers supply the rule from the scenario;
 * when omitted, we look up the matching scenario victory in `state` lazily.
 * In the engine we don't keep the scenario, so callers (tick) pass the rule.
 */
export function checkWinLoss(state: GameState, victoryRule?: VictoryRule): GameState {
  const player = state.countries[state.playerCountryId];
  if (!player) return { ...state, winLoss: state.winLoss };

  const prev = getStreaks(state);
  const next = { ...prev };

  // 1. Low popularity streak.
  next.lowPopularityWeeks =
    player.politics.popularity < LOW_POP_THRESHOLD ? prev.lowPopularityWeeks + 1 : 0;

  // 2. Negative treasury streak.
  next.negativeTreasuryWeeks =
    player.economy.treasury < 0 ? prev.negativeTreasuryWeeks + 1 : 0;

  // 3. Enemy occupies our capital region.
  next.capitalOccupiedWeeks = isCapitalOccupiedByEnemy(state, player)
    ? prev.capitalOccupiedWeeks + 1
    : 0;

  // 4. All factions satisfaction < threshold simultaneously.
  const allAngry = Object.values(player.politics.factions).every(
    (f) => f.satisfaction < ALL_FACTIONS_ANGRY_THRESHOLD,
  );
  next.allFactionsAngryWeeks = allAngry ? prev.allFactionsAngryWeeks + 1 : 0;

  let winLoss: WinLossState = state.winLoss;
  if (winLoss === 'playing') {
    if (
      next.lowPopularityWeeks >= LOSS_LOW_POPULARITY_WEEKS ||
      next.negativeTreasuryWeeks >= LOSS_NEGATIVE_TREASURY_WEEKS ||
      next.capitalOccupiedWeeks >= LOSS_CAPITAL_OCCUPIED_WEEKS ||
      next.allFactionsAngryWeeks >= LOSS_ALL_FACTIONS_ANGRY_WEEKS
    ) {
      winLoss = 'lost';
    } else if (victoryRule && evaluateVictory(state, victoryRule)) {
      winLoss = 'won';
    }
  }

  const withStreaksState = withStreaks(state, next);
  return { ...withStreaksState, winLoss };
}

function isCapitalOccupiedByEnemy(state: GameState, player: Country): boolean {
  const region = player.regionId;
  for (const other of Object.values(state.countries)) {
    if (other.id === player.id) continue;
    // Only enemies (at war) count as "occupying" — neighbours can have units
    // in shared regions in peacetime without it being a capital occupation.
    const key = other.id < player.id
      ? `${other.id}::${player.id}`
      : `${player.id}::${other.id}`;
    const rel = state.relations[key as keyof typeof state.relations];
    if (!rel?.atWar) continue;
    for (const dep of other.military.deployedUnits) {
      if (dep.regionId === region && dep.units > 0) return true;
    }
  }
  return false;
}

export function evaluateVictory(state: GameState, rule: VictoryRule): boolean {
  switch (rule.kind) {
    case 'gdpRank': {
      const player = state.countries[state.playerCountryId];
      if (!player) return false;
      const sorted = Object.values(state.countries)
        .map((c) => ({ id: c.id, gdp: c.economy.gdp }))
        .sort((a, b) => b.gdp - a.gdp);
      const playerIdx = sorted.findIndex((s) => s.id === player.id);
      if (playerIdx < 0) return false;
      return playerIdx + 1 <= rule.rankAtMost;
    }
    case 'controlNCountries': {
      // Count countries we have an alliance treaty with + ourselves.
      const player = state.playerCountryId;
      let n = 1;
      for (const rel of Object.values(state.relations)) {
        const involved = rel.countryA === player || rel.countryB === player;
        if (involved && rel.treaties.includes('alliance')) n++;
      }
      return n >= rule.n;
    }
    case 'completeTech': {
      const player = state.countries[state.playerCountryId];
      if (!player) return false;
      return player.science.completedTechs.includes(rule.techId);
    }
    case 'allianceCoverage': {
      const player = state.playerCountryId;
      const total = Object.keys(state.countries).length - 1;
      if (total <= 0) return false;
      let allied = 0;
      for (const rel of Object.values(state.relations)) {
        const involved = rel.countryA === player || rel.countryB === player;
        if (involved && rel.treaties.includes('alliance')) allied++;
      }
      return (allied / total) * 100 >= rule.minPercent;
    }
    case 'and':
      return rule.rules.every((r) => evaluateVictory(state, r));
    case 'or':
      return rule.rules.some((r) => evaluateVictory(state, r));
  }
}

/** Convenience helper used when callers only have a Scenario in hand. */
export function checkWinLossWithScenario(state: GameState, scenario: Scenario): GameState {
  const def = scenario.victoryConditions.find((v) => v.id === state.selectedVictoryCondition);
  return checkWinLoss(state, def?.rule);
}

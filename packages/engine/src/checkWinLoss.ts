// Win/Loss evaluation. Pure given input state.

import {
  getDethroneStreaks,
  getStreaks,
  withDethroneStreaks,
  withStreaks,
} from './internal.js';
import type {
  ActiveBlocId,
  Country,
  DifficultyTuning,
  Era,
  GameState,
  Scenario,
  VictoryRule,
  WinLossState,
} from './types.js';

// Weeks each loss condition must persist before the game ends.
// Tuned so the player has time to notice the trouble and react.
export const LOSS_LOW_POPULARITY_WEEKS = 12;
export const LOSS_NEGATIVE_TREASURY_WEEKS = 26;
export const LOSS_CAPITAL_OCCUPIED_WEEKS = 26;
export const LOSS_ALL_FACTIONS_ANGRY_WEEKS = 12;

/** Dethrone-mode: weeks out of GDP top-3 before game over. */
export const DETHRONE_OUT_OF_TOP3_WEEKS = 260;

/** Dethrone-mode: weeks of isolation (rep < -50 in all blocs) before game over. */
export const DETHRONE_ISOLATION_WEEKS = 260;

/** Reputation threshold below which the player is "isolated" in a bloc. */
export const DETHRONE_ISOLATION_REP_THRESHOLD = -50;

const ALL_FACTIONS_ANGRY_THRESHOLD = 20;
const LOW_POP_THRESHOLD = 10;

/**
 * Update the win/loss streaks from current state, decide the WinLossState,
 * and return a new state with the updated streaks attached and `winLoss` set.
 *
 * The optional `victoryRule` lets callers supply the rule from the scenario;
 * when omitted, we look up the matching scenario victory in `state` lazily.
 * In the engine we don't keep the scenario, so callers (tick) pass the rule.
 *
 * The optional `difficulty` scales the four LOSS_*_WEEKS thresholds by
 * `modifiers.lossToleranceWeeks`. Easy uses >1 (more forgiving), Hard <1.
 *
 * `dethroneIsolationEnabled` (Phase 3) controls whether the isolation streak
 * is armed as a loss trigger. Defaults to false — only scenarios that opt in
 * via `scenario.dethroneIsolationOnByDefault` enable it.
 *
 * `eras` (Phase 3 Wave 10) is the scenario's era schedule. When the player
 * is in `gameMode === 'era-paced'` AND `state.tick` has reached the LAST
 * era's `endTick`, the run is treated as completed and `winLoss = 'won'`.
 * Loss conditions still apply normally (the player can lose mid-era).
 */
export function checkWinLoss(
  state: GameState,
  victoryRule?: VictoryRule,
  difficulty?: DifficultyTuning,
  dethroneIsolationEnabled = false,
  eras?: readonly Era[],
): GameState {
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

  // Difficulty-scaled thresholds (multiply at the comparison site, not the
  // constants themselves — keeps the constants the canonical baseline).
  const tolerance = difficulty?.modifiers.lossToleranceWeeks ?? 1;
  const popThr = LOSS_LOW_POPULARITY_WEEKS * tolerance;
  const treasuryThr = LOSS_NEGATIVE_TREASURY_WEEKS * tolerance;
  const capitalThr = LOSS_CAPITAL_OCCUPIED_WEEKS * tolerance;
  const factionsThr = LOSS_ALL_FACTIONS_ANGRY_WEEKS * tolerance;

  let winLoss: WinLossState = state.winLoss;
  let withStreaksState = withStreaks(state, next);

  // Dethrone mode: maintain GDP-top3 / isolation streaks regardless of win
  // outcome so the HUD can show "x weeks until dethroned" warnings. Losses
  // from these streaks DO trigger in eternal mode (only victories are deferred).
  if (state.gameMode === 'dethrone') {
    withStreaksState = updateDethroneStreaks(withStreaksState);
  }

  if (winLoss === 'playing') {
    // Loss conditions are checked regardless of game mode.
    if (
      next.lowPopularityWeeks >= popThr ||
      next.negativeTreasuryWeeks >= treasuryThr ||
      next.capitalOccupiedWeeks >= capitalThr ||
      next.allFactionsAngryWeeks >= factionsThr
    ) {
      winLoss = 'lost';
    } else if (
      state.gameMode === 'dethrone' &&
      isDethroneLoss(withStreaksState, dethroneIsolationEnabled)
    ) {
      winLoss = 'lost';
    } else if (
      state.gameMode === 'era-paced' &&
      eras &&
      eras.length > 0 &&
      isFinalEraComplete(state, eras)
    ) {
      // Era-paced narrative end: player has reached the END of the last
      // declared era. The run is recognised as a win regardless of the
      // selected victory condition (it's a chapter-completion victory).
      winLoss = 'won';
    } else if (victoryRule && evaluateVictory(state, victoryRule)) {
      // Eternal mode: victories accumulate in `unlockedVictories` instead of
      // ending the game. The tick step handles the tracking; here we just
      // refrain from setting winLoss. Era-paced doesn't suppress
      // intermediate victories — the chapter end overrides them above.
      if (state.gameMode !== 'eternal') {
        winLoss = 'won';
      }
    }
  }

  return { ...withStreaksState, winLoss };
}

/**
 * Returns true when `gameMode === 'era-paced'` AND `state.tick` has reached
 * (or passed) the endTick of the LAST era in the scenario. Pure helper.
 */
function isFinalEraComplete(state: GameState, eras: readonly Era[]): boolean {
  const lastEra = eras[eras.length - 1];
  if (!lastEra) return false;
  return state.tick >= lastEra.endTick;
}

/**
 * Update the dethrone streak counters from current state. Pure: returns a
 * new state with the streaks attached.
 */
function updateDethroneStreaks(state: GameState): GameState {
  const prev = getDethroneStreaks(state);
  const next = { ...prev };

  // Out-of-top3 streak: consecutive ticks player is NOT in GDP top 3.
  const sortedGdp = Object.values(state.countries)
    .map((c) => ({ id: c.id, gdp: c.economy.gdp }))
    .sort((a, b) => b.gdp - a.gdp);
  const playerIdx = sortedGdp.findIndex((s) => s.id === state.playerCountryId);
  const inTop3 = playerIdx >= 0 && playerIdx < 3;
  next.outOfTop3Weeks = inTop3 ? 0 : prev.outOfTop3Weeks + 1;

  // Isolation streak: rep < -50 in all blocs simultaneously.
  if (state.reputation) {
    const blocIds = Object.keys(state.reputation) as ActiveBlocId[];
    if (blocIds.length === 0) {
      next.isolationWeeks = 0;
    } else {
      const allBelow = blocIds.every(
        (id) => (state.reputation?.[id] ?? 0) < DETHRONE_ISOLATION_REP_THRESHOLD,
      );
      next.isolationWeeks = allBelow ? prev.isolationWeeks + 1 : 0;
    }
  } else {
    next.isolationWeeks = 0;
  }

  return withDethroneStreaks(state, next);
}

function isDethroneLoss(state: GameState, isolationEnabled: boolean): boolean {
  if (state.gameMode !== 'dethrone') return false;
  const streaks = getDethroneStreaks(state);
  if (streaks.outOfTop3Weeks >= DETHRONE_OUT_OF_TOP3_WEEKS) return true;
  if (
    isolationEnabled &&
    state.reputation &&
    streaks.isolationWeeks >= DETHRONE_ISOLATION_WEEKS
  ) {
    return true;
  }
  return false;
}

/**
 * The player capital region is "occupied" only if a hostile power has visibly
 * landed forces there AND the player can no longer defend it — i.e. the
 * enemy out-deployed garrison strength in the region. Two countries sharing
 * a region in peacetime (or during a war where the player still has a strong
 * local garrison) do NOT count as occupation. This keeps the loss condition
 * meaningful (you need to actually lose the city) instead of triggering on
 * the first hostile unit movement.
 */
function isCapitalOccupiedByEnemy(state: GameState, player: Country): boolean {
  const region = player.regionId;
  // Sum hostile deployments in the region.
  let hostileUnits = 0;
  for (const other of Object.values(state.countries)) {
    if (other.id === player.id) continue;
    const key = other.id < player.id
      ? `${other.id}::${player.id}`
      : `${player.id}::${other.id}`;
    const rel = state.relations[key as keyof typeof state.relations];
    if (!rel?.atWar) continue;
    for (const dep of other.military.deployedUnits) {
      if (dep.regionId === region) hostileUnits += dep.units;
    }
  }
  if (hostileUnits <= 0) return false;
  // Sum player's defenders: home garrison (armySize) + any deployments in own region.
  let defenders = player.military.armySize;
  for (const dep of player.military.deployedUnits) {
    if (dep.regionId === region) defenders += dep.units;
  }
  // Capital is considered overrun only if hostile units outnumber the defense.
  return hostileUnits > defenders;
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
  return checkWinLoss(
    state,
    def?.rule,
    undefined,
    scenario.dethroneIsolationOnByDefault === true,
    scenario.eras,
  );
}

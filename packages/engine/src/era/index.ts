// Era-paced mode runtime. Phase 3 — Wave 10.
//
// When the player chooses `gameMode === 'era-paced'` AND the scenario declares
// an `eras: Era[]` schedule, the engine:
//
//   1. Initializes `state.eraState` at game start (currentEraIndex 0, no
//      pending transition, empty completedEraIds list).
//   2. On every tick, checks whether `state.tick` has reached the end of the
//      current era. If so, fires a "transition" by setting
//      `state.eraState.pendingTransition` (with stats snapshot) and advancing
//      `currentEraIndex`.
//   3. The UI observes `pendingTransition !== null`, shows a celebratory
//      chapter modal, and dispatches `acknowledgeEraTransition` to clear it.
//
// Transitions are AUTO-fired by the engine. The engine itself does NOT pause
// the simulation — pausing is the UI's responsibility (the HUD ticker checks
// `state.eraState.pendingTransition !== null` and stops feeding ticks).
//
// All era functions are pure: they return a new GameState slice and never
// mutate inputs. When the scenario has no eras OR gameMode is not 'era-paced',
// `state.eraState` stays undefined and `tickEra` is a no-op.

import type {
  CumulativeStats,
  Era,
  EraRuntimeState,
  GameMode,
  GameState,
  Scenario,
} from '../types.js';

/**
 * Default stats snapshot when the player's gameMode doesn't track cumulative
 * stats. Era-paced always tracks them (createGame initializes them for all
 * non-classic modes), but we keep this fallback so the snapshot field is
 * always shaped, never undefined.
 */
function emptyStatsSnapshot(): CumulativeStats {
  return {
    peakGdpRank: 999,
    peakTreasury: 0,
    totalTechsUnlocked: 0,
    totalReputationGained: 0,
    totalSpyOpsCompleted: 0,
    totalTicksPlayed: 0,
  };
}

/**
 * Build the initial era runtime state. Returns `undefined` when the system
 * is inactive (gameMode !== 'era-paced' or scenario has no eras), which keeps
 * `state.eraState` absent on saves that don't use the system.
 *
 * `startTick` is reserved for future use (e.g. resume mid-era from a save
 * that pre-dates Wave 10). Today, `currentEraIndex` always starts at 0 — the
 * caller is responsible for invoking this only at game creation.
 */
export function initEraState(
  scenario: Scenario,
  gameMode: GameMode | undefined,
  _startTick: number,
): EraRuntimeState | undefined {
  if (gameMode !== 'era-paced') return undefined;
  const eras = scenario.eras;
  if (!eras || eras.length === 0) return undefined;
  return {
    currentEraIndex: 0,
    completedEraIds: [],
    pendingTransition: null,
  };
}

/**
 * Tick the era system. No-op when:
 *   - state.eraState is undefined (system not in use)
 *   - scenario has no eras (defensive — should match initEraState's guard)
 *   - a transition is already pending (don't re-fire while UI is showing modal)
 *   - we're already past the LAST era (no further transitions to fire)
 *
 * When `state.tick >= scenario.eras[currentEraIndex].endTick` for the active
 * era, set `pendingTransition` (with snapshot of cumulativeStats), append the
 * current era id to `completedEraIds`, and bump `currentEraIndex` by one.
 *
 * If the player has NOT acknowledged a previous transition (still pending),
 * we do NOT fire another one — the UI is still showing the previous modal.
 * This is the "transition through multiple era boundaries while paused" case
 * which is bounded by the modal.
 */
export function tickEra(state: GameState, scenario: Scenario): GameState {
  const eraState = state.eraState;
  if (!eraState) return state;
  const eras = scenario.eras;
  if (!eras || eras.length === 0) return state;

  // Already showing a modal — don't queue another transition until the UI
  // acknowledges. This prevents back-to-back modals if ticks somehow advance
  // (e.g. the UI didn't actually pause).
  if (eraState.pendingTransition !== null) return state;

  // Already past the final era — never fire again. This handles the "ran past
  // the last era's endTick" edge case: the game stays in 'won' state by
  // checkWinLoss, but if the final transition was already fired+acknowledged
  // we don't want to keep advancing currentEraIndex.
  if (eraState.currentEraIndex >= eras.length) return state;

  const currentEra: Era | undefined = eras[eraState.currentEraIndex];
  if (!currentEra) return state;

  if (state.tick < currentEra.endTick) return state;

  // Fire the transition. The next era's id (if any) is the toEraId; if we're
  // on the final era, toEraId === currentEra.id (no "next" — the UI shows a
  // chapter-end / game-complete screen and checkWinLoss will mark winLoss).
  const nextIdx = eraState.currentEraIndex + 1;
  const nextEra: Era | undefined = eras[nextIdx];
  const statsSnapshot: CumulativeStats =
    state.cumulativeStats ?? emptyStatsSnapshot();

  const updated: EraRuntimeState = {
    currentEraIndex: nextIdx < eras.length ? nextIdx : eraState.currentEraIndex,
    completedEraIds: eraState.completedEraIds.includes(currentEra.id)
      ? eraState.completedEraIds
      : [...eraState.completedEraIds, currentEra.id],
    pendingTransition: {
      fromEraId: currentEra.id,
      toEraId: nextEra ? nextEra.id : currentEra.id,
      ticksAtTransition: state.tick,
      statsSnapshot,
    },
  };

  return { ...state, eraState: updated };
}

/**
 * Clear `pendingTransition`. Called by the `acknowledgeEraTransition` action
 * reducer once the UI has shown the chapter modal. Returns the state
 * unchanged if there is nothing to acknowledge — the reducer surfaces an
 * error in that case rather than silently no-oping.
 */
export function acknowledgeTransition(state: GameState): GameState {
  const eraState = state.eraState;
  if (!eraState || eraState.pendingTransition === null) return state;
  const updated: EraRuntimeState = {
    ...eraState,
    pendingTransition: null,
  };
  return { ...state, eraState: updated };
}

/**
 * Helper: returns the index of the LAST era in the scenario, or -1 when
 * eras are absent. Used by checkWinLoss to decide whether passing the era
 * boundary should also end the game.
 */
export function lastEraIndex(scenario: Scenario): number {
  const eras = scenario.eras;
  if (!eras || eras.length === 0) return -1;
  return eras.length - 1;
}

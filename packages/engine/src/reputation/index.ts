// Per-bloc reputation system. Pure functions. Phase 3 — Wave 9.
//
// Reputation is a -100..+100 scalar tracked PER active bloc for the player
// country. Other countries don't have explicit reputation; their attitudes
// (per-pair Relation.attitude) already carry that information.
//
// The system has two moving parts:
//   1. `pendingReputationDeltas`: a bounded queue of unapplied deltas
//      attached to GameState. Action reducers and event handlers push into
//      this queue via `queueReputationDelta`.
//   2. The tick step (`tickReputation`) drains the queue, sums the deltas
//      into `reputation[bloc]`, applies a tiny decay toward 0, and clamps
//      to [-100, +100].
//
// Initialisation: reputation is only initialised when the scenario declares
// at least one bloc. Otherwise the field stays `undefined` and the tick step
// is a no-op (slim state for scenarios that don't use Phase 3).

import type {
  ActiveBlocId,
  BlocId,
  GameState,
  ReputationByBloc,
  ReputationDelta,
  Scenario,
} from '../types.js';

/** Hard cap on the pending-delta queue to avoid unbounded growth. */
export const MAX_PENDING_DELTAS = 50;

/** Per-tick decay applied toward 0 (per bloc). */
export const REPUTATION_DECAY_PER_TICK = 0.5;

/** Inclusive lower/upper bounds for any per-bloc reputation value. */
export const REPUTATION_MIN = -100;
export const REPUTATION_MAX = 100;

/**
 * Build the initial `ReputationByBloc` map from the blocs declared in the
 * scenario. Returns `undefined` when the scenario has no blocs at all so
 * the GameState stays slim.
 */
export function initReputation(scenario: Scenario): ReputationByBloc | undefined {
  if (!scenario.blocs || scenario.blocs.length === 0) return undefined;
  // Initialise every active bloc to neutral 0.
  const out = {} as ReputationByBloc;
  for (const b of scenario.blocs) {
    out[b.id] = 0;
  }
  return out;
}

/**
 * Append a delta to `state.pendingReputationDeltas`. Caps the queue length to
 * `MAX_PENDING_DELTAS` (oldest dropped if exceeded) so a runaway producer
 * cannot bloat the save.
 *
 * No-op if the scenario has no blocs (`state.reputation === undefined`).
 * No-op if the targeted bloc is `unaligned` (sentinel sink) — preserved as a
 * convenience so callers don't have to filter.
 */
export function queueReputationDelta(state: GameState, delta: ReputationDelta): GameState {
  if (!state.reputation) return state;
  if (delta.bloc === 'unaligned') return state;
  const queue = state.pendingReputationDeltas ?? [];
  const next = [...queue, delta];
  // Drop oldest entries first (FIFO ring) to keep length bounded.
  const trimmed = next.length > MAX_PENDING_DELTAS ? next.slice(next.length - MAX_PENDING_DELTAS) : next;
  return { ...state, pendingReputationDeltas: trimmed };
}

/**
 * Apply pending deltas to `reputation`, then decay each bloc value toward 0
 * by `REPUTATION_DECAY_PER_TICK`. Clamps every result to [-100, +100].
 *
 * Pure: returns a new GameState; never mutates inputs. No-op when
 * `state.reputation` is undefined (scenario has no blocs).
 */
export function tickReputation(state: GameState): GameState {
  if (!state.reputation) return state;
  // Start from a shallow copy so we can mutate locally.
  const updated: ReputationByBloc = { ...state.reputation };
  const pending = state.pendingReputationDeltas ?? [];

  // 1. Apply each pending delta. Skip 'unaligned' (sink).
  for (const d of pending) {
    if (d.bloc === 'unaligned') continue;
    const blocId = d.bloc as ActiveBlocId;
    const current = updated[blocId];
    if (current === undefined) continue; // bloc not in scenario → ignore gracefully
    updated[blocId] = clampReputation(current + d.delta);
  }

  // 2. Decay every bloc value toward 0 by a small constant. We decay AFTER
  //    applying deltas so a delta in the same tick is felt fully before the
  //    drift starts to erode it.
  for (const blocId of Object.keys(updated) as ActiveBlocId[]) {
    const v = updated[blocId];
    if (v === undefined) continue;
    updated[blocId] = clampReputation(decayToward(v, 0, REPUTATION_DECAY_PER_TICK));
  }

  return {
    ...state,
    reputation: updated,
    // Drain the queue regardless of whether any delta hit a known bloc.
    pendingReputationDeltas: [],
  };
}

/** Clamp a number to [REPUTATION_MIN, REPUTATION_MAX]. Exported for tests. */
export function clampReputation(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < REPUTATION_MIN) return REPUTATION_MIN;
  if (value > REPUTATION_MAX) return REPUTATION_MAX;
  return value;
}

/**
 * Move `value` toward `target` by at most `step`. Used for the gentle decay
 * back to neutral every tick.
 */
export function decayToward(value: number, target: number, step: number): number {
  if (value === target) return target;
  const diff = target - value;
  if (Math.abs(diff) <= step) return target;
  return value + Math.sign(diff) * step;
}

/**
 * Convenience helper for action reducers: build a delta describing a single
 * cause and queue it. Caller passes only the meaningful fields; the engine
 * stamps the queuedAtTick from `state.tick`.
 */
export function pushReputationCause(
  state: GameState,
  bloc: BlocId,
  delta: number,
  reasonKey: string,
): GameState {
  return queueReputationDelta(state, {
    bloc,
    delta,
    reasonKey,
    queuedAtTick: state.tick,
  });
}

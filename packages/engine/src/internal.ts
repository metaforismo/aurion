// Internal augmentation of GameState with engine-private fields. We don't add
// these to types.ts (the public contract) — they're prefixed with `_` and only
// touched by tick.ts / checkWinLoss.ts. They survive structural typing so the
// state can still be passed everywhere as GameState, including JSON-serialized
// to disk.

import type { GameState } from './types.js';

export type LoseStreaks = {
  lowPopularityWeeks: number;
  negativeTreasuryWeeks: number;
  capitalOccupiedWeeks: number;
  allFactionsAngryWeeks: number;
};

export type InternalState = GameState & {
  _loseStreaks?: LoseStreaks;
};

export function getStreaks(state: GameState): LoseStreaks {
  const s = state as InternalState;
  return (
    s._loseStreaks ?? {
      lowPopularityWeeks: 0,
      negativeTreasuryWeeks: 0,
      capitalOccupiedWeeks: 0,
      allFactionsAngryWeeks: 0,
    }
  );
}

export function withStreaks(state: GameState, streaks: LoseStreaks): GameState {
  const next: InternalState = { ...(state as InternalState), _loseStreaks: streaks };
  return next;
}

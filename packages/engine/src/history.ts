// Run history — a light, bounded record of how the player's nation changed
// over time, for the statistics view and the end screen.
//
// One sample every `HISTORY_INTERVAL_TICKS`. When the buffer is full every
// other sample is dropped and the interval effectively doubles for the older
// half, so a very long game keeps its whole arc in a fixed amount of memory.

import type { GameState, HistorySample } from './types.js';

export const HISTORY_INTERVAL_TICKS = 4;
export const HISTORY_LIMIT = 240;

export function sampleOf(state: GameState): HistorySample | null {
  const player = state.countries[state.playerCountryId];
  if (!player) return null;
  let rank = 1;
  for (const c of Object.values(state.countries)) {
    if (c.id !== player.id && c.economy.gdp > player.economy.gdp) rank += 1;
  }
  return {
    tick: state.tick,
    gdp: player.economy.gdp,
    treasury: player.economy.treasury,
    popularity: player.politics.popularity,
    kardashev: state.cosmos?.kardashev ?? 0,
    rank,
  };
}

export function tickHistory(state: GameState): GameState {
  if (state.tick % HISTORY_INTERVAL_TICKS !== 0) return state;
  const sample = sampleOf(state);
  if (!sample) return state;
  let history = [...(state.history ?? []), sample];
  if (history.length > HISTORY_LIMIT) {
    // Thin the older half, keep recent detail.
    const half = Math.floor(history.length / 2);
    history = [...history.slice(0, half).filter((_, i) => i % 2 === 0), ...history.slice(half)];
  }
  return { ...state, history };
}

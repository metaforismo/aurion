'use client';

// Session-only income history. The engine keeps no time series, so this
// module listens to the store and remembers the last two years of weekly
// income for the running game — whichever panel is open — so the Economy
// panel can draw a real trend the moment it is opened.

import { useSyncExternalStore } from 'react';

import { useGameStore } from '../../../lib/store';

export type IncomeSample = { tick: number; income: number };

const MAX_SAMPLES = 104;
const EMPTY: readonly IncomeSample[] = Object.freeze([]);

let samples: readonly IncomeSample[] = EMPTY;
let recordedSave: string | null = null;
const listeners = new Set<() => void>();

function record(): void {
  const { state, saveId } = useGameStore.getState();
  const player = state?.countries[state.playerCountryId];
  if (!state || !player) return;
  const last = samples[samples.length - 1];
  // A different save, or a load that went back in time, starts a new series.
  if (saveId !== recordedSave || (last && state.tick < last.tick)) {
    samples = EMPTY;
    recordedSave = saveId;
  } else if (last && last.tick === state.tick) {
    return;
  }
  // Week 0 still carries the scenario's hand-written income, not a computed one.
  if (state.tick === 0) return;
  samples = [...samples, { tick: state.tick, income: player.economy.weeklyIncome }].slice(-MAX_SAMPLES);
  for (const notify of listeners) notify();
}

if (typeof window !== 'undefined') {
  record();
  useGameStore.subscribe(record);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Weekly income samples for the running game, oldest first. */
export function useIncomeHistory(): readonly IncomeSample[] {
  return useSyncExternalStore(
    subscribe,
    () => samples,
    () => EMPTY,
  );
}

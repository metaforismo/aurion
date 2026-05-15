import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import {
  MAX_PENDING_DELTAS,
  REPUTATION_DECAY_PER_TICK,
  clampReputation,
  decayToward,
  initReputation,
  pushReputationCause,
  queueReputationDelta,
  tickReputation,
} from '../src/reputation/index.js';
import { makePhase3Scenario, makeScenario } from './fixtures.js';

describe('reputation: init', () => {
  it('returns undefined when scenario has no blocs', () => {
    expect(initReputation(makeScenario())).toBeUndefined();
  });

  it('returns a zeroed map for every declared bloc', () => {
    const rep = initReputation(makePhase3Scenario());
    expect(rep).toEqual({ western: 0, eastern: 0 });
  });
});

describe('reputation: queue + tick', () => {
  const scenario = makePhase3Scenario();
  const baseState = createGame(scenario, {
    seed: 'rep',
    victory: 'economic',
    playerCountryId: 'aurion',
  });

  it('queueReputationDelta appends to pendingReputationDeltas', () => {
    const next = queueReputationDelta(baseState, {
      bloc: 'western',
      delta: 10,
      reasonKey: 'rep.reason.test',
      queuedAtTick: 0,
    });
    expect(next.pendingReputationDeltas?.length).toBe(1);
  });

  it('queue is no-op when scenario has no blocs', () => {
    const noBlocsState = createGame(makeScenario(), {
      seed: 'noblocs',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    const next = queueReputationDelta(noBlocsState, {
      bloc: 'western',
      delta: 10,
      reasonKey: 'rep.reason.test',
      queuedAtTick: 0,
    });
    expect(next.reputation).toBeUndefined();
    expect(next.pendingReputationDeltas).toBeUndefined();
  });

  it('queue ignores unaligned-targeted deltas', () => {
    const next = queueReputationDelta(baseState, {
      bloc: 'unaligned',
      delta: 10,
      reasonKey: 'rep.reason.test',
      queuedAtTick: 0,
    });
    expect(next.pendingReputationDeltas?.length ?? 0).toBe(0);
  });

  it('tickReputation applies pending deltas then decays', () => {
    let s = pushReputationCause(baseState, 'western', 20, 'rep.reason.test');
    s = tickReputation(s);
    // Decay 0.5 toward 0 from +20 = +19.5
    expect(s.reputation?.western).toBe(20 - REPUTATION_DECAY_PER_TICK);
    expect(s.pendingReputationDeltas).toEqual([]);
  });

  it('tickReputation clamps at +/-100', () => {
    let s = pushReputationCause(baseState, 'eastern', -200, 'rep.reason.huge');
    s = tickReputation(s);
    // Clamp at -100, then decay +0.5 toward 0 = -99.5
    expect(s.reputation?.eastern).toBe(-100 + REPUTATION_DECAY_PER_TICK);
  });

  it('tickReputation is a no-op when reputation undefined', () => {
    const noBlocsState = createGame(makeScenario(), {
      seed: 'noblocs',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    const next = tickReputation(noBlocsState);
    expect(next).toBe(noBlocsState);
  });

  it('decay drives values back toward 0 over many ticks', () => {
    let s = pushReputationCause(baseState, 'western', 30, 'rep.reason.test');
    s = tickReputation(s);
    // +29.5 after first tick
    for (let i = 0; i < 100; i++) s = tickReputation(s);
    // After ~60 decay steps the value should reach 0 (or close to it).
    expect(s.reputation?.western).toBe(0);
  });

  it('queue caps at MAX_PENDING_DELTAS (drops oldest)', () => {
    let s = baseState;
    for (let i = 0; i < MAX_PENDING_DELTAS + 10; i++) {
      s = pushReputationCause(s, 'western', 1, `rep.reason.${i}`);
    }
    expect(s.pendingReputationDeltas?.length).toBe(MAX_PENDING_DELTAS);
    // Oldest dropped: first surviving entry's reasonKey is `rep.reason.10`.
    expect(s.pendingReputationDeltas?.[0]?.reasonKey).toBe('rep.reason.10');
  });

  it('ignores deltas to a bloc that does not exist in this scenario', () => {
    let s = queueReputationDelta(baseState, {
      bloc: 'non-aligned',
      delta: 50,
      reasonKey: 'rep.reason.invalid',
      queuedAtTick: 0,
    });
    s = tickReputation(s);
    expect(s.reputation?.western).toBe(0);
    expect(s.reputation?.eastern).toBe(0);
  });
});

describe('reputation: helpers', () => {
  it('clampReputation handles NaN', () => {
    expect(clampReputation(Number.NaN)).toBe(0);
  });

  it('clampReputation respects bounds', () => {
    expect(clampReputation(1000)).toBe(100);
    expect(clampReputation(-1000)).toBe(-100);
    expect(clampReputation(50)).toBe(50);
  });

  it('decayToward arrives at target without overshoot', () => {
    expect(decayToward(0.3, 0, 0.5)).toBe(0);
    expect(decayToward(-0.1, 0, 0.5)).toBe(0);
    expect(decayToward(5, 0, 0.5)).toBe(4.5);
    expect(decayToward(0, 0, 1)).toBe(0);
  });
});

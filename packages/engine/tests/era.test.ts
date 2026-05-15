// Tests for the era-paced game mode.
//
// Covers:
//   - initEraState: only initialized for era-paced + scenario.eras
//   - tickEra: fires pendingTransition at boundary, advances index, snapshot
//   - acknowledgeEraTransition: clears pending, errors when none pending
//   - tick pipeline integration: scenario without eras → no crash; non-era
//     gameMode + scenario.eras → no era state at all
//   - final era endTick → game ends with winLoss === 'won'
//   - over-shoot: ticking 100 ticks past boundary fires only ONE transition
//   - statsSnapshot in pendingTransition reflects state at transition

import { describe, expect, it } from 'vitest';
import { applyAction, createGame, tick } from '../src/index.js';
import {
  acknowledgeTransition,
  initEraState,
  lastEraIndex,
  tickEra,
} from '../src/era/index.js';
import {
  ERA_FIXTURE_SCENARIO,
  makePhase3Scenario,
  makeScenario,
} from './fixtures.js';

function freshEraGame() {
  return createGame(ERA_FIXTURE_SCENARIO, {
    seed: 'era-test',
    victory: 'economic',
    playerCountryId: 'aurion',
    gameMode: 'era-paced',
  });
}

describe('initEraState', () => {
  it('initializes state for era-paced mode with scenario eras', () => {
    const era = initEraState(ERA_FIXTURE_SCENARIO, 'era-paced', 0);
    expect(era).toBeDefined();
    expect(era?.currentEraIndex).toBe(0);
    expect(era?.completedEraIds).toEqual([]);
    expect(era?.pendingTransition).toBeNull();
  });

  it('returns undefined when gameMode is not era-paced (even with eras)', () => {
    expect(initEraState(ERA_FIXTURE_SCENARIO, 'eternal', 0)).toBeUndefined();
    expect(initEraState(ERA_FIXTURE_SCENARIO, 'classic', 0)).toBeUndefined();
    expect(initEraState(ERA_FIXTURE_SCENARIO, 'dethrone', 0)).toBeUndefined();
    expect(initEraState(ERA_FIXTURE_SCENARIO, undefined, 0)).toBeUndefined();
  });

  it('returns undefined for era-paced when scenario has no eras', () => {
    const noErasScenario = makePhase3Scenario(); // no `eras` field
    expect(initEraState(noErasScenario, 'era-paced', 0)).toBeUndefined();
  });
});

describe('createGame: era state wiring', () => {
  it('attaches eraState when era-paced + scenario.eras', () => {
    const s = freshEraGame();
    expect(s.eraState).toBeDefined();
    expect(s.eraState?.currentEraIndex).toBe(0);
    expect(s.eraState?.pendingTransition).toBeNull();
  });

  it('omits eraState when scenario has no eras (era-paced still picked)', () => {
    const noErasScenario = makePhase3Scenario();
    const s = createGame(noErasScenario, {
      seed: 'no-eras',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'era-paced',
    });
    expect(s.eraState).toBeUndefined();
    // Game still works — tick must not crash.
    const next = tick(s, {
      scenario: noErasScenario,
      techCatalog: noErasScenario.techTree,
      eventPool: noErasScenario.eventPool,
    });
    expect(next.tick).toBe(s.tick + 1);
  });

  it('omits eraState when scenario has eras but gameMode is not era-paced', () => {
    const s = createGame(ERA_FIXTURE_SCENARIO, {
      seed: 'eras-but-eternal',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    expect(s.eraState).toBeUndefined();
    // Drive several ticks past era 0 boundary; nothing era-related fires.
    let next = s;
    for (let i = 0; i < 60; i++) {
      next = tick(next, {
        scenario: ERA_FIXTURE_SCENARIO,
        techCatalog: ERA_FIXTURE_SCENARIO.techTree,
        eventPool: ERA_FIXTURE_SCENARIO.eventPool,
      });
    }
    expect(next.eraState).toBeUndefined();
  });
});

describe('tickEra: transition firing', () => {
  it('fires pendingTransition when state.tick reaches era 0 endTick', () => {
    const s = { ...freshEraGame(), tick: 50 }; // exactly at endTick of era 0
    const next = tickEra(s, ERA_FIXTURE_SCENARIO);
    expect(next.eraState?.pendingTransition).not.toBeNull();
    expect(next.eraState?.pendingTransition?.fromEraId).toBe('era_dawn');
    expect(next.eraState?.pendingTransition?.toEraId).toBe('era_zenith');
    expect(next.eraState?.pendingTransition?.ticksAtTransition).toBe(50);
    expect(next.eraState?.currentEraIndex).toBe(1);
    expect(next.eraState?.completedEraIds).toEqual(['era_dawn']);
  });

  it('does not fire before endTick', () => {
    const s = { ...freshEraGame(), tick: 49 };
    const next = tickEra(s, ERA_FIXTURE_SCENARIO);
    expect(next.eraState?.pendingTransition).toBeNull();
    expect(next.eraState?.currentEraIndex).toBe(0);
  });

  it('does not double-fire while a transition is already pending', () => {
    let s = { ...freshEraGame(), tick: 50 };
    s = tickEra(s, ERA_FIXTURE_SCENARIO);
    const firstTransition = s.eraState?.pendingTransition;
    expect(firstTransition).not.toBeNull();
    // Advance many ticks without acknowledging.
    for (let dt = 1; dt <= 100; dt++) {
      s = { ...s, tick: 50 + dt };
      s = tickEra(s, ERA_FIXTURE_SCENARIO);
    }
    // Still the SAME pending transition; index didn't bump again past 1.
    expect(s.eraState?.pendingTransition).toBe(firstTransition);
    expect(s.eraState?.currentEraIndex).toBe(1);
    expect(s.eraState?.completedEraIds).toEqual(['era_dawn']);
  });

  it('fires final transition when on the LAST era boundary (toEraId === fromEraId)', () => {
    let s = freshEraGame();
    // Acknowledge the era 0 → era 1 transition manually so we can reach era 1.
    s = { ...s, tick: 50 };
    s = tickEra(s, ERA_FIXTURE_SCENARIO);
    s = acknowledgeTransition(s);
    expect(s.eraState?.currentEraIndex).toBe(1);
    expect(s.eraState?.completedEraIds).toEqual(['era_dawn']);
    // Now jump to the end of era 1 and tick.
    s = { ...s, tick: 100 };
    s = tickEra(s, ERA_FIXTURE_SCENARIO);
    expect(s.eraState?.pendingTransition).not.toBeNull();
    // No "next" era — UI shows a finale screen (toEraId === fromEraId).
    expect(s.eraState?.pendingTransition?.fromEraId).toBe('era_zenith');
    expect(s.eraState?.pendingTransition?.toEraId).toBe('era_zenith');
    // Index does NOT advance past the last era.
    expect(s.eraState?.currentEraIndex).toBe(1);
    // Both eras are now in completedEraIds.
    expect(s.eraState?.completedEraIds).toEqual(['era_dawn', 'era_zenith']);
  });

  it('is a no-op when state.eraState is undefined', () => {
    const s = createGame(ERA_FIXTURE_SCENARIO, {
      seed: 'no-state',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    const next = tickEra(s, ERA_FIXTURE_SCENARIO);
    expect(next).toBe(s); // identity — no allocation
  });

  it('is a no-op when scenario.eras is missing', () => {
    const noErasScenario = makePhase3Scenario();
    const era = initEraState(ERA_FIXTURE_SCENARIO, 'era-paced', 0);
    const s = { ...freshEraGame(), tick: 200, eraState: era };
    const next = tickEra(s, noErasScenario);
    expect(next.eraState?.pendingTransition).toBeNull();
  });

  it('snapshot reflects current cumulativeStats at transition time', () => {
    // Run a few ticks to mutate cumulativeStats, then trigger a transition
    // at endTick and verify the snapshot matches.
    let s = freshEraGame();
    for (let i = 0; i < 5; i++) {
      s = tick(s, {
        scenario: ERA_FIXTURE_SCENARIO,
        techCatalog: ERA_FIXTURE_SCENARIO.techTree,
        eventPool: ERA_FIXTURE_SCENARIO.eventPool,
      });
    }
    expect(s.cumulativeStats?.totalTicksPlayed).toBe(5);
    // Force the boundary.
    s = { ...s, tick: 50 };
    const fired = tickEra(s, ERA_FIXTURE_SCENARIO);
    expect(fired.eraState?.pendingTransition).not.toBeNull();
    expect(fired.eraState?.pendingTransition?.statsSnapshot).toEqual(
      s.cumulativeStats,
    );
  });
});

describe('acknowledgeEraTransition action', () => {
  it('clears pendingTransition when one exists', () => {
    let s = { ...freshEraGame(), tick: 50 };
    s = tickEra(s, ERA_FIXTURE_SCENARIO);
    expect(s.eraState?.pendingTransition).not.toBeNull();
    const result = applyAction(s, { type: 'acknowledgeEraTransition' });
    expect(result.errors).toEqual([]);
    expect(result.state.eraState?.pendingTransition).toBeNull();
    // Index already bumped during tickEra; still 1.
    expect(result.state.eraState?.currentEraIndex).toBe(1);
  });

  it('returns errors.era.noTransition when nothing is pending', () => {
    const s = freshEraGame();
    const result = applyAction(s, { type: 'acknowledgeEraTransition' });
    expect(result.errors).toEqual(['errors.era.noTransition']);
    expect(result.state).toBe(s);
  });

  it('returns errors.era.notAvailable when eraState is undefined', () => {
    const s = createGame(makeScenario(), {
      seed: 'classic-no-era',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    const result = applyAction(s, { type: 'acknowledgeEraTransition' });
    expect(result.errors).toEqual(['errors.era.notAvailable']);
  });
});

describe('tick pipeline + checkWinLoss integration', () => {
  it('fires winLoss = "won" on the final era endTick (era-paced)', () => {
    // Drive ticks past the final boundary; checkWinLoss must flip to 'won'
    // once state.tick (entering the tick fn) >= the LAST era's endTick.
    let s = freshEraGame();
    s = { ...s, tick: 100 };
    s = tick(s, {
      scenario: ERA_FIXTURE_SCENARIO,
      techCatalog: ERA_FIXTURE_SCENARIO.techTree,
      eventPool: ERA_FIXTURE_SCENARIO.eventPool,
    });
    expect(s.winLoss).toBe('won');
    // tickEra also ran on the same tick — a transition was queued.
    expect(s.eraState?.pendingTransition).not.toBeNull();
  });

  it('does NOT win on era boundary when gameMode is not era-paced', () => {
    let s = createGame(ERA_FIXTURE_SCENARIO, {
      seed: 'eras-but-classic',
      victory: 'economic',
      playerCountryId: 'aurion',
      // No gameMode → classic
    });
    s = { ...s, tick: 99 };
    while (s.tick < 102 && s.winLoss === 'playing') {
      s = tick(s, {
        scenario: ERA_FIXTURE_SCENARIO,
        techCatalog: ERA_FIXTURE_SCENARIO.techTree,
        eventPool: ERA_FIXTURE_SCENARIO.eventPool,
      });
    }
    expect(s.winLoss).toBe('playing');
    expect(s.eraState).toBeUndefined();
  });

  it('runs end-to-end: era 0 boundary → ack → era 1 boundary → won', () => {
    let s = freshEraGame();
    // Jump to tick 50 and tick once: tickEra sees tick=50, fires era_dawn
    // transition, then the loop bumps tick to 51.
    s = { ...s, tick: 50 };
    s = tick(s, {
      scenario: ERA_FIXTURE_SCENARIO,
      techCatalog: ERA_FIXTURE_SCENARIO.techTree,
      eventPool: ERA_FIXTURE_SCENARIO.eventPool,
    });
    expect(s.eraState?.pendingTransition).not.toBeNull();
    expect(s.eraState?.pendingTransition?.fromEraId).toBe('era_dawn');
    expect(s.eraState?.currentEraIndex).toBe(1);
    // Acknowledge so the next tick can fire era 1.
    const ack = applyAction(s, { type: 'acknowledgeEraTransition' });
    expect(ack.errors).toEqual([]);
    s = ack.state;
    expect(s.eraState?.pendingTransition).toBeNull();
    // Continue ticking until tick reaches 100 (one more tick after bumping).
    // tick is currently 51; jump forward to 100 directly so we don't run 49
    // unrelated ticks (some of which could trigger random AI actions, but the
    // test only cares about the final-era win path).
    s = { ...s, tick: 100 };
    s = tick(s, {
      scenario: ERA_FIXTURE_SCENARIO,
      techCatalog: ERA_FIXTURE_SCENARIO.techTree,
      eventPool: ERA_FIXTURE_SCENARIO.eventPool,
    });
    expect(s.winLoss).toBe('won');
    // The era_zenith transition fired on the same tick the game ended.
    expect(s.eraState?.pendingTransition?.fromEraId).toBe('era_zenith');
    expect(s.eraState?.pendingTransition?.toEraId).toBe('era_zenith');
  });
});

describe('helpers', () => {
  it('lastEraIndex returns -1 when no eras', () => {
    expect(lastEraIndex(makeScenario())).toBe(-1);
  });

  it('lastEraIndex returns final index when eras present', () => {
    expect(lastEraIndex(ERA_FIXTURE_SCENARIO)).toBe(1);
  });
});

describe('snapshot fallback when cumulativeStats is missing', () => {
  it('uses an empty snapshot if cumulativeStats is undefined', () => {
    // Construct a state with eraState present but cumulativeStats absent
    // (synthetic — production createGame always pairs them, but tickEra
    // must still produce a valid snapshot if a save was hand-edited).
    let s = freshEraGame();
    // Strip cumulativeStats off the state.
    const { cumulativeStats: _drop, ...rest } = s;
    void _drop;
    s = { ...(rest as typeof s), tick: 50 };
    const next = tickEra(s, ERA_FIXTURE_SCENARIO);
    const snap = next.eraState?.pendingTransition?.statsSnapshot;
    expect(snap).toBeDefined();
    expect(snap?.peakGdpRank).toBe(999);
    expect(snap?.peakTreasury).toBe(0);
    expect(snap?.totalTechsUnlocked).toBe(0);
    expect(snap?.totalReputationGained).toBe(0);
    expect(snap?.totalSpyOpsCompleted).toBe(0);
    expect(snap?.totalTicksPlayed).toBe(0);
  });
});

describe('completedEraIds idempotency', () => {
  it('does not duplicate an era id already present in completedEraIds', () => {
    // Synthetic eraState: pretend era_dawn was already completed somehow,
    // then run tickEra at the era 0 boundary. The id stays single-entry.
    const s = freshEraGame();
    const synthetic = {
      ...s,
      tick: 50,
      eraState: {
        currentEraIndex: 0,
        completedEraIds: ['era_dawn'],
        pendingTransition: null,
      } as typeof s.eraState,
    };
    const next = tickEra(synthetic, ERA_FIXTURE_SCENARIO);
    expect(next.eraState?.completedEraIds).toEqual(['era_dawn']);
    expect(next.eraState?.pendingTransition).not.toBeNull();
  });
});

describe('acknowledgeTransition pure helper', () => {
  it('is a no-op when there is no pending transition', () => {
    const s = freshEraGame();
    const next = acknowledgeTransition(s);
    expect(next).toBe(s);
  });

  it('is a no-op when eraState is undefined', () => {
    const classic = createGame(makeScenario(), {
      seed: 'classic-noop',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    const next = acknowledgeTransition(classic);
    expect(next).toBe(classic);
  });
});

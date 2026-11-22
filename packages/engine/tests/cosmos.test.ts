// Cosmos system — megaprojects, the rival space race and the Kardashev scale.

import { describe, expect, it } from 'vitest';
import {
  CANCEL_REFUND_SHARE,
  COSMOS_PROJECTS,
  KARDASHEV_START,
  applyAction,
  cosmosSlots,
  createGame,
  getCosmosProject,
  getProjectStatus,
  kardashevToWatts,
  kardashevType,
  projectCost,
  tick,
  tickCosmos,
  checkWinLoss,
  spaceRaceLeader,
  spaceRaceProgress,
  SPACE_RACE_PATH,
} from '../src/index.js';
import { evaluateVictory } from '../src/checkWinLoss.js';
import type { GameState } from '../src/index.js';
import { makeScenario } from './fixtures.js';

function newGame(): GameState {
  const scenario = makeScenario();
  return createGame(scenario, {
    victory: 'economic',
    playerCountryId: scenario.playableCountries[0]!,
    seed: 'cosmos',
  });
}

function rich(state: GameState, treasury = 1e18): GameState {
  const p = state.countries[state.playerCountryId]!;
  return {
    ...state,
    countries: { ...state.countries, [p.id]: { ...p, economy: { ...p.economy, treasury } } },
  };
}

describe('cosmos catalogue', () => {
  it('lists prerequisites before their dependants and has unique ids', () => {
    const seen = new Set<string>();
    for (const p of COSMOS_PROJECTS) {
      expect(seen.has(p.id)).toBe(false);
      for (const r of p.requires) expect(seen.has(r)).toBe(true);
      seen.add(p.id);
    }
  });

  it('reaches Type I and Type II through the capstones', () => {
    expect(getCosmosProject('earth_planetary_grid')?.effects.kardashevFloor).toBe(1);
    expect(getCosmosProject('sun_sphere')?.effects.kardashevFloor).toBe(2);
  });

  it('maps ratings to watts and types', () => {
    expect(kardashevToWatts(1)).toBeCloseTo(1e16, -10);
    expect(kardashevType(0.99)).toBe(0);
    expect(kardashevType(1)).toBe(1);
    expect(kardashevType(2.4)).toBe(2);
  });
});

describe('cosmos state', () => {
  it('is initialised by createGame with one unit = 1% of player GDP', () => {
    const state = newGame();
    const player = state.countries[state.playerCountryId]!;
    expect(state.cosmos?.kardashev).toBe(KARDASHEV_START);
    expect(state.cosmos?.unit).toBe(Math.round(player.economy.gdp / 100));
    expect(Object.keys(state.cosmos!.rivals)).not.toContain(player.id);
  });

  it('is created lazily for saves that predate the system', () => {
    const { cosmos: _drop, ...legacy } = newGame();
    const next = tickCosmos(legacy as GameState);
    expect(next.cosmos?.completed).toEqual([]);
  });
});

describe('startProject / cancelProject', () => {
  it('charges the treasury and queues the build', () => {
    const state = rich(newGame());
    const def = getCosmosProject('earth_smart_grid')!;
    const before = state.countries[state.playerCountryId]!.economy.treasury;
    const { state: next, errors } = applyAction(state, { type: 'startProject', projectId: def.id });
    expect(errors).toEqual([]);
    expect(next.cosmos!.active).toHaveLength(1);
    expect(next.countries[next.playerCountryId]!.economy.treasury).toBe(
      before - projectCost(state.cosmos!, def),
    );
  });

  it('rejects locked, unaffordable, duplicate and over-capacity builds', () => {
    const state = rich(newGame());
    expect(applyAction(state, { type: 'startProject', projectId: 'moon_base' }).errors).toEqual([
      'errors.cosmos.missingPrerequisite',
    ]);
    expect(applyAction(state, { type: 'startProject', projectId: 'nope' }).errors).toEqual([
      'errors.cosmos.unknownProject',
    ]);
    expect(
      applyAction(rich(state, 0), { type: 'startProject', projectId: 'earth_smart_grid' }).errors,
    ).toEqual(['errors.cosmos.insufficientTreasury']);
    const building = applyAction(state, { type: 'startProject', projectId: 'earth_smart_grid' }).state;
    expect(applyAction(building, { type: 'startProject', projectId: 'earth_smart_grid' }).errors).toEqual([
      'errors.cosmos.alreadyBuilding',
    ]);
    expect(cosmosSlots(building.cosmos!)).toBe(1);
    expect(applyAction(building, { type: 'startProject', projectId: 'earth_quantum_net' }).errors).toEqual([
      'errors.cosmos.noFreeSlot',
    ]);
  });

  it('refunds part of the cost on cancel', () => {
    const state = rich(newGame(), 1e12);
    const started = applyAction(state, { type: 'startProject', projectId: 'earth_smart_grid' }).state;
    const paid = started.cosmos!.active[0]!.paid;
    const cancelled = applyAction(started, { type: 'cancelProject', projectId: 'earth_smart_grid' }).state;
    expect(cancelled.cosmos!.active).toEqual([]);
    expect(cancelled.countries[cancelled.playerCountryId]!.economy.treasury).toBe(
      1e12 - paid + Math.round(paid * CANCEL_REFUND_SHARE),
    );
  });
});

describe('tickCosmos', () => {
  it('completes a build, applies its effects and records the first', () => {
    let state = rich(newGame());
    const def = getCosmosProject('earth_smart_grid')!;
    const gdp = state.countries[state.playerCountryId]!.economy.gdp;
    state = applyAction(state, { type: 'startProject', projectId: def.id }).state;
    for (let i = 0; i < def.durationTicks; i += 1) state = tickCosmos(state, { rivalSpeed: 0 });
    expect(state.cosmos!.completed).toEqual([def.id]);
    expect(state.cosmos!.kardashev).toBeCloseTo(KARDASHEV_START + 0.01, 6);
    expect(state.cosmos!.firsts[def.id]).toBe(state.playerCountryId);
    expect(state.countries[state.playerCountryId]!.economy.gdp).toBe(Math.round(gdp * 1.05));
    expect(getProjectStatus(state, def).status).toBe('done');
  });

  it('lets rivals climb the ladder over time', () => {
    let state = newGame();
    for (let i = 0; i < 600; i += 1) state = tickCosmos(state);
    const best = Math.max(...Object.values(state.cosmos!.rivals).map((r) => r.completed.length));
    expect(best).toBeGreaterThan(0);
    expect(state.cosmos!.log.length).toBeGreaterThan(0);
    expect(state.cosmos!.log.length).toBeLessThanOrEqual(40);
  });

  it('runs as part of the main tick and stays deterministic', () => {
    const scenario = makeScenario();
    const run = () => {
      let s = newGame();
      for (let i = 0; i < 120; i += 1) s = tick(s, { scenario, techCatalog: scenario.techTree });
      return s.cosmos;
    };
    expect(run()).toEqual(run());
  });
});

describe('kardashev victory rule', () => {
  it('is satisfied once the rating reaches the threshold', () => {
    const state = newGame();
    const rule = { kind: 'kardashev', atLeast: 1 } as const;
    expect(evaluateVictory(state, rule)).toBe(false);
    expect(evaluateVictory({ ...state, cosmos: { ...state.cosmos!, kardashev: 1 } }, rule)).toBe(true);
  });
});

describe('space race mode', () => {
  const race = (): GameState => ({ ...newGame(), gameMode: 'space-race' });

  it('is won by finishing the planetary grid first', () => {
    const s = race();
    const won = { ...s, cosmos: { ...s.cosmos!, completed: ['earth_planetary_grid'] } };
    expect(checkWinLoss(won).winLoss).toBe('won');
  });

  it('is lost when a rival gets there first', () => {
    const s = race();
    const rivalId = Object.keys(s.cosmos!.rivals)[0]!;
    const lost = {
      ...s,
      cosmos: {
        ...s.cosmos!,
        rivals: { ...s.cosmos!.rivals, [rivalId]: { completed: ['earth_planetary_grid'], points: 0 } },
      },
    };
    expect(checkWinLoss(lost).winLoss).toBe('lost');
    expect(spaceRaceLeader(lost.cosmos)?.countryId).toBe(rivalId);
  });

  it('measures progress along the path to the goal', () => {
    expect(spaceRaceProgress([])).toBe(0);
    expect(spaceRaceProgress(SPACE_RACE_PATH)).toBe(1);
    expect(SPACE_RACE_PATH).toContain('earth_fusion');
    expect(SPACE_RACE_PATH).not.toContain('mars_colony');
  });
});

import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { applyInvest } from '../src/actions/invest.js';
import { makeScenario } from './fixtures.js';

const scenario = makeScenario();
const baseState = createGame(scenario, {
  seed: 's',
  victory: 'economic',
  playerCountryId: 'aurion',
});

describe('applyInvest', () => {
  it('happy path: deducts treasury and boosts economy', () => {
    const before = baseState.countries.aurion;
    expect(before).toBeDefined();
    const initialTreasury = before!.economy.treasury;
    const initialGdp = before!.economy.gdp;
    const result = applyInvest(
      baseState,
      { type: 'invest', target: 'economy', amount: 100_000_000 },
      'aurion',
    );
    expect(result.errors).toEqual([]);
    const after = result.state.countries.aurion;
    expect(after?.economy.treasury).toBe(initialTreasury - 100_000_000);
    expect(after?.economy.gdp).toBeGreaterThan(initialGdp);
  });

  it('does not mutate the input state', () => {
    const snap = JSON.stringify(baseState);
    applyInvest(
      baseState,
      { type: 'invest', target: 'research', amount: 50_000_000 },
      'aurion',
    );
    expect(JSON.stringify(baseState)).toBe(snap);
  });

  it('rejects non-positive amount', () => {
    const result = applyInvest(
      baseState,
      { type: 'invest', target: 'economy', amount: 0 },
      'aurion',
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.state).toBe(baseState);
  });

  it('rejects when treasury is insufficient', () => {
    const result = applyInvest(
      baseState,
      { type: 'invest', target: 'economy', amount: 99_999_999_999 },
      'aurion',
    );
    expect(result.errors).toContain('errors.invest.insufficientTreasury');
  });

  it('intel investment increases spy count and counter-intel', () => {
    const before = baseState.countries.aurion!.intelligence;
    const result = applyInvest(
      baseState,
      { type: 'invest', target: 'intel', amount: 200_000_000 },
      'aurion',
    );
    const after = result.state.countries.aurion!.intelligence;
    expect(after.spyCount).toBeGreaterThan(before.spyCount);
    expect(after.counterIntelLevel).toBeGreaterThanOrEqual(before.counterIntelLevel);
  });

  it('military investment increases armySize', () => {
    const before = baseState.countries.aurion!.military.armySize;
    const result = applyInvest(
      baseState,
      { type: 'invest', target: 'military', amount: 500_000_000 },
      'aurion',
    );
    expect(result.state.countries.aurion!.military.armySize).toBeGreaterThan(before);
  });

  it('infra investment raises gdp and popularity', () => {
    const before = baseState.countries.aurion!;
    const result = applyInvest(
      baseState,
      { type: 'invest', target: 'infra', amount: 1_000_000_000 },
      'aurion',
    );
    const after = result.state.countries.aurion!;
    expect(after.economy.gdp).toBeGreaterThan(before.economy.gdp);
    expect(after.politics.popularity).toBeGreaterThanOrEqual(before.politics.popularity);
  });
});

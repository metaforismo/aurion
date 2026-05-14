import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { applySetTaxRate } from '../src/actions/setTaxRate.js';
import { makeScenario } from './fixtures.js';

const scenario = makeScenario();
const baseState = createGame(scenario, {
  seed: 'tx',
  victory: 'economic',
  playerCountryId: 'aurion',
});

describe('applySetTaxRate', () => {
  it('happy path: applies the new rate and shifts factions', () => {
    const result = applySetTaxRate(
      baseState,
      { type: 'setTaxRate', rate: 50 },
      'aurion',
    );
    expect(result.errors).toEqual([]);
    expect(result.state.countries.aurion!.economy.taxRate).toBe(50);
    const before = baseState.countries.aurion!.politics.factions;
    const after = result.state.countries.aurion!.politics.factions;
    expect(after.business.satisfaction).toBeLessThan(before.business.satisfaction);
    expect(after.populist.satisfaction).toBeGreaterThan(before.populist.satisfaction);
  });

  it('rejects rate < 0', () => {
    const r = applySetTaxRate(baseState, { type: 'setTaxRate', rate: -10 }, 'aurion');
    expect(r.errors).toContain('errors.tax.outOfRange');
  });

  it('rejects rate > 100', () => {
    const r = applySetTaxRate(baseState, { type: 'setTaxRate', rate: 150 }, 'aurion');
    expect(r.errors).toContain('errors.tax.outOfRange');
  });
});

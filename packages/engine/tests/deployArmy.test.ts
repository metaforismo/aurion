import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { applyDeployArmy } from '../src/actions/deployArmy.js';
import { makeScenario } from './fixtures.js';

const scenario = makeScenario();
const baseState = createGame(scenario, {
  seed: 'da',
  victory: 'economic',
  playerCountryId: 'aurion',
});

describe('applyDeployArmy', () => {
  it('happy path: creates a deployment and reduces armySize', () => {
    const before = baseState.countries.aurion!.military.armySize;
    const result = applyDeployArmy(
      baseState,
      { type: 'deployArmy', target: 'region_aurion', units: 100 },
      'aurion',
    );
    expect(result.errors).toEqual([]);
    expect(result.state.countries.aurion!.military.deployedUnits).toHaveLength(1);
    const dep = result.state.countries.aurion!.military.deployedUnits[0]!;
    expect(dep.units).toBe(100);
    expect(dep.regionId).toBe('region_aurion');
    expect(dep.hostCountryId).toBe('aurion');
    expect(result.state.countries.aurion!.military.armySize).toBe(before - 100);
  });

  it('rejects deploying more units than available', () => {
    const result = applyDeployArmy(
      baseState,
      { type: 'deployArmy', target: 'region_aurion', units: 99_999 },
      'aurion',
    );
    expect(result.errors).toContain('errors.deploy.notEnoughUnits');
  });

  it('rejects non-positive units', () => {
    const result = applyDeployArmy(
      baseState,
      { type: 'deployArmy', target: 'region_aurion', units: 0 },
      'aurion',
    );
    expect(result.errors).toContain('errors.deploy.invalidUnits');
  });
});

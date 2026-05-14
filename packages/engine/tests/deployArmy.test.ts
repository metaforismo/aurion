import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { applyDeployArmy, isDeployAllowed } from '../src/actions/deployArmy.js';
import { applyDiplomacy } from '../src/actions/diplomacy.js';
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

  it('rejects deploying into a peaceful neighbour\'s region (no access)', () => {
    // borealis is peaceful, no alliance, no war.
    const result = applyDeployArmy(
      baseState,
      { type: 'deployArmy', target: 'region_borealis', units: 100 },
      'aurion',
    );
    expect(result.errors).toContain('errors.deploy.foreignRegionNoAccess');
  });

  it('allows deploying into an enemy region during war', () => {
    // khanate has attitude -40 in fixture; declare war first.
    const warred = applyDiplomacy(
      baseState,
      { type: 'diplomacy', target: 'khanate', kind: 'declareWar' },
      'aurion',
    );
    const result = applyDeployArmy(
      warred.state,
      { type: 'deployArmy', target: 'region_khanate', units: 100 },
      'aurion',
    );
    expect(result.errors).toEqual([]);
    expect(result.state.countries.aurion!.military.deployedUnits).toHaveLength(1);
  });

  it('allows deploying into an allied region', () => {
    const allied = applyDiplomacy(
      baseState,
      { type: 'diplomacy', target: 'borealis', kind: 'proposeAlliance' },
      'aurion',
    );
    const result = applyDeployArmy(
      allied.state,
      { type: 'deployArmy', target: 'region_borealis', units: 100 },
      'aurion',
    );
    expect(result.errors).toEqual([]);
  });

  it('isDeployAllowed: own region always allowed', () => {
    expect(isDeployAllowed(baseState, 'aurion', 'region_aurion').ok).toBe(true);
  });

  it('isDeployAllowed: foreign peaceful region rejected', () => {
    const r = isDeployAllowed(baseState, 'aurion', 'region_borealis');
    expect(r.ok).toBe(false);
  });

  it('isDeployAllowed: unowned region allowed', () => {
    expect(isDeployAllowed(baseState, 'aurion', 'no-mans-land').ok).toBe(true);
  });
});

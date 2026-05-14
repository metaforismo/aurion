// Reducer for the 'deployArmy' action.

import { createRng } from '../rng.js';
import type {
  Action,
  ApplyActionResult,
  CountryId,
  DeploymentId,
  GameState,
  MilitaryDeployment,
} from '../types.js';
import { withCountry } from './helpers.js';

export type DeployArmyAction = Extract<Action, { type: 'deployArmy' }>;

function nextDeploymentId(state: GameState, countryId: CountryId): DeploymentId {
  const seed = `${state.rngSeed}::deploy::${countryId}::${state.tick}`;
  const rng = createRng(seed);
  return `dep_${countryId}_${state.tick}_${rng.nextInt(1_000_000)}`;
}

function findHostCountry(state: GameState, regionId: string): CountryId | null {
  for (const c of Object.values(state.countries)) {
    if (c.regionId === regionId) return c.id;
  }
  return null;
}

export function applyDeployArmy(
  state: GameState,
  action: DeployArmyAction,
  countryId: CountryId,
): ApplyActionResult {
  const errors: string[] = [];
  const country = state.countries[countryId];
  if (!country) {
    errors.push('errors.country.notFound');
    return { state, errors };
  }
  if (!Number.isFinite(action.units) || action.units <= 0) {
    errors.push('errors.deploy.invalidUnits');
    return { state, errors };
  }
  if (action.units > country.military.armySize) {
    errors.push('errors.deploy.notEnoughUnits');
    return { state, errors };
  }
  if (typeof action.target !== 'string' || action.target.length === 0) {
    errors.push('errors.deploy.invalidRegion');
    return { state, errors };
  }

  const newDep: MilitaryDeployment = {
    id: nextDeploymentId(state, countryId),
    regionId: action.target,
    units: action.units,
    hostCountryId: findHostCountry(state, action.target),
    issuedAtTick: state.tick,
  };

  const updated = {
    ...country,
    military: {
      ...country.military,
      armySize: country.military.armySize - action.units,
      deployedUnits: [...country.military.deployedUnits, newDep],
    },
  };
  return { state: withCountry(state, updated), errors: [] };
}

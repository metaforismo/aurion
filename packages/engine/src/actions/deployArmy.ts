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
import { getRelation, withCountry } from './helpers.js';

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

/**
 * Returns true if `actor` is allowed to deploy units into `regionId` given the
 * current diplomatic state. A country may always deploy on its own territory.
 * A country may deploy on a foreign region if it is at war with the host or
 * has an alliance with the host (military access). Otherwise the deployment
 * is rejected — countries do not casually walk armies across borders.
 */
export function isDeployAllowed(
  state: GameState,
  actor: CountryId,
  regionId: string,
): { ok: true } | { ok: false; reason: string } {
  // Find which country this region belongs to (territorial owner).
  const host = findHostCountry(state, regionId);
  // Region with no owner (e.g. uncharted / sea) — always allowed.
  if (host === null) return { ok: true };
  // Own territory: always allowed.
  if (host === actor) return { ok: true };
  const rel = getRelation(state, actor, host);
  if (rel?.atWar) return { ok: true };
  if (rel?.treaties.includes('alliance')) return { ok: true };
  return { ok: false, reason: 'errors.deploy.foreignRegionNoAccess' };
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
  const allowed = isDeployAllowed(state, countryId, action.target);
  if (!allowed.ok) {
    return { state, errors: [allowed.reason] };
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

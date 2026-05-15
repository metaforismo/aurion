// Reducer for the 'dismantleNuclear' action.
//
// Per Open Question 4: voluntary dismantling is permitted, but reputation
// boost is full only when a non-proliferation UN treaty is in force (status
// 'passed'). Without it, the boost is halved.

import type {
  Action,
  ApplyActionResult,
  CountryId,
  GameState,
} from '../types.js';
import { applyDismantle } from '../nuclear/index.js';

export type DismantleNuclearAction = Extract<Action, { type: 'dismantleNuclear' }>;

export function applyDismantleNuclear(
  state: GameState,
  action: DismantleNuclearAction,
  countryId: CountryId,
): ApplyActionResult {
  const country = state.countries[countryId];
  if (!country) {
    return { state, errors: ['errors.country.notFound'] };
  }
  if (!country.nuclear || country.nuclear.warheadCount <= 0) {
    return { state, errors: ['errors.nuclear.noArsenal'] };
  }
  if (!Number.isFinite(action.count) || action.count <= 0) {
    return { state, errors: ['errors.nuclear.invalidCount'] };
  }
  if (action.count > country.nuclear.warheadCount) {
    return { state, errors: ['errors.nuclear.tooMany'] };
  }

  const treatyInForce = isNonProliferationTreatyInForce(state);
  const next = applyDismantle(state, countryId, action.count, treatyInForce);
  return { state: next, errors: [] };
}

/**
 * A non-proliferation treaty is "in force" when there exists at least one
 * UNResolution of kind 'nonProliferation' with status 'passed' currently in
 * the resolutions list.
 */
export function isNonProliferationTreatyInForce(state: GameState): boolean {
  if (!state.unResolutions) return false;
  for (const r of state.unResolutions) {
    if (r.kind === 'nonProliferation' && r.status === 'passed') return true;
  }
  return false;
}

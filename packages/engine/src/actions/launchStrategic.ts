// Reducer for the 'launchStrategic' action (strategic nuclear strike).
//
// Validates: actor exists, has at least one warhead, target country exists,
// is not the actor itself, AND the actor is currently at war with the target.
// On success applies the strike — `applyStrategicStrike` automatically
// detects MAD and applies mutual annihilation if the target also has an
// arsenal.

import type {
  Action,
  ApplyActionResult,
  CountryId,
  GameState,
  Scenario,
} from '../types.js';
import { createRng } from '../rng.js';
import {
  applyStrategicStrike,
  hasArsenal,
  isAtWar,
} from '../nuclear/index.js';
import { openResolutionFromTemplate } from '../un/index.js';

export type LaunchStrategicAction = Extract<Action, { type: 'launchStrategic' }>;

export function applyLaunchStrategic(
  state: GameState,
  action: LaunchStrategicAction,
  countryId: CountryId,
  scenario?: Scenario,
): ApplyActionResult {
  const country = state.countries[countryId];
  if (!country) {
    return { state, errors: ['errors.country.notFound'] };
  }
  if (!country.nuclear || !hasArsenal(country)) {
    return { state, errors: ['errors.nuclear.noArsenal'] };
  }
  if (country.nuclear.warheadCount < 1) {
    return { state, errors: ['errors.nuclear.noWarheads'] };
  }
  if (action.targetCountryId === countryId) {
    return { state, errors: ['errors.nuclear.selfTarget'] };
  }
  if (!state.countries[action.targetCountryId]) {
    return { state, errors: ['errors.country.notFound'] };
  }
  if (!isAtWar(state, countryId, action.targetCountryId)) {
    return { state, errors: ['errors.nuclear.targetNotEnemy'] };
  }

  const rng = createRng(`${state.rngSeed}::nuclear::strategic::${countryId}::${state.tick}`);
  let next = applyStrategicStrike(state, countryId, action.targetCountryId, rng);

  // Open UN condemnation resolution if mapping exists.
  if (scenario?.unTriggerMap?.launchStrategic && next.unResolutions) {
    const proposerId = pickProposerForCondemnation(next, scenario, countryId);
    if (proposerId) {
      next = openResolutionFromTemplate(
        next,
        scenario.unTriggerMap.launchStrategic,
        proposerId,
        countryId,
      );
    }
  }

  return { state: next, errors: [] };
}

function pickProposerForCondemnation(
  state: GameState,
  scenario: Scenario,
  exclude: CountryId,
): CountryId | null {
  const permanents = scenario.unCouncilMembers ?? [];
  for (const id of permanents) {
    if (id === exclude) continue;
    if (state.countries[id]) return id;
  }
  for (const id of Object.keys(state.countries)) {
    if (id !== exclude) return id;
  }
  return null;
}

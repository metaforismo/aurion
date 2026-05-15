// Reducer for the 'launchTactical' action (tactical nuclear strike).
//
// Validates: actor exists, has an arsenal with ≥1 warhead, and the target
// region is an "enemy region" — defined as either the home of a country we
// are currently at war with, or a region with at least one enemy deployment.
//
// On success: applies the strike via `applyTacticalStrike` and (if the
// scenario declares one) opens the matching UN condemnation resolution.

import type {
  Action,
  ApplyActionResult,
  CountryId,
  GameState,
  Scenario,
} from '../types.js';
import { createRng } from '../rng.js';
import {
  applyTacticalStrike,
  hasArsenal,
  isEnemyRegion,
} from '../nuclear/index.js';
import { openResolutionFromTemplate } from '../un/index.js';

export type LaunchTacticalAction = Extract<Action, { type: 'launchTactical' }>;

export function applyLaunchTactical(
  state: GameState,
  action: LaunchTacticalAction,
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
  if (typeof action.targetRegionId !== 'string' || action.targetRegionId.length === 0) {
    return { state, errors: ['errors.nuclear.invalidRegion'] };
  }
  if (!isEnemyRegion(state, countryId, action.targetRegionId)) {
    return { state, errors: ['errors.nuclear.regionNotEnemy'] };
  }

  // Apply strike effects.
  const rng = createRng(`${state.rngSeed}::nuclear::tactical::${countryId}::${state.tick}`);
  let next = applyTacticalStrike(state, countryId, action.targetRegionId, rng);

  // Trigger UN condemnation if the scenario declares a launchTactical mapping.
  if (scenario?.unTriggerMap?.launchTactical && next.unResolutions) {
    const proposerId = pickProposerForCondemnation(next, scenario, countryId);
    if (proposerId) {
      next = openResolutionFromTemplate(
        next,
        scenario.unTriggerMap.launchTactical,
        proposerId,
        countryId,
        action.targetRegionId,
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

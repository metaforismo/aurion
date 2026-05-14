// Reducer for the 'placateFaction' action. Costs treasury, raises satisfaction.

import type { Action, ApplyActionResult, CountryId, GameState } from '../types.js';
import { clamp, withCountry } from './helpers.js';

export type PlacateFactionAction = Extract<Action, { type: 'placateFaction' }>;

export const PLACATE_COST = 100_000_000;
export const PLACATE_BOOST = 15;

export function applyPlacateFaction(
  state: GameState,
  action: PlacateFactionAction,
  countryId: CountryId,
): ApplyActionResult {
  const errors: string[] = [];
  const country = state.countries[countryId];
  if (!country) {
    errors.push('errors.country.notFound');
    return { state, errors };
  }
  if (country.economy.treasury < PLACATE_COST) {
    errors.push('errors.placate.insufficientTreasury');
    return { state, errors };
  }
  const target = country.politics.factions[action.factionId];
  if (!target) {
    errors.push('errors.placate.unknownFaction');
    return { state, errors };
  }

  const updated = {
    ...country,
    economy: { ...country.economy, treasury: country.economy.treasury - PLACATE_COST },
    politics: {
      ...country.politics,
      factions: {
        ...country.politics.factions,
        [action.factionId]: {
          ...target,
          satisfaction: clamp(target.satisfaction + PLACATE_BOOST, 0, 100),
        },
      },
    },
  };
  return { state: withCountry(state, updated), errors: [] };
}

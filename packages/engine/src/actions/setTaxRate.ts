// Reducer for the 'setTaxRate' action.

import type { Action, ApplyActionResult, CountryId, GameState, FactionId } from '../types.js';
import { clamp, withCountry } from './helpers.js';

export type SetTaxRateAction = Extract<Action, { type: 'setTaxRate' }>;

/**
 * Tax rate effects on factions:
 * - business: very unhappy with high tax (linear)
 * - populist: happier with high tax (assumed redistributive)
 * - reformist: mildly happier with moderate-to-high tax
 * - religious & army: small effect, slight negative for very high
 *
 * Effect is applied as a delta from the previous rate.
 */
export function applySetTaxRate(
  state: GameState,
  action: SetTaxRateAction,
  countryId: CountryId,
): ApplyActionResult {
  const errors: string[] = [];
  if (!Number.isFinite(action.rate) || action.rate < 0 || action.rate > 100) {
    errors.push('errors.tax.outOfRange');
    return { state, errors };
  }
  const country = state.countries[countryId];
  if (!country) {
    errors.push('errors.country.notFound');
    return { state, errors };
  }

  const prev = country.economy.taxRate;
  const delta = action.rate - prev;
  // Faction nudges scale with the absolute change.
  const factionDeltas: Record<FactionId, number> = {
    business: -delta * 0.4,
    populist: delta * 0.3,
    reformist: delta * 0.1,
    religious: -delta * 0.05,
    army: -delta * 0.05,
  };

  const updatedFactions = { ...country.politics.factions };
  for (const [k, v] of Object.entries(factionDeltas)) {
    const fid = k as FactionId;
    const cur = updatedFactions[fid];
    updatedFactions[fid] = { ...cur, satisfaction: clamp(cur.satisfaction + v, 0, 100) };
  }

  const updated = {
    ...country,
    economy: { ...country.economy, taxRate: action.rate },
    politics: { ...country.politics, factions: updatedFactions },
  };
  return { state: withCountry(state, updated), errors: [] };
}

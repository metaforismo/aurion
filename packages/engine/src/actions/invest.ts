// Reducer for the 'invest' action. Spends treasury to boost a sub-system.

import type { Action, ApplyActionResult, Country, CountryId, GameState } from '../types.js';
import { clamp, withCountry } from './helpers.js';

export type InvestAction = Extract<Action, { type: 'invest' }>;

/**
 * Effects per InvestTarget:
 * - 'economy': raises gdp by amount * 4 (small leverage), small bump to industry sector
 * - 'research': raises researchOutput by amount / 1e8 (small permanent bump) + tilts sectors toward tech
 * - 'military': adds armySize proportional to spend
 * - 'intel':    adds 1 spy per `costPerSpy` and raises counterIntelLevel
 * - 'infra':    raises gdp moderately, raises popularity slightly
 */
const COST_PER_SPY = 50_000_000;

export function applyInvest(
  state: GameState,
  action: InvestAction,
  countryId: CountryId,
): ApplyActionResult {
  const errors: string[] = [];
  if (!Number.isFinite(action.amount) || action.amount <= 0) {
    errors.push('errors.invest.invalidAmount');
    return { state, errors };
  }
  const country = state.countries[countryId];
  if (!country) {
    errors.push('errors.country.notFound');
    return { state, errors };
  }
  if (country.economy.treasury < action.amount) {
    errors.push('errors.invest.insufficientTreasury');
    return { state, errors };
  }

  const updated: Country = applyInvestEffects(country, action);
  return { state: withCountry(state, updated), errors: [] };
}

/** Pure helper exposed for AI / tests. Returns a new Country. */
export function applyInvestEffects(country: Country, action: InvestAction): Country {
  const c = country;
  const newTreasury = c.economy.treasury - action.amount;
  switch (action.target) {
    case 'economy': {
      const gdpBoost = action.amount * 4;
      return {
        ...c,
        economy: {
          ...c.economy,
          treasury: newTreasury,
          gdp: c.economy.gdp + gdpBoost,
        },
      };
    }
    case 'research': {
      const outputBoost = action.amount / 5_000_000; // ~ 0.2 / 1M spent
      return {
        ...c,
        economy: { ...c.economy, treasury: newTreasury },
        science: {
          ...c.science,
          researchOutput: c.science.researchOutput + outputBoost,
        },
      };
    }
    case 'military': {
      const newUnits = Math.floor(action.amount / 100_000); // 1 unit per 100k
      return {
        ...c,
        economy: { ...c.economy, treasury: newTreasury },
        military: {
          ...c.military,
          armySize: c.military.armySize + newUnits,
        },
      };
    }
    case 'intel': {
      const newSpies = Math.floor(action.amount / COST_PER_SPY);
      const ciBoost = clamp(action.amount / 1_000_000_000, 0, 0.2);
      return {
        ...c,
        economy: { ...c.economy, treasury: newTreasury },
        intelligence: {
          ...c.intelligence,
          spyCount: c.intelligence.spyCount + newSpies,
          counterIntelLevel: clamp(c.intelligence.counterIntelLevel + ciBoost, 0, 1),
        },
      };
    }
    case 'infra': {
      const gdpBoost = action.amount * 2;
      const popBoost = clamp(action.amount / 1_000_000_000, 0, 5);
      return {
        ...c,
        economy: {
          ...c.economy,
          treasury: newTreasury,
          gdp: c.economy.gdp + gdpBoost,
        },
        politics: {
          ...c.politics,
          popularity: clamp(c.politics.popularity + popBoost, 0, 100),
        },
      };
    }
  }
}

/** Cost-per-spy export so AI knows what to budget. */
export const investConstants = {
  COST_PER_SPY,
};

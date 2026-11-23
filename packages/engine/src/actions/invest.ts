// Reducer for the 'invest' action. Spends treasury to boost a sub-system.

import type { Action, ApplyActionResult, Country, CountryId, GameState } from '../types.js';
import { deriveResearchOutput } from '../createGame.js';
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

/** GDP gained per euro on a first, small investment. */
export const INVEST_GDP_PER_EURO: Record<'economy' | 'infra', number> = { economy: 4, infra: 2 };
/**
 * Research gained by a first investment worth 1% of GDP, as a share of the
 * output the country's economy would produce by itself.
 */
export const INVEST_RESEARCH_PER_GDP_PERCENT = 0.25;
/**
 * Money poured in faster than the country can absorb it buys less and less.
 * "Heat" is what has been invested lately, as a share of GDP; at this much
 * heat the next euro is worth half.
 */
export const INVEST_HEAT_HALVING = 0.02;
/** Share of the heat that cools off every week. */
export const INVEST_HEAT_DECAY_PER_TICK = 0.02;

export type InvestTrack = 'growth' | 'research';

/** Economy and infrastructure share one absorption limit; research has its own. */
export function investTrack(target: InvestAction['target']): InvestTrack | null {
  if (target === 'economy' || target === 'infra') return 'growth';
  if (target === 'research') return 'research';
  return null;
}

/**
 * Average worth (0..1) of the euros in an investment of `amount`, given the
 * heat already on that track. Splitting a sum into smaller payments changes
 * nothing: the result is the integral of 1 / (1 + heat / HALVING).
 */
export function investEfficiency(country: Country, target: InvestAction['target'], amount: number): number {
  const track = investTrack(target);
  const gdp = country.economy.gdp;
  if (!track || gdp <= 0 || amount <= 0) return 1;
  const heat = country.economy.investHeat?.[track] ?? 0;
  const added = amount / gdp;
  const s = INVEST_HEAT_HALVING;
  return (s * Math.log((s + heat + added) / (s + heat))) / added;
}

export type InvestOutcome = {
  /** 0..1 — how much of the nominal return this investment keeps. */
  efficiency: number;
  gdpGain: number;
  popularityGain: number;
  researchGain: number;
  units: number;
  spies: number;
  counterIntelGain: number;
};

/** What an investment buys right now. The reducer applies exactly this. */
export function investOutcome(country: Country, target: InvestAction['target'], amount: number): InvestOutcome {
  const out: InvestOutcome = {
    efficiency: investEfficiency(country, target, amount),
    gdpGain: 0,
    popularityGain: 0,
    researchGain: 0,
    units: 0,
    spies: 0,
    counterIntelGain: 0,
  };
  switch (target) {
    case 'economy':
      out.gdpGain = Math.round(amount * INVEST_GDP_PER_EURO.economy * out.efficiency);
      break;
    case 'infra':
      out.gdpGain = Math.round(amount * INVEST_GDP_PER_EURO.infra * out.efficiency);
      out.popularityGain = Math.min(
        clamp(amount / 1_000_000_000, 0, 5) * out.efficiency,
        100 - country.politics.popularity,
      );
      break;
    case 'research': {
      const baseline = Math.max(
        1,
        deriveResearchOutput(country.economy.sectors, country.population, country.economy.gdp),
      );
      const gdpPercents = country.economy.gdp > 0 ? (amount / country.economy.gdp) * 100 : 0;
      out.researchGain = baseline * INVEST_RESEARCH_PER_GDP_PERCENT * gdpPercents * out.efficiency;
      break;
    }
    case 'military':
      out.units = Math.floor(amount / 100_000); // 1 unit per 100k
      break;
    case 'intel':
      out.spies = Math.floor(amount / COST_PER_SPY);
      out.counterIntelGain = Math.min(
        clamp(amount / 1_000_000_000, 0, 0.2),
        1 - country.intelligence.counterIntelLevel,
      );
      break;
  }
  return out;
}

/** Weekly cooling of a country's investment heat. */
export function coolInvestHeat(country: Country): Country {
  const heat = country.economy.investHeat;
  if (!heat) return country;
  const next: Partial<Record<InvestTrack, number>> = {};
  for (const [track, value] of Object.entries(heat) as [InvestTrack, number][]) {
    const cooled = value * (1 - INVEST_HEAT_DECAY_PER_TICK);
    if (cooled > 1e-5) next[track] = cooled;
  }
  return { ...country, economy: { ...country.economy, investHeat: next } };
}


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
  const o = investOutcome(c, action.target, action.amount);
  const track = investTrack(action.target);
  const heat = track
    ? {
        ...c.economy.investHeat,
        [track]: (c.economy.investHeat?.[track] ?? 0) + (c.economy.gdp > 0 ? action.amount / c.economy.gdp : 0),
      }
    : c.economy.investHeat;
  return {
    ...c,
    economy: {
      ...c.economy,
      treasury: c.economy.treasury - action.amount,
      gdp: c.economy.gdp + o.gdpGain,
      ...(heat ? { investHeat: heat } : {}),
    },
    science: { ...c.science, researchOutput: c.science.researchOutput + o.researchGain },
    military: { ...c.military, armySize: c.military.armySize + o.units },
    intelligence: {
      ...c.intelligence,
      spyCount: c.intelligence.spyCount + o.spies,
      counterIntelLevel: clamp(c.intelligence.counterIntelLevel + o.counterIntelGain, 0, 1),
    },
    politics: { ...c.politics, popularity: clamp(c.politics.popularity + o.popularityGain, 0, 100) },
  };
}

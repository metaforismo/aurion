// Economy maths for the panel. The engine computes income inside `tick` and
// does not export the formula, so the pieces are mirrored here (from
// packages/engine/src/tick.ts `computeWeeklyIncome` and actions/invest.ts)
// to explain where the money comes from and to preview a decision before
// the player commits. The engine stays the source of truth for the result.

import {
  colonyModifiers,
  factionModifiers,
  policyModifiers,
  type Country,
  type FactionId,
  type GameState,
  type InvestTarget,
} from '@aurion/engine';

export const INVEST_TARGETS: readonly InvestTarget[] = ['economy', 'infra', 'research', 'military', 'intel'];

const WEEKS_PER_YEAR = 52;
/** Extra tax take per unit of sector share. */
export const TECH_SECTOR_BONUS = 0.4;
export const SERVICES_SECTOR_BONUS = 0.2;
export const TRADE_DEAL_BONUS = 0.02;
export const SANCTION_PENALTY = 0.05;
const WAR_COST_PER_UNIT = 50;

/** Satisfaction change per point of tax rate added (actions/setTaxRate.ts). */
export const TAX_FACTION_EFFECT: Record<FactionId, number> = {
  business: -0.4,
  populist: 0.3,
  reformist: 0.1,
  religious: -0.05,
  army: -0.05,
};

/** Invest rates (actions/invest.ts). */
export const GDP_PER_EURO: Record<'economy' | 'infra', number> = { economy: 4, infra: 2 };
export const EUROS_PER_POPULARITY_POINT = 1_000_000_000;
export const INFRA_POPULARITY_CAP = 5;
export const EUROS_PER_RESEARCH_POINT = 5_000_000;
export const EUROS_PER_ARMY_UNIT = 100_000;
export const EUROS_PER_SPY = 50_000_000;
export const EUROS_PER_FULL_COUNTER_INTEL = 1_000_000_000;
export const COUNTER_INTEL_CAP_PER_INVESTMENT = 0.2;

export type IncomeBreakdown = {
  /** GDP × tax rate, per week. */
  taxTake: number;
  /** Extra take from services and tech. */
  sectorBonus: number;
  tradeDeals: number;
  tradeGain: number;
  sanctions: number;
  sanctionLoss: number;
  wars: number;
  warCost: number;
  /** What the business faction's stance adds or takes away. */
  factions: number;
  /** Paid in by trading colonies on other worlds. */
  colonies: number;
  /** Difficulty adjustment on the player's income (0 on Normal). */
  difficultyDelta: number;
  /** What the engine adds to the treasury each week before policies. */
  income: number;
  /** Net weekly effect of standing policies (bonuses minus upkeep). */
  policies: number;
  /** What the treasury really moves by each week. */
  net: number;
};

export function incomeBreakdown(
  country: Country,
  state: GameState,
  playerIncomeMultiplier: number,
  overrides: { taxRate?: number; gdp?: number } = {},
): IncomeBreakdown {
  const gdp = overrides.gdp ?? country.economy.gdp;
  const rate = (overrides.taxRate ?? country.economy.taxRate) / 100;
  const { sectors } = country.economy;

  const taxTake = (gdp * rate) / WEEKS_PER_YEAR;
  const sectorBonus = taxTake * (sectors.tech * TECH_SECTOR_BONUS + sectors.services * SERVICES_SECTOR_BONUS);

  let tradeDeals = 0;
  let sanctions = 0;
  let wars = 0;
  for (const rel of Object.values(state.relations)) {
    if (rel.countryA !== country.id && rel.countryB !== country.id) continue;
    if (rel.treaties.includes('tradeDeal')) tradeDeals += 1;
    if (rel.treaties.includes('sanctions')) sanctions += 1;
    if (rel.atWar) wars += 1;
  }
  const beforeTreaties = taxTake + sectorBonus;
  const afterTrade = beforeTreaties * (1 + TRADE_DEAL_BONUS) ** tradeDeals;
  const afterSanctions = afterTrade * (1 - SANCTION_PENALTY) ** sanctions;
  const warCost = -wars * country.military.armySize * WAR_COST_PER_UNIT;

  const base = Math.round(afterSanctions + warCost);
  // tick.ts `stepEconomy`: a loyal or hostile business faction scales a
  // positive take before the difficulty multiplier.
  const withFactions = base > 0 ? Math.round(base * (1 + factionModifiers(country).incomeMul)) : base;
  const factions = withFactions - base;
  const income = Math.round(withFactions * playerIncomeMultiplier);
  const colonies = country.id === state.playerCountryId ? colonyModifiers(state).income : 0;
  const mods = policyModifiers(state);
  const policies = Math.round(Math.max(0, income) * (mods.incomeMul - mods.upkeep));

  return {
    taxTake,
    sectorBonus,
    tradeDeals,
    tradeGain: afterTrade - beforeTreaties,
    sanctions,
    sanctionLoss: afterSanctions - afterTrade,
    wars,
    warCost,
    factions,
    difficultyDelta: income - withFactions,
    income,
    policies,
    colonies,
    net: income + policies + colonies,
  };
}

export type InvestPreview =
  | { target: 'economy' | 'infra'; gdpGain: number; incomeGain: number; paybackWeeks: number | null; popularityGain: number }
  | { target: 'research'; outputGain: number }
  | { target: 'military'; units: number }
  | { target: 'intel'; spies: number; counterIntelGain: number };

/** What `amount` buys, computed with the engine's own rates. */
export function investPreview(
  country: Country,
  state: GameState,
  playerIncomeMultiplier: number,
  target: InvestTarget,
  amount: number,
): InvestPreview {
  switch (target) {
    case 'economy':
    case 'infra': {
      const gdpGain = amount * GDP_PER_EURO[target];
      const now = incomeBreakdown(country, state, playerIncomeMultiplier).net;
      const then = incomeBreakdown(country, state, playerIncomeMultiplier, {
        gdp: country.economy.gdp + gdpGain,
      }).net;
      const incomeGain = then - now;
      const popularityGain =
        target === 'infra'
          ? Math.min(
              INFRA_POPULARITY_CAP,
              amount / EUROS_PER_POPULARITY_POINT,
              100 - country.politics.popularity,
            )
          : 0;
      return {
        target,
        gdpGain,
        incomeGain,
        paybackWeeks: incomeGain > 0 ? Math.ceil(amount / incomeGain) : null,
        popularityGain,
      };
    }
    case 'research':
      return { target, outputGain: amount / EUROS_PER_RESEARCH_POINT };
    case 'military':
      return { target, units: Math.floor(amount / EUROS_PER_ARMY_UNIT) };
    case 'intel':
      return {
        target,
        spies: Math.floor(amount / EUROS_PER_SPY),
        counterIntelGain: Math.min(
          COUNTER_INTEL_CAP_PER_INVESTMENT,
          amount / EUROS_PER_FULL_COUNTER_INTEL,
          1 - country.intelligence.counterIntelLevel,
        ),
      };
  }
}

/** The player's place among all economies, 1 = largest GDP. */
export function gdpRank(state: GameState): { rank: number; total: number } {
  const player = state.countries[state.playerCountryId];
  const all = Object.values(state.countries);
  const ahead = player ? all.filter((c) => c.economy.gdp > player.economy.gdp).length : 0;
  return { rank: ahead + 1, total: all.length };
}

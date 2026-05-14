// AI for non-player countries. Utility scoring per archetype.
// Pure: same (state, countryId, rng-state) → same decision.

import { getAvailableActions } from '../actions/index.js';
import type { Rng } from '../rng.js';
import type {
  Action,
  AiArchetype,
  CountryId,
  GameState,
  TechDefinition,
} from '../types.js';
import { getRelation } from '../actions/helpers.js';

type ActionType = Action['type'];

const ARCHETYPE_BASE: Record<AiArchetype, Record<ActionType, number>> = {
  pacifist_trader: {
    invest: 1.0,
    startResearch: 0.9,
    setTaxRate: 0.3,
    diplomacy: 0.9,
    deployArmy: 0.1,
    deploySpy: 0.4,
    placateFaction: 0.5,
  },
  regional_bully: {
    invest: 0.6,
    startResearch: 0.4,
    setTaxRate: 0.2,
    diplomacy: 0.3,
    deployArmy: 1.0,
    deploySpy: 0.6,
    placateFaction: 0.4,
  },
  cold_isolationist: {
    invest: 0.8,
    startResearch: 0.6,
    setTaxRate: 0.3,
    diplomacy: 0.2,
    deployArmy: 0.4,
    deploySpy: 0.5,
    placateFaction: 0.6,
  },
  opportunist: {
    invest: 0.7,
    startResearch: 0.6,
    setTaxRate: 0.3,
    diplomacy: 0.6,
    deployArmy: 0.5,
    deploySpy: 0.9,
    placateFaction: 0.4,
  },
  superpower: {
    invest: 0.7,
    startResearch: 0.7,
    setTaxRate: 0.2,
    diplomacy: 0.6,
    deployArmy: 0.7,
    deploySpy: 0.7,
    placateFaction: 0.5,
  },
};

const EPSILON = 0.05;

/**
 * Decide an action for `countryId`. Returns null if nothing scored above the
 * skip threshold (the country chooses to wait this turn).
 */
export function decideAiAction(
  state: GameState,
  countryId: CountryId,
  rng: Rng,
  techCatalog: readonly TechDefinition[] = [],
): Action | null {
  const country = state.countries[countryId];
  if (!country) return null;
  const personality = country.aiPersonality;
  if (!personality) return null;

  const candidates = getAvailableActions(state, countryId, techCatalog);
  if (candidates.length === 0) return null;

  // ε-greedy: with small probability pick at random to keep exploration.
  if (rng.next() < EPSILON) {
    return rng.pick(candidates);
  }

  const base = ARCHETYPE_BASE[personality.archetype];
  let bestScore = -Infinity;
  let best: Action | null = null;

  for (const action of candidates) {
    const score = scoreAction(state, country.id, action, base, personality, rng.next());
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }

  // Threshold to allow "skip turn" — if everything looks bad.
  if (bestScore < 0.1) return null;
  return best;
}

function scoreAction(
  state: GameState,
  countryId: CountryId,
  action: Action,
  base: Record<ActionType, number>,
  personality: NonNullable<GameState['countries'][string]['aiPersonality']>,
  noise: number,
): number {
  const country = state.countries[countryId];
  if (!country) return -1;
  let score = base[action.type];

  // Situational modifiers.
  const treasury = country.economy.treasury;
  const lowMoney = treasury < 200_000_000;
  const veryLowMoney = treasury < 0;
  const popularity = country.politics.popularity;

  switch (action.type) {
    case 'invest': {
      // Don't invest if broke; bias by target.
      if (action.amount > treasury) return -1;
      if (action.target === 'economy' || action.target === 'infra') {
        score += lowMoney ? 0.4 : 0.1;
      }
      if (action.target === 'military') {
        score += personality.aggressiveness * 0.5;
      }
      if (action.target === 'intel') {
        score += personality.paranoia * 0.4;
      }
      if (action.target === 'research') {
        score += 0.2;
      }
      if (veryLowMoney) score -= 1; // emergency, don't burn cash on multipliers
      break;
    }
    case 'startResearch': {
      score += 0.2;
      break;
    }
    case 'setTaxRate': {
      // AI rarely needs to fiddle taxes; only when popularity tanking.
      if (popularity < 30 && action.rate < country.economy.taxRate) score += 0.3;
      else score -= 0.3;
      break;
    }
    case 'diplomacy': {
      const rel = getRelation(state, countryId, action.target);
      const att = rel?.attitude ?? 0;
      switch (action.kind) {
        case 'proposeAlliance':
          score += (att / 100) * 0.6 + personality.pragmatism * 0.2;
          break;
        case 'tradeDeal':
          score += (att / 100) * 0.4 + 0.2;
          break;
        case 'imposeSanction':
          score += (-att / 100) * 0.4 + personality.aggressiveness * 0.2;
          break;
        case 'declareWar':
          score +=
            personality.aggressiveness * 0.6 +
            personality.expansionism * 0.4 +
            (-att / 100) * 0.3;
          if (veryLowMoney) score -= 1;
          break;
        case 'sueForPeace':
          score += veryLowMoney ? 0.6 : 0.3;
          break;
        case 'breakAlliance':
          score += personality.paranoia * 0.2 - 0.4;
          break;
        case 'liftSanction':
          score += personality.pragmatism * 0.2;
          break;
      }
      break;
    }
    case 'deployArmy': {
      score += personality.aggressiveness * 0.4;
      if (action.units > country.military.armySize) return -1;
      break;
    }
    case 'deploySpy': {
      score += personality.paranoia * 0.3 + (action.op.type === 'steal_tech' ? 0.2 : 0);
      if (country.intelligence.spyCount < 1) return -1;
      break;
    }
    case 'placateFaction': {
      const f = country.politics.factions[action.factionId];
      if (!f) return -1;
      // Big bonus if the faction is angry.
      score += f.satisfaction < 30 ? 0.6 : -0.2;
      break;
    }
  }

  // Random noise (small) so ties break deterministically per call.
  score += (noise - 0.5) * 0.05;
  return score;
}

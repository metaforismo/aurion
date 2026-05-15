// AI for non-player countries. Utility scoring per archetype.
// Pure: same (state, countryId, rng-state) → same decision.

import { getAvailableActions } from '../actions/index.js';
import type { Rng } from '../rng.js';
import type {
  Action,
  AiArchetype,
  CountryId,
  DifficultyTuning,
  GameState,
  TechDefinition,
} from '../types.js';
import { getRelation } from '../actions/helpers.js';

/**
 * Tick before which the AI strongly avoids declaring war — used to keep the
 * early game peaceful enough that the player can establish themselves.
 * Wars after this point are still possible but require very poor relations.
 */
const EARLY_GAME_WAR_GRACE_TICKS = 50;
/** AI declines to declare war unless it has at least this military-power ratio. */
const WAR_POWER_RATIO_REQUIRED = 0.9;

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
    deployArmy: 0.5,
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
 *
 * The optional `difficulty` parameter applies multipliers to specific action
 * scores (aggression on declareWar/deployArmy; alliance bias on proposeAlliance)
 * so the same AI feels different across Easy/Normal/Hard without changing logic.
 */
export function decideAiAction(
  state: GameState,
  countryId: CountryId,
  rng: Rng,
  techCatalog: readonly TechDefinition[] = [],
  difficulty?: DifficultyTuning,
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
    const score = scoreAction(
      state,
      country.id,
      action,
      base,
      personality,
      rng.next(),
      difficulty,
    );
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
  difficulty?: DifficultyTuning,
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
      if (action.target === 'economy') {
        // Growing GDP is the long-term engine of every win condition.
        score += 0.2 + (lowMoney ? 0.2 : 0);
        // Pacifist traders biased toward growth; bullies less so.
        if (personality.archetype === 'pacifist_trader') score += 0.1;
        if (personality.archetype === 'superpower') score += 0.1;
      }
      if (action.target === 'infra') {
        // Infra is GDP + popularity, so it's valuable for any archetype.
        score += 0.2 + (lowMoney ? 0.15 : 0);
        if (popularity < 50) score += 0.15;
      }
      if (action.target === 'military') {
        score += personality.aggressiveness * 0.4;
        // At war: we need armies.
        let atWar = false;
        for (const r of Object.values(state.relations)) {
          if (
            (r.countryA === countryId || r.countryB === countryId) &&
            r.atWar
          ) {
            atWar = true;
            break;
          }
        }
        if (atWar) score += 0.4;
      }
      if (action.target === 'intel') {
        // Spies are useful but not valuable to stockpile past a small reserve.
        const cap = 8;
        if (country.intelligence.spyCount >= cap) {
          score -= 0.4;
        } else {
          score += personality.paranoia * 0.3;
        }
      }
      if (action.target === 'research') {
        // Only valuable when we actually have something running to feed.
        if (country.science.activeResearch !== null) {
          score += 0.3;
        } else {
          // Don't dump money into research with no active project.
          score -= 0.4;
        }
      }
      if (veryLowMoney) score -= 1; // emergency, don't burn cash on multipliers
      // Reward larger investments when wealthy enough to afford them, so big
      // economies actually grow rather than stockpiling treasury forever; but
      // small enough to leave reserves for shocks. Mild bias only.
      if (action.amount >= 1_000_000_000 && treasury > action.amount * 4) {
        if (action.target === 'economy' || action.target === 'infra') score += 0.1;
      }
      break;
    }
    case 'startResearch': {
      // If we are idle (no active research), prefer to start something rather
      // than burn money on invest/research that goes into a vacuum.
      if (country.science.activeResearch === null) {
        score += 0.6;
      } else {
        score += 0.2;
      }
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
        case 'declareWar': {
          // Wars are costly and noisy. The AI should only declare war when the
          // target is a clear adversary (very negative attitude), the AI has
          // a real military advantage, and the early-game grace period is over.
          // Existing wars also discourage opening new fronts.
          // Negative base bias keeps random wars rare.
          score = -0.4;
          if (state.tick < EARLY_GAME_WAR_GRACE_TICKS) {
            // Strong dampener for the first ~year of game-time.
            score -= 0.6;
          }
          // Attitude must be sour. If attitude is neutral or positive, very low score.
          score += (-att / 100) * 0.6;
          // Require some military advantage to even consider war.
          const target = state.countries[action.target];
          if (target) {
            const myPower =
              country.military.armySize * (1 + country.military.doctrineLevel);
            const theirPower =
              target.military.armySize * (1 + target.military.doctrineLevel) + 1;
            const ratio = myPower / theirPower;
            // Below the required ratio: very large penalty.
            if (ratio < WAR_POWER_RATIO_REQUIRED) {
              score -= 1.0;
            } else {
              // Reward clear superiority modestly.
              score += Math.min(0.4, (ratio - WAR_POWER_RATIO_REQUIRED) * 0.4);
            }
          }
          // Personality contribution: aggressive/expansionist countries weigh war higher,
          // but the contribution is intentionally smaller than the situational penalties.
          score +=
            personality.aggressiveness * 0.4 + personality.expansionism * 0.2;
          // Already at war with too many countries: don't open more fronts.
          let activeWars = 0;
          for (const r of Object.values(state.relations)) {
            if (
              (r.countryA === countryId || r.countryB === countryId) &&
              r.atWar
            ) {
              activeWars++;
            }
          }
          if (activeWars >= 1) score -= 0.5 * activeWars;
          if (veryLowMoney) score -= 1;
          break;
        }
        case 'sueForPeace':
          // More eager to end wars unless we are clearly winning.
          score += 0.4;
          if (veryLowMoney) score += 0.6;
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
      // Default base for deployArmy is conservative — moving troops is a
      // commitment, not an idle move. Reward heavily when there's an active
      // war we can affect, otherwise penalize foreign deployments.
      score = 0.0;
      if (action.units > country.military.armySize) return -1;
      // Find host of the target region.
      let host: CountryId | null = null;
      for (const c of Object.values(state.countries)) {
        if (c.regionId === action.target) {
          host = c.id;
          break;
        }
      }
      if (host === null || host === countryId) {
        // Garrisoning at home: small positive, scaled by paranoia.
        score += 0.2 + personality.paranoia * 0.2;
      } else {
        const rel = getRelation(state, countryId, host);
        if (rel?.atWar) {
          // Offensive deployment into an enemy region: strong action when at war.
          score += 0.6 + personality.aggressiveness * 0.4;
        } else if (rel?.treaties.includes('alliance')) {
          // Forward-basing in an ally's region: neutral; only do it if paranoid.
          score += personality.paranoia * 0.3 - 0.2;
        } else {
          // Should be filtered by getAvailableActions, but score very low just in case.
          score -= 1;
        }
      }
      // Avoid spending all our reserves at once.
      if (action.units > country.military.armySize * 0.75) score -= 0.4;
      if (veryLowMoney) score -= 0.5;
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

  // Difficulty multipliers — applied AFTER score is otherwise final so the
  // existing situational logic is untouched. We multiply (rather than add) so
  // negative scores stay negative on Easy and grow on Hard.
  if (difficulty) {
    const aggression = difficulty.modifiers.aiAggression ?? 1;
    const allianceBias = difficulty.modifiers.aiAllianceBias ?? 1;
    if (action.type === 'deployArmy') {
      score = scaleScore(score, aggression);
    } else if (action.type === 'diplomacy') {
      if (action.kind === 'declareWar') {
        score = scaleScore(score, aggression);
      } else if (action.kind === 'proposeAlliance') {
        score = scaleScore(score, allianceBias);
      }
    }
  }

  return score;
}

/**
 * Multiply a score by a positive factor while preserving sign so that a
 * very-negative score stays very-negative on Easy (factor < 1 dampens it less
 * is fine) and a positive score grows on Hard. Sign-preserving scaling avoids
 * flipping a "do not declare war" intuition into a "declare war" one.
 */
function scaleScore(score: number, factor: number): number {
  if (factor === 1) return score;
  if (score >= 0) return score * factor;
  // Negative scores: dampening on Easy (factor<1) makes them less negative,
  // amplifying on Hard (factor>1) makes them more negative. We invert to get
  // the intended directionality (higher factor = MORE inclined to take it).
  return score / factor;
}

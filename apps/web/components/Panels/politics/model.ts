// Politics maths for the panel. The engine keeps these rules inside `tick`
// and `checkWinLoss` and exports neither the formulas nor the constants, so
// they are mirrored here (tick.ts `stepPolitics` / `stepFactions`,
// checkWinLoss.ts, actions/placateFaction.ts, policies/index.ts) to tell the
// player where popularity is heading and how close the danger is.

import {
  POLICIES,
  factionModifiers,
  type Country,
  type FactionId,
  type GameState,
  type GovernmentType,
  type PolicyId,
} from '@aurion/engine';

export const FACTIONS: readonly FactionId[] = ['army', 'business', 'religious', 'populist', 'reformist'];

/** actions/placateFaction.ts */
export const PLACATE_COST = 100_000_000;
export const PLACATE_BOOST = 15;

/** checkWinLoss.ts — popularity below this, for this many weeks, loses the game. */
export const LOW_POPULARITY_THRESHOLD = 10;
export const LOSS_LOW_POPULARITY_WEEKS = 12;
/** checkWinLoss.ts — every faction below this, for this many weeks, loses the game. */
export const HOSTILE_THRESHOLD = 20;
export const LOSS_ALL_FACTIONS_HOSTILE_WEEKS = 12;

/** tick.ts `stepPolitics`. */
const POPULARITY_BASELINE = 50;
const PULL_TO_BASELINE = 0.02;
const PULL_TO_FACTIONS = 0.05;
const DEBT_PENALTY = 0.5;
/** tick.ts `stepFactions`. */
const FACTION_BASELINE = 50;
const FACTION_PULL = 0.01;

/** Weekly satisfaction nudge each form of government gives (tick.ts `governmentBonus`). */
export const GOVERNMENT_BONUS: Record<GovernmentType, Partial<Record<FactionId, number>>> = {
  democracy: { reformist: 0.05, business: 0.02, populist: 0.02 },
  autocracy: { army: 0.05, business: 0.02, reformist: -0.05 },
  oligarchy: { business: 0.08, populist: -0.05 },
  theocracy: { religious: 0.08, reformist: -0.05 },
  monarchy: { army: 0.04, religious: 0.04, populist: -0.02 },
};

/** Average satisfaction, each faction counted by its influence. */
export function factionMood(country: Country): number {
  let weighted = 0;
  let influence = 0;
  for (const f of Object.values(country.politics.factions)) {
    weighted += f.satisfaction * f.influence;
    influence += f.influence;
  }
  return influence > 0 ? weighted / influence : POPULARITY_BASELINE;
}

export function influenceShare(country: Country, id: FactionId): number {
  const total = Object.values(country.politics.factions).reduce((sum, f) => sum + f.influence, 0);
  return total > 0 ? country.politics.factions[id].influence / total : 0;
}

type PolicyPull = { popularity: number; factions: Partial<Record<FactionId, number>> };

/** Weekly popularity and satisfaction points coming from standing policies. */
export function policyPull(state: GameState): PolicyPull {
  const out: PolicyPull = { popularity: 0, factions: {} };
  for (const id of state.policies?.active ?? []) {
    const fx = POLICIES.find((p) => p.id === id)?.effects;
    if (!fx) continue;
    out.popularity += fx.popularity ?? 0;
    for (const [fid, delta] of Object.entries(fx.factions ?? {}) as [FactionId, number][]) {
      out.factions[fid] = (out.factions[fid] ?? 0) + delta;
    }
  }
  return out;
}

function stepPopularity(popularity: number, mood: number, policy: number, inDebt: boolean): number {
  let pop = popularity + policy;
  pop += (POPULARITY_BASELINE - pop) * PULL_TO_BASELINE;
  pop += (mood - pop) * PULL_TO_FACTIONS;
  if (inDebt) pop -= DEBT_PENALTY;
  return Math.max(0, Math.min(100, pop));
}

export type PopularityOutlook = {
  /** Change expected next week. */
  weekly: number;
  /** Where popularity settles if the factions stay as they are today. */
  settlesAt: number;
};

export function popularityOutlook(country: Country, state: GameState, mood = factionMood(country)): PopularityOutlook {
  // Standing policies, plus what the clergy's stance adds or takes away.
  const policy = policyPull(state).popularity + factionModifiers(country).popularity;
  const inDebt = country.economy.treasury < 0;
  const now = country.politics.popularity;
  let settled = now;
  // The weekly rule converges in a few years of game time; 400 steps is plenty.
  for (let i = 0; i < 400; i += 1) settled = stepPopularity(settled, mood, policy, inDebt);
  return { weekly: stepPopularity(now, mood, policy, inDebt) - now, settlesAt: settled };
}

/** Weekly satisfaction change of one faction before any player action. */
export function factionDrift(country: Country, state: GameState, id: FactionId): number {
  const satisfaction = country.politics.factions[id].satisfaction;
  return (
    (FACTION_BASELINE - satisfaction) * FACTION_PULL +
    (GOVERNMENT_BONUS[country.politics.governmentType][id] ?? 0) +
    (policyPull(state).factions[id] ?? 0)
  );
}

/** Policies that please / irritate a faction, from the engine catalogue. */
export function policiesFor(id: FactionId): { likes: PolicyId[]; dislikes: PolicyId[] } {
  const likes: PolicyId[] = [];
  const dislikes: PolicyId[] = [];
  for (const policy of POLICIES) {
    const delta = policy.effects.factions?.[id] ?? 0;
    if (delta > 0) likes.push(policy.id);
    else if (delta < 0) dislikes.push(policy.id);
  }
  return { likes, dislikes };
}

/** Above this a faction is doing fine and no concession is worth flagging. */
const CONTENT_ENOUGH = 50;

/**
 * The faction a concession helps most right now, or null when every faction
 * is content: the unhappy one whose mood weighs most on popularity (distance
 * from full satisfaction × influence), with any hostile faction taken first.
 */
export function mostUrgentFaction(country: Country): FactionId | null {
  let best: FactionId | null = null;
  let bestScore = -Infinity;
  for (const id of FACTIONS) {
    const f = country.politics.factions[id];
    if (f.satisfaction >= CONTENT_ENOUGH) continue;
    const hostile = f.satisfaction < HOSTILE_THRESHOLD ? 1_000_000 : 0;
    const score = hostile + (100 - f.satisfaction) * f.influence;
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

/** Whole weeks a streak may last before it ends the game, at this difficulty. */
export function lossLimit(baseWeeks: number, tolerance: number): number {
  return Math.ceil(baseWeeks * tolerance);
}

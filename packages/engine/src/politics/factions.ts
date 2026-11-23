// What a faction's loyalty is worth. A faction that is satisfied enough
// puts its weight behind the government; one that is hostile works against
// it. Applies to every country, the player's and the AI's alike.

import type { Country, FactionId } from '../types.js';

/** Satisfaction from which a faction is loyal, and under which it is hostile. */
export const FACTION_LOYAL_AT = 70;
export const FACTION_HOSTILE_AT = 30;

export type FactionStance = 'loyal' | 'neutral' | 'hostile';

export function factionStance(satisfaction: number): FactionStance {
  if (satisfaction >= FACTION_LOYAL_AT) return 'loyal';
  if (satisfaction <= FACTION_HOSTILE_AT) return 'hostile';
  return 'neutral';
}

export type FactionModifiers = {
  /** Added to 1 as a multiplier on weekly income (when positive). */
  incomeMul: number;
  /** Multiplier on research points. */
  researchMul: number;
  /** Multiplier on combat power. */
  combatMul: number;
  /** Multiplier on organic GDP growth. */
  growthMul: number;
  /** Popularity points per week. */
  popularity: number;
};

export type FactionLever = keyof FactionModifiers;

/** The one thing each faction moves, and by how much either way. */
export const FACTION_LEVERAGE: Record<FactionId, { lever: FactionLever; loyal: number; hostile: number }> = {
  army: { lever: 'combatMul', loyal: 0.1, hostile: -0.15 },
  business: { lever: 'incomeMul', loyal: 0.06, hostile: -0.08 },
  religious: { lever: 'popularity', loyal: 0.06, hostile: -0.08 },
  populist: { lever: 'growthMul', loyal: 0.5, hostile: -0.75 },
  reformist: { lever: 'researchMul', loyal: 0.1, hostile: -0.12 },
};

/** What a faction contributes right now (0 while it is neutral). */
export function factionEffect(id: FactionId, satisfaction: number): number {
  const stance = factionStance(satisfaction);
  return stance === 'neutral' ? 0 : FACTION_LEVERAGE[id][stance];
}

export function factionModifiers(country: Country): FactionModifiers {
  const out: FactionModifiers = { incomeMul: 0, researchMul: 0, combatMul: 0, growthMul: 0, popularity: 0 };
  for (const [id, f] of Object.entries(country.politics.factions) as [FactionId, { satisfaction: number }][]) {
    const lever = FACTION_LEVERAGE[id];
    if (lever) out[lever.lever] += factionEffect(id, f.satisfaction);
  }
  return out;
}

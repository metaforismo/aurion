// Derived facts the wizard shows about worlds, nations, difficulty presets
// and victory paths. Pure functions over scenario data — no React.

import type { CountryInit, DifficultyTuning, Scenario, VictoryRule } from '@aurion/engine';

import type { ScenarioId } from '../../../lib/scenarios';

/** Worlds known to ship eras, used until the scenario data has loaded. */
const ERA_WORLDS: ReadonlySet<string> = new Set(['mondo-contemporaneo', 'guerra-fredda']);

export function worldHasEras(id: ScenarioId, scenario: Scenario | undefined): boolean {
  return scenario ? (scenario.eras?.length ?? 0) > 0 : ERA_WORLDS.has(id);
}

export type WorldFacts = {
  nations: number;
  playable: number;
  nuclearPowers: number;
  hasBlocs: boolean;
  hasCouncil: boolean;
  eras: number;
  /** Whether Throne's "pariah" defeat applies in this world. */
  isolationDefeat: boolean;
};

export function worldFacts(scenario: Scenario): WorldFacts {
  return {
    nations: scenario.countries.length,
    playable: scenario.playableCountries.length,
    nuclearPowers: scenario.countries.filter((c) => c.nuclear !== undefined).length,
    hasBlocs: (scenario.blocs?.length ?? 0) > 0,
    hasCouncil: (scenario.unCouncilMembers?.length ?? 0) > 0,
    eras: scenario.eras?.length ?? 0,
    isolationDefeat: scenario.dethroneIsolationOnByDefault === true,
  };
}

// ---------------------------------------------------------------------------
// Nations
// ---------------------------------------------------------------------------

export type StartLevel = 'gentle' | 'balanced' | 'steep';

export type NationFacts = {
  country: CountryInit;
  gdpRank: number;
  armyRank: number;
  nations: number;
  /** Total standing forces: army + navy + air force. */
  forces: number;
  start: StartLevel;
};

function forcesOf(c: CountryInit): number {
  return c.military.armySize + c.military.navy + c.military.airforce;
}

export function nationFacts(scenario: Scenario, countryId: string): NationFacts | null {
  const country = scenario.countries.find((c) => c.id === countryId);
  if (!country) return null;
  const nations = scenario.countries.length;
  const gdpRank = 1 + scenario.countries.filter((c) => c.economy.gdp > country.economy.gdp).length;
  const forces = forcesOf(country);
  const armyRank = 1 + scenario.countries.filter((c) => forcesOf(c) > forces).length;
  // How far down the table you start, 0 (top) .. 1 (bottom); the economy
  // weighs more because it funds everything else.
  const depth = nations > 1 ? (0.65 * (gdpRank - 1) + 0.35 * (armyRank - 1)) / (nations - 1) : 0;
  const start: StartLevel = depth < 0.3 ? 'gentle' : depth < 0.6 ? 'balanced' : 'steep';
  return { country, gdpRank, armyRank, nations, forces, start };
}

/** Every nation's GDP, largest first — the tiny "where you stand" chart. */
export function gdpLadder(scenario: Scenario): { id: string; gdp: number }[] {
  return scenario.countries
    .map((c) => ({ id: c.id, gdp: c.economy.gdp }))
    .sort((a, b) => b.gdp - a.gdp);
}

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------

export function isIronMan(preset: DifficultyTuning): boolean {
  return preset.ironMan === true || preset.id === 'ironMan';
}

const MODIFIER_ORDER = [
  'playerIncome',
  'aiAggression',
  'aiResearchSpeed',
  'eventDifficulty',
  'aiAllianceBias',
  'spyDetectionAgainstPlayer',
  'lossToleranceWeeks',
  'eventChanceMultiplier',
] as const;

export type ModifierKey = (typeof MODIFIER_ORDER)[number];

/** Modifiers where a higher value helps the player. */
const GOOD_WHEN_HIGH: ReadonlySet<ModifierKey> = new Set(['playerIncome', 'lossToleranceWeeks']);

export type ModifierDelta = {
  key: ModifierKey;
  /** Signed change from the reference rules, e.g. +0.3 = +30%. */
  delta: number;
  /** Whether the change is in the player's favour. */
  helps: boolean;
};

/** The ways a preset departs from the reference rules (multiplier 1.0). */
export function modifierDeltas(preset: DifficultyTuning): ModifierDelta[] {
  const out: ModifierDelta[] = [];
  for (const key of MODIFIER_ORDER) {
    const value = preset.modifiers[key];
    if (value === undefined) continue;
    const delta = Math.round((value - 1) * 100) / 100;
    if (delta === 0) continue;
    out.push({ key, delta, helps: GOOD_WHEN_HIGH.has(key) ? delta > 0 : delta < 0 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Victory paths
// ---------------------------------------------------------------------------

/** A victory rule reduced to the one concrete target the player aims at. */
export type VictoryTarget =
  | { kind: 'gdpRank'; rank: number }
  | { kind: 'allies'; count: number }
  | { kind: 'tech'; techNameKey: string }
  | { kind: 'coverage'; percent: number }
  | { kind: 'kardashev'; type: number }
  | null;

export function victoryTarget(scenario: Scenario, rule: VictoryRule): VictoryTarget {
  switch (rule.kind) {
    case 'gdpRank':
      return { kind: 'gdpRank', rank: rule.rankAtMost };
    case 'controlNCountries':
      // The engine counts the player plus every allied nation.
      return { kind: 'allies', count: Math.max(1, rule.n - 1) };
    case 'completeTech': {
      const tech = scenario.techTree.find((t) => t.id === rule.techId);
      return tech ? { kind: 'tech', techNameKey: tech.nameKey } : null;
    }
    case 'allianceCoverage':
      return { kind: 'coverage', percent: rule.minPercent };
    case 'kardashev':
      return { kind: 'kardashev', type: Math.floor(rule.atLeast) };
    default:
      return null;
  }
}

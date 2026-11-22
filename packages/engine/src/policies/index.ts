// National policies — standing choices with a price.
//
// A policy is a lever the player holds down: while enacted it keeps paying
// out (and keeps costing) every week. Only a few can be active at once, some
// exclude each other, and changing course is not free — enacting costs a
// little popularity and a repealed policy cannot be re-enacted for half a
// year. The point is trade-offs the player can read at a glance.
//
// Engine integration:
//   - `applyEnactPolicy` / `applyRepealPolicy` — player actions.
//   - `tickPolicies(state)` — weekly effects (after the economy step).
//   - `policyModifiers(state)` — multipliers other systems consult
//     (megaproject cost / build speed).
//
// Pure functions only.

import type {
  Action,
  ApplyActionResult,
  Country,
  CountryId,
  FactionId,
  GameState,
  PolicyDef,
  PolicyId,
  PolicyState,
} from '../types.js';

/** Policies the player may hold at the same time. */
export const POLICY_SLOTS = 3;
/** Extra slot once the civilisation reaches Kardashev Type I. */
export const POLICY_SLOTS_TYPE_ONE = 4;
/** Weeks before a repealed policy can be enacted again. */
export const POLICY_COOLDOWN_TICKS = 26;
/** One-off popularity cost of changing course. */
export const POLICY_ENACT_POPULARITY_COST = 2;

export const POLICIES: readonly PolicyDef[] = [
  // ---- Economy ----------------------------------------------------------
  {
    id: 'austerity', category: 'economy', excludes: ['welfare', 'stimulus'],
    effects: { incomeMul: 0.14, popularity: -0.35, factions: { populist: -0.25, business: 0.1 } },
  },
  {
    id: 'stimulus', category: 'economy', excludes: ['austerity'],
    effects: { upkeep: 0.1, gdpGrowth: 0.0009, factions: { business: 0.15 } },
  },
  {
    id: 'free_trade', category: 'economy', excludes: [],
    effects: { incomeMul: 0.07, factions: { business: 0.2, populist: -0.15 } },
  },
  {
    id: 'industrial_plan', category: 'economy', excludes: [],
    effects: { upkeep: 0.05, projectCostMul: -0.12, factions: { business: 0.1 } },
  },
  // ---- Society ----------------------------------------------------------
  {
    id: 'welfare', category: 'society', excludes: ['austerity'],
    effects: { upkeep: 0.1, popularity: 0.35, factions: { populist: 0.25 } },
  },
  {
    id: 'state_media', category: 'society', excludes: ['open_society'],
    effects: { popularity: 0.3, factions: { reformist: -0.3 } },
  },
  {
    id: 'open_society', category: 'society', excludes: ['state_media', 'surveillance'],
    effects: { researchMul: 0.08, factions: { reformist: 0.3, religious: -0.15 } },
  },
  {
    id: 'faith_accord', category: 'society', excludes: [],
    effects: { upkeep: 0.02, factions: { religious: 0.3, reformist: -0.1 } },
  },
  // ---- Security ---------------------------------------------------------
  {
    id: 'conscription', category: 'security', excludes: [],
    effects: { incomeMul: -0.04, armyGrowth: 0.004, popularity: -0.12, factions: { army: 0.25 } },
  },
  {
    id: 'surveillance', category: 'security', excludes: ['open_society'],
    effects: { upkeep: 0.03, counterIntel: 0.004, factions: { reformist: -0.25, army: 0.1 } },
  },
  // ---- Science ----------------------------------------------------------
  {
    id: 'research_grants', category: 'science', excludes: [],
    effects: { upkeep: 0.08, researchMul: 0.25, factions: { reformist: 0.1 } },
  },
  {
    id: 'space_program', category: 'science', excludes: [],
    effects: { upkeep: 0.07, projectSpeed: 0.25 },
  },
] as const;

const BY_ID: ReadonlyMap<PolicyId, PolicyDef> = new Map(POLICIES.map((p) => [p.id, p]));

export function getPolicy(id: PolicyId): PolicyDef | undefined {
  return BY_ID.get(id);
}

export function initPolicies(): PolicyState {
  return { active: [], cooldownUntil: {}, speedCarry: 0 };
}

export function policySlots(state: GameState): number {
  return (state.cosmos?.kardashev ?? 0) >= 1 ? POLICY_SLOTS_TYPE_ONE : POLICY_SLOTS;
}

export type PolicyStatus =
  | { status: 'active' }
  | { status: 'available' }
  | { status: 'cooldown'; weeksLeft: number }
  | { status: 'excluded'; by: PolicyId[] }
  | { status: 'noSlot' };

export function getPolicyStatus(state: GameState, def: PolicyDef): PolicyStatus {
  const policies = state.policies ?? initPolicies();
  if (policies.active.includes(def.id)) return { status: 'active' };
  const until = policies.cooldownUntil[def.id];
  if (until !== undefined && until > state.tick) {
    return { status: 'cooldown', weeksLeft: until - state.tick };
  }
  const by = policies.active.filter(
    (id) => def.excludes.includes(id) || (getPolicy(id)?.excludes.includes(def.id) ?? false),
  );
  if (by.length > 0) return { status: 'excluded', by };
  if (policies.active.length >= policySlots(state)) return { status: 'noSlot' };
  return { status: 'available' };
}

/** Combined multipliers other systems read. All values are additive deltas. */
export type PolicyModifiers = {
  /** Megaproject price multiplier delta (−0.12 = 12% cheaper). */
  projectCostMul: number;
  /** Megaproject build-speed bonus (0.25 = 25% faster). */
  projectSpeed: number;
  /** Research output bonus. */
  researchMul: number;
  /** Weekly income bonus. */
  incomeMul: number;
  /** Weekly upkeep as a share of weekly income. */
  upkeep: number;
};

export function policyModifiers(state: GameState): PolicyModifiers {
  const out: PolicyModifiers = { projectCostMul: 0, projectSpeed: 0, researchMul: 0, incomeMul: 0, upkeep: 0 };
  for (const id of state.policies?.active ?? []) {
    const fx = getPolicy(id)?.effects;
    if (!fx) continue;
    out.projectCostMul += fx.projectCostMul ?? 0;
    out.projectSpeed += fx.projectSpeed ?? 0;
    out.researchMul += fx.researchMul ?? 0;
    out.incomeMul += fx.incomeMul ?? 0;
    out.upkeep += fx.upkeep ?? 0;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type EnactPolicyAction = Extract<Action, { type: 'enactPolicy' }>;
export type RepealPolicyAction = Extract<Action, { type: 'repealPolicy' }>;

export function applyEnactPolicy(
  state: GameState,
  action: EnactPolicyAction,
  countryId: CountryId,
): ApplyActionResult {
  if (countryId !== state.playerCountryId) return { state, errors: ['errors.policy.playerOnly'] };
  const def = getPolicy(action.policyId);
  const player = state.countries[countryId];
  if (!def || !player) return { state, errors: ['errors.policy.unknown'] };
  const status = getPolicyStatus(state, def);
  if (status.status === 'active') return { state, errors: ['errors.policy.alreadyActive'] };
  if (status.status === 'cooldown') return { state, errors: ['errors.policy.cooldown'] };
  if (status.status === 'excluded') return { state, errors: ['errors.policy.excluded'] };
  if (status.status === 'noSlot') return { state, errors: ['errors.policy.noSlot'] };

  const policies = state.policies ?? initPolicies();
  return {
    state: {
      ...state,
      countries: {
        ...state.countries,
        [countryId]: {
          ...player,
          politics: {
            ...player.politics,
            popularity: Math.max(0, player.politics.popularity - POLICY_ENACT_POPULARITY_COST),
          },
        },
      },
      policies: { ...policies, active: [...policies.active, def.id] },
    },
    errors: [],
  };
}

export function applyRepealPolicy(
  state: GameState,
  action: RepealPolicyAction,
  countryId: CountryId,
): ApplyActionResult {
  if (countryId !== state.playerCountryId) return { state, errors: ['errors.policy.playerOnly'] };
  const policies = state.policies;
  if (!policies || !policies.active.includes(action.policyId)) {
    return { state, errors: ['errors.policy.notActive'] };
  }
  return {
    state: {
      ...state,
      policies: {
        ...policies,
        active: policies.active.filter((id) => id !== action.policyId),
        cooldownUntil: {
          ...policies.cooldownUntil,
          [action.policyId]: state.tick + POLICY_COOLDOWN_TICKS,
        },
      },
    },
    errors: [],
  };
}

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function tickPolicies(state: GameState): GameState {
  const policies = state.policies;
  const player = state.countries[state.playerCountryId];
  if (!policies || policies.active.length === 0 || !player) return state;

  const income = player.economy.weeklyIncome;
  const basis = Math.max(0, income);
  let treasuryDelta = 0;
  let gdp = player.economy.gdp;
  let popularity = player.politics.popularity;
  let army = player.military.armySize;
  let counterIntel = player.intelligence.counterIntelLevel;
  let researchBonus = 0;
  const factions = { ...player.politics.factions };

  for (const id of policies.active) {
    const fx = getPolicy(id)?.effects;
    if (!fx) continue;
    treasuryDelta += basis * (fx.incomeMul ?? 0) - basis * (fx.upkeep ?? 0);
    if (fx.gdpGrowth) gdp *= 1 + fx.gdpGrowth;
    popularity += fx.popularity ?? 0;
    if (fx.armyGrowth) army *= 1 + fx.armyGrowth;
    counterIntel += fx.counterIntel ?? 0;
    researchBonus += fx.researchMul ?? 0;
    for (const [fid, delta] of Object.entries(fx.factions ?? {}) as [FactionId, number][]) {
      const f = factions[fid];
      factions[fid] = { ...f, satisfaction: clamp(f.satisfaction + delta, 0, 100) };
    }
  }

  const updated: Country = {
    ...player,
    economy: { ...player.economy, treasury: player.economy.treasury + Math.round(treasuryDelta), gdp: Math.round(gdp) },
    politics: { ...player.politics, popularity: clamp(popularity, 0, 100), factions },
    military: { ...player.military, armySize: Math.round(army) },
    intelligence: { ...player.intelligence, counterIntelLevel: clamp(counterIntel, 0, 1) },
  };

  let next: GameState = { ...state, countries: { ...state.countries, [player.id]: updated } };

  // Research bonus: extra points on the active research.
  const progress = next.techTreeProgress[player.id];
  if (researchBonus > 0 && player.science.activeResearch && progress) {
    next = {
      ...next,
      techTreeProgress: {
        ...next.techTreeProgress,
        [player.id]: {
          ...progress,
          accumulatedPoints: progress.accumulatedPoints + player.science.researchOutput * researchBonus,
        },
      },
    };
  }
  return next;
}

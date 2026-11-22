// National policies — standing choices with weekly effects and trade-offs.

import { describe, expect, it } from 'vitest';
import {
  POLICIES,
  POLICY_COOLDOWN_TICKS,
  POLICY_ENACT_POPULARITY_COST,
  POLICY_SLOTS,
  applyAction,
  createGame,
  effectiveProjectCost,
  getCosmosProject,
  getPolicy,
  getPolicyStatus,
  policyModifiers,
  policySlots,
  projectCost,
  tickCosmos,
  tickPolicies,
} from '../src/index.js';
import type { GameState, PolicyId } from '../src/index.js';
import { makeScenario } from './fixtures.js';

function newGame(): GameState {
  const scenario = makeScenario();
  return createGame(scenario, {
    victory: 'economic',
    playerCountryId: scenario.playableCountries[0]!,
    seed: 'policies',
  });
}

const enact = (s: GameState, id: PolicyId) => applyAction(s, { type: 'enactPolicy', policyId: id });
const me = (s: GameState) => s.countries[s.playerCountryId]!;

describe('policy catalogue', () => {
  it('has unique ids and only excludes known policies', () => {
    const ids = new Set(POLICIES.map((p) => p.id));
    expect(ids.size).toBe(POLICIES.length);
    for (const p of POLICIES) for (const e of p.excludes) expect(ids.has(e)).toBe(true);
  });
});

describe('enact / repeal', () => {
  it('enacting costs popularity and occupies a slot', () => {
    const s = newGame();
    const { state, errors } = enact(s, 'welfare');
    expect(errors).toEqual([]);
    expect(state.policies!.active).toEqual(['welfare']);
    expect(me(state).politics.popularity).toBe(me(s).politics.popularity - POLICY_ENACT_POPULARITY_COST);
    expect(getPolicyStatus(state, getPolicy('welfare')!).status).toBe('active');
  });

  it('refuses mutually exclusive policies in both directions', () => {
    const s = enact(newGame(), 'welfare').state;
    expect(enact(s, 'austerity').errors).toEqual(['errors.policy.excluded']);
    const t = enact(newGame(), 'surveillance').state;
    expect(enact(t, 'open_society').errors).toEqual(['errors.policy.excluded']);
  });

  it('limits concurrent policies to the slot count', () => {
    let s = newGame();
    for (const id of ['free_trade', 'faith_accord', 'conscription'] as PolicyId[]) s = enact(s, id).state;
    expect(s.policies!.active).toHaveLength(POLICY_SLOTS);
    expect(enact(s, 'research_grants').errors).toEqual(['errors.policy.noSlot']);
    const typeOne = { ...s, cosmos: { ...s.cosmos!, kardashev: 1 } };
    expect(policySlots(typeOne)).toBe(POLICY_SLOTS + 1);
    expect(enact(typeOne, 'research_grants').errors).toEqual([]);
  });

  it('puts a repealed policy on cooldown', () => {
    const s = enact(newGame(), 'welfare').state;
    const repealed = applyAction(s, { type: 'repealPolicy', policyId: 'welfare' }).state;
    expect(repealed.policies!.active).toEqual([]);
    expect(enact(repealed, 'welfare').errors).toEqual(['errors.policy.cooldown']);
    const later = { ...repealed, tick: repealed.tick + POLICY_COOLDOWN_TICKS };
    expect(enact(later, 'welfare').errors).toEqual([]);
  });
});

describe('weekly effects', () => {
  it('charges upkeep and moves popularity and factions', () => {
    const s = enact(newGame(), 'welfare').state;
    const before = me(s);
    const after = me(tickPolicies(s));
    expect(after.economy.treasury).toBe(
      before.economy.treasury - Math.round(before.economy.weeklyIncome * 0.1),
    );
    expect(after.politics.popularity).toBeGreaterThan(before.politics.popularity);
    expect(after.politics.factions.populist.satisfaction).toBeGreaterThan(
      before.politics.factions.populist.satisfaction,
    );
  });

  it('is a no-op with nothing enacted', () => {
    const s = newGame();
    expect(tickPolicies(s)).toBe(s);
  });

  it('discounts megaprojects and speeds construction up', () => {
    let s = enact(newGame(), 'industrial_plan').state;
    const def = getCosmosProject('earth_smart_grid')!;
    expect(effectiveProjectCost(s, def)).toBe(Math.round(projectCost(s.cosmos!, def) * 0.88));
    expect(policyModifiers(s).projectCostMul).toBeCloseTo(-0.12, 6);

    s = enact(s, 'space_program').state;
    const p = me(s);
    s = { ...s, countries: { ...s.countries, [p.id]: { ...p, economy: { ...p.economy, treasury: 1e15 } } } };
    s = applyAction(s, { type: 'startProject', projectId: def.id }).state;
    let weeks = 0;
    while (s.cosmos!.active.length > 0) {
      s = tickCosmos(s, { rivalSpeed: 0 });
      weeks += 1;
    }
    // 25% faster: 10 weeks of work done in 8.
    expect(weeks).toBe(8);
  });
});

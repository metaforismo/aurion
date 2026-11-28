import { describe, expect, it } from 'vitest';
import { WORKS, WORK_SLOTS, applyAction, createGame, getWork, tick, workCost, workDuration, workStatus } from '../src/index.js';
import type { GameState, Scenario, WorkId } from '../src/index.js';
import { makeScenario, sampleTechs } from './fixtures.js';

const scenario: Scenario = makeScenario();
const rich: GameState = (() => {
  const s = createGame(scenario, { seed: 'works', victory: 'economic', playerCountryId: 'aurion' });
  const me = s.countries.aurion!;
  return { ...s, countries: { ...s.countries, aurion: { ...me, economy: { ...me.economy, treasury: 1e14 } } } };
})();
const ctx = { techCatalog: sampleTechs, scenario };
const build = (s: GameState, workId: WorkId, who = 'aurion') => applyAction(s, { type: 'buildWork', workId }, who, sampleTechs);
const pass = (s: GameState, weeks: number) => {
  let next = s;
  for (let i = 0; i < weeks; i += 1) next = tick(next, ctx);
  return next;
};

describe('national works', () => {
  it('has a sane catalogue', () => {
    const ids = new Set(WORKS.map((w) => w.id));
    expect(ids.size).toBe(WORKS.length);
    for (const w of WORKS) {
      expect(w.cost).toBeGreaterThan(0);
      expect(w.maxLevel).toBeGreaterThanOrEqual(1);
      if (w.requires) expect(ids.has(w.requires.work)).toBe(true);
    }
  });

  it('charges, builds over the weeks and pays off once finished', () => {
    const def = getWork('university')!;
    const price = workCost(rich, def, 1);
    const { state, errors } = build(rich, 'university');
    expect(errors).toEqual([]);
    expect(state.countries.aurion!.economy.treasury).toBe(rich.countries.aurion!.economy.treasury - price);
    expect(workStatus(state, def).status).toBe('building');

    const research = state.countries.aurion!.science.researchOutput;
    const done = pass(state, workDuration(def, 1));
    expect(done.works!.levels.university).toBe(1);
    expect(done.works!.active).toHaveLength(0);
    expect(done.works!.finished.at(-1)).toMatchObject({ workId: 'university', level: 1 });
    expect(done.countries.aurion!.science.researchOutput).toBeGreaterThanOrEqual(research + 1.5 - 1e-9);
  });

  it('each level costs and lasts more than the last', () => {
    const def = getWork('nuclear')!;
    expect(workCost(rich, def, 2)).toBeGreaterThan(workCost(rich, def, 1));
    expect(workDuration(def, 3)).toBeGreaterThan(workDuration(def, 1));
  });

  it('refuses what is locked, busy, unaffordable or beyond the slots', () => {
    expect(build(rich, 'collider').errors).toEqual(['errors.works.locked']);
    let s = build(rich, 'university').state;
    expect(build(s, 'university').errors).toEqual(['errors.works.alreadyBuilding']);
    for (const id of ['hospital', 'solar', 'exchange'] as const) {
      const r = build(s, id);
      if (s.works!.active.length < WORK_SLOTS) {
        expect(r.errors).toEqual([]);
        s = r.state;
      } else {
        expect(r.errors).toEqual(['errors.works.noFreeSlot']);
      }
    }
    const me = rich.countries.aurion!;
    const poor = { ...rich, countries: { ...rich.countries, aurion: { ...me, economy: { ...me.economy, treasury: 0 } } } };
    expect(build(poor, 'solar').errors).toEqual(['errors.works.insufficientTreasury']);
    expect(build(rich, 'solar', 'borealis').errors).toEqual(['errors.works.playerOnly']);
  });

  it('refunds half when cancelled', () => {
    const s = build(rich, 'airport').state;
    const paid = s.works!.active[0]!.paid;
    const r = applyAction(s, { type: 'cancelWork', workId: 'airport' }, 'aurion', sampleTechs);
    expect(r.errors).toEqual([]);
    expect(r.state.works!.active).toHaveLength(0);
    expect(r.state.countries.aurion!.economy.treasury).toBe(s.countries.aurion!.economy.treasury + Math.round(paid / 2));
  });

  it('an intelligence headquarters trains spies', () => {
    const spies = rich.countries.aurion!.intelligence.spyCount;
    const done = pass(build(rich, 'intel_hq').state, workDuration(getWork('intel_hq')!, 1));
    expect(done.countries.aurion!.intelligence.spyCount).toBeGreaterThanOrEqual(spies + 1);
  });
});

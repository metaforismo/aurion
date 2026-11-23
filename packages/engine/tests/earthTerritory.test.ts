import { describe, expect, it } from 'vitest';
import {
  EARTH_TERRITORIES,
  applyAction,
  claimableTerritories,
  createGame,
  getTerritoryStatus,
  heldTerritories,
  protectorateCost,
  protectorateGdpGain,
  protectorates,
  territoryOwner,
  tick,
} from '../src/index.js';
import type { GameState, Scenario } from '../src/index.js';
import { cedeProtectorate } from '../src/territory/earth.js';
import { makeScenario, sampleTechs } from './fixtures.js';

// Aurion sits on Italy, Borealis on Spain; everything else is unaligned.
const scenario: Scenario = { ...makeScenario(), homeTerritories: { '380': 'aurion', '724': 'borealis' } };
const base: GameState = (() => {
  const s = createGame(scenario, { seed: 'earth', victory: 'economic', playerCountryId: 'aurion' });
  const me = s.countries.aurion!;
  return { ...s, countries: { ...s.countries, aurion: { ...me, economy: { ...me.economy, treasury: 1e14 } } } };
})();
const ctx = { techCatalog: sampleTechs, scenario };
const claim = (s: GameState, id: string) =>
  applyAction(s, { type: 'claimTerritory', territoryId: id }, 'aurion', sampleTechs, undefined, scenario);
const pass = (s: GameState, weeks: number) => {
  let next = s;
  for (let i = 0; i < weeks; i += 1) next = tick(next, ctx);
  return next;
};

describe('the map', () => {
  it('links every territory both ways and leaves none cut off', () => {
    const byId = new Map(EARTH_TERRITORIES.map((t) => [t.id, t]));
    for (const t of EARTH_TERRITORIES) {
      expect(t.neighbours.length).toBeGreaterThan(0);
      for (const n of t.neighbours) expect(byId.get(n)!.neighbours).toContain(t.id);
    }
  });

  it('knows who holds what', () => {
    expect(territoryOwner(base, scenario, '380')).toBe('aurion');
    expect(territoryOwner(base, scenario, '250')).toBeNull();
    expect(heldTerritories(base, scenario, 'aurion')).toEqual(['380']);
    // France borders Italy; Brazil does not.
    expect(claimableTerritories(base, scenario)).toContain('250');
    expect(getTerritoryStatus(base, scenario, '076')!.claimable).toBe(false);
    expect(getTerritoryStatus(base, scenario, '724')!.home).toBe(true);
  });
});

describe('protectorates', () => {
  it('cannot be the home of another nation, far away, or two at a time', () => {
    expect(claim(base, '724').errors).toEqual(['errors.territory.taken']);
    expect(claim(base, '076').errors).toEqual(['errors.territory.notAdjacent']);
    const started = claim(base, '250');
    expect(started.errors).toEqual([]);
    expect(claim(started.state, '756').errors).toEqual(['errors.territory.busy']);
  });

  it('cost money up front and pay in GDP once integrated', () => {
    const price = protectorateCost(base, '250');
    const gain = protectorateGdpGain(base, '250');
    const started = claim(base, '250').state;
    expect(base.countries.aurion!.economy.treasury - started.countries.aurion!.economy.treasury).toBe(price);
    expect(protectorates(started, 'aurion')).toEqual([]);

    const done = pass(started, 60);
    expect(territoryOwner(done, scenario, '250')).toBe('aurion');
    expect(done.territoryWork ?? null).toBeNull();
    // Compare with the same weeks without the protectorate.
    const without = pass(base, 60);
    expect(done.countries.aurion!.economy.gdp - without.countries.aurion!.economy.gdp).toBeGreaterThan(gain * 0.9);
    // The next one is dearer, and new land is now within reach.
    expect(protectorateCost(done, '756')).toBeGreaterThan(protectorateCost(base, '756'));
    expect(claimableTerritories(done, scenario)).toContain('056');
  });

  it('sour relations with the nations next door', () => {
    const key = 'aurion::borealis';
    const done = pass(claim(base, '250').state, 60);
    const without = pass(base, 60);
    expect(done.relations[key as keyof typeof done.relations]!.attitude).toBeLessThan(
      without.relations[key as keyof typeof without.relations]!.attitude,
    );
  });
});

describe('rivals and war', () => {
  it('rivals absorb unaligned neighbours over the years', () => {
    const later = pass(base, 52 * 12);
    expect(protectorates(later, 'borealis').length).toBeGreaterThan(0);
    for (const id of protectorates(later, 'borealis')) expect(territoryOwner(later, scenario, id)).toBe('borealis');
  });

  it('a capitulation hands over the latest protectorate', () => {
    const held: GameState = {
      ...base,
      territories: { '250': { owner: 'aurion', sinceTick: 5 }, '756': { owner: 'aurion', sinceTick: 40 } },
    };
    const spoils = cedeProtectorate(held, 'aurion', 'borealis');
    expect(spoils.ceded).toBe('756');
    expect(spoils.state.territories!['756']!.owner).toBe('borealis');
    expect(spoils.state.territories!['250']!.owner).toBe('aurion');
    expect(cedeProtectorate(base, 'aurion', 'borealis').ceded).toBeNull();
  });

  it('without map data nothing happens', () => {
    const plain = makeScenario();
    const s = createGame(plain, { seed: 'earth', victory: 'economic', playerCountryId: 'aurion' });
    let next = s;
    for (let i = 0; i < 200; i += 1) next = tick(next, { techCatalog: sampleTechs, scenario: plain });
    expect(next.territories).toBeUndefined();
  });
});

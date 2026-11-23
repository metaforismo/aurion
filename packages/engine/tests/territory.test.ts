import { describe, expect, it } from 'vitest';
import {
  SECTORS,
  SECTOR_SLOTS,
  applyAction,
  buildCost,
  claimCost,
  colonyHousing,
  createGame,
  getColonyStatus,
  getSectorStatus,
  heldSectors,
  sectorAt,
  tickCosmos,
} from '../src/index.js';
import type { GameState } from '../src/index.js';
import { makeScenario } from './fixtures.js';

/** A game with a lunar base, a founded colony and plenty of cash. */
function settled(): GameState {
  const base = createGame(makeScenario(), { seed: 'territory', victory: 'economic', playerCountryId: 'aurion' });
  const cosmos = tickCosmos(base);
  const me = cosmos.countries.aurion!;
  const rich: GameState = {
    ...cosmos,
    countries: { ...cosmos.countries, aurion: { ...me, economy: { ...me.economy, treasury: 1e15 } } },
    cosmos: { ...cosmos.cosmos!, completed: ['moon_base'] },
  };
  return tickCosmos({ ...rich, tick: rich.tick + 1 });
}

const pass = (s: GameState, weeks: number) => {
  let next = s;
  for (let i = 0; i < weeks; i += 1) next = tickCosmos({ ...next, tick: next.tick + 1 });
  return next;
};
const act = (s: GameState, action: Parameters<typeof applyAction>[1]) => applyAction(s, action, 'aurion');

describe('sectors', () => {
  it('cover each world with twenty sectors that know their neighbours', () => {
    for (const body of ['moon', 'mars'] as const) {
      expect(SECTORS[body]).toHaveLength(20);
      for (const s of SECTORS[body]) {
        expect(s.neighbours.length).toBeGreaterThanOrEqual(4);
        for (const n of s.neighbours) {
          expect(SECTORS[body].find((o) => o.id === n)!.neighbours).toContain(s.id);
        }
      }
    }
    expect(sectorAt('moon', 23.5, 0.7).name).toBe('Mare Tranquillitatis');
    expect(sectorAt('mars', -175, 47).name).toBe('Arcadia Planitia');
    expect(sectorAt('moon', 8, -62).name).toBe('Shackleton');
  });

  it('a colony starts with the sector its base stands on', () => {
    const s = settled();
    expect(heldSectors(s, 'moon')).toEqual([sectorAt('moon', 23.5, 0.7).id]);
    expect(heldSectors(s, 'mars')).toEqual([]);
  });
});

describe('claiming land', () => {
  it('takes a neighbouring free sector, after a wait, for a price that climbs', () => {
    const s = settled();
    const home = sectorAt('moon', 23.5, 0.7);
    const target = home.neighbours[0]!;
    const far = SECTORS.moon.find((x) => x.id !== home.id && !home.neighbours.includes(x.id))!;
    expect(act(s, { type: 'claimSector', body: 'moon', sectorId: far.id }).errors).toEqual(['errors.territory.notAdjacent']);

    const first = claimCost(s, 'moon');
    const started = act(s, { type: 'claimSector', body: 'moon', sectorId: target });
    expect(started.errors).toEqual([]);
    expect(s.countries.aurion!.economy.treasury - started.state.countries.aurion!.economy.treasury).toBe(first);
    expect(heldSectors(started.state, 'moon')).toHaveLength(1);
    // One work at a time on a world.
    expect(act(started.state, { type: 'claimSector', body: 'moon', sectorId: home.neighbours[1]! }).errors).toEqual([
      'errors.territory.busy',
    ]);

    const done = pass(started.state, 30);
    expect(heldSectors(done, 'moon')).toContain(target);
    expect(claimCost(done, 'moon')).toBeGreaterThan(first);
    expect(colonyHousing(done, 'moon')).toBeGreaterThan(colonyHousing(s, 'moon'));
  });

  it('needs a colony on that world', () => {
    expect(act(settled(), { type: 'claimSector', body: 'mars', sectorId: 'mars_e0' }).errors).toEqual([
      'errors.territory.noColony',
    ]);
  });
});

describe('structures', () => {
  it('go up on held land, fill its slots and pay every week', () => {
    const s = settled();
    const home = heldSectors(s, 'moon')[0]!;
    expect(act(s, { type: 'buildStructure', body: 'moon', sectorId: 'moon_n0', structure: 'lab' }).errors).toEqual([
      'errors.territory.notYours',
    ]);
    const firstPrice = buildCost(s, 'moon', 'lab');
    const lab = pass(act(s, { type: 'buildStructure', body: 'moon', sectorId: home, structure: 'lab' }).state, 20);
    const status = getSectorStatus(lab, 'moon').find((x) => x.def.id === home)!;
    expect(status.structures).toEqual(['lab']);
    expect(getColonyStatus(lab, 'moon')!.structures.research).toBeGreaterThan(0);
    expect(buildCost(lab, 'moon', 'lab')).toBeGreaterThan(firstPrice);

    const habitat = pass(act(lab, { type: 'buildStructure', body: 'moon', sectorId: home, structure: 'habitat' }).state, 20);
    expect(colonyHousing(habitat, 'moon')).toBeGreaterThan(colonyHousing(lab, 'moon'));
    expect(getSectorStatus(habitat, 'moon').find((x) => x.def.id === home)!.structures).toHaveLength(SECTOR_SLOTS);
    expect(act(habitat, { type: 'buildStructure', body: 'moon', sectorId: home, structure: 'mine' }).errors).toEqual([
      'errors.territory.noSlot',
    ]);
  });
});

describe('rivals', () => {
  it('with a base of their own take free land over the years', () => {
    const s = settled();
    const rivalId = Object.keys(s.cosmos!.rivals)[0]!;
    const rival = s.cosmos!.rivals[rivalId]!;
    const contested: GameState = {
      ...s,
      cosmos: { ...s.cosmos!, rivals: { ...s.cosmos!.rivals, [rivalId]: { ...rival, completed: [...rival.completed, 'moon_base'] } } },
    };
    const later = pass(contested, 52 * 6);
    expect(heldSectors(later, 'moon', rivalId).length).toBeGreaterThan(0);
    // The player's home ground is never taken.
    expect(heldSectors(later, 'moon')).toContain(heldSectors(s, 'moon')[0]);
  });
});

import { WORKS, createGame, tickCosmos, type GameState, type Scenario } from '@aurion/engine';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { layoutCity } from '../lib/base/city';
import {
  MAX_PEOPLE,
  baseSignature,
  buildBaseModel,
  buildCapitalModel,
  housingUnits,
  peopleShown,
} from '../lib/base/model';

const scenario = JSON.parse(
  readFileSync(join(process.cwd(), 'content/scenarios/quick-start.json'), 'utf8'),
) as Scenario;

function colony(completed: string[], population: number, extra: Partial<NonNullable<GameState['cosmos']>> = {}): GameState {
  const base = tickCosmos(
    createGame(scenario, { seed: 'base', victory: 'economic', playerCountryId: scenario.playableCountries[0]! }),
  );
  return {
    ...base,
    cosmos: {
      ...base.cosmos!,
      completed,
      colonies: { moon: { focus: 'balanced', focusChangedAtTick: 0, population } },
      ...extra,
    },
  };
}

describe('base model', () => {
  it('there is no base where nobody lives', () => {
    const empty = tickCosmos(
      createGame(scenario, { seed: 'base', victory: 'economic', playerCountryId: scenario.playableCountries[0]! }),
    );
    expect(buildBaseModel(empty, 'moon')).toBeNull();
  });

  it('a first base has its hub, pad, tower, power and a few homes', () => {
    const model = buildBaseModel(colony(['moon_base'], 15), 'moon')!;
    const kinds = model.buildings.map((b) => b.kind);
    expect(kinds.slice(0, 3)).toEqual(['hub', 'pad', 'tower']);
    expect(kinds).toContain('solar');
    expect(kinds.filter((k) => k === 'housing')).toHaveLength(housingUnits(15));
    expect(model.rings.length).toBeGreaterThanOrEqual(1);
  });

  it('grows with people, projects and structures without moving what stood before', () => {
    const small = buildBaseModel(colony(['moon_base'], 150), 'moon')!;
    const player = scenario.playableCountries[0]!;
    const big = buildBaseModel(
      colony(['moon_base', 'moon_helium3', 'moon_city'], 40_000, {
        sectors: { moon: { moon_e3: { owner: player, structures: ['lab', 'mine'] }, moon_e4: { owner: player, structures: [] } } },
      }),
      'moon',
    )!;
    expect(big.buildings.length).toBeGreaterThan(small.buildings.length);
    expect(big.people).toBeGreaterThan(small.people);
    expect(big.rovers).toBeGreaterThan(small.rovers);
    const kinds = big.buildings.map((b) => b.kind);
    for (const k of ['extractor', 'dome', 'lab', 'mine'] as const) expect(kinds).toContain(k);
    expect(baseSignature(big)).not.toBe(baseSignature(small));
    // The core never moves.
    expect(big.buildings.slice(0, 3)).toEqual(small.buildings.slice(0, 3));
  });

  it('work under way shows as building sites', () => {
    const idle = buildBaseModel(colony(['moon_base'], 150), 'moon')!;
    expect(idle.sites).toBe(0);
    const busy = buildBaseModel(
      colony(['moon_base'], 150, {
        works: [{ kind: 'build', body: 'moon', sectorId: 'moon_e3', structure: 'lab', remainingTicks: 5 }],
        active: [{ projectId: 'moon_helium3', startedAtTick: 0, remainingTicks: 20, paid: 0 }],
      }),
      'moon',
    )!;
    expect(busy.sites).toBe(2);
    expect(busy.buildings.filter((b) => b.kind === 'site')).toHaveLength(2);
    expect(baseSignature(busy)).not.toBe(baseSignature(idle));
  });

  it('no two buildings share a plot, and the crowd is capped', () => {
    const model = buildBaseModel(colony(['moon_base', 'moon_city'], 80_000_000), 'moon')!;
    const seen = new Set(model.buildings.map((b) => `${Math.round(b.x)}:${Math.round(b.z)}`));
    expect(seen.size).toBe(model.buildings.length);
    expect(peopleShown(80_000_000)).toBeLessThanOrEqual(MAX_PEOPLE);
  });

  it('the capital mirrors the nation and its Earth megaprojects', () => {
    const start = tickCosmos(
      createGame(scenario, { seed: 'base', victory: 'economic', playerCountryId: scenario.playableCountries[0]! }),
    );
    const plain = buildCapitalModel(start)!;
    const kinds = plain.buildings.map((b) => b.kind);
    expect(kinds.filter((k) => k === 'capitol')).toHaveLength(1);
    for (const k of ['skyscraper', 'office', 'apartment', 'house', 'factory', 'lab', 'barracks'] as const) expect(kinds).toContain(k);
    expect(plain.city).toBeDefined();
    expect(kinds).not.toContain('pad');
    expect(kinds).not.toContain('reactor');

    const me = start.countries[start.playerCountryId]!;
    const grown = buildCapitalModel({
      ...start,
      countries: { ...start.countries, [me.id]: { ...me, economy: { ...me.economy, gdp: me.economy.gdp * 8 } } },
      cosmos: { ...start.cosmos!, completed: ['earth_smart_grid', 'earth_fusion', 'earth_spaceport'] },
    })!;
    const grownKinds = grown.buildings.map((b) => b.kind);
    for (const k of ['reactor', 'gantry'] as const) expect(grownKinds).toContain(k);
    expect(grown.city!.pylons.length).toBeGreaterThan(0);
    expect(grownKinds.filter((k) => k === 'skyscraper').length).toBeGreaterThan(
      kinds.filter((k) => k === 'skyscraper').length,
    );
    const seen = new Set(grown.buildings.map((b) => `${Math.round(b.x)}:${Math.round(b.z)}`));
    expect(seen.size).toBe(grown.buildings.length);
  });
});

describe('national works in the capital', () => {
  it('give every work its own ground, clear of the city and of each other', () => {
    for (const growth of [0.5, 1, 4, 16]) {
      const layout = layoutCity({
        growth,
        population: 5e7,
        industry: 0.3,
        research: 12,
        army: 20000,
        projects: ['earth_fusion', 'earth_spaceport', 'earth_smart_grid', 'earth_planetary_grid'],
        building: [],
        extraSites: 0,
        seed: 'works',
        works: WORKS.map((w) => ({ id: w.id, level: 3, building: null })),
      });
      expect(layout.works).toHaveLength(WORKS.length);
      const grid = (layout.radius + 0.5) * 90;
      const boxes = [
        ...layout.works.filter((w) => !w.inTown).map((w) => ({ id: w.id, x: w.x, z: w.z, w: w.w, d: w.d })),
        ...layout.specials.map((s) => ({ id: s.kind, x: s.x, z: s.z, w: 240, d: 200 })),
      ];
      for (const b of boxes) {
        // Inside the flat ground round the city.
        expect(Math.hypot(Math.abs(b.x) + b.w / 2, Math.abs(b.z) + b.d / 2)).toBeLessThan(1750 + 300);
        if (b.id === 'collider') continue; // underground: only its halls show
        expect(Math.max(Math.abs(b.x) - b.w / 2, Math.abs(b.z) - b.d / 2), `${b.id} reaches into town`).toBeGreaterThan(grid - 1);
      }
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          if (a.id === 'collider' || b.id === 'collider') continue;
          const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2;
          expect(apart, `${a.id} overlaps ${b.id} at growth ${growth}`).toBe(true);
        }
      }
      expect(layout.blocks.filter((b) => b.zone === 'civic')).toHaveLength(3);
    }
  });
});

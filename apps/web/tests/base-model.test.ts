import { createGame, tickCosmos, type GameState, type Scenario } from '@aurion/engine';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { MAX_PEOPLE, baseSignature, buildBaseModel, housingUnits, peopleShown } from '../lib/base/model';

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
});

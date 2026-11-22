// Event choices — effect interpretation and application.

import { describe, expect, it } from 'vitest';
import { applyEventEffects, createGame, describeEventEffect, resolveEventChoice } from '../src/index.js';
import type { EventDefinition, EventEffect, GameState } from '../src/index.js';
import { makeScenario } from './fixtures.js';

function newGame(): GameState {
  const scenario = makeScenario();
  const s = createGame(scenario, { victory: 'economic', playerCountryId: scenario.playableCountries[0]!, seed: 'events' });
  const p = s.countries[s.playerCountryId]!;
  return { ...s, countries: { ...s.countries, [p.id]: { ...p, economy: { ...p.economy, weeklyIncome: 1_000_000 } } } };
}
const me = (s: GameState) => s.countries[s.playerCountryId]!;
const stat = (stat: string, delta: number, multiplier?: number): EventEffect => ({
  type: 'modifyStat', target: 'player', stat, delta, ...(multiplier !== undefined ? { multiplier } : {}),
});

describe('applyEventEffects', () => {
  it('applies dotted stat paths with clamping', () => {
    const s = newGame();
    const next = applyEventEffects(s, [
      stat('politics.popularity', 60),
      stat('politics.factions.business.satisfaction', -5),
      stat('intelligence.spyCount', -100),
    ]);
    expect(me(next).politics.popularity).toBe(100);
    expect(me(next).politics.factions.business.satisfaction).toBe(
      me(s).politics.factions.business.satisfaction - 5,
    );
    expect(me(next).intelligence.spyCount).toBe(0);
  });

  it('reads small treasury deltas as weeks of income', () => {
    const s = newGame();
    const next = applyEventEffects(s, [stat('economy.treasury', -4)]);
    expect(me(next).economy.treasury).toBe(me(s).economy.treasury - 4 * me(s).economy.weeklyIncome);
    const raw = applyEventEffects(s, [stat('economy.treasury', 5_000_000)]);
    expect(me(raw).economy.treasury).toBe(me(s).economy.treasury + 5_000_000);
  });

  it('routes income changes to GDP so they persist', () => {
    const s = newGame();
    expect(me(applyEventEffects(s, [stat('economy.weeklyIncome', 0, 1.05)])).economy.gdp).toBe(
      Math.round(me(s).economy.gdp * 1.05),
    );
    expect(me(applyEventEffects(s, [stat('economy.weeklyIncome', -0.1)])).economy.gdp).toBe(
      Math.round(me(s).economy.gdp * 0.9),
    );
  });

  it('shifts attitude and world tension', () => {
    const s = newGame();
    const other = Object.keys(s.countries).find((id) => id !== s.playerCountryId)!;
    const next = applyEventEffects(s, [
      { type: 'shiftAttitude', with: other, delta: 12 },
      { type: 'modifyStat', target: 'player', stat: 'worldTension', delta: 7 },
    ]);
    const rel = Object.values(next.relations).find(
      (r) => [r.countryA, r.countryB].includes(other) && [r.countryA, r.countryB].includes(s.playerCountryId),
    )!;
    const before = Object.values(s.relations).find(
      (r) => [r.countryA, r.countryB].includes(other) && [r.countryA, r.countryB].includes(s.playerCountryId),
    );
    expect(rel.attitude).toBe((before?.attitude ?? 0) + 12);
    expect(next.worldTension).toBe(s.worldTension + 7);
  });
});

describe('describeEventEffect', () => {
  it('matches what application does', () => {
    const s = newGame();
    expect(describeEventEffect(s, stat('economy.weeklyIncome', 0, 1.05))).toMatchObject({
      kind: 'stat', stat: 'economy.gdp', unit: 'percent',
    });
    const treasury = describeEventEffect(s, stat('economy.treasury', -4));
    expect(treasury).toMatchObject({ kind: 'stat', unit: 'absolute', amount: -4 * me(s).economy.weeklyIncome });
    expect(describeEventEffect(s, stat('intelligence.counterIntelLevel', 0.05))).toMatchObject({
      unit: 'points', amount: expect.closeTo(5, 5),
    });
  });
});

describe('resolveEventChoice', () => {
  const pool: EventDefinition[] = [
    {
      id: 'e1', nameKey: 'n', descriptionKey: 'd', trigger: { type: 'random', chancePerTick: 0 },
      cooldownTicks: 0, weight: 1,
      choices: [
        { labelKey: 'a', effects: [stat('politics.popularity', 3)] },
        { labelKey: 'b', effects: [stat('politics.popularity', -3)] },
      ],
    },
  ];

  it('marks the event resolved and applies the chosen effects once', () => {
    const base = newGame();
    const s: GameState = { ...base, events: [{ definitionId: 'e1', firedAtTick: 0, resolvedChoiceIndex: null }] };
    const next = resolveEventChoice(s, pool, 1);
    expect(next.events[0]!.resolvedChoiceIndex).toBe(1);
    expect(me(next).politics.popularity).toBe(me(s).politics.popularity - 3);
    expect(resolveEventChoice(next, pool, 0)).toBe(next);
  });
});

describe('event pacing', () => {
  const periodic: EventDefinition = {
    id: 'p1', nameKey: 'n', descriptionKey: 'd', trigger: { type: 'periodic', everyTicks: 1 },
    cooldownTicks: 0, weight: 1, choices: [{ labelKey: 'a', effects: [] }],
  };

  it('never fires on the opening week, while one is pending, or inside the quiet gap', async () => {
    const { tick, MIN_EVENT_GAP_TICKS } = await import('../src/tick.js');
    const ctx = { eventPool: [periodic] };
    let s = newGame();
    expect(s.tick).toBe(0);
    s = tick(s, ctx); // tick 0 evaluated: nothing fires
    expect(s.events).toHaveLength(0);
    s = tick(s, ctx);
    expect(s.events).toHaveLength(1);
    // Pending: no second event however long we wait.
    for (let i = 0; i < 5; i += 1) s = tick(s, ctx);
    expect(s.events).toHaveLength(1);
    s = resolveEventChoice(s, [periodic], 0);
    const firedAt = s.events[0]!.firedAtTick;
    while (s.tick - firedAt < MIN_EVENT_GAP_TICKS) {
      expect(s.events).toHaveLength(1);
      s = tick(s, ctx);
    }
    s = tick(s, ctx);
    expect(s.events).toHaveLength(2);
  });
});

describe('technology effects', () => {
  it('applies dotted stat paths when a technology completes', async () => {
    const { tick } = await import('../src/tick.js');
    const { applyAction } = await import('../src/index.js');
    const scenario = makeScenario();
    const tech = {
      id: 'tech_test_paths', nameKey: 'n', descriptionKey: 'd', branch: 'civil' as const, cost: 1, prereqs: [],
      effects: [
        { type: 'modifyStat' as const, stat: 'science.researchOutput', delta: 0, multiplier: 2 },
        { type: 'modifyStat' as const, stat: 'politics.popularity', delta: 5 },
        { type: 'modifyStat' as const, stat: 'military.doctrineLevel', delta: 0.1 },
      ],
    };
    const catalog = [tech];
    let s = newGame();
    const before = me(s);
    s = applyAction(s, { type: 'startResearch', techId: tech.id }, s.playerCountryId, catalog).state;
    s = tick(s, { techCatalog: catalog, scenario: { ...scenario, techTree: catalog } });
    const after = me(s);
    expect(after.science.completedTechs).toContain(tech.id);
    expect(after.science.researchOutput).toBeCloseTo(before.science.researchOutput * 2, 6);
    expect(after.military.doctrineLevel).toBeCloseTo(Math.min(1, before.military.doctrineLevel + 0.1), 6);
    expect(after.politics.popularity).toBeGreaterThan(before.politics.popularity + 3);
  });
});

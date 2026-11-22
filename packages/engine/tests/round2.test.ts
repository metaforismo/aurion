// Condition triggers, intelligence growth, combat support and spy gating.

import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  evaluateEventCondition,
  isSpyTypeUnlocked,
  supportMultiplier,
  tick,
} from '../src/index.js';
import type { EventDefinition, GameState, TechDefinition } from '../src/index.js';
import { makeScenario } from './fixtures.js';

function newGame(): GameState {
  const scenario = makeScenario();
  return createGame(scenario, { victory: 'economic', playerCountryId: scenario.playableCountries[0]!, seed: 'round2' });
}
const me = (s: GameState) => s.countries[s.playerCountryId]!;
const patchMe = (s: GameState, patch: (c: ReturnType<typeof me>) => ReturnType<typeof me>): GameState => ({
  ...s,
  countries: { ...s.countries, [s.playerCountryId]: patch(me(s)) },
});

describe('event conditions', () => {
  it('compares player stats and supports and / or', () => {
    const s = patchMe(newGame(), (c) => ({ ...c, politics: { ...c.politics, popularity: 40 } }));
    expect(evaluateEventCondition('popularity < 45', s)).toBe(true);
    expect(evaluateEventCondition('popularity>45', s)).toBe(false);
    expect(evaluateEventCondition('popularity < 45 and worldTension > 90', s)).toBe(false);
    expect(evaluateEventCondition('worldTension > 90 or popularity <= 40', s)).toBe(true);
    expect(evaluateEventCondition('factions.populist.satisfaction >= 0', s)).toBe(true);
  });

  it('normalises treasury to weeks of income and income to a share of GDP', () => {
    const s = patchMe(newGame(), (c) => ({
      ...c,
      economy: { ...c.economy, gdp: 1_000_000, weeklyIncome: 5_000, treasury: 20_000 },
    }));
    expect(evaluateEventCondition('treasury < 5', s)).toBe(true); // 4 weeks in the bank
    expect(evaluateEventCondition('weeklyIncome < 0.1', s)).toBe(false); // 0.5% of GDP
  });

  it('checks completed techs and never fires on garbage', () => {
    const s = patchMe(newGame(), (c) => ({ ...c, science: { ...c.science, completedTechs: ['tech_x'] } }));
    expect(evaluateEventCondition('completedTechs contains tech_x', s)).toBe(true);
    expect(evaluateEventCondition('completedTechs contains tech_y', s)).toBe(false);
    expect(evaluateEventCondition('nonsense !!', s)).toBe(false);
    expect(evaluateEventCondition('unknownStat > 1', s)).toBe(false);
  });

  it('fires a condition event through the tick', () => {
    const def: EventDefinition = {
      id: 'cond', nameKey: 'n', descriptionKey: 'd', trigger: { type: 'condition', expression: 'popularity < 101' },
      cooldownTicks: 999, weight: 1, choices: [{ labelKey: 'a', effects: [] }],
    };
    const s = tick(newGame(), { eventPool: [def] });
    expect(s.events.map((e) => e.definitionId)).toEqual(['cond']);
  });
});

describe('intelligence picture', () => {
  it('learns about allies and trade partners', () => {
    let s = newGame();
    const [ally, partner] = Object.keys(s.countries).filter((id) => id !== s.playerCountryId);
    const key = (o: string) => (s.playerCountryId < o ? `${s.playerCountryId}::${o}` : `${o}::${s.playerCountryId}`);
    const rel = (o: string, treaties: string[]) => ({
      countryA: s.playerCountryId < o ? s.playerCountryId : o,
      countryB: s.playerCountryId < o ? o : s.playerCountryId,
      attitude: 50, treaties, atWar: false,
    });
    s = {
      ...s,
      relations: {
        ...s.relations,
        [key(ally!)]: rel(ally!, ['alliance']),
        [key(partner!)]: rel(partner!, ['tradeDeal']),
      } as GameState['relations'],
    };
    s = tick(s, {});
    expect(me(s).intelligence.knownIntel[ally!]).toBe('partial');
    expect(['rumors', 'partial']).toContain(me(s).intelligence.knownIntel[partner!]);
  });

  it('idle agents slowly reveal rivals, up to partial', () => {
    let s = patchMe(newGame(), (c) => ({ ...c, intelligence: { ...c.intelligence, spyCount: 20 } }));
    for (let i = 0; i < 400; i += 1) s = tick(s, {});
    const levels = Object.values(me(s).intelligence.knownIntel);
    expect(levels.length).toBeGreaterThan(0);
    expect(levels).not.toContain('full');
  });
});

describe('combat support', () => {
  it('rewards navy and air force, capped', () => {
    const c = me(newGame());
    const base = { ...c, military: { ...c.military, armySize: 1000, navy: 0, airforce: 0 } };
    expect(supportMultiplier(base)).toBe(1);
    expect(supportMultiplier({ ...base, military: { ...base.military, navy: 500, airforce: 1000 } })).toBeCloseTo(1.475, 6);
    expect(supportMultiplier({ ...base, military: { ...base.military, navy: 9e9, airforce: 9e9 } })).toBeCloseTo(1.6, 6);
  });
});

describe('spy operation gating', () => {
  const tech: TechDefinition = {
    id: 'tech_sabotage', nameKey: 'n', descriptionKey: 'd', branch: 'intelligence', cost: 1, prereqs: [],
    effects: [{ type: 'unlockSpyType', spyType: 'sabotage' }],
  };

  it('locks a type until its technology is researched', () => {
    const s = newGame();
    const target = Object.keys(s.countries).find((id) => id !== s.playerCountryId)!;
    expect(isSpyTypeUnlocked(me(s), 'sabotage', [tech])).toBe(false);
    expect(isSpyTypeUnlocked(me(s), 'propaganda', [tech])).toBe(true);
    const op = {
      type: 'sabotage' as const, ownerCountryId: s.playerCountryId, targetCountryId: target,
      payload: { kind: 'sabotage' as const, targetSector: 'industry' as const },
      durationTicks: 4, successProbability: 0, detectionRisk: 0,
    };
    expect(applyAction(s, { type: 'deploySpy', op }, s.playerCountryId, [tech]).errors).toEqual(['errors.spy.typeLocked']);
    const unlocked = patchMe(s, (c) => ({ ...c, science: { ...c.science, completedTechs: [tech.id] } }));
    expect(applyAction(unlocked, { type: 'deploySpy', op }, s.playerCountryId, [tech]).errors).toEqual([]);
  });
});

describe('space-age events', () => {
  it('fire once when their megaproject is complete, with valid effects', async () => {
    const { COSMOS_EVENTS, resolveEventChoice, COSMOS_PROJECTS } = await import('../src/index.js');
    const ids = new Set(COSMOS_PROJECTS.map((p) => p.id));
    for (const def of COSMOS_EVENTS) {
      const m = /megaprojects contains (\w+)/.exec(def.trigger.type === 'condition' ? def.trigger.expression : '');
      if (m) expect(ids.has(m[1]!)).toBe(true);
      expect(def.choices).toHaveLength(2);
    }
    let s = newGame();
    s = { ...s, cosmos: { ...s.cosmos!, completed: ['earth_fusion'] } };
    s = tick(s, { eventPool: COSMOS_EVENTS });
    expect(s.events.map((e) => e.definitionId)).toEqual(['event_cosmos_cheap_power']);
    const before = me(s).politics.popularity;
    s = resolveEventChoice(s, COSMOS_EVENTS, 0);
    expect(me(s).politics.popularity).toBeGreaterThan(before);
    for (let i = 0; i < 40; i += 1) s = tick(s, { eventPool: COSMOS_EVENTS });
    expect(s.events.filter((e) => e.definitionId === 'event_cosmos_cheap_power')).toHaveLength(1);
  });
});

describe('run history', () => {
  it('samples on the interval and stays bounded while keeping the whole arc', async () => {
    const { HISTORY_INTERVAL_TICKS, HISTORY_LIMIT } = await import('../src/index.js');
    let s = newGame();
    for (let i = 0; i < HISTORY_INTERVAL_TICKS * 3; i += 1) s = tick(s, {});
    expect(s.history!.length).toBe(3);
    expect(s.history![0]).toMatchObject({ tick: 0, rank: expect.any(Number) });
    for (let i = 0; i < HISTORY_INTERVAL_TICKS * (HISTORY_LIMIT + 40); i += 1) s = tick(s, {});
    expect(s.history!.length).toBeLessThanOrEqual(HISTORY_LIMIT);
    expect(s.history![0]!.tick).toBe(0);
    const ticks = s.history!.map((h) => h.tick);
    expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
  });
});

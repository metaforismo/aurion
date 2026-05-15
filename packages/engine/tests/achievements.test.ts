import { describe, expect, it } from 'vitest';

import { createGame } from '../src/createGame.js';
import {
  BUILTIN_ACHIEVEMENTS,
  evaluateAchievements,
  evaluateAchievementCondition,
} from '../src/index.js';
import type {
  AchievementDef,
  GameState,
  SpyOperation,
} from '../src/index.js';
import { makeScenario } from './fixtures.js';

const scenario = makeScenario();

function freshState(): GameState {
  return createGame(scenario, {
    seed: 'achievements',
    victory: 'economic',
    playerCountryId: 'aurion',
  });
}

describe('evaluateAchievements — pure helpers', () => {
  it('returns an empty array when no condition is met yet', () => {
    const s = freshState();
    // Tier-by-tier predicates that should all be false at tick 0.
    const fakeDefs: AchievementDef[] = [
      {
        id: 'never_alliance',
        nameKey: 'x.name',
        descKey: 'x.desc',
        tier: 'silver',
        condition: { kind: 'allianceCount', n: 99 },
      },
      {
        id: 'never_spy',
        nameKey: 'x.name',
        descKey: 'x.desc',
        tier: 'silver',
        condition: { kind: 'spyOpsCompleted', n: 99 },
      },
    ];
    expect(evaluateAchievements(s, fakeDefs)).toEqual([]);
  });

  it('detects completeTech when the player has the tech', () => {
    const base = freshState();
    const player = base.countries.aurion!;
    const s: GameState = {
      ...base,
      countries: {
        ...base.countries,
        aurion: {
          ...player,
          science: {
            ...player.science,
            completedTechs: ['tech_industry_basics'],
          },
        },
      },
    };
    const defs: AchievementDef[] = [
      {
        id: 't',
        nameKey: 'x.name',
        descKey: 'x.desc',
        tier: 'bronze',
        condition: { kind: 'completeTech', techId: 'tech_industry_basics' },
      },
    ];
    expect(evaluateAchievements(s, defs)).toEqual(['t']);
  });

  it('detects reachPopularity threshold (inclusive)', () => {
    const base = freshState();
    const player = base.countries.aurion!;
    const s: GameState = {
      ...base,
      countries: {
        ...base.countries,
        aurion: {
          ...player,
          politics: { ...player.politics, popularity: 80 },
        },
      },
    };
    expect(
      evaluateAchievementCondition(s, { kind: 'reachPopularity', threshold: 80 }),
    ).toBe(true);
    expect(
      evaluateAchievementCondition(s, { kind: 'reachPopularity', threshold: 81 }),
    ).toBe(false);
  });

  it('detects reachGdpRank — fixture has all-equal GDPs so player ties at rank 1', () => {
    const s = freshState();
    expect(
      evaluateAchievementCondition(s, { kind: 'reachGdpRank', rank: 1 }),
    ).toBe(true);
  });

  it('counts allianceCount across the player relations', () => {
    const base = freshState();
    const s: GameState = {
      ...base,
      relations: {
        ...base.relations,
        'aurion::borealis': {
          ...base.relations['aurion::borealis']!,
          treaties: ['alliance'],
        },
      },
    };
    expect(
      evaluateAchievementCondition(s, { kind: 'allianceCount', n: 1 }),
    ).toBe(true);
    expect(
      evaluateAchievementCondition(s, { kind: 'allianceCount', n: 2 }),
    ).toBe(false);
  });

  it('counts only the player-owned, completed spy ops', () => {
    const base = freshState();
    const ops: SpyOperation[] = [
      {
        id: 'op-1',
        type: 'steal_tech',
        ownerCountryId: 'aurion',
        targetCountryId: 'borealis',
        payload: { kind: 'steal_tech', techId: 'tech_industry_basics' },
        progressTicks: 5,
        durationTicks: 5,
        successProbability: 1,
        detectionRisk: 0,
        status: 'completed',
        startedAtTick: 0,
      },
      {
        id: 'op-2',
        type: 'sabotage',
        ownerCountryId: 'aurion',
        targetCountryId: 'khanate',
        payload: { kind: 'sabotage', targetSector: 'military' },
        progressTicks: 5,
        durationTicks: 5,
        successProbability: 1,
        detectionRisk: 0,
        status: 'failed', // does not count
        startedAtTick: 0,
      },
      {
        id: 'op-3',
        type: 'propaganda',
        ownerCountryId: 'borealis', // foreign owner — does not count
        targetCountryId: 'aurion',
        payload: { kind: 'propaganda', targetFaction: null },
        progressTicks: 5,
        durationTicks: 5,
        successProbability: 1,
        detectionRisk: 0,
        status: 'completed',
        startedAtTick: 0,
      },
    ];
    const s: GameState = { ...base, spyOperations: ops };
    expect(
      evaluateAchievementCondition(s, { kind: 'spyOpsCompleted', n: 1 }),
    ).toBe(true);
    expect(
      evaluateAchievementCondition(s, { kind: 'spyOpsCompleted', n: 2 }),
    ).toBe(false);
  });

  it('survivedTicks: only fires while not lost', () => {
    const s: GameState = { ...freshState(), tick: 600 };
    expect(
      evaluateAchievementCondition(s, { kind: 'survivedTicks', n: 500 }),
    ).toBe(true);
    const lost: GameState = { ...s, winLoss: 'lost' };
    expect(
      evaluateAchievementCondition(lost, { kind: 'survivedTicks', n: 500 }),
    ).toBe(false);
  });

  it('and / or composition short-circuits correctly', () => {
    const s = freshState();
    expect(
      evaluateAchievementCondition(s, {
        kind: 'and',
        conditions: [
          { kind: 'reachGdpRank', rank: 1 },
          { kind: 'reachPopularity', threshold: 1000 },
        ],
      }),
    ).toBe(false);
    expect(
      evaluateAchievementCondition(s, {
        kind: 'or',
        conditions: [
          { kind: 'reachGdpRank', rank: 1 },
          { kind: 'reachPopularity', threshold: 1000 },
        ],
      }),
    ).toBe(true);
  });
});

describe('BUILTIN_ACHIEVEMENTS catalogue', () => {
  it('ships at least 20 entries', () => {
    expect(BUILTIN_ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20);
  });

  it('every id is unique', () => {
    const ids = BUILTIN_ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only declares known tier values', () => {
    for (const def of BUILTIN_ACHIEVEMENTS) {
      expect(['bronze', 'silver', 'gold']).toContain(def.tier);
    }
  });

  it('every entry references an `achievements.<id>.name|description` key pair', () => {
    for (const def of BUILTIN_ACHIEVEMENTS) {
      expect(def.nameKey).toBe(`achievements.${def.id}.name`);
      expect(def.descKey).toBe(`achievements.${def.id}.description`);
    }
  });

  it('produces no false positives on a fresh game', () => {
    const s = freshState();
    const unlocked = evaluateAchievements(s, BUILTIN_ACHIEVEMENTS);
    // Fresh game ranks all countries equal (rank 1 ties) so the GDP-rank
    // gold achievement DOES fire on tick 0 of the synthetic fixture; that's
    // OK because the assertion below only forbids the player-progress ones.
    expect(unlocked).not.toContain('master_spy');
    expect(unlocked).not.toContain('survivor');
    expect(unlocked).not.toContain('long_haul');
  });
});

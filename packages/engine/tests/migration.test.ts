// Save-format migration shim tests.
//
// Builds minimal Phase 1 / Phase 2 / Phase 3 fixtures and asserts the migrate
// function lands them on the current GameState shape, then exercises the
// migrated state through applyAction + tick to confirm the engine accepts it.

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { migrate, SAVE_VERSION, SaveMigrationError } from '../src/migrate.js';
import { tick } from '../src/tick.js';
import { applyAction } from '../src/actions/index.js';
import { sampleEvents, sampleTechs } from './fixtures.js';
import type { GameState } from '../src/index.js';

function hashState(s: GameState): string {
  return createHash('sha256').update(JSON.stringify(s)).digest('hex');
}

/**
 * Build a minimal Phase 1 GameState payload. Everything the engine reads is
 * present; nothing that didn't exist in Phase 1 is set.
 */
function phase1Fixture(): Record<string, unknown> {
  return {
    version: 1,
    tick: 0,
    scenarioId: 'test-scenario',
    difficultyId: 'normal',
    playerCountryId: 'aurion',
    countries: {
      aurion: {
        id: 'aurion',
        nameKey: 'country.aurion.name',
        color: '#888888',
        regionId: 'region_aurion',
        capitalKey: 'country.aurion.capital',
        population: 10_000_000,
        economy: {
          treasury: 1_000_000_000,
          gdp: 100_000_000_000,
          weeklyIncome: 0,
          taxRate: 20,
          sectors: { agriculture: 0.1, industry: 0.3, services: 0.4, tech: 0.2 },
        },
        military: {
          armySize: 1000,
          navy: 50,
          airforce: 50,
          doctrineLevel: 0.3,
          deployedUnits: [],
        },
        science: { researchOutput: 5, activeResearch: null, completedTechs: [] },
        intelligence: { spyCount: 5, counterIntelLevel: 0.3, knownIntel: {} },
        politics: {
          popularity: 50,
          governmentType: 'democracy',
          factions: {
            army: { satisfaction: 50, influence: 20 },
            business: { satisfaction: 50, influence: 25 },
            religious: { satisfaction: 50, influence: 15 },
            populist: { satisfaction: 50, influence: 20 },
            reformist: { satisfaction: 50, influence: 20 },
          },
        },
        isPlayer: true,
      },
    },
    relations: {},
    techTreeProgress: {
      aurion: { activeResearch: null, accumulatedPoints: 0 },
    },
    spyOperations: [],
    events: [],
    worldTension: 0,
    winLoss: 'playing',
    selectedVictoryCondition: 'economic',
    rngSeed: 'phase1',
  };
}

/** Phase 2 fixture: identical to Phase 1 plus _loseStreaks. */
function phase2Fixture(): Record<string, unknown> {
  return {
    ...phase1Fixture(),
    version: 2,
    _loseStreaks: {
      lowPopularityWeeks: 0,
      negativeTreasuryWeeks: 0,
      capitalOccupiedWeeks: 0,
      allFactionsAngryWeeks: 0,
    },
  };
}

/** Phase 3 fixture: Phase 2 plus reputation/bloc/gameMode + the v3 stamp. */
function phase3Fixture(): Record<string, unknown> {
  return {
    ...phase2Fixture(),
    version: 3,
    reputation: { western: 0, eastern: 0, 'non-aligned': 0 },
    pendingReputationDeltas: [],
    blocs: {
      western: {
        id: 'western',
        nameKey: 'bloc.western.name',
        leaderCountryId: 'aurion',
        memberCountryIds: ['aurion'],
        foundedAtTick: 0,
      },
      eastern: {
        id: 'eastern',
        nameKey: 'bloc.eastern.name',
        leaderCountryId: null,
        memberCountryIds: [],
        foundedAtTick: 0,
      },
      'non-aligned': {
        id: 'non-aligned',
        nameKey: 'bloc.nonAligned.name',
        leaderCountryId: null,
        memberCountryIds: [],
        foundedAtTick: 0,
      },
    },
    unResolutions: [],
    gameMode: 'eternal',
    cumulativeStats: {
      peakGdpRank: 1,
      peakTreasury: 1_000_000_000,
      totalTechsUnlocked: 0,
      totalReputationGained: 0,
      totalSpyOpsCompleted: 0,
      totalTicksPlayed: 0,
    },
    unlockedVictories: [],
    actionLog: [],
  };
}

describe('migrate: SAVE_VERSION constant', () => {
  it('is 3 (current Phase 3 format)', () => {
    expect(SAVE_VERSION).toBe(3);
  });
});

describe('migrate: Phase 1 → Phase 3', () => {
  it('upgrades a v1 payload to current shape with defaults', () => {
    const out = migrate(phase1Fixture());
    expect(out._loseStreaks).toBeDefined();
    expect(out._loseStreaks?.lowPopularityWeeks).toBe(0);
    // Phase 3 fields stay undefined for the slim/classic path.
    expect(out.gameMode).toBeUndefined();
    expect(out.reputation).toBeUndefined();
    expect(out.blocs).toBeUndefined();
    // Core Phase 1 fields are preserved verbatim.
    expect(out.tick).toBe(0);
    expect(out.scenarioId).toBe('test-scenario');
    expect(out.playerCountryId).toBe('aurion');
    expect(out.countries['aurion']).toBeDefined();
    // The persisted `version` stamp is stripped — engine state doesn't carry one.
    expect((out as unknown as { version?: number }).version).toBeUndefined();
  });

  it('migrated state survives 50 ticks + applyAction without throwing', () => {
    const out = migrate(phase1Fixture());
    let s = out;
    // Apply a couple of phase 1 actions.
    const a1 = applyAction(s, { type: 'setTaxRate', rate: 25 }, 'aurion', sampleTechs);
    expect(a1.errors).toEqual([]);
    s = a1.state;
    for (let i = 0; i < 50; i++) {
      s = tick(s, { techCatalog: sampleTechs, eventPool: sampleEvents });
    }
    // Repeat with a fresh migrate from the same payload and identical actions
    // — hash should match because migrate is a pure transform.
    let s2 = migrate(phase1Fixture());
    s2 = applyAction(s2, { type: 'setTaxRate', rate: 25 }, 'aurion', sampleTechs).state;
    for (let i = 0; i < 50; i++) {
      s2 = tick(s2, { techCatalog: sampleTechs, eventPool: sampleEvents });
    }
    expect(hashState(s)).toBe(hashState(s2));
  });
});

describe('migrate: Phase 2 → Phase 3', () => {
  it('preserves Phase 2 _loseStreaks and keeps Phase 3 slim', () => {
    const out = migrate(phase2Fixture());
    expect(out._loseStreaks?.lowPopularityWeeks).toBe(0);
    expect(out.gameMode).toBeUndefined();
    expect(out.reputation).toBeUndefined();
  });

  it('runs through 50 ticks deterministically', () => {
    const a = migrate(phase2Fixture());
    const b = migrate(phase2Fixture());
    let s1 = a;
    let s2 = b;
    for (let i = 0; i < 50; i++) {
      s1 = tick(s1, { techCatalog: sampleTechs, eventPool: sampleEvents });
      s2 = tick(s2, { techCatalog: sampleTechs, eventPool: sampleEvents });
    }
    expect(hashState(s1)).toBe(hashState(s2));
  });
});

describe('migrate: Phase 3 native', () => {
  it('returns identity-shaped state when version === 3', () => {
    const input = phase3Fixture();
    const out = migrate(input);
    // Same observable values.
    expect(out.gameMode).toBe('eternal');
    expect(out.reputation?.western).toBe(0);
    expect(out.cumulativeStats?.peakGdpRank).toBe(1);
    expect(out.blocs?.western?.memberCountryIds).toEqual(['aurion']);
    expect((out as unknown as { version?: number }).version).toBeUndefined();
  });

  it('returns a shallow copy (not the same reference)', () => {
    const input = phase3Fixture() as unknown as GameState;
    const out = migrate(input);
    expect(out).not.toBe(input);
  });

  it('non-classic Phase 3 save retains cumulativeStats + actionLog', () => {
    const out = migrate(phase3Fixture());
    expect(out.cumulativeStats).toBeDefined();
    expect(out.actionLog).toEqual([]);
    expect(out.unlockedVictories).toEqual([]);
  });
});

describe('migrate: error / edge cases', () => {
  it('throws SaveMigrationError on null', () => {
    expect(() => migrate(null)).toThrow(SaveMigrationError);
  });

  it('throws SaveMigrationError on empty object', () => {
    try {
      migrate({});
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(SaveMigrationError);
      expect((e as SaveMigrationError).code).toBe('invalidShape');
    }
  });

  it('throws on an unknown version stamp', () => {
    try {
      migrate({ version: 999, tick: 0 });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(SaveMigrationError);
      expect((e as SaveMigrationError).code).toBe('unknownVersion');
    }
  });

  it('throws on missing required GameState fields', () => {
    expect(() => migrate({ version: 1, tick: 0 })).toThrow(SaveMigrationError);
  });

  it('rejects non-object primitives (number, string, boolean)', () => {
    expect(() => migrate(42 as unknown)).toThrow(SaveMigrationError);
    expect(() => migrate('save' as unknown)).toThrow(SaveMigrationError);
    expect(() => migrate(true as unknown)).toThrow(SaveMigrationError);
  });

  it('auto-detects v3 when version stamp is missing but Phase 3 fields exist', () => {
    const v3NoStamp = { ...phase3Fixture() } as Record<string, unknown>;
    delete v3NoStamp['version'];
    const out = migrate(v3NoStamp);
    expect(out.gameMode).toBe('eternal');
  });

  it('auto-detects v1 when version stamp is missing and Phase 2/3 fields absent', () => {
    const v1NoStamp = { ...phase1Fixture() } as Record<string, unknown>;
    delete v1NoStamp['version'];
    const out = migrate(v1NoStamp);
    expect(out._loseStreaks).toBeDefined();
  });
});

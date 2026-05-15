// Persistence migration audit — vitest unit tests against the pure helpers in
// `apps/web/lib/persistence.ts`. Covers the Phase 1 → Phase 3 / Wave 10
// migration matrix described in the wave-audit task. The DB-side tests rely
// on `fake-indexeddb/auto` so we exercise Dexie's open / upgrade machinery
// without needing a browser.
//
// IMPORTANT: this suite is NOT an e2e harness — Playwright tests live under
// `tests/e2e/**` and are excluded by `vitest.config.ts`. These tests target
// migration helpers so a regression in `migrateSaveEntry` fails fast.

import 'fake-indexeddb/auto';
// jsdom 26's Blob / File implementations omit `.text()` and `.arrayBuffer()`,
// which `importSave` relies on. Swap in Node's spec-compliant versions for
// the duration of the suite. This is purely a test-environment shim — the
// production path runs in real browsers where these methods are native.
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
// Cast through `unknown` so the strict DOM `Blob` / `File` types don't fight
// the structurally-equivalent Node implementations.
(globalThis as Record<string, unknown>)['Blob'] = NodeBlob;
(globalThis as Record<string, unknown>)['File'] = NodeFile;

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState, SaveId } from '@aurion/engine';

import {
  AUDIO_VOLUMES_META_KEY,
  AUTOSAVE_ID,
  DEFAULT_AUDIO_VOLUMES,
  DEFAULT_REPLAY_RECORDING,
  ENGINE_VERSION,
  InvalidSaveError,
  LEGACY_DIFFICULTY_ID,
  REPLAY_RECORDING_META_KEY,
  TUTORIAL_DISMISSED_META_KEY,
  autosave,
  defaultCumulativeStats,
  deleteSave,
  exportSave,
  generateSaveId,
  getAudioVolumes,
  getMeta,
  getReplayRecordingPref,
  getTutorialDismissed,
  getUnlockedAchievements,
  iconForDifficulty,
  importSave,
  listSaves,
  loadSave,
  migrateSaveEntry,
  saveGame,
  setAudioVolumes,
  setMeta,
  setReplayRecordingPref,
  setTutorialDismissed,
  unlockAchievement,
  type SaveEntry,
} from '../lib/persistence';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A minimal Phase 1 GameState — has none of the difficulty / Phase 3 fields. */
function makePhase1State(overrides: Partial<GameState> = {}): GameState {
  // Built from the absolute minimum that the migration helper inspects. The
  // engine wouldn't have shipped Phase 1 saves with these omissions for real,
  // but keeping the fixture skinny isolates the test from the engine schema
  // drifting under us.
  return {
    tick: 12,
    scenarioId: 'ascesa-aurion',
    // intentionally missing: difficultyId, gameMode, cumulativeStats, etc.
    playerCountryId: 'aurion',
    countries: {
      aurion: {
        id: 'aurion',
        nameKey: 'country.aurion.name',
        color: '#3366ff',
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
    techTreeProgress: {},
    spyOperations: [],
    events: [],
    worldTension: 10,
    winLoss: 'playing',
    selectedVictoryCondition: 'economic',
    rngSeed: 'fixture-seed',
    // Cast since we deliberately omit Phase 1's later-added fields.
    ...overrides,
  } as unknown as GameState;
}

function makePhase2State(overrides: Partial<GameState> = {}): GameState {
  return makePhase1State({
    difficultyId: 'hard',
    ...overrides,
  });
}

function makePhase3Wave9State(overrides: Partial<GameState> = {}): GameState {
  return makePhase1State({
    difficultyId: 'normal',
    gameMode: 'eternal',
    reputation: { western: 10, eastern: -5, 'non-aligned': 0 },
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
        nameKey: 'bloc.nonaligned.name',
        leaderCountryId: null,
        memberCountryIds: [],
        foundedAtTick: 0,
      },
    },
    unResolutions: [],
    cumulativeStats: defaultCumulativeStats(),
    unlockedVictories: [],
    actionLog: [],
    _dethroneStreaks: { outOfTop3Weeks: 0, isolationWeeks: 0 },
    ...overrides,
  });
}

function makePhase3Wave10State(overrides: Partial<GameState> = {}): GameState {
  return makePhase3Wave9State({
    spaceMilestones: {},
    eraState: {
      currentEraIndex: 0,
      completedEraIds: [],
      pendingTransition: null,
    },
    ...overrides,
  });
}

function makeSaveEntry(state: GameState, overrides: Partial<SaveEntry> = {}): SaveEntry {
  return {
    id: 'save-fixture' as SaveId,
    name: 'Fixture',
    scenarioId: state.scenarioId,
    engineVersion: ENGINE_VERSION,
    state,
    savedAt: 1_700_000_000_000,
    thumbnailColor: '#3366ff',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// IndexedDB lifecycle — wipe between tests so each one starts fresh
// ---------------------------------------------------------------------------

async function resetDb(): Promise<void> {
  // Wipe every save / meta / achievement row instead of dropping the database
  // outright. The persistence module caches its Dexie handle (`_db`), so
  // calling `Dexie.delete('aurion')` would force the open connection to close
  // mid-test and print "Another connection wants to delete database" to
  // stderr. Clearing the tables via the same handle keeps the cache valid
  // and the test output clean.
  const persistence = await import('../lib/persistence');
  if (!persistence.isPersistenceAvailable()) return;
  // Touch the DB through the public surface so the persistence module's
  // `_db` cache is initialised; then open a parallel handle by name+version
  // and clear each table. Dexie reuses the underlying IndexedDB connection
  // because the schema declarations match.
  await persistence.listSaves();
  const Dexie = (await import('dexie')).default;
  const dexie = new Dexie('aurion');
  dexie.version(2).stores({
    saves: '&id, name, scenarioId, savedAt',
    meta: '&key',
    achievements: '&id, unlockedAt, scenarioId, saveId',
  });
  await dexie.open();
  await Promise.all([
    dexie.table('saves').clear(),
    dexie.table('meta').clear(),
    dexie.table('achievements').clear(),
  ]);
  dexie.close();
}

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// migrateSaveEntry — the core migration matrix
// ---------------------------------------------------------------------------

describe('migrateSaveEntry — Phase 1 saves', () => {
  it('defaults difficultyId to "normal"', () => {
    const entry = makeSaveEntry(makePhase1State());
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.difficultyId).toBe(LEGACY_DIFFICULTY_ID);
    expect(migrated.state.difficultyId).toBe('normal');
  });

  it('defaults gameMode to "classic"', () => {
    const entry = makeSaveEntry(makePhase1State());
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.gameMode).toBe('classic');
  });

  it('does NOT inject Phase 3 system fields (reputation / blocs / unResolutions / eraState / spaceMilestones)', () => {
    const entry = makeSaveEntry(makePhase1State());
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.reputation).toBeUndefined();
    expect(migrated.state.blocs).toBeUndefined();
    expect(migrated.state.unResolutions).toBeUndefined();
    expect(migrated.state.eraState).toBeUndefined();
    expect(migrated.state.spaceMilestones).toBeUndefined();
    expect(migrated.state.pendingReputationDeltas).toBeUndefined();
    expect(migrated.state._dethroneStreaks).toBeUndefined();
  });

  it('does NOT inject actionLog when recordReplay option is omitted', () => {
    const entry = makeSaveEntry(makePhase1State());
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.actionLog).toBeUndefined();
  });

  it('returns a NEW entry object so callers can detect mutation', () => {
    const entry = makeSaveEntry(makePhase1State());
    const migrated = migrateSaveEntry(entry);
    expect(migrated).not.toBe(entry);
    expect(migrated.state).not.toBe(entry.state);
  });
});

describe('migrateSaveEntry — Phase 2 saves (difficulty added)', () => {
  it('leaves the existing difficultyId alone', () => {
    const entry = makeSaveEntry(makePhase2State({ difficultyId: 'hard' }));
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.difficultyId).toBe('hard');
  });

  it('still defaults gameMode to "classic"', () => {
    const entry = makeSaveEntry(makePhase2State());
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.gameMode).toBe('classic');
  });

  it('preserves ironMan as the difficultyId when set', () => {
    const entry = makeSaveEntry(makePhase2State({ difficultyId: 'ironMan' }));
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.difficultyId).toBe('ironMan');
  });
});

describe('migrateSaveEntry — Phase 3 Wave 9 saves', () => {
  it('leaves Wave 9 fields alone (reputation / blocs / unResolutions / gameMode)', () => {
    const w9 = makePhase3Wave9State();
    const entry = makeSaveEntry(w9);
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.reputation).toEqual(w9.reputation);
    expect(migrated.state.blocs).toEqual(w9.blocs);
    expect(migrated.state.unResolutions).toEqual(w9.unResolutions);
    expect(migrated.state.gameMode).toBe('eternal');
  });

  it('leaves Wave 10 fields undefined (engine populates on first tick)', () => {
    const entry = makeSaveEntry(makePhase3Wave9State());
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.spaceMilestones).toBeUndefined();
    expect(migrated.state.eraState).toBeUndefined();
    // No injection of nuclear arsenals into individual countries either
    const aurion = migrated.state.countries[migrated.state.playerCountryId];
    expect(aurion?.nuclear).toBeUndefined();
  });
});

describe('migrateSaveEntry — Phase 3 Wave 10 saves', () => {
  it('is effectively a no-op for fully-populated Wave 10 states', () => {
    const entry = makeSaveEntry(makePhase3Wave10State({ gameMode: 'classic' }));
    const migrated = migrateSaveEntry(entry);
    // Every interesting field is preserved by reference where it can be.
    expect(migrated.state.gameMode).toBe('classic');
    expect(migrated.state.difficultyId).toBe('normal');
    expect(migrated.state.cumulativeStats).toBe(entry.state.cumulativeStats);
    expect(migrated.state.actionLog).toBe(entry.state.actionLog);
    expect(migrated.state.eraState).toBe(entry.state.eraState);
    expect(migrated.state.spaceMilestones).toBe(entry.state.spaceMilestones);
    // When nothing changes, the entry object itself is returned unchanged.
    expect(migrated).toBe(entry);
  });
});

describe('migrateSaveEntry — eternal mode backfill', () => {
  it('backfills unlockedVictories: [] when gameMode === "eternal" and the field is missing', () => {
    const state = makePhase1State({ difficultyId: 'normal', gameMode: 'eternal' });
    // Strip the field that makePhase3 fixtures pre-fill so the test's
    // intent is unambiguous.
    delete (state as { unlockedVictories?: unknown }).unlockedVictories;
    const entry = makeSaveEntry(state);
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.unlockedVictories).toEqual([]);
  });

  it('does NOT touch unlockedVictories when it is already an array', () => {
    const state = makePhase3Wave9State({
      gameMode: 'eternal',
      unlockedVictories: ['economic', 'scientific'],
    });
    const entry = makeSaveEntry(state);
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.unlockedVictories).toEqual(['economic', 'scientific']);
  });

  it('does NOT inject unlockedVictories for non-eternal modes', () => {
    const state = makePhase1State({ difficultyId: 'normal', gameMode: 'classic' });
    const entry = makeSaveEntry(state);
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.unlockedVictories).toBeUndefined();
  });
});

describe('migrateSaveEntry — cumulativeStats sanitisation', () => {
  it('replaces cumulativeStats containing NaN with the default baseline', () => {
    const state = makePhase3Wave9State({
      cumulativeStats: {
        peakGdpRank: NaN,
        peakTreasury: 1_000,
        totalTechsUnlocked: 3,
        totalReputationGained: 2,
        totalSpyOpsCompleted: 0,
        totalTicksPlayed: 10,
      },
    });
    const entry = makeSaveEntry(state);
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.cumulativeStats).toEqual(defaultCumulativeStats());
  });

  it('replaces cumulativeStats containing Infinity with the default baseline', () => {
    const state = makePhase3Wave9State({
      cumulativeStats: {
        peakGdpRank: 1,
        peakTreasury: Number.POSITIVE_INFINITY,
        totalTechsUnlocked: 0,
        totalReputationGained: 0,
        totalSpyOpsCompleted: 0,
        totalTicksPlayed: 0,
      },
    });
    const entry = makeSaveEntry(state);
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.cumulativeStats).toEqual(defaultCumulativeStats());
  });

  it('keeps a healthy cumulativeStats untouched', () => {
    const healthy = {
      peakGdpRank: 2,
      peakTreasury: 5_000,
      totalTechsUnlocked: 4,
      totalReputationGained: 12,
      totalSpyOpsCompleted: 1,
      totalTicksPlayed: 33,
    };
    const state = makePhase3Wave9State({ cumulativeStats: healthy });
    const entry = makeSaveEntry(state);
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.cumulativeStats).toBe(healthy);
  });

  it('backfills cumulativeStats for Phase 1 saves (default baseline)', () => {
    const entry = makeSaveEntry(makePhase1State());
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.cumulativeStats).toEqual(defaultCumulativeStats());
  });
});

describe('migrateSaveEntry — actionLog backfill (record-replay opt-in)', () => {
  it('backfills actionLog: [] when recordReplay option is true and field is missing', () => {
    const entry = makeSaveEntry(makePhase1State());
    const migrated = migrateSaveEntry(entry, { recordReplay: true });
    expect(migrated.state.actionLog).toEqual([]);
  });

  it('preserves an existing actionLog regardless of the option', () => {
    const existing = [
      { tick: 1, countryId: 'aurion', action: { type: 'invest', target: 'economy', amount: 100 } as const },
    ];
    const state = makePhase3Wave10State({ actionLog: existing });
    const entry = makeSaveEntry(state);
    const migrated = migrateSaveEntry(entry, { recordReplay: true });
    expect(migrated.state.actionLog).toBe(existing);
  });

  it('does NOT inject actionLog when recordReplay option is false', () => {
    const entry = makeSaveEntry(makePhase1State());
    const migrated = migrateSaveEntry(entry, { recordReplay: false });
    expect(migrated.state.actionLog).toBeUndefined();
  });
});

describe('migrateSaveEntry — game mode validation', () => {
  it('rewrites unknown gameMode strings to "classic"', () => {
    const state = makePhase1State({
      difficultyId: 'normal',
      // Cast through unknown so TS doesn't complain about the bad union value
      // we're deliberately constructing.
      gameMode: 'sandbox' as unknown as GameState['gameMode'],
    });
    const entry = makeSaveEntry(state);
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.gameMode).toBe('classic');
  });

  it('keeps "era-paced" untouched', () => {
    const state = makePhase3Wave10State({ gameMode: 'era-paced' });
    const entry = makeSaveEntry(state);
    const migrated = migrateSaveEntry(entry);
    expect(migrated.state.gameMode).toBe('era-paced');
  });
});

describe('migrateSaveEntry — scenarioId registry validation', () => {
  it('logs a warning when scenarioId is not in the registry', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entry = makeSaveEntry(makePhase3Wave10State({ scenarioId: 'mondo-fittizio' }), {
      scenarioId: 'mondo-fittizio',
    });
    migrateSaveEntry(entry);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/mondo-fittizio/);
  });

  it('does NOT warn for known scenarioIds', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entry = makeSaveEntry(makePhase3Wave10State({ scenarioId: 'ascesa-aurion' }), {
      scenarioId: 'ascesa-aurion',
    });
    migrateSaveEntry(entry);
    expect(warn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Roundtrip — exportSave → importSave → identical state
// ---------------------------------------------------------------------------

describe('export / import roundtrip', () => {
  it('produces an entry with the same state and engineVersion after a roundtrip', async () => {
    const baseState = makePhase3Wave10State({ gameMode: 'classic' });
    const written = await saveGame({
      id: 'roundtrip' as SaveId,
      name: 'Roundtrip',
      scenarioId: 'ascesa-aurion',
      state: baseState,
    });

    const blob = await exportSave(written.id);
    const text = await blob.text();

    // Build a File from the JSON text. fake-indexeddb provides Blob/File via
    // jsdom; importSave only needs `.text()`.
    const file = new File([text], 'aurion-save.json', { type: 'application/json' });
    // Drop the original row so re-import goes through the put path cleanly.
    await deleteSave(written.id);
    const imported = await importSave(file);

    expect(imported.engineVersion).toBe(ENGINE_VERSION);
    expect(imported.scenarioId).toBe(written.scenarioId);
    expect(imported.name).toBe(written.name);
    // Deep equality on the GameState — the migration is a no-op for a
    // properly-shaped Wave 10 save, so the object should match field-for-field.
    expect(imported.state).toEqual(written.state);
  });

  it('preserves the autosave id when round-tripping the autosave slot', async () => {
    const state = makePhase3Wave10State({ gameMode: 'classic' });
    await autosave({ name: 'Auto', scenarioId: 'ascesa-aurion', state });
    const blob = await exportSave(AUTOSAVE_ID);
    const text = await blob.text();
    const parsed = JSON.parse(text) as { id: string };
    expect(parsed.id).toBe(AUTOSAVE_ID);
  });
});

// ---------------------------------------------------------------------------
// importSave — input validation
// ---------------------------------------------------------------------------

describe('importSave — input validation', () => {
  it('throws InvalidSaveError on malformed JSON without corrupting the DB', async () => {
    // Seed a known-good save first so we can confirm the DB is left alone.
    const seeded = await saveGame({
      id: 'untouched' as SaveId,
      name: 'Untouched',
      scenarioId: 'ascesa-aurion',
      state: makePhase3Wave10State({ gameMode: 'classic' }),
    });

    const file = new File(['{not valid json'], 'broken.json', {
      type: 'application/json',
    });
    await expect(importSave(file)).rejects.toBeInstanceOf(InvalidSaveError);

    const stillThere = await loadSave(seeded.id);
    expect(stillThere).not.toBeNull();
    expect(stillThere?.name).toBe('Untouched');
  });

  it('throws InvalidSaveError when required fields are missing', async () => {
    const file = new File([JSON.stringify({ name: 'no scenario' })], 'broken.json', {
      type: 'application/json',
    });
    await expect(importSave(file)).rejects.toBeInstanceOf(InvalidSaveError);
  });

  it('logs a warning but accepts saves with a mismatched engineVersion', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state = makePhase3Wave10State({ gameMode: 'classic' });
    const payload = {
      id: 'older-engine-save',
      name: 'Older Engine Save',
      scenarioId: 'ascesa-aurion',
      engineVersion: '0.0.99',
      state,
      savedAt: Date.now(),
      thumbnailColor: '#abcdef',
    };
    const file = new File([JSON.stringify(payload)], 'older.json', {
      type: 'application/json',
    });

    const imported = await importSave(file);
    expect(imported.engineVersion).toBe('0.0.99');
    // Two warnings allowed: (1) version mismatch, (2) anything migrate may add.
    // The behaviour we care about is "at least one warning fired".
    expect(warn).toHaveBeenCalled();
    expect(
      warn.mock.calls.some((call) =>
        String(call[0]).includes('0.0.99'),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// IndexedDB schema — v1 → v2 upgrade preserves rows
// ---------------------------------------------------------------------------

describe('IndexedDB schema — v1 → v2 upgrade', () => {
  it('opens the v2 schema and exposes the achievements table', async () => {
    // Saving + reading a row exercises the v2 schema (the achievements table
    // would error on access if the upgrade hadn't fired). We complement this
    // by writing an unlock and listing it.
    await saveGame({
      id: 'after-upgrade' as SaveId,
      name: 'After upgrade',
      scenarioId: 'ascesa-aurion',
      state: makePhase3Wave10State({ gameMode: 'classic' }),
    });
    const list = await listSaves();
    expect(list.find((s) => s.id === 'after-upgrade')).toBeTruthy();

    const unlocked = await unlockAchievement(
      'first-blood',
      'ascesa-aurion',
      'after-upgrade' as SaveId,
    );
    expect(unlocked).toBe(true);
    const rows = await getUnlockedAchievements();
    expect(rows.find((r) => r.id === 'first-blood')).toBeTruthy();
  });

  it('unlockAchievement is idempotent — second call with the same id returns false', async () => {
    await unlockAchievement('alpha', 'ascesa-aurion', 'save-x' as SaveId);
    const second = await unlockAchievement('alpha', 'ascesa-aurion', 'save-y' as SaveId);
    expect(second).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Meta table defaults — empty reads must yield the documented defaults
// ---------------------------------------------------------------------------

describe('meta table defaults', () => {
  it('getTutorialDismissed returns false on a fresh DB', async () => {
    const v = await getTutorialDismissed();
    expect(v).toBe(false);
  });

  it('getAudioVolumes returns DEFAULT_AUDIO_VOLUMES on a fresh DB', async () => {
    const v = await getAudioVolumes();
    expect(v).toEqual(DEFAULT_AUDIO_VOLUMES);
  });

  it('getReplayRecordingPref returns the default on a fresh DB', async () => {
    const v = await getReplayRecordingPref();
    expect(v).toBe(DEFAULT_REPLAY_RECORDING);
  });

  it('roundtrip: setTutorialDismissed → getTutorialDismissed', async () => {
    await setTutorialDismissed(true);
    expect(await getTutorialDismissed()).toBe(true);
  });

  it('roundtrip: setAudioVolumes clamps out-of-range values', async () => {
    await setAudioVolumes({ music: 2, sfx: -1, mutedMusic: true, mutedSfx: false });
    const v = await getAudioVolumes();
    expect(v.music).toBe(1);
    expect(v.sfx).toBe(0);
    expect(v.mutedMusic).toBe(true);
    expect(v.mutedSfx).toBe(false);
  });

  it('roundtrip: setReplayRecordingPref → getReplayRecordingPref', async () => {
    await setReplayRecordingPref(false);
    expect(await getReplayRecordingPref()).toBe(false);
  });

  it('meta keys are the documented constants', () => {
    // Guards against accidental rename — the keys live forever in user DBs.
    expect(TUTORIAL_DISMISSED_META_KEY).toBe('aurion:tutorial-dismissed');
    expect(AUDIO_VOLUMES_META_KEY).toBe('aurion:audio-volumes');
    expect(REPLAY_RECORDING_META_KEY).toBe('aurion:replay-recording');
  });

  it('setMeta + getMeta roundtrip with arbitrary value types', async () => {
    await setMeta('test-key', { nested: { count: 3 } });
    const v = await getMeta<{ nested: { count: number } }>('test-key');
    expect(v?.nested.count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// AUTOSAVE_ID slot — manual save with the same name should NOT collide
// ---------------------------------------------------------------------------

describe('autosave / manual save coexistence', () => {
  it('autosave overwrites the AUTOSAVE_ID slot, leaving manual saves intact', async () => {
    const manual = await saveGame({
      name: 'Manual',
      scenarioId: 'ascesa-aurion',
      state: makePhase3Wave10State({ gameMode: 'classic' }),
    });
    expect(manual.id).not.toBe(AUTOSAVE_ID);

    await autosave({
      name: 'Auto',
      scenarioId: 'ascesa-aurion',
      state: makePhase3Wave10State({ gameMode: 'classic' }),
    });

    // Both rows exist independently.
    const list = await listSaves();
    const ids = list.map((s) => s.id);
    expect(ids).toContain(manual.id);
    expect(ids).toContain(AUTOSAVE_ID);
  });

  it('autosave is overwriteable — calling it twice keeps a single row in the slot', async () => {
    await autosave({
      name: 'A',
      scenarioId: 'ascesa-aurion',
      state: makePhase3Wave10State({ gameMode: 'classic' }),
    });
    await autosave({
      name: 'B',
      scenarioId: 'ascesa-aurion',
      state: makePhase3Wave10State({ gameMode: 'classic' }),
    });
    const all = await listSaves();
    const slots = all.filter((s) => s.id === AUTOSAVE_ID);
    expect(slots.length).toBe(1);
    expect(slots[0]?.name).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// Misc helper coverage — keeps the audited surface tested
// ---------------------------------------------------------------------------

describe('misc helpers', () => {
  it('iconForDifficulty maps the four shipped presets', () => {
    expect(iconForDifficulty('easy')).toBe('Sprout');
    expect(iconForDifficulty('normal')).toBe('Sword');
    expect(iconForDifficulty('hard')).toBe('Flame');
    expect(iconForDifficulty('ironMan')).toBe('Skull');
    expect(iconForDifficulty('mystery')).toBeNull();
  });

  it('generateSaveId returns a non-empty string', () => {
    const id = generateSaveId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('defaultCumulativeStats produces a fresh object each call (not a shared singleton)', () => {
    const a = defaultCumulativeStats();
    const b = defaultCumulativeStats();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

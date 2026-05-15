// IndexedDB persistence layer (Dexie). Multi-slot saves, autosave, export/import.
//
// We intentionally keep this file framework-light — no React imports.
// The DB is opened lazily on first access so that SSR / build-time imports
// don't fail (IndexedDB is not available on the server).

import Dexie, { type Table } from 'dexie';
import type {
  AchievementId,
  CumulativeStats,
  GameState,
  SaveId,
} from '@aurion/engine';
import { getScenarioMeta } from './scenarios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SaveEntry = {
  id: SaveId;
  name: string;
  scenarioId: string;
  engineVersion: string;
  state: GameState;
  savedAt: number;
  thumbnailColor: string;
};

/** Light projection used by the home screen — omits the heavy `state`. */
export type SaveSummary = Omit<SaveEntry, 'state'>;

export type MetaEntry = {
  key: string;
  value: unknown;
};

/**
 * Cross-game achievement unlock record. Persisted in its own Dexie table so
 * the home / achievements pages can list everything the player has earned
 * without loading any save's full GameState. The (id) is the primary key —
 * unlocks are intentionally idempotent: re-firing the same achievement from
 * a later save is a no-op rather than overwriting the original timestamp.
 */
export type UnlockedAchievement = {
  id: AchievementId;
  /** Wall-clock unlock time (ms since epoch). */
  unlockedAt: number;
  /** Scenario the player was running when the achievement first fired. */
  scenarioId: string;
  /** Save id of the run where the achievement first fired. */
  saveId: SaveId;
};

/** Reserved slot id for the rolling autosave. */
export const AUTOSAVE_ID: SaveId = '__autosave';

/**
 * Engine version used to tag saves so that future versions can detect / migrate
 * stored states. The engine package does not yet export a runtime version
 * constant; we mirror its `package.json` version here. Bump in lockstep.
 */
export const ENGINE_VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Thrown when IndexedDB rejects a write because of disk quota. */
export class PersistenceQuotaError extends Error {
  constructor(message = 'IndexedDB quota exceeded') {
    super(message);
    this.name = 'PersistenceQuotaError';
  }
}

/** Thrown when an imported save is missing required fields. */
export class InvalidSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSaveError';
  }
}

/** Thrown when the engine version of a save does not match the running app. */
export class SaveVersionMismatchError extends Error {
  readonly saveVersion: string;
  readonly currentVersion: string;
  constructor(saveVersion: string, currentVersion: string) {
    super(
      `Save engine version ${saveVersion} does not match current ${currentVersion}`,
    );
    this.name = 'SaveVersionMismatchError';
    this.saveVersion = saveVersion;
    this.currentVersion = currentVersion;
  }
}

/**
 * Thrown when the UI tries to persist a save while Iron Man is active and the
 * game is still in `playing` state. Iron Man games are permadeath: the player
 * may only commit a single save once the run resolves to `won` or `lost`.
 *
 * The store layer (see `lib/store.ts`) guards calls into `saveGame` with this
 * error so the UI can surface a localised toast (`errors.saveLocked`) without
 * having to re-encode the rule itself.
 */
export class SaveLockedError extends Error {
  /** Discriminator so future "locked" reasons can be added without breaking callers. */
  readonly reason: 'ironMan';
  constructor(message = 'Saves are locked while Iron Man is in play') {
    super(message);
    this.name = 'SaveLockedError';
    this.reason = 'ironMan';
  }
}

// ---------------------------------------------------------------------------
// Difficulty UI helpers
// ---------------------------------------------------------------------------

/**
 * Map a difficulty preset id to a small icon hint the UI may render next to
 * its label. Returns a lucide-react icon name (e.g. `Skull` for Iron Man,
 * `Flame` for Hard) or `null` when no icon is appropriate. Callers are free
 * to ignore this — it's purely cosmetic — and the engine never reads it.
 *
 * The function is data-only so it can be used outside React (tests, SSR
 * helpers, headless tooling).
 */
export function iconForDifficulty(difficultyId: string): string | null {
  switch (difficultyId) {
    case 'easy':
      return 'Sprout';
    case 'normal':
      return 'Sword';
    case 'hard':
      return 'Flame';
    case 'ironMan':
      return 'Skull';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// DB schema
// ---------------------------------------------------------------------------

class AurionDB extends Dexie {
  saves!: Table<SaveEntry, SaveId>;
  meta!: Table<MetaEntry, string>;
  achievements!: Table<UnlockedAchievement, AchievementId>;

  constructor() {
    super('aurion');
    // v1 — original schema (saves + meta). Kept exactly as-shipped so Dexie
    // performs an in-place upgrade for existing browsers without touching
    // existing rows.
    this.version(1).stores({
      saves: '&id, name, scenarioId, savedAt',
      meta: '&key',
    });
    // v2 — adds the `achievements` table. Dexie carries v1's saves/meta
    // forward automatically because their store specs are unchanged.
    this.version(2).stores({
      saves: '&id, name, scenarioId, savedAt',
      meta: '&key',
      achievements: '&id, unlockedAt, scenarioId, saveId',
    });
  }
}

let _db: AurionDB | null = null;

/** Lazily create the DB on first access (browser-only). */
function db(): AurionDB {
  if (typeof indexedDB === 'undefined') {
    throw new Error('persistence: IndexedDB is not available in this environment');
  }
  if (!_db) {
    _db = new AurionDB();
  }
  return _db;
}

/** True when running in an environment that has IndexedDB. */
export function isPersistenceAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'QuotaExceededError') return true;
  // Dexie wraps original errors — check the message and any nested cause too.
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error && cause.name === 'QuotaExceededError') return true;
  return /quota/i.test(err.message);
}

async function withWriteGuard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isQuotaError(err)) {
      throw new PersistenceQuotaError(
        err instanceof Error ? err.message : undefined,
      );
    }
    throw err;
  }
}

function pickThumbnailColor(state: GameState): string {
  const player = state.countries[state.playerCountryId];
  return player?.color ?? '#6366f1';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** List saves without loading their full GameState. Newest first. */
export async function listSaves(): Promise<SaveSummary[]> {
  if (!isPersistenceAvailable()) return [];
  const rows = await db()
    .saves.orderBy('savedAt')
    .reverse()
    .toArray();
  // Strip the inflated GameState from each row before returning summaries.
  return rows.map((row) => {
    const { state: _state, ...rest } = row;
    void _state;
    return rest;
  });
}

/** Load a single save (including its full GameState) by id. */
export async function loadSave(id: SaveId): Promise<SaveEntry | null> {
  if (!isPersistenceAvailable()) return null;
  const row = await db().saves.get(id);
  if (!row) return null;
  // Read the replay-recording preference so the migration can decide whether
  // to backfill `state.actionLog`. Defaulted via `getReplayRecordingPref`'s
  // fallback when the meta table has no entry yet.
  const recordReplay = await getReplayRecordingPref().catch(() => DEFAULT_REPLAY_RECORDING);
  return migrateSaveEntry(row, { recordReplay });
}

/**
 * Default difficulty applied to legacy saves that were written before the
 * Phase 2 wizard stamped a `difficultyId` into the GameState. Phase 1 only
 * shipped the `normal` preset, so this preserves observed behaviour.
 */
export const LEGACY_DIFFICULTY_ID = 'normal';

/**
 * Zero-initialised CumulativeStats for legacy saves that predate Phase 3.
 * The engine populates these correctly going forward (see
 * `packages/engine/src/cumulativeStats/*`). Keeping the helper exported lets
 * tests assert against the exact baseline used by the migration.
 */
export function defaultCumulativeStats(): CumulativeStats {
  return {
    peakGdpRank: 999,
    peakTreasury: 0,
    totalTechsUnlocked: 0,
    totalReputationGained: 0,
    totalSpyOpsCompleted: 0,
    totalTicksPlayed: 0,
  };
}

/**
 * Returns true when every numeric field on the supplied CumulativeStats is
 * finite. Old code paths could produce NaN / Infinity (e.g. dividing by zero
 * in a peakGdpRank computation before the engine guarded against empty
 * country rosters); migrations sanitise those rows so the HUD never renders
 * "NaN/3" badges.
 */
function isCumulativeStatsHealthy(stats: CumulativeStats | undefined): boolean {
  if (!stats || typeof stats !== 'object') return false;
  const values: unknown[] = [
    stats.peakGdpRank,
    stats.peakTreasury,
    stats.totalTechsUnlocked,
    stats.totalReputationGained,
    stats.totalSpyOpsCompleted,
    stats.totalTicksPlayed,
  ];
  for (const v of values) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  }
  return true;
}

/**
 * Closed set of game modes the engine recognises. Anything outside the set is
 * treated as a legacy / corrupt value and rewritten to `'classic'` during
 * migration. Mirrors the union in `packages/engine/src/types.ts:GameMode`.
 */
const KNOWN_GAME_MODES: ReadonlySet<string> = new Set([
  'classic',
  'eternal',
  'dethrone',
  'era-paced',
]);

/**
 * Light, in-place migration for save entries loaded from disk. Handles
 * additive Phase 1→3 defaults so older saves load cleanly:
 *
 *   - `state.difficultyId`        — Phase 1 saves predate the wizard choice;
 *                                   default to `LEGACY_DIFFICULTY_ID`.
 *   - `state.gameMode`            — Phase 1/2 saves predate game-mode
 *                                   selection; default to `'classic'`. Unknown
 *                                   values are coerced to `'classic'` too so
 *                                   downstream selectors don't have to defend
 *                                   against typos.
 *   - `state.cumulativeStats`     — Phase 1/2 saves never carried these.
 *                                   Backfill with a zero baseline so the
 *                                   Eternal-mode HUD doesn't blow up. Saves
 *                                   that carry NaN / Infinity values (from a
 *                                   prior bug) are also reset.
 *   - `state.unlockedVictories`   — when the save reports `gameMode === 'eternal'`
 *                                   but lacks the array, backfill with `[]` so
 *                                   the milestone toast logic in the store has
 *                                   a stable shape to diff against.
 *   - `state.actionLog`           — backfill with `[]` when undefined so future
 *                                   ticks can append regardless of when the
 *                                   replay-recording preference was toggled.
 *
 * Returns the (possibly patched) entry. Kept as a pure function so persistence
 * tests can exercise it directly without spinning up Dexie.
 *
 * NOTE: we intentionally DO NOT initialise `_dethroneStreaks` or any other
 * Phase 3 system fields (reputation / blocs / unResolutions / eraState /
 * spaceMilestones) here — they're tracked by the engine and meaningful only
 * for runs in the matching mode (or scenarios that opt in). A `classic` /
 * Phase-1 save should never carry those fields, so leaving them undefined
 * is the correct default and the engine treats undefined as "system not in
 * use".
 *
 * Also logs a console warning when `entry.scenarioId` is not present in the
 * scenario registry — old beta saves carrying decommissioned scenario ids
 * (e.g. `'mondo-fittizio'`) will fail to load anyway, but a clear warning
 * up-front beats a cryptic ScenarioNotFoundError later.
 */
/**
 * Optional knobs for `migrateSaveEntry`. Passed-in flags let callers reflect
 * the player's current preferences (replay recording, etc.) without forcing
 * the migration to be async. Defaults are the conservative no-op choices —
 * the migration only adds fields that downstream code is known to require.
 */
export type MigrateSaveOptions = {
  /**
   * When true, `state.actionLog` is backfilled with an empty array if missing
   * so the engine's next tick can append. Default false: a save that opts
   * out of recording should not silently inflate with a replay buffer.
   */
  recordReplay?: boolean;
};

export function migrateSaveEntry(
  entry: SaveEntry,
  options: MigrateSaveOptions = {},
): SaveEntry {
  const state = entry.state as GameState | undefined;
  if (!state) return entry;

  if (entry.scenarioId && !getScenarioMeta(entry.scenarioId)) {
    console.warn(
      `[persistence] Save references unknown scenarioId "${entry.scenarioId}". ` +
        `It is no longer in the registry; loading will fail. Consider deleting this save.`,
    );
  }

  let nextState = state;
  let mutated = false;

  if (
    typeof nextState.difficultyId !== 'string' ||
    nextState.difficultyId.length === 0
  ) {
    nextState = { ...nextState, difficultyId: LEGACY_DIFFICULTY_ID };
    mutated = true;
  }

  if (
    typeof nextState.gameMode !== 'string' ||
    !KNOWN_GAME_MODES.has(nextState.gameMode)
  ) {
    nextState = { ...nextState, gameMode: 'classic' };
    mutated = true;
  }

  if (!isCumulativeStatsHealthy(nextState.cumulativeStats)) {
    nextState = { ...nextState, cumulativeStats: defaultCumulativeStats() };
    mutated = true;
  }

  // Eternal-mode saves should always carry an `unlockedVictories` array so the
  // store's milestone-toast diff has a stable shape. Older Wave 9 saves where
  // the field hadn't been written yet would otherwise diff against `undefined`
  // every tick (harmless, but noisy in the engine logs).
  if (
    nextState.gameMode === 'eternal' &&
    !Array.isArray(nextState.unlockedVictories)
  ) {
    nextState = { ...nextState, unlockedVictories: [] };
    mutated = true;
  }

  // Replay action log: scaffolded in Wave 9 so future ticks can append. Only
  // backfill when the player actually has replay recording enabled — leaving
  // the array undefined for opted-out players keeps the field truly optional
  // (and avoids growing the save on every tick of a run that won't be replayed).
  if (options.recordReplay === true && !Array.isArray(nextState.actionLog)) {
    nextState = { ...nextState, actionLog: [] };
    mutated = true;
  }

  return mutated ? { ...entry, state: nextState } : entry;
}

export type SaveGameInput = {
  /** If omitted, a fresh uuid is generated. Pass AUTOSAVE_ID to overwrite the autosave slot. */
  id?: SaveId;
  name: string;
  scenarioId: string;
  state: GameState;
};

/**
 * Persist a save, generating an id when none is provided. Wraps DB writes so
 * that quota errors surface as `PersistenceQuotaError` for the UI to handle.
 */
export async function saveGame(input: SaveGameInput): Promise<SaveEntry> {
  const id = input.id ?? generateSaveId();
  const entry: SaveEntry = {
    id,
    name: input.name,
    scenarioId: input.scenarioId,
    engineVersion: ENGINE_VERSION,
    state: input.state,
    savedAt: Date.now(),
    thumbnailColor: pickThumbnailColor(input.state),
  };
  await withWriteGuard(() => db().saves.put(entry));
  return entry;
}

/** Convenience: overwrite the rolling autosave slot. */
export async function autosave(input: Omit<SaveGameInput, 'id'>): Promise<SaveEntry> {
  return saveGame({ ...input, id: AUTOSAVE_ID });
}

export async function deleteSave(id: SaveId): Promise<void> {
  if (!isPersistenceAvailable()) return;
  await withWriteGuard(() => db().saves.delete(id));
}

/** Serialize a save to a Blob suitable for download. */
export async function exportSave(id: SaveId): Promise<Blob> {
  const entry = await loadSave(id);
  if (!entry) throw new InvalidSaveError(`No save with id ${id}`);
  const json = JSON.stringify(entry, null, 2);
  return new Blob([json], { type: 'application/json' });
}

/**
 * Validate and import a save from a user-provided File. Throws InvalidSaveError
 * if the payload is malformed; throws SaveVersionMismatchError when the
 * engineVersion is missing — but accepts mismatched versions with a console
 * warning so future migrations can be added.
 */
export async function importSave(file: File): Promise<SaveEntry> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InvalidSaveError('File is not valid JSON');
  }
  const recordReplay = await getReplayRecordingPref().catch(() => DEFAULT_REPLAY_RECORDING);
  const entry = migrateSaveEntry(normalizeImportedSave(parsed), { recordReplay });
  await withWriteGuard(() => db().saves.put(entry));
  return entry;
}

function normalizeImportedSave(raw: unknown): SaveEntry {
  if (!raw || typeof raw !== 'object') {
    throw new InvalidSaveError('Save payload is not an object');
  }
  const obj = raw as Record<string, unknown>;
  const requiredStringFields = ['name', 'scenarioId', 'engineVersion'] as const;
  for (const field of requiredStringFields) {
    if (typeof obj[field] !== 'string') {
      throw new InvalidSaveError(`Missing or invalid "${field}" in save`);
    }
  }
  if (!obj['state'] || typeof obj['state'] !== 'object') {
    throw new InvalidSaveError('Missing or invalid "state" in save');
  }
  const engineVersion = obj['engineVersion'] as string;
  if (engineVersion !== ENGINE_VERSION) {
    // Non-fatal: log and accept. Future migrations may handle this.
    console.warn(
      `[persistence] Imported save was created with engine ${engineVersion}, current is ${ENGINE_VERSION}. Loading anyway.`,
    );
  }
  const id = typeof obj['id'] === 'string' ? (obj['id'] as SaveId) : generateSaveId();
  const savedAt =
    typeof obj['savedAt'] === 'number' ? (obj['savedAt'] as number) : Date.now();
  const thumbnailColor =
    typeof obj['thumbnailColor'] === 'string'
      ? (obj['thumbnailColor'] as string)
      : pickThumbnailColor(obj['state'] as GameState);

  return {
    id,
    name: obj['name'] as string,
    scenarioId: obj['scenarioId'] as string,
    engineVersion,
    state: obj['state'] as GameState,
    savedAt,
    thumbnailColor,
  };
}

/** Generate a save id. Uses crypto.randomUUID when available, falling back to a timestamp. */
export function generateSaveId(): SaveId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID() as SaveId;
  }
  return `save-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` as SaveId;
}

// ---------------------------------------------------------------------------
// Meta key/value (unused for now but reserved for prefs we don't keep in localStorage)
// ---------------------------------------------------------------------------

export async function setMeta(key: string, value: unknown): Promise<void> {
  if (!isPersistenceAvailable()) return;
  await withWriteGuard(() => db().meta.put({ key, value }));
}

export async function getMeta<T>(key: string): Promise<T | null> {
  if (!isPersistenceAvailable()) return null;
  const row = await db().meta.get(key);
  return row ? (row.value as T) : null;
}

// ---------------------------------------------------------------------------
// Tutorial flag — convenience wrappers around the meta store so callers don't
// have to remember the magic key string. The flag is intentionally kept in the
// `meta` table (not localStorage) so it survives storage clearing of other
// origins and is part of a future "reset progress" sweep.
// ---------------------------------------------------------------------------

/** Reserved meta key for the first-time tutorial dismissal flag. */
export const TUTORIAL_DISMISSED_META_KEY = 'aurion:tutorial-dismissed';

/**
 * Read whether the player has already dismissed (or completed) the first-time
 * tutorial. Defaults to `false` when no flag is stored or when persistence is
 * unavailable (SSR, private browsing without IndexedDB).
 */
export async function getTutorialDismissed(): Promise<boolean> {
  const value = await getMeta<boolean>(TUTORIAL_DISMISSED_META_KEY);
  return value === true;
}

/** Persist the tutorial dismissal flag. */
export async function setTutorialDismissed(value: boolean): Promise<void> {
  await setMeta(TUTORIAL_DISMISSED_META_KEY, value);
}

// ---------------------------------------------------------------------------
// Audio volume preferences — kept in the meta table so they survive across
// devices the next time we add cloud sync, and so they don't compete for the
// localStorage budget Zustand already uses for speed/panel prefs.
// ---------------------------------------------------------------------------

/** Reserved meta key for the per-category audio volumes + mute flags. */
export const AUDIO_VOLUMES_META_KEY = 'aurion:audio-volumes';

/**
 * Persisted shape for audio volume preferences. Keeps `music` and `sfx` as
 * 0..1 floats and per-category mute booleans. Mute is intentionally separate
 * from volume so toggling mute doesn't lose the player's chosen level.
 */
export type AudioVolumePrefs = {
  music: number;
  sfx: number;
  mutedMusic?: boolean;
  mutedSfx?: boolean;
};

/** Defaults applied when no preference has been stored yet. */
export const DEFAULT_AUDIO_VOLUMES: AudioVolumePrefs = {
  music: 0.5,
  sfx: 0.7,
  mutedMusic: false,
  mutedSfx: false,
};

function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Read the persisted audio volume preferences. Falls back to
 * `DEFAULT_AUDIO_VOLUMES` when no entry has been written yet OR when
 * persistence is unavailable (SSR, private mode without IndexedDB).
 */
export async function getAudioVolumes(): Promise<AudioVolumePrefs> {
  const raw = await getMeta<Partial<AudioVolumePrefs>>(AUDIO_VOLUMES_META_KEY);
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_AUDIO_VOLUMES };
  return {
    music: clampVolume(raw.music, DEFAULT_AUDIO_VOLUMES.music),
    sfx: clampVolume(raw.sfx, DEFAULT_AUDIO_VOLUMES.sfx),
    mutedMusic: raw.mutedMusic === true,
    mutedSfx: raw.mutedSfx === true,
  };
}

/** Persist audio volume preferences. Values are clamped to 0..1. */
export async function setAudioVolumes(prefs: AudioVolumePrefs): Promise<void> {
  const normalized: AudioVolumePrefs = {
    music: clampVolume(prefs.music, DEFAULT_AUDIO_VOLUMES.music),
    sfx: clampVolume(prefs.sfx, DEFAULT_AUDIO_VOLUMES.sfx),
    mutedMusic: prefs.mutedMusic === true,
    mutedSfx: prefs.mutedSfx === true,
  };
  await setMeta(AUDIO_VOLUMES_META_KEY, normalized);
}

// ---------------------------------------------------------------------------
// Replay recording preference (Phase 3 / Wave 9 scaffolding for future Wave
// 11+ Replay UI). When enabled, the engine populates `state.actionLog` with
// every action / tick. Default ON per spec Q9 — overhead is negligible and
// most players will want the option to relive their best runs later.
// ---------------------------------------------------------------------------

/** Reserved meta key for the replay-recording opt-in/out toggle. */
export const REPLAY_RECORDING_META_KEY = 'aurion:replay-recording';

/** Default value when no preference has been stored yet. */
export const DEFAULT_REPLAY_RECORDING = true;

/**
 * Read whether replay recording is currently enabled. Defaults to
 * `DEFAULT_REPLAY_RECORDING` (true) when no preference has been stored OR
 * persistence is unavailable (SSR, private browsing). Returning a Promise
 * mirrors the rest of the meta surface so callers can `await` without
 * branching.
 */
export async function getReplayRecordingPref(): Promise<boolean> {
  const value = await getMeta<boolean>(REPLAY_RECORDING_META_KEY);
  if (value === null) return DEFAULT_REPLAY_RECORDING;
  return value === true;
}

/**
 * Persist the replay-recording preference. Stored as a boolean in the meta
 * table so it survives across saves and isn't competing with the localStorage
 * budget Zustand uses for speed/panel prefs.
 */
export async function setReplayRecordingPref(value: boolean): Promise<void> {
  await setMeta(REPLAY_RECORDING_META_KEY, value === true);
}

// ---------------------------------------------------------------------------
// Achievements (cross-game unlocks)
//
// Stored in their own table so they survive deleting individual saves and so
// the home page can render the catalogue without loading any GameState. The
// engine exposes the (pure) evaluator that produces ids; the writes here are
// the bridge between that evaluator and the player's persistent profile.
// ---------------------------------------------------------------------------

/**
 * List every achievement the player has unlocked, ordered most-recent-first.
 * Returns an empty array when persistence is unavailable (SSR, private mode)
 * so callers can render the catalogue uniformly.
 */
export async function getUnlockedAchievements(): Promise<UnlockedAchievement[]> {
  if (!isPersistenceAvailable()) return [];
  return db().achievements.orderBy('unlockedAt').reverse().toArray();
}

/**
 * Idempotent unlock: writes a record only when one does not already exist for
 * the given id. Re-firing a previously-unlocked achievement is a silent no-op
 * (the original `unlockedAt` / `scenarioId` / `saveId` are preserved). Returns
 * `true` when a NEW unlock was written, `false` when the achievement was
 * already in the table (or persistence is unavailable).
 */
export async function unlockAchievement(
  id: AchievementId,
  scenarioId: string,
  saveId: SaveId,
): Promise<boolean> {
  if (!isPersistenceAvailable()) return false;
  const existing = await db().achievements.get(id);
  if (existing) return false;
  const entry: UnlockedAchievement = {
    id,
    scenarioId,
    saveId,
    unlockedAt: Date.now(),
  };
  await withWriteGuard(() => db().achievements.put(entry));
  return true;
}

// IndexedDB persistence layer (Dexie). Multi-slot saves, autosave, export/import.
//
// We intentionally keep this file framework-light — no React imports.
// The DB is opened lazily on first access so that SSR / build-time imports
// don't fail (IndexedDB is not available on the server).

import Dexie, { type Table } from 'dexie';
import type { GameState, SaveId } from '@aurion/engine';

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

// ---------------------------------------------------------------------------
// DB schema
// ---------------------------------------------------------------------------

class AurionDB extends Dexie {
  saves!: Table<SaveEntry, SaveId>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super('aurion');
    this.version(1).stores({
      saves: '&id, name, scenarioId, savedAt',
      meta: '&key',
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
  return row ?? null;
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
  const entry = normalizeImportedSave(parsed);
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

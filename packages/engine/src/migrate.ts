// Explicit save-format migration shim.
//
// Until now older saves "auto-upgraded" because every Phase 2 / Phase 3 field
// on `GameState` is optional. That works at runtime but it's fragile: a typo
// in a downstream consumer (or a new required field) silently corrupts the
// state. This module makes the upgrade path explicit and testable.
//
// Version history:
//   v1 — Phase 1 ship. Core GameState without `_loseStreaks`, no Phase 3
//        fields (no `reputation`, `blocs`, `unResolutions`, `gameMode`,
//        `cumulativeStats`, `unlockedVictories`, `actionLog`, `spaceMilestones`,
//        `eraState`, no per-country `blocId`/`nuclear`).
//   v2 — Phase 2 added `_loseStreaks`, the extended `DifficultyTuning`
//        modifiers, and the optional `tags` on event definitions. Save shape
//        otherwise identical to v1 from the engine's point of view.
//   v3 — Phase 3 / Wave 9-10. All the optional fields enumerated above.
//
// `migrate(save)` is a pure transform: it returns a fully-typed `GameState`
// with sane defaults filled in for any phase the input save predates. It does
// not run the tick loop, mutate inputs, or perform I/O.

import type {
  ActiveBlocId,
  CumulativeStats,
  GameState,
  LoseStreaks,
  ReputationByBloc,
} from './types.js';

/** Current save format version. Bump when the engine adds a new mandatory shape change. */
export const SAVE_VERSION = 3 as const;

/** Known historical save versions. Anything else is rejected. */
const KNOWN_VERSIONS: readonly number[] = [1, 2, 3];

/**
 * Custom error class raised when `migrate` cannot make sense of the input
 * payload. Callers can `instanceof` check this to distinguish "we know the
 * save is bad" from generic JSON errors upstream.
 */
export class SaveMigrationError extends Error {
  readonly code: 'unknownVersion' | 'invalidShape' | 'unsupportedVersion';
  constructor(code: SaveMigrationError['code'], message: string) {
    super(message);
    this.name = 'SaveMigrationError';
    this.code = code;
  }
}

type VersionedSave = { version?: number } & Record<string, unknown>;

/**
 * Default `LoseStreaks` block for Phase 1 saves that predate the field.
 * Kept in sync with `checkWinLoss` initial values.
 */
function defaultLoseStreaks(): LoseStreaks {
  return {
    lowPopularityWeeks: 0,
    negativeTreasuryWeeks: 0,
    capitalOccupiedWeeks: 0,
    allFactionsAngryWeeks: 0,
  };
}

/**
 * Default cumulative stats used when bumping an older save into a Phase 3
 * non-classic mode. The engine treats `gameMode === 'classic'` as "stats not
 * required", so this is only filled when the input declares another mode.
 */
function defaultCumulativeStats(): CumulativeStats {
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
 * Detect the source version of a save payload.
 *   - explicit `version` field → use it (must be in KNOWN_VERSIONS)
 *   - no `version` and the save has Phase 3 fields → treat as v3
 *   - no `version` and only Phase 2 fields → treat as v2
 *   - no `version` and only Phase 1 fields → treat as v1
 */
function detectVersion(save: VersionedSave): 1 | 2 | 3 {
  if (typeof save.version === 'number') {
    if (!KNOWN_VERSIONS.includes(save.version)) {
      throw new SaveMigrationError(
        'unknownVersion',
        `migrate: unknown save version ${save.version}; expected one of ${KNOWN_VERSIONS.join(', ')}`,
      );
    }
    return save.version as 1 | 2 | 3;
  }
  // Heuristic detection for legacy saves that never stamped a version.
  const looksLikeV3 =
    'reputation' in save ||
    'blocs' in save ||
    'unResolutions' in save ||
    'gameMode' in save ||
    'cumulativeStats' in save ||
    'spaceMilestones' in save ||
    'eraState' in save;
  if (looksLikeV3) return 3;
  const looksLikeV2 = '_loseStreaks' in save;
  if (looksLikeV2) return 2;
  return 1;
}

/**
 * Minimal structural validation. We don't want to teach this module the full
 * scenario schema — that's `createGame`'s job. We just require that the input
 * looks like a `GameState` at the top level.
 */
function assertCoreShape(save: VersionedSave): void {
  const required = [
    'tick',
    'scenarioId',
    'difficultyId',
    'playerCountryId',
    'countries',
    'relations',
    'techTreeProgress',
    'spyOperations',
    'events',
    'worldTension',
    'winLoss',
    'selectedVictoryCondition',
    'rngSeed',
  ] as const;
  for (const key of required) {
    if (!(key in save)) {
      throw new SaveMigrationError(
        'invalidShape',
        `migrate: missing required GameState field "${key}"`,
      );
    }
  }
}

/**
 * Phase 1 → Phase 2 upgrade. Stamps in `_loseStreaks` if absent.
 * Phase 2 changes to DifficultyTuning/EventTags live in scenario data, not
 * GameState, so the runtime upgrade here is a single field.
 */
function upgradeV1toV2(save: GameState): GameState {
  if (save._loseStreaks) return save;
  return { ...save, _loseStreaks: defaultLoseStreaks() };
}

/**
 * Phase 2 → Phase 3 upgrade. Phase 3 fields are all optional on `GameState`,
 * so for `gameMode === 'classic'` (or absent) we leave them undefined — the
 * engine's tick steps no-op on missing fields. For non-classic modes we fill
 * in the slim runtime state (cumulative stats, action log, unlockedVictories).
 *
 * We never invent bloc memberships or per-country nuclear arsenals: those
 * stay derived from scenario data via `createGame` for fresh saves and remain
 * absent on saves that didn't have them.
 */
function upgradeV2toV3(save: GameState): GameState {
  // `gameMode` absent or 'classic' → slim state.
  const gameMode = save.gameMode ?? 'classic';
  const wantsCumulative = gameMode !== 'classic';

  let next: GameState = save;

  // Reputation: only stamp when blocs exist on this save. Default is neutral 0
  // per known active bloc. Phase 1/2 saves never had blocs, so this stays
  // undefined unless the v3 payload already declared them.
  if (!next.reputation && next.blocs) {
    const rep = {} as ReputationByBloc;
    for (const blocId of Object.keys(next.blocs) as ActiveBlocId[]) {
      rep[blocId] = 0;
    }
    next = { ...next, reputation: rep };
  }

  // Pending deltas: pair with reputation; if reputation exists, ensure queue.
  if (next.reputation && !next.pendingReputationDeltas) {
    next = { ...next, pendingReputationDeltas: [] };
  }

  // Cumulative stats / unlocked victories / action log: required by Eternal
  // and Dethrone modes. For 'classic' we keep them absent so saves stay slim.
  if (wantsCumulative) {
    if (!next.cumulativeStats) {
      next = { ...next, cumulativeStats: defaultCumulativeStats() };
    }
    if (!next.unlockedVictories) {
      next = { ...next, unlockedVictories: [] };
    }
    if (!next.actionLog) {
      next = { ...next, actionLog: [] };
    }
  }

  return next;
}

/**
 * Migrate any persisted save payload to the current `GameState` shape. Pure
 * transform; throws `SaveMigrationError` on unknown / unsupported versions or
 * malformed shapes. If the payload is already at `SAVE_VERSION` and the core
 * shape checks pass, returns a shallow copy without further mutation.
 *
 * The migration is intentionally conservative: it only fills fields the
 * engine guarantees, never invents domain data (no scenario lookups). Callers
 * that need a fully-typed Phase 3 state with blocs derived from a scenario
 * should still use `createGame`.
 */
export function migrate(save: unknown): GameState {
  if (save === null || typeof save !== 'object') {
    throw new SaveMigrationError(
      'invalidShape',
      `migrate: expected an object, got ${save === null ? 'null' : typeof save}`,
    );
  }
  const payload = save as VersionedSave;
  const fromVersion = detectVersion(payload);
  assertCoreShape(payload);

  // From here we trust the top-level shape enough to cast — the engine
  // doesn't deep-validate per-country / per-relation fields anywhere else
  // and we don't want this shim to start doing that either.
  let state = payload as unknown as GameState;

  if (fromVersion <= 1) {
    state = upgradeV1toV2(state);
  }
  if (fromVersion <= 2) {
    state = upgradeV2toV3(state);
  }

  // Shallow copy so callers never receive the exact reference they passed in.
  // Also strips any `version` field that lived on the payload (engine state
  // doesn't carry a version stamp; persistence layers add it back on write).
  const { ...rest } = state as GameState & { version?: number };
  delete (rest as { version?: number }).version;
  return { ...rest };
}

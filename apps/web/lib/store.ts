// Zustand store wrapping the engine. The store is the single source of truth
// for everything the UI cares about: current GameState, speed, the active
// scenario, and the id of the persisted save (if any).
//
// The engine itself is invoked via `lib/engine-bridge.ts`, which gracefully
// tolerates the engine implementer agent landing modules progressively.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AchievementId,
  Action,
  CountryId,
  Country,
  EventDefinition,
  EventEffect,
  GameEvent,
  GameMode,
  GameState,
  SaveId,
  Scenario,
  VictoryConditionId,
} from '@aurion/engine';
import {
  BUILTIN_ACHIEVEMENTS,
  evaluateAchievements,
} from '@aurion/engine';

import {
  applyAction as engineApplyAction,
  checkWinLoss as engineCheckWinLoss,
  createGame as engineCreateGame,
  tick as engineTick,
} from './engine-bridge';
import {
  AUTOSAVE_ID,
  autosave as persistenceAutosave,
  generateSaveId,
  getUnlockedAchievements,
  loadSave,
  SaveLockedError,
  saveGame as persistenceSaveGame,
  unlockAchievement,
} from './persistence';
import { loadScenario, type ScenarioId } from './scenarios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Speed = 0 | 1 | 2 | 4;

/**
 * The 7 game-system panels the player can switch between in the left rail.
 * Phase 3 adds the `'un'` panel (United Nations resolutions). When a scenario
 * does not declare `unCouncilMembers`, the panel is still reachable but
 * surfaces an "ONU not available" message instead of the propose form.
 */
export type PanelId =
  | 'economy'
  | 'research'
  | 'military'
  | 'spies'
  | 'diplomacy'
  | 'politics'
  | 'un';

export const PANEL_IDS: readonly PanelId[] = [
  'economy',
  'research',
  'military',
  'spies',
  'diplomacy',
  'politics',
  'un',
] as const;

/**
 * Reasons a player can lose. Mirrors the streak counters in `_loseStreaks`,
 * extended in Phase 3 with the two Dethrone-loss triggers tracked in
 * `state._dethroneStreaks`:
 *   - `dethroned` — out of GDP top-3 for ≥ 5 in-game years.
 *   - `isolated` — reputation < -50 in every active bloc for ≥ 5 in-game
 *     years (only applicable when the scenario opts in via
 *     `dethroneIsolationOnByDefault`).
 */
export type LossReason =
  | 'popularity'
  | 'bankruptcy'
  | 'occupation'
  | 'factionRevolt'
  | 'dethroned'
  | 'isolated';

/**
 * A pending confirmation prompt. The UI renders a generic confirm modal when
 * this is set; calling the resolver clears it.
 */
export type ConfirmRequest = {
  /** i18n key for the modal title (e.g. "modals.confirm.title"). */
  titleKey: string;
  /** i18n key for the body description. */
  descriptionKey: string;
  /** i18n key for the confirm button label. Defaults to "common.confirm". */
  confirmKey?: string;
  /** i18n key for the cancel button label. Defaults to "common.cancel". */
  cancelKey?: string;
  /** Called when the player presses the confirm button. */
  onConfirm: () => void | Promise<void>;
  /** Visual style hint for the confirm button. */
  tone?: 'primary' | 'danger';
};

export type StartNewGameParams = {
  scenarioId: ScenarioId;
  playerCountryId: CountryId;
  victory: VictoryConditionId;
  /** Difficulty preset id (`easy`, `normal`, `hard`, `ironMan`). Required —
   * the wizard always commits to a choice before calling `startNewGame`. */
  difficultyId: string;
  /**
   * Game mode chosen at setup. Required — the Phase 3 wizard always commits
   * to a choice before calling `startNewGame`. Phase 1/2 saves loaded later
   * default to `'classic'` via persistence migration.
   */
  gameMode: GameMode;
  /** Optional fixed seed for deterministic playthroughs / tests. */
  seed?: string;
  /** Optional human-friendly save name. Defaults to the scenario name + date. */
  name?: string;
};

export type GameStoreState = {
  // ---- Persisted game data ------------------------------------------------
  state: GameState | null;
  scenario: Scenario | null;
  saveId: SaveId | null;
  saveName: string | null;

  // ---- Runtime (UI) state -------------------------------------------------
  speed: Speed;
  /** Counts how many ticks have been processed in this session — useful for the placeholder HUD. */
  ticksThisSession: number;
  /** Last error surfaced by the engine, in i18n-key form. */
  lastErrors: string[];
  /** Toggled by `loadGame` / `startNewGame` while async work is in flight. */
  isLoading: boolean;
  /** Currently focused country on the map / panels. Null when nothing selected. */
  selectedCountryId: CountryId | null;
  /** A pending confirm-modal request. Null when no confirm is open. */
  pendingConfirm: ConfirmRequest | null;
  /** Which of the 6 game-system panels is currently active in the left rail. */
  selectedPanel: PanelId;
  /**
   * Most recent achievement that has been unlocked but not yet acknowledged
   * by the UI. The toast component reads this and clears it via
   * `dismissAchievementToast`. Null when no toast is queued.
   */
  pendingAchievementToast: AchievementId | null;
  /**
   * In-memory mirror of every achievement id we already know to be unlocked.
   * Hydrated from IndexedDB on first load (lazy) and kept in sync with the
   * `achievements` table so we never re-fire a toast for something the
   * player has already seen.
   */
  unlockedAchievementIds: ReadonlySet<AchievementId>;
  /**
   * Eternal-mode milestone toast queue: id of the most recently unlocked
   * victory that has not yet been shown. The toast component reads this and
   * clears it via `dismissVictoryToast`. Null when no toast is queued.
   *
   * Subsequent victories that fire while a toast is still on screen are
   * dropped on the floor — only one milestone is surfaced at a time and the
   * full list is always reachable from `state.unlockedVictories`.
   */
  pendingVictoryToast: VictoryConditionId | null;
  /**
   * Tracks whether the celebratory "first eternal victory" modal has already
   * been shown for the current run. The modal fires once when the FIRST
   * milestone is unlocked; every subsequent milestone surfaces as a toast.
   *
   * Reset by `reset()` / `setState()` / `startNewGame()` so a fresh run can
   * trigger the modal again. Saves loaded mid-run remember the most recent
   * `unlockedVictories.length` so we don't replay the modal on re-open of an
   * already-celebrated game.
   */
  eternalFirstVictoryShown: boolean;

  // ---- Actions ------------------------------------------------------------
  loadGame: (saveId: SaveId) => Promise<void>;
  startNewGame: (params: StartNewGameParams) => Promise<SaveId>;
  setSpeed: (speed: Speed) => void;
  applyAction: (action: Action) => Promise<string[]>;
  advanceTick: () => Promise<void>;
  saveGame: (name?: string) => Promise<SaveId>;
  /** Replace the in-memory state from outside (e.g. after import). */
  setState: (state: GameState, saveId: SaveId, scenario: Scenario, name: string) => void;
  /** Clear everything (used after returning to the home screen). */
  reset: () => void;
  /** Select a country on the map. Pass null to clear. */
  selectCountry: (id: CountryId | null) => void;
  /** Open a generic confirmation modal. */
  confirm: (request: ConfirmRequest) => void;
  /** Clear any pending confirmation request without invoking its callback. */
  cancelConfirm: () => void;
  /** Switch the active panel in the left rail. */
  setSelectedPanel: (panel: PanelId) => void;
  /**
   * Resolve the most recent open narrative event by selecting a choice index.
   * Marks the event resolved and applies the choice's effects in a best-effort
   * manner so the loop can resume.
   */
  resolveCurrentEvent: (choiceIndex: number) => void;
  /**
   * Dismiss the current event by picking choice index 0 (the conventional
   * "default" / safe fallback). Useful for ESC handlers if we ever allow it.
   */
  dismissCurrentEvent: () => void;
  /** Clear the currently displayed achievement toast. */
  dismissAchievementToast: () => void;
  /** Clear the currently displayed Eternal-mode victory milestone toast. */
  dismissVictoryToast: () => void;
  /**
   * Mark the celebratory first-eternal-victory modal as already shown for this
   * run. Called by the modal after the player presses "Continua".
   */
  acknowledgeEternalFirstVictory: () => void;
};

// ---------------------------------------------------------------------------
// Speed preference (only) is persisted to localStorage. The full GameState
// lives in IndexedDB via lib/persistence.ts.
// ---------------------------------------------------------------------------

type SpeedPrefSlice = { preferredSpeed: Speed };

const usePreferredSpeed = create<SpeedPrefSlice & { setPreferredSpeed: (s: Speed) => void }>()(
  persist(
    (set) => ({
      preferredSpeed: 1,
      setPreferredSpeed: (preferredSpeed) => set({ preferredSpeed }),
    }),
    {
      name: 'aurion:speed-pref',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** Read the user's last-used speed (1x by default). Safe to call on the server. */
function getInitialSpeed(): Speed {
  try {
    return usePreferredSpeed.getState().preferredSpeed;
  } catch {
    return 1;
  }
}

// ---------------------------------------------------------------------------
// Selected-panel preference (also persisted to localStorage so the player's
// last open panel is restored across sessions).
// ---------------------------------------------------------------------------

type PanelPrefSlice = { preferredPanel: PanelId };

const usePreferredPanel = create<
  PanelPrefSlice & { setPreferredPanel: (p: PanelId) => void }
>()(
  persist(
    (set) => ({
      preferredPanel: 'economy',
      setPreferredPanel: (preferredPanel) => set({ preferredPanel }),
    }),
    {
      name: 'aurion:panel-pref',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

function getInitialPanel(): PanelId {
  try {
    return usePreferredPanel.getState().preferredPanel;
  } catch {
    return 'economy';
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGameStore = create<GameStoreState>((set, get) => ({
  state: null,
  scenario: null,
  saveId: null,
  saveName: null,
  speed: getInitialSpeed(),
  ticksThisSession: 0,
  lastErrors: [],
  isLoading: false,
  selectedCountryId: null,
  pendingConfirm: null,
  selectedPanel: getInitialPanel(),
  pendingAchievementToast: null,
  unlockedAchievementIds: new Set<AchievementId>(),
  pendingVictoryToast: null,
  eternalFirstVictoryShown: false,

  reset: () => {
    set({
      state: null,
      scenario: null,
      saveId: null,
      saveName: null,
      ticksThisSession: 0,
      lastErrors: [],
      speed: 0,
      selectedCountryId: null,
      pendingConfirm: null,
      pendingVictoryToast: null,
      eternalFirstVictoryShown: false,
    });
  },

  setState: (state, saveId, scenario, name) => {
    set({
      state,
      saveId,
      scenario,
      saveName: name,
      ticksThisSession: 0,
      lastErrors: [],
      selectedCountryId: null,
      pendingConfirm: null,
      pendingVictoryToast: null,
      // Re-loaded saves that already have ≥1 unlocked victory should NOT
      // re-trigger the celebratory modal — we treat those as "already
      // celebrated". Fresh games start at 0 and the next victory opens it.
      eternalFirstVictoryShown:
        (state.unlockedVictories?.length ?? 0) > 0,
    });
  },

  selectCountry: (id) => {
    set({ selectedCountryId: id });
  },

  setSpeed: (speed) => {
    set({ speed });
    if (speed > 0) {
      // Remember the last *active* speed so we can restore after auto-pause.
      try {
        usePreferredSpeed.getState().setPreferredSpeed(speed);
      } catch {
        // localStorage may be unavailable (SSR) — non-fatal.
      }
    }
  },

  loadGame: async (saveId) => {
    set({ isLoading: true, lastErrors: [] });
    try {
      const entry = await loadSave(saveId);
      if (!entry) {
        set({ isLoading: false, lastErrors: ['errors.saveNotFound'] });
        return;
      }
      const scenario = await loadScenario(entry.scenarioId as ScenarioId);
      set({
        state: entry.state,
        scenario,
        saveId: entry.id,
        saveName: entry.name,
        ticksThisSession: 0,
        speed: 0,
        isLoading: false,
        selectedCountryId: null,
        pendingConfirm: null,
        pendingVictoryToast: null,
        // A reloaded save that already has at least one unlocked victory has
        // (by definition) been celebrated already; suppress the modal.
        eternalFirstVictoryShown:
          (entry.state.unlockedVictories?.length ?? 0) > 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({
        isLoading: false,
        lastErrors: [`errors.loadFailed:${message}`],
      });
      throw err;
    }
  },

  startNewGame: async ({
    scenarioId,
    playerCountryId,
    victory,
    difficultyId,
    gameMode,
    seed,
    name,
  }) => {
    set({ isLoading: true, lastErrors: [] });
    try {
      const scenario = await loadScenario(scenarioId);
      const state = await engineCreateGame(scenario, {
        playerCountryId,
        victory,
        difficultyId,
        gameMode,
        ...(seed !== undefined ? { seed } : {}),
      });
      const saveId = generateSaveId();
      const saveName = name ?? `${scenarioId} — ${new Date().toLocaleString()}`;
      // Persist immediately so a refresh recovers a fresh game.
      await persistenceSaveGame({
        id: saveId,
        name: saveName,
        scenarioId,
        state,
      });
      set({
        state,
        scenario,
        saveId,
        saveName,
        ticksThisSession: 0,
        speed: 0,
        isLoading: false,
        selectedCountryId: null,
        pendingConfirm: null,
        // Fresh run — reset the eternal-mode UI gates so the very next
        // milestone fires the celebratory modal once.
        pendingVictoryToast: null,
        eternalFirstVictoryShown: false,
      });
      return saveId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({
        isLoading: false,
        lastErrors: [`errors.newGameFailed:${message}`],
      });
      throw err;
    }
  },

  applyAction: async (action) => {
    const { state, scenario } = get();
    if (!state) return ['errors.noActiveGame'];
    const result = engineApplyAction(
      state,
      action,
      state.playerCountryId,
      scenario?.techTree ?? [],
    );
    set({ state: result.state, lastErrors: result.errors });
    return result.errors;
  },

  advanceTick: async () => {
    const current = get();
    if (!current.state) return;
    const scenario = current.scenario;
    const victoryRule = scenario?.victoryConditions.find(
      (v) => v.id === current.state!.selectedVictoryCondition,
    )?.rule;
    const next = engineTick(current.state, {
      techCatalog: scenario?.techTree ?? [],
      eventPool: scenario?.eventPool ?? [],
      ...(victoryRule ? { victoryRule } : {}),
    });
    const reconciled = engineCheckWinLoss(next, victoryRule);

    // — Eternal-mode victory milestone detection —
    // The engine populates `state.unlockedVictories` and never sets
    // `winLoss = 'won'` for eternal runs. We compare lengths pre/post-tick;
    // every new entry fires a toast (we surface only the latest if multiple
    // were unlocked in the same tick). The first unlocked victory ALSO opens
    // the celebratory modal (gated by `eternalFirstVictoryShown`); the
    // EternalFirstVictoryModal acknowledges itself when dismissed.
    //
    // Defensive fallbacks: arrays may be undefined if the engine has not yet
    // shipped the tracking — treat as []. We never read `gameMode` directly
    // from `current.state` because `setState` does not always carry the mode
    // forward in test scenarios; reading from the reconciled tick is safer.
    const isEternal = (reconciled.gameMode ?? 'classic') === 'eternal';
    const prevUnlocked = current.state.unlockedVictories ?? [];
    const nextUnlocked = reconciled.unlockedVictories ?? [];
    let pendingVictoryToast = current.pendingVictoryToast;
    if (isEternal && nextUnlocked.length > prevUnlocked.length) {
      // Most recently unlocked id wins the toast slot.
      const latest = nextUnlocked[nextUnlocked.length - 1] ?? null;
      pendingVictoryToast = latest;
    }

    set({
      state: reconciled,
      ticksThisSession: current.ticksThisSession + 1,
      pendingVictoryToast,
    });

    // Achievements: ask the engine which definitions are now satisfied, then
    // diff against the in-memory unlocked set. Anything new is persisted (the
    // helper is idempotent at the DB layer too) and the most recent fresh
    // unlock surfaces a UI toast. Fire-and-forget: the gameplay loop must
    // never block on persistence.
    void maybeUnlockAchievements(reconciled, current.saveId, get, set);

    // Autosave every 30 ticks of game time. Fire-and-forget — failures here
    // should not interrupt gameplay; they'll surface via the next manual save.
    //
    // Iron Man explicitly forbids autosaves: the whole point of the mode is
    // that a single defeat ends the run permanently. We compute the flag from
    // the `next` reconciled state (post-tick) so a difficulty change between
    // ticks (which shouldn't happen, but is cheap to defend against) is
    // honoured at the very tick the change becomes visible.
    const ironManActive = isIronManActive(current.scenario, reconciled);
    if (current.scenario && !ironManActive && reconciled.tick % 30 === 0) {
      const scenarioId = reconciled.scenarioId;
      const name = current.saveName ?? `Autosave (${scenarioId})`;
      void persistenceAutosave({
        name,
        scenarioId,
        state: reconciled,
      }).catch((err) => {
        console.warn('[store] autosave failed', err);
      });
    }
  },

  saveGame: async (name) => {
    const { state, scenario, saveId, saveName } = get();
    if (!state || !scenario) {
      throw new Error('saveGame: no active game to save');
    }
    // Iron Man permadeath: the player may not commit a save while the run is
    // still in progress. We allow saves once `winLoss !== 'playing'` so the
    // final state can be preserved as a post-mortem (loaded for review only).
    if (isIronManActive(scenario, state) && state.winLoss === 'playing') {
      throw new SaveLockedError();
    }
    const id = saveId ?? generateSaveId();
    const finalName = name ?? saveName ?? `${state.scenarioId} — ${new Date().toLocaleString()}`;
    const entry = await persistenceSaveGame({
      id,
      name: finalName,
      scenarioId: state.scenarioId,
      state,
    });
    set({ saveId: entry.id, saveName: entry.name });
    return entry.id;
  },

  confirm: (request) => {
    set({ pendingConfirm: request });
  },

  cancelConfirm: () => {
    set({ pendingConfirm: null });
  },

  setSelectedPanel: (panel) => {
    set({ selectedPanel: panel });
    try {
      usePreferredPanel.getState().setPreferredPanel(panel);
    } catch {
      // localStorage may be unavailable (SSR) — non-fatal.
    }
  },

  resolveCurrentEvent: (choiceIndex) => {
    const { state, scenario } = get();
    if (!state || state.events.length === 0) return;
    const lastIdx = state.events.length - 1;
    const last = state.events[lastIdx];
    if (!last || last.resolvedChoiceIndex !== null) return;

    const definition = findEventDefinition(scenario, last.definitionId);
    const choices = definition?.choices ?? [];
    const safeIdx =
      choices.length > 0
        ? Math.max(0, Math.min(choiceIndex, choices.length - 1))
        : choiceIndex;
    const choice = choices[safeIdx];

    // Update events ring buffer immutably with the resolved choice index.
    const events = state.events.slice();
    events[lastIdx] = { ...last, resolvedChoiceIndex: safeIdx };

    // Apply the chosen effects best-effort. The engine remains the source of
    // truth — if/when it ships a dedicated `applyEventChoice` we should defer
    // to it. For now we handle the common `modifyStat` effect against the
    // player country so events have a visible impact in the UI.
    let countries = state.countries;
    if (choice) {
      countries = applyEventEffectsToCountries(
        countries,
        state.playerCountryId,
        choice.effects,
      );
    }

    set({
      state: {
        ...state,
        events,
        countries,
      },
    });
  },

  dismissCurrentEvent: () => {
    get().resolveCurrentEvent(0);
  },

  dismissAchievementToast: () => {
    set({ pendingAchievementToast: null });
  },

  dismissVictoryToast: () => {
    set({ pendingVictoryToast: null });
  },

  acknowledgeEternalFirstVictory: () => {
    set({ eternalFirstVictoryShown: true });
  },
}));

// ---------------------------------------------------------------------------
// Achievement plumbing
//
// Kept at module scope (not inside the store factory) so we can reuse the
// same helper from both `loadGame` and `advanceTick` without each call site
// having to inline the diff against persistence.
// ---------------------------------------------------------------------------

/** True once the in-memory `unlockedAchievementIds` cache has been hydrated. */
let _achievementsHydrated = false;

async function ensureAchievementsHydrated(
  set: (partial: Partial<GameStoreState>) => void,
): Promise<void> {
  if (_achievementsHydrated) return;
  _achievementsHydrated = true;
  try {
    const rows = await getUnlockedAchievements();
    if (rows.length === 0) return;
    const ids = new Set<AchievementId>(rows.map((r) => r.id));
    set({ unlockedAchievementIds: ids });
  } catch (err) {
    console.warn('[store] failed to hydrate achievements', err);
    // Reset the gate so a future tick can retry hydration.
    _achievementsHydrated = false;
  }
}

async function maybeUnlockAchievements(
  state: GameState,
  saveId: SaveId | null,
  get: () => GameStoreState,
  set: (partial: Partial<GameStoreState>) => void,
): Promise<void> {
  await ensureAchievementsHydrated(set);
  const known = get().unlockedAchievementIds;
  const matched = evaluateAchievements(state, BUILTIN_ACHIEVEMENTS);
  const fresh: AchievementId[] = [];
  for (const id of matched) {
    if (!known.has(id)) fresh.push(id);
  }
  if (fresh.length === 0) return;

  const nextSet = new Set(known);
  for (const id of fresh) nextSet.add(id);
  // The toast renders the most recently unlocked id (typically the only one
  // produced by a single tick). When two fire on the same tick we still only
  // surface one — the player will see the rest in the achievements list.
  const lastFresh = fresh[fresh.length - 1] ?? null;
  set({
    unlockedAchievementIds: nextSet,
    pendingAchievementToast: lastFresh,
  });

  // Persist each new unlock; the helper is idempotent so any race with the
  // hydrated set is harmless.
  if (saveId) {
    for (const id of fresh) {
      void unlockAchievement(id, state.scenarioId, saveId).catch((err) => {
        console.warn('[store] failed to persist achievement unlock', id, err);
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** True when an unresolved narrative event modal would be open. */
export function selectHasOpenEvent(s: GameStoreState): boolean {
  const events = s.state?.events;
  if (!events || events.length === 0) return false;
  const last = events[events.length - 1];
  return !!last && last.resolvedChoiceIndex === null;
}

/** Convenience: the player's country snapshot, or null. */
export function selectPlayerCountry(s: GameStoreState) {
  if (!s.state) return null;
  return s.state.countries[s.state.playerCountryId] ?? null;
}

/**
 * The id of the currently active difficulty preset. Returns `null` when no
 * game is loaded; otherwise reads it directly from the engine state (which
 * stamps it at `createGame` time).
 */
export function selectDifficultyId(s: GameStoreState): string | null {
  return s.state?.difficultyId ?? null;
}

/**
 * The DifficultyTuning entry for the active game, looked up by id against the
 * loaded scenario. Returns `null` if no game / scenario is loaded, or if the
 * scenario does not declare the active id (which would indicate a save vs
 * scenario mismatch).
 */
export function selectActiveDifficulty(s: GameStoreState) {
  const id = s.state?.difficultyId;
  if (!id || !s.scenario) return null;
  return s.scenario.difficulties.find((d) => d.id === id) ?? null;
}

/**
 * True when the active scenario's selected difficulty has `ironMan === true`.
 * Returns `false` when no game / scenario is loaded so callers can use it
 * directly as a UI gate without needing a null check. The selector reads
 * `state.difficultyId` (the engine stamps it at `createGame` time) and looks
 * up the matching entry in `scenario.difficulties[]`.
 *
 * Iron Man is a UI-only concern (the engine ignores the flag) — it gates
 * autosave, save / load / export / import in the HUD menu, and renders a
 * permanent "Iron Man" badge in the HUD bar.
 */
export function selectIronMan(s: GameStoreState): boolean {
  const tuning = selectActiveDifficulty(s);
  return tuning?.ironMan === true;
}

/**
 * The most recent unresolved narrative event, or null. Returned as-is so the
 * caller can render the event modal (and look up the matching definition in
 * the active scenario).
 */
export function selectOpenEvent(s: GameStoreState): GameEvent | null {
  const events = s.state?.events;
  if (!events || events.length === 0) return null;
  const last = events[events.length - 1];
  if (!last || last.resolvedChoiceIndex !== null) return null;
  return last;
}

/**
 * Threshold (in ticks / weeks) at which a Dethrone streak counter trips the
 * loss condition. 5 in-game years × 52 weeks. Mirrors the engine constant.
 */
const DETHRONE_THRESHOLD_WEEKS = 260;

/**
 * Derive the loss reason from the engine's `_loseStreaks` counters. Returns
 * null when the player isn't in a `lost` state. Mirrors the thresholds in
 * `packages/engine/src/checkWinLoss.ts`.
 *
 * In Dethrone-loss mode, also considers the `_dethroneStreaks` counters and
 * surfaces `dethroned` / `isolated` when they trip — these win out over the
 * classic streak reasons because the engine can only set `winLoss = 'lost'`
 * once one trigger fires, and the dethrone-mode triggers are the dominant
 * cause of death in that mode.
 */
export function selectLossReason(s: GameStoreState): LossReason | null {
  const state = s.state;
  if (!state || state.winLoss !== 'lost') return null;

  // Dethrone-mode triggers take precedence — they're the whole point of the
  // mode and we want the post-mortem screen to surface them clearly.
  if (selectIsDethrone(s)) {
    const dStreaks = state._dethroneStreaks;
    if (dStreaks) {
      if (dStreaks.outOfTop3Weeks >= DETHRONE_THRESHOLD_WEEKS) {
        return 'dethroned';
      }
      if (dStreaks.isolationWeeks >= DETHRONE_THRESHOLD_WEEKS) {
        return 'isolated';
      }
    }
  }

  const streaks = state._loseStreaks;
  if (!streaks) {
    // Engine reported `lost` without any classic streak — fall back to the
    // highest dethrone counter if present, else null.
    const dStreaks = state._dethroneStreaks;
    if (dStreaks) {
      if (dStreaks.outOfTop3Weeks >= dStreaks.isolationWeeks) {
        return dStreaks.outOfTop3Weeks > 0 ? 'dethroned' : null;
      }
      return dStreaks.isolationWeeks > 0 ? 'isolated' : null;
    }
    return null;
  }
  if (streaks.capitalOccupiedWeeks >= 4) return 'occupation';
  if (streaks.allFactionsAngryWeeks >= 6) return 'factionRevolt';
  if (streaks.lowPopularityWeeks >= 12) return 'popularity';
  if (streaks.negativeTreasuryWeeks >= 26) return 'bankruptcy';
  // Fallback: pick whichever streak is highest (the engine may have tipped the
  // game into a loss via a future code path before any single counter hit).
  const entries: Array<[LossReason, number]> = [
    ['occupation', streaks.capitalOccupiedWeeks],
    ['factionRevolt', streaks.allFactionsAngryWeeks],
    ['popularity', streaks.lowPopularityWeeks],
    ['bankruptcy', streaks.negativeTreasuryWeeks],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  return top && top[1] > 0 ? top[0] : null;
}

/**
 * Phase 3 Eternal-mode helper: returns how many of the scenario's victory
 * conditions the player has met so far, alongside the total. Reads
 * `state.unlockedVictories` (treats undefined as `[]` for backwards
 * compatibility with Phase 1/2 saves) and `scenario.victoryConditions`.
 *
 * Used by the HUD's `<VictoryCounter />` chip to render "N/M vittorie".
 * Returning a small derived object (rather than two separate selectors) lets
 * callers grab both numbers in a single store subscription.
 */
export function selectVictoryProgress(
  s: GameStoreState,
): { unlocked: VictoryConditionId[]; total: number } {
  const unlocked = s.state?.unlockedVictories ?? [];
  const total = s.scenario?.victoryConditions.length ?? 0;
  return { unlocked: [...unlocked], total };
}

/**
 * True when the active game is in Eternal mode. Saves loaded without a
 * `gameMode` field default to `'classic'`, so this is `false` for legacy
 * Phase 1/2 saves — never undefined, callers can use it as a UI gate
 * without nil checks.
 */
export function selectIsEternal(s: GameStoreState): boolean {
  return (s.state?.gameMode ?? 'classic') === 'eternal';
}

/**
 * True when the active game is in Dethrone-loss mode. Same backwards-compat
 * semantics as `selectIsEternal`: legacy saves are never reported as dethrone.
 */
export function selectIsDethrone(s: GameStoreState): boolean {
  return (s.state?.gameMode ?? 'classic') === 'dethrone';
}

/**
 * True when the celebratory "first eternal victory" modal should be visible.
 * Fires when:
 *   - the game is in eternal mode AND
 *   - exactly one victory has been unlocked AND
 *   - the player has not yet acknowledged the modal for this run.
 *
 * Subsequent unlocked victories surface as toasts via `pendingVictoryToast`.
 */
export function selectShouldShowEternalFirstVictory(
  s: GameStoreState,
): boolean {
  if (!selectIsEternal(s)) return false;
  const unlocked = s.state?.unlockedVictories ?? [];
  if (unlocked.length === 0) return false;
  return s.eternalFirstVictoryShown === false;
}

/** Re-export the autosave id so callers don't have to import persistence directly. */
export { AUTOSAVE_ID };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function findEventDefinition(
  scenario: Scenario | null,
  id: string,
): EventDefinition | null {
  if (!scenario) return null;
  return scenario.eventPool.find((e) => e.id === id) ?? null;
}

/**
 * Internal: same logic as `selectIronMan`, but takes raw `(scenario, state)`
 * arguments so the store actions (`advanceTick`, `saveGame`) can call it
 * without going through the selector indirection. Falsy unless the scenario
 * declares the currently-active difficulty AND that entry has `ironMan: true`.
 */
function isIronManActive(
  scenario: Scenario | null,
  state: GameState | null,
): boolean {
  if (!scenario || !state) return false;
  const tuning = scenario.difficulties.find((d) => d.id === state.difficultyId);
  return tuning?.ironMan === true;
}

/**
 * Best-effort applier for an event choice's effects against the country map.
 * Currently handles `modifyStat` for a small allowlist of common stats; other
 * effect kinds are left for the engine to interpret on its next tick. Always
 * returns a new countries record (never mutates input).
 */
function applyEventEffectsToCountries(
  countries: Record<CountryId, Country>,
  playerCountryId: CountryId,
  effects: readonly EventEffect[],
): Record<CountryId, Country> {
  let next = countries;
  for (const effect of effects) {
    if (effect.type !== 'modifyStat') continue;
    const targetId = effect.target === 'player' ? playerCountryId : effect.target;
    const country = next[targetId];
    if (!country) continue;
    const updated = applyModifyStat(country, effect.stat, effect.delta);
    if (updated === country) continue;
    next = { ...next, [targetId]: updated };
  }
  return next;
}

function applyModifyStat(country: Country, stat: string, delta: number): Country {
  switch (stat) {
    case 'treasury':
      return {
        ...country,
        economy: { ...country.economy, treasury: country.economy.treasury + delta },
      };
    case 'popularity':
      return {
        ...country,
        politics: {
          ...country.politics,
          popularity: clamp(country.politics.popularity + delta, 0, 100),
        },
      };
    case 'taxRate':
      return {
        ...country,
        economy: {
          ...country.economy,
          taxRate: clamp(country.economy.taxRate + delta, 0, 100),
        },
      };
    case 'armySize':
      return {
        ...country,
        military: {
          ...country.military,
          armySize: Math.max(0, country.military.armySize + delta),
        },
      };
    case 'spyCount':
      return {
        ...country,
        intelligence: {
          ...country.intelligence,
          spyCount: Math.max(0, country.intelligence.spyCount + delta),
        },
      };
    default:
      return country;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

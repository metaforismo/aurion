// Zustand store wrapping the engine. The store is the single source of truth
// for everything the UI cares about: current GameState, speed, the active
// scenario, and the id of the persisted save (if any).
//
// The engine itself is invoked via `lib/engine-bridge.ts`, which gracefully
// tolerates the engine implementer agent landing modules progressively.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Action,
  CountryId,
  GameState,
  SaveId,
  Scenario,
  VictoryConditionId,
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
  loadSave,
  saveGame as persistenceSaveGame,
} from './persistence';
import { loadScenario, type ScenarioId } from './scenarios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Speed = 0 | 1 | 2 | 4;

export type StartNewGameParams = {
  scenarioId: ScenarioId;
  playerCountryId: CountryId;
  victory: VictoryConditionId;
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

  reset: () => {
    set({
      state: null,
      scenario: null,
      saveId: null,
      saveName: null,
      ticksThisSession: 0,
      lastErrors: [],
      speed: 0,
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
    });
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

  startNewGame: async ({ scenarioId, playerCountryId, victory, seed, name }) => {
    set({ isLoading: true, lastErrors: [] });
    try {
      const scenario = await loadScenario(scenarioId);
      const state = await engineCreateGame(scenario, {
        playerCountryId,
        victory,
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
    const { state } = get();
    if (!state) return ['errors.noActiveGame'];
    const result = await engineApplyAction(state, action);
    set({ state: result.state, lastErrors: result.errors });
    return result.errors;
  },

  advanceTick: async () => {
    const current = get();
    if (!current.state) return;
    const next = await engineTick(current.state);
    const winLoss = await engineCheckWinLoss(next);
    const reconciled: GameState =
      winLoss === next.winLoss ? next : { ...next, winLoss };

    set({
      state: reconciled,
      ticksThisSession: current.ticksThisSession + 1,
    });

    // Autosave every 30 ticks of game time. Fire-and-forget — failures here
    // should not interrupt gameplay; they'll surface via the next manual save.
    if (current.scenario && reconciled.tick % 30 === 0) {
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
}));

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

/** Re-export the autosave id so callers don't have to import persistence directly. */
export { AUTOSAVE_ID };

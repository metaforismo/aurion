// Thin abstraction over @aurion/engine that gracefully tolerates the engine
// implementer agent being mid-flight: the package only exports types so far,
// and the runtime implementations (createGame, tick, applyAction, checkWinLoss)
// will land progressively.
//
// We dynamically import the implementation. If symbols are missing we surface
// a clear runtime error (and the UI can show it via the error boundary)
// instead of crashing at module load.

import type {
  Action,
  ApplyActionResult,
  CreateGameOptions,
  GameState,
  Scenario,
  WinLossState,
} from '@aurion/engine';

type EngineModule = {
  createGame?: (scenario: Scenario, options: CreateGameOptions) => GameState;
  tick?: (state: GameState) => GameState;
  applyAction?: (state: GameState, action: Action) => ApplyActionResult;
  checkWinLoss?: (state: GameState) => WinLossState;
};

let cached: EngineModule | null = null;

async function loadEngine(): Promise<EngineModule> {
  if (cached) return cached;
  const acc: EngineModule = {};
  try {
    const mod = (await import('@aurion/engine')) as unknown as EngineModule;
    if (typeof mod.createGame === 'function') acc.createGame = mod.createGame;
    if (typeof mod.tick === 'function') acc.tick = mod.tick;
    if (typeof mod.applyAction === 'function') acc.applyAction = mod.applyAction;
    if (typeof mod.checkWinLoss === 'function') acc.checkWinLoss = mod.checkWinLoss;
  } catch {
    // Best-effort — when even the package import fails, all entry points below
    // will throw `EngineNotAvailableError` with a clear message.
  }
  cached = acc;
  return acc;
}

class EngineNotAvailableError extends Error {
  constructor(symbol: string) {
    super(
      `engine: "${symbol}" is not yet exported from @aurion/engine. ` +
        `The engine implementer agent has not finished landing this symbol.`,
    );
    this.name = 'EngineNotAvailableError';
  }
}

export async function createGame(
  scenario: Scenario,
  options: CreateGameOptions,
): Promise<GameState> {
  const eng = await loadEngine();
  if (!eng.createGame) throw new EngineNotAvailableError('createGame');
  return eng.createGame(scenario, options);
}

export async function tick(state: GameState): Promise<GameState> {
  const eng = await loadEngine();
  if (!eng.tick) {
    // Soft fallback so the UI ticker can keep advancing the visible counter
    // while the real tick is being implemented in parallel. This is *not* a
    // gameplay tick — just a tick-counter bump.
    return { ...state, tick: state.tick + 1 };
  }
  return eng.tick(state);
}

export async function applyAction(
  state: GameState,
  action: Action,
): Promise<ApplyActionResult> {
  const eng = await loadEngine();
  if (!eng.applyAction) {
    return {
      state,
      errors: ['errors.engineNotReady'],
    };
  }
  return eng.applyAction(state, action);
}

export async function checkWinLoss(state: GameState): Promise<WinLossState> {
  const eng = await loadEngine();
  if (!eng.checkWinLoss) {
    // Until the engine ships its win/loss eval, fall back to whatever is on
    // the state. This keeps the rest of the UI honest.
    return state.winLoss;
  }
  return eng.checkWinLoss(state);
}

// Suppress "unused" lint on the lazily-handled error class.
export { EngineNotAvailableError };

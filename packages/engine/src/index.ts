// Public API of the @aurion/engine package.
// All implementation is pure TypeScript — no React, no DOM, no browser APIs.

export * from './types.js';

export { createGame } from './createGame.js';
export { tick } from './tick.js';
export type { TickContext } from './tick.js';
export { applyAction, getAvailableActions } from './actions/index.js';
export { checkWinLoss } from './checkWinLoss.js';
export { createRng } from './rng.js';
export type { Rng } from './rng.js';
export { decideAiAction } from './ai/index.js';

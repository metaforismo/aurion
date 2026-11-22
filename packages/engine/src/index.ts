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
export {
  evaluateAchievements,
  evaluateCondition as evaluateAchievementCondition,
  BUILTIN_ACHIEVEMENTS,
} from './achievements/index.js';
export {
  initSpaceMilestones,
  recordTechCompletion,
  tickSpace,
  isMilestone,
  REASON_KEY_FIRST as SPACE_MILESTONE_REASON_FIRST,
  REASON_KEY_FOLLOW as SPACE_MILESTONE_REASON_FOLLOW,
} from './space/index.js';
export { migrate, SAVE_VERSION, SaveMigrationError } from './migrate.js';
// Re-export achievement types directly (not just via `export *`) so consumers
// can grab them from the package root with a single import line.
export type {
  AchievementId,
  AchievementDef,
  AchievementCondition,
} from './types.js';
export {
  COSMOS_PROJECTS,
  KARDASHEV_START,
  CANCEL_REFUND_SHARE,
  COSMOS_REASON_FIRST,
  getCosmosProject,
  initCosmos,
  tickCosmos,
  getProjectStatus,
  cosmosSlots,
  cosmosColonists,
  projectCost,
  settledBodies,
  spaceTechShare,
  highestStage,
  kardashevToWatts,
  kardashevType,
} from './cosmos/index.js';
export type { CosmosProjectStatus } from './cosmos/index.js';

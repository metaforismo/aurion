// Public API of the @aurion/engine package.
// All implementation is pure TypeScript — no React, no DOM, no browser APIs.

export * from './types.js';

export { createGame } from './createGame.js';
export { tick, computeWeeklyIncome, MIN_EVENT_GAP_TICKS } from './tick.js';
export type { TickContext } from './tick.js';
export { applyAction, getAvailableActions } from './actions/index.js';
export {
  checkWinLoss,
  DETHRONE_CLIMB_WEEKS,
  DETHRONE_HOLD_TO_WIN_WEEKS,
  DETHRONE_OUT_OF_TOP3_WEEKS,
} from './checkWinLoss.js';
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
  effectiveProjectCost,
  projectCostBreakdown,
  ALLY_PROJECT_DISCOUNT,
  ALLY_PROJECT_DISCOUNT_CAP,
  settledBodies,
  spaceTechShare,
  highestStage,
  kardashevToWatts,
  kardashevType,
  SPACE_RACE_GOAL,
  SPACE_RACE_PATH,
  spaceRaceProgress,
  spaceRaceLeader,
  spaceRaceOutcome,
} from './cosmos/index.js';
export type { CosmosProjectStatus, ProjectCostBreakdown } from './cosmos/index.js';
export {
  POLICIES,
  POLICY_SLOTS,
  POLICY_COOLDOWN_TICKS,
  POLICY_ENACT_POPULARITY_COST,
  getPolicy,
  getPolicyStatus,
  initPolicies,
  policyModifiers,
  policySlots,
  tickPolicies,
} from './policies/index.js';
export type { PolicyStatus, PolicyModifiers } from './policies/index.js';
export { applyEventEffects, describeEventEffect, resolveEventChoice } from './events/index.js';
export type { EventEffectSummary } from './events/index.js';
export { PLACATE_COST } from './actions/placateFaction.js';
export { isSpyTypeUnlocked, computeSpyProbabilities } from './actions/deploySpy.js';
export { evaluateCondition as evaluateEventCondition } from './events/conditions.js';
export { supportMultiplier } from './tick.js';
export { COSMOS_EVENTS } from './cosmos/events.js';
export { tickHistory, sampleOf as historySampleOf, HISTORY_INTERVAL_TICKS, HISTORY_LIMIT } from './history.js';

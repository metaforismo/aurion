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
export {
  isSpyTypeUnlocked,
  computeSpyProbabilities,
  sabotageGdpLoss,
  assassinationRole,
  ASSASSINATION_ROLES,
  SPY_DETECTED_ATTITUDE_PENALTY,
} from './actions/deploySpy.js';
export type { AssassinationRole } from './actions/deploySpy.js';
export { evaluateCondition as evaluateEventCondition } from './events/conditions.js';
export { supportMultiplier } from './tick.js';
export { COSMOS_EVENTS } from './cosmos/events.js';
export { tickHistory, sampleOf as historySampleOf, HISTORY_INTERVAL_TICKS, HISTORY_LIMIT } from './history.js';

export {
  WAR_CAPITULATION_GDP_SHARE,
  WAR_CAPITULATION_SCORE,
  WAR_REPARATIONS_SCORE,
  WAR_REPARATION_WEEKS,
  WAR_TRUCE_TICKS,
  peaceTerms,
  warBetween,
  warKey,
  warScoreFor,
} from './war/index.js';
export type { PeaceTerms } from './war/index.js';

export {
  FACTION_HOSTILE_AT,
  FACTION_LEVERAGE,
  FACTION_LOYAL_AT,
  factionEffect,
  factionModifiers,
  factionStance,
} from './politics/factions.js';
export type { FactionLever, FactionModifiers, FactionStance } from './politics/factions.js';

export {
  COLONY_BODIES,
  COLONY_FOCUSES,
  COLONY_FOCUS_COOLDOWN_TICKS,
  colonyCapacity,
  colonyModifiers,
  colonyOutput,
  colonySize,
  getColonyStatus,
} from './cosmos/colonies.js';
export type { ColonyOutput, ColonyStatus } from './cosmos/colonies.js';

export {
  INVEST_GDP_PER_EURO,
  INVEST_HEAT_HALVING,
  investEfficiency,
  investOutcome,
} from './actions/invest.js';
export type { InvestOutcome } from './actions/invest.js';

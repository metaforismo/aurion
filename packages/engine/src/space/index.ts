// Space prestige milestone system. Phase 3 — Wave 10.
//
// Certain space-related techs are flagged as "milestones" via the optional
// `prestigeFirst` (and `prestigeFollow`) field on `TechDefinition`. The first
// country to complete such a tech earns a HUGE reputation boost across every
// active bloc (`prestigeFirst`); subsequent achievers get a smaller boost
// (`prestigeFollow`). This makes the space race a meaningful side game.
//
// Engine integration:
//   1. `initSpaceMilestones(scenario)` — called by `createGame` to populate
//      `state.spaceMilestones` from techs that declare prestigeFirst.
//   2. `recordTechCompletion(state, countryId, techId, scenario)` — called by
//      `tick.stepResearch` whenever a country completes a tech. It marks the
//      first/follower achiever and queues reputation deltas across blocs via
//      the existing `queueReputationDelta` API.
//   3. `tickSpace(state, scenario)` — top-level tick step. Currently a no-op
//      (all real work happens at completion time); kept as an extension hook
//      so future "buzz" / decay effects don't need a wider API surface.
//
// Pure functions only. All inputs are read-only; all outputs are new objects.

import { queueReputationDelta } from '../reputation/index.js';
import type {
  ActiveBlocId,
  CountryId,
  GameState,
  Scenario,
  SpaceMilestoneEntry,
  SpaceMilestoneState,
  TechDefinition,
  TechId,
} from '../types.js';

/** i18n key for the reputation delta when a country becomes the first achiever. */
export const REASON_KEY_FIRST = 'rep.reason.spaceMilestoneFirst';
/** i18n key for the reputation delta when a country becomes a follow achiever. */
export const REASON_KEY_FOLLOW = 'rep.reason.spaceMilestoneFollow';

/**
 * Quick predicate: is this tech a space prestige milestone? A tech is a
 * milestone iff it declares a numeric `prestigeFirst` (the engine ignores
 * `prestigeFollow` alone — it makes no sense without a "first" boost).
 *
 * Exported so AI scoring and UI can reuse the same logic.
 */
export function isMilestone(tech: TechDefinition | undefined): boolean {
  if (!tech) return false;
  return typeof tech.prestigeFirst === 'number';
}

/**
 * Build the initial `SpaceMilestoneState` map from the scenario's tech tree.
 * Returns `undefined` when the scenario declares no milestone techs at all
 * — keeps the GameState slim for scenarios that opt out of the system.
 *
 * Each entry starts with `firstAchieverCountryId: null`, an empty
 * `achievers: []` array, and a null `firstAchievedAtTick`.
 */
export function initSpaceMilestones(scenario: Scenario): SpaceMilestoneState | undefined {
  const techs = scenario.techTree.filter((t) => isMilestone(t));
  if (techs.length === 0) return undefined;
  const out: SpaceMilestoneState = {};
  for (const tech of techs) {
    out[tech.id] = {
      techId: tech.id,
      firstAchieverCountryId: null,
      firstAchievedAtTick: null,
      achievers: [],
    };
  }
  return out;
}

/**
 * Record that `countryId` has just completed `techId`. If the tech is a
 * milestone with prestige fields, this:
 *   - marks the country as first or follow achiever in `state.spaceMilestones`
 *   - queues a reputation delta in EVERY active bloc via `queueReputationDelta`
 *
 * Edge cases (all silent no-ops, returning the input state unchanged):
 *   - tech not in scenario.techTree
 *   - tech has no `prestigeFirst` (not a milestone)
 *   - country not in `state.countries` (silent — happens on AI completing
 *     while their country was just removed in the same tick, etc.)
 *   - `state.spaceMilestones` is undefined (legacy save / opt-out scenario):
 *     the engine starts tracking from the next session; this completion is
 *     not retroactively recorded. Reputation deltas are also skipped to keep
 *     behavior consistent with "system not in use".
 *   - milestone entry already lists this country as an achiever (idempotent
 *     — guards against double-firing within a single tick).
 *
 * Pure: returns a new GameState. Reputation deltas are appended to the
 * pendingReputationDeltas queue (drained by the next reputation tick step).
 */
export function recordTechCompletion(
  state: GameState,
  countryId: CountryId,
  techId: TechId,
  scenario: Scenario,
): GameState {
  // Legacy save / no-milestone-scenario edge: silently skip.
  if (!state.spaceMilestones) return state;

  const tech = scenario.techTree.find((t) => t.id === techId);
  if (!isMilestone(tech)) return state;

  const entry = state.spaceMilestones[techId];
  if (!entry) return state;

  // Country must exist in the current state; otherwise nothing to credit.
  if (!state.countries[countryId]) return state;

  // Idempotency guard: if this country is already in the achievers list, do
  // nothing. Two tick steps in the same frame could otherwise double-apply.
  if (entry.achievers.includes(countryId)) return state;

  const isFirst = entry.firstAchieverCountryId === null;
  const updatedEntry: SpaceMilestoneEntry = isFirst
    ? {
        ...entry,
        firstAchieverCountryId: countryId,
        firstAchievedAtTick: state.tick,
        achievers: [...entry.achievers, countryId],
      }
    : {
        ...entry,
        achievers: [...entry.achievers, countryId],
      };

  // Compute reputation amount. `prestigeFollow` may be omitted; treat as 0
  // so non-first achievers simply log the achievement without a bump.
  const amount = isFirst
    ? (tech?.prestigeFirst ?? 0)
    : (tech?.prestigeFollow ?? 0);
  const reasonKey = isFirst ? REASON_KEY_FIRST : REASON_KEY_FOLLOW;

  let next: GameState = {
    ...state,
    spaceMilestones: {
      ...state.spaceMilestones,
      [techId]: updatedEntry,
    },
  };

  // Apply prestige to every active bloc (universal "world prestige"). When
  // the scenario has no blocs (`state.reputation` is undefined), the
  // queueReputationDelta helper is a no-op, so this loop costs nothing.
  if (amount !== 0 && state.reputation) {
    for (const blocId of Object.keys(state.reputation) as ActiveBlocId[]) {
      next = queueReputationDelta(next, {
        bloc: blocId,
        delta: amount,
        reasonKey,
        queuedAtTick: state.tick,
      });
    }
  }

  return next;
}

/**
 * Top-level tick step for the space system. Currently a no-op: all milestone
 * accounting happens synchronously inside `recordTechCompletion` (which is
 * called from `tick.stepResearch`).
 *
 * Kept as a separate exported step so future additions ("buzz" decay, missed
 * milestone reminders, follow-achiever timeout windows) can plug in without
 * widening the engine's tick API surface.
 */
export function tickSpace(state: GameState, _scenario: Scenario): GameState {
  if (!state.spaceMilestones) return state;
  return state;
}

// UN resolution triggers — both action-driven (Q2 contextual) and periodic.
//
// Action-driven triggers consult `scenario.unTriggerMap` to find the
// resolution template for a given action key. If the scenario doesn't
// declare the key → graceful no-op (returns null).
//
// Periodic triggers fire seeded-randomly when world conditions match (e.g.
// climate accord under high tension). They run once per tick during the UN
// step and only fire when at least one cooldown-friendly window has passed.

import type {
  Action,
  ActionTriggerKey,
  GameState,
  Scenario,
  UNResolutionTemplate,
} from '../types.js';
import type { Rng } from '../rng.js';

/** Tick-frequency cap on periodic climate triggers. */
export const CLIMATE_PERIODIC_INTERVAL_TICKS = 50;

/** worldTension at or above which the climate periodic trigger may fire. */
export const HIGH_TENSION_THRESHOLD = 50;

/** Per-tick chance that a high-tension climate trigger fires (after interval). */
export const PERIODIC_CLIMATE_CHANCE = 0.25;

/**
 * Inspect a freshly-applied `Action` and return the matching UN template if
 * the scenario declares one for the relevant trigger key. Pure: never
 * mutates state.
 *
 * The mapping from Action → ActionTriggerKey is hardcoded here (per Q2: this
 * is the engine-side contextual trigger surface). Scenarios decide *what
 * resolution* gets triggered by populating `scenario.unTriggerMap`.
 */
export function evaluateActionTrigger(
  action: Action,
  state: GameState,
  scenario: Scenario,
): UNResolutionTemplate | null {
  const map = scenario.unTriggerMap;
  if (!map) return null;
  const key = actionToTriggerKey(action, state);
  if (!key) return null;
  return map[key] ?? null;
}

/**
 * Periodic / world-state UN triggers. Called once per tick from `tickUN`.
 * Returns a template if a trigger fires this tick, else null.
 *
 * Currently models only the high-tension climate accord (every ~50 ticks
 * with high worldTension). More periodic triggers (humanitarian on famine,
 * etc.) can be added as additional branches without changing the call site.
 */
export function evaluatePeriodicTriggers(
  state: GameState,
  scenario: Scenario,
  rng: Rng,
): UNResolutionTemplate | null {
  const map = scenario.unTriggerMap;
  if (!map) return null;
  // High world tension → propose a climate accord every ~50 ticks.
  if (
    state.tick > 0 &&
    state.tick % CLIMATE_PERIODIC_INTERVAL_TICKS === 0 &&
    state.worldTension >= HIGH_TENSION_THRESHOLD
  ) {
    if (rng.next() < PERIODIC_CLIMATE_CHANCE) {
      const template = map['climatePeriodic'] ?? map['highWorldTension'];
      if (template) return template;
    }
  }
  return null;
}

/**
 * Maps an Action back to the ActionTriggerKey we use as a lookup in
 * `scenario.unTriggerMap`. Returns null if the action doesn't have a
 * corresponding trigger.
 *
 * Designed to be intentionally narrow: the spec calls for "subtle, contextual
 * triggers", not a flood. Adding new mappings requires both an entry here
 * and a corresponding `unTriggerMap` declaration in the scenario JSON.
 */
function actionToTriggerKey(action: Action, state: GameState): ActionTriggerKey | null {
  switch (action.type) {
    case 'diplomacy':
      if (action.kind === 'declareWar') return 'declareWar';
      if (action.kind === 'imposeSanction') return 'sanctionsImposed';
      if (action.kind === 'tradeDeal') {
        // Trade deal contextual trigger only fires when target is "low GDP"
        // (humanitarian undertone). We approximate with: target is below the
        // median GDP of all known countries.
        const targetCountry = state.countries[action.target];
        if (!targetCountry) return null;
        const gdps = Object.values(state.countries).map((c) => c.economy.gdp).sort((a, b) => a - b);
        const median = gdps[Math.floor(gdps.length / 2)] ?? 0;
        if (targetCountry.economy.gdp < median) return 'tradeDealLowGdp';
      }
      return null;
    default:
      return null;
  }
}

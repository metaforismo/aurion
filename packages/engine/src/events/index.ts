// Event choices — applying what the player decided.
//
// Scenario authors write effects against dotted stat paths
// ("politics.popularity", "economy.treasury", …) with a few conventions that
// keep events balanced across scenarios of very different sizes:
//
//   - `economy.treasury` deltas smaller than ±1000 are "weeks of income"
//     (−4 = four weeks of revenue), larger values are raw currency.
//   - `economy.weeklyIncome` is recomputed every tick from GDP, so a change
//     to it is applied to GDP instead (a `multiplier` of 1.05 or a `delta`
//     of 0.05 both mean +5%).
//   - a `multiplier` on any stat scales it; a `delta` adds to it.
//
// `describeEventEffect` returns the same interpretation as a plain value so
// the UI can show the player exactly what a choice will do.
//
// Pure functions only.

import { ensureRelation, withRelation } from '../actions/helpers.js';
import type {
  Country,
  CountryId,
  EventDefinition,
  EventEffect,
  GameState,
} from '../types.js';

type ModifyStat = Extract<EventEffect, { type: 'modifyStat' }> & { multiplier?: number };

/** Treasury deltas below this magnitude are expressed in weeks of income. */
const TREASURY_WEEKS_LIMIT = 1000;

export type EventEffectSummary =
  | {
      kind: 'stat';
      stat: string;
      /** Country affected; null for global stats (worldTension). */
      countryId: CountryId | null;
      /** Signed change in the stat's own unit. */
      amount: number;
      /** How `amount` should be read. */
      unit: 'absolute' | 'percent' | 'points';
    }
  | { kind: 'attitude'; countryId: CountryId; amount: number }
  | { kind: 'research'; countryId: CountryId; techId: string }
  | { kind: 'none' };

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function targetOf(state: GameState, target: string): CountryId {
  return target === 'player' ? state.playerCountryId : target;
}

/** Range a stat is kept in after a change. */
function boundsFor(stat: string): [number, number] {
  if (stat === 'politics.popularity' || /^politics\.factions\.\w+\.(satisfaction|influence)$/.test(stat)) {
    return [0, 100];
  }
  if (stat === 'economy.taxRate') return [0, 100];
  if (stat.startsWith('economy.sectors.')) return [0, 1];
  if (stat === 'intelligence.counterIntelLevel' || stat === 'military.doctrineLevel') return [0, 1];
  if (stat === 'economy.treasury') return [-Infinity, Infinity];
  return [0, Infinity];
}

function readPath(country: Country, path: string[]): number | undefined {
  let node: unknown = country;
  for (const key of path) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === 'number' ? node : undefined;
}

function writePath<T>(obj: T, path: string[], value: number): T {
  const [head, ...rest] = path;
  if (head === undefined) return obj;
  const record = obj as Record<string, unknown>;
  return {
    ...record,
    [head]: rest.length === 0 ? value : writePath(record[head], rest, value),
  } as T;
}

/** A week of revenue; estimated from GDP before the first tick has run. */
function weekOfIncome(country: Country): number {
  const income = country.economy.weeklyIncome;
  return income > 0 ? income : Math.round(country.economy.gdp * 0.005);
}

/** Resolve a modifyStat effect to the concrete stat and new value it sets. */
function resolveStat(
  state: GameState,
  fx: ModifyStat,
): { countryId: CountryId; stat: string; before: number; after: number; percent: boolean } | null {
  const countryId = targetOf(state, fx.target);
  const country = state.countries[countryId];
  if (!country) return null;
  const mul = fx.multiplier ?? 1;

  // Income is derived from GDP every tick — move GDP instead.
  if (fx.stat === 'economy.weeklyIncome') {
    const factor = mul * (1 + fx.delta);
    const before = country.economy.gdp;
    return { countryId, stat: 'economy.gdp', before, after: Math.max(0, Math.round(before * factor)), percent: true };
  }
  if (fx.stat === 'economy.treasury') {
    const before = country.economy.treasury;
    const delta =
      Math.abs(fx.delta) < TREASURY_WEEKS_LIMIT
        ? fx.delta * weekOfIncome(country)
        : fx.delta;
    return { countryId, stat: fx.stat, before, after: Math.round(before * mul + delta), percent: false };
  }

  const path = fx.stat.split('.');
  const before = readPath(country, path);
  if (before === undefined) return null;
  const [lo, hi] = boundsFor(fx.stat);
  const raw = before * mul + fx.delta;
  const integer = /armySize|navy|airforce|spyCount|population/.test(fx.stat);
  return {
    countryId,
    stat: fx.stat,
    before,
    after: clamp(integer ? Math.round(raw) : raw, lo, hi),
    percent: fx.multiplier !== undefined && fx.delta === 0,
  };
}

/** Bare stat names older content uses, mapped to their full paths. */
const LEGACY_STAT_PATHS: Readonly<Record<string, string>> = {
  researchOutput: 'science.researchOutput',
  doctrineLevel: 'military.doctrineLevel',
  counterIntelLevel: 'intelligence.counterIntelLevel',
  gdp: 'economy.gdp',
  treasury: 'economy.treasury',
  popularity: 'politics.popularity',
  armySize: 'military.armySize',
  spyCount: 'intelligence.spyCount',
};

/**
 * Apply one stat change to a country using the shared conventions (dotted
 * paths, income routed to GDP, clamping). Used for technology effects, which
 * target the researching country rather than "the player".
 */
export function applyStatToCountry(
  country: Country,
  stat: string,
  delta: number,
  multiplier?: number,
): Country {
  const path = LEGACY_STAT_PATHS[stat] ?? stat;
  const probe = { countries: { [country.id]: country }, playerCountryId: country.id } as unknown as GameState;
  const r = resolveStat(probe, {
    type: 'modifyStat',
    target: country.id,
    stat: path,
    delta,
    ...(multiplier !== undefined ? { multiplier } : {}),
  });
  return r ? writePath(country, r.stat.split('.'), r.after) : country;
}

/** What an effect will do, in display-ready terms. */
export function describeEventEffect(state: GameState, effect: EventEffect): EventEffectSummary {
  switch (effect.type) {
    case 'modifyStat': {
      if (effect.stat === 'worldTension') {
        return { kind: 'stat', stat: effect.stat, countryId: null, amount: effect.delta, unit: 'points' };
      }
      const r = resolveStat(state, effect);
      if (!r) return { kind: 'none' };
      if (r.percent) {
        const pct = r.before === 0 ? 0 : (r.after / r.before - 1) * 100;
        return { kind: 'stat', stat: r.stat, countryId: r.countryId, amount: pct, unit: 'percent' };
      }
      const [lo, hi] = boundsFor(r.stat);
      const bounded = Number.isFinite(lo) && Number.isFinite(hi);
      return {
        kind: 'stat',
        stat: r.stat,
        countryId: r.countryId,
        // Shares (0..1) read as percentage points.
        amount: hi === 1 ? (r.after - r.before) * 100 : r.after - r.before,
        unit: bounded ? 'points' : 'absolute',
      };
    }
    case 'shiftAttitude':
      return { kind: 'attitude', countryId: effect.with, amount: effect.delta };
    case 'startResearch':
      return { kind: 'research', countryId: effect.target, techId: effect.techId };
    case 'spawnSpy':
      return { kind: 'none' };
  }
}

/** Apply a list of effects on behalf of the player. */
export function applyEventEffects(state: GameState, effects: readonly EventEffect[]): GameState {
  let next = state;
  for (const effect of effects) {
    switch (effect.type) {
      case 'modifyStat': {
        if (effect.stat === 'worldTension') {
          next = { ...next, worldTension: clamp(next.worldTension + effect.delta, 0, 100) };
          break;
        }
        const r = resolveStat(next, effect);
        const country = r ? next.countries[r.countryId] : undefined;
        if (!r || !country) break;
        next = {
          ...next,
          countries: { ...next.countries, [r.countryId]: writePath(country, r.stat.split('.'), r.after) },
        };
        break;
      }
      case 'shiftAttitude': {
        const me = next.playerCountryId;
        if (effect.with === me || !next.countries[effect.with]) break;
        const ensured = ensureRelation(next, me, effect.with);
        next = withRelation(ensured.state, {
          ...ensured.relation,
          attitude: clamp(ensured.relation.attitude + effect.delta, -100, 100),
        });
        break;
      }
      case 'startResearch': {
        const id = targetOf(next, effect.target);
        const country = next.countries[id];
        if (!country || country.science.activeResearch !== null) break;
        if (country.science.completedTechs.includes(effect.techId)) break;
        next = {
          ...next,
          countries: {
            ...next.countries,
            [id]: { ...country, science: { ...country.science, activeResearch: effect.techId } },
          },
          techTreeProgress: {
            ...next.techTreeProgress,
            [id]: { activeResearch: effect.techId, accumulatedPoints: 0 },
          },
        };
        break;
      }
      case 'spawnSpy':
        // No scenario uses this yet; the op needs odds and a payload the
        // effect does not carry, so it is deliberately not applied.
        break;
    }
  }
  return next;
}

/**
 * Resolve the pending event (the last one in the ring buffer) with the given
 * choice: marks it resolved and applies the choice's effects. Returns the
 * input state when there is nothing to resolve.
 */
export function resolveEventChoice(
  state: GameState,
  eventPool: readonly EventDefinition[],
  choiceIndex: number,
): GameState {
  const lastIdx = state.events.length - 1;
  const last = state.events[lastIdx];
  if (!last || last.resolvedChoiceIndex !== null) return state;

  const choices = eventPool.find((e) => e.id === last.definitionId)?.choices ?? [];
  const idx = choices.length > 0 ? clamp(Math.trunc(choiceIndex), 0, choices.length - 1) : choiceIndex;
  const events = state.events.slice();
  events[lastIdx] = { ...last, resolvedChoiceIndex: idx };
  const resolved: GameState = { ...state, events };
  const choice = choices[idx];
  return choice ? applyEventEffects(resolved, choice.effects) : resolved;
}

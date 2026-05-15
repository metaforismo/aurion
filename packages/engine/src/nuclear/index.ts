// Nuclear weapons system. Phase 3 — Wave 10.
//
// Three-tier model from System 4 in docs/SPEC-PHASE-3.md:
//   Level 0 — Deterrent: passive presence of warheads visible to anyone with
//             at least 'partial' intel; AI declareWar scoring penalises wars
//             against nuclear states.
//   Level 1 — Tactical strike: destroys deployed units in a region,
//             devastates host popularity, crashes player reputation -50 in
//             every bloc, world tension +30, queues UN condemnation.
//   Level 2 — Strategic strike: target country devastation. If target also
//             has an arsenal → MAD: both sides annihilated, global GDP
//             reduction kicks in, nuclear-winter chain events fired.
//
// Pure module: every exported function takes a GameState (and any context)
// and returns a new GameState. No mutation, no I/O.

import type {
  ActiveBlocId,
  Country,
  CountryId,
  GameState,
  RegionId,
  Scenario,
  TechDefinition,
  NuclearArsenal,
  GameEvent,
  Relation,
} from '../types.js';
import type { Rng } from '../rng.js';
import { clamp, withCountry } from '../actions/helpers.js';
import { queueReputationDelta } from '../reputation/index.js';
import { relationKey } from '../createGame.js';

// ---------------------------------------------------------------------------
// Constants — exported so tests and UI can reference them.
// ---------------------------------------------------------------------------

/** All bloc ids reputation is tracked for. Repeated to keep this module standalone. */
const ACTIVE_BLOCS: readonly ActiveBlocId[] = ['western', 'eastern', 'non-aligned'];

/** Per-bloc reputation hit on a tactical strike (per spec System 4 / table 125). */
export const TACTICAL_REP_PENALTY = -50;
/** Per-bloc reputation hit on a strategic strike (per spec System 4 / table 126). */
export const STRATEGIC_REP_PENALTY = -100;
/** Per-bloc reputation boost per warhead dismantled WITH a non-proliferation treaty (Q4). */
export const DISMANTLE_REP_BOOST_FULL = 30;
/** Halved boost when no treaty is in force (per Q4). */
export const DISMANTLE_REP_BOOST_HALF = 15;

/** Tactical strike worldTension delta. */
export const TACTICAL_TENSION_DELTA = 30;
/** Strategic / MAD worldTension delta. */
export const STRATEGIC_TENSION_DELTA = 60;

/** Unilateral devastation multipliers (target without arsenal). */
export const UNILATERAL_GDP_MULT = 0.5;
export const UNILATERAL_TREASURY_MULT = 0.3;

/** MAD devastation multipliers (both sides). */
export const MAD_GDP_MULT = 0.2;

/** Tactical strike: host country popularity penalty (from spec System 4). */
export const TACTICAL_HOST_POPULARITY_DELTA = -30;

/** Cap on warheads from auto-production. */
export const MAX_WARHEADS = 10;
/** Auto-production cadence — 1 warhead every 50 ticks while advanced tech is owned. */
export const ADVANCED_PRODUCTION_INTERVAL_TICKS = 50;

/** Suffix used to identify the basic nuclear arsenal tech across scenarios. */
export const NUCLEAR_ARSENAL_TECH_SUFFIX = 'nuclear_arsenal';
/** Suffix used to identify the advanced (multi-warhead production) tech. */
export const ADVANCED_NUCLEAR_TECH_SUFFIX = 'nuclear_arsenal_advanced';
/** Suffix used to identify the hypersonic (delivery system level 2) tech. */
export const HYPERSONIC_TECH_SUFFIX = 'hypersonic_delivery';
/** Suffix used to identify mid-tier ICBM-style delivery (delivery system level 1). */
export const ICBM_TECH_SUFFIX = 'icbm';

/** Event id prefix for the nuclear winter chain stub events. */
export const NUCLEAR_WINTER_EVENT_PREFIX = 'event_nuclear_winter_';
/** Event id prefix for unilateral aftermath chain. */
export const UNILATERAL_AFTERMATH_EVENT_PREFIX = 'event_nuclear_aftermath_unilateral_';
/** Event id prefix recording the strike itself in state.events. */
export const STRIKE_EVENT_PREFIX = 'event_nuclear_strike_';

// ---------------------------------------------------------------------------
// Predicates / helpers.
// ---------------------------------------------------------------------------

/** Has at least one warhead (i.e. is currently armed). */
export function hasArsenal(country: Country): boolean {
  if (!country.nuclear) return false;
  return country.nuclear.warheadCount >= 1 && country.nuclear.mad === true;
}

/**
 * Whether the visible deterrent is active for `countryId` from the perspective
 * of `observerId`. The arsenal is visible only when:
 *   - target has arsenal AND mad flag is true, AND
 *   - the observer has at least 'partial' intel on the target.
 *
 * If `observerId` is omitted, returns true iff the country has the arsenal —
 * useful for UI on own-country panels.
 */
export function hasDeterrent(
  state: GameState,
  countryId: CountryId,
  observerId?: CountryId,
): boolean {
  const country = state.countries[countryId];
  if (!country) return false;
  if (!hasArsenal(country)) return false;
  if (!observerId || observerId === countryId) return true;
  const observer = state.countries[observerId];
  if (!observer) return false;
  const intel = observer.intelligence.knownIntel[countryId] ?? 'none';
  return intel === 'partial' || intel === 'full';
}

/**
 * Whether `attackerId` has at least one active war with a country whose
 * `regionId` equals `targetRegionId`, OR `attackerId` is at war with a
 * country that has any deployment in `targetRegionId`. The latter covers
 * the case of an enemy that has occupied a third region.
 */
export function isEnemyRegion(
  state: GameState,
  attackerId: CountryId,
  targetRegionId: RegionId,
): boolean {
  const attacker = state.countries[attackerId];
  if (!attacker) return false;
  // Enemies are countries we are at war with.
  const enemyIds = new Set<CountryId>();
  for (const rel of Object.values(state.relations)) {
    if (rel.atWar) {
      if (rel.countryA === attackerId) enemyIds.add(rel.countryB);
      else if (rel.countryB === attackerId) enemyIds.add(rel.countryA);
    }
  }
  if (enemyIds.size === 0) return false;
  // Either an enemy's home region matches or an enemy has a deployment there.
  for (const id of enemyIds) {
    const c = state.countries[id];
    if (!c) continue;
    if (c.regionId === targetRegionId) return true;
    for (const dep of c.military.deployedUnits) {
      if (dep.regionId === targetRegionId) return true;
    }
  }
  return false;
}

/** Return true iff `attackerId` is at war with `targetId`. */
export function isAtWar(state: GameState, attackerId: CountryId, targetId: CountryId): boolean {
  if (attackerId === targetId) return false;
  const key = relationKey(attackerId, targetId);
  const rel: Relation | undefined = state.relations[key];
  return Boolean(rel?.atWar);
}

// ---------------------------------------------------------------------------
// Apply functions — pure state transformations.
// ---------------------------------------------------------------------------

/**
 * Apply a tactical nuclear strike against a region. Effects:
 *   - All deployments in the region are destroyed (units = 0).
 *   - The region's host country (if any) loses 30 popularity.
 *   - Attacker loses one warhead.
 *   - Reputation: -50 in every active bloc.
 *   - World tension: +30 (clamped 0..100).
 *   - A `STRIKE_EVENT_PREFIX` event is appended for replay/AI tracking.
 *
 * Caller is responsible for preconditions (warhead present, region is enemy,
 * etc.); this function only applies effects.
 */
export function applyTacticalStrike(
  state: GameState,
  attackerId: CountryId,
  targetRegion: RegionId,
  _rng: Rng,
): GameState {
  const attacker = state.countries[attackerId];
  if (!attacker || !attacker.nuclear) return state;

  // 1. Wipe all deployments in the region across every country.
  let next = state;
  const updatedCountries: Record<CountryId, Country> = { ...next.countries };
  for (const c of Object.values(next.countries)) {
    const remaining = c.military.deployedUnits.filter((d) => d.regionId !== targetRegion);
    if (remaining.length !== c.military.deployedUnits.length) {
      updatedCountries[c.id] = {
        ...c,
        military: { ...c.military, deployedUnits: remaining },
      };
    }
  }

  // 2. Host country popularity hit (region territorial owner).
  const host = findHostCountry(updatedCountries, targetRegion);
  if (host) {
    const hostCountry = updatedCountries[host];
    if (hostCountry) {
      updatedCountries[host] = {
        ...hostCountry,
        politics: {
          ...hostCountry.politics,
          popularity: clamp(
            hostCountry.politics.popularity + TACTICAL_HOST_POPULARITY_DELTA,
            0,
            100,
          ),
        },
      };
    }
  }

  // 3. Consume one warhead from the attacker.
  const attackerPatched = updatedCountries[attackerId] ?? attacker;
  const newArsenal: NuclearArsenal = consumeWarhead(attackerPatched.nuclear ?? attacker.nuclear);
  updatedCountries[attackerId] = {
    ...attackerPatched,
    nuclear: newArsenal,
  };

  next = { ...next, countries: updatedCountries };

  // 4. World tension bump.
  next = { ...next, worldTension: clamp(next.worldTension + TACTICAL_TENSION_DELTA, 0, 100) };

  // 5. Queue reputation penalties (only meaningful if attacker is the player
  //    and reputation is initialised — queueReputationDelta is a no-op otherwise).
  if (attackerId === state.playerCountryId) {
    next = queueAllBlocs(next, TACTICAL_REP_PENALTY, 'rep.cause.tacticalStrike');
  }

  // 6. Append a strike event for tracking. Use a stable id including target region.
  next = appendEvent(next, `${STRIKE_EVENT_PREFIX}tactical_${targetRegion}`);

  return next;
}

/**
 * Apply a strategic nuclear strike against a country. Triggers MAD if the
 * target also has an arsenal; otherwise unilateral devastation. Caller
 * validates preconditions; this function applies effects.
 */
export function applyStrategicStrike(
  state: GameState,
  attackerId: CountryId,
  targetCountryId: CountryId,
  _rng: Rng,
): GameState {
  const attacker = state.countries[attackerId];
  const target = state.countries[targetCountryId];
  if (!attacker || !target) return state;
  if (!attacker.nuclear) return state;

  const targetIsArmed = hasArsenal(target);
  const isMad = targetIsArmed;

  let next = state;

  if (isMad) {
    next = applyMadDevastation(next, attackerId, targetCountryId);
  } else {
    next = applyUnilateralDevastation(next, attackerId, targetCountryId);
  }

  // World tension: STRATEGIC_TENSION_DELTA in both cases (MAD spec says +60 clamped to 100).
  next = { ...next, worldTension: clamp(next.worldTension + STRATEGIC_TENSION_DELTA, 0, 100) };

  // Reputation penalty (always saturating at -100 over time).
  if (attackerId === state.playerCountryId) {
    next = queueAllBlocs(next, STRATEGIC_REP_PENALTY, 'rep.cause.strategicStrike');
  }

  // Strike event marker.
  next = appendEvent(
    next,
    `${STRIKE_EVENT_PREFIX}strategic_${targetCountryId}${isMad ? '_mad' : ''}`,
  );

  // Nuclear winter chain — only fires under MAD per spec System 4 / "Nuclear
  // Winter chain" notes. Stub events; scenario data fills the actual chain.
  if (isMad) {
    next = injectNuclearWinterChain(next);
  } else {
    next = injectUnilateralAftermathChain(next);
  }

  return next;
}

/**
 * Reduce attacker's warhead count by `count`. If `hasNonProliferationTreaty`
 * is true, queue +DISMANTLE_REP_BOOST_FULL per warhead in every bloc;
 * otherwise queue half. Returns updated state. Caller validates count <= owned.
 */
export function applyDismantle(
  state: GameState,
  countryId: CountryId,
  count: number,
  hasNonProliferationTreaty: boolean,
): GameState {
  const country = state.countries[countryId];
  if (!country || !country.nuclear) return state;
  if (count <= 0) return state;
  const owned = country.nuclear.warheadCount;
  const actuallyDismantled = Math.min(owned, Math.floor(count));
  if (actuallyDismantled <= 0) return state;

  const newWarheadCount = owned - actuallyDismantled;
  const newArsenal: NuclearArsenal = {
    ...country.nuclear,
    warheadCount: newWarheadCount,
    // mad flag follows warheadCount: false once the cupboard is bare.
    mad: newWarheadCount >= 1 ? country.nuclear.mad : false,
  };
  let next = withCountry(state, { ...country, nuclear: newArsenal });

  // Reputation boost only applies when actor is the player (Q4) — boost full
  // with treaty in force, halved otherwise.
  if (countryId === state.playerCountryId) {
    const perWarheadBoost = hasNonProliferationTreaty
      ? DISMANTLE_REP_BOOST_FULL
      : DISMANTLE_REP_BOOST_HALF;
    const totalBoost = perWarheadBoost * actuallyDismantled;
    next = queueAllBlocs(next, totalBoost, 'rep.cause.dismantleNuclear');
  }
  return next;
}

/**
 * Per-tick nuclear-system step:
 *   - Promote countries that have completed `tech_*_nuclear_arsenal` to a
 *     fresh NuclearArsenal if they don't have one yet (research mid-game).
 *   - Auto-warhead production for countries with `tech_*_nuclear_arsenal_advanced`
 *     (1 warhead every 50 ticks, capped at MAX_WARHEADS).
 *   - Keeps the `mad` flag in sync with warheadCount > 0.
 */
export function tickNuclear(state: GameState, scenario?: Scenario): GameState {
  const updated: Record<CountryId, Country> = {};
  let mutated = false;
  for (const [id, country] of Object.entries(state.countries)) {
    let next = country;

    // Promote: if the country completed a *_nuclear_arsenal tech but doesn't
    // have a `nuclear` field yet, infer it now. Idempotent — once present
    // the nuclear field is owned by the strike/dismantle reducers.
    if (!next.nuclear) {
      const inferred = inferArsenalFromTechs(
        { science: { completedTechs: next.science.completedTechs } },
        scenario?.techTree ?? [],
      );
      if (inferred) {
        next = { ...next, nuclear: inferred };
        mutated = true;
      }
    }

    // Sync mad flag with current warheadCount.
    if (next.nuclear) {
      const expectedMad = next.nuclear.warheadCount >= 1;
      if (next.nuclear.mad !== expectedMad) {
        next = {
          ...next,
          nuclear: { ...next.nuclear, mad: expectedMad },
        };
        mutated = true;
      }
    }
    // Auto-production: country must have advanced tech AND at least one
    // existing arsenal (the basic tech). Cadence is fixed; we use the simple
    // rule "tick > 0 && tick % interval === 0".
    if (next.nuclear && hasAdvancedNuclearTech(next)) {
      const due =
        state.tick > 0 &&
        state.tick % ADVANCED_PRODUCTION_INTERVAL_TICKS === 0 &&
        next.nuclear.warheadCount < MAX_WARHEADS;
      if (due) {
        next = {
          ...next,
          nuclear: {
            ...next.nuclear,
            warheadCount: Math.min(MAX_WARHEADS, next.nuclear.warheadCount + 1),
            mad: true,
          },
        };
        mutated = true;
      }
    }
    if (next !== country) updated[id] = next;
    else updated[id] = country;
  }
  if (!mutated) return state;
  return { ...state, countries: updated };
}

/**
 * Derive the initial `NuclearArsenal` from a country's completedTechs based
 * on the conventional tech id suffixes. Returns undefined if the country has
 * no nuclear tech at all. Used by createGame to populate `country.nuclear`
 * for scenarios that bake nuclear states into their initialCompletedTechs
 * (e.g. mondo-contemporaneo with the 5 historical nuclear states).
 */
export function inferArsenalFromTechs(
  country: { science: { completedTechs: readonly string[] } },
  techCatalog: readonly TechDefinition[],
): NuclearArsenal | undefined {
  void techCatalog; // future-proofing: scenario-specific tech may shift defaults.
  const completed = country.science.completedTechs;
  const hasBasic = completed.some((t) => endsWith(t, NUCLEAR_ARSENAL_TECH_SUFFIX));
  if (!hasBasic) return undefined;
  const hasAdvanced = completed.some((t) => endsWith(t, ADVANCED_NUCLEAR_TECH_SUFFIX));
  const hasHypersonic = completed.some((t) => endsWith(t, HYPERSONIC_TECH_SUFFIX));
  const hasIcbm = completed.some((t) => endsWith(t, ICBM_TECH_SUFFIX));
  const deliverySystemLevel: 0 | 1 | 2 = hasHypersonic ? 2 : hasIcbm ? 1 : 0;
  // Start with 1 warhead from the basic tech; the advanced tech bumps the
  // *cap* but auto-production is what actually fills it over time.
  const warheadCount = hasAdvanced ? 2 : 1;
  return {
    warheadCount,
    deliverySystemLevel,
    mad: true,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers.
// ---------------------------------------------------------------------------

function consumeWarhead(arsenal: NuclearArsenal): NuclearArsenal {
  const newCount = Math.max(0, arsenal.warheadCount - 1);
  return {
    ...arsenal,
    warheadCount: newCount,
    mad: newCount >= 1,
  };
}

function findHostCountry(
  countries: Record<CountryId, Country>,
  regionId: RegionId,
): CountryId | null {
  for (const c of Object.values(countries)) {
    if (c.regionId === regionId) return c.id;
  }
  return null;
}

function queueAllBlocs(state: GameState, delta: number, reasonKey: string): GameState {
  if (!state.reputation) return state;
  let next = state;
  for (const blocId of ACTIVE_BLOCS) {
    if (state.reputation[blocId] === undefined) continue;
    next = queueReputationDelta(next, {
      bloc: blocId,
      delta,
      reasonKey,
      queuedAtTick: state.tick,
    });
  }
  return next;
}

function appendEvent(state: GameState, definitionId: string): GameState {
  const ev: GameEvent = {
    definitionId,
    firedAtTick: state.tick,
    resolvedChoiceIndex: null,
  };
  // Same EVENTS_RING_SIZE bound as tick.ts (50). Slice if over.
  const RING = 50;
  const next = [...state.events, ev];
  const trimmed = next.length > RING ? next.slice(-RING) : next;
  return { ...state, events: trimmed };
}

function applyUnilateralDevastation(
  state: GameState,
  attackerId: CountryId,
  targetCountryId: CountryId,
): GameState {
  const target = state.countries[targetCountryId];
  if (!target) return state;
  // Devastate target.
  const updatedTarget: Country = {
    ...target,
    economy: {
      ...target.economy,
      gdp: Math.max(0, target.economy.gdp * UNILATERAL_GDP_MULT),
      treasury: Math.max(0, target.economy.treasury * UNILATERAL_TREASURY_MULT),
    },
    politics: { ...target.politics, popularity: 0 },
    military: { ...target.military, deployedUnits: [] },
  };
  let next = withCountry(state, updatedTarget);

  // Consume one warhead from the attacker.
  const attacker = next.countries[attackerId];
  if (attacker && attacker.nuclear) {
    next = withCountry(next, {
      ...attacker,
      nuclear: consumeWarhead(attacker.nuclear),
    });
  }
  return next;
}

function applyMadDevastation(
  state: GameState,
  attackerId: CountryId,
  targetCountryId: CountryId,
): GameState {
  let next = state;
  for (const id of [attackerId, targetCountryId]) {
    const c = next.countries[id];
    if (!c) continue;
    next = withCountry(next, {
      ...c,
      economy: {
        ...c.economy,
        gdp: Math.max(0, c.economy.gdp * MAD_GDP_MULT),
        treasury: 0,
      },
      politics: { ...c.politics, popularity: 0 },
      military: { ...c.military, deployedUnits: [] },
    });
  }
  // Both consume a warhead.
  for (const id of [attackerId, targetCountryId]) {
    const c = next.countries[id];
    if (!c?.nuclear) continue;
    next = withCountry(next, { ...c, nuclear: consumeWarhead(c.nuclear) });
  }
  // Global GDP modifier — apply a one-shot 30% reduction to all surviving
  // countries (per spec: "globalGdpReduction = 0.30 modifier applied to all
  // nations for next 200 ticks"). For Phase 3 we just apply the immediate
  // reduction here; Phase 4 may layer a temporary modifier.
  const updatedCountries: Record<CountryId, Country> = { ...next.countries };
  for (const c of Object.values(next.countries)) {
    if (c.id === attackerId || c.id === targetCountryId) continue;
    updatedCountries[c.id] = {
      ...c,
      economy: {
        ...c.economy,
        gdp: Math.max(0, c.economy.gdp * 0.7),
      },
    };
  }
  return { ...next, countries: updatedCountries };
}

function injectNuclearWinterChain(state: GameState): GameState {
  let next = state;
  for (const phase of ['climate_collapse', 'refugee_crisis', 'famine'] as const) {
    next = appendEvent(next, `${NUCLEAR_WINTER_EVENT_PREFIX}${phase}`);
  }
  return next;
}

function injectUnilateralAftermathChain(state: GameState): GameState {
  let next = state;
  for (const phase of ['famine', 'refugee_crisis'] as const) {
    next = appendEvent(next, `${UNILATERAL_AFTERMATH_EVENT_PREFIX}${phase}`);
  }
  return next;
}

function endsWith(techId: string, suffix: string): boolean {
  return techId.endsWith(`_${suffix}`) || techId === suffix;
}

function hasAdvancedNuclearTech(country: Country): boolean {
  return country.science.completedTechs.some((t) => endsWith(t, ADVANCED_NUCLEAR_TECH_SUFFIX));
}

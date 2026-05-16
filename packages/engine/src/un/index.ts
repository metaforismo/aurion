// United Nations / international body. Phase 3 — Wave 9.
//
// Manages a list of UNResolution objects on `state.unResolutions`. Each
// resolution has a voting window; AI countries cast deterministic votes
// based on archetype + bloc + reputation. When the window closes:
//   - any 'veto' from a permanent council member → status = 'vetoed'
//   - else yes >= no → 'passed' and apply effectsOnPass; tie → 'failed'
//
// Effects (EventEffect[]) are applied via `applyEventEffects`, mirroring the
// existing event resolution pipeline.

import type {
  Action,
  ActionTriggerKey,
  AiArchetype,
  Country,
  CountryId,
  EventEffect,
  GameState,
  RegionId,
  Scenario,
  UNResolution,
  UNResolutionKind,
  UNResolutionTemplate,
  UNVote,
} from '../types.js';
import type { Rng } from '../rng.js';
import { clamp, ensureRelation, withRelation } from '../actions/helpers.js';
import {
  evaluateActionTrigger,
  evaluatePeriodicTriggers,
} from './triggers.js';

export { evaluateActionTrigger, evaluatePeriodicTriggers };

/** Default voting window length when a template doesn't specify one. */
export const DEFAULT_VOTING_DURATION_TICKS = 4;

/** Per-tick chance that an eligible AI permanent member proposes a resolution. */
export const AI_PROPOSAL_CHANCE_PER_TICK = 0.05;

/** Min cumulative-stat-driven heuristic floor for AI proposing (placeholder for political capital). */
const AI_PROPOSAL_MIN_GDP = 50_000_000_000;

/** Cap on the resolutions ring buffer (active + recent). */
export const UN_RING_SIZE = 50;

/**
 * Initialise the UN resolutions list. Returns `[]` when the scenario uses UN
 * (i.e. has council members or trigger map declared). Returns `undefined`
 * when the scenario doesn't use UN (slim state path).
 */
export function initUN(scenario: Scenario): UNResolution[] | undefined {
  // We treat any of: unCouncilMembers, unTriggerMap, or scenario.blocs as
  // signals the scenario participates in Phase 3 UN. blocs alone are enough
  // because reputation deltas can apply via UN votes regardless of triggers.
  if (
    (scenario.unCouncilMembers && scenario.unCouncilMembers.length > 0) ||
    (scenario.unTriggerMap && Object.keys(scenario.unTriggerMap).length > 0) ||
    (scenario.blocs && scenario.blocs.length > 0)
  ) {
    return [];
  }
  return undefined;
}

/**
 * One tick of the UN system:
 *   1. Advance every voting resolution: if voting closes this tick, fill
 *      missing AI votes, evaluate veto/pass/fail, apply effects, set status.
 *   2. Maybe propose new periodic / contextual resolutions (scenario.unTriggerMap).
 *   3. Maybe have an AI permanent member propose a resolution (5% chance/tick
 *      per eligible member).
 *
 * Pure: returns a new GameState; no-op when `state.unResolutions` is undefined.
 */
export function tickUN(state: GameState, scenario: Scenario, rng: Rng): GameState {
  if (!state.unResolutions) return state;

  let next = state;
  // 1. Advance / close voting windows.
  next = advanceVoting(next, scenario);

  // 2. Periodic triggers (high-tension climate, etc.).
  const periodic = evaluatePeriodicTriggers(next, scenario, rng);
  if (periodic) {
    // Pick a permanent member as proposer (or any country if no permanents).
    const proposerId = pickProposer(next, scenario);
    if (proposerId) {
      next = openResolutionFromTemplate(next, periodic, proposerId);
    }
  }

  // 3. AI permanent members propose ad-hoc resolutions.
  next = stepAiProposals(next, scenario, rng);

  return next;
}

/**
 * Open a new resolution from a template + an action context. Used by the
 * action dispatcher (after a player or AI action triggers it via Q2 mapping).
 */
export function openResolutionFromTemplate(
  state: GameState,
  template: UNResolutionTemplate,
  proposerCountryId: CountryId,
  targetCountryId?: CountryId,
  targetRegionId?: RegionId,
): GameState {
  if (!state.unResolutions) return state;
  const id = `un-${state.tick}-${state.unResolutions.length}-${template.kind}`;
  const resolution: UNResolution = {
    id,
    kind: template.kind,
    proposerCountryId,
    proposedAtTick: state.tick,
    votingClosesAtTick: state.tick + (template.votingDurationTicks || DEFAULT_VOTING_DURATION_TICKS),
    effects: { onPass: [...template.effects.onPass], onFail: [...template.effects.onFail] },
    votes: { [proposerCountryId]: 'yes' },
    status: 'voting',
    titleKey: template.titleKey,
    descriptionKey: template.descriptionKey,
    ...(targetCountryId !== undefined ? { targetCountryId } : {}),
    ...(targetRegionId !== undefined ? { targetRegionId } : {}),
  };
  return appendResolution(state, resolution);
}

/**
 * Trigger a UN resolution from an Action's contextual mapping. Called from
 * the action dispatcher after a successful action that has a trigger key.
 * No-op if the scenario has no unTriggerMap or no matching key.
 */
export function maybeTriggerFromAction(
  state: GameState,
  scenario: Scenario,
  action: Action,
  actorCountryId: CountryId,
): GameState {
  if (!state.unResolutions) return state;
  const template = evaluateActionTrigger(action, state, scenario);
  if (!template) return state;
  // Pick a sensible target from the action context.
  let targetCountryId: CountryId | undefined;
  let targetRegionId: RegionId | undefined;
  if (action.type === 'diplomacy') targetCountryId = action.target;
  // Pick a permanent (or any) member as proposer; the actor itself is a poor
  // proposer because it's the one who just made the noise. Prefer a different
  // country whenever possible.
  const proposerId = pickProposer(state, scenario, actorCountryId) ?? actorCountryId;
  return openResolutionFromTemplate(state, template, proposerId, targetCountryId, targetRegionId);
}

// ---------------------------------------------------------------------------
// Internal — voting closure
// ---------------------------------------------------------------------------

function advanceVoting(state: GameState, scenario: Scenario): GameState {
  if (!state.unResolutions) return state;
  let mutated = false;
  let next = state;
  const updated: UNResolution[] = [];
  for (const r of state.unResolutions) {
    if (r.status !== 'voting') {
      updated.push(r);
      continue;
    }
    if (state.tick < r.votingClosesAtTick) {
      updated.push(r);
      continue;
    }
    // Voting window closed: fill AI votes for everyone who hasn't voted, then
    // resolve.
    const filled = fillMissingVotes(r, next, scenario);
    const resolved = resolveOutcome(filled, scenario);
    updated.push(resolved);
    mutated = true;
    // Apply outcome effects.
    if (resolved.status === 'passed') {
      next = applyEventEffects(next, resolved.effects.onPass, resolved);
    } else if (resolved.status === 'failed') {
      next = applyEventEffects(next, resolved.effects.onFail, resolved);
    }
  }
  if (!mutated) return state;
  // Trim to ring size (drop the oldest closed resolutions if needed).
  const trimmed = trimResolutions(updated);
  return { ...next, unResolutions: trimmed };
}

function fillMissingVotes(
  r: UNResolution,
  state: GameState,
  scenario: Scenario,
): UNResolution {
  const votes = { ...r.votes };
  for (const id of Object.keys(state.countries)) {
    if (votes[id] !== undefined) continue;
    const country = state.countries[id];
    if (!country) continue;
    // Player country: if no vote was registered before window closed → abstain.
    if (id === state.playerCountryId) {
      votes[id] = 'abstain';
      continue;
    }
    if (!country.aiPersonality) {
      votes[id] = 'abstain';
      continue;
    }
    votes[id] = computeAiVote(r, country, state, scenario);
  }
  return { ...r, votes };
}

function resolveOutcome(r: UNResolution, scenario: Scenario): UNResolution {
  // Veto check: any permanent member that voted veto → status = 'vetoed'.
  const permanents = scenario.unCouncilMembers ?? [];
  for (const memberId of permanents) {
    if (r.votes[memberId] === 'veto') {
      return { ...r, status: 'vetoed' };
    }
  }
  let yes = 0;
  let no = 0;
  for (const v of Object.values(r.votes)) {
    if (v === 'yes') yes++;
    else if (v === 'no') no++;
    // veto from non-permanent counts as 'no' (it has no special power).
    else if (v === 'veto') no++;
  }
  // Tie → failed (per spec).
  if (yes > no) return { ...r, status: 'passed' };
  return { ...r, status: 'failed' };
}

/**
 * Determine the AI vote for a single country/resolution pair. Deterministic
 * given the state — no rng — so re-running with the same inputs gives the
 * same vote.
 *
 * Score in roughly [-2, +2]; veto when score < -1.5 and the country is a
 * permanent member.
 */
export function computeAiVote(
  r: UNResolution,
  country: Country,
  state: GameState,
  scenario: Scenario,
): UNVote {
  const personality = country.aiPersonality;
  if (!personality) return 'abstain';
  let score = archetypeBaseline(personality.archetype, r.kind);

  // Bloc alignment: if proposer and country share a bloc → +0.4; if rival
  // (western vs eastern) → -0.4.
  const proposer = state.countries[r.proposerCountryId];
  if (proposer) {
    const myBloc = country.blocId;
    const theirBloc = proposer.blocId;
    if (myBloc && theirBloc) {
      if (myBloc === theirBloc) score += 0.4;
      else if (
        (myBloc === 'western' && theirBloc === 'eastern') ||
        (myBloc === 'eastern' && theirBloc === 'western')
      ) {
        score -= 0.4;
      }
    }
  }

  // Target relation: sanctions/condemnation against an ally → strong no.
  if (r.targetCountryId && r.targetCountryId !== country.id) {
    const targetCountry = state.countries[r.targetCountryId];
    if (targetCountry) {
      // attitude lookup
      const a = country.id < r.targetCountryId ? country.id : r.targetCountryId;
      const b = country.id < r.targetCountryId ? r.targetCountryId : country.id;
      const key = `${a}::${b}` as const;
      const rel = state.relations[key as keyof typeof state.relations];
      if (rel) {
        // Hostile resolutions toward someone we like → no.
        if ((r.kind === 'sanctions' || r.kind === 'condemnation') && rel.attitude > 30) {
          score -= 0.6;
        }
        // Aiding someone we like → yes.
        if ((r.kind === 'humanitarian' || r.kind === 'peacekeeping') && rel.attitude > 30) {
          score += 0.4;
        }
      }
    }
    // Target is self → strong no on any hostile resolution.
    if (r.targetCountryId === country.id) {
      if (r.kind === 'sanctions' || r.kind === 'condemnation') score -= 1.5;
    }
  }

  // Pragmatism nudges toward 'yes' (compliant), paranoia toward 'no'.
  score += (personality.pragmatism - 0.5) * 0.2;
  score -= (personality.paranoia - 0.5) * 0.2;

  // Permanent members may veto when score is very negative.
  const permanents = scenario.unCouncilMembers ?? [];
  if (permanents.includes(country.id) && score < -1.5) return 'veto';

  if (score > 0.5) return 'yes';
  if (score < -0.5) return 'no';
  return 'abstain';
}

function archetypeBaseline(
  archetype: AiArchetype,
  kind: UNResolutionKind,
): number {
  // Smallish per-archetype bias by resolution kind. Real scoring relies on
  // bloc + relation modifiers above; this is the inertia term.
  switch (archetype) {
    case 'pacifist_trader':
      if (kind === 'humanitarian' || kind === 'peacekeeping' || kind === 'climate') return 0.6;
      if (kind === 'sanctions' || kind === 'condemnation') return -0.1;
      return 0.2;
    case 'regional_bully':
      if (kind === 'sanctions' || kind === 'condemnation') return 0.4;
      if (kind === 'humanitarian' || kind === 'peacekeeping') return -0.2;
      return 0;
    case 'cold_isolationist':
      if (kind === 'nonProliferation' || kind === 'climate') return 0.2;
      return -0.3; // generally abstain-leaning
    case 'opportunist':
      // Will swing either way based on bloc/relation modifiers.
      return 0.1;
    case 'superpower':
      // Heavy hand: yes on climate/nonproliferation, no on bizarre stuff.
      if (kind === 'climate' || kind === 'nonProliferation') return 0.4;
      if (kind === 'recognition') return -0.2;
      return 0.1;
  }
}

// ---------------------------------------------------------------------------
// Internal — AI proposals
// ---------------------------------------------------------------------------

function stepAiProposals(state: GameState, scenario: Scenario, rng: Rng): GameState {
  if (!state.unResolutions) return state;
  const permanents = scenario.unCouncilMembers ?? [];
  if (permanents.length === 0) return state;
  // Don't spam: if there are already ≥3 active resolutions, suppress AI proposals.
  const active = state.unResolutions.filter((r) => r.status === 'voting').length;
  if (active >= 3) return state;

  let next = state;
  for (const id of permanents) {
    if (id === state.playerCountryId) continue;
    const country = state.countries[id];
    if (!country?.aiPersonality) continue;
    if (country.economy.gdp < AI_PROPOSAL_MIN_GDP) continue;
    if (rng.next() >= AI_PROPOSAL_CHANCE_PER_TICK) continue;
    // Pick a templated proposal type. We prefer climate/humanitarian — the
    // "soft" resolutions — for non-aggressive archetypes; sanctions/condemnation
    // for the aggressive ones, against an existing rival.
    const tmpl = pickTemplateForAi(country, scenario, next, rng);
    if (!tmpl) continue;
    next = openResolutionFromTemplate(next, tmpl, id);
  }
  return next;
}

function pickTemplateForAi(
  proposer: Country,
  scenario: Scenario,
  _state: GameState,
  _rng: Rng,
): UNResolutionTemplate | null {
  const map = scenario.unTriggerMap;
  if (!map) return null;
  const arch = proposer.aiPersonality?.archetype;
  // Prefer specific keys per archetype; fall back to any available.
  const order: ActionTriggerKey[] = (() => {
    if (arch === 'pacifist_trader') return ['climatePeriodic', 'tradeDealLowGdp', 'highWorldTension'];
    if (arch === 'regional_bully') return ['sanctionsImposed', 'declareWar', 'highWorldTension'];
    if (arch === 'superpower') return ['climatePeriodic', 'highWorldTension', 'sanctionsImposed'];
    return ['climatePeriodic', 'highWorldTension', 'tradeDealLowGdp'];
  })();
  for (const key of order) {
    const t = map[key];
    if (t) return t;
  }
  // Fall back to ANY entry in the map.
  const values = Object.values(map);
  return values.length > 0 ? (values[0] ?? null) : null;
}

function pickProposer(
  state: GameState,
  scenario: Scenario,
  exclude?: CountryId,
): CountryId | null {
  const permanents = scenario.unCouncilMembers ?? [];
  // First try: an alive permanent member that's not the actor.
  for (const id of permanents) {
    if (id === exclude) continue;
    const c = state.countries[id];
    if (c && c.economy.treasury >= 0) return id;
  }
  // Else fallback: any country other than the excluded one.
  for (const id of Object.keys(state.countries)) {
    if (id !== exclude) return id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Effects — applier
// ---------------------------------------------------------------------------

/**
 * Module-level set tracking `(resolutionTitleKey, effect.type)` pairs we've
 * already warned about. Prevents log spam when the same unsupported effect
 * fires every tick (e.g. a scenario template authored before the engine
 * knows how to handle a given effect type). The warning text includes the
 * resolution's titleKey so devs can locate the offending template quickly.
 */
const warnedUnsupportedEffects = new Set<string>();

function warnOnceUnsupported(resolution: UNResolution, effectType: string): void {
  const key = `${resolution.titleKey}::${effectType}`;
  if (warnedUnsupportedEffects.has(key)) return;
  warnedUnsupportedEffects.add(key);
  console.warn(
    `[un] dropped unsupported effect '${effectType}' from resolution '${resolution.titleKey}' (${resolution.kind}); ` +
      'fix the template or extend applyEventEffects to handle it.',
  );
}

function warnOnceUnsupportedStat(resolution: UNResolution, stat: string): void {
  const key = `${resolution.titleKey}::modifyStat::${stat}`;
  if (warnedUnsupportedEffects.has(key)) return;
  warnedUnsupportedEffects.add(key);
  console.warn(
    `[un] dropped unsupported stat '${stat}' (modifyStat) from resolution '${resolution.titleKey}' (${resolution.kind}); ` +
      'fix the template or extend applyStatPatch to handle it.',
  );
}

/**
 * Test-only helper: clears the warn-once dedup set so unit tests can assert
 * the warning fires on the first drop. Engine code never calls this.
 */
export function _resetUnsupportedEffectWarnings(): void {
  warnedUnsupportedEffects.clear();
}

function applyEventEffects(
  state: GameState,
  effects: readonly EventEffect[],
  resolution: UNResolution,
): GameState {
  let next = state;
  for (const e of effects) {
    switch (e.type) {
      case 'modifyStat': {
        // Resolve target: 'player' → playerCountryId; specific id → that country.
        let targetId: CountryId | null = null;
        if (e.target === 'player') targetId = state.playerCountryId;
        else if (typeof e.target === 'string') {
          // If the literal id 'target' is used, route to the resolution target.
          if (e.target === 'target' && resolution.targetCountryId) {
            targetId = resolution.targetCountryId;
          } else {
            targetId = e.target;
          }
        }
        if (!targetId) continue;
        // worldTension is global — apply directly without needing the country.
        if (e.stat === 'worldTension') {
          next = applyStatPatch(next, null, e.stat, e.delta, resolution);
          continue;
        }
        const country = next.countries[targetId];
        if (!country) continue;
        next = applyStatPatch(next, country, e.stat, e.delta, resolution);
        break;
      }
      case 'shiftAttitude': {
        // Shift relation attitude between the resolution's proposer and the
        // declared `with` country. Symmetric, signed, clamped to [-100,+100].
        const a = resolution.proposerCountryId;
        const b = e.with;
        if (a === b) continue;
        if (!next.countries[a] || !next.countries[b]) continue;
        const ensured = ensureRelation(next, a, b);
        const newAttitude = clamp(ensured.relation.attitude + e.delta, -100, 100);
        next = withRelation(ensured.state, {
          ...ensured.relation,
          attitude: newAttitude,
        });
        break;
      }
      case 'startResearch': {
        // Set science.activeResearch on the target country. No-op if the
        // country is already researching something — we don't want to
        // interrupt an in-progress effort.
        const country = next.countries[e.target];
        if (!country) continue;
        if (country.science.activeResearch !== null) continue;
        const updated: Country = {
          ...country,
          science: { ...country.science, activeResearch: e.techId },
        };
        next = {
          ...next,
          countries: { ...next.countries, [country.id]: updated },
        };
        break;
      }
      case 'spawnSpy': {
        // Skipped intentionally — needs design decisions (op duration, success
        // probability, payload defaults). Warn so authors notice.
        warnOnceUnsupported(resolution, e.type);
        break;
      }
      default: {
        // Forward-compat: unknown effect types are warned but never crash.
        const unknown = e as { type: string };
        warnOnceUnsupported(resolution, unknown.type);
        break;
      }
    }
  }
  return next;
}

function applyStatPatch(
  state: GameState,
  country: Country | null,
  stat: string,
  delta: number,
  resolution: UNResolution,
): GameState {
  // worldTension is the only global stat; routed in by applyEventEffects with
  // country === null. All other stats require a country.
  if (stat === 'worldTension') {
    return { ...state, worldTension: clamp(state.worldTension + delta, 0, 100) };
  }
  if (!country) return state;
  let updated: Country = country;
  switch (stat) {
    case 'popularity':
      updated = {
        ...country,
        politics: {
          ...country.politics,
          popularity: clamp(country.politics.popularity + delta, 0, 100),
        },
      };
      break;
    case 'treasury':
      updated = {
        ...country,
        economy: { ...country.economy, treasury: country.economy.treasury + delta },
      };
      break;
    case 'gdp':
      updated = {
        ...country,
        economy: { ...country.economy, gdp: Math.max(0, country.economy.gdp + delta) },
      };
      break;
    case 'armySize':
      updated = {
        ...country,
        military: {
          ...country.military,
          armySize: Math.max(0, country.military.armySize + delta),
        },
      };
      break;
    case 'doctrineLevel':
      updated = {
        ...country,
        military: {
          ...country.military,
          doctrineLevel: clamp(country.military.doctrineLevel + delta, 0, 1),
        },
      };
      break;
    case 'taxRate':
      updated = {
        ...country,
        economy: {
          ...country.economy,
          taxRate: clamp(country.economy.taxRate + delta, 0, 100),
        },
      };
      break;
    case 'spyCount':
      updated = {
        ...country,
        intelligence: {
          ...country.intelligence,
          spyCount: Math.max(0, country.intelligence.spyCount + delta),
        },
      };
      break;
    default:
      warnOnceUnsupportedStat(resolution, stat);
      return state;
  }
  return { ...state, countries: { ...state.countries, [country.id]: updated } };
}

function appendResolution(state: GameState, r: UNResolution): GameState {
  if (!state.unResolutions) return state;
  const next = [...state.unResolutions, r];
  return { ...state, unResolutions: trimResolutions(next) };
}

function trimResolutions(list: UNResolution[]): UNResolution[] {
  if (list.length <= UN_RING_SIZE) return list;
  // Keep all 'voting' entries + most recent closed up to ring size.
  const voting = list.filter((r) => r.status === 'voting');
  const closed = list.filter((r) => r.status !== 'voting');
  const room = UN_RING_SIZE - voting.length;
  const recentClosed = room > 0 ? closed.slice(-room) : [];
  return [...voting, ...recentClosed];
}

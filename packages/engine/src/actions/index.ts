// Action dispatcher and "what's currently legal?" enumerator.
// `applyAction` is the engine's public entry point for player & AI moves.
// It is pure: same inputs → same outputs, never mutates `state`.

import type {
  Action,
  ApplyActionResult,
  CountryId,
  DifficultyTuning,
  DiplomacyKind,
  FactionId,
  GameState,
  InvestTarget,
  Scenario,
  TechDefinition,
} from '../types.js';

import { applyDeployArmy, isDeployAllowed } from './deployArmy.js';
import { applyDeploySpy, computeSpyProbabilities } from './deploySpy.js';
import { applyDiplomacy, isDiplomacyAllowed } from './diplomacy.js';
import { applyInvest } from './invest.js';
import { applyPlacateFaction, PLACATE_COST } from './placateFaction.js';
import { applySetTaxRate } from './setTaxRate.js';
import { applyStartResearch } from './startResearch.js';
import { applyProposeUNResolution } from './proposeUNResolution.js';
import { applyVoteUN } from './voteUN.js';
import { applyJoinBloc } from './joinBloc.js';
import { applyLeaveBloc } from './leaveBloc.js';
import { applyAcknowledgeEraTransition } from './acknowledgeEraTransition.js';
import { applyLaunchTactical } from './launchTactical.js';
import { applyLaunchStrategic } from './launchStrategic.js';
import { applyDismantleNuclear } from './dismantleNuclear.js';
import { ensureRelation } from './helpers.js';
import { maybeTriggerFromAction } from '../un/index.js';

export {
  applyDeployArmy,
  applyDeploySpy,
  applyDiplomacy,
  applyInvest,
  applyPlacateFaction,
  applySetTaxRate,
  applyStartResearch,
  applyProposeUNResolution,
  applyVoteUN,
  applyJoinBloc,
  applyLeaveBloc,
  applyAcknowledgeEraTransition,
  applyLaunchTactical,
  applyLaunchStrategic,
  applyDismantleNuclear,
  computeSpyProbabilities,
  isDeployAllowed,
  isDiplomacyAllowed,
};

/**
 * Apply an action attributed to `countryId`. For player moves, callers pass
 * `state.playerCountryId`; the AI module passes the AI country's id.
 *
 * `techCatalog` is required for `startResearch`. If omitted, startResearch will
 * fail with a 'errors.research.techNotFound' since we have no catalog to check.
 *
 * `scenario` is consulted by Phase 3 actions for permanent-member gating and
 * (when wired) UN trigger maps. Omit when callers don't have it (legacy
 * Phase 1/2 callers); the Phase 3 actions degrade gracefully.
 */
export function applyAction(
  state: GameState,
  action: Action,
  countryId?: CountryId,
  techCatalog: readonly TechDefinition[] = [],
  difficulty?: DifficultyTuning,
  scenario?: Scenario,
): ApplyActionResult {
  const actor = countryId ?? state.playerCountryId;
  let result: ApplyActionResult;
  switch (action.type) {
    case 'invest':
      result = applyInvest(state, action, actor);
      break;
    case 'deploySpy':
      result = applyDeploySpy(state, action, actor, difficulty);
      break;
    case 'startResearch':
      result = applyStartResearch(state, action, actor, techCatalog);
      break;
    case 'setTaxRate':
      result = applySetTaxRate(state, action, actor);
      break;
    case 'diplomacy':
      result = applyDiplomacy(state, action, actor);
      break;
    case 'deployArmy':
      result = applyDeployArmy(state, action, actor);
      break;
    case 'placateFaction':
      result = applyPlacateFaction(state, action, actor);
      break;
    case 'proposeUNResolution':
      result = applyProposeUNResolution(state, action, actor, scenario);
      break;
    case 'voteUN':
      result = applyVoteUN(state, action, actor, scenario);
      break;
    case 'joinBloc':
      result = applyJoinBloc(state, action, actor);
      break;
    case 'leaveBloc':
      result = applyLeaveBloc(state, action, actor);
      break;
    case 'acknowledgeEraTransition':
      result = applyAcknowledgeEraTransition(state, action, actor);
      break;
    // Phase 3 Wave 10: nuclear actions.
    case 'launchTactical':
      result = applyLaunchTactical(state, action, actor, scenario);
      break;
    case 'launchStrategic':
      result = applyLaunchStrategic(state, action, actor, scenario);
      break;
    case 'dismantleNuclear':
      result = applyDismantleNuclear(state, action, actor);
      break;
  }
  // Phase 3: contextual UN triggers via scenario.unTriggerMap (Q2). Wire after
  // a successful action so reducers stay focused on their state slice. The
  // launchTactical / launchStrategic reducers already emit their own
  // condemnation resolutions directly (with stronger semantics — the strike
  // is the proposer context), so we skip them here to avoid double-firing.
  if (
    scenario &&
    result.errors.length === 0 &&
    action.type !== 'launchTactical' &&
    action.type !== 'launchStrategic'
  ) {
    const triggered = maybeTriggerFromAction(result.state, scenario, action, actor);
    if (triggered !== result.state) {
      result = { state: triggered, errors: result.errors };
    }
  }
  return result;
}

const INVEST_TARGETS: readonly InvestTarget[] = [
  'economy',
  'research',
  'military',
  'intel',
  'infra',
];
const DIPLOMACY_KINDS: readonly DiplomacyKind[] = [
  'proposeAlliance',
  'breakAlliance',
  'imposeSanction',
  'liftSanction',
  'tradeDeal',
  'declareWar',
  'sueForPeace',
];
const FACTION_IDS: readonly FactionId[] = [
  'army',
  'business',
  'religious',
  'populist',
  'reformist',
];

/**
 * Returns a representative list of legal actions for the given country.
 * Used by the AI as its action menu and by the UI to disable buttons.
 *
 * For continuous-amount actions (invest, deployArmy) we emit a small set of
 * canonical sized variants rather than the (uncountable) full space.
 */
export function getAvailableActions(
  state: GameState,
  countryId: CountryId,
  techCatalog: readonly TechDefinition[] = [],
): Action[] {
  const country = state.countries[countryId];
  if (!country) return [];
  const actions: Action[] = [];

  // Invest: small / medium / large bins, only those affordable.
  const treasury = country.economy.treasury;
  const bins = [
    Math.min(treasury, 100_000_000),
    Math.min(treasury, 500_000_000),
    Math.min(treasury, 2_000_000_000),
  ].filter((a) => a >= 50_000_000);
  for (const target of INVEST_TARGETS) {
    for (const amount of bins) {
      actions.push({ type: 'invest', target, amount });
    }
  }

  // Research: every tech not completed and whose prereqs are met, only if idle.
  if (country.science.activeResearch === null) {
    for (const tech of techCatalog) {
      if (country.science.completedTechs.includes(tech.id)) continue;
      const prereqOk = tech.prereqs.every((p) => country.science.completedTechs.includes(p));
      if (!prereqOk) continue;
      actions.push({ type: 'startResearch', techId: tech.id });
    }
  }

  // Tax rate: a few discrete options.
  for (const rate of [10, 20, 30, 40, 50] as const) {
    if (rate !== country.economy.taxRate) {
      actions.push({ type: 'setTaxRate', rate });
    }
  }

  // Diplomacy: per other country, every allowed kind.
  for (const otherId of Object.keys(state.countries)) {
    if (otherId === countryId) continue;
    const ensured = ensureRelation(state, countryId, otherId);
    for (const kind of DIPLOMACY_KINDS) {
      if (isDiplomacyAllowed(ensured.relation, kind).ok) {
        actions.push({ type: 'diplomacy', target: otherId, kind });
      }
    }
  }

  // Spy: simple steal_tech / propaganda / sabotage(military) / destabilize per target,
  // only if at least one spy is available.
  if (country.intelligence.spyCount >= 1) {
    for (const otherId of Object.keys(state.countries)) {
      if (otherId === countryId) continue;
      const target = state.countries[otherId];
      if (!target) continue;
      // Steal a random known-completed tech of the target if any.
      const stealable = target.science.completedTechs.find(
        (t) => !country.science.completedTechs.includes(t),
      );
      if (stealable) {
        actions.push({
          type: 'deploySpy',
          op: {
            type: 'steal_tech',
            ownerCountryId: countryId,
            targetCountryId: otherId,
            payload: { kind: 'steal_tech', techId: stealable },
            durationTicks: 8,
            successProbability: 0.5,
            detectionRisk: 0.25,
          },
        });
      }
      actions.push({
        type: 'deploySpy',
        op: {
          type: 'propaganda',
          ownerCountryId: countryId,
          targetCountryId: otherId,
          payload: { kind: 'propaganda', targetFaction: null },
          durationTicks: 6,
          successProbability: 0.65,
          detectionRisk: 0.2,
        },
      });
      actions.push({
        type: 'deploySpy',
        op: {
          type: 'sabotage',
          ownerCountryId: countryId,
          targetCountryId: otherId,
          payload: { kind: 'sabotage', targetSector: 'military' },
          durationTicks: 6,
          successProbability: 0.55,
          detectionRisk: 0.35,
        },
      });
    }
  }

  // Army deploy: into own region or any region we have legal access to (war or alliance
  // with the territorial host). This keeps the AI from offering itself the option to
  // walk into a peaceful neighbour's region — that would now be rejected anyway.
  if (country.military.armySize > 0) {
    const ownRegion = country.regionId;
    const candidates = new Set<string>([ownRegion]);
    for (const d of country.military.deployedUnits) candidates.add(d.regionId);
    // Also offer deployments into enemies' regions (so the AI can actually project
    // force after declaring war), without allowing peaceful trespass.
    for (const other of Object.values(state.countries)) {
      if (other.id === countryId) continue;
      candidates.add(other.regionId);
    }
    for (const r of candidates) {
      if (!isDeployAllowed(state, countryId, r).ok) continue;
      const units = Math.max(1, Math.floor(country.military.armySize / 2));
      actions.push({ type: 'deployArmy', target: r, units });
    }
  }

  // Placate factions only if we can afford it.
  if (country.economy.treasury >= PLACATE_COST) {
    for (const fid of FACTION_IDS) {
      actions.push({ type: 'placateFaction', factionId: fid });
    }
  }

  // Phase 3: bloc actions only when blocs are in the game state.
  if (state.blocs) {
    // joinBloc: can join any bloc the country is not already in.
    for (const id of Object.keys(state.blocs)) {
      const blocId = id as keyof typeof state.blocs;
      if (country.blocId === blocId) continue;
      actions.push({ type: 'joinBloc', blocId });
    }
    // leaveBloc: only if we're currently in one.
    if (country.blocId) actions.push({ type: 'leaveBloc' });
  }

  // Phase 3: UN voting on every active resolution we haven't voted on.
  if (state.unResolutions) {
    for (const r of state.unResolutions) {
      if (r.status !== 'voting') continue;
      if (r.votes[countryId] !== undefined) continue;
      actions.push({ type: 'voteUN', resolutionId: r.id, vote: 'yes' });
      actions.push({ type: 'voteUN', resolutionId: r.id, vote: 'no' });
      actions.push({ type: 'voteUN', resolutionId: r.id, vote: 'abstain' });
    }
  }

  // Phase 3 Wave 10: nuclear actions only enumerated when the country has an
  // arsenal. Tactical strikes require an enemy region (any region of a
  // country we're at war with). Strategic strikes require a country we're at
  // war with that exists. Dismantling requires at least one warhead.
  if (country.nuclear && country.nuclear.warheadCount >= 1) {
    // Compose enemy ids list once.
    const enemyIds: string[] = [];
    for (const rel of Object.values(state.relations)) {
      if (!rel.atWar) continue;
      if (rel.countryA === countryId) enemyIds.push(rel.countryB);
      else if (rel.countryB === countryId) enemyIds.push(rel.countryA);
    }
    for (const enemyId of enemyIds) {
      const enemy = state.countries[enemyId];
      if (!enemy) continue;
      actions.push({ type: 'launchTactical', targetRegionId: enemy.regionId });
      actions.push({ type: 'launchStrategic', targetCountryId: enemyId });
    }
    // Dismantle one warhead (always offered if there's at least one).
    actions.push({ type: 'dismantleNuclear', count: 1 });
  }

  return actions;
}

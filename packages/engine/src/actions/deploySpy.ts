// Reducer for the 'deploySpy' action. Creates an active SpyOperation.

import { createRng } from '../rng.js';
import type {
  Action,
  ApplyActionResult,
  Country,
  CountryId,
  GameState,
  IntelLevel,
  SpyOperation,
  SpyOperationId,
} from '../types.js';
import { withCountry } from './helpers.js';

export type DeploySpyAction = Extract<Action, { type: 'deploySpy' }>;

const INTEL_LEVEL_BONUS: Record<IntelLevel, number> = {
  none: 0,
  rumors: 0.05,
  partial: 0.15,
  full: 0.25,
};

const SPY_TYPE_BASE_SUCCESS: Record<SpyOperation['type'], number> = {
  steal_tech: 0.5,
  sabotage: 0.55,
  propaganda: 0.65,
  destabilize: 0.4,
  assassinate: 0.3,
};

const SPY_TYPE_BASE_DETECTION: Record<SpyOperation['type'], number> = {
  steal_tech: 0.25,
  sabotage: 0.35,
  propaganda: 0.2,
  destabilize: 0.4,
  assassinate: 0.55,
};

/** Compute success/detection for an op based on owner intel & target counter-intel. */
export function computeSpyProbabilities(
  owner: Country,
  target: Country,
  type: SpyOperation['type'],
): { successProbability: number; detectionRisk: number } {
  const known = owner.intelligence.knownIntel[target.id] ?? 'none';
  const intelBonus = INTEL_LEVEL_BONUS[known];
  const baseSuccess = SPY_TYPE_BASE_SUCCESS[type];
  const baseDetect = SPY_TYPE_BASE_DETECTION[type];
  const success = clampProb(baseSuccess + intelBonus - target.intelligence.counterIntelLevel * 0.4);
  const detect = clampProb(baseDetect + target.intelligence.counterIntelLevel * 0.4 - intelBonus);
  return { successProbability: success, detectionRisk: detect };
}

function clampProb(p: number): number {
  if (!Number.isFinite(p)) return 0;
  if (p < 0.01) return 0.01;
  if (p > 0.99) return 0.99;
  return p;
}

function nextSpyOpId(state: GameState): SpyOperationId {
  // Deterministic id derived from seed + tick + counter so we don't break determinism.
  const rng = createRng(`${state.rngSeed}::spyId::${state.tick}::${state.spyOperations.length}`);
  return `spy_${state.tick}_${state.spyOperations.length}_${rng.nextInt(1_000_000)}`;
}

export function applyDeploySpy(
  state: GameState,
  action: DeploySpyAction,
  countryId: CountryId,
): ApplyActionResult {
  const errors: string[] = [];
  const op = action.op;
  if (op.ownerCountryId !== countryId) {
    errors.push('errors.spy.ownerMismatch');
    return { state, errors };
  }
  const owner = state.countries[op.ownerCountryId];
  const target = state.countries[op.targetCountryId];
  if (!owner) {
    errors.push('errors.country.notFound');
    return { state, errors };
  }
  if (!target) {
    errors.push('errors.spy.targetNotFound');
    return { state, errors };
  }
  if (owner.id === target.id) {
    errors.push('errors.spy.selfTarget');
    return { state, errors };
  }
  if (owner.intelligence.spyCount < 1) {
    errors.push('errors.spy.noSpies');
    return { state, errors };
  }
  if (op.durationTicks <= 0) {
    errors.push('errors.spy.invalidDuration');
    return { state, errors };
  }

  // Recompute probabilities even if caller pre-filled them, to keep them honest.
  const { successProbability, detectionRisk } = computeSpyProbabilities(owner, target, op.type);

  const newOp: SpyOperation = {
    id: nextSpyOpId(state),
    type: op.type,
    ownerCountryId: op.ownerCountryId,
    targetCountryId: op.targetCountryId,
    payload: op.payload,
    progressTicks: 0,
    durationTicks: op.durationTicks,
    successProbability,
    detectionRisk,
    status: 'active',
    startedAtTick: state.tick,
  };

  const updatedOwner: Country = {
    ...owner,
    intelligence: {
      ...owner.intelligence,
      spyCount: owner.intelligence.spyCount - 1,
    },
  };
  const next: GameState = {
    ...withCountry(state, updatedOwner),
    spyOperations: [...state.spyOperations, newOp],
  };
  return { state: next, errors: [] };
}

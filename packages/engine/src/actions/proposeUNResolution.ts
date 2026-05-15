// Reducer for the 'proposeUNResolution' action. Player or AI initiates a
// new UN resolution outside of any contextual trigger map. This requires the
// scenario to have UN active (state.unResolutions !== undefined).

import type {
  Action,
  ApplyActionResult,
  CountryId,
  GameState,
  Scenario,
  UNResolution,
  UNResolutionKind,
} from '../types.js';

export type ProposeUNResolutionAction = Extract<Action, { type: 'proposeUNResolution' }>;

/** Resolution kinds that any country may propose without being a permanent member. */
const SOFT_KINDS: ReadonlySet<UNResolutionKind> = new Set<UNResolutionKind>([
  'humanitarian',
  'climate',
]);

export function applyProposeUNResolution(
  state: GameState,
  action: ProposeUNResolutionAction,
  countryId: CountryId,
  scenario?: Scenario,
): ApplyActionResult {
  if (!state.unResolutions) {
    return { state, errors: ['errors.un.notAvailable'] };
  }
  if (!state.countries[countryId]) {
    return { state, errors: ['errors.country.notFound'] };
  }
  // Validate target if provided (country target must exist).
  if (action.targetCountryId && !state.countries[action.targetCountryId]) {
    return { state, errors: ['errors.un.invalidTarget'] };
  }
  if (action.targetCountryId === countryId) {
    return { state, errors: ['errors.un.selfTarget'] };
  }
  // Permanent-member gating for "hard" kinds. Without scenario context we
  // can't enforce this — fall back to allow (graceful degradation).
  if (scenario) {
    const permanents = scenario.unCouncilMembers ?? [];
    if (!permanents.includes(countryId) && !SOFT_KINDS.has(action.kind)) {
      return { state, errors: ['errors.un.notPermanent'] };
    }
  }
  const id = `un-${state.tick}-${state.unResolutions.length}-${action.kind}`;
  const resolution: UNResolution = {
    id,
    kind: action.kind,
    proposerCountryId: countryId,
    proposedAtTick: state.tick,
    votingClosesAtTick: state.tick + 4,
    effects: { onPass: [], onFail: [] },
    votes: { [countryId]: 'yes' },
    status: 'voting',
    titleKey: `un.kind.${action.kind}.title`,
    descriptionKey: `un.kind.${action.kind}.desc`,
    ...(action.targetCountryId !== undefined ? { targetCountryId: action.targetCountryId } : {}),
    ...(action.targetRegionId !== undefined ? { targetRegionId: action.targetRegionId } : {}),
  };
  return {
    state: { ...state, unResolutions: [...state.unResolutions, resolution] },
    errors: [],
  };
}

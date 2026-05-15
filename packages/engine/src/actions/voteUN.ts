// Reducer for the 'voteUN' action. Records a single country's vote on an
// active resolution. Errors if the resolution is unknown, already closed, or
// the country has already voted (no overwrites — players are locked in).

import type {
  Action,
  ApplyActionResult,
  CountryId,
  GameState,
  Scenario,
} from '../types.js';

export type VoteUNAction = Extract<Action, { type: 'voteUN' }>;

export function applyVoteUN(
  state: GameState,
  action: VoteUNAction,
  countryId: CountryId,
  scenario?: Scenario,
): ApplyActionResult {
  if (!state.unResolutions) {
    return { state, errors: ['errors.un.notAvailable'] };
  }
  const idx = state.unResolutions.findIndex((r) => r.id === action.resolutionId);
  if (idx < 0) {
    return { state, errors: ['errors.un.resolutionNotFound'] };
  }
  const resolution = state.unResolutions[idx];
  if (!resolution) {
    return { state, errors: ['errors.un.resolutionNotFound'] };
  }
  if (resolution.status !== 'voting') {
    return { state, errors: ['errors.un.alreadyClosed'] };
  }
  if (state.tick >= resolution.votingClosesAtTick) {
    return { state, errors: ['errors.un.alreadyClosed'] };
  }
  if (resolution.votes[countryId] !== undefined) {
    return { state, errors: ['errors.un.alreadyVoted'] };
  }
  // Veto only legal for permanent council members.
  if (action.vote === 'veto') {
    const permanents = scenario?.unCouncilMembers ?? [];
    if (!permanents.includes(countryId)) {
      return { state, errors: ['errors.un.vetoNotPermitted'] };
    }
  }
  const updatedResolution = {
    ...resolution,
    votes: { ...resolution.votes, [countryId]: action.vote },
  };
  const next = [...state.unResolutions];
  next[idx] = updatedResolution;
  return { state: { ...state, unResolutions: next }, errors: [] };
}

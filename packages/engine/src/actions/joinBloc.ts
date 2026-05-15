// Reducer for the 'joinBloc' action. Adds the actor to the requested bloc.
// Wave 9 simplification: joining is immediate (no member-vote modal). The
// bloc-vote workflow described in the spec is a Wave 10+ refinement; for now
// the reducer enforces only basic structural validity.

import type {
  Action,
  ApplyActionResult,
  Bloc,
  CountryId,
  GameState,
} from '../types.js';

export type JoinBlocAction = Extract<Action, { type: 'joinBloc' }>;

export function applyJoinBloc(
  state: GameState,
  action: JoinBlocAction,
  countryId: CountryId,
): ApplyActionResult {
  if (!state.blocs) {
    return { state, errors: ['errors.bloc.notAvailable'] };
  }
  const country = state.countries[countryId];
  if (!country) {
    return { state, errors: ['errors.country.notFound'] };
  }
  const targetBloc = state.blocs[action.blocId];
  if (!targetBloc) {
    return { state, errors: ['errors.bloc.notFound'] };
  }
  if (country.blocId === action.blocId) {
    return { state, errors: ['errors.bloc.alreadyMember'] };
  }
  // Strip from the previous bloc roster (if any), then add to the new one.
  const blocs: Record<string, Bloc> = { ...state.blocs };
  if (country.blocId) {
    const prev = blocs[country.blocId];
    if (prev) {
      blocs[country.blocId] = {
        ...prev,
        memberCountryIds: prev.memberCountryIds.filter((m) => m !== countryId),
      };
    }
  }
  if (!targetBloc.memberCountryIds.includes(countryId)) {
    blocs[action.blocId] = {
      ...targetBloc,
      memberCountryIds: [...targetBloc.memberCountryIds, countryId],
    };
  }
  const updatedCountry = { ...country, blocId: action.blocId };
  return {
    state: {
      ...state,
      blocs: blocs as typeof state.blocs,
      countries: { ...state.countries, [countryId]: updatedCountry },
    },
    errors: [],
  };
}

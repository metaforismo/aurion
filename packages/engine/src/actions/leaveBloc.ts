// Reducer for the 'leaveBloc' action. Removes the actor from any bloc they
// currently belong to. Errors if the country is unaligned (not in any bloc).

import type {
  Action,
  ApplyActionResult,
  Bloc,
  CountryId,
  GameState,
} from '../types.js';

export type LeaveBlocAction = Extract<Action, { type: 'leaveBloc' }>;

export function applyLeaveBloc(
  state: GameState,
  _action: LeaveBlocAction,
  countryId: CountryId,
): ApplyActionResult {
  if (!state.blocs) {
    return { state, errors: ['errors.bloc.notAvailable'] };
  }
  const country = state.countries[countryId];
  if (!country) {
    return { state, errors: ['errors.country.notFound'] };
  }
  if (!country.blocId) {
    return { state, errors: ['errors.bloc.notMember'] };
  }
  const currentBloc = state.blocs[country.blocId];
  if (!currentBloc) {
    // Country has stale blocId pointer to a bloc that no longer exists. We
    // gracefully clear the field rather than throw.
    const { blocId: _omit, ...rest } = country;
    void _omit;
    return {
      state: {
        ...state,
        countries: { ...state.countries, [countryId]: rest },
      },
      errors: [],
    };
  }
  const blocs: Record<string, Bloc> = { ...state.blocs };
  blocs[country.blocId] = {
    ...currentBloc,
    memberCountryIds: currentBloc.memberCountryIds.filter((m) => m !== countryId),
  };
  const { blocId: _omit, ...rest } = country;
  void _omit;
  return {
    state: {
      ...state,
      blocs: blocs as typeof state.blocs,
      countries: { ...state.countries, [countryId]: rest },
    },
    errors: [],
  };
}

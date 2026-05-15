// Reducer for the 'acknowledgeEraTransition' action.
//
// The engine auto-fires era transitions during `tickEra` by setting
// `state.eraState.pendingTransition`. The UI displays an EraTransitionModal
// in response, then dispatches this action to clear the pending field so the
// game can resume.
//
// Errors:
//   - 'errors.era.notAvailable' — era system isn't active for this game
//     (gameMode !== 'era-paced' or scenario has no eras).
//   - 'errors.era.noTransition' — no transition is currently pending.

import type {
  Action,
  ApplyActionResult,
  CountryId,
  GameState,
} from '../types.js';
import { acknowledgeTransition } from '../era/index.js';

export type AcknowledgeEraTransitionAction = Extract<
  Action,
  { type: 'acknowledgeEraTransition' }
>;

export function applyAcknowledgeEraTransition(
  state: GameState,
  _action: AcknowledgeEraTransitionAction,
  _countryId: CountryId,
): ApplyActionResult {
  if (!state.eraState) {
    return { state, errors: ['errors.era.notAvailable'] };
  }
  if (state.eraState.pendingTransition === null) {
    return { state, errors: ['errors.era.noTransition'] };
  }
  return { state: acknowledgeTransition(state), errors: [] };
}

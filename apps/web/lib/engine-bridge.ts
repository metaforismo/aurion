// Thin synchronous re-export of the @aurion/engine API used by the web app.
// Kept as a single file so the rest of the app has one obvious place to look
// when the engine signatures change.

export {
  applyAction,
  checkWinLoss,
  createGame,
  decideAiAction,
  getAvailableActions,
  tick,
} from '@aurion/engine';

export type {
  Action,
  ApplyActionResult,
  CountryId,
  CreateGameOptions,
  EventDefinition,
  GameState,
  Scenario,
  TechDefinition,
  VictoryConditionId,
  VictoryRule,
  WinLossState,
} from '@aurion/engine';

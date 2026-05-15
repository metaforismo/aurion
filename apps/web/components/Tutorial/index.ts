// Public surface of the Tutorial cluster. Only TutorialOverlay is consumed by
// callers; everything else is an internal implementation detail.

export { TutorialOverlay, default } from './TutorialOverlay';
export { TutorialStep } from './TutorialStep';
export type { TutorialStepProps, TutorialStepPosition } from './TutorialStep';
export { useTutorialState } from './useTutorialState';
export type { TutorialState } from './useTutorialState';
export {
  TUTORIAL_STEPS,
  TUTORIAL_STEP_COUNT,
  type TutorialStep as TutorialStepDefinition,
  type TutorialAnchoredStep,
  type TutorialIntroStep,
  type TutorialOutroStep,
} from './tutorialSteps';

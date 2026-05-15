// Tutorial step catalogue. Each step is either:
//   - kind: 'intro' / 'outro' → rendered as a centred Modal.
//   - kind: 'anchored' → rendered as an anchored tooltip card pointing at a
//     DOM element. We resolve the anchor at runtime via `anchorSelector`.
//
// The selectors below intentionally avoid touching other Wave 7 components.
// The HUD, Map and Panels do not currently expose `data-tutorial="*"` hooks,
// so we lean on stable structural selectors that already exist in those
// components:
//
//   - HUD     → top `<header>` with `glass-surface` / sticky classes
//                (apps/web/components/Hud/Hud.tsx)
//   - MAP     → the wrapper `div[role="region"][aria-label*="Aurion"]` produced
//                by WorldMap (the i18n label is locale-dependent so we match
//                only the role attribute and tag).
//   - PANELS  → the left rail `<aside aria-label="…">` rendered by PanelTabs.
//   - SPEED   → the speed control `div[role="group"]` inside the HUD.
//
// If any of these selectors stops resolving (e.g. someone restructures the
// HUD), the tutorial gracefully falls back to a centred modal without an
// anchor — see TutorialOverlay's resolution logic.

export type TutorialStepBase = {
  /** Stable id, used for keys and analytics. */
  id: string;
  /** i18n key for the step title (under `tutorial.*`). */
  titleKey: string;
  /** i18n key for the step body. */
  bodyKey: string;
};

export type TutorialIntroStep = TutorialStepBase & {
  kind: 'intro';
};

export type TutorialOutroStep = TutorialStepBase & {
  kind: 'outro';
};

export type TutorialAnchoredStep = TutorialStepBase & {
  kind: 'anchored';
  /**
   * CSS selector resolved at render time on the document. We use
   * `document.querySelector` so the tooltip can re-position when the layout
   * settles. Any selector that uniquely identifies the desired element works;
   * see the file header comment for the active picks.
   */
  anchorSelector: string;
  /**
   * Where to place the tooltip relative to the anchor's bounding box.
   * Used by TutorialStep to position the arrow.
   */
  position: 'top' | 'bottom' | 'left' | 'right';
};

export type TutorialStep =
  | TutorialIntroStep
  | TutorialAnchoredStep
  | TutorialOutroStep;

/**
 * Six-step happy path. Order matters: TutorialOverlay walks them with the
 * Avanti / Indietro buttons.
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'intro',
    kind: 'intro',
    titleKey: 'tutorial.title',
    bodyKey: 'tutorial.intro.body',
  },
  {
    id: 'hud',
    kind: 'anchored',
    titleKey: 'tutorial.steps.hud.title',
    bodyKey: 'tutorial.steps.hud.body',
    // Top sticky header rendered by Hud.tsx. Falls through to the first
    // <header> on the page if the class changes.
    anchorSelector: 'header.glass-surface, header[class*="sticky"], header',
    position: 'bottom',
  },
  {
    id: 'map',
    kind: 'anchored',
    titleKey: 'tutorial.steps.map.title',
    bodyKey: 'tutorial.steps.map.body',
    // WorldMap wrapper: a region with the world-map aria-label. We match by
    // role + the SVG it contains so the selector keeps working across locales.
    anchorSelector: 'div[role="region"]:has(svg)',
    position: 'left',
  },
  {
    id: 'panels',
    kind: 'anchored',
    titleKey: 'tutorial.steps.panels.title',
    bodyKey: 'tutorial.steps.panels.body',
    // PanelTabs renders an <aside aria-label="…"> at the top of the left rail.
    anchorSelector: 'aside[aria-label]',
    position: 'right',
  },
  {
    id: 'speed',
    kind: 'anchored',
    titleKey: 'tutorial.steps.speed.title',
    bodyKey: 'tutorial.steps.speed.body',
    // SpeedControls wraps its buttons in a role="group" inside the HUD.
    anchorSelector: 'header div[role="group"]',
    position: 'bottom',
  },
  {
    id: 'outro',
    kind: 'outro',
    titleKey: 'tutorial.steps.outro.title',
    bodyKey: 'tutorial.steps.outro.body',
  },
];

export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length;

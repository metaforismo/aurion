// Aurion design-token bridge for TypeScript.
//
// This file is the single source of truth for "what colour does positive
// mean?" and "how long is a normal transition?" inside the React tree. The
// raw values live in `app/globals.css` as CSS custom properties; here we
// expose a typed surface so components don't sprinkle string literals.
//
// Conventions:
//   - `tone(...)` returns Tailwind utility *class strings*, not colours.
//   - `MOTION.*` returns CSS time strings (ms) safe to drop into a `style`
//     object or template literal.
//   - `RADIUS.*` and `ELEVATION.*` follow the same pattern as MOTION.
//   - `REGION_TOKEN[...]` returns the CSS variable reference for inline
//     SVG fills where a Tailwind class won't reach.
//
// Importantly, this module imports NOTHING from React/Next — it is a pure
// TS constants file so it can be tree-shaken into anywhere.

// ---------------------------------------------------------------------------
// Semantic tones
// ---------------------------------------------------------------------------

/** Semantic tone for deltas, statuses, and emphasis. */
export type Tone =
  | 'accent'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'muted';

/**
 * Mapping of tone → text colour utility class. Lets a component announce
 * "this number is a loss" without re-deriving the colour every time.
 */
const TONE_TEXT: Readonly<Record<Tone, string>> = {
  accent: 'text-accent',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
  neutral: 'text-fg',
  muted: 'text-fg-muted',
};

/** Mapping of tone → background colour utility class. */
const TONE_BG: Readonly<Record<Tone, string>> = {
  accent: 'bg-accent/15',
  success: 'bg-success/15',
  danger: 'bg-danger/15',
  warning: 'bg-warning/15',
  info: 'bg-info/15',
  neutral: 'bg-surface-1',
  muted: 'bg-surface',
};

/** Mapping of tone → border colour utility class. */
const TONE_BORDER: Readonly<Record<Tone, string>> = {
  accent: 'border-accent/60',
  success: 'border-success/50',
  danger: 'border-danger/50',
  warning: 'border-warning/50',
  info: 'border-info/50',
  neutral: 'border-border',
  muted: 'border-border',
};

/** Returns the text-colour utility class for a tone. */
export function tone(t: Tone): string {
  return TONE_TEXT[t];
}

/**
 * Returns a `bg + border + text` chip-style class string for a tone.
 * Suitable for treaty badges, intel-level pills, faction satisfaction tags.
 */
export function toneChip(t: Tone): string {
  return `${TONE_BG[t]} ${TONE_BORDER[t]} ${TONE_TEXT[t]} border`;
}

/** Returns the bg utility class for a tone (e.g. progress bar fill). */
export function toneBg(t: Tone): string {
  return TONE_BG[t];
}

/** Returns the border utility class for a tone. */
export function toneBorder(t: Tone): string {
  return TONE_BORDER[t];
}

/**
 * Map a numeric delta (positive vs negative vs zero) to a tone. Used by
 * trend indicators where we don't want every call site to repeat the same
 * ternary.
 */
export function tonefromDelta(value: number): Tone {
  if (value > 0) return 'success';
  if (value < 0) return 'danger';
  return 'muted';
}

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

/**
 * Standard motion durations. Use the constants — never hand-pick a
 * milliseconds value at a call site. Values mirror the CSS custom
 * properties in globals.css.
 *
 *   - `fast`       = micro-feedback (button press, hover state).
 *   - `normal`     = default UI transition (panel expand, tab swap).
 *   - `slow`       = page-level transitions, modal enter/exit.
 *   - `cinematic`  = "set piece" moments (win/lose, score-tally reveals).
 */
export const MOTION: Readonly<{
  fast: '120ms';
  normal: '240ms';
  slow: '480ms';
  cinematic: '800ms';
}> = {
  fast: '120ms',
  normal: '240ms',
  slow: '480ms',
  cinematic: '800ms',
};

/** Default game easing — slight overshoot for satisfying clicks. */
export const EASING: Readonly<{
  game: 'cubic-bezier(0.2, 0.8, 0.2, 1)';
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)';
}> = {
  game: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
};

// ---------------------------------------------------------------------------
// Radius
// ---------------------------------------------------------------------------

/** Standard corner-radius scale (px strings safe for inline style). */
export const RADIUS: Readonly<{
  xs: '4px';
  sm: '6px';
  md: '8px';
  lg: '12px';
  xl: '16px';
  '2xl': '20px';
}> = {
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
};

// ---------------------------------------------------------------------------
// Elevation
// ---------------------------------------------------------------------------

/**
 * Box-shadow tokens that match the CSS variables. Use the Tailwind class
 * (`shadow-md`) when you can; reach for these strings for inline styles
 * (e.g. SVG filters, animated shadows).
 */
export const ELEVATION: Readonly<{
  xs: string;
  sm: string;
  md: string;
  lg: string;
  glowAccent: string;
}> = {
  xs: 'var(--shadow-xs)',
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  glowAccent: 'var(--shadow-glow-accent)',
};

// ---------------------------------------------------------------------------
// Region accents
// ---------------------------------------------------------------------------

/**
 * Region ids → CSS variable references. Use when an inline SVG attribute
 * needs the colour string (Tailwind utilities only reach `fill-*`/`stroke-*`
 * shorthands and not every consumer wants that).
 */
export const REGION_TOKEN: Readonly<Record<string, string>> = {
  borealis: 'var(--color-region-borealis)',
  auriana: 'var(--color-region-auriana)',
  oriana: 'var(--color-region-oriana)',
  meridia: 'var(--color-region-meridia)',
  sahel: 'var(--color-region-sahel)',
};

/** Returns the CSS var() reference for a region id, or undefined if unknown. */
export function regionColor(regionId: string): string | undefined {
  return REGION_TOKEN[regionId];
}

// ---------------------------------------------------------------------------
// Re-exports for ergonomic imports
// ---------------------------------------------------------------------------

export const THEME = {
  tone,
  toneChip,
  toneBg,
  toneBorder,
  tonefromDelta,
  MOTION,
  EASING,
  RADIUS,
  ELEVATION,
  REGION_TOKEN,
  regionColor,
} as const;

export type ThemeAPI = typeof THEME;

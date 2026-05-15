'use client';

// The overlay system is split in three halves:
//   1. <OverlayToggle/> — HTML radio group anchored top-right.
//   2. <AllianceEdges/> — SVG <line> network rendered on top of the map.
//   3. <BlocLegend/>    — HTML chip cluster anchored bottom-right, only
//      rendered when the 'blocs' overlay is active.
//
// Tension, intel and blocs are applied directly inside <WorldMap/> because
// they need to mutate region fills / nation rings / nation opacity, which is
// cheaper than rendering an extra SVG layer.

import type { ActiveBlocId, CountryId } from '@aurion/engine';

import { cn } from '../../lib/cn';

export type OverlayMode = 'none' | 'tension' | 'alliances' | 'intel' | 'blocs';

export const OVERLAY_MODES: readonly OverlayMode[] = [
  'none',
  'tension',
  'alliances',
  'intel',
  'blocs',
];

// ---------------------------------------------------------------------------
// Bloc colour mapping
// ---------------------------------------------------------------------------
//
// We deliberately reuse the existing `--color-region-*` tokens (and the
// `--color-fg-faint` neutral) instead of introducing new design tokens, so
// the bloc palette stays consistent with the rest of the map and doesn't
// require a globals.css change. A scenario-defined bloc colour could be
// surfaced later without breaking this default.
//
// The 'unaligned' sentinel covers countries whose `blocId` is undefined OR
// explicitly 'unaligned' — both render with the muted neutral.

/** Active bloc + 'unaligned' sentinel. Mirrors `BlocId` from the engine. */
export type BlocColorKey = ActiveBlocId | 'unaligned';

/** CSS variable references used to tint nation rings and region fills. */
export const BLOC_COLOR: Readonly<Record<BlocColorKey, string>> = {
  western: 'var(--color-region-borealis)',
  eastern: 'var(--color-region-meridia)',
  'non-aligned': 'var(--color-region-sahel)',
  unaligned: 'var(--color-fg-faint)',
};

/** Display order for the legend (left → right). Mirrors `ReputationBadges`. */
export const BLOC_LEGEND_ORDER: readonly BlocColorKey[] = [
  'western',
  'eastern',
  'non-aligned',
  'unaligned',
];

// ---------------------------------------------------------------------------
// Overlay toggle (radio group)
// ---------------------------------------------------------------------------

export type OverlayToggleProps = {
  mode: OverlayMode;
  onChange: (mode: OverlayMode) => void;
  labels: Record<OverlayMode, string>;
  groupLabel: string;
  /**
   * Optional per-mode disabled state. When a mode is disabled, the user
   * cannot select it and the radio renders as muted. Used by the 'blocs'
   * overlay when the active scenario does not declare a bloc roster.
   * Each disabled entry can also carry a tooltip string.
   */
  disabled?: Partial<Record<OverlayMode, { tooltip?: string }>>;
};

export function OverlayToggle(props: OverlayToggleProps) {
  return (
    <fieldset
      className={cn(
        'pointer-events-auto absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-lg border border-border-strong bg-surface-1/90 p-2 text-xs shadow-lg backdrop-blur-sm',
      )}
    >
      <legend className="px-1 text-[10px] uppercase tracking-wider text-fg-faint">
        {props.groupLabel}
      </legend>
      <div className="flex flex-wrap gap-1">
        {OVERLAY_MODES.map((m) => {
          const checked = props.mode === m;
          const disabledEntry = props.disabled?.[m];
          const isDisabled = disabledEntry !== undefined;
          return (
            <label
              key={m}
              title={isDisabled ? disabledEntry?.tooltip : undefined}
              className={cn(
                'rounded-md border px-2 py-1 font-mono text-[11px] transition-colors',
                isDisabled
                  ? 'cursor-not-allowed border-border bg-surface text-fg-faint opacity-60'
                  : 'cursor-pointer',
                !isDisabled && checked
                  ? 'border-accent bg-accent/20 text-accent'
                  : !isDisabled
                    ? 'border-border-strong bg-surface-1 text-fg-muted hover:border-border-strong'
                    : '',
              )}
            >
              <input
                type="radio"
                name="aurion-map-overlay"
                value={m}
                checked={checked}
                disabled={isDisabled}
                onChange={() => {
                  if (isDisabled) return;
                  props.onChange(m);
                }}
                className="sr-only"
              />
              {props.labels[m]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Bloc legend (chip cluster)
// ---------------------------------------------------------------------------

export type BlocLegendProps = {
  /** Localised label per legend entry. */
  labels: Record<BlocColorKey, string>;
};

/**
 * Tiny anchor-bottom-right chip cluster shown when the 'blocs' overlay is
 * active. Renders one chip per active bloc + a final muted chip for the
 * 'unaligned' sentinel so players can decode the map ring colours at a
 * glance. Pure presentational — no store subscription.
 */
export function BlocLegend({ labels }: BlocLegendProps) {
  return (
    <div
      className={cn(
        'pointer-events-auto absolute bottom-3 right-3 z-10 flex flex-wrap items-center gap-1.5 rounded-lg border border-border-strong bg-surface-1/90 p-2 text-[11px] shadow-lg backdrop-blur-sm',
      )}
      role="group"
      aria-label="bloc legend"
    >
      {BLOC_LEGEND_ORDER.map((key) => (
        <span
          key={key}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface/40 px-2 py-0.5 text-fg-muted"
        >
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: BLOC_COLOR[key] }}
          />
          <span>{labels[key]}</span>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alliance edges
// ---------------------------------------------------------------------------

export type AllianceEdge = {
  from: CountryId;
  to: CountryId;
  /** Group color (assigned by union-find on the alliance graph). */
  color: string;
  /** Pre-resolved start and end coordinates. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type AllianceEdgesProps = {
  edges: AllianceEdge[];
};

/** Render alliance bonds as soft glowing lines coloured by union-find group. */
export function AllianceEdges({ edges }: AllianceEdgesProps) {
  if (edges.length === 0) return null;
  return (
    <g aria-hidden pointerEvents="none" data-overlay="alliances">
      {edges.map((e, i) => (
        <g key={`${e.from}-${e.to}-${i}`}>
          {/* outer glow */}
          <line
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke={e.color}
            strokeOpacity={0.25}
            strokeWidth={6}
            strokeLinecap="round"
          />
          {/* core */}
          <line
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke={e.color}
            strokeOpacity={0.9}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
        </g>
      ))}
    </g>
  );
}

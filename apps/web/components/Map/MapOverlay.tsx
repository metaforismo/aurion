'use client';

// The overlay system is split in two halves:
//   1. <OverlayToggle/> — HTML radio group anchored top-right.
//   2. <AllianceEdges/> — SVG <line> network rendered on top of the map.
//
// Tension and intel are applied directly inside <WorldMap/> because they need
// to mutate region fills / nation opacity respectively, which is cheaper than
// rendering an extra SVG layer.

import type { CountryId } from '@aurion/engine';

import { cn } from '../../lib/cn';

export type OverlayMode = 'none' | 'tension' | 'alliances' | 'intel';

export const OVERLAY_MODES: readonly OverlayMode[] = [
  'none',
  'tension',
  'alliances',
  'intel',
];

// ---------------------------------------------------------------------------
// Overlay toggle (radio group)
// ---------------------------------------------------------------------------

export type OverlayToggleProps = {
  mode: OverlayMode;
  onChange: (mode: OverlayMode) => void;
  labels: Record<OverlayMode, string>;
  groupLabel: string;
};

export function OverlayToggle(props: OverlayToggleProps) {
  return (
    <fieldset
      className={cn(
        'pointer-events-auto absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-lg border border-slate-700 bg-slate-900/90 p-2 text-xs shadow-lg backdrop-blur-sm',
      )}
    >
      <legend className="px-1 text-[10px] uppercase tracking-wider text-slate-500">
        {props.groupLabel}
      </legend>
      <div className="flex flex-wrap gap-1">
        {OVERLAY_MODES.map((m) => {
          const checked = props.mode === m;
          return (
            <label
              key={m}
              className={cn(
                'cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors',
                checked
                  ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600',
              )}
            >
              <input
                type="radio"
                name="aurion-map-overlay"
                value={m}
                checked={checked}
                onChange={() => props.onChange(m)}
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

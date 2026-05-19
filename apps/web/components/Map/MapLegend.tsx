'use client';

// Editorial-style legend rail for the world map.
//
// One bottom-anchored row that hosts (a) the overlay-mode segmented toggle
// and (b) — only when the blocs overlay is active — the bloc colour key.
// The visual language is intentionally restrained: hairline borders, ink-on-
// paper typography, no glow / blur, single accent for the active state.

import { cn } from '../../lib/cn';

import {
  BLOC_COLOR,
  BLOC_LEGEND_ORDER,
  OVERLAY_MODES,
  type BlocColorKey,
  type OverlayMode,
} from './MapOverlay';

export type MapLegendProps = {
  mode: OverlayMode;
  onChange: (mode: OverlayMode) => void;
  labels: Record<OverlayMode, string>;
  groupLabel: string;
  /** Optional per-mode disabled state (e.g. scenario lacks bloc roster). */
  disabled?: Partial<Record<OverlayMode, { tooltip?: string }>>;
  /** Bloc-key labels — only consulted when `mode === 'blocs'`. */
  blocLabels: Record<BlocColorKey, string>;
};

export default function MapLegend(props: MapLegendProps) {
  const showBlocKey = props.mode === 'blocs';
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-3 bottom-3 z-10',
        'flex flex-wrap items-end justify-between gap-3',
      )}
    >
      <OverlayToggle
        mode={props.mode}
        onChange={props.onChange}
        labels={props.labels}
        groupLabel={props.groupLabel}
        disabled={props.disabled}
      />
      {showBlocKey ? <BlocKey labels={props.blocLabels} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlay toggle — segmented control
// ---------------------------------------------------------------------------

type OverlayToggleInternalProps = Pick<
  MapLegendProps,
  'mode' | 'onChange' | 'labels' | 'groupLabel' | 'disabled'
>;

function OverlayToggle(props: OverlayToggleInternalProps) {
  return (
    <fieldset
      className={cn(
        'pointer-events-auto flex items-center gap-3 border border-border bg-bg/85 px-3 py-1.5',
        'rounded-sm font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint backdrop-blur-sm',
      )}
    >
      <legend className="px-1 text-fg-faint">{props.groupLabel}</legend>
      <div className="flex items-center gap-1">
        {OVERLAY_MODES.map((m) => {
          const checked = props.mode === m;
          const disabledEntry = props.disabled?.[m];
          const isDisabled = disabledEntry !== undefined;
          return (
            <label
              key={m}
              title={isDisabled ? disabledEntry?.tooltip : undefined}
              className={cn(
                'px-2 py-1 transition-colors',
                isDisabled
                  ? 'cursor-not-allowed text-fg-faint/60'
                  : 'cursor-pointer',
                !isDisabled && checked
                  ? 'text-accent'
                  : !isDisabled
                    ? 'text-fg-muted hover:text-fg'
                    : '',
                !isDisabled && checked ? 'underline underline-offset-[6px] decoration-1' : '',
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
// Bloc key (only when blocs overlay is active)
// ---------------------------------------------------------------------------

function BlocKey({ labels }: { labels: Record<BlocColorKey, string> }) {
  return (
    <div
      role="group"
      aria-label="bloc legend"
      className={cn(
        'pointer-events-auto flex flex-wrap items-center gap-3 border border-border bg-bg/85 px-3 py-1.5',
        'rounded-sm font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted backdrop-blur-sm',
      )}
    >
      {BLOC_LEGEND_ORDER.map((key) => (
        <span key={key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: BLOC_COLOR[key] }}
          />
          <span>{labels[key]}</span>
        </span>
      ))}
    </div>
  );
}

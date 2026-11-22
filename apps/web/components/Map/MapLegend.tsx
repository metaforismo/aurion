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
  /** Accessible label for the bloc colour key group. Pass a translated
   * string; falls back to a language-neutral default. */
  blocGroupLabel?: string;
};

export default function MapLegend(props: MapLegendProps) {
  const showBlocKey = props.mode === 'blocs';
  return (
    <div
      className={cn(
        'pointer-events-none flex flex-col items-center gap-2',
      )}
    >
      <OverlayToggle
        mode={props.mode}
        onChange={props.onChange}
        labels={props.labels}
        groupLabel={props.groupLabel}
        disabled={props.disabled}
      />
      {showBlocKey ? (
        <BlocKey labels={props.blocLabels} groupLabel={props.blocGroupLabel} />
      ) : null}
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
        'glass-panel pointer-events-auto flex items-center gap-1 rounded-full px-2 py-1',
        'text-[11px] font-medium text-fg-faint',
      )}
    >
      <legend className="sr-only">{props.groupLabel}</legend>
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
                // Visible keyboard-focus ring: the radio itself is sr-only,
                // so the label carries the indicator via :has().
                'rounded-full px-2.5 py-1 transition-colors has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-accent',
                isDisabled
                  ? 'cursor-not-allowed text-fg-faint/60'
                  : 'cursor-pointer',
                !isDisabled && checked
                  ? 'bg-white/15 text-fg'
                  : !isDisabled
                    ? 'text-fg-muted hover:bg-white/[0.07] hover:text-fg'
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
// Bloc key (only when blocs overlay is active)
// ---------------------------------------------------------------------------

function BlocKey({
  labels,
  groupLabel,
}: {
  labels: Record<BlocColorKey, string>;
  groupLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={groupLabel ?? 'bloc legend'}
      className={cn(
        'glass-panel pointer-events-auto order-first flex flex-wrap items-center gap-3 rounded-full px-3 py-1.5',
        'text-[11px] text-fg-muted',
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

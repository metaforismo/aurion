'use client';

// Hover tooltip for a single nation. Receives screen-space coordinates and
// clamps itself to the viewport so it never overflows. Pure HTML — sits on top
// of the SVG, never inside it, so text rendering / sizing follows browser UA.

import { useLayoutEffect, useRef, useState } from 'react';
import type { Country, IntelLevel } from '@aurion/engine';

import { cn } from '../../lib/cn';

const TOOLTIP_MARGIN = 12;

export type MapTooltipProps = {
  /** Screen-space anchor (mouse position or focused nation centroid). */
  x: number;
  y: number;
  country: Country;
  /** Localised name for the country and capital. */
  name: string;
  capital: string;
  /** Localised region label. */
  regionLabel: string;
  /** What the player knows about this country (none = redacted fields). */
  intelLevel: IntelLevel;
  /** True if this is the player's own country (intel always full). */
  isPlayer: boolean;
  /** Attitude (-100..100) of `country` toward the player; null if unknown. */
  attitudeTowardPlayer: number | null;
  labels: {
    capital: string;
    gdp: string;
    army: string;
    attitude: string;
    intel: string;
    intelHidden: string;
    player: string;
    selected: string;
    region: string;
    intelByLevel: Record<IntelLevel, string>;
  };
  isSelected: boolean;
};

export default function MapTooltip(props: MapTooltipProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: props.x,
    top: props.y,
  });

  // Clamp to viewport after measure.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = props.x + TOOLTIP_MARGIN;
    let top = props.y + TOOLTIP_MARGIN;
    if (left + rect.width + TOOLTIP_MARGIN > vw) {
      left = props.x - rect.width - TOOLTIP_MARGIN;
    }
    if (top + rect.height + TOOLTIP_MARGIN > vh) {
      top = props.y - rect.height - TOOLTIP_MARGIN;
    }
    if (left < TOOLTIP_MARGIN) left = TOOLTIP_MARGIN;
    if (top < TOOLTIP_MARGIN) top = TOOLTIP_MARGIN;
    setPos({ left, top });
  }, [props.x, props.y, props.country.id]);

  const intelKnown =
    props.isPlayer ||
    props.intelLevel === 'partial' ||
    props.intelLevel === 'full';
  const intelRumors = props.intelLevel === 'rumors';

  return (
    <div
      ref={ref}
      role="tooltip"
      className={cn(
        'glass-surface pointer-events-none fixed z-50 min-w-[180px] max-w-[260px] rounded-lg px-3 py-2 text-xs text-fg shadow-xl',
      )}
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-3 w-3 shrink-0 rounded-full ring-1 ring-border-strong"
          style={{ backgroundColor: props.country.color }}
        />
        <span className="truncate font-semibold text-fg">
          {props.name}
        </span>
        {props.isPlayer ? (
          <span className="ml-auto rounded-sm bg-accent/20 px-1 py-0.5 text-[10px] uppercase tracking-wider text-accent">
            {props.labels.player}
          </span>
        ) : props.isSelected ? (
          <span className="ml-auto rounded-sm bg-surface-2/60 px-1 py-0.5 text-[10px] uppercase tracking-wider text-fg-muted">
            {props.labels.selected}
          </span>
        ) : null}
      </div>

      <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-fg-faint">{props.labels.region}</dt>
        <dd className="font-mono text-fg-muted">{props.regionLabel}</dd>

        <dt className="text-fg-faint">{props.labels.capital}</dt>
        <dd className="font-mono text-fg-muted">{props.capital}</dd>

        <dt className="text-fg-faint">{props.labels.gdp}</dt>
        <dd className="numeric-tabular font-mono text-success">
          {intelKnown
            ? formatBig(props.country.economy.gdp)
            : intelRumors
              ? `~${formatBig(roundCoarse(props.country.economy.gdp))}`
              : props.labels.intelHidden}
        </dd>

        <dt className="text-fg-faint">{props.labels.army}</dt>
        <dd className="numeric-tabular font-mono text-danger">
          {intelKnown
            ? formatBig(props.country.military.armySize)
            : intelRumors
              ? `~${formatBig(roundCoarse(props.country.military.armySize))}`
              : props.labels.intelHidden}
        </dd>

        {props.attitudeTowardPlayer !== null ? (
          <>
            <dt className="text-fg-faint">{props.labels.attitude}</dt>
            <dd
              className={cn(
                'numeric-tabular font-mono',
                props.attitudeTowardPlayer >= 0
                  ? 'text-success'
                  : 'text-danger',
              )}
            >
              {props.attitudeTowardPlayer >= 0 ? '+' : ''}
              {Math.round(props.attitudeTowardPlayer)}
            </dd>
          </>
        ) : null}

        <dt className="text-fg-faint">{props.labels.intel}</dt>
        <dd className="font-mono text-fg-muted">
          {props.labels.intelByLevel[props.intelLevel]}
        </dd>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBig(n: number): string {
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

/** Round to one significant figure for the rumour-tier intel display. */
function roundCoarse(n: number): number {
  if (n === 0) return 0;
  const sign = Math.sign(n);
  const abs = Math.abs(n);
  const mag = 10 ** Math.floor(Math.log10(abs));
  return sign * Math.round(abs / mag) * mag;
}

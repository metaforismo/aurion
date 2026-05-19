'use client';

// A single nation rendered in the Atlas / editorial style:
//   - Small filled dot for the capital marker (no halo, single ink tone).
//   - Country label set in small uppercase tracked sans, ink-on-paper.
//   - Hover: 1.5px accent hairline circle around the dot.
//   - Selected: thin dashed hairline (kept with stroke-dasharray="4 3" for
//     e2e selector compat) + a thin underline indicator beneath the label.
//   - Player country: marker rendered in the brand accent so it reads as
//     "yours" without resorting to a glow.
//
// The component is pure-presentational. All hit testing + store dispatch
// happens in the parent <WorldMap/>.

import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';

import { cn } from '../../lib/cn';

export type MapNationProps = {
  countryId: string;
  cx: number;
  cy: number;
  /** Hit-radius hint. Parent uses this to size overlay rings (e.g. bloc). */
  radius: number;
  /** Country fill color — kept for callers that still want hue accents. */
  color: string;
  /** Localised display name for the country (rendered below the dot). */
  label?: string;
  ariaLabel: string;
  isPlayer: boolean;
  isSelected: boolean;
  isHovered: boolean;
  /** Opacity overlay applied by the intel mask. */
  opacity: number;
  /**
   * Greyscale tint (0..1) used to wash unknown nations to neutral. We avoid
   * CSS filters (uneven SVG support inside viewBox-scaled trees) and instead
   * mix the dot fill toward slate ink.
   */
  greyscale: number;
  onPointerEnter: (e: PointerEvent<SVGGElement>) => void;
  onPointerMove: (e: PointerEvent<SVGGElement>) => void;
  onPointerLeave: (e: PointerEvent<SVGGElement>) => void;
  onClick: (e: PointerEvent<SVGGElement>) => void;
  onKeyDown: (e: KeyboardEvent<SVGGElement>) => void;
};

// Squash the legacy GDP-driven radius (~7..28 px) down to small editorial dots.
function dotRadius(hintRadius: number): number {
  return Math.max(2.4, Math.min(4.5, hintRadius * 0.22));
}

export default function MapNation(props: MapNationProps) {
  const r = dotRadius(props.radius);
  const hitR = Math.max(props.radius + 4, 14);

  // Intel-mask greyscale: blend toward neutral ink for unknown nations.
  // Player nations always read in the brand accent and ignore the mask.
  const dotFill = props.isPlayer
    ? 'var(--color-accent)'
    : mixColors('#e6e2d6', '#6b7280', props.greyscale);

  const groupStyle: CSSProperties = {
    cursor: 'pointer',
    opacity: props.opacity,
  };

  // Label sits just under the dot with a small gap.
  const labelY = props.cy + r + 11;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={props.ariaLabel}
      data-country={props.countryId}
      onPointerEnter={props.onPointerEnter}
      onPointerMove={props.onPointerMove}
      onPointerLeave={props.onPointerLeave}
      onClick={props.onClick}
      onKeyDown={props.onKeyDown}
      style={groupStyle}
      className={cn(
        'focus:outline-none',
        'transition-[opacity] duration-200',
      )}
    >
      {/* Larger transparent hit target for easier pointer + touch use. */}
      <circle
        cx={props.cx}
        cy={props.cy}
        r={hitR}
        fill="transparent"
        pointerEvents="all"
      />

      {/* Hover hairline — 1.5px accent ring, no shadow. */}
      {props.isHovered && !props.isSelected ? (
        <circle
          cx={props.cx}
          cy={props.cy}
          r={r + 3.5}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          pointerEvents="none"
        />
      ) : null}

      {/* Selected ring — thin dashed hairline. We keep stroke-dasharray="4 3"
          to preserve the existing e2e selector; the underline beneath the
          label is the primary visual cue for selection. */}
      {props.isSelected ? (
        <circle
          cx={props.cx}
          cy={props.cy}
          r={r + 3.5}
          fill="none"
          stroke="var(--color-fg)"
          strokeOpacity={0.85}
          strokeWidth={1}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      ) : null}

      {/* The capital marker — single small filled dot, no border. */}
      <circle
        cx={props.cx}
        cy={props.cy}
        r={r}
        fill={dotFill}
        pointerEvents="none"
      />

      {/* Country label — small uppercase tracked mono. */}
      {props.label ? (
        <g pointerEvents="none">
          <text
            x={props.cx}
            y={labelY}
            textAnchor="middle"
            fill={props.isPlayer ? 'var(--color-accent)' : 'var(--color-fg)'}
            fillOpacity={props.isPlayer ? 1 : 0.92}
            fontSize={9}
            fontWeight={500}
            letterSpacing={1.2}
            style={{
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
              userSelect: 'none',
            }}
          >
            {props.label}
          </text>
          {props.isSelected ? (
            <line
              x1={props.cx - measureLabelHalf(props.label)}
              y1={labelY + 3}
              x2={props.cx + measureLabelHalf(props.label)}
              y2={labelY + 3}
              stroke="var(--color-accent)"
              strokeWidth={1}
            />
          ) : null}
        </g>
      ) : null}
    </g>
  );
}

/**
 * Approximate half-width of the label at fontSize=9 + letterSpacing=1.2 in
 * uppercase mono. We avoid getBBox (forces layout) and estimate from char
 * count — close enough for an underline indicator.
 */
function measureLabelHalf(label: string): number {
  return Math.max(8, (label.length * 6.2) / 2);
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return null;
  let raw = m[1];
  if (raw.length === 3) {
    raw = raw
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return [r, g, b];
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.round(n).toString(16).padStart(2, '0').slice(0, 2);
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Linear blend between `from` and `to`. amount=0 returns `from`. */
function mixColors(from: string, to: string, amount: number): string {
  const a = clamp01(amount);
  const f = parseHex(from);
  const t = parseHex(to);
  if (!f || !t) return from;
  const r = f[0] * (1 - a) + t[0] * a;
  const g = f[1] * (1 - a) + t[1] * a;
  const b = f[2] * (1 - a) + t[2] * a;
  return toHex(r, g, b);
}

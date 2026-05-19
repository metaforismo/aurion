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
  /**
   * Optional 2-3 char localised marker rendered next to the player dot
   * ("YOU" / "TU"). Only consulted when `isPlayer` is true. Provides a
   * non-colour anchor so the player nation reads even for colour-blind users.
   */
  playerMarker?: string;
  onPointerEnter: (e: PointerEvent<SVGGElement>) => void;
  onPointerMove: (e: PointerEvent<SVGGElement>) => void;
  onPointerLeave: (e: PointerEvent<SVGGElement>) => void;
  onClick: (e: PointerEvent<SVGGElement>) => void;
  onKeyDown: (e: KeyboardEvent<SVGGElement>) => void;
};

// Squash the legacy GDP-driven radius (~7..28 px) down to small editorial dots.
// Bumped a hair from the previous 2.4..4.5 px range so capital markers read
// at the larger label font size without looking pinched.
function dotRadius(hintRadius: number): number {
  return Math.max(3, Math.min(5.5, hintRadius * 0.24));
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

  // Label sits just under the dot with a small gap. fontSize bumped from 9 →
  // 12 (per the second-pass map critique: country labels were illegible at
  // 8-9px). Centred horizontally on the capital dot.
  const labelFontSize = 12;
  const labelY = props.cy + r + labelFontSize + 2;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={props.ariaLabel}
      data-country={props.countryId}
      data-player={props.isPlayer ? 'true' : undefined}
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

      {/* Player country anchor — a faint accent disc behind the dot so the
          player nation reads as a clear visual anchor on the map (not just
          another marker). Sits below the hover/selected rings so they still
          paint cleanly when interacted with. */}
      {props.isPlayer ? (
        <circle
          cx={props.cx}
          cy={props.cy}
          r={r + 5}
          fill="var(--color-accent)"
          fillOpacity={0.16}
          pointerEvents="none"
        />
      ) : null}

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

      {/* The capital marker — filled dot. Player nation gets a thicker
          accent border so the "yours" identity reads beyond just hue
          (colour-blind accessibility + non-coloured intel-mask states). */}
      <circle
        cx={props.cx}
        cy={props.cy}
        r={r}
        fill={dotFill}
        stroke={props.isPlayer ? 'var(--color-accent)' : 'var(--color-bg)'}
        strokeWidth={props.isPlayer ? 1.5 : 0.5}
        strokeOpacity={props.isPlayer ? 1 : 0.6}
        pointerEvents="none"
      />

      {/* Country label — uppercase tracked mono, centred under the dot. */}
      {props.label ? (
        <g pointerEvents="none">
          <text
            x={props.cx}
            y={labelY}
            textAnchor="middle"
            fill={props.isPlayer ? 'var(--color-fg)' : 'var(--color-fg-muted)'}
            fillOpacity={props.isPlayer ? 1 : 0.88}
            fontSize={labelFontSize}
            fontWeight={props.isPlayer ? 600 : 500}
            letterSpacing={1.4}
            style={{
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
              userSelect: 'none',
              // Subtle paint-order stroke so the label remains legible when
              // it sits over a region polygon. No glow, no shadow.
              paintOrder: 'stroke',
              stroke: 'var(--color-bg)',
              strokeWidth: 3,
              strokeOpacity: 0.85,
              strokeLinejoin: 'round',
            } as CSSProperties}
          >
            {props.label}
          </text>
          {props.isSelected ? (
            <line
              x1={props.cx - measureLabelHalf(props.label, labelFontSize)}
              y1={labelY + 4}
              x2={props.cx + measureLabelHalf(props.label, labelFontSize)}
              y2={labelY + 4}
              stroke="var(--color-accent)"
              strokeWidth={1}
            />
          ) : null}
          {/* Player marker — a tiny tracked-caps badge above the dot
              ("TU" / "YOU"). Anchors the player nation with a textual cue,
              not just a colour. Only rendered when both label and marker
              are provided so intel-mask redaction (label hidden) still
              hides the marker too. */}
          {props.isPlayer && props.playerMarker ? (
            <text
              x={props.cx}
              y={props.cy - r - 6}
              textAnchor="middle"
              fill="var(--color-accent)"
              fontSize={9}
              fontWeight={600}
              letterSpacing={1.4}
              style={{
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
                userSelect: 'none',
                paintOrder: 'stroke',
                stroke: 'var(--color-bg)',
                strokeWidth: 3,
                strokeOpacity: 0.85,
                strokeLinejoin: 'round',
              } as CSSProperties}
            >
              {props.playerMarker}
            </text>
          ) : null}
        </g>
      ) : null}
    </g>
  );
}

/**
 * Approximate half-width of the label at the given font size with
 * letterSpacing=1.4 in uppercase mono. We avoid getBBox (forces layout) and
 * estimate from char count — close enough for an underline indicator.
 */
function measureLabelHalf(label: string, fontSize: number): number {
  const charW = fontSize * 0.68;
  return Math.max(8, (label.length * charW) / 2);
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

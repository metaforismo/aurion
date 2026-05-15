'use client';

// A single nation rendered as an SVG circle with optional rings:
//   - Player country: golden glow (always on for the human's country)
//   - Selected: white outer ring
//   - Hover: subtle outline
//
// The component is intentionally pure-presentational. All hit testing and
// store dispatch happens inside the parent WorldMap.

import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';

import { cn } from '../../lib/cn';

export type MapNationProps = {
  countryId: string;
  cx: number;
  cy: number;
  radius: number;
  /** Country fill color. */
  color: string;
  ariaLabel: string;
  isPlayer: boolean;
  isSelected: boolean;
  isHovered: boolean;
  /** Opacity overlay applied by intel mask (1 = full, 0.25 = unknown). */
  opacity: number;
  /** Greyscale tint (0..1) used to wash unknown nations to neutral. */
  greyscale: number;
  onPointerEnter: (e: PointerEvent<SVGGElement>) => void;
  onPointerMove: (e: PointerEvent<SVGGElement>) => void;
  onPointerLeave: (e: PointerEvent<SVGGElement>) => void;
  onClick: (e: PointerEvent<SVGGElement>) => void;
  onKeyDown: (e: KeyboardEvent<SVGGElement>) => void;
};

export default function MapNation(props: MapNationProps) {
  const ringRadius = props.radius + 4;
  const haloRadius = props.radius + 9;

  // Apply greyscale by mixing the country color toward slate-500 in the fill
  // composition. We don't use a CSS filter (SVG support is uneven inside
  // viewBox-scaled trees) — instead pass an interpolated colour.
  const fill = mixColors(props.color, '#475569', props.greyscale);

  const groupStyle: CSSProperties = {
    cursor: 'pointer',
    opacity: props.opacity,
  };

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
        r={Math.max(props.radius + 8, 16)}
        fill="transparent"
        pointerEvents="all"
      />

      {/* Player halo — soft accent glow. */}
      {props.isPlayer ? (
        <>
          <circle
            cx={props.cx}
            cy={props.cy}
            r={haloRadius + 3}
            fill="none"
            stroke="var(--color-accent)"
            strokeOpacity={0.25}
            strokeWidth={6}
            pointerEvents="none"
          />
          <circle
            cx={props.cx}
            cy={props.cy}
            r={haloRadius}
            fill="none"
            stroke="var(--color-accent)"
            strokeOpacity={0.85}
            strokeWidth={2.5}
            pointerEvents="none"
          />
        </>
      ) : null}

      {/* Selected ring — crisp foreground. */}
      {props.isSelected ? (
        <circle
          cx={props.cx}
          cy={props.cy}
          r={ringRadius}
          fill="none"
          stroke="var(--color-fg)"
          strokeWidth={2}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      ) : null}

      {/* Hover ring — subtle. */}
      {props.isHovered && !props.isSelected ? (
        <circle
          cx={props.cx}
          cy={props.cy}
          r={ringRadius}
          fill="none"
          stroke="var(--color-fg-muted)"
          strokeOpacity={0.7}
          strokeWidth={1.5}
          pointerEvents="none"
        />
      ) : null}

      {/* The nation disk itself. */}
      <circle
        cx={props.cx}
        cy={props.cy}
        r={props.radius}
        fill={fill}
        stroke="var(--color-bg)"
        strokeWidth={1.5}
        pointerEvents="none"
      />
    </g>
  );
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

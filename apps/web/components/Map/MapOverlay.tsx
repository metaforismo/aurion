'use client';

// Overlay primitives + math for the Atlas-style world map.
//
//   1. <AllianceEdges/> — hairline lines (no glow) between allied capitals.
//   2. BLOC_COLOR / BlocColorKey — palette + key types reused by WorldMap
//      and the legend.
//   3. computeAllianceEdges / computeRegionTension / computeIntelMask /
//      tensionToColor / intelToVisuals — pure helpers used by WorldMap's
//      memoised derivations.
//
// The overlay toggle and bloc legend live in <MapLegend/>, which renders an
// editorial-style bottom rail with all the map's controls + keys in one row.

import type {
  ActiveBlocId,
  CountryId,
  GameState,
  IntelLevel,
  Relation,
} from '@aurion/engine';

import { NATION_POSITIONS, REGION_ORDER } from './regions';

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

/**
 * Atlas-style alliance bonds: thin, single-stroke lines colour-coded by
 * union-find group. No outer glow, no dashes — the chart-style minimum.
 */
export function AllianceEdges({ edges }: AllianceEdgesProps) {
  if (edges.length === 0) return null;
  return (
    <g aria-hidden pointerEvents="none" data-overlay="alliances">
      {edges.map((e, i) => (
        <line
          key={`${e.from}-${e.to}-${i}`}
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          stroke={e.color}
          strokeOpacity={0.7}
          strokeWidth={1}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Overlay math (pure helpers — memoised by WorldMap)
// ---------------------------------------------------------------------------

// Alliance edges use the five region accents in stable rotation, with the
// brand accent as the sixth slot, so the union-find groups inherit the same
// palette as the map regions themselves.
const ALLIANCE_GROUP_COLORS = [
  'var(--color-region-borealis)',
  'var(--color-region-auriana)',
  'var(--color-region-oriana)',
  'var(--color-region-meridia)',
  'var(--color-region-sahel)',
  'var(--color-accent)',
];

/** Build the alliance edge list with deterministic union-find group colours. */
export function computeAllianceEdges(state: GameState): AllianceEdge[] {
  const ids: CountryId[] = Object.keys(state.countries);
  const parent = new Map<CountryId, CountryId>();
  for (const id of ids) parent.set(id, id);
  const find = (x: CountryId): CountryId => {
    let cur = x;
    while (parent.get(cur) !== cur) {
      const p = parent.get(cur);
      if (!p) break;
      const gp = parent.get(p) ?? p;
      parent.set(cur, gp);
      cur = gp;
    }
    return cur;
  };
  const union = (a: CountryId, b: CountryId) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const allianceRels: Relation[] = [];
  for (const r of Object.values(state.relations)) {
    if (r.treaties.includes('alliance')) {
      allianceRels.push(r);
      union(r.countryA, r.countryB);
    }
  }

  const groupColors = new Map<CountryId, string>();
  for (const id of ids) {
    const root = find(id);
    if (!groupColors.has(root)) {
      const colorIdx = groupColors.size % ALLIANCE_GROUP_COLORS.length;
      const color =
        ALLIANCE_GROUP_COLORS[colorIdx] ?? 'var(--color-fg-muted)';
      groupColors.set(root, color);
    }
  }

  const edges: AllianceEdge[] = [];
  for (const r of allianceRels) {
    const pa = NATION_POSITIONS[r.countryA];
    const pb = NATION_POSITIONS[r.countryB];
    if (!pa || !pb) continue;
    const root = find(r.countryA);
    const color = groupColors.get(root) ?? 'var(--color-fg-muted)';
    edges.push({
      from: r.countryA,
      to: r.countryB,
      color,
      x1: pa.x,
      y1: pa.y,
      x2: pb.x,
      y2: pb.y,
    });
  }
  return edges;
}

/** Returns a 0..1 tension value per region (world base + war/sanctions). */
export function computeRegionTension(state: GameState): Map<string, number> {
  const base = state.worldTension / 100;
  const out = new Map<string, number>();
  for (const id of REGION_ORDER) out.set(id, base);
  for (const r of Object.values(state.relations)) {
    const a = state.countries[r.countryA];
    const b = state.countries[r.countryB];
    if (!a || !b) continue;
    const contribution =
      (r.atWar ? 0.4 : 0) + (r.treaties.includes('sanctions') ? 0.15 : 0);
    if (contribution === 0) continue;
    out.set(a.regionId, Math.min(1, (out.get(a.regionId) ?? 0) + contribution));
    out.set(b.regionId, Math.min(1, (out.get(b.regionId) ?? 0) + contribution));
  }
  return out;
}

/** Map a 0..1 tension to a desaturated editorial heat ramp (cool ink → rose). */
export function tensionToColor(t: number): string {
  // Single linear stop between a cool neutral and a muted geopolitical rose;
  // intentionally low-chroma so it reads like a tinted overlay, not a glow.
  const cool: [number, number, number] = [60, 70, 90];
  const hot: [number, number, number] = [180, 80, 90];
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  const r = cool[0] * (1 - c) + hot[0] * c;
  const g = cool[1] * (1 - c) + hot[1] * c;
  const b = cool[2] * (1 - c) + hot[2] * c;
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** Player's per-country intel level (own country always 'full'). */
export function computeIntelMask(
  state: GameState,
): Map<CountryId, IntelLevel> {
  const out = new Map<CountryId, IntelLevel>();
  const player = state.countries[state.playerCountryId];
  if (!player) return out;
  for (const id of Object.keys(state.countries)) {
    if (id === player.id) {
      out.set(id, 'full');
      continue;
    }
    const lvl = player.intelligence.knownIntel[id] ?? 'none';
    out.set(id, lvl);
  }
  return out;
}

/** Visual masking knobs keyed by intel level. */
export function intelToVisuals(level: IntelLevel): {
  opacity: number;
  greyscale: number;
} {
  switch (level) {
    case 'full':
      return { opacity: 1, greyscale: 0 };
    case 'partial':
      return { opacity: 0.85, greyscale: 0.2 };
    case 'rumors':
      return { opacity: 0.6, greyscale: 0.55 };
    case 'none':
    default:
      return { opacity: 0.35, greyscale: 0.85 };
  }
}

/**
 * Bloc-overlay derived data: per-country bloc lookup and per-region dominant
 * bloc tint. The region tint picks the bloc with the most member countries,
 * breaking ties by cumulative GDP. 'unaligned' is never returned as a region
 * tint — those regions stay on their base biome fill.
 *
 * Returns empty maps when the overlay is not 'blocs', so callers can treat
 * the result uniformly without branching twice.
 */
export type BlocOverlayCountry = {
  id: CountryId;
  regionId: string;
  blocId?: ActiveBlocId | null;
  economy: { gdp: number };
};
export function computeBlocOverlay(
  active: boolean,
  countries: ReadonlyArray<BlocOverlayCountry>,
): {
  byCountry: Map<CountryId, BlocColorKey>;
  regionTint: Map<string, BlocColorKey>;
} {
  const byCountry = new Map<CountryId, BlocColorKey>();
  const regionTint = new Map<string, BlocColorKey>();
  if (!active) return { byCountry, regionTint };

  type Counts = Map<BlocColorKey, { count: number; gdp: number }>;
  const perRegion = new Map<string, Counts>();
  for (const c of countries) {
    const key: BlocColorKey = c.blocId ?? 'unaligned';
    byCountry.set(c.id, key);
    let region = perRegion.get(c.regionId);
    if (!region) {
      region = new Map();
      perRegion.set(c.regionId, region);
    }
    const slot = region.get(key) ?? { count: 0, gdp: 0 };
    slot.count += 1;
    slot.gdp += c.economy.gdp;
    region.set(key, slot);
  }
  for (const [regionId, counts] of perRegion) {
    let best: BlocColorKey | null = null;
    let bestScore = -Infinity;
    for (const [key, slot] of counts) {
      const score = slot.count * 1e15 + slot.gdp;
      if (score > bestScore) {
        best = key;
        bestScore = score;
      }
    }
    if (best && best !== 'unaligned') regionTint.set(regionId, best);
  }
  return { byCountry, regionTint };
}

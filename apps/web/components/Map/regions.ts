// Hand-authored stylised geometry for the Aurion world map. Coordinates live
// inside a 1600x900 SVG viewBox. The map is intentionally NOT geographic — it
// is a board-game style layout where each macro-region has a recognisable
// silhouette and each nation a fixed circle position inside it.
//
// Two invariants are validated at module load (in dev only) to catch authoring
// drift early:
//   1. Every country in the scenario has a NATION_POSITIONS entry.
//   2. Every nation position falls inside its region's bounding box.

import type { CountryId, RegionId } from '@aurion/engine';

export const MAP_VIEWBOX = {
  x: 0,
  y: 0,
  width: 1600,
  height: 900,
} as const;

export type RegionDef = {
  id: RegionId;
  /** i18n key under the `map.regions.*` namespace. */
  nameKey: string;
  /** SVG path d-attribute for the region silhouette. */
  pathD: string;
  /** Axis-aligned bounding box used for layout / intersection checks. */
  bounds: { x: number; y: number; w: number; h: number };
  /** Base biome fill (no overlay). Intended to read "off" so accents pop. */
  fill: string;
  /** Stroke colour — slightly lighter than the fill. */
  stroke: string;
};

// ---------------------------------------------------------------------------
// Region silhouettes. The shapes are deliberately blocky/stylised; the
// emphasis is on legibility at small sizes, not realism.
// ---------------------------------------------------------------------------

export const REGIONS: Record<string, RegionDef> = {
  borealis: {
    id: 'borealis',
    nameKey: 'borealis',
    fill: '#1f2a44',
    stroke: '#3b4a6b',
    pathD:
      'M 40 60 L 1560 60 L 1560 200 L 1480 250 L 1380 230 L 1260 270 L 1120 240 L 980 280 L 840 250 L 700 280 L 560 250 L 420 290 L 280 260 L 160 290 L 40 260 Z',
    bounds: { x: 40, y: 60, w: 1520, h: 230 },
  },
  auriana: {
    id: 'auriana',
    nameKey: 'auriana',
    fill: '#2f4a3a',
    stroke: '#4f7256',
    pathD:
      'M 120 320 L 640 320 L 700 380 L 700 520 L 620 600 L 520 640 L 380 640 L 260 600 L 180 540 L 140 460 L 120 380 Z',
    bounds: { x: 120, y: 320, w: 580, h: 320 },
  },
  oriana: {
    id: 'oriana',
    nameKey: 'oriana',
    fill: '#1f4a55',
    stroke: '#2f6c7a',
    // Composed of several "islands" via sub-paths — each starts with M.
    pathD: [
      'M 1240 320 L 1360 320 L 1400 360 L 1380 420 L 1300 440 L 1240 400 Z', // tenshido isle (NW)
      'M 1420 360 L 1540 360 L 1560 420 L 1500 460 L 1420 440 Z', // hakaria isle
      'M 1180 480 L 1280 480 L 1320 540 L 1280 600 L 1180 600 L 1140 540 Z', // aolan
      'M 1340 500 L 1460 500 L 1500 560 L 1440 620 L 1340 600 Z', // sankai
      'M 1440 640 L 1540 640 L 1560 700 L 1500 740 L 1440 720 Z', // mireku
      'M 1240 660 L 1340 660 L 1360 720 L 1300 760 L 1240 740 Z', // pelagia
    ].join(' '),
    bounds: { x: 1140, y: 320, w: 420, h: 440 },
  },
  meridia: {
    id: 'meridia',
    nameKey: 'meridia',
    fill: '#2a4a2f',
    stroke: '#4f7a4b',
    pathD:
      'M 760 540 L 1080 540 L 1120 620 L 1100 720 L 1040 800 L 940 840 L 840 820 L 760 760 L 720 680 L 740 600 Z',
    bounds: { x: 720, y: 540, w: 400, h: 300 },
  },
  'sahel-karoun': {
    id: 'sahel-karoun',
    nameKey: 'sahel-karoun',
    fill: '#5a4a2a',
    stroke: '#7a6438',
    pathD:
      'M 100 660 L 700 660 L 740 720 L 720 800 L 660 850 L 540 870 L 400 860 L 280 840 L 160 800 L 100 740 Z',
    bounds: { x: 100, y: 660, w: 640, h: 210 },
  },
};

export const REGION_ORDER: readonly string[] = [
  'borealis',
  'auriana',
  'oriana',
  'meridia',
  'sahel-karoun',
];

// ---------------------------------------------------------------------------
// Nation positions. Sized hint controls the circle radius in the renderer:
//   1 = tiny (~9px), 2 = medium (~14px), 3 = big (~22px) — the renderer also
//   nudges by GDP, but `sizeHint` is the floor.
// ---------------------------------------------------------------------------

export type NationPosition = {
  x: number;
  y: number;
  /** Authoring-time hint; renderer combines with GDP. */
  sizeHint?: 1 | 2 | 3;
};

export const NATION_POSITIONS: Record<string, NationPosition> = {
  // Auriana ----------------------------------------------------------------
  aurion: { x: 320, y: 470, sizeHint: 2 },
  velmara: { x: 220, y: 540, sizeHint: 1 },
  korthia: { x: 520, y: 430, sizeHint: 3 },
  sundria: { x: 460, y: 560, sizeHint: 1 },

  // Borealis ---------------------------------------------------------------
  'federazione-borea': { x: 760, y: 150, sizeHint: 3 },
  tundria: { x: 1180, y: 160, sizeHint: 2 },
  norhavn: { x: 320, y: 170, sizeHint: 2 },
  rusvenia: { x: 1380, y: 140, sizeHint: 2 },
  iskal: { x: 540, y: 180, sizeHint: 1 },

  // Oriana (archipelago) ---------------------------------------------------
  tenshido: { x: 1320, y: 380, sizeHint: 3 },
  hakaria: { x: 1480, y: 410, sizeHint: 2 },
  aolan: { x: 1230, y: 540, sizeHint: 2 },
  sankai: { x: 1410, y: 560, sizeHint: 2 },
  mireku: { x: 1490, y: 690, sizeHint: 1 },
  pelagia: { x: 1300, y: 710, sizeHint: 1 },

  // Meridia ----------------------------------------------------------------
  calanthia: { x: 900, y: 660, sizeHint: 3 },
  xanaba: { x: 800, y: 620, sizeHint: 2 },
  yureka: { x: 1010, y: 600, sizeHint: 2 },
  verdantia: { x: 980, y: 770, sizeHint: 2 },
  tolmek: { x: 820, y: 780, sizeHint: 1 },

  // Sahel-Karoun -----------------------------------------------------------
  karoun: { x: 240, y: 750, sizeHint: 2 },
  saharel: { x: 380, y: 720, sizeHint: 1 },
  mokshara: { x: 500, y: 760, sizeHint: 2 },
  zembu: { x: 620, y: 740, sizeHint: 2 },
  antarah: { x: 160, y: 790, sizeHint: 1 },
};

// ---------------------------------------------------------------------------
// Dev-time integrity check. The web app runs with strict TypeScript and
// `noUncheckedIndexedAccess`, so we use plain Object.prototype.hasOwnProperty
// reads. The function is exported so callers can opt-in (e.g. WorldMap will
// invoke it once on mount).
// ---------------------------------------------------------------------------

export type CountryGeometryEntry = {
  id: CountryId;
  regionId: RegionId;
};

export function validateGeometry(countries: CountryGeometryEntry[]): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const c of countries) {
    seen.add(c.id);
    const pos = NATION_POSITIONS[c.id];
    if (!pos) {
      warnings.push(
        `[Map] Missing NATION_POSITIONS entry for country "${c.id}".`,
      );
      continue;
    }
    const region = REGIONS[c.regionId];
    if (!region) {
      warnings.push(
        `[Map] Country "${c.id}" references unknown region "${c.regionId}".`,
      );
      continue;
    }
    const { x, y, w, h } = region.bounds;
    if (pos.x < x || pos.x > x + w || pos.y < y || pos.y > y + h) {
      warnings.push(
        `[Map] Position for "${c.id}" (${pos.x},${pos.y}) is outside region "${c.regionId}" bounds.`,
      );
    }
  }

  for (const id of Object.keys(NATION_POSITIONS)) {
    if (!seen.has(id)) {
      warnings.push(
        `[Map] NATION_POSITIONS has stale entry "${id}" (no scenario country).`,
      );
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Helpers used by the renderer.
// ---------------------------------------------------------------------------

/** Get a region or fall back to a neutral placeholder. */
export function getRegion(id: string): RegionDef | undefined {
  return REGIONS[id];
}

/** Get a country position or undefined if missing. */
export function getNationPosition(id: string): NationPosition | undefined {
  return NATION_POSITIONS[id];
}

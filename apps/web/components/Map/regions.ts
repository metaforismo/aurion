// Hand-authored stylised geometry for the Aurion world map. Coordinates live
// inside a 1600x900 SVG viewBox. The map is intentionally NOT geographic — it
// is a board-game style layout, but unlike the previous "five floating
// geometric primitives" pass the four mainland regions now share *exact*
// boundary curves so the silhouette reads as one continent with internal
// borders, and Oriana sits as a true archipelago of irregular islands east of
// the strait.
//
// Authoring notes — the four shared boundaries (Borealis/Auriana, Borealis/
// Meridia, Auriana/Sahel, Auriana/Meridia, Sahel/Meridia) are defined as
// cubic-Bezier curve segments. When the same curve appears on both sides of a
// border, one region traverses it forward and the other traverses the *same*
// control-point sequence in reverse (cp2,cp1 swapped, endpoints swapped). The
// effect is that no gap or overlap exists between adjacent regions, even
// though each region is still a self-contained closed path.
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

// Tight crop around the landmass + archipelago. The SVG's default viewBox is
// set to this on mount so the continent fills the container edge-to-edge
// rather than leaving large empty seas at the top and bottom. Pan/zoom clamps
// continue to use MAP_VIEWBOX so a small amount of overscan remains
// reachable at the edges.
export const PLAY_BOUNDS = {
  x: 20,
  y: 40,
  width: 1560,
  height: 850,
} as const;

// ---------------------------------------------------------------------------
// Terrain layer types — all OPTIONAL. The renderer skips any region that
// omits these fields. The Aurion-world and Mondo Contemporaneo regions
// supply terrain data; the Guerra Fredda bloc silhouettes intentionally do
// not (blocs are political, terrain would confuse the messaging).
// ---------------------------------------------------------------------------

export type BiomeKind =
  | 'tundra'
  | 'forest'
  | 'grassland'
  | 'desert'
  | 'savanna'
  | 'oasis'
  | 'highland'
  | 'fertile'
  | 'coastal'
  | 'volcanic';

/**
 * A blob of biome sub-fill drawn on top of the region's base fill. The
 * renderer clips the blob to the region's own `pathD` so authoring blobs
 * that bleed outside the silhouette is safe.
 *
 * Either supply a `pathD` (custom shape) OR a `cx`/`cy`/`rx`/`ry` ellipse —
 * the renderer picks whichever is provided.
 */
export type BiomeLayer = {
  kind: BiomeKind;
  /** Custom path (closed cubic-Bezier blob). */
  pathD?: string;
  /** Ellipse centre + radii (in viewBox units). */
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  /**
   * Optional fill override. Default: a `color-mix()` of the region fill
   * with a biome-appropriate hue (see BIOME_DEFAULT_TINT in WorldMap).
   */
  fill?: string;
  /** Optional opacity. Default 0.35. */
  opacity?: number;
};

/**
 * A stylised mountain range — a row of small triangle peaks along a spine.
 * Authored as raw triangle vertices for full control (a procedural
 * placement helper would be overkill at this scale).
 */
export type MountainPeak = {
  /** Triangle base-left vertex. */
  x: number;
  /** Triangle base y (peaks point up — apex is at `y - height`). */
  y: number;
  /** Base width in viewBox units. */
  width: number;
  /** Peak height in viewBox units. */
  height: number;
};

export type MountainRange = {
  peaks: MountainPeak[];
  /** Optional fill override. Default: darkened region fill. */
  fill?: string;
};

/**
 * A river drawn as a smooth multi-segment path. The renderer applies the
 * info colour at low alpha and a round line-cap so the line reads as a
 * meandering watercourse.
 */
export type River = {
  /** Full SVG path d-attribute (Mx,y followed by 1+ cubic segments). */
  pathD: string;
  /** Optional stroke width. Default 1.5. */
  width?: number;
  /** Optional opacity. Default 0.45. */
  opacity?: number;
};

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
  /** Optional terrain sub-fills clipped to the region silhouette. */
  biomes?: BiomeLayer[];
  /** Optional mountain ranges (triangle clusters). */
  mountains?: MountainRange[];
  /** Optional river paths. */
  rivers?: River[];
};

// ---------------------------------------------------------------------------
// Region silhouettes.
//
// The four mainland regions share boundary curves at three triple-junctions:
//   TJ1 = (620, 380)  Borealis · Auriana · Meridia
//   TJ2 = (640, 660)  Auriana · Sahel · Meridia
//
// Shared boundary segment sets (all written here forward; reversed copies
// appear inside the path strings below):
//
//   B/A  (Borealis south-west / Auriana north),  P0=(80,280) → TJ1
//     C 140 250, 200 320, 240 300
//     C 300 290, 340 370, 380 360
//     C 430 350, 460 300, 500 320
//     C 560 340, 580 360, 620 380
//
//   B/M  (Borealis south-east / Meridia north),  TJ1 → P8=(1100,420)
//     C 680 400, 720 340, 740 360
//     C 800 380, 820 430, 860 410
//     C 920 390, 940 340, 980 360
//     C 1040 380, 1070 400, 1100 420
//
//   A/M  (Auriana east / Meridia west),  TJ1 → TJ2
//     C 680 420, 640 450, 660 470
//     C 690 510, 610 540, 640 560
//     C 680 600, 610 630, 640 660
//
//   A/S  (Auriana south / Sahel north),  (140,640) → TJ2
//     C 180 660, 210 620, 240 640
//     C 290 670, 340 640, 380 660
//     C 430 680, 490 630, 520 640
//     C 570 650, 610 650, 640 660
//
//   S/M  (Sahel east / Meridia south-west),  TJ2 → (760,800)
//     C 680 680, 690 710, 700 720
//     C 720 750, 750 770, 760 800
// ---------------------------------------------------------------------------

export const REGIONS: Record<string, RegionDef> = {
  borealis: {
    id: 'borealis',
    nameKey: 'borealis',
    fill: 'var(--color-region-borealis)',
    stroke: 'var(--color-border-strong)',
    // CW perimeter:
    //   1. North coast (NW → NE) with three fjords / two inlets, ~10 cubic
    //      segments.
    //   2. East coast curving SE down to the B/M endpoint (1100, 420).
    //   3. B/M reversed (east → west) → TJ1.
    //   4. B/A reversed (east → west) → (80, 280).
    //   5. West coast (south → north) back to NW corner.
    pathD: [
      'M 80 100',
      // North coast (NW → NE) — irregular with inlets at x≈540 and x≈1000.
      'C 140 90, 180 130, 240 110',
      'C 300 100, 340 75, 400 85',
      'C 460 95, 480 150, 540 130',
      'C 600 110, 640 80, 700 90',
      'C 760 95, 790 70, 840 80',
      'C 900 90, 940 140, 1000 120',
      'C 1060 100, 1100 80, 1160 90',
      'C 1220 100, 1260 75, 1320 85',
      'C 1380 95, 1420 80, 1450 100',
      // East coast (NE → B/M endpoint) — bulges east then curves SW into the
      // strait. Faces the Oriana archipelago across the sea.
      'C 1480 150, 1490 200, 1470 240',
      'C 1450 290, 1410 320, 1370 340',
      'C 1320 360, 1240 360, 1180 390',
      'C 1140 410, 1120 420, 1100 420',
      // B/M reversed — shared with Meridia north coast.
      'C 1070 400, 1040 380, 980 360',
      'C 940 340, 920 390, 860 410',
      'C 820 430, 800 380, 740 360',
      'C 720 340, 680 400, 620 380',
      // B/A reversed — shared with Auriana north coast.
      'C 580 360, 560 340, 500 320',
      'C 460 300, 430 350, 380 360',
      'C 340 370, 300 290, 240 300',
      'C 200 320, 140 250, 80 280',
      // West coast (SW → NW corner).
      'C 60 240, 50 200, 60 160',
      'C 70 130, 75 110, 80 100',
      'Z',
    ].join(' '),
    bounds: { x: 40, y: 60, w: 1460, h: 380 },
    biomes: [
      // Tundra band along the northern coast — pale cool grey strip.
      {
        kind: 'tundra',
        pathD: [
          'M 80 90',
          'C 300 75, 600 80, 900 80',
          'C 1200 80, 1400 90, 1480 100',
          'C 1450 150, 1100 145, 800 140',
          'C 500 140, 200 145, 70 160',
          'C 70 130, 75 110, 80 90 Z',
        ].join(' '),
        opacity: 0.32,
      },
      // Forest patch — dense boreal woodland inland (west).
      { kind: 'forest', cx: 360, cy: 230, rx: 130, ry: 70, opacity: 0.4 },
      // Forest patch — eastern boreal block.
      { kind: 'forest', cx: 1100, cy: 240, rx: 140, ry: 75, opacity: 0.4 },
    ],
    mountains: [
      {
        // East-west spine across the central north.
        peaks: [
          { x: 550, y: 235, width: 12, height: 9 },
          { x: 600, y: 230, width: 14, height: 11 },
          { x: 655, y: 240, width: 11, height: 8 },
          { x: 720, y: 232, width: 13, height: 10 },
          { x: 800, y: 245, width: 12, height: 9 },
          { x: 870, y: 238, width: 14, height: 10 },
          { x: 945, y: 248, width: 11, height: 8 },
        ],
      },
    ],
    rivers: [
      // From the central mountain spine north to the coast.
      {
        pathD: 'M 720 240 C 740 200, 700 170, 730 140 C 760 110, 720 95, 750 85',
      },
    ],
  },
  auriana: {
    id: 'auriana',
    nameKey: 'auriana',
    fill: 'var(--color-region-auriana)',
    stroke: 'var(--color-border-strong)',
    // CW perimeter:
    //   1. B/A forward (NW → TJ1) — shared with Borealis south coast.
    //   2. A/M forward (TJ1 → TJ2) — shared with Meridia west coast.
    //   3. A/S reversed (TJ2 → west coast) — shared with Sahel north coast.
    //   4. West coast (south → north) back to NW corner.
    pathD: [
      'M 80 280',
      // B/A forward.
      'C 140 250, 200 320, 240 300',
      'C 300 290, 340 370, 380 360',
      'C 430 350, 460 300, 500 320',
      'C 560 340, 580 360, 620 380',
      // A/M forward.
      'C 680 420, 640 450, 660 470',
      'C 690 510, 610 540, 640 560',
      'C 680 600, 610 630, 640 660',
      // A/S reversed — shared with Sahel north coast.
      'C 610 650, 570 650, 520 640',
      'C 490 630, 430 680, 380 660',
      'C 340 640, 290 670, 240 640',
      'C 210 620, 180 660, 140 640',
      // West coast (south → north).
      'C 100 580, 90 540, 100 540',
      'C 80 480, 60 440, 80 440',
      'C 60 400, 50 360, 60 360',
      'C 60 340, 70 310, 80 280',
      'Z',
    ].join(' '),
    bounds: { x: 50, y: 290, w: 660, h: 380 },
    biomes: [
      // Coastal plain along the west — lighter sage.
      { kind: 'coastal', cx: 130, cy: 470, rx: 75, ry: 110, opacity: 0.34 },
      // Central forested heartland — darker sage.
      { kind: 'forest', cx: 360, cy: 480, rx: 170, ry: 95, opacity: 0.42 },
      // Small grassland pocket in the SE.
      { kind: 'grassland', cx: 560, cy: 600, rx: 70, ry: 45, opacity: 0.3 },
    ],
    mountains: [
      {
        // Diagonal ridge separating heartland from coastal plain.
        peaks: [
          { x: 220, y: 380, width: 12, height: 9 },
          { x: 260, y: 410, width: 14, height: 10 },
          { x: 300, y: 440, width: 12, height: 9 },
          { x: 340, y: 470, width: 13, height: 10 },
          { x: 380, y: 500, width: 11, height: 8 },
        ],
      },
    ],
    rivers: [
      // From the central ridge SE to the coast.
      {
        pathD: 'M 340 470 C 400 510, 450 540, 500 570 C 540 590, 580 615, 620 660',
      },
    ],
  },
  oriana: {
    id: 'oriana',
    nameKey: 'oriana',
    fill: 'var(--color-region-oriana)',
    stroke: 'var(--color-border-strong)',
    // Seven irregular islands of varying size and shape arranged NE-SW along
    // the eastern edge of the continent, separated from Meridia/Borealis by
    // a narrow strait. Each island is a self-contained closed cubic path
    // (sub-path with its own M/Z); no two share a silhouette. Sizes:
    //   tenshido  (large, NE-SW elongated)        ≈ 240×130
    //   hakaria   (medium-large, kidney)          ≈ 110×90
    //   aolan     (medium, rounded triangle)      ≈ 120×90
    //   sankai    (medium, sickle)                ≈ 115×70
    //   mireku    (medium-small, rounded blob)    ≈ 85×60
    //   pelagia   (medium-small, elongated)       ≈ 100×60
    //   islet     (dot, no country)               ≈ 35×25
    pathD: [
      // tenshido isle — large irregular oblong.
      'M 1220 360',
      'C 1250 320, 1300 310, 1340 320',
      'C 1390 330, 1420 360, 1440 390',
      'C 1450 420, 1430 440, 1390 440',
      'C 1340 450, 1290 440, 1250 420',
      'C 1210 400, 1200 380, 1220 360',
      'Z',
      // hakaria isle — kidney-shaped.
      'M 1460 380',
      'C 1500 370, 1540 380, 1560 410',
      'C 1570 440, 1550 460, 1510 450',
      'C 1480 460, 1455 440, 1450 415',
      'C 1450 400, 1455 385, 1460 380',
      'Z',
      // aolan isle — rounded triangle.
      'M 1180 510',
      'C 1210 495, 1250 500, 1280 520',
      'C 1290 545, 1270 575, 1240 580',
      'C 1210 580, 1180 565, 1170 545',
      'C 1170 525, 1175 515, 1180 510',
      'Z',
      // sankai isle — sickle.
      'M 1370 530',
      'C 1410 520, 1450 535, 1470 560',
      'C 1470 580, 1440 590, 1410 585',
      'C 1380 590, 1360 575, 1355 555',
      'C 1355 540, 1360 533, 1370 530',
      'Z',
      // tiny islet between aolan and sankai — no country lives here.
      'M 1320 575',
      'C 1330 570, 1345 575, 1350 583',
      'C 1348 592, 1335 595, 1325 590',
      'C 1318 585, 1318 580, 1320 575',
      'Z',
      // pelagia isle — elongated east-west.
      'M 1260 690',
      'C 1290 680, 1330 690, 1345 710',
      'C 1340 730, 1310 740, 1280 730',
      'C 1255 725, 1245 710, 1248 700',
      'C 1250 695, 1255 692, 1260 690',
      'Z',
      // mireku isle — small rounded blob.
      'M 1460 670',
      'C 1490 660, 1525 670, 1540 695',
      'C 1535 715, 1510 720, 1485 715',
      'C 1465 712, 1455 700, 1455 685',
      'C 1455 678, 1457 673, 1460 670',
      'Z',
    ].join(' '),
    bounds: { x: 1170, y: 300, w: 400, h: 450 },
    biomes: [
      // Volcanic peaks on the major islands — darker centres.
      { kind: 'volcanic', cx: 1330, cy: 380, rx: 50, ry: 22, opacity: 0.45 },
      { kind: 'volcanic', cx: 1230, cy: 545, rx: 32, ry: 22, opacity: 0.42 },
      { kind: 'volcanic', cx: 1415, cy: 558, rx: 30, ry: 14, opacity: 0.42 },
      // Coastal rings — lighter ringed edges.
      { kind: 'coastal', cx: 1500, cy: 420, rx: 36, ry: 22, opacity: 0.3 },
      { kind: 'coastal', cx: 1495, cy: 695, rx: 28, ry: 20, opacity: 0.3 },
    ],
    mountains: [
      {
        // Tenshido volcanic ridge.
        peaks: [
          { x: 1290, y: 388, width: 12, height: 10 },
          { x: 1320, y: 380, width: 14, height: 12 },
          { x: 1355, y: 388, width: 12, height: 10 },
        ],
      },
      {
        // Aolan single peak.
        peaks: [{ x: 1220, y: 552, width: 13, height: 11 }],
      },
    ],
    // No major rivers — small volcanic islands.
  },
  meridia: {
    id: 'meridia',
    nameKey: 'meridia',
    fill: 'var(--color-region-meridia)',
    stroke: 'var(--color-border-strong)',
    // CW perimeter:
    //   1. B/M forward (TJ1 → east coast endpoint).
    //   2. East coast (north → south) with a small cape at y≈600.
    //   3. South coast (east → west) back to the S/M endpoint.
    //   4. S/M reversed (south → TJ2) — shared with Sahel east coast.
    //   5. A/M reversed (TJ2 → TJ1) — shared with Auriana east coast.
    pathD: [
      'M 620 380',
      // B/M forward.
      'C 680 400, 720 340, 740 360',
      'C 800 380, 820 430, 860 410',
      'C 920 390, 940 340, 980 360',
      'C 1040 380, 1070 400, 1100 420',
      // East coast (top → south-east cape → south coast endpoint).
      'C 1130 460, 1140 480, 1140 500',
      'C 1150 540, 1170 580, 1160 600',
      'C 1150 640, 1160 680, 1140 700',
      'C 1130 730, 1110 760, 1080 780',
      // South coast (east → west).
      'C 1040 805, 1000 820, 980 820',
      'C 940 825, 900 825, 880 820',
      'C 850 815, 830 815, 820 810',
      'C 800 805, 780 800, 760 800',
      // S/M reversed.
      'C 750 770, 720 750, 700 720',
      'C 690 710, 680 680, 640 660',
      // A/M reversed.
      'C 610 630, 680 600, 640 560',
      'C 610 540, 690 510, 660 470',
      'C 640 450, 680 420, 620 380',
      'Z',
    ].join(' '),
    bounds: { x: 600, y: 340, w: 590, h: 500 },
    biomes: [
      // Mediterranean coastal tint along the eastern coast.
      { kind: 'coastal', cx: 1100, cy: 540, rx: 65, ry: 130, opacity: 0.32 },
      // Inland highland — darker, slightly bluer.
      { kind: 'highland', cx: 800, cy: 580, rx: 110, ry: 90, opacity: 0.38 },
      // Fertile plain in the south — lighter, warmer.
      { kind: 'fertile', cx: 940, cy: 760, rx: 130, ry: 50, opacity: 0.34 },
    ],
    mountains: [
      {
        // NE-SW interior spine.
        peaks: [
          { x: 770, y: 540, width: 13, height: 10 },
          { x: 810, y: 555, width: 14, height: 11 },
          { x: 850, y: 575, width: 12, height: 9 },
          { x: 890, y: 595, width: 13, height: 10 },
          { x: 925, y: 620, width: 11, height: 8 },
        ],
      },
    ],
    rivers: [
      // From the highland spine south to the coast.
      {
        pathD: 'M 830 575 C 880 640, 920 700, 950 740 C 980 770, 980 800, 1000 820',
      },
    ],
  },
  'sahel-karoun': {
    id: 'sahel-karoun',
    nameKey: 'sahel-karoun',
    fill: 'var(--color-region-sahel)',
    stroke: 'var(--color-border-strong)',
    // CW perimeter:
    //   1. A/S forward (NW → TJ2).
    //   2. S/M forward (TJ2 → south coast endpoint).
    //   3. South coast (east → west) with a small peninsula at x≈420.
    //   4. West coast (south → north) back to NW corner.
    pathD: [
      'M 140 640',
      // A/S forward.
      'C 180 660, 210 620, 240 640',
      'C 290 670, 340 640, 380 660',
      'C 430 680, 490 630, 520 640',
      'C 570 650, 610 650, 640 660',
      // S/M forward.
      'C 680 680, 690 710, 700 720',
      'C 720 750, 750 770, 760 800',
      // South coast (east → west) — peninsula bulges south around x=420.
      'C 740 820, 720 830, 700 830',
      'C 650 845, 610 820, 580 810',
      'C 540 805, 510 850, 480 860',
      'C 450 870, 430 875, 420 870',
      'C 400 865, 380 855, 360 850',
      'C 320 845, 290 845, 260 840',
      'C 230 838, 200 834, 180 830',
      // West coast (south → north).
      'C 140 810, 110 790, 100 780',
      'C 90 760, 110 720, 120 700',
      'C 130 680, 130 660, 140 640',
      'Z',
    ].join(' '),
    bounds: { x: 80, y: 660, w: 700, h: 230 },
    biomes: [
      // Mixed savanna across the northern strip (greener).
      { kind: 'savanna', cx: 380, cy: 700, rx: 250, ry: 35, opacity: 0.32 },
      // Desert across the southern two-thirds — paler sand.
      {
        kind: 'desert',
        pathD: [
          'M 160 770',
          'C 280 760, 420 765, 560 770',
          'C 660 775, 720 790, 730 810',
          'C 700 845, 540 855, 400 860',
          'C 280 855, 180 830, 150 810',
          'C 150 790, 155 778, 160 770 Z',
        ].join(' '),
        opacity: 0.38,
      },
      // Oasis cluster — small fertile pocket near the eastern edge.
      { kind: 'oasis', cx: 620, cy: 770, rx: 22, ry: 14, opacity: 0.45 },
    ],
    mountains: [
      {
        // Small range along the western edge.
        peaks: [
          { x: 175, y: 720, width: 11, height: 9 },
          { x: 200, y: 735, width: 12, height: 10 },
          { x: 225, y: 745, width: 11, height: 9 },
        ],
      },
    ],
    rivers: [
      // From west mountains east through the oasis to the coast.
      {
        pathD: 'M 200 735 C 320 770, 460 760, 560 775 C 620 780, 660 800, 700 830',
      },
    ],
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

  // Mondo Contemporaneo extras --------------------------------------------
  // The MC scenario uses non-legacy region ids (mc-africa, mc-oceania) that
  // the board-style world map does not paint as silhouettes. We still place
  // these three nations on plausible board coordinates inside Sahel-Karoun
  // (Africa) and the open sea south of Oriana (Oceania) so the world overview
  // shows them rather than leaving silent gaps. validateGeometry tolerates
  // the unknown regionId case (it warns rather than errors) so a missing
  // legacy region won't fail the dev-time check.
  'mc-kenya': { x: 700, y: 770, sizeHint: 1 },
  'mc-australia': { x: 1380, y: 800, sizeHint: 2 },
  'mc-new-zealand': { x: 1500, y: 830, sizeHint: 1 },
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

/**
 * Optional second argument: when supplied, validateGeometry additionally
 * reports any NATION_POSITIONS entry that is not claimed by any known
 * scenario. We accept the full union as a parameter (rather than scoping to
 * the current scenario) because positions are shared across scenarios —
 * flagging an aurion position as "stale" while running mondo-contemporaneo
 * would be a false positive. Callers from the runtime renderer typically
 * omit this argument; a build/test helper can pass the union to catch true
 * drift early.
 */
export function validateGeometry(
  countries: CountryGeometryEntry[],
  allKnownCountryIds?: ReadonlySet<string>,
): string[] {
  const warnings: string[] = [];

  for (const c of countries) {
    const pos = NATION_POSITIONS[c.id];
    if (!pos) {
      warnings.push(
        `[Map] Missing NATION_POSITIONS entry for country "${c.id}".`,
      );
      continue;
    }
    const region = REGIONS[c.regionId];
    if (!region) {
      // The scenario uses a region id that this map doesn't paint as a
      // silhouette (e.g. Mondo Contemporaneo / Guerra Fredda regions). The
      // country still renders by its absolute coordinates, so this is an
      // info-only condition rather than a layout bug.
      continue;
    }
    const { x, y, w, h } = region.bounds;
    if (pos.x < x || pos.x > x + w || pos.y < y || pos.y > y + h) {
      warnings.push(
        `[Map] Position for "${c.id}" (${pos.x},${pos.y}) is outside region "${c.regionId}" bounds.`,
      );
    }
  }

  if (allKnownCountryIds) {
    for (const id of Object.keys(NATION_POSITIONS)) {
      if (!allKnownCountryIds.has(id)) {
        warnings.push(
          `[Map] NATION_POSITIONS has stale entry "${id}" (no scenario claims this id).`,
        );
      }
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

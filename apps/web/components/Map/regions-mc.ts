// Stylised continent silhouettes for the **Mondo Contemporaneo** scenario.
// Same SVG coordinate system as `regions.ts` (1600 x 900), but the shapes
// approximate real-world continents (Americas, Europe, Africa, Middle-East,
// Asia-Pacific, Oceania) so the country dots land on geographically plausible
// landmasses rather than on the Aurion-fantasy silhouettes.
//
// The geometry is intentionally editorial — smooth Bézier coastlines, no
// political detail — and is sized to fit the same PLAY_BOUNDS as the Aurion
// map so the renderer doesn't need a different viewBox.
//
// IMPORTANT: this module only defines NEW regions. It must not mutate
// `REGIONS` in `regions.ts` (that file is owned by the Aurion-world geometry
// pass). The WorldMap component picks between region sets at render time.

import type { CountryId } from '@aurion/engine';

import type { NationPosition, RegionDef } from './regions';

// ---------------------------------------------------------------------------
// MC continent silhouettes — stylised, smooth Bézier perimeters. Each region
// reads as its continent at a glance ("ah, Africa") without being literal.
// ---------------------------------------------------------------------------

export const MC_REGIONS: Record<string, RegionDef> = {
  'mc-americas': {
    id: 'mc-americas',
    nameKey: 'mc-americas',
    fill: 'var(--color-region-auriana)', // sage — temperate continent
    stroke: 'var(--color-border-strong)',
    // North America (broad top, jagged west coast) → narrows at Panama
    // isthmus around y=500 → South America (angled SE, broader at Brazil).
    pathD: [
      'M 90 110',
      'C 130 95, 220 90, 310 105',
      'C 360 115, 400 130, 420 165',
      'C 430 200, 415 240, 395 275',
      'C 370 315, 345 345, 335 385',
      'C 325 425, 340 460, 325 490',
      'C 305 515, 270 510, 250 505', // panama pinch
      'C 240 525, 245 555, 255 590',
      'C 275 640, 305 680, 320 720',
      'C 335 760, 320 800, 280 815',
      'C 240 825, 200 815, 175 790',
      'C 155 760, 150 720, 140 685',
      'C 130 645, 120 600, 110 555',
      'C 90 500, 65 460, 70 410',
      'C 75 365, 95 325, 105 280',
      'C 115 235, 90 195, 80 165',
      'C 75 140, 75 120, 90 110 Z',
    ].join(' '),
    bounds: { x: 60, y: 90, w: 380, h: 740 },
    biomes: [
      // Amazon forest in central South America.
      { kind: 'forest', cx: 230, cy: 650, rx: 80, ry: 90, opacity: 0.4 },
      // Great Plains / midwest.
      { kind: 'grassland', cx: 230, cy: 250, rx: 75, ry: 70, opacity: 0.3 },
    ],
    mountains: [
      {
        // Rockies + Andes — a single long N-S spine on the west.
        peaks: [
          { x: 130, y: 200, width: 12, height: 10 },
          { x: 130, y: 250, width: 13, height: 11 },
          { x: 140, y: 310, width: 12, height: 10 },
          { x: 160, y: 380, width: 11, height: 9 },
          { x: 175, y: 450, width: 12, height: 10 },
          { x: 180, y: 560, width: 12, height: 10 },
          { x: 195, y: 650, width: 13, height: 11 },
          { x: 200, y: 740, width: 11, height: 9 },
        ],
      },
    ],
    rivers: [
      // Amazon east-flowing.
      { pathD: 'M 200 660 C 250 670, 290 660, 320 690 C 330 705, 325 720, 320 720' },
    ],
  },

  'mc-europe': {
    id: 'mc-europe',
    nameKey: 'mc-europe',
    fill: 'var(--color-region-borealis)', // slate — temperate northern
    stroke: 'var(--color-border-strong)',
    // Compact irregular northern Mediterranean shape with Iberian bulge,
    // Scandinavian "horn" at top, British Isles as 2 detached specks.
    pathD: [
      // Mainland Europe
      'M 560 165',
      'C 600 145, 640 150, 670 170', // Scandinavian horn
      'C 690 155, 715 145, 735 160',
      'C 755 180, 745 215, 730 240',
      'C 760 245, 790 260, 800 285',
      'C 805 310, 785 330, 760 335',
      'C 720 340, 680 335, 650 320',
      'C 620 310, 595 320, 575 305',
      'C 560 285, 555 260, 555 235', // Iberian bulge on the west
      'C 540 225, 530 205, 540 185',
      'C 545 175, 552 168, 560 165 Z',
      // British Isles — two detached specks
      'M 545 175',
      'C 540 170, 535 175, 535 185',
      'C 535 195, 540 200, 548 200',
      'C 552 195, 553 185, 548 178',
      'C 547 176, 546 175, 545 175 Z',
      'M 525 200',
      'C 520 198, 517 204, 520 210',
      'C 524 213, 528 211, 528 206',
      'C 528 202, 527 200, 525 200 Z',
    ].join(' '),
    bounds: { x: 510, y: 140, w: 300, h: 210 },
    biomes: [
      // Mediterranean coastal south.
      { kind: 'coastal', cx: 690, cy: 305, rx: 80, ry: 30, opacity: 0.32 },
      // Central forested heartland.
      { kind: 'forest', cx: 680, cy: 230, rx: 70, ry: 50, opacity: 0.38 },
    ],
    mountains: [
      {
        // Alps — a small east-west cluster across central Europe.
        peaks: [
          { x: 650, y: 270, width: 12, height: 10 },
          { x: 685, y: 265, width: 14, height: 12 },
          { x: 720, y: 275, width: 12, height: 10 },
        ],
      },
    ],
    rivers: [
      // Danube-ish, west to east.
      { pathD: 'M 650 270 C 690 280, 720 285, 760 300' },
    ],
  },

  'mc-africa': {
    id: 'mc-africa',
    nameKey: 'mc-africa',
    fill: 'var(--color-region-sahel)', // sand
    stroke: 'var(--color-border-strong)',
    // Distinctive teardrop: broader at the Sahara (top), narrowing south.
    pathD: [
      'M 600 365',
      'C 640 350, 700 345, 760 350',
      'C 800 355, 840 365, 860 385', // bulge for the "horn" toward Middle East
      'C 875 410, 870 445, 855 470',
      'C 860 510, 855 550, 840 590',
      'C 825 630, 805 670, 780 710',
      'C 760 745, 740 775, 715 795',
      'C 690 815, 660 815, 640 795',
      'C 615 770, 605 735, 600 700',
      'C 595 665, 605 630, 615 595',
      'C 605 555, 595 515, 600 475',
      'C 600 440, 595 405, 600 380',
      'C 600 372, 600 368, 600 365 Z',
    ].join(' '),
    bounds: { x: 580, y: 345, w: 295, h: 480 },
    biomes: [
      // Sahara across the north.
      { kind: 'desert', cx: 720, cy: 420, rx: 130, ry: 55, opacity: 0.4 },
      // Congo basin forest.
      { kind: 'forest', cx: 690, cy: 620, rx: 70, ry: 70, opacity: 0.4 },
      // Southern savanna.
      { kind: 'savanna', cx: 680, cy: 760, rx: 70, ry: 40, opacity: 0.3 },
    ],
    mountains: [
      {
        // Ethiopian highlands — small east-side cluster.
        peaks: [
          { x: 820, y: 500, width: 11, height: 9 },
          { x: 845, y: 510, width: 13, height: 11 },
          { x: 830, y: 535, width: 11, height: 9 },
        ],
      },
    ],
    rivers: [
      // Nile-ish, north flowing.
      { pathD: 'M 760 700 C 770 600, 760 500, 770 410' },
    ],
  },

  'mc-middle-east': {
    id: 'mc-middle-east',
    nameKey: 'mc-middle-east',
    fill: 'var(--color-region-meridia)', // ochre
    stroke: 'var(--color-border-strong)',
    // Small irregular shape between Africa's horn and Asia-Pacific's west.
    // Sits roughly where Arabia / Anatolia / Iran would be.
    pathD: [
      'M 830 290',
      'C 870 280, 920 285, 960 300',
      'C 985 310, 1000 330, 995 355',
      'C 985 380, 960 395, 935 405',
      'C 920 425, 900 445, 875 450',
      'C 850 450, 830 430, 820 405',
      'C 815 380, 825 355, 830 335',
      'C 825 320, 823 305, 830 290 Z',
    ].join(' '),
    bounds: { x: 815, y: 280, w: 185, h: 175 },
    biomes: [
      // Arabian desert.
      { kind: 'desert', cx: 905, cy: 380, rx: 70, ry: 50, opacity: 0.4 },
      // Fertile crescent strip.
      { kind: 'fertile', cx: 880, cy: 320, rx: 60, ry: 20, opacity: 0.35 },
    ],
    mountains: [
      {
        // Zagros — east cluster.
        peaks: [
          { x: 950, y: 350, width: 11, height: 9 },
          { x: 975, y: 360, width: 13, height: 11 },
          { x: 965, y: 380, width: 11, height: 9 },
        ],
      },
    ],
    rivers: [
      // Tigris-Euphrates-ish.
      { pathD: 'M 950 320 C 920 360, 900 400, 905 440' },
    ],
  },

  'mc-asia-pacific': {
    id: 'mc-asia-pacific',
    nameKey: 'mc-asia-pacific',
    fill: 'var(--color-region-oriana)', // teal
    stroke: 'var(--color-border-strong)',
    // Big eastern landmass with Indian peninsula (south-west bulge), SE Asia
    // extension (lower south), Japan as a small detached arc of islands.
    pathD: [
      // Eurasian mainland (east of the Middle East zone)
      'M 980 130',
      'C 1080 110, 1200 105, 1320 115',
      'C 1420 125, 1500 140, 1540 175',
      'C 1545 215, 1525 255, 1490 285',
      'C 1450 315, 1395 335, 1330 350',
      'C 1290 365, 1250 365, 1215 360',
      'C 1190 395, 1165 425, 1135 450', // SE Asia extension
      'C 1110 475, 1085 490, 1060 480',
      'C 1045 460, 1050 430, 1065 405',
      'C 1080 380, 1095 360, 1095 335',
      // India peninsula (south-west bulge)
      'C 1075 350, 1050 370, 1035 405',
      'C 1020 440, 1015 480, 1030 510',
      'C 1045 530, 1075 525, 1090 500',
      'C 1095 470, 1100 440, 1105 410',
      'C 1115 380, 1130 355, 1140 330',
      'C 1110 320, 1080 305, 1050 290',
      'C 1020 275, 995 250, 985 215',
      'C 975 180, 970 150, 980 130 Z',
      // Japan archipelago — small arc of 3 islands NE of mainland
      'M 1500 320',
      'C 1495 315, 1488 318, 1490 326',
      'C 1494 332, 1502 330, 1505 324',
      'C 1505 320, 1503 318, 1500 320 Z',
      'M 1520 350',
      'C 1515 348, 1510 354, 1514 360',
      'C 1520 363, 1525 358, 1525 354',
      'C 1525 350, 1523 348, 1520 350 Z',
      'M 1535 380',
      'C 1530 380, 1528 384, 1531 388',
      'C 1535 390, 1538 388, 1539 384',
      'C 1539 382, 1537 380, 1535 380 Z',
      // SE Asian island arc — Indonesia / Philippines as detached specks
      'M 1180 510',
      'C 1175 505, 1170 510, 1175 518',
      'C 1182 522, 1190 518, 1188 511',
      'C 1186 508, 1183 508, 1180 510 Z',
      'M 1240 540',
      'C 1232 535, 1225 545, 1232 552',
      'C 1240 555, 1248 549, 1245 542',
      'C 1244 540, 1242 539, 1240 540 Z',
      'M 1300 560',
      'C 1295 558, 1290 564, 1295 569',
      'C 1300 572, 1305 568, 1304 564',
      'C 1303 561, 1302 560, 1300 560 Z',
    ].join(' '),
    bounds: { x: 1010, y: 105, w: 540, h: 470 },
    biomes: [
      // Siberian forest north.
      { kind: 'forest', cx: 1300, cy: 180, rx: 160, ry: 50, opacity: 0.4 },
      // Gobi / steppe central.
      { kind: 'grassland', cx: 1310, cy: 260, rx: 130, ry: 35, opacity: 0.3 },
      // SE Asia tropical.
      { kind: 'forest', cx: 1110, cy: 430, rx: 50, ry: 40, opacity: 0.4 },
    ],
    mountains: [
      {
        // Himalayas — a strong east-west spine.
        peaks: [
          { x: 1080, y: 340, width: 13, height: 11 },
          { x: 1130, y: 335, width: 15, height: 13 },
          { x: 1180, y: 340, width: 14, height: 12 },
          { x: 1235, y: 345, width: 13, height: 11 },
          { x: 1290, y: 350, width: 12, height: 10 },
        ],
      },
    ],
    rivers: [
      // Ganges-ish, south flowing from Himalayas.
      { pathD: 'M 1130 345 C 1100 400, 1080 460, 1060 500' },
    ],
  },

  'mc-oceania': {
    id: 'mc-oceania',
    nameKey: 'mc-oceania',
    fill: 'var(--color-region-meridia)', // ochre — re-used hue, distinct geography
    stroke: 'var(--color-border-strong)',
    // Australia as a fat oval island, New Zealand as 2 smaller specks SE.
    pathD: [
      // Australia mainland — fat oval, slightly indented in the south
      'M 1240 720',
      'C 1290 700, 1360 695, 1420 705',
      'C 1465 715, 1490 740, 1485 770',
      'C 1475 795, 1430 810, 1380 815',
      'C 1330 815, 1280 805, 1250 790',
      'C 1225 775, 1215 750, 1225 730',
      'C 1230 723, 1235 721, 1240 720 Z',
      // New Zealand — 2 small islands SE
      'M 1485 825',
      'C 1480 822, 1475 828, 1480 836',
      'C 1486 840, 1495 836, 1493 829',
      'C 1492 826, 1488 824, 1485 825 Z',
      'M 1510 850',
      'C 1505 848, 1502 852, 1505 856',
      'C 1510 858, 1513 855, 1513 853',
      'C 1513 851, 1512 850, 1510 850 Z',
    ].join(' '),
    bounds: { x: 1210, y: 695, w: 310, h: 165 },
    biomes: [
      // Outback desert centre.
      { kind: 'desert', cx: 1355, cy: 760, rx: 100, ry: 40, opacity: 0.4 },
      // Eastern coastal greenery.
      { kind: 'coastal', cx: 1450, cy: 760, rx: 25, ry: 45, opacity: 0.3 },
    ],
    mountains: [
      {
        // Great Dividing Range — east coast.
        peaks: [
          { x: 1440, y: 740, width: 11, height: 9 },
          { x: 1450, y: 760, width: 12, height: 10 },
          { x: 1445, y: 785, width: 11, height: 9 },
        ],
      },
    ],
    rivers: [
      // Murray river-ish.
      { pathD: 'M 1450 760 C 1400 780, 1340 790, 1290 785' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Nation positions for the MC scenario. Each country sits at a plausible
// real-world location inside its parent continent silhouette.
//
// Coordinates are picked so the dot is comfortably inside the polygon — the
// regions are stylised, so the latitude/longitude is approximate, but each
// country lives where a player would expect it (USA upper-mid Americas,
// India in the SW bulge of Asia, etc.).
// ---------------------------------------------------------------------------

export const MC_NATION_POSITIONS: Record<string, NationPosition> = {
  // Americas
  'mc-usa': { x: 200, y: 270, sizeHint: 3 },
  'mc-canada': { x: 230, y: 170, sizeHint: 2 },
  'mc-mexico': { x: 195, y: 410, sizeHint: 2 },
  'mc-brazil': { x: 250, y: 660, sizeHint: 3 },
  'mc-argentina': { x: 220, y: 780, sizeHint: 2 },
  'mc-colombia': { x: 195, y: 570, sizeHint: 1 },

  // Europe
  'mc-uk': { x: 620, y: 215, sizeHint: 2 },
  'mc-france': { x: 640, y: 260, sizeHint: 2 },
  'mc-germany': { x: 680, y: 235, sizeHint: 3 },
  'mc-italy': { x: 700, y: 295, sizeHint: 2 },
  'mc-spain': { x: 600, y: 290, sizeHint: 2 },
  'mc-poland': { x: 730, y: 220, sizeHint: 2 },
  'mc-sweden': { x: 700, y: 175, sizeHint: 1 },

  // Africa
  'mc-egypt': { x: 770, y: 410, sizeHint: 2 },
  'mc-nigeria': { x: 670, y: 525, sizeHint: 2 },
  'mc-kenya': { x: 770, y: 600, sizeHint: 1 },
  'mc-south-africa': { x: 700, y: 770, sizeHint: 2 },

  // Middle East
  'mc-turkey': { x: 870, y: 320, sizeHint: 2 },
  'mc-iran': { x: 950, y: 360, sizeHint: 2 },
  'mc-saudi-arabia': { x: 910, y: 410, sizeHint: 2 },
  'mc-israel': { x: 840, y: 360, sizeHint: 1 },

  // Asia-Pacific
  'mc-china': { x: 1340, y: 240, sizeHint: 3 },
  'mc-india': { x: 1075, y: 430, sizeHint: 3 },
  'mc-japan': { x: 1518, y: 350, sizeHint: 2 },
  'mc-south-korea': { x: 1465, y: 290, sizeHint: 2 },
  'mc-vietnam': { x: 1240, y: 405, sizeHint: 1 },
  'mc-thailand': { x: 1195, y: 415, sizeHint: 1 },
  'mc-indonesia': { x: 1245, y: 542, sizeHint: 2 },

  // Oceania
  'mc-australia': { x: 1360, y: 760, sizeHint: 2 },
  'mc-new-zealand': { x: 1490, y: 832, sizeHint: 1 },
};

// Re-export the country id helper type so the WorldMap branch can stay
// strongly typed when it merges region sets.
export type McCountryId = CountryId;

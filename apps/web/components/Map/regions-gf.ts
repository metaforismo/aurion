// Stylised bloc silhouettes for the **Guerra Fredda** scenario.
//
// Cold War "regions" are political blocs, not contiguous landmasses, so each
// region is rendered as a MULTI-PATH silhouette — the same SVG path string
// contains several disconnected sub-paths (each starting with `M`), tinted
// with the bloc's semantic colour. The renderer is already happy with this
// (see how Aurion's `oriana` paints six islands).
//
// Colour convention:
//   - NATO / North Atlantic   → steel blue   (`--color-info`)
//   - Warsaw Pact             → muted red    (`--color-danger`)
//   - Non-Aligned             → neutral grey (`--color-fg-muted`)
//   - Global South            → warm sand    (`--color-region-sahel`)
//   - Asian Tigers            → teal         (`--color-region-oriana`)

import type { CountryId } from '@aurion/engine';

import type { NationPosition, RegionDef } from './regions';

export const GF_REGIONS: Record<string, RegionDef> = {
  'gf-north-atlantic': {
    id: 'gf-north-atlantic',
    nameKey: 'gf-north-atlantic',
    fill: 'var(--color-info)',
    stroke: 'var(--color-border-strong)',
    // Two sub-paths: North America (left) + Western Europe (centre-top).
    pathD: [
      // North America block
      'M 90 130',
      'C 140 110, 220 105, 300 120',
      'C 360 135, 405 160, 420 200',
      'C 425 245, 405 290, 375 320',
      'C 340 355, 290 380, 240 395',
      'C 190 405, 145 395, 110 370',
      'C 80 340, 65 295, 65 245',
      'C 65 200, 75 165, 90 130 Z',
      // Western Europe block
      'M 580 170',
      'C 620 155, 680 155, 730 170',
      'C 760 185, 775 215, 770 245',
      'C 760 275, 730 295, 695 305',
      'C 660 315, 620 310, 590 295',
      'C 565 280, 555 250, 555 220',
      'C 555 200, 565 180, 580 170 Z',
    ].join(' '),
    bounds: { x: 60, y: 105, w: 720, h: 320 },
  },

  'gf-warsaw-pact': {
    id: 'gf-warsaw-pact',
    nameKey: 'gf-warsaw-pact',
    fill: 'var(--color-danger)',
    stroke: 'var(--color-border-strong)',
    // One long horizontal landmass: Eastern Europe through the USSR.
    pathD: [
      'M 790 165',
      'C 850 145, 950 135, 1080 140',
      'C 1240 145, 1380 155, 1490 175',
      'C 1525 195, 1535 225, 1525 260',
      'C 1505 295, 1450 320, 1380 335',
      'C 1280 350, 1160 350, 1040 340',
      'C 950 330, 870 315, 815 295',
      'C 785 275, 775 245, 780 215',
      'C 783 195, 786 178, 790 165 Z',
    ].join(' '),
    bounds: { x: 775, y: 135, w: 770, h: 215 },
  },

  'gf-non-aligned': {
    id: 'gf-non-aligned',
    nameKey: 'gf-non-aligned',
    fill: 'var(--color-fg-muted)',
    stroke: 'var(--color-border-strong)',
    // Scattered sub-paths: Yugoslavia (Balkans), Egypt, Algeria, India,
    // Indonesia, Cuba. Each is a small organic blob.
    pathD: [
      // Yugoslavia — Balkans
      'M 720 320',
      'C 710 315, 700 325, 705 340',
      'C 715 350, 735 350, 745 340',
      'C 750 330, 745 320, 730 318',
      'C 725 318, 722 318, 720 320 Z',
      // Egypt
      'M 760 410',
      'C 745 405, 730 415, 730 435',
      'C 735 455, 760 462, 780 455',
      'C 795 445, 795 425, 785 415',
      'C 778 410, 770 408, 760 410 Z',
      // Algeria
      'M 615 410',
      'C 590 405, 570 420, 570 445',
      'C 575 470, 605 480, 635 475',
      'C 660 465, 665 445, 655 425',
      'C 645 415, 630 410, 615 410 Z',
      // India
      'M 1080 360',
      'C 1055 360, 1035 380, 1035 415',
      'C 1040 450, 1065 475, 1090 480',
      'C 1115 475, 1130 450, 1130 415',
      'C 1125 385, 1110 365, 1080 360 Z',
      // Indonesia — small archipelago of 2 specks
      'M 1230 540',
      'C 1220 535, 1210 545, 1215 555',
      'C 1230 560, 1250 555, 1250 545',
      'C 1245 540, 1238 538, 1230 540 Z',
      'M 1280 555',
      'C 1273 553, 1268 558, 1272 564',
      'C 1280 567, 1288 562, 1285 557',
      'C 1283 555, 1281 554, 1280 555 Z',
      // Cuba
      'M 290 460',
      'C 280 458, 270 465, 273 475',
      'C 285 482, 305 480, 312 472',
      'C 315 465, 308 458, 295 458',
      'C 293 458, 291 459, 290 460 Z',
    ].join(' '),
    bounds: { x: 270, y: 318, w: 1020, h: 250 },
  },

  'gf-global-south': {
    id: 'gf-global-south',
    nameKey: 'gf-global-south',
    fill: 'var(--color-region-sahel)',
    stroke: 'var(--color-border-strong)',
    // Scattered sub-paths: Nicaragua, Angola, Mozambique, South Africa,
    // Ethiopia, Iran, North Vietnam.
    pathD: [
      // Nicaragua
      'M 230 510',
      'C 220 508, 213 515, 216 525',
      'C 225 532, 245 530, 250 522',
      'C 252 515, 245 508, 235 508',
      'C 233 508, 231 509, 230 510 Z',
      // Angola
      'M 685 645',
      'C 670 642, 658 655, 660 675',
      'C 668 692, 690 700, 705 695',
      'C 720 685, 720 660, 710 650',
      'C 700 645, 690 644, 685 645 Z',
      // Mozambique
      'M 760 695',
      'C 750 692, 742 705, 745 720',
      'C 755 732, 775 732, 785 720',
      'C 790 710, 780 698, 770 695',
      'C 765 694, 762 694, 760 695 Z',
      // South Africa
      'M 680 770',
      'C 660 765, 645 780, 650 800',
      'C 665 815, 695 818, 715 808',
      'C 728 795, 720 775, 705 770',
      'C 695 768, 685 768, 680 770 Z',
      // Ethiopia
      'M 815 530',
      'C 805 527, 795 540, 798 555',
      'C 810 568, 830 568, 838 555',
      'C 842 545, 832 530, 822 528',
      'C 819 528, 817 529, 815 530 Z',
      // Iran
      'M 945 380',
      'C 930 378, 918 392, 922 410',
      'C 935 422, 960 422, 970 410',
      'C 975 398, 965 382, 955 378',
      'C 950 378, 947 378, 945 380 Z',
      // North Vietnam
      'M 1245 405',
      'C 1238 403, 1232 412, 1235 422',
      'C 1245 430, 1260 428, 1265 420',
      'C 1267 412, 1258 403, 1250 403',
      'C 1248 403, 1246 404, 1245 405 Z',
    ].join(' '),
    bounds: { x: 210, y: 378, w: 1060, h: 445 },
  },

  'gf-asian-tigers': {
    id: 'gf-asian-tigers',
    nameKey: 'gf-asian-tigers',
    fill: 'var(--color-region-oriana)',
    stroke: 'var(--color-border-strong)',
    // Four small island/peninsula specks: Japan, South Korea, Taiwan,
    // Hong Kong — clustered in the far east.
    pathD: [
      // Japan
      'M 1500 320',
      'C 1490 315, 1480 325, 1485 340',
      'C 1500 350, 1515 345, 1520 335',
      'C 1520 325, 1510 318, 1500 320 Z',
      // South Korea
      'M 1455 365',
      'C 1448 363, 1442 372, 1446 380',
      'C 1455 385, 1467 382, 1470 375',
      'C 1470 368, 1462 363, 1455 365 Z',
      // Taiwan
      'M 1440 410',
      'C 1434 408, 1428 415, 1432 422',
      'C 1440 427, 1450 423, 1450 418',
      'C 1450 413, 1445 408, 1440 410 Z',
      // Hong Kong
      'M 1395 440',
      'C 1390 438, 1385 443, 1388 448',
      'C 1395 451, 1402 448, 1402 444',
      'C 1402 441, 1399 439, 1395 440 Z',
    ].join(' '),
    bounds: { x: 1380, y: 318, w: 145, h: 140 },
  },
};

// ---------------------------------------------------------------------------
// Nation positions for the GF scenario. Each country sits inside the silhouette
// of its bloc (which means the dot may not be geographically faithful — Cuba
// in the Non-Aligned bloc lives inside the Caribbean speck, even though
// gf-india lives inside the India speck of the SAME region's path). That's
// the natural consequence of mapping by bloc rather than by continent.
// ---------------------------------------------------------------------------

export const GF_NATION_POSITIONS: Record<string, NationPosition> = {
  // North Atlantic (NATO)
  'gf-usa': { x: 210, y: 240, sizeHint: 3 },
  'gf-canada': { x: 240, y: 165, sizeHint: 2 },
  'gf-uk': { x: 600, y: 215, sizeHint: 2 },
  'gf-france': { x: 640, y: 245, sizeHint: 2 },
  'gf-west-germany': { x: 685, y: 220, sizeHint: 2 },
  'gf-italy': { x: 700, y: 275, sizeHint: 2 },
  'gf-spain': { x: 600, y: 270, sizeHint: 2 },

  // Warsaw Pact
  'gf-ussr': { x: 1280, y: 230, sizeHint: 3 },
  'gf-east-germany': { x: 830, y: 205, sizeHint: 2 },
  'gf-poland': { x: 875, y: 200, sizeHint: 2 },
  'gf-czechoslovakia': { x: 900, y: 230, sizeHint: 1 },
  'gf-hungary': { x: 935, y: 255, sizeHint: 1 },
  'gf-romania': { x: 985, y: 245, sizeHint: 1 },

  // Non-Aligned (scattered specks)
  'gf-yugoslavia': { x: 725, y: 335, sizeHint: 1 },
  'gf-egypt': { x: 760, y: 435, sizeHint: 2 },
  'gf-algeria': { x: 615, y: 445, sizeHint: 1 },
  'gf-india': { x: 1085, y: 425, sizeHint: 3 },
  'gf-indonesia': { x: 1235, y: 548, sizeHint: 2 },
  'gf-cuba': { x: 295, y: 470, sizeHint: 1 },

  // Global South
  'gf-nicaragua': { x: 232, y: 520, sizeHint: 1 },
  'gf-angola': { x: 690, y: 670, sizeHint: 1 },
  'gf-mozambique': { x: 765, y: 715, sizeHint: 1 },
  'gf-south-africa': { x: 685, y: 790, sizeHint: 2 },
  'gf-ethiopia': { x: 820, y: 548, sizeHint: 1 },
  'gf-iran': { x: 950, y: 400, sizeHint: 2 },
  'gf-north-vietnam': { x: 1252, y: 418, sizeHint: 1 },

  // Asian Tigers
  'gf-japan': { x: 1502, y: 332, sizeHint: 2 },
  'gf-south-korea': { x: 1457, y: 373, sizeHint: 1 },
  'gf-taiwan': { x: 1442, y: 415, sizeHint: 1 },
  'gf-hong-kong': { x: 1395, y: 445, sizeHint: 1 },
};

export type GfCountryId = CountryId;

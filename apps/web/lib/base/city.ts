// The capital, laid out as a real city: a grid of blocks around the seat of
// government, a business district of towers that grows with the economy,
// apartment and office districts, suburbs of houses with gardens, an
// industrial quarter sized by industry, parks, and the Earth megaprojects on
// the outskirts. Pure and deterministic: the same nation always gets the
// same city, and growth only ever adds to it.

/** Edge of a block, sidewalks included, in metres. */
export const BLOCK = 76;
/** Width of a street between two blocks. */
export const ROAD = 14;
export const PITCH = BLOCK + ROAD;
/** Width of the sidewalk ring inside each block. */
export const SIDEWALK = 4;

export type CityStats = {
  /** GDP compared with the start of the game (1 = unchanged). */
  growth: number;
  population: number;
  /** Industrial share of the economy, 0..1. */
  industry: number;
  research: number;
  army: number;
  /** Earth megaprojects completed. */
  projects: readonly string[];
  /** Earth megaprojects under construction. */
  building: readonly string[];
  /** Extra building sites (a protectorate being integrated…). */
  extraSites: number;
  /** Varies the city between nations. */
  seed: string;
  /** National works standing or going up. */
  works?: readonly WorkState[];
};

/** A national work as the city sees it: what stands, and what is being built. */
export type WorkState = { id: string; level: number; building: number | null };

/** Where a national work stands, and how big its ground is. */
export type WorkSite = WorkState & { x: number; z: number; w: number; d: number; inTown: boolean };

export type Zone = 'core' | 'downtown' | 'midtown' | 'residential' | 'industrial' | 'park' | 'campus' | 'military' | 'civic';

export type LotKind =
  | 'capitol'
  | 'tower'
  | 'office'
  | 'apartment'
  | 'house'
  | 'factory'
  | 'warehouse'
  | 'lab'
  | 'barracks'
  | 'arcology'
  | 'datacenter'
  | 'site';

export type Lot = {
  kind: LotKind;
  /** Centre of the footprint. */
  x: number;
  z: number;
  /** Footprint along x and z. */
  w: number;
  d: number;
  /** Height of the main volume. */
  h: number;
  /** Facade style key (see assets). */
  style: string;
  /** 0..1, for per-building variation. */
  rand: number;
};

export type Block = { i: number; j: number; x: number; z: number; zone: Zone };

export type SpecialKind = 'reactor' | 'spaceport' | 'solarFarm' | 'dishes';
export type Special = { kind: SpecialKind; x: number; z: number; site: boolean };

/** A straight stretch of road, along x (`axis: 'x'`) or z, at a fixed coordinate. */
export type Road = { axis: 'x' | 'z'; at: number; from: number; to: number; width: number };

export type CityLayout = {
  /** Blocks from the centre to the edge of the grid. */
  radius: number;
  blocks: Block[];
  lots: Lot[];
  specials: Special[];
  roads: Road[];
  /** Power line pylons, in order. */
  pylons: { x: number; z: number }[];
  /** Half-size of the built-up area, outskirts included. */
  extent: number;
  /** National works and their grounds. */
  works: WorkSite[];
};

/** Works with a whole city block of their own, and which block. */
const TOWN_WORKS: Record<string, [number, number]> = { exchange: [1, 0], hospital: [-1, 1], intel_hq: [-1, -1] };

/**
 * Works out of town: bearing (degrees, x east / z north), distance beyond
 * the built edge, and the size of their grounds.
 */
const OUT_WORKS: Record<string, { angle: number; dist: number; w: number; d: number }> = {
  university: { angle: 118, dist: 150, w: 190, d: 150 },
  datacenter: { angle: 5, dist: 90, w: 160, d: 120 },
  nuclear: { angle: -18, dist: 260, w: 260, d: 180 },
  solar: { angle: -55, dist: 170, w: 210, d: 170 },
  fusion_lab: { angle: -122, dist: 150, w: 180, d: 150 },
  airport: { angle: -160, dist: 330, w: 720, d: 260 },
  observatory: { angle: 140, dist: 290, w: 170, d: 150 },
  collider: { angle: 40, dist: 60, w: 560, d: 560 },
};

/** Deterministic hash of a string and two numbers, 0..1. */
export function rand(seed: string, a: number, b: number): number {
  let h = 2166136261;
  const s = `${seed}|${a}|${b}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const TOWER_STYLES = ['glass_blue', 'glass_teal', 'glass_bronze', 'glass_dark', 'office_cladding'];
const OFFICE_STYLES = ['office_concrete', 'office_cladding', 'glass_teal', 'glass_blue'];
const APARTMENT_STYLES = ['apartment_plaster', 'apartment_yellow', 'apartment_brick', 'apartment_plaster'];
const HOUSE_STYLES = ['house_plaster', 'house_brick', 'house_yellow'];

function pick<T>(list: readonly T[], r: number): T {
  return list[Math.min(list.length - 1, Math.floor(r * list.length))]!;
}

export function layoutCity(stats: CityStats): CityLayout {
  const seed = stats.seed;
  const g = Math.max(0.3, stats.growth);
  const growthBoost = Math.log2(g + 1);
  // The grid grows with the population.
  const radius = Math.max(3, Math.min(6, Math.round(2.6 + 0.55 * Math.log10(stats.population / 1e5 + 1) + 0.6 * (growthBoost - 1))));
  const downtownR = 1.05 + 0.85 * growthBoost;
  const midtownR = downtownR + 1.4;
  const builtR = Math.min(radius + 0.5, 2.4 + 0.9 * Math.log10(stats.population / 1e5 + 1) + 0.5 * growthBoost);

  const has = (p: string) => stats.projects.includes(p);
  const building = (p: string) => stats.building.includes(p);

  // Zoning.
  const blocks: Block[] = [];
  const industrialCount = Math.round(2 + stats.industry * 10 * Math.sqrt(g));
  const industrialSlots: { i: number; j: number }[] = [];
  for (let col = radius; col >= radius - 2 && industrialSlots.length < industrialCount; col -= 1) {
    for (const j of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]) {
      if (Math.abs(j) > radius || industrialSlots.length >= industrialCount) continue;
      industrialSlots.push({ i: col, j });
    }
  }
  const industrial = new Set(industrialSlots.map((s) => `${s.i},${s.j}`));

  for (let i = -radius; i <= radius; i += 1) {
    for (let j = -radius; j <= radius; j += 1) {
      const dist = Math.hypot(i, j);
      let zone: Zone | null = null;
      if (i === 0 && j === 0) zone = 'core';
      else if (industrial.has(`${i},${j}`)) zone = 'industrial';
      else if (dist <= downtownR) zone = 'downtown';
      else if (dist <= midtownR) zone = rand(seed, i * 7, j * 13) < 0.12 ? 'park' : 'midtown';
      else if (dist <= builtR) zone = rand(seed, i * 11, j * 5) < 0.1 ? 'park' : 'residential';
      if (zone) blocks.push({ i, j, x: i * PITCH, z: j * PITCH, zone });
    }
  }
  // National works with a block of their own in town.
  const worksById = new Map((stats.works ?? []).map((w) => [w.id, w]));
  for (const [id, [i, j]] of Object.entries(TOWN_WORKS)) {
    const w = worksById.get(id);
    if (!w || (w.level === 0 && w.building === null)) continue;
    const b = blocks.find((k) => k.i === i && k.j === j);
    if (b) b.zone = 'civic';
  }
  // A park next to the seat of government, always.
  const nextToCore = blocks.find((b) => b.i === 0 && b.j === 1);
  if (nextToCore) nextToCore.zone = 'park';

  // Research campus and military district on the residential edge.
  const labs = Math.max(1, Math.min(6, Math.round(1 + stats.research / 3)));
  const barracks = Math.max(0, Math.min(4, Math.round(stats.army / 4000)));
  const edge = blocks
    .filter((b) => b.zone === 'midtown' || b.zone === 'residential')
    .sort((a, b) => Math.hypot(b.i, b.j) - Math.hypot(a.i, a.j) || a.i - b.i || a.j - b.j);
  const campusBlocks = Math.ceil(labs / 2);
  const west = edge.filter((b) => b.i < 0);
  const north = edge.filter((b) => b.j > 0 && b.i >= 0);
  for (let k = 0; k < campusBlocks && k < north.length; k += 1) north[k]!.zone = 'campus';
  if (barracks > 0 && west[0]) west[0].zone = 'military';
  if (barracks > 2 && west[1]) west[1].zone = 'military';

  // Arcologies take whole downtown blocks.
  const arcologyBlocks = has('earth_arcologies')
    ? blocks.filter((b) => b.zone === 'downtown').sort((a, b) => b.j - a.j || a.i - b.i).slice(0, 2)
    : [];
  const arcologySet = new Set(arcologyBlocks);

  const lots: Lot[] = [];
  const inner = BLOCK - 2 * SIDEWALK;
  let labsLeft = labs;
  let datacentres = has('earth_quantum_net') ? 2 : 0;
  // Building sites: Earth megaprojects without a site of their own outside
  // the city, and the extra works, go up in midtown.
  let sitesLeft =
    stats.extraSites +
    stats.building.filter((p) => !['earth_fusion', 'earth_spaceport', 'earth_planetary_grid', 'earth_smart_grid'].includes(p)).length;

  for (const b of blocks) {
    const r = (k: number) => rand(seed, b.i * 31 + k, b.j * 17 - k);
    if (b.zone === 'core') {
      lots.push({ kind: 'capitol', x: b.x, z: b.z - 8, w: 46, d: 26, h: 16, style: 'capitol', rand: r(1) });
      continue;
    }
    if (b.zone === 'park') continue;
    if (arcologySet.has(b)) {
      lots.push({ kind: 'arcology', x: b.x, z: b.z, w: 58, d: 58, h: 110 + 60 * r(2), style: 'arcology', rand: r(3) });
      continue;
    }
    // Four lots per block in town, laid 2 × 2.
    const quad = (fn: (x: number, z: number, k: number) => void) => {
      const half = inner / 4;
      let k = 0;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) fn(b.x + sx * half, b.z + sz * half, (k += 1));
    };
    const lotSize = inner / 2 - 4;
    if (b.zone === 'downtown') {
      const centrality = 1 - Math.hypot(b.i, b.j) / (downtownR + 0.6);
      quad((x, z, k) => {
        const rr = r(k);
        if (sitesLeft > 0 && k === 4 && rr < 0.5) {
          sitesLeft -= 1;
          lots.push({ kind: 'site', x, z, w: lotSize, d: lotSize, h: 0, style: 'site', rand: rr });
          return;
        }
        const tall = rr < 0.35 + 0.5 * centrality;
        const h = tall
          ? (55 + 150 * Math.pow(r(k + 10), 1.6)) * (0.7 + 0.25 * growthBoost) * (0.6 + 0.6 * centrality)
          : 24 + 30 * r(k + 20);
        const fw = tall ? lotSize - 4 - 8 * r(k + 30) : lotSize - 2;
        lots.push({
          kind: tall ? 'tower' : 'office',
          x,
          z,
          w: fw,
          d: tall ? lotSize - 4 - 8 * r(k + 40) : lotSize - 2,
          h,
          style: tall ? pick(TOWER_STYLES, r(k + 50)) : pick(OFFICE_STYLES, r(k + 50)),
          rand: r(k + 60),
        });
      });
    } else if (b.zone === 'midtown') {
      quad((x, z, k) => {
        const rr = r(k);
        if (sitesLeft > 0 && rr < 0.3) {
          sitesLeft -= 1;
          lots.push({ kind: 'site', x, z, w: lotSize, d: lotSize, h: 0, style: 'site', rand: rr });
          return;
        }
        const office = rr < 0.3;
        lots.push({
          kind: office ? 'office' : 'apartment',
          x,
          z,
          w: lotSize - 2 - 4 * r(k + 3),
          d: lotSize - 2 - 4 * r(k + 4),
          h: office ? 20 + 22 * r(k + 5) : 13 + 15 * r(k + 6),
          style: office ? pick(OFFICE_STYLES, r(k + 7)) : pick(APARTMENT_STYLES, r(k + 8)),
          rand: r(k + 9),
        });
      });
    } else if (b.zone === 'residential') {
      // Houses with gardens on a 4 × 3 grid of plots, or a few apartment blocks.
      if (r(1) < 0.22) {
        quad((x, z, k) =>
          lots.push({
            kind: 'apartment',
            x,
            z,
            w: lotSize - 8,
            d: lotSize - 10,
            h: 11 + 7 * r(k + 2),
            style: pick(APARTMENT_STYLES, r(k + 3)),
            rand: r(k + 4),
          }),
        );
      } else {
        const cols = 4;
        const rows = 3;
        const pw = inner / cols;
        const pd = inner / rows;
        const style = pick(HOUSE_STYLES, r(5));
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cz = 0; cz < rows; cz += 1) {
            const k = cx * 7 + cz;
            if (cz === 1 && (cx === 1 || cx === 2)) continue; // back gardens
            lots.push({
              kind: 'house',
              x: b.x - inner / 2 + pw * (cx + 0.5),
              z: b.z - inner / 2 + pd * (cz + 0.5) + (cz === 0 ? -2 : cz === 2 ? 2 : 0),
              w: 9 + 3 * r(k + 10),
              d: 8 + 3 * r(k + 11),
              h: r(k + 12) < 0.3 ? 8.5 : 5.5,
              style: r(k + 13) < 0.7 ? style : pick(HOUSE_STYLES, r(k + 14)),
              rand: r(k + 15),
            });
          }
        }
      }
    } else if (b.zone === 'industrial') {
      for (const sz of [-1, 1]) {
        const z = b.z + (sz * inner) / 4;
        if (datacentres > 0) {
          datacentres -= 1;
          lots.push({ kind: 'datacenter', x: b.x, z, w: inner - 8, d: inner / 2 - 8, h: 12, style: 'datacenter', rand: r(sz + 5) });
          continue;
        }
        const factory = r(sz + 2) < 0.6;
        lots.push({
          kind: factory ? 'factory' : 'warehouse',
          x: b.x,
          z,
          w: inner - 6 - 10 * r(sz + 3),
          d: inner / 2 - 6,
          h: factory ? 11 + 4 * r(sz + 4) : 9,
          style: factory ? 'factory' : 'warehouse',
          rand: r(sz + 6),
        });
      }
    } else if (b.zone === 'campus') {
      quad((x, z, k) => {
        if (labsLeft <= 0 || k % 2 === 0) return;
        labsLeft -= 1;
        lots.push({ kind: 'lab', x, z, w: lotSize - 2, d: lotSize - 6, h: 14 + 6 * r(k), style: 'lab', rand: r(k + 1) });
      });
    } else if (b.zone === 'military') {
      for (const sz of [-1, 1]) {
        lots.push({ kind: 'barracks', x: b.x, z: b.z + (sz * inner) / 4, w: inner - 14, d: 14, h: 9, style: 'barracks', rand: r(sz) });
      }
    }
  }

  // Roads: every edge of every block, merged into straight stretches.
  const edges = new Map<string, Road>();
  for (const b of blocks) {
    const half = PITCH / 2;
    const lines: Road[] = [
      { axis: 'x', at: b.z - half, from: b.x - half, to: b.x + half, width: ROAD },
      { axis: 'x', at: b.z + half, from: b.x - half, to: b.x + half, width: ROAD },
      { axis: 'z', at: b.x - half, from: b.z - half, to: b.z + half, width: ROAD },
      { axis: 'z', at: b.x + half, from: b.z - half, to: b.z + half, width: ROAD },
    ];
    for (const l of lines) edges.set(`${l.axis}:${l.at}:${l.from}`, l);
  }
  const roads = mergeRoads([...edges.values()]);

  const gridEdge = (radius + 0.5) * PITCH;
  const builtEdge = Math.max(...blocks.map((b) => Math.max(Math.abs(b.x), Math.abs(b.z)))) + PITCH / 2;
  const specials: Special[] = [];
  const out = builtEdge + 40;
  const fusionAt = { x: 0, z: -(out + 150) };
  if (has('earth_fusion') || building('earth_fusion')) {
    specials.push({ kind: 'reactor', ...fusionAt, site: !has('earth_fusion') });
    roads.push({ axis: 'z', at: 0, from: fusionAt.z + 60, to: -builtEdge, width: ROAD });
  }
  if (has('earth_spaceport') || building('earth_spaceport')) {
    const at = { x: -(out + 260), z: 0 };
    specials.push({ kind: 'spaceport', ...at, site: !has('earth_spaceport') });
    roads.push({ axis: 'x', at: 0, from: at.x + 150, to: -builtEdge, width: ROAD });
  }
  const pylons: { x: number; z: number }[] = [];
  if (has('earth_smart_grid') || building('earth_smart_grid')) {
    const at = { x: out + 220, z: -(out + 120) };
    specials.push({ kind: 'solarFarm', ...at, site: !has('earth_smart_grid') });
    if (has('earth_smart_grid')) {
      // A power line from the farm to the edge of town.
      const to = { x: builtEdge - 20, z: -builtEdge + 20 };
      const n = Math.max(2, Math.round(Math.hypot(at.x - to.x, at.z - to.z) / 75));
      for (let k = 0; k <= n; k += 1) {
        pylons.push({ x: at.x - 70 + (to.x - at.x + 70) * (k / n), z: at.z + 40 + (to.z - at.z - 40) * (k / n) });
      }
    }
  }
  if (has('earth_planetary_grid') || building('earth_planetary_grid')) {
    specials.push({ kind: 'dishes', x: 0, z: out + 200, site: !has('earth_planetary_grid') });
  }

  // National works: their grounds out of town, with a road into the grid.
  const works: WorkSite[] = [];
  for (const w of stats.works ?? []) {
    if (w.level === 0 && w.building === null) continue;
    const town = TOWN_WORKS[w.id];
    if (town) {
      const b = blocks.find((k) => k.i === town[0] && k.j === town[1]);
      if (b) works.push({ ...w, x: b.x, z: b.z, w: BLOCK - 2 * SIDEWALK, d: BLOCK - 2 * SIDEWALK, inTown: true });
      continue;
    }
    const spot = OUT_WORKS[w.id];
    if (!spot) continue;
    const a = (spot.angle * Math.PI) / 180;
    const r = out + spot.dist + Math.min(spot.w, spot.d) / 2;
    const x = Math.round(Math.cos(a) * r);
    const z = Math.round(Math.sin(a) * r);
    works.push({ ...w, x, z, w: spot.w, d: spot.d, inTown: false });
    // An access road from the nearest street at the edge of town.
    const street = (v: number) => Math.max(-builtEdge, Math.min(builtEdge, Math.round((v - PITCH / 2) / PITCH) * PITCH + PITCH / 2));
    if (Math.abs(x) >= Math.abs(z)) {
      const at = street(z);
      const gate = x - Math.sign(x) * (spot.w / 2);
      const edge = Math.sign(x) * builtEdge;
      roads.push({ axis: 'x', at, from: Math.min(gate, edge), to: Math.max(gate, edge), width: ROAD });
      if (Math.abs(at - z) > spot.d / 2 - 10) roads.push({ axis: 'z', at: gate, from: Math.min(at, z), to: Math.max(at, z), width: ROAD });
    } else {
      const at = street(x);
      const gate = z - Math.sign(z) * (spot.d / 2);
      const edge = Math.sign(z) * builtEdge;
      roads.push({ axis: 'z', at, from: Math.min(gate, edge), to: Math.max(gate, edge), width: ROAD });
      if (Math.abs(at - x) > spot.w / 2 - 10) roads.push({ axis: 'x', at: gate, from: Math.min(at, x), to: Math.max(at, x), width: ROAD });
    }
  }

  const extent = Math.max(
    gridEdge,
    ...specials.map((s) => Math.max(Math.abs(s.x), Math.abs(s.z)) + 160),
    ...works.map((w) => Math.max(Math.abs(w.x) + w.w / 2, Math.abs(w.z) + w.d / 2) + 40),
  );
  return { radius, blocks, lots, specials, roads, pylons, extent, works };
}

/** Join collinear stretches that touch into one. */
function mergeRoads(segments: Road[]): Road[] {
  const byLine = new Map<string, Road[]>();
  for (const s of segments) {
    const key = `${s.axis}:${s.at}`;
    byLine.set(key, [...(byLine.get(key) ?? []), s]);
  }
  const out: Road[] = [];
  for (const list of byLine.values()) {
    list.sort((a, b) => a.from - b.from);
    let cur = { ...list[0]! };
    for (const s of list.slice(1)) {
      if (s.from <= cur.to + 0.01) cur.to = Math.max(cur.to, s.to);
      else {
        out.push(cur);
        cur = { ...s };
      }
    }
    out.push(cur);
  }
  return out;
}

/** The lot under a point on the ground, if any. */
export function lotAt(layout: CityLayout, x: number, z: number): Lot | null {
  let best: Lot | null = null;
  for (const lot of layout.lots) {
    if (Math.abs(x - lot.x) <= lot.w / 2 + 1 && Math.abs(z - lot.z) <= lot.d / 2 + 1) {
      if (!best || lot.h > best.h) best = lot;
    }
  }
  return best;
}

// Builds the capital in 3D from its layout: buildings with composed facades,
// roofs and parapets, houses with tiled pitched roofs, streets with lane
// markings and crossings, sidewalks, street lamps, trees, parked and moving
// cars, people on the sidewalks, parks, and the Earth megaprojects.
//
// Everything static is merged by material (a few dozen draw calls for the
// whole city); everything repeated and small is instanced. Cars and people
// are moved on the CPU, a few hundred matrices a frame.
//
// DOM/WebGL only.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { FACADES, makeFacade, SurfaceCache, type Facade } from './assets';
import { BLOCK, PITCH, ROAD, SIDEWALK, lotAt, rand, type CityLayout, type Lot } from './city';
import { Batch, hash, tint } from './geometry';
import { treeGeometry, treeMaterials, type TreeKind } from './trees';
import { buildWorksLayer, type WorksLayer } from './works-scene';

export type CityScene = {
  group: THREE.Group;
  /** Advance cars, people, cranes and steam. */
  update(dt: number, time: number): void;
  /** What stands at a point on the ground (for tap-to-name). */
  nameAt(x: number, z: number): string | null;
  /** Footprints the camera must stay above. */
  solids: { x: number; z: number; r: number; h: number }[];
  /** National works: progress of the ones being built, and where each stands. */
  works: Pick<WorksLayer, 'setProgress' | 'focus'>;
};

const SURFACE_TILE = 2.4;

const CAR_COLOURS = [0xf2f2f0, 0xf2f2f0, 0xc9ccd0, 0xc9ccd0, 0x1c1d20, 0x1c1d20, 0x5d6168, 0x1f3a66, 0x8c1c1c, 0x2f4f3a, 0xb9a27c, 0x6e2a3e];
const CLOTHES = [0x2b3a55, 0x1f1f22, 0x6b6f76, 0x8a2f2f, 0x2f5d50, 0xd8d2c4, 0x3e2f5b, 0xc28a3a, 0x24456b, 0x7d7f84];
const SKIN = [0xf1c9a5, 0xe0ac86, 0xc68a62, 0x8d5a3c, 0x5c3a28, 0xf6d7bd];

/** Kind of lot → building name key in `cosmos.base.name`. */
const NAME_OF: Record<Lot['kind'], string> = {
  capitol: 'capitol',
  tower: 'skyscraper',
  office: 'office',
  apartment: 'apartment',
  house: 'house',
  factory: 'factory',
  warehouse: 'warehouse',
  lab: 'lab',
  barracks: 'barracks',
  arcology: 'arcology',
  datacenter: 'datacenter',
  site: 'site',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

function lampGeometry(): { pole: THREE.BufferGeometry; head: THREE.BufferGeometry } {
  const pole = mergeGeometries(
    [
      new THREE.CylinderGeometry(0.09, 0.13, 8, 8).translate(0, 4, 0),
      new THREE.CylinderGeometry(0.24, 0.28, 0.5, 8).translate(0, 0.25, 0),
      new THREE.BoxGeometry(2, 0.1, 0.1).translate(1, 7.85, 0),
      new THREE.BoxGeometry(0.7, 0.16, 0.34).translate(2, 7.78, 0),
    ].map((g) => tint(g, 0x3b3f45)),
    false,
  )!;
  const head = new THREE.BoxGeometry(0.52, 0.04, 0.24).translate(2, 7.68, 0);
  return { pole, head };
}

function carGeometry(): { body: THREE.BufferGeometry; glass: THREE.BufferGeometry; trim: THREE.BufferGeometry } {
  // Side profile of a family car, 4.5 m long, extruded to 1.8 m wide.
  const s = new THREE.Shape();
  const pts: [number, number][] = [
    [-2.25, 0.32], [2.2, 0.32], [2.27, 0.55], [2.2, 0.8], [1.15, 0.95], [0.55, 1.42],
    [-0.95, 1.45], [-1.65, 1.0], [-2.22, 0.95], [-2.28, 0.6],
  ];
  s.moveTo(...pts[0]!);
  for (const p of pts.slice(1)) s.lineTo(...p);
  s.closePath();
  const body = new THREE.ExtrudeGeometry(s, { depth: 1.74, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1, steps: 1 }).translate(0, 0, -0.87);
  const g = new THREE.Shape();
  const gp: [number, number][] = [[1.08, 0.97], [0.52, 1.37], [-0.92, 1.4], [-1.58, 1.0]];
  g.moveTo(...gp[0]!);
  for (const p of gp.slice(1)) g.lineTo(...p);
  g.closePath();
  const glass = new THREE.ExtrudeGeometry(g, { depth: 1.8, bevelEnabled: false }).translate(0, 0, -0.9);
  const wheels: THREE.BufferGeometry[] = [];
  for (const x of [-1.42, 1.38]) {
    for (const z of [-0.8, 0.8]) wheels.push(tint(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14).rotateX(Math.PI / 2).translate(x, 0.34, z), 0x151515));
  }
  const lights = [
    tint(new THREE.BoxGeometry(0.06, 0.12, 0.36).translate(2.27, 0.68, 0.6), 0xfff6dc),
    tint(new THREE.BoxGeometry(0.06, 0.12, 0.36).translate(2.27, 0.68, -0.6), 0xfff6dc),
    tint(new THREE.BoxGeometry(0.06, 0.12, 0.4).translate(-2.31, 0.78, 0.6), 0xb3121a),
    tint(new THREE.BoxGeometry(0.06, 0.12, 0.4).translate(-2.31, 0.78, -0.6), 0xb3121a),
    tint(new THREE.BoxGeometry(0.05, 0.16, 1.1).translate(2.27, 0.5, 0), 0x2a2c30),
  ];
  return { body, glass, trim: mergeGeometries([...wheels, ...lights], false)! };
}

function personGeometry(): { clothes: THREE.BufferGeometry; skin: THREE.BufferGeometry } {
  const clothes = mergeGeometries(
    [
      new THREE.BoxGeometry(0.15, 0.82, 0.18).translate(-0.1, 0.41, 0),
      new THREE.BoxGeometry(0.15, 0.82, 0.18).translate(0.1, 0.41, 0),
      new THREE.CapsuleGeometry(0.2, 0.42, 2, 8).scale(1, 1, 0.65).translate(0, 1.13, 0),
      new THREE.BoxGeometry(0.1, 0.56, 0.12).translate(-0.27, 1.12, 0),
      new THREE.BoxGeometry(0.1, 0.56, 0.12).translate(0.27, 1.12, 0),
    ].map((g) => tint(g, 0xffffff)),
    false,
  )!;
  const skin = mergeGeometries(
    [
      tint(new THREE.SphereGeometry(0.115, 10, 8).scale(1, 1.15, 1.05).translate(0, 1.58, 0), 0xffffff),
      tint(new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 1.61, -0.01), 0x2a1d14),
      tint(new THREE.SphereGeometry(0.05, 6, 4).translate(-0.27, 0.8, 0), 0xffffff),
      tint(new THREE.SphereGeometry(0.05, 6, 4).translate(0.27, 0.8, 0), 0xffffff),
    ],
    false,
  )!;
  return { clothes, skin };
}

function latticeTower(height: number, base: number, top: number, color: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const legs: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [sx, sz] of legs) {
    const leg = new THREE.CylinderGeometry(0.12, 0.18, Math.hypot(height, base - top), 5);
    const tilt = Math.atan2(base - top, height);
    leg.rotateZ(sx * tilt);
    leg.rotateX(-sz * tilt);
    leg.translate((sx * (base + top)) / 2, height / 2, (sz * (base + top)) / 2);
    parts.push(leg);
  }
  const levels = Math.round(height / 6);
  for (let k = 1; k <= levels; k += 1) {
    const y = (k / levels) * height;
    const half = base + (top - base) * (k / levels);
    for (const [ax, az, w, d] of [[0, half, half * 2, 0.12], [0, -half, half * 2, 0.12], [half, 0, 0.12, half * 2], [-half, 0, 0.12, half * 2]] as const) {
      parts.push(new THREE.BoxGeometry(w, 0.12, d).translate(ax, y, az));
    }
    // Diagonal braces on two faces.
    const prev = base + (top - base) * ((k - 1) / levels);
    const len = Math.hypot(height / levels, half + prev);
    const br = new THREE.BoxGeometry(0.09, len, 0.09).rotateZ(Math.atan2(half + prev, height / levels)).translate(0, y - height / levels / 2, half);
    parts.push(br, br.clone().translate(0, 0, -2 * half));
  }
  return tint(mergeGeometries(parts, false)!, color);
}

export function solarTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1b2a4a';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      const grad = g.createLinearGradient(0, y * 32, 0, y * 32 + 30);
      grad.addColorStop(0, '#2c4778');
      grad.addColorStop(1, '#16264a');
      g.fillStyle = grad;
      g.fillRect(x * 64 + 2, y * 32 + 2, 60, 28);
    }
  }
  g.strokeStyle = 'rgba(200,210,230,0.35)';
  g.lineWidth = 1;
  for (let x = 0; x <= 256; x += 16) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

type Walker = { cx: number; cz: number; half: number; s: number; speed: number; dir: number };
type Car = { axis: 'x' | 'z'; at: number; lane: number; from: number; to: number; s: number; speed: number; dir: number };

export async function buildCityScene(layout: CityLayout, opts: { software: boolean; seed: number }): Promise<CityScene> {
  const group = new THREE.Group();
  const surfaces = new SurfaceCache();
  const solids: CityScene['solids'] = [];

  // Facades used by this city.
  const styles = new Set<string>(['storefront', ...layout.lots.map((l) => l.style).filter((s) => FACADES[s])]);
  const facades = new Map<string, Facade>();
  await Promise.all(
    [...styles].map(async (s, k) => {
      facades.set(s, await makeFacade(FACADES[s]!, opts.seed + k * 17, opts.software ? 512 : 1024));
    }),
  );
  const [asphalt, pavement, plaza, grass, roofGravel, roofTiles, concrete, sandstone, gravelYard] = await Promise.all([
    surfaces.get('asphalt_02', { normalScale: 0.6 }),
    surfaces.get('concrete_pavement'),
    surfaces.get('herringbone_pavement'),
    surfaces.get('lawn'),
    surfaces.get('tarred_gravel', { color: 0x9a9894 }),
    surfaces.get('clay_roof_tiles_02'),
    surfaces.get('rough_concrete', { color: 0xc8c4bc }),
    surfaces.get('white_sandstone_blocks_02'),
    surfaces.get('rough_concrete', { color: 0x8f8b84 }),
  ]);

  // One batch per material.
  const batches = new Map<THREE.Material, Batch>();
  const batch = (m: THREE.Material) => {
    let b = batches.get(m);
    if (!b) {
      b = new Batch();
      batches.set(m, b);
    }
    return b;
  };
  const paint = new THREE.MeshStandardNodeMaterial({ color: 0xeeeeea, roughness: 0.7 });
  const metal = new THREE.MeshStandardNodeMaterial({ color: 0x9aa0a6, roughness: 0.45, metalness: 0.7 });
  const darkMetal = new THREE.MeshStandardNodeMaterial({ color: 0x3a3e44, roughness: 0.5, metalness: 0.6 });
  const water = new THREE.MeshStandardNodeMaterial({ color: 0x3f6f86, roughness: 0.05, metalness: 0.2 });
  const copper = new THREE.MeshStandardNodeMaterial({ color: 0x6aa594, roughness: 0.5, metalness: 0.55 });
  const whitePanel = new THREE.MeshStandardNodeMaterial({ color: 0xeef0f2, roughness: 0.5, metalness: 0.05 });
  const redSteel = new THREE.MeshStandardNodeMaterial({ color: 0xb23a2c, roughness: 0.55, metalness: 0.5 });
  const solar = new THREE.MeshStandardNodeMaterial({ map: solarTexture(), roughness: 0.22, metalness: 0.55 });
  const glassDome = new THREE.MeshStandardNodeMaterial({ color: 0xa9cad6, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.55 });

  // ---- Ground: block slabs, inner surfaces, roads ------------------------
  const slabH = 0.16;
  for (const b of layout.blocks) {
    // The sidewalk ring and kerb.
    batch(pavement).walls(b.x, b.z, BLOCK, BLOCK, 0, slabH, SURFACE_TILE, SURFACE_TILE);
    batch(pavement).flat(b.x, b.z, BLOCK, BLOCK, slabH, SURFACE_TILE);
    const inner = BLOCK - 2 * SIDEWALK;
    const y = slabH + 0.01;
    if (b.zone === 'residential' || b.zone === 'park' || b.zone === 'campus') {
      batch(grass).flat(b.x, b.z, inner, inner, y, 3.2);
    } else if (b.zone === 'core' || b.zone === 'civic') {
      batch(plaza).flat(b.x, b.z, inner, inner, y, SURFACE_TILE);
    } else if (b.zone === 'industrial') {
      batch(gravelYard).flat(b.x, b.z, inner, inner, y, SURFACE_TILE);
    } else if (b.zone === 'military') {
      batch(asphalt).flat(b.x, b.z, inner, inner, y, 7);
    }
    if (b.zone === 'park') {
      // Paths crossing the park and a pond in the middle.
      batch(plaza).flat(b.x, b.z, 4, inner, y + 0.01, SURFACE_TILE);
      batch(plaza).flat(b.x, b.z, inner, 4, y + 0.01, SURFACE_TILE);
      batch(concrete).cylinder(b.x + 16, b.z - 16, 9, y, y + 0.5, SURFACE_TILE, SURFACE_TILE, 28);
      batch(water).disc(b.x + 16, b.z - 16, 8.8, y + 0.38, 10, 28);
    }
    if (b.zone === 'core') {
      // Fountain in front of the seat of government, lawns either side.
      batch(sandstone).cylinder(b.x, b.z + 20, 7, y, y + 0.7, SURFACE_TILE, SURFACE_TILE, 32);
      batch(water).disc(b.x, b.z + 20, 6.7, y + 0.55, 10, 32);
      batch(sandstone).cylinder(b.x, b.z + 20, 0.9, y, y + 2.6, SURFACE_TILE, SURFACE_TILE, 12);
      for (const sx of [-1, 1]) batch(grass).flat(b.x + sx * 22, b.z + 20, 16, 18, y + 0.02, 3.2);
    }
    if (b.zone === 'residential') {
      // Driveways in front of houses.
      for (const lot of layout.lots) {
        if (lot.kind !== 'house' || Math.abs(lot.x - b.x) > BLOCK / 2 || Math.abs(lot.z - b.z) > BLOCK / 2) continue;
        const front = lot.z < b.z ? -1 : 1;
        batch(concrete).flat(lot.x + lot.w / 2 - 1.4, lot.z + front * (lot.d / 2 + 3), 3, 6, y + 0.02, SURFACE_TILE);
      }
    }
  }
  for (const r of layout.roads) {
    const len = r.to - r.from;
    const mid = (r.from + r.to) / 2;
    if (r.axis === 'x') batch(asphalt).flat(mid, r.at, len + r.width, r.width, 0.02, 7);
    else batch(asphalt).flat(r.at, mid, r.width, len + r.width, 0.02, 7);
  }
  // Lane markings and zebra crossings.
  const marks = batch(paint);
  const crossings = new Set<string>();
  for (const r of layout.roads) {
    const along = (s: number, across: number, w: number, d: number) =>
      r.axis === 'x' ? marks.flat(s, r.at + across, w, d, 0.035, 1) : marks.flat(r.at + across, s, d, w, 0.035, 1);
    for (let s = r.from; s < r.to; s += PITCH) {
      // Dashes along the centre between intersections.
      for (let t = s + ROAD / 2 + 6; t < s + PITCH - ROAD / 2 - 6; t += 9) along(t + 1.5, 0, 3, 0.15);
      // Edge lines.
      along(s + PITCH / 2, r.width / 2 - 0.5, PITCH - ROAD - 4, 0.12);
      along(s + PITCH / 2, -(r.width / 2 - 0.5), PITCH - ROAD - 4, 0.12);
    }
    for (let s = r.from; s <= r.to + 0.1; s += PITCH) {
      for (const side of [-1, 1]) {
        const at = s + side * (ROAD / 2 + 2.2);
        if (at < r.from - 1 || at > r.to + 1) continue;
        const key = `${r.axis}:${r.at}:${Math.round(at)}`;
        if (crossings.has(key)) continue;
        crossings.add(key);
        for (let k = -5; k <= 5; k += 1) along(at, k * 1.1, 2.6, 0.5);
      }
    }
  }

  // ---- Buildings ----------------------------------------------------------
  const roofs = batch(roofGravel);
  const parapets = batch(concrete);
  const flatRoof = (x: number, z: number, w: number, d: number, y: number) => {
    roofs.flat(x, z, w, d, y, SURFACE_TILE);
    // Parapet: a low wall round the roof edge.
    parapets.walls(x, z, w + 0.5, d + 0.5, y, y + 1, SURFACE_TILE, SURFACE_TILE);
    parapets.flat(x, z, w + 0.5, d + 0.5, y + 1.0, SURFACE_TILE);
  };
  const hvac: THREE.Matrix4[] = [];
  const tanks: THREE.Matrix4[] = [];
  const spires: THREE.Matrix4[] = [];
  const m4 = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));
  const roofProps = (lot: Lot, x: number, z: number, w: number, d: number, y: number, many: boolean) => {
    const n = many ? 3 + Math.floor(lot.rand * 4) : 1 + Math.floor(lot.rand * 2);
    for (let k = 0; k < n; k += 1) {
      const px = x + (hash(lot.x + k, lot.z) - 0.5) * (w - 6);
      const pz = z + (hash(lot.z + k, lot.x) - 0.5) * (d - 6);
      hvac.push(m4(px, y, pz, 1, 1, 1, Math.round(hash(k, lot.x)) * (Math.PI / 2)));
    }
    if (lot.rand > 0.55) tanks.push(m4(x - w / 4, y, z + d / 4));
  };

  const ground = slabH + 0.01;
  for (const lot of layout.lots) {
    const f = facades.get(lot.style);
    const store = facades.get('storefront')!;
    switch (lot.kind) {
      case 'tower': {
        // Podium with shops, a shaft, one or two setbacks, a mechanical crown.
        const fac = f!;
        const podiumH = 5 + fac.tileH / 2;
        const round = lot.rand < 0.14;
        batch(store.material).walls(lot.x, lot.z, lot.w + 4, lot.d + 4, ground, ground + 5, store.tileW, store.tileH);
        batch(fac.material).walls(lot.x, lot.z, lot.w + 4, lot.d + 4, ground + 5, ground + podiumH, fac.tileW, fac.tileH, ground + 5);
        flatRoof(lot.x, lot.z, lot.w + 4, lot.d + 4, ground + podiumH);
        let w = lot.w;
        let d = lot.d;
        let y = ground + podiumH;
        const tiers = lot.h > 120 ? 3 : lot.h > 70 ? 2 : 1;
        const tierH = (lot.h - podiumH) / tiers;
        for (let t = 0; t < tiers; t += 1) {
          const top = y + tierH * (t === 0 ? 1.25 : t === 1 ? 0.95 : 0.8);
          if (round) batch(fac.material).cylinder(lot.x, lot.z, Math.min(w, d) / 2, y, top, fac.tileW, fac.tileH, 28, ground + 5);
          else batch(fac.material).walls(lot.x, lot.z, w, d, y, top, fac.tileW, fac.tileH, ground + 5);
          if (round) {
            roofs.disc(lot.x, lot.z, Math.min(w, d) / 2, top, SURFACE_TILE, 28);
          } else {
            flatRoof(lot.x, lot.z, w, d, top);
          }
          y = top;
          w *= 0.78;
          d *= 0.78;
        }
        // Crown: plant room and, on the tallest, a spire.
        if (!round) {
          parapets.box(lot.x, lot.z, w * 0.7, d * 0.7, y, y + 5, SURFACE_TILE);
          roofProps(lot, lot.x, lot.z, w, d, y, true);
        }
        if (lot.h > 110 && lot.rand > 0.4) spires.push(m4(lot.x, y + 5, lot.z, 1, 0.6 + lot.rand, 1));
        solids.push({ x: lot.x, z: lot.z, r: Math.max(lot.w, lot.d) / 2 + 2, h: y + 6 });
        break;
      }
      case 'office':
      case 'apartment':
      case 'lab':
      case 'barracks':
      case 'datacenter': {
        const fac = f!;
        const shops = lot.kind === 'office' || (lot.kind === 'apartment' && lot.rand < 0.55);
        let y0 = ground;
        if (shops) {
          batch(store.material).walls(lot.x, lot.z, lot.w, lot.d, ground, ground + 5, store.tileW, store.tileH);
          y0 = ground + 5;
        }
        const top = ground + lot.h;
        batch(fac.material).walls(lot.x, lot.z, lot.w, lot.d, y0, top, fac.tileW, fac.tileH, y0);
        flatRoof(lot.x, lot.z, lot.w, lot.d, top);
        if (lot.kind === 'apartment') {
          // Balconies on the street side, floor by floor.
          for (let y = y0 + FACADES[lot.style]!.floorH; y < top - 1; y += FACADES[lot.style]!.floorH) {
            for (let k = -1; k <= 1; k += 2) {
              parapets.box(lot.x + k * lot.w * 0.22, lot.z + lot.d / 2 + 0.7, lot.w * 0.28, 1.4, y - 0.12, y + 0.05, SURFACE_TILE);
              batch(glassDome).walls(lot.x + k * lot.w * 0.22, lot.z + lot.d / 2 + 1.38, lot.w * 0.28, 0.04, y + 0.05, y + 1.05, 4, 4);
            }
          }
          parapets.box(lot.x - lot.w / 4, lot.z, 4, 4, top + 1, top + 3.5, SURFACE_TILE);
        }
        if (lot.kind === 'lab') {
          batch(whitePanel).add(new THREE.SphereGeometry(3.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(lot.x + lot.w / 4, top + 1, lot.z));
        }
        if (lot.kind === 'barracks') {
          batch(metal).add(new THREE.CylinderGeometry(0.08, 0.1, 12, 6).translate(lot.x + lot.w / 2 + 4, ground + 6, lot.z));
          batch(redSteel).add(new THREE.BoxGeometry(2.4, 1.4, 0.04).translate(lot.x + lot.w / 2 + 5.3, ground + 11, lot.z));
        }
        roofProps(lot, lot.x, lot.z, lot.w, lot.d, top + 0.01, lot.kind === 'office' || lot.kind === 'datacenter');
        if (lot.kind === 'datacenter') {
          for (let k = 0; k < 8; k += 1) hvac.push(m4(lot.x - lot.w / 2 + 6 + k * ((lot.w - 12) / 7), top + 0.01, lot.z, 1.4, 1.2, 1.4));
        }
        solids.push({ x: lot.x, z: lot.z, r: Math.max(lot.w, lot.d) / 2 + 1, h: top + 3 });
        break;
      }
      case 'house': {
        const fac = f!;
        const top = ground + lot.h;
        batch(fac.material).walls(lot.x, lot.z, lot.w, lot.d, ground, top, fac.tileW, fac.tileH, ground);
        // Pitched roof along the longer side, tiles running down the slope.
        const along = lot.w >= lot.d;
        const span = (along ? lot.d : lot.w) / 2 + 0.5;
        const len = (along ? lot.w : lot.d) / 2 + 0.5;
        const rise = span * 0.62;
        const ridge = top + rise;
        const slope = Math.hypot(span, rise);
        const V = (a: number, y: number, b: number) => (along ? new THREE.Vector3(lot.x + a, y, lot.z + b) : new THREE.Vector3(lot.x + b, y, lot.z + a));
        const rb = batch(roofTiles);
        const sL = (2 * len) / SURFACE_TILE;
        const sS = slope / SURFACE_TILE;
        // Each slope wound so its normal faces outwards whatever the orientation.
        const face = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
          const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
          if (n.y >= 0) rb.quad(a, b, c, d, [0, 0], [sL, 0], [sL, sS], [0, sS]);
          else rb.quad(a, d, c, b, [0, 0], [0, sS], [sL, sS], [sL, 0]);
        };
        face(V(-len, top - 0.2, span), V(len, top - 0.2, span), V(len, ridge, 0), V(-len, ridge, 0));
        face(V(len, top - 0.2, -span), V(-len, top - 0.2, -span), V(-len, ridge, 0), V(len, ridge, 0));
        // Gable ends in the wall material.
        const wb = batch(fac.material);
        for (const e of [-1, 1]) {
          const a = V(e * (len - 0.5), top, span - 0.5);
          const b = V(e * (len - 0.5), top, -(span - 0.5));
          const c = V(e * (len - 0.5), ridge - 0.3, 0);
          const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
          const outward = along ? e : e;
          const ok = (along ? n.x : n.z) * outward > 0;
          if (ok) wb.tri(a, b, c, [0, 0.9], [span / fac.tileW, 0.9], [span / 2 / fac.tileW, 1]);
          else wb.tri(a, c, b, [0, 0.9], [span / 2 / fac.tileW, 1], [span / fac.tileW, 0.9]);
        }
        if (lot.rand > 0.5) batch(concrete).box(lot.x - lot.w / 4, lot.z + lot.d / 4, 0.8, 0.8, top, ridge + 0.8, SURFACE_TILE);
        solids.push({ x: lot.x, z: lot.z, r: Math.max(lot.w, lot.d) / 2, h: ridge + 1 });
        break;
      }
      case 'factory':
      case 'warehouse': {
        const fac = f!;
        const top = ground + lot.h;
        batch(fac.material).walls(lot.x, lot.z, lot.w, lot.d, ground, top, fac.tileW, fac.tileH, ground);
        if (lot.kind === 'factory') {
          // Saw-tooth roof with north lights.
          const n = Math.max(3, Math.round(lot.w / 9));
          const tw = lot.w / n;
          for (let k = 0; k < n; k += 1) {
            const x0 = lot.x - lot.w / 2 + k * tw;
            const a = new THREE.Vector3(x0, top, lot.z + lot.d / 2);
            const b = new THREE.Vector3(x0 + tw, top, lot.z + lot.d / 2);
            const c = new THREE.Vector3(x0 + tw, top + 3.2, lot.z + lot.d / 2);
            const a2 = new THREE.Vector3(x0, top, lot.z - lot.d / 2);
            const b2 = new THREE.Vector3(x0 + tw, top, lot.z - lot.d / 2);
            const c2 = new THREE.Vector3(x0 + tw, top + 3.2, lot.z - lot.d / 2);
            batch(metal).quad(a, a2, c2, c, [0, 0], [lot.d / 3, 0], [lot.d / 3, 1], [0, 1]);
            batch(glassDome).quad(b, c, c2, b2, [0, 0], [1, 0], [1, 1], [0, 1]);
            batch(concrete).tri(a, b, c, [0, 0], [1, 0], [1, 1]);
            batch(concrete).tri(a2, c2, b2, [0, 0], [1, 1], [1, 0]);
          }
          // Chimneys and tanks.
          batch(concrete).cylinder(lot.x - lot.w / 2 + 6, lot.z - lot.d / 2 - 5, 1.6, ground, ground + 28, SURFACE_TILE, SURFACE_TILE, 14);
          batch(whitePanel).add(new THREE.CylinderGeometry(4, 4, 12, 18).translate(lot.x + lot.w / 2 - 6, ground + 6, lot.z - lot.d / 2 - 6));
          batch(whitePanel).add(new THREE.SphereGeometry(4, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(lot.x + lot.w / 2 - 6, ground + 12, lot.z - lot.d / 2 - 6));
        } else {
          batch(metal).add(new THREE.BoxGeometry(lot.w + 1, 0.4, lot.d + 1).translate(lot.x, top + 0.2, lot.z));
          // Loading docks.
          for (let k = 0; k < 4; k += 1) batch(darkMetal).add(new THREE.BoxGeometry(3.4, 4, 0.2).translate(lot.x - lot.w / 3 + k * (lot.w / 5), ground + 2, lot.z + lot.d / 2 + 0.1));
        }
        solids.push({ x: lot.x, z: lot.z, r: Math.max(lot.w, lot.d) / 2, h: top + 4 });
        break;
      }
      case 'arcology': {
        const fac = f!;
        let w = lot.w;
        let y = ground;
        const tiers = 5;
        for (let t = 0; t < tiers; t += 1) {
          const h = lot.h / tiers;
          batch(fac.material).walls(lot.x, lot.z, w, w, y, y + h, fac.tileW, fac.tileH, ground);
          const nw = w * 0.8;
          // Terrace gardens round each setback.
          batch(grass).flat(lot.x, lot.z, w, w, y + h + 0.05, 3.2);
          y += h;
          w = nw;
        }
        batch(glassDome).add(new THREE.SphereGeometry(w / 2, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2).translate(lot.x, y, lot.z));
        solids.push({ x: lot.x, z: lot.z, r: lot.w / 2 + 2, h: y + w / 2 });
        break;
      }
      case 'capitol': {
        const fac = f!;
        const top = ground + lot.h;
        // Steps, the hall, two wings, a colonnaded portico, drum and dome.
        for (let s = 0; s < 4; s += 1) batch(sandstone).box(lot.x, lot.z + lot.d / 2 + 4 - s * 0.9, lot.w * 0.5 - s, 4 - s * 0.6, ground, ground + 0.35 * (s + 1), SURFACE_TILE);
        batch(fac.material).walls(lot.x, lot.z, lot.w * 0.6, lot.d, ground, top, fac.tileW, fac.tileH, ground);
        batch(sandstone).flat(lot.x, lot.z, lot.w * 0.6, lot.d, top, SURFACE_TILE);
        for (const sx of [-1, 1]) {
          batch(fac.material).walls(lot.x + sx * lot.w * 0.38, lot.z, lot.w * 0.24, lot.d * 0.8, ground, top - 3, fac.tileW, fac.tileH, ground);
          batch(sandstone).flat(lot.x + sx * lot.w * 0.38, lot.z, lot.w * 0.24, lot.d * 0.8, top - 3, SURFACE_TILE);
        }
        for (let k = -3; k <= 3; k += 1) batch(sandstone).cylinder(lot.x + k * 2.6, lot.z + lot.d / 2 + 2.2, 0.55, ground + 1.4, top - 1.4, SURFACE_TILE, SURFACE_TILE, 12);
        batch(sandstone).box(lot.x, lot.z + lot.d / 2 + 2.2, 19, 2.4, top - 1.4, top, SURFACE_TILE);
        // Pediment.
        const pa = new THREE.Vector3(lot.x - 9.5, top, lot.z + lot.d / 2 + 3.4);
        const pb = new THREE.Vector3(lot.x + 9.5, top, lot.z + lot.d / 2 + 3.4);
        const pc = new THREE.Vector3(lot.x, top + 4, lot.z + lot.d / 2 + 3.4);
        batch(sandstone).tri(pa, pb, pc, [0, 0], [8, 0], [4, 1.6]);
        batch(fac.material).cylinder(lot.x, lot.z, 7.5, top, top + 7, fac.tileW, fac.tileH, 28, ground);
        batch(copper).add(new THREE.SphereGeometry(7.6, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2).translate(lot.x, top + 7, lot.z));
        batch(sandstone).cylinder(lot.x, lot.z, 1.4, top + 14, top + 17.5, SURFACE_TILE, SURFACE_TILE, 12);
        batch(copper).add(new THREE.ConeGeometry(1.6, 2.4, 12).translate(lot.x, top + 18.7, lot.z));
        for (const sx of [-1, 1]) {
          batch(metal).add(new THREE.CylinderGeometry(0.08, 0.1, 14, 6).translate(lot.x + sx * 16, ground + 7, lot.z + lot.d / 2 + 10));
          batch(redSteel).add(new THREE.BoxGeometry(3, 1.8, 0.04).translate(lot.x + sx * 16 + 1.5, ground + 13, lot.z + lot.d / 2 + 10));
        }
        solids.push({ x: lot.x, z: lot.z, r: lot.w / 2, h: top + 20 });
        break;
      }
      case 'site':
        break;
    }
  }

  // ---- Specials -----------------------------------------------------------
  const cranes: THREE.Object3D[] = [];
  const steam: THREE.Mesh[] = [];
  const craneGeo = latticeTower(46, 1.1, 1.1, 0xf0bd2a);
  const jibGeo = mergeGeometries(
    [
      tint(new THREE.BoxGeometry(44, 1.2, 1.2).translate(14, 0, 0), 0xf0bd2a),
      tint(new THREE.BoxGeometry(5, 2.6, 2.4).translate(-6, -0.6, 0), 0x3a3d40),
      tint(new THREE.BoxGeometry(2.2, 2.2, 2.2).translate(0, -2, 0), 0xe8e8e8),
      tint(new THREE.CylinderGeometry(0.04, 0.04, 18, 4).translate(26, -9, 0), 0x222222),
      tint(new THREE.BoxGeometry(1.6, 1, 1.6).translate(26, -18, 0), 0x5a6068),
    ],
    false,
  )!;
  const craneMat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 });
  const addSite = (x: number, z: number, w: number, d: number, k: number) => {
    batch(gravelYard).flat(x, z, w, d, ground + 0.02, SURFACE_TILE);
    // A concrete core and a steel frame going up floor by floor.
    const floors = 3 + (k % 4);
    batch(concrete).box(x - w / 6, z, 7, 7, ground, ground + floors * 3.8 + 4, SURFACE_TILE);
    for (let f = 1; f <= floors; f += 1) batch(concrete).box(x, z, w * 0.7, d * 0.7, ground + f * 3.8 - 0.3, ground + f * 3.8, SURFACE_TILE);
    for (let ix = -2; ix <= 2; ix += 1) {
      for (let iz = -2; iz <= 2; iz += 1) {
        batch(darkMetal).add(new THREE.BoxGeometry(0.35, floors * 3.8, 0.35).translate(x + ix * w * 0.17, ground + (floors * 3.8) / 2, z + iz * d * 0.17));
      }
    }
    const crane = new THREE.Group();
    crane.add(new THREE.Mesh(craneGeo, craneMat));
    const jib = new THREE.Mesh(jibGeo, craneMat);
    jib.position.y = 46;
    crane.add(jib);
    crane.position.set(x + w / 2 - 3, ground, z + d / 2 - 3);
    crane.traverse((o) => {
      o.castShadow = true;
    });
    group.add(crane);
    cranes.push(jib);
    solids.push({ x: crane.position.x, z: crane.position.z, r: 2, h: 49 });
  };
  layout.lots.filter((l) => l.kind === 'site').forEach((l, k) => addSite(l.x, l.z, l.w, l.d, k));

  const coolingProfile: THREE.Vector2[] = [];
  for (let k = 0; k <= 16; k += 1) {
    const t = k / 16;
    // A hyperboloid: wide at the foot, waisted, flaring at the lip.
    coolingProfile.push(new THREE.Vector2(22 * Math.sqrt(1 + ((t - 0.72) * 2.4) ** 2) * 0.62 + 4, t * 78));
  }
  const pylonGeo = latticeTower(36, 3.2, 0.9, 0x8d949b);
  const names: { x: number; z: number; r: number; name: string }[] = [];
  for (const s of layout.specials) {
    if (s.site) {
      addSite(s.x, s.z, 70, 60, 7);
      names.push({ x: s.x, z: s.z, r: 50, name: 'site' });
      continue;
    }
    if (s.kind === 'reactor') {
      batch(concrete).flat(s.x, s.z, 240, 150, 0.05, SURFACE_TILE);
      batch(whitePanel).add(new THREE.CylinderGeometry(22, 22, 26, 36).translate(s.x - 30, 13, s.z));
      batch(whitePanel).add(new THREE.SphereGeometry(22, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2).translate(s.x - 30, 26, s.z));
      const hall = facades.get('lab') ?? (await makeFacade(FACADES.lab!, 3));
      batch(hall.material).walls(s.x + 20, s.z, 44, 30, 0, 22, hall.tileW, hall.tileH);
      flatRoof(s.x + 20, s.z, 44, 30, 22);
      for (const tz of [-1, 1]) {
        const tower = new THREE.LatheGeometry(coolingProfile, 40);
        tower.translate(s.x + 85, 0, s.z + tz * 42);
        batch(concrete).add(tower);
        for (let k = 0; k < 6; k += 1) {
          const puff = new THREE.Mesh(
            new THREE.SphereGeometry(10 + k * 2, 12, 8),
            new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.5, depthWrite: false }),
          );
          puff.position.set(s.x + 85, 82 + k * 9, s.z + tz * 42);
          puff.userData.base = puff.position.clone();
          puff.userData.k = k;
          group.add(puff);
          steam.push(puff);
        }
        solids.push({ x: s.x + 85, z: s.z + tz * 42, r: 30, h: 82 });
      }
      solids.push({ x: s.x - 30, z: s.z, r: 24, h: 50 });
      names.push({ x: s.x, z: s.z, r: 120, name: 'reactor' });
    } else if (s.kind === 'spaceport') {
      batch(asphalt).flat(s.x, s.z, 300, 220, 0.05, 7);
      batch(concrete).cylinder(s.x - 60, s.z, 26, 0, 3, SURFACE_TILE, SURFACE_TILE, 36);
      batch(concrete).disc(s.x - 60, s.z, 26, 3, SURFACE_TILE, 36);
      // Launch tower and the rocket on the stand.
      batch(redSteel).add(latticeTower(92, 4, 3.4, 0xffffff).translate(s.x - 74, 3, s.z));
      for (let k = 1; k < 5; k += 1) batch(redSteel).add(new THREE.BoxGeometry(10, 0.6, 1.2).translate(s.x - 68, 3 + k * 18, s.z));
      batch(whitePanel).add(new THREE.CylinderGeometry(4.6, 4.6, 70, 28).translate(s.x - 60, 3 + 35, s.z));
      batch(darkMetal).add(new THREE.CylinderGeometry(4.7, 4.7, 4, 28).translate(s.x - 60, 3 + 46, s.z));
      batch(whitePanel).add(new THREE.ConeGeometry(4.6, 12, 28).translate(s.x - 60, 3 + 76, s.z));
      for (const sz of [-1, 1]) {
        batch(whitePanel).add(new THREE.CylinderGeometry(2.4, 2.4, 40, 18).translate(s.x - 60, 3 + 20, s.z + sz * 7));
        batch(whitePanel).add(new THREE.ConeGeometry(2.4, 6, 18).translate(s.x - 60, 3 + 43, s.z + sz * 7));
      }
      // Hangar with a curved roof, and the control tower.
      const hangar = facades.get('warehouse') ?? (await makeFacade(FACADES.warehouse!, 5));
      batch(hangar.material).walls(s.x + 70, s.z - 40, 80, 50, 0, 14, hangar.tileW, hangar.tileH);
      batch(metal).add(new THREE.CylinderGeometry(25, 25, 80, 32, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2).scale(1, 0.4, 1).translate(s.x + 70, 14, s.z - 40));
      const ctrl = facades.get('glass_dark') ?? (await makeFacade(FACADES.glass_dark!, 6));
      batch(concrete).cylinder(s.x + 60, s.z + 60, 4, 0, 34, SURFACE_TILE, SURFACE_TILE, 18);
      batch(ctrl.material).cylinder(s.x + 60, s.z + 60, 7, 34, 41, ctrl.tileW, ctrl.tileH, 20);
      batch(concrete).disc(s.x + 60, s.z + 60, 7.6, 41, SURFACE_TILE, 20);
      solids.push({ x: s.x - 60, z: s.z, r: 14, h: 96 }, { x: s.x + 70, z: s.z - 40, r: 40, h: 26 }, { x: s.x + 60, z: s.z + 60, r: 8, h: 42 });
      names.push({ x: s.x - 60, z: s.z, r: 50, name: 'gantry' }, { x: s.x + 50, z: s.z, r: 90, name: 'gantry' });
    } else if (s.kind === 'solarFarm') {
      const rows = 14;
      const cols = 10;
      const panel = new THREE.BoxGeometry(14, 0.12, 4.4);
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const px = s.x - 80 + c * 17;
          const pz = s.z - 60 + r * 9;
          batch(solar).add(panel.clone().rotateX(-0.45).translate(px, 2.2, pz));
          batch(darkMetal).add(new THREE.BoxGeometry(0.2, 2, 0.2).translate(px - 5, 1, pz));
          batch(darkMetal).add(new THREE.BoxGeometry(0.2, 2, 0.2).translate(px + 5, 1, pz));
        }
      }
      batch(whitePanel).add(new THREE.BoxGeometry(10, 4, 6).translate(s.x + 100, 2, s.z));
      names.push({ x: s.x, z: s.z, r: 110, name: 'solarFarm' });
    } else if (s.kind === 'dishes') {
      const dishProfile: THREE.Vector2[] = [];
      for (let k = 0; k <= 12; k += 1) {
        const r = (k / 12) * 16;
        dishProfile.push(new THREE.Vector2(r, (r * r) / 50));
      }
      for (let k = -1; k <= 1; k += 1) {
        const x = s.x + k * 60;
        batch(concrete).cylinder(x, s.z, 3, 0, 14, SURFACE_TILE, SURFACE_TILE, 16);
        const dish = new THREE.LatheGeometry(dishProfile, 32);
        dish.rotateX(-0.9 + k * 0.15).rotateY(0.6 * k).translate(x, 20, s.z);
        batch(whitePanel).add(dish);
        batch(whitePanel).add(new THREE.BoxGeometry(6, 6, 6).translate(x, 16, s.z));
        solids.push({ x, z: s.z, r: 18, h: 36 });
      }
      names.push({ x: s.x, z: s.z, r: 100, name: 'antenna' });
    }
  }

  // ---- National works ------------------------------------------------------
  const works = await buildWorksLayer(layout.works, {
    software: opts.software,
    seed: opts.seed,
    facades,
    asphalt,
    concrete,
    pavement,
    plaza,
    grass,
    gravel: roofGravel,
    sandstone,
    paint,
    metal,
    darkMetal,
    whitePanel,
    redSteel,
    copper,
    glass: glassDome,
    solar,
    water,
    craneGeo,
    jibGeo,
    craneMat,
    latticeTower,
  });
  group.add(works.group);
  solids.push(...works.solids);

  // Power line: pylons and sagging cables.
  if (layout.pylons.length > 1) {
    const pylons = new THREE.InstancedMesh(pylonGeo, new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 }), layout.pylons.length);
    layout.pylons.forEach((p, k) => {
      const next = layout.pylons[Math.min(k + 1, layout.pylons.length - 1)]!;
      const prev = layout.pylons[Math.max(k - 1, 0)]!;
      const yaw = Math.atan2(-(next.z - prev.z), next.x - prev.x) + Math.PI / 2;
      pylons.setMatrixAt(k, m4(p.x, 0, p.z, 1, 1, 1, yaw));
    });
    pylons.castShadow = true;
    group.add(pylons);
    // Arms for the cables.
    for (const p of layout.pylons) batch(darkMetal).add(new THREE.BoxGeometry(14, 0.4, 0.4).translate(p.x, 32, p.z));
    for (let k = 0; k + 1 < layout.pylons.length; k += 1) {
      const a = layout.pylons[k]!;
      const b = layout.pylons[k + 1]!;
      for (const off of [-6, 0, 6]) {
        const nx = -(b.z - a.z);
        const nz = b.x - a.x;
        const nl = Math.hypot(nx, nz) || 1;
        const pts: THREE.Vector3[] = [];
        for (let t = 0; t <= 8; t += 1) {
          const u = t / 8;
          pts.push(new THREE.Vector3(a.x + (b.x - a.x) * u + (nx / nl) * off, 31.6 - Math.sin(u * Math.PI) * 4, a.z + (b.z - a.z) * u + (nz / nl) * off));
        }
        batch(darkMetal).add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.06, 3));
      }
    }
  }

  // ---- Merge static geometry ------------------------------------------------
  for (const [material, b] of batches) {
    if (b.empty) continue;
    const mesh = new THREE.Mesh(b.build(), material);
    mesh.castShadow = material !== paint && material !== asphalt && material !== grass;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // ---- Instanced props --------------------------------------------------------
  const instanced = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[], shadow = true) => {
    if (list.length === 0) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const hvacGeo = mergeGeometries(
    [
      tint(new THREE.BoxGeometry(3.2, 1.6, 2).translate(0, 0.8, 0), 0xb9bdc2),
      tint(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 16).translate(-0.7, 1.65, 0), 0x2a2d31),
      tint(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 16).translate(0.8, 1.65, 0), 0x2a2d31),
    ],
    false,
  )!;
  instanced(hvacGeo, new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.5 }), hvac);
  const tankGeo = mergeGeometries(
    [tint(new THREE.CylinderGeometry(1.8, 1.8, 3.4, 16).translate(0, 4.4, 0), 0x8b6a4c), ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => tint(new THREE.BoxGeometry(0.15, 2.7, 0.15).translate(a! * 1.2, 1.35, b! * 1.2), 0x3a3d40)), tint(new THREE.ConeGeometry(1.9, 0.9, 16).translate(0, 6.55, 0), 0x6a5038)],
    false,
  )!;
  instanced(tankGeo, new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.8 }), tanks);
  instanced(
    tint(new THREE.CylinderGeometry(0.15, 0.5, 18, 6).translate(0, 9, 0), 0xc8ccd0),
    new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.8 }),
    spires,
  );

  // Trees: along the sidewalks, in parks, in gardens and on terraces.
  const broad: THREE.Matrix4[] = [];
  const poplars: THREE.Matrix4[] = [];
  const small: THREE.Matrix4[] = [];
  const conifer: THREE.Matrix4[] = [];
  const lamps: THREE.Matrix4[] = [];
  const edgeTreeStep = 13;
  for (const b of layout.blocks) {
    const half = BLOCK / 2 - 1.6;
    const green = b.zone !== 'industrial' && b.zone !== 'military';
    for (let side = 0; side < 4; side += 1) {
      for (let t = -half + 6; t <= half - 6; t += b.zone === 'downtown' ? 19 : edgeTreeStep) {
        const [x, z] = side === 0 ? [b.x + t, b.z + half] : side === 1 ? [b.x + half, b.z - t] : side === 2 ? [b.x - t, b.z - half] : [b.x - half, b.z + t];
        if (green) (b.zone === 'downtown' || b.zone === 'midtown' ? poplars : broad).push(m4(x, slabH, z, 0.85 + hash(x, z) * 0.35, 0.85 + hash(z, x) * 0.35, 0.85 + hash(x, z) * 0.35, hash(x * 3, z) * 6.28));
      }
      // Lamps on the corners and mid-block, arm towards the road.
      for (const t of [-half + 1, 0]) {
        const [x, z, yaw] =
          side === 0 ? [b.x + t, b.z + half + 1, Math.PI / 2] : side === 1 ? [b.x + half + 1, b.z - t, 0] : side === 2 ? [b.x - t, b.z - half - 1, -Math.PI / 2] : [b.x - half - 1, b.z + t, Math.PI];
        lamps.push(m4(x, slabH, z, 1, 1, 1, yaw));
      }
    }
    if (b.zone === 'park' || b.zone === 'campus' || b.zone === 'core') {
      const n = b.zone === 'park' ? 26 : 10;
      for (let k = 0; k < n; k += 1) {
        const x = b.x + (rand(String(b.i), k, b.j) - 0.5) * (BLOCK - 14);
        const z = b.z + (rand(String(b.j), b.i, k) - 0.5) * (BLOCK - 14);
        if (Math.abs(x - b.x) < 4 || Math.abs(z - b.z) < 4) continue;
        if (b.zone === 'core' && Math.abs(z - b.z) < 22) continue;
        if (b.zone === 'park' && Math.hypot(x - b.x - 16, z - b.z + 16) < 11) continue;
        (k % 3 === 0 ? conifer : broad).push(m4(x, slabH, z, 0.9 + hash(x, z) * 0.5, 0.9 + hash(z, x) * 0.5, 0.9 + hash(x, z) * 0.5, hash(x, z) * 6.28));
      }
    }
  }
  for (const lot of layout.lots) {
    if (lot.kind === 'house') {
      const back = lot.z > 0 ? -1 : 1;
      small.push(m4(lot.x + (lot.rand - 0.5) * 6, slabH, lot.z + back * (lot.d / 2 + 4), 0.9, 0.9, 0.9, lot.rand * 6.28));
    }
    if (lot.kind === 'arcology') {
      for (let k = 0; k < 16; k += 1) {
        const tier = 1 + (k % 4);
        const wt = lot.w * 0.8 ** (tier - 1);
        const a = (k / 16) * Math.PI * 2;
        small.push(m4(lot.x + Math.cos(a) * wt * 0.45, slabH + (lot.h / 5) * tier, lot.z + Math.sin(a) * wt * 0.45, 0.7, 0.7, 0.7, a));
      }
    }
  }
  for (const [x, y, z] of works.trees) broad.push(m4(x, y, z, 0.9 + hash(x, z) * 0.3, 0.9 + hash(z, x) * 0.3, 0.9 + hash(x, z) * 0.3, hash(x, z) * 6.28));
  const foliage = treeMaterials(opts.software);
  const coreMat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.95 });
  const plant = (kind: TreeKind, list: THREE.Matrix4[], variants: number) => {
    // A few shapes of each kind, so neighbours are never twins.
    for (let v = 0; v < variants; v += 1) {
      const some = list.filter((_, i) => i % variants === v);
      if (some.length === 0) continue;
      const g = treeGeometry(kind, v + 1);
      instanced(g.trunk, foliage.bark, some);
      instanced(g.crown, g.foliage === 'needles' ? foliage.needles : foliage.leaves, some);
      if (g.core) instanced(g.core, coreMat, some);
    }
  };
  plant('broad', broad, 3);
  plant('poplar', poplars, 2);
  plant('small', small, 2);
  plant('conifer', conifer, 2);
  const lamp = lampGeometry();
  instanced(lamp.pole, new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.6 }), lamps);
  instanced(lamp.head, new THREE.MeshBasicNodeMaterial({ color: 0xfff1cc }), lamps, false);

  // ---- Traffic --------------------------------------------------------------
  const car = carGeometry();
  const cars: Car[] = [];
  const parked: THREE.Matrix4[] = [];
  const parkedColours: THREE.Color[] = [];
  for (const r of layout.roads) {
    const len = r.to - r.from;
    if (len < 40) continue;
    for (const dir of [1, -1]) {
      const n = Math.max(1, Math.round(len / 55));
      for (let k = 0; k < n; k += 1) {
        cars.push({
          axis: r.axis,
          at: r.at,
          lane: dir * 2.4,
          from: r.from,
          to: r.to,
          s: (k + hash(r.at + k, dir)) * (len / n),
          speed: 9 + hash(r.at, dir) * 3,
          dir,
        });
      }
    }
    // Cars parked along the kerbs, with gaps.
    for (let s = r.from + 12; s < r.to - 12; s += 6.5) {
      for (const side of [-1, 1]) {
        if (hash(s * 1.3, r.at + side) < 0.55) continue;
        const near = Math.abs((((s % PITCH) + PITCH) % PITCH) - PITCH / 2);
        if (near > PITCH / 2 - ROAD) continue;
        const across = side * 5.6;
        const yaw = r.axis === 'x' ? (side > 0 ? 0 : Math.PI) : side > 0 ? -Math.PI / 2 : Math.PI / 2;
        parked.push(r.axis === 'x' ? m4(s, 0.02, r.at + across, 1, 1, 1, yaw) : m4(r.at - across, 0.02, s, 1, 1, 1, yaw));
        parkedColours.push(new THREE.Color(CAR_COLOURS[Math.floor(hash(s, r.at) * CAR_COLOURS.length)]!));
      }
    }
  }
  const paintMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.32, metalness: 0.55 });
  const carGlass = new THREE.MeshStandardNodeMaterial({ color: 0x1a2128, roughness: 0.06, metalness: 0.7 });
  const trimMat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 });
  const total = cars.length + parked.length;
  const carBodies = new THREE.InstancedMesh(car.body, paintMat, Math.max(1, total));
  const carGlasses = new THREE.InstancedMesh(car.glass, carGlass, Math.max(1, total));
  const carTrims = new THREE.InstancedMesh(car.trim, trimMat, Math.max(1, total));
  for (const mesh of [carBodies, carGlasses, carTrims]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.count = total;
    group.add(mesh);
  }
  cars.forEach((c, i) => carBodies.setColorAt(i, new THREE.Color(CAR_COLOURS[Math.floor(hash(i, c.at) * CAR_COLOURS.length)]!)));
  parked.forEach((m, k) => {
    const i = cars.length + k;
    carBodies.setMatrixAt(i, m);
    carGlasses.setMatrixAt(i, m);
    carTrims.setMatrixAt(i, m);
    carBodies.setColorAt(i, parkedColours[k]!);
  });
  if (carBodies.instanceColor) carBodies.instanceColor.needsUpdate = true;

  // ---- People ----------------------------------------------------------------
  const person = personGeometry();
  const walkers: Walker[] = [];
  const busy = (zone: string) => (zone === 'downtown' ? 8 : zone === 'core' ? 10 : zone === 'midtown' ? 5 : zone === 'park' ? 5 : 2);
  const maxPeople = opts.software ? 220 : 520;
  for (const b of layout.blocks) {
    for (let k = 0; k < busy(b.zone) && walkers.length < maxPeople; k += 1) {
      walkers.push({
        cx: b.x,
        cz: b.z,
        half: BLOCK / 2 - (k % 2 ? 0.9 : 2.4),
        s: hash(b.x + k, b.z) * BLOCK * 4,
        speed: 1.1 + hash(k, b.x) * 0.6,
        dir: k % 2 ? 1 : -1,
      });
    }
  }
  const clothes = new THREE.InstancedMesh(person.clothes, new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.85 }), Math.max(1, walkers.length));
  const skin = new THREE.InstancedMesh(person.skin, new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.7 }), Math.max(1, walkers.length));
  walkers.forEach((w, i) => {
    clothes.setColorAt(i, new THREE.Color(CLOTHES[Math.floor(hash(i, 7) * CLOTHES.length)]!));
    skin.setColorAt(i, new THREE.Color(SKIN[Math.floor(hash(i, 9) * SKIN.length)]!));
  });
  for (const mesh of [clothes, skin]) {
    mesh.count = walkers.length;
    mesh.castShadow = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }

  const dummy = new THREE.Object3D();
  const update = (dt: number, time: number) => {
    works.update(dt, time);
    cars.forEach((c, i) => {
      const len = c.to - c.from;
      c.s = (c.s + dt * c.speed) % len;
      const along = c.dir > 0 ? c.from + c.s : c.to - c.s;
      if (c.axis === 'x') {
        dummy.position.set(along, 0.02, c.at + c.lane);
        dummy.rotation.set(0, c.dir > 0 ? 0 : Math.PI, 0);
      } else {
        dummy.position.set(c.at - c.lane, 0.02, along);
        dummy.rotation.set(0, c.dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
      }
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      carBodies.setMatrixAt(i, dummy.matrix);
      carGlasses.setMatrixAt(i, dummy.matrix);
      carTrims.setMatrixAt(i, dummy.matrix);
    });
    for (const mesh of [carBodies, carGlasses, carTrims]) mesh.instanceMatrix.needsUpdate = true;

    walkers.forEach((w, i) => {
      const side = w.half * 2;
      w.s = (w.s + dt * w.speed * w.dir + side * 4) % (side * 4);
      const edge = Math.floor(w.s / side);
      const t = w.s - edge * side - w.half;
      let x: number;
      let z: number;
      let yaw: number;
      if (edge === 0) [x, z, yaw] = [w.cx + t, w.cz + w.half, Math.PI / 2];
      else if (edge === 1) [x, z, yaw] = [w.cx + w.half, w.cz - t, Math.PI];
      else if (edge === 2) [x, z, yaw] = [w.cx - t, w.cz - w.half, -Math.PI / 2];
      else [x, z, yaw] = [w.cx - w.half, w.cz + t, 0];
      if (w.dir < 0) yaw += Math.PI;
      dummy.position.set(x, slabH + Math.abs(Math.sin(time * 6 * w.speed + i)) * 0.04, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.setScalar(0.95 + hash(i, 3) * 0.12);
      dummy.updateMatrix();
      clothes.setMatrixAt(i, dummy.matrix);
      skin.setMatrixAt(i, dummy.matrix);
    });
    clothes.instanceMatrix.needsUpdate = true;
    skin.instanceMatrix.needsUpdate = true;

    cranes.forEach((jib, i) => {
      jib.rotation.y = Math.sin(time * 0.2 + i * 1.7) * 1.4 + i;
    });
    for (const puff of steam) {
      const base = puff.userData.base as THREE.Vector3;
      const k = puff.userData.k as number;
      const t = (time * 0.08 + k / 6) % 1;
      puff.position.set(base.x + t * 30, base.y - k * 9 + t * 60, base.z + t * 8);
      puff.scale.setScalar(0.6 + t * 1.6);
      (puff.material as THREE.MeshStandardNodeMaterial).opacity = 0.55 * (1 - t);
    }
  };
  update(0, 0);

  const nameAt = (x: number, z: number): string | null => {
    const work = works.nameAt(x, z);
    if (work) return work;
    const lot = lotAt(layout, x, z);
    if (lot) return NAME_OF[lot.kind];
    for (const n of names) if (Math.hypot(x - n.x, z - n.z) < n.r) return n.name;
    const block = layout.blocks.find((b) => Math.abs(x - b.x) < BLOCK / 2 && Math.abs(z - b.z) < BLOCK / 2);
    if (block?.zone === 'park') return 'park';
    return null;
  };

  return { group, update, nameAt, solids, works };
}

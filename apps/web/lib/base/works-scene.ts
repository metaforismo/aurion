// National works in the capital: a university campus, a hospital, data
// centres, the stock exchange, an airport with planes coming and going,
// solar fields, a nuclear plant, a fusion test reactor, observatories and a
// particle collider ring. Each work is made of parts, and each part belongs
// to the level that adds it, so an upgrade visibly adds buildings.
//
// While a level is being built its ground is a site — fence, gravel, tower
// cranes — and its parts rise one after another as the work advances, each
// growing out of the ground with scaffolding around it: a building site in
// fast motion. Finished works are left as they are; nothing here is rebuilt
// when the game only moves a site forward.
//
// DOM/WebGL only.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { FACADES, makeFacade, type Facade } from './assets';
import type { WorkSite } from './city';
import { Batch } from './geometry';

const TILE = 2.4;

/** Materials the city already has, lent to the works. */
export type WorksKit = {
  software: boolean;
  seed: number;
  facades: Map<string, Facade>;
  asphalt: THREE.Material;
  concrete: THREE.Material;
  pavement: THREE.Material;
  plaza: THREE.Material;
  grass: THREE.Material;
  gravel: THREE.Material;
  sandstone: THREE.Material;
  paint: THREE.Material;
  metal: THREE.Material;
  darkMetal: THREE.Material;
  whitePanel: THREE.Material;
  redSteel: THREE.Material;
  copper: THREE.Material;
  glass: THREE.Material;
  solar: THREE.Material;
  water: THREE.Material;
  craneGeo: THREE.BufferGeometry;
  jibGeo: THREE.BufferGeometry;
  craneMat: THREE.Material;
  latticeTower: (height: number, base: number, top: number, color: number) => THREE.BufferGeometry;
};

export type WorksLayer = {
  group: THREE.Group;
  update(dt: number, time: number): void;
  /** How far along each work being built is (0..1), keyed by work id. */
  setProgress(progress: Record<string, number>): void;
  nameAt(x: number, z: number): string | null;
  /** Where a work stands and how far to stand back to see it whole. */
  focus(id: string): { x: number; z: number; r: number } | null;
  solids: { x: number; z: number; r: number; h: number }[];
  /** Where the grounds want trees (x, ground height, z). */
  trees: [number, number, number][];
};

/** A piece of a work: one level's building, merged by material. */
class Part {
  readonly batches = new Map<THREE.Material, Batch>();
  readonly extras: THREE.Object3D[] = [];
  /** Footprint and height, for the scaffolding while it goes up. */
  box = { x: 0, z: 0, w: 10, d: 10, h: 10 };
  constructor(readonly level: number) {}
  b(m: THREE.Material): Batch {
    let b = this.batches.get(m);
    if (!b) {
      b = new Batch();
      this.batches.set(m, b);
    }
    return b;
  }
  add(m: THREE.Material, geo: THREE.BufferGeometry): void {
    this.b(m).add(geo);
  }
  build(): THREE.Group {
    const g = new THREE.Group();
    for (const [m, b] of this.batches) {
      if (b.empty) continue;
      const mesh = new THREE.Mesh(b.build(), m);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    for (const e of this.extras) g.add(e);
    return g;
  }
}

type Animated = { kind: 'spin'; obj: THREE.Object3D; speed: number } | { kind: 'plane'; obj: THREE.Object3D; x: number; z: number; len: number; yaw: number } | { kind: 'steam'; obj: THREE.Mesh; base: THREE.Vector3; k: number } | { kind: 'pulse'; obj: THREE.Mesh };

/** A passenger jet, nose along +x, sitting on its wheels at y = 0. */
function airliner(scale = 1): { body: THREE.BufferGeometry; tail: THREE.BufferGeometry } {
  const parts: THREE.BufferGeometry[] = [];
  const L = 38 * scale;
  const R = 2 * scale;
  parts.push(new THREE.CylinderGeometry(R, R, L * 0.78, 16).rotateZ(Math.PI / 2).translate(0, R + 1.6, 0));
  parts.push(new THREE.SphereGeometry(R, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2).scale(1.6, 1, 1).translate(L * 0.39, R + 1.6, 0));
  parts.push(new THREE.ConeGeometry(R, L * 0.2, 16).rotateZ(Math.PI / 2).translate(-L * 0.49, R + 1.9, 0));
  // Swept wings and the tailplane.
  const wing = (span: number, chord: number, sweep: number, y: number, x: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(-sweep, span);
    s.lineTo(-sweep - chord * 0.45, span);
    s.lineTo(-chord, 0);
    s.closePath();
    for (const side of [1, -1]) {
      parts.push(new THREE.ExtrudeGeometry(s, { depth: 0.35 * scale, bevelEnabled: false }).rotateX((Math.PI / 2) * side).translate(x, y, 0));
    }
  };
  wing(16 * scale, 7 * scale, 7 * scale, R + 0.9, 4 * scale);
  wing(6 * scale, 3.4 * scale, 3 * scale, R + 2.4, -L * 0.36);
  // Engines under the wings and the landing gear.
  for (const side of [1, -1]) {
    parts.push(new THREE.CylinderGeometry(1 * scale, 0.9 * scale, 4.4 * scale, 12).rotateZ(Math.PI / 2).translate(2 * scale, R - 0.1, side * 6 * scale));
    parts.push(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 8).rotateX(Math.PI / 2).translate(-1, 0.5, side * 2.4 * scale));
    parts.push(new THREE.BoxGeometry(0.25, 1.6, 0.25).translate(-1, 1.2, side * 2.4 * scale));
  }
  // Nose gear.
  parts.push(new THREE.CylinderGeometry(0.45, 0.45, 0.4, 8).rotateX(Math.PI / 2).translate(L * 0.32, 0.45, 0));
  parts.push(new THREE.BoxGeometry(0.25, 1.6, 0.25).translate(L * 0.32, 1.2, 0));
  const body = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    g.deleteAttribute('uv');
    return g;
  }), false)!;
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(-4 * scale, 7 * scale);
  fin.lineTo(-7 * scale, 7 * scale);
  fin.lineTo(-6.5 * scale, 0);
  fin.closePath();
  const tail = new THREE.ExtrudeGeometry(fin, { depth: 0.35 * scale, bevelEnabled: false }).translate(-L * 0.36, R * 2 + 1.2, -0.17 * scale);
  tail.deleteAttribute('uv');
  return { body, tail };
}

const PLANE = { geo: null as ReturnType<typeof airliner> | null };

/** A cooling tower: a concrete hyperboloid. */
function coolingTower(h: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let k = 0; k <= 18; k += 1) {
    const t = k / 18;
    pts.push(new THREE.Vector2(h * 0.18 * Math.sqrt(1 + ((t - 0.72) * 2.4) ** 2) + h * 0.05, t * h));
  }
  return new THREE.LatheGeometry(pts, 44);
}

function dishGeometry(r: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let k = 0; k <= 14; k += 1) {
    const x = (k / 14) * r;
    pts.push(new THREE.Vector2(x, (x * x) / (r * 3)));
  }
  return new THREE.LatheGeometry(pts, 40);
}

export async function buildWorksLayer(sites: readonly WorkSite[], kit: WorksKit): Promise<WorksLayer> {
  const group = new THREE.Group();
  const solids: WorksLayer['solids'] = [];
  const names: { x: number; z: number; w: number; d: number; name: string }[] = [];
  const animated: Animated[] = [];
  const facade = async (style: string): Promise<Facade> => {
    let f = kit.facades.get(style);
    if (!f) {
      f = await makeFacade(FACADES[style]!, kit.seed + style.length * 13, kit.software ? 512 : 1024);
      kit.facades.set(style, f);
    }
    return f;
  };
  const [lab, glassBlue, glassDark, glassTeal, officeConcrete, capitol, datacenter, warehouse, brick, store] = await Promise.all(
    ['lab', 'glass_blue', 'glass_dark', 'glass_teal', 'office_concrete', 'capitol', 'datacenter', 'warehouse', 'apartment_brick', 'storefront'].map(facade),
  ) as [Facade, Facade, Facade, Facade, Facade, Facade, Facade, Facade, Facade, Facade];
  const signRed = new THREE.MeshStandardNodeMaterial({ color: 0xd2232a, roughness: 0.5 });
  const helipad = new THREE.MeshStandardNodeMaterial({ color: 0x2a2d31, roughness: 0.8 });
  const track = new THREE.MeshStandardNodeMaterial({ color: 0xa8463a, roughness: 0.9 });
  const beam = new THREE.MeshBasicNodeMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.5, depthWrite: false });
  const plasma = new THREE.MeshBasicNodeMaterial({ color: 0xff8be6, transparent: true, opacity: 0.85 });
  const fenceMat = new THREE.MeshStandardNodeMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.6, transparent: true, opacity: 0.55 });
  const scaffoldMat = new THREE.MeshStandardNodeMaterial({ map: scaffoldTexture(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.7 });
  const steamMat = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.5, depthWrite: false });
  if (!PLANE.geo) PLANE.geo = airliner();
  const planeBody = new THREE.MeshStandardNodeMaterial({ color: 0xf4f5f7, roughness: 0.35, metalness: 0.3 });
  const planeTail = new THREE.MeshStandardNodeMaterial({ color: 0x1f4e8c, roughness: 0.4 });
  const plane = (x: number, z: number, yaw: number, part: Part) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(PLANE.geo!.body, planeBody), new THREE.Mesh(PLANE.geo!.tail, planeTail));
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    g.traverse((o) => {
      o.castShadow = true;
    });
    part.extras.push(g);
    return g;
  };
  const steamFrom = (part: Part, x: number, y: number, z: number, size: number) => {
    for (let k = 0; k < 5; k += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(size + k * 2, 12, 8), steamMat.clone());
      puff.position.set(x, y + k * 8, z);
      part.extras.push(puff);
      animated.push({ kind: 'steam', obj: puff, base: new THREE.Vector3(x, y, z), k });
    }
  };
  const flatRoof = (p: Part, x: number, z: number, w: number, d: number, y: number) => {
    p.b(kit.gravel).flat(x, z, w, d, y, TILE);
    p.b(kit.concrete).walls(x, z, w + 0.6, d + 0.6, y, y + 1.1, TILE, TILE);
  };
  const block = (p: Part, f: Facade, x: number, z: number, w: number, d: number, y0: number, h: number, roof = true) => {
    p.b(f.material).walls(x, z, w, d, y0, y0 + h, f.tileW, f.tileH, y0);
    if (roof) flatRoof(p, x, z, w, d, y0 + h);
  };
  const columns = (p: Part, x0: number, x1: number, z: number, y: number, h: number, n: number, r = 0.9) => {
    for (let k = 0; k < n; k += 1) {
      const x = x0 + ((x1 - x0) * k) / (n - 1);
      p.add(kit.sandstone, new THREE.CylinderGeometry(r, r * 1.08, h, 14).translate(x, y + h / 2, z));
    }
  };
  /** A triangular pediment across x, facing +z. */
  const pediment = (p: Part, x: number, z: number, w: number, y: number, rise: number, depth: number) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, rise);
    s.closePath();
    p.add(kit.sandstone, new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }).translate(x, y, z - depth));
  };
  const treeSpots: [number, number, number][] = [];
  const trees = (y: number, list: [number, number][]) => {
    for (const [x, z] of list) treeSpots.push([x, y, z]);
  };
  const yellowSteel = new THREE.MeshStandardNodeMaterial({ color: 0xe8b62c, roughness: 0.55, metalness: 0.45 });
  const lattice = (p: Part, geo: THREE.BufferGeometry, yellow = false) => p.add(yellow ? yellowSteel : kit.metal, geo);
  const lawn = (p: Part, x: number, z: number, w: number, d: number, y = 0.06) => p.b(kit.grass).flat(x, z, w, d, y, 3.2);

  // ---- Per-work builders --------------------------------------------------
  // Each returns the parts for every level; the level a part belongs to is
  // the one that adds it.
  const builders: Record<string, (s: WorkSite, y: number) => Part[]> = {
    university: (s, y) => {
      const { x, z } = s;
      const ground = new Part(1);
      lawn(ground, x, z, s.w - 4, s.d - 4, y + 0.04);
      ground.b(kit.plaza).flat(x, z - 30, 90, 26, y + 0.06, TILE);
      lawn(ground, x, z + 10, 90, 60, y + 0.07);
      ground.b(kit.plaza).flat(x, z + 10, 4, 60, y + 0.09, TILE);
      ground.b(kit.plaza).flat(x, z + 10, 90, 4, y + 0.09, TILE);
      // Main hall: sandstone, portico, pediment, a clock tower.
      const hall = new Part(1);
      hall.box = { x, z: z - 40, w: 70, d: 26, h: 20 };
      block(hall, capitol, x, z - 40, 70, 26, y, 18);
      hall.b(kit.sandstone).box(x, z - 25, 34, 6, y, y + 1.4, TILE);
      columns(hall, x - 15, x + 15, z - 24, y + 1.4, 12, 6);
      hall.b(kit.sandstone).box(x, z - 25, 34, 6, y + 13.4, y + 15, TILE);
      pediment(hall, x, z - 22, 34, y + 15, 6, 6);
      hall.b(kit.sandstone).box(x, z - 46, 9, 9, y + 18, y + 34, TILE);
      hall.add(kit.copper, new THREE.ConeGeometry(7, 9, 4).rotateY(Math.PI / 4).translate(x, y + 38.5, z - 46));
      hall.add(kit.whitePanel, new THREE.CylinderGeometry(2.2, 2.2, 0.3, 24).rotateX(Math.PI / 2).translate(x, y + 30, z - 41.4));
      const rows: [number, number][] = [];
      for (let k = -4; k <= 4; k += 1) rows.push([x + k * 11, z - 12], [x + k * 11, z + 44]);
      trees(y, rows);
      // Faculty wings in brick and a round library.
      const wings = new Part(2);
      wings.box = { x, z: z + 10, w: 150, d: 70, h: 16 };
      for (const sx of [-1, 1]) block(wings, brick, x + sx * 62, z + 10, 22, 64, y, 15);
      const library = new Part(2);
      library.box = { x, z: z + 52, w: 30, d: 30, h: 22 };
      library.b(lab.material).cylinder(x, z + 52, 14, y, y + 14, lab.tileW, lab.tileH, 32);
      library.add(kit.copper, new THREE.SphereGeometry(14.5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1).translate(x, y + 14, z + 52));
      // Engineering faculty in glass, with an athletics track.
      const eng = new Part(3);
      eng.box = { x: x + 62, z: z - 52, w: 50, d: 26, h: 26 };
      block(eng, glassTeal, x + 62, z - 52, 50, 24, y, 26);
      for (let k = 0; k < 6; k += 1) eng.add(kit.solar, new THREE.BoxGeometry(6, 0.12, 3).rotateX(-0.4).translate(x + 44 + k * 7, y + 28, z - 52));
      const field = new Part(3);
      field.box = { x: x - 62, z: z - 52, w: 56, d: 30, h: 2 };
      field.add(track, new THREE.CylinderGeometry(15, 15, 0.1, 40).scale(1.8, 1, 1).translate(x - 62, y + 0.1, z - 52));
      field.add(kit.grass, new THREE.CylinderGeometry(10.5, 10.5, 0.1, 40).scale(2.1, 1, 1).translate(x - 62, y + 0.16, z - 52));
      return [ground, hall, wings, library, eng, field];
    },

    hospital: (s, y) => {
      const { x, z } = s;
      const ground = new Part(1);
      ground.b(kit.plaza).flat(x, z, s.w, s.d, y + 0.02, TILE);
      const main = new Part(1);
      main.box = { x, z: z - 10, w: 50, d: 24, h: 22 };
      main.b(store.material).walls(x, z - 10, 50, 24, y, y + 5, store.tileW, store.tileH);
      block(main, lab, x, z - 10, 50, 24, y + 5, 17);
      // The red cross, a canopy over the emergency entrance, ambulances.
      main.add(kit.whitePanel, new THREE.BoxGeometry(7, 7, 0.4).translate(x, y + 17, z + 2.3));
      main.add(signRed, new THREE.BoxGeometry(5.2, 1.6, 0.5).translate(x, y + 17, z + 2.4));
      main.add(signRed, new THREE.BoxGeometry(1.6, 5.2, 0.5).translate(x, y + 17, z + 2.4));
      main.b(kit.concrete).box(x + 14, z + 6, 16, 8, y + 4.4, y + 5, TILE);
      for (const k of [0, 1]) {
        main.add(kit.whitePanel, new THREE.BoxGeometry(6, 2.6, 2.4).translate(x + 10 + k * 7, y + 1.5, z + 9));
        main.add(signRed, new THREE.BoxGeometry(6.02, 0.4, 2.42).translate(x + 10 + k * 7, y + 1.6, z + 9));
      }
      const tower = new Part(2);
      tower.box = { x: x - 18, z: z + 16, w: 24, d: 24, h: 44 };
      block(tower, lab, x - 18, z + 16, 24, 24, y, 42);
      tower.b(helipad).disc(x - 18, z + 16, 9, y + 43.2, TILE, 32);
      tower.add(kit.whitePanel, new THREE.TorusGeometry(7.5, 0.25, 6, 40).rotateX(Math.PI / 2).translate(x - 18, y + 43.25, z + 16));
      for (const g of [new THREE.BoxGeometry(0.8, 0.05, 5).translate(-1.6, 0, 0), new THREE.BoxGeometry(0.8, 0.05, 5).translate(1.6, 0, 0), new THREE.BoxGeometry(3.2, 0.05, 0.8)]) {
        tower.add(kit.whitePanel, g.translate(x - 18, y + 43.3, z + 16));
      }
      const wing = new Part(3);
      wing.box = { x: x + 18, z: z + 18, w: 26, d: 22, h: 26 };
      block(wing, officeConcrete, x + 18, z + 18, 26, 22, y, 26);
      return [ground, main, tower, wing];
    },

    datacenter: (s, y) => {
      const { x, z } = s;
      const ground = new Part(1);
      ground.b(kit.concrete).flat(x, z, s.w, s.d, y + 0.04, TILE);
      // Security fence round the compound.
      ground.b(fenceMat).walls(x, z, s.w - 2, s.d - 2, y, y + 2.6, 4, 4);
      const halls: Part[] = [];
      const hall = (level: number, hx: number, hz: number, w: number) => {
        const p = new Part(level);
        p.box = { x: hx, z: hz, w, d: 26, h: 13 };
        block(p, datacenter, hx, hz, w, 26, y, 12);
        // Chillers on the roof: fans in a row.
        for (let k = 0; k < Math.floor(w / 6); k += 1) {
          const fx = hx - w / 2 + 3 + k * 6;
          p.b(kit.whitePanel).box(fx, hz, 4.6, 8, y + 13.1, y + 14.6, TILE);
          for (const dz of [-2, 2]) p.add(kit.darkMetal, new THREE.CylinderGeometry(1.6, 1.6, 0.2, 18).translate(fx, y + 14.7, hz + dz));
        }
        // Backup generators along the side.
        for (let k = 0; k < Math.floor(w / 10); k += 1) p.b(kit.metal).box(hx - w / 2 + 5 + k * 10, hz + 17, 7, 3, y, y + 3, TILE);
        halls.push(p);
      };
      hall(1, x - 36, z - 30, 64);
      hall(1, x + 36, z - 30, 64);
      hall(2, x - 36, z + 18, 64);
      hall(2, x + 36, z + 18, 64);
      // The hyperscale hall and its substation.
      const big = new Part(3);
      big.box = { x, z: z + 50, w: 140, d: 14, h: 4 };
      for (let k = 0; k < 6; k += 1) {
        big.add(kit.darkMetal, new THREE.BoxGeometry(4, 5, 4).translate(x - 60 + k * 8, y + 2.5, z + 50));
        big.add(kit.whitePanel, new THREE.CylinderGeometry(0.4, 0.4, 3, 8).translate(x - 60 + k * 8, y + 6.5, z + 50));
      }
      lattice(big, kit.latticeTower(18, 2.2, 1.2, 0x8d949b).translate(x + 20, y, z + 50));
      return [ground, ...halls, big];
    },

    exchange: (s, y) => {
      const { x, z } = s;
      const ground = new Part(1);
      ground.b(kit.plaza).flat(x, z, s.w, s.d, y + 0.02, TILE);
      const temple = new Part(1);
      temple.box = { x, z: z + 8, w: 50, d: 32, h: 24 };
      for (let k = 0; k < 4; k += 1) temple.b(kit.sandstone).box(x, z + 22 - k * 0.8, 46, 4 - k * 0.8, y, y + 0.4 * (k + 1), TILE);
      block(temple, capitol, x, z + 4, 44, 26, y, 18);
      columns(temple, x - 20, x + 20, z + 19, y + 1.6, 13, 8, 1);
      temple.b(kit.sandstone).box(x, z + 19, 46, 3.4, y + 14.6, y + 16.6, TILE);
      pediment(temple, x, z + 20.7, 46, y + 16.6, 6.5, 3.4);
      const tower = new Part(2);
      tower.box = { x: x - 14, z: z - 22, w: 26, d: 24, h: 96 };
      block(tower, glassDark, x - 14, z - 22, 24, 22, y, 92);
      tower.b(kit.concrete).box(x - 14, z - 22, 12, 12, y + 92, y + 98, TILE);
      const twin = new Part(3);
      twin.box = { x: x + 16, z: z - 22, w: 24, d: 24, h: 124 };
      twin.b(glassBlue.material).cylinder(x + 16, z - 22, 11, y, y + 120, glassBlue.tileW, glassBlue.tileH, 32);
      twin.b(kit.gravel).disc(x + 16, z - 22, 11, y + 120, TILE, 32);
      twin.add(kit.metal, new THREE.CylinderGeometry(0.3, 0.6, 20, 8).translate(x + 16, y + 130, z - 22));
      // A sky bridge between the towers.
      twin.b(glassBlue.material).walls(x + 1, z - 22, 10, 6, y + 60, y + 64, glassBlue.tileW, glassBlue.tileH);
      return [ground, temple, tower, twin];
    },

    airport: (s, y) => {
      const { x, z } = s;
      const ground = new Part(1);
      lawn(ground, x, z, s.w, s.d, y + 0.03);
      const runway = (level: number, rz: number, len: number) => {
        const p = new Part(level);
        p.box = { x, z: rz, w: len, d: 46, h: 1 };
        p.b(kit.asphalt).flat(x, rz, len, 46, y + 0.06, 9);
        for (let k = -len / 2 + 40; k < len / 2 - 40; k += 30) p.b(kit.paint).flat(x + k, rz, 14, 0.8, y + 0.08, 1);
        for (const end of [-1, 1]) {
          for (let k = -4; k <= 4; k += 1) p.b(kit.paint).flat(x + end * (len / 2 - 12), rz + k * 4.2, 20, 1.8, y + 0.08, 1);
        }
        p.b(kit.paint).flat(x, rz + 22, len - 6, 0.5, y + 0.08, 1);
        p.b(kit.paint).flat(x, rz - 22, len - 6, 0.5, y + 0.08, 1);
        return p;
      };
      const r1 = runway(1, z - 60, 640);
      // Taxiway and apron.
      r1.b(kit.asphalt).flat(x, z - 18, 560, 18, y + 0.05, 9);
      r1.b(kit.concrete).flat(x, z + 30, 300, 70, y + 0.05, TILE);
      const terminal = new Part(1);
      terminal.box = { x, z: z + 80, w: 150, d: 34, h: 18 };
      block(terminal, glassBlue, x, z + 80, 150, 30, y, 14, false);
      terminal.add(kit.metal, new THREE.CylinderGeometry(30, 30, 150, 40, 1, true, -0.6, 1.2).rotateZ(Math.PI / 2).scale(1, 0.35, 1).translate(x, y + 14 - 30 * 0.35 * Math.cos(0.6), z + 80));
      terminal.b(kit.concrete).cylinder(x + 90, z + 70, 3.5, y, y + 38, TILE, TILE, 16);
      terminal.b(glassDark.material).cylinder(x + 90, z + 70, 7, y + 38, y + 44, glassDark.tileW, glassDark.tileH, 20);
      terminal.b(kit.concrete).disc(x + 90, z + 70, 7.5, y + 44, TILE, 20);
      for (const k of [-1, 0, 1]) plane(x + k * 60, z + 38, -Math.PI / 2, terminal);
      const pier = new Part(2);
      pier.box = { x: x - 140, z: z + 50, w: 120, d: 22, h: 12 };
      block(pier, glassBlue, x - 140, z + 62, 120, 18, y, 10);
      pier.b(kit.concrete).flat(x - 140, z + 30, 130, 50, y + 0.06, TILE);
      for (const k of [-1, 0, 1]) plane(x - 140 + k * 42, z + 36, -Math.PI / 2, pier);
      const garage = new Part(2);
      garage.box = { x: x + 140, z: z + 90, w: 60, d: 40, h: 14 };
      for (let f = 0; f < 4; f += 1) garage.b(kit.concrete).box(x + 140, z + 90, 60, 40, y + f * 3.4, y + f * 3.4 + 0.5, TILE);
      for (const cx of [-28, 28]) for (const cz of [-18, 18]) garage.b(kit.concrete).box(x + 140 + cx, z + 90 + cz, 1.2, 1.2, y, y + 13.6, TILE);
      const r2 = runway(3, z - 120, 700);
      const cargo = new Part(3);
      cargo.box = { x: x + 220, z: z + 30, w: 90, d: 50, h: 20 };
      cargo.b(warehouse.material).walls(x + 220, z + 30, 90, 50, y, y + 14, warehouse.tileW, warehouse.tileH);
      cargo.add(kit.metal, new THREE.CylinderGeometry(26, 26, 90, 32, 1, true, -1, 2).rotateZ(Math.PI / 2).scale(1, 0.32, 1).translate(x + 220, y + 14 - 26 * 0.32 * Math.cos(1), z + 30));
      plane(x + 220, z - 10, Math.PI / 2, cargo);
      // One plane always on the move: rolling down the runway and climbing out.
      const mover = new THREE.Group();
      mover.add(new THREE.Mesh(PLANE.geo!.body, planeBody), new THREE.Mesh(PLANE.geo!.tail, planeTail));
      mover.traverse((o) => {
        o.castShadow = true;
      });
      terminal.extras.push(mover);
      animated.push({ kind: 'plane', obj: mover, x, z: z - 60, len: 640, yaw: 0 });
      return [ground, r1, terminal, pier, garage, r2, cargo];
    },

    solar: (s, y) => {
      const { x, z } = s;
      const ground = new Part(1);
      lawn(ground, x, z, s.w, s.d, y + 0.03);
      const field = (level: number, z0: number) => {
        const p = new Part(level);
        p.box = { x, z: z0 + 22, w: s.w - 20, d: 50, h: 3 };
        const panel = new THREE.BoxGeometry(16, 0.12, 4.4).rotateX(-0.5);
        for (let r = 0; r < 5; r += 1) {
          for (let c = 0; c < 10; c += 1) {
            const px = x - s.w / 2 + 18 + c * 19;
            const pz = z0 + r * 10;
            p.add(kit.solar, panel.clone().translate(px, y + 2.2, pz));
            for (const dx of [-6, 6]) p.add(kit.darkMetal, new THREE.BoxGeometry(0.2, 2, 0.2).translate(px + dx, y + 1, pz));
          }
        }
        p.b(kit.whitePanel).box(x + s.w / 2 - 8, z0 + 20, 6, 4, y, y + 3, TILE);
        return p;
      };
      return [ground, field(1, z - 70), field(2, z - 15), field(3, z + 40)];
    },

    nuclear: (s, y) => {
      const { x, z } = s;
      const ground = new Part(1);
      ground.b(kit.concrete).flat(x, z, s.w, s.d, y + 0.04, TILE);
      ground.b(fenceMat).walls(x, z, s.w - 2, s.d - 2, y, y + 3, 4, 4);
      const unit = (level: number, ux: number, tz: number) => {
        const reactor = new Part(level);
        reactor.box = { x: ux, z: z - 40, w: 90, d: 40, h: 46 };
        reactor.b(kit.concrete).cylinder(ux - 20, z - 40, 17, y, y + 30, TILE, TILE, 40);
        reactor.add(kit.whitePanel, new THREE.SphereGeometry(17, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2).translate(ux - 20, y + 30, z - 40));
        block(reactor, warehouse, ux + 20, z - 40, 46, 26, y, 22);
        reactor.b(kit.concrete).cylinder(ux + 40, z - 54, 2.4, y, y + 60, TILE, TILE, 16);
        const tower = new Part(level);
        tower.box = { x: ux, z: z + tz, w: 70, d: 70, h: 80 };
        tower.add(kit.concrete, coolingTower(80).translate(ux, y, z + tz));
        steamFrom(tower, ux, y + 84, z + tz, 11);
        solids.push({ x: ux, z: z + tz, r: 30, h: 84 }, { x: ux - 20, z: z - 40, r: 18, h: 48 });
        return [reactor, tower];
      };
      const switchyard = new Part(1);
      switchyard.box = { x: x + 100, z: z + 50, w: 50, d: 60, h: 18 };
      for (let k = 0; k < 4; k += 1) lattice(switchyard, kit.latticeTower(16, 1.6, 0.9, 0x8d949b).translate(x + 85 + (k % 2) * 30, y, z + 30 + Math.floor(k / 2) * 40));
      return [ground, ...unit(1, x - 70, 45), switchyard, ...unit(2, x + 10, 45), ...unit(3, x + 90, -45)];
    },

    fusion_lab: (s, y) => {
      const { x, z } = s;
      const ground = new Part(1);
      lawn(ground, x, z, s.w, s.d, y + 0.03);
      ground.b(kit.plaza).flat(x + 5, z, s.w - 40, 34, y + 0.05, TILE);
      // A round hall with a glass roof: the tokamak shows through it,
      // magnet coils round the torus and the plasma glowing inside.
      const device = (level: number, dx: number, dz: number, R: number) => {
        const p = new Part(level);
        p.box = { x: dx, z: dz, w: R * 4, d: R * 4, h: R * 1.3 };
        p.b(lab.material).cylinder(dx, dz, R * 1.9, y, y + R * 0.9, lab.tileW, lab.tileH, 48);
        p.b(kit.concrete).disc(dx, dz, R * 1.9, y + 0.12, TILE, 48);
        p.add(kit.glass, new THREE.SphereGeometry(R * 1.9, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.32, 1).translate(dx, y + R * 0.9, dz));
        p.add(kit.darkMetal, new THREE.TorusGeometry(R, R * 0.34, 20, 48).rotateX(Math.PI / 2).translate(dx, y + R * 0.55, dz));
        for (let k = 0; k < 18; k += 1) {
          const a = (k / 18) * Math.PI * 2;
          p.add(kit.copper, new THREE.TorusGeometry(R * 0.42, R * 0.06, 8, 24).rotateY(-a).translate(dx + Math.cos(a) * R, y + R * 0.55, dz + Math.sin(a) * R));
        }
        const glow = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.12, 12, 64).rotateX(Math.PI / 2).translate(dx, y + R * 0.55, dz), plasma);
        p.extras.push(glow);
        animated.push({ kind: 'pulse', obj: glow });
        solids.push({ x: dx, z: dz, r: R * 1.9, h: R * 1.5 });
        return p;
      };
      const t1 = device(1, x - 30, z, 12);
      const power = new Part(2);
      power.box = { x: x + 40, z: z - 30, w: 60, d: 50, h: 22 };
      block(power, lab, x + 40, z - 40, 50, 22, y, 16);
      for (let k = 0; k < 5; k += 1) power.add(kit.whitePanel, new THREE.CylinderGeometry(3, 3, 16, 20).translate(x + 22 + k * 9, y + 8, z - 14));
      for (let k = 0; k < 8; k += 1) power.b(kit.metal).box(x + 20 + k * 6, z + 4, 4, 6, y, y + 3.5, TILE);
      const t2 = device(3, x + 40, z + 40, 16);
      return [ground, t1, power, t2];
    },

    observatory: (s, y) => {
      const { x, z } = s;
      const ground = new Part(1);
      lawn(ground, x, z, s.w, s.d, y + 0.03);
      ground.b(kit.plaza).flat(x, z, 100, 5, y + 0.05, TILE);
      ground.b(kit.plaza).flat(x, z, 5, 100, y + 0.05, TILE);
      const dome = (level: number, dx: number, dz: number, r: number) => {
        const p = new Part(level);
        p.box = { x: dx, z: dz, w: r * 2.2, d: r * 2.2, h: r * 2 };
        p.b(kit.whitePanel).cylinder(dx, dz, r, y, y + r * 0.9, TILE, TILE, 32);
        const cap = new THREE.Group();
        cap.add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), kit.whitePanel));
        cap.add(new THREE.Mesh(new THREE.BoxGeometry(r * 0.36, r * 0.9, r * 2.1).translate(0, r * 0.5, 0).rotateX(0.5), kit.darkMetal));
        cap.position.set(dx, y + r * 0.9, dz);
        cap.traverse((o) => {
          o.castShadow = true;
        });
        p.extras.push(cap);
        animated.push({ kind: 'spin', obj: cap, speed: 0.05 + level * 0.02 });
        return p;
      };
      const office = new Part(1);
      office.box = { x: x + 40, z: z + 40, w: 40, d: 20, h: 10 };
      block(office, lab, x + 40, z + 40, 40, 18, y, 9);
      const radio = new Part(3);
      radio.box = { x: x - 40, z: z - 30, w: 70, d: 70, h: 50 };
      radio.b(kit.concrete).cylinder(x - 40, z - 30, 4, y, y + 22, TILE, TILE, 16);
      const dish = new THREE.Group();
      dish.add(new THREE.Mesh(dishGeometry(28).rotateX(-1.0), kit.whitePanel));
      dish.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 26, 6).rotateX(-1.0 + Math.PI / 2).translate(0, 8, 9), kit.metal));
      dish.position.set(x - 40, y + 26, z - 30);
      dish.traverse((o) => {
        o.castShadow = true;
      });
      radio.extras.push(dish);
      animated.push({ kind: 'spin', obj: dish, speed: 0.03 });
      solids.push({ x: x - 40, z: z - 30, r: 30, h: 56 });
      return [ground, dome(1, x, z, 11), office, dome(2, x + 40, z - 30, 8), dome(2, x - 40, z + 40, 8), radio];
    },

    collider: (s, y) => {
      const { x, z } = s;
      // The rings run underground: on the surface a service road traces
      // them, the beam line glows faintly, and halls stand over the shafts.
      const ring = (level: number, R: number, halls: number) => {
        const p = new Part(level);
        p.box = { x, z, w: R * 2, d: R * 2, h: 2 };
        p.add(kit.asphalt, new THREE.RingGeometry(R - 4, R + 4, 160).rotateX(-Math.PI / 2).translate(x, y + 0.07, z));
        const line = new THREE.Mesh(new THREE.TorusGeometry(R, 0.5, 6, 200).rotateX(Math.PI / 2).translate(x, y + 0.3, z), beam);
        p.extras.push(line);
        animated.push({ kind: 'pulse', obj: line });
        for (let k = 0; k < halls; k += 1) {
          const a = (k / halls) * Math.PI * 2 + level;
          const hx = x + Math.cos(a) * R;
          const hz = z + Math.sin(a) * R;
          block(p, warehouse, hx, hz, 26, 18, y, 10);
          p.b(kit.whitePanel).cylinder(hx + 18, hz, 5, y, y + 6, TILE, TILE, 20);
          p.b(kit.concrete).disc(hx + 18, hz, 5, y + 6, TILE, 20);
          lattice(p, kit.latticeTower(14, 1.4, 1, 0xf0bd2a).translate(hx - 18, y, hz), true);
        }
        return p;
      };
      const campus = new Part(1);
      const cx = x - Math.SQRT1_2 * 150;
      const cz = z - Math.SQRT1_2 * 150;
      campus.box = { x: cx, z: cz, w: 80, d: 60, h: 28 };
      block(campus, lab, cx - 20, cz, 40, 22, y, 14);
      block(campus, officeConcrete, cx + 24, cz - 16, 30, 18, y, 18);
      // The visitors' globe.
      campus.add(kit.copper, new THREE.SphereGeometry(13, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).translate(cx + 20, y, cz + 24));
      return [campus, ring(1, 150, 4), ring(2, 215, 6), ring(3, 270, 8)];
    },

    intel_hq: (s, y) => {
      const { x, z } = s;
      const ground = new Part(1);
      lawn(ground, x, z, s.w, s.d, y + 0.02);
      ground.b(fenceMat).walls(x, z, s.w - 2, s.d - 2, y, y + 2.4, 4, 4);
      const main = new Part(1);
      main.box = { x, z, w: 46, d: 46, h: 16 };
      // A low ring of offices round a courtyard, in dark glass.
      for (const [dx, dz, w, d] of [[0, -19, 46, 8], [0, 19, 46, 8], [-19, 0, 8, 30], [19, 0, 8, 30]] as const) {
        block(main, glassDark, x + dx, z + dz, w, d, y, 14);
      }
      const antennas = new Part(2);
      antennas.box = { x: x + 26, z: z - 26, w: 14, d: 14, h: 40 };
      lattice(antennas, kit.latticeTower(40, 2.4, 0.8, 0xc9ccd0).translate(x + 28, y, z - 28));
      antennas.add(kit.whitePanel, new THREE.SphereGeometry(4, 20, 14).translate(x - 28, y + 6, z + 28));
      antennas.b(kit.concrete).cylinder(x - 28, z + 28, 2, y, y + 3, TILE, TILE, 12);
      const block2 = new Part(3);
      block2.box = { x: x, z: z, w: 20, d: 20, h: 40 };
      block(block2, glassDark, x, z, 18, 18, y, 38);
      return [ground, main, antennas, block2];
    },
  };

  // ---- Assemble -----------------------------------------------------------
  type Rising = { obj: THREE.Group; scaffold: THREE.Mesh; at: number; shown: number; box: Part['box'] };
  const sitesState = new Map<string, { rising: Rising[]; target: number; shown: number; dressing: THREE.Group }>();
  for (const site of sites) {
    const build = builders[site.id];
    if (!build) continue;
    const y = site.inTown ? 0.16 : 0;
    const parts = build(site, y);
    const target = site.building ?? site.level;
    const visible = parts.filter((p) => p.level <= target);
    const done = visible.filter((p) => p.level <= site.level);
    const rising = visible.filter((p) => p.level > site.level);
    for (const p of done) group.add(p.build());
    names.push({ x: site.x, z: site.z, w: site.w, d: site.d, name: `work_${site.id}` });
    solids.push(...visible.filter((p) => p.box.h > 3).map((p) => ({ x: p.box.x, z: p.box.z, r: Math.max(p.box.w, p.box.d) / 2, h: y + p.box.h + 2 })));
    if (site.building === null) continue;

    // A building site: fence, gravel under the new parts, tower cranes.
    const dressing = new THREE.Group();
    const site3 = new Part(0);
    for (const p of rising.filter((k) => k.box.h >= 3)) {
      site3.b(kit.gravel).flat(p.box.x, p.box.z, p.box.w + 8, p.box.d + 8, y + 0.09, TILE);
      site3.b(fenceMat).walls(p.box.x, p.box.z, p.box.w + 12, p.box.d + 12, y, y + 2.2, 4, 4);
    }
    dressing.add(site3.build());
    rising.slice(0, 3).forEach((p, k) => {
      if (p.box.h < 6) return;
      const crane = new THREE.Group();
      crane.add(new THREE.Mesh(kit.craneGeo, kit.craneMat));
      const jib = new THREE.Mesh(kit.jibGeo, kit.craneMat);
      jib.position.y = 46;
      crane.add(jib);
      crane.scale.setScalar(Math.max(1, (p.box.h + 14) / 46));
      crane.position.set(p.box.x + p.box.w / 2 + 4, y, p.box.z - p.box.d / 2 - 4);
      crane.traverse((o) => {
        o.castShadow = true;
      });
      dressing.add(crane);
      animated.push({ kind: 'spin', obj: jib, speed: 0.12 + k * 0.05 });
    });
    group.add(dressing);
    const state = { rising: [] as Rising[], target: 0, shown: 0, dressing };
    rising.forEach((p, k) => {
      const obj = p.build();
      obj.scale.y = 0.001;
      obj.visible = false;
      group.add(obj);
      // Built 1 m tall and stretched with the part, tiles 4 m once stretched.
      const sb = new Batch();
      sb.walls(p.box.x, p.box.z, p.box.w + 2, p.box.d + 2, 0, 1, 4, 4 / (p.box.h + 2));
      const scaffold = new THREE.Mesh(sb.build(), scaffoldMat);
      scaffold.position.y = y;
      scaffold.scale.y = 0.001;
      scaffold.visible = false;
      group.add(scaffold);
      // Parts go up one after the other across the build.
      state.rising.push({ obj, scaffold, at: k / rising.length, shown: 0, box: p.box });
    });
    sitesState.set(site.id, state);
  }

  const setProgress = (progress: Record<string, number>) => {
    for (const [id, st] of sitesState) st.target = Math.max(0, Math.min(1, progress[id] ?? st.target));
  };

  const update = (dt: number, time: number) => {
    for (const st of sitesState.values()) {
      // The site catches up with the game quickly: weeks of work in seconds.
      st.shown += (st.target - st.shown) * Math.min(1, dt * 1.6);
      const n = st.rising.length;
      for (const r of st.rising) {
        // Each part's own share of the build, 0..1.
        const local = Math.max(0, Math.min(1, (st.shown - r.at) * n));
        r.shown = local;
        const growing = local > 0 && local < 1;
        r.obj.visible = local > 0;
        r.obj.scale.y = Math.max(0.001, local);
        r.scaffold.visible = growing && r.box.h >= 3;
        r.scaffold.scale.y = Math.max(0.001, (r.box.h + 2) * Math.min(1, local * 1.15));
      }
    }
    for (const a of animated) {
      if (a.kind === 'spin') a.obj.rotation.y = time * a.speed + a.obj.id;
      else if (a.kind === 'pulse') {
        const m = a.obj.material as THREE.MeshBasicNodeMaterial;
        m.opacity = 0.45 + 0.35 * Math.sin(time * 2.4 + a.obj.id);
      } else if (a.kind === 'steam') {
        const t = (time * 0.08 + a.k / 5) % 1;
        a.obj.position.set(a.base.x + t * 26, a.base.y + t * 55, a.base.z + t * 6);
        a.obj.scale.setScalar(0.6 + t * 1.6);
        (a.obj.material as THREE.MeshStandardNodeMaterial).opacity = 0.55 * (1 - t);
      } else if (a.kind === 'plane') {
        // 40 s cycle: roll from one end, lift off past the middle, climb away.
        const t = (time / 40) % 1;
        const s = t * a.len * 1.8 - a.len / 2;
        const lift = Math.max(0, s - a.len * 0.1);
        a.obj.position.set(a.x + s, Math.min(400, (lift * lift) / 900), a.z);
        a.obj.rotation.set(0, a.yaw, lift > 0 ? Math.min(0.22, lift / 600) : 0);
        a.obj.visible = t < 0.95;
      }
    }
  };
  update(0, 0);

  const nameAt = (x: number, z: number): string | null => {
    for (const n of names) if (Math.abs(x - n.x) <= n.w / 2 && Math.abs(z - n.z) <= n.d / 2) return n.name;
    return null;
  };
  const focus = (id: string) => {
    const s = sites.find((k) => k.id === id);
    return s ? { x: s.x, z: s.z, r: Math.max(s.w, s.d) } : null;
  };
  return { group, update, setProgress, nameAt, focus, solids, trees: treeSpots };
}

/** Scaffolding: tubes, planks and green netting, see-through between. */
function scaffoldTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(70,110,80,0.38)';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#b8bcc2';
  g.lineWidth = 5;
  for (const v of [2, 64, 126]) {
    g.beginPath();
    g.moveTo(v, 0);
    g.lineTo(v, 128);
    g.stroke();
    g.beginPath();
    g.moveTo(0, v);
    g.lineTo(128, v);
    g.stroke();
  }
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 128);
  g.lineTo(128, 0);
  g.stroke();
  g.fillStyle = '#8a6a44';
  g.fillRect(0, 58, 128, 7);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  return t;
}

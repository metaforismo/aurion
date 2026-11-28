// Geometry helpers for the close-up views: a batch that collects quads with
// texture coordinates in metres (so one tiling material fits every size),
// and small procedural props shared by the city and the colonies.
import * as THREE from 'three/webgpu';

/** Collects quads and triangles for one material, then makes one geometry. */
export class Batch {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly uv: number[] = [];

  /**
   * A quad from four corners given counter-clockwise as seen from the front,
   * with their texture coordinates.
   */
  quad(
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    ua: [number, number],
    ub: [number, number],
    uc: [number, number],
    ud: [number, number],
  ): void {
    this.tri(a, b, c, ua, ub, uc);
    this.tri(a, c, d, ua, uc, ud);
  }

  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ua: [number, number], ub: [number, number], uc: [number, number]): void {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    for (const [p, t] of [
      [a, ua],
      [b, ub],
      [c, uc],
    ] as const) {
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(n.x, n.y, n.z);
      this.uv.push(t[0], t[1]);
    }
  }

  /**
   * The four walls of an axis-aligned box from y0 to y1, centred on (x, z),
   * textured in tiles of tileW × tileH metres. `vFrom` is the height the
   * texture's first row sits at, so storeys line up up the building.
   */
  walls(x: number, z: number, w: number, d: number, y0: number, y1: number, tileW: number, tileH: number, vFrom = y0): void {
    const hw = w / 2;
    const hd = d / 2;
    const corners: [number, number][] = [
      [x - hw, z + hd],
      [x + hw, z + hd],
      [x + hw, z - hd],
      [x - hw, z - hd],
    ];
    const v0 = (y0 - vFrom) / tileH;
    const v1 = (y1 - vFrom) / tileH;
    for (let k = 0; k < 4; k += 1) {
      const [ax, az] = corners[k]!;
      const [bx, bz] = corners[(k + 1) % 4]!;
      const len = Math.hypot(bx - ax, bz - az) / tileW;
      this.quad(
        new THREE.Vector3(ax, y0, az),
        new THREE.Vector3(bx, y0, bz),
        new THREE.Vector3(bx, y1, bz),
        new THREE.Vector3(ax, y1, az),
        [0, v0],
        [len, v0],
        [len, v1],
        [0, v1],
      );
    }
  }

  /** A horizontal rectangle at height y, facing up, textured in tiles of `tile` metres (world-aligned). */
  flat(x: number, z: number, w: number, d: number, y: number, tile: number): void {
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const z0 = z - d / 2;
    const z1 = z + d / 2;
    const u = (v: number) => v / tile;
    this.quad(
      new THREE.Vector3(x0, y, z1),
      new THREE.Vector3(x1, y, z1),
      new THREE.Vector3(x1, y, z0),
      new THREE.Vector3(x0, y, z0),
      [u(x0), u(-z1)],
      [u(x1), u(-z1)],
      [u(x1), u(-z0)],
      [u(x0), u(-z0)],
    );
  }

  /** A closed box (walls and top), textured in metres. */
  box(x: number, z: number, w: number, d: number, y0: number, y1: number, tile: number): void {
    this.walls(x, z, w, d, y0, y1, tile, tile);
    this.flat(x, z, w, d, y1, tile);
  }

  /** Vertical cylinder walls with texture wrapped by arc length. */
  cylinder(x: number, z: number, r: number, y0: number, y1: number, tileW: number, tileH: number, seg = 24, vFrom = y0): void {
    const v0 = (y0 - vFrom) / tileH;
    const v1 = (y1 - vFrom) / tileH;
    const arc = (2 * Math.PI * r) / seg / tileW;
    for (let k = 0; k < seg; k += 1) {
      const a0 = (k / seg) * Math.PI * 2;
      const a1 = ((k + 1) / seg) * Math.PI * 2;
      const p0 = [x + Math.cos(a0) * r, z - Math.sin(a0) * r] as const;
      const p1 = [x + Math.cos(a1) * r, z - Math.sin(a1) * r] as const;
      this.quad(
        new THREE.Vector3(p0[0], y0, p0[1]),
        new THREE.Vector3(p1[0], y0, p1[1]),
        new THREE.Vector3(p1[0], y1, p1[1]),
        new THREE.Vector3(p0[0], y1, p0[1]),
        [k * arc, v0],
        [(k + 1) * arc, v0],
        [(k + 1) * arc, v1],
        [k * arc, v1],
      );
    }
  }

  /** A flat disc (cylinder cap) at height y. */
  disc(x: number, z: number, r: number, y: number, tile: number, seg = 24): void {
    const c = new THREE.Vector3(x, y, z);
    for (let k = 0; k < seg; k += 1) {
      const a0 = (k / seg) * Math.PI * 2;
      const a1 = ((k + 1) / seg) * Math.PI * 2;
      const p0 = new THREE.Vector3(x + Math.cos(a0) * r, y, z - Math.sin(a0) * r);
      const p1 = new THREE.Vector3(x + Math.cos(a1) * r, y, z - Math.sin(a1) * r);
      this.tri(c, p0, p1, [x / tile, -z / tile], [p0.x / tile, -p0.z / tile], [p1.x / tile, -p1.z / tile]);
    }
  }

  /** Append another geometry (already positioned), keeping its UVs. */
  add(geo: THREE.BufferGeometry): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const t = g.getAttribute('uv');
    for (let i = 0; i < p.count; i += 1) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.nor.push(n.getX(i), n.getY(i), n.getZ(i));
      this.uv.push(t ? t.getX(i) : 0, t ? t.getY(i) : 0);
    }
  }

  get empty(): boolean {
    return this.pos.length === 0;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

/** Give a geometry a single vertex colour. */
export function tint(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

export function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Displace a sphere's vertices by noise: a lump of foliage or a rock. */
export function lumpy(geo: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const p = g.getAttribute('position');
  // Same position, same push: keeps the surface closed.
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + (hash(Math.round(x * 50) + seed, Math.round(y * 50) * 3 + Math.round(z * 50) * 7) - 0.5) * amount;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

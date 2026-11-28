// Trees for the close-up views. A crown is a cloud of leaf cards — small
// quads carrying a cut-out picture of a leafy twig — around a dark core,
// with normals bent outwards from the centre so the whole crown shades like
// a volume and its outline stays ragged, as real foliage does. Conifers are
// tiers of drooping branch cards. The pictures are painted once on a canvas.
//
// DOM/WebGL only.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash, lumpy, tint } from './geometry';

export type TreeKind = 'broad' | 'small' | 'conifer' | 'poplar';

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A round spray of overlapping leaves, transparent around it. */
function paintLeaves(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const r = rng(7);
  const half = size / 2;
  // Twigs first, under the leaves.
  g.strokeStyle = '#4a3a2a';
  g.lineCap = 'round';
  for (let k = 0; k < 7; k += 1) {
    const a = (k / 7) * Math.PI * 2 + r();
    g.lineWidth = size * 0.008;
    g.beginPath();
    g.moveTo(half, half);
    g.quadraticCurveTo(half + Math.cos(a + 0.3) * half * 0.4, half + Math.sin(a + 0.3) * half * 0.4, half + Math.cos(a) * half * 0.8, half + Math.sin(a) * half * 0.8);
    g.stroke();
  }
  const leaves = Math.round(size * 2.6);
  for (let i = 0; i < leaves; i += 1) {
    // Denser towards the middle, with a ragged rim.
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * half * (0.78 + 0.16 * Math.sin(a * 5 + 1.3));
    const x = half + Math.cos(a) * d;
    const y = half + Math.sin(a) * d;
    const len = size * (0.028 + r() * 0.02);
    const rim = d / half;
    // Leaves on the rim catch the light; the ones inside sit in shade.
    const light = 15 + rim * 15 + r() * 10;
    const hue = 88 + r() * 30;
    g.save();
    g.translate(x, y);
    g.rotate(a + (r() - 0.5) * 1.6);
    g.fillStyle = `hsl(${hue}, ${34 + r() * 20}%, ${light}%)`;
    g.beginPath();
    g.ellipse(0, 0, len, len * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    // The lit half of the leaf and its midrib.
    g.fillStyle = `hsla(${hue + 6}, 45%, ${light + 9}%, 0.5)`;
    g.beginPath();
    g.ellipse(0, -len * 0.12, len * 0.9, len * 0.22, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.restore();
  }
  return c;
}

/** A conifer branch lying along the card, from the trunk (left) to the tip. */
function paintNeedles(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const r = rng(19);
  const mid = h / 2;
  g.lineCap = 'round';
  // Side shoots off the main branch, each bristling with needles.
  const shoots: [number, number, number, number][] = [[0, mid, w * 0.98, mid]];
  for (let x = w * 0.08; x < w * 0.9; x += w * 0.07) {
    for (const s of [-1, 1]) {
      const len = (w - x) * (0.35 + r() * 0.2);
      shoots.push([x, mid, x + len * 0.8, mid + s * Math.min(mid * 0.9, len * 0.55)]);
    }
  }
  for (const [x0, y0, x1, y1] of shoots) {
    g.strokeStyle = '#3b2f24';
    g.lineWidth = Math.max(1, h * 0.012);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / (h * 0.012));
    for (let i = 0; i < n; i += 1) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const len = h * (0.05 + r() * 0.035) * (1 - t * 0.35);
      for (const s of [-1, 1]) {
        const a = ang + s * (0.75 + r() * 0.35);
        g.strokeStyle = `hsl(${128 + r() * 26}, ${30 + r() * 18}%, ${14 + r() * 16 + t * 6}%)`;
        g.lineWidth = Math.max(1, h * 0.009);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
    }
  }
  return c;
}

function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export type TreeMaterials = { leaves: THREE.MeshStandardNodeMaterial; needles: THREE.MeshStandardNodeMaterial; bark: THREE.MeshStandardNodeMaterial };

let shared: TreeMaterials | null = null;

/** Foliage and bark materials, painted once and shared by every view. */
export function treeMaterials(software: boolean): TreeMaterials {
  if (shared) return shared;
  const leafCard = (map: THREE.Texture) =>
    new THREE.MeshStandardNodeMaterial({
      map,
      vertexColors: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.82,
      metalness: 0,
    });
  shared = {
    leaves: leafCard(canvasTexture(paintLeaves(software ? 256 : 512))),
    needles: leafCard(canvasTexture(paintNeedles(software ? 256 : 512, software ? 128 : 256))),
    bark: new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.95 }),
  };
  return shared;
}

/** Forget the shared materials (when a view is torn down with them). */
export function releaseTreeMaterials(): void {
  shared = null;
}

/**
 * A card: a quad centred on `c`, facing `n`, `w` by `h` metres, with its
 * normals bent away from the crown centre `o` so the crown shades as a whole.
 */
function card(
  out: { pos: number[]; nor: number[]; uv: number[]; col: number[]; idx: number[] },
  c: THREE.Vector3,
  n: THREE.Vector3,
  up: THREE.Vector3,
  w: number,
  h: number,
  o: THREE.Vector3,
  shade: number,
  bend: number,
): void {
  const right = new THREE.Vector3().crossVectors(up, n).normalize();
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  const top = new THREE.Vector3().crossVectors(n, right).normalize();
  const base = out.pos.length / 3;
  const corners: [number, number, number, number][] = [
    [-0.5, -0.5, 0, 0],
    [0.5, -0.5, 1, 0],
    [0.5, 0.5, 1, 1],
    [-0.5, 0.5, 0, 1],
  ];
  const p = new THREE.Vector3();
  const nn = new THREE.Vector3();
  for (const [a, b, u, v] of corners) {
    p.copy(c).addScaledVector(right, a * w).addScaledVector(top, b * h);
    nn.copy(p).sub(o).normalize().multiplyScalar(bend).addScaledVector(n, 1 - bend).normalize();
    out.pos.push(p.x, p.y, p.z);
    out.nor.push(nn.x, nn.y, nn.z);
    out.uv.push(u, v);
    out.col.push(shade, shade, shade);
  }
  out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function toGeometry(out: { pos: number[]; nor: number[]; uv: number[]; col: number[]; idx: number[] }): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
  g.setIndex(out.idx);
  return g;
}

/** A trunk with a few limbs reaching into the crown. */
function trunkOf(height: number, radius: number, limbs: number, seed: number, spread: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const bark = 0x5a4a3c;
  parts.push(tint(lumpy(new THREE.CylinderGeometry(radius * 0.55, radius, height, 8, 3), 0.06, seed).translate(0, height / 2, 0), bark));
  // Root flare.
  parts.push(tint(new THREE.CylinderGeometry(radius, radius * 1.7, 0.5, 8).translate(0, 0.25, 0), bark));
  for (let k = 0; k < limbs; k += 1) {
    const a = (k / limbs) * Math.PI * 2 + hash(seed, k) * 1.2;
    const len = spread * (0.8 + hash(k, seed) * 0.5);
    const limb = new THREE.CylinderGeometry(radius * 0.18, radius * 0.4, len, 5).translate(0, len / 2, 0);
    limb.rotateZ(-(0.55 + hash(seed + k, 3) * 0.4));
    limb.rotateY(a);
    limb.translate(0, height * (0.75 + hash(seed, k + 9) * 0.2), 0);
    parts.push(tint(limb, bark));
  }
  return mergeGeometries(parts, false)!;
}

export type TreeGeometry = { trunk: THREE.BufferGeometry; crown: THREE.BufferGeometry; core: THREE.BufferGeometry | null; foliage: 'leaves' | 'needles' };

/** One tree model of a kind; `seed` picks among a few variants. */
export function treeGeometry(kind: TreeKind, seed = 1): TreeGeometry {
  const r = rng(seed * 977 + kind.length * 131);
  const out = { pos: [] as number[], nor: [] as number[], uv: [] as number[], col: [] as number[], idx: [] as number[] };
  const up = new THREE.Vector3(0, 1, 0);
  if (kind === 'conifer') {
    const height = 13 + r() * 4;
    const trunk = tint(new THREE.CylinderGeometry(0.12, 0.42, height, 7).translate(0, height / 2, 0), 0x4e3d30);
    const o = new THREE.Vector3(0, height * 0.5, 0);
    const tiers = 9;
    for (let t = 0; t < tiers; t += 1) {
      const y = 1.6 + (t / tiers) * (height - 2.2);
      const reach = (1 - t / tiers) * 3.4 + 0.5;
      const arms = Math.max(4, Math.round(7 - t * 0.4));
      for (let k = 0; k < arms; k += 1) {
        const a = (k / arms) * Math.PI * 2 + t * 0.7 + r() * 0.4;
        const dir = new THREE.Vector3(Math.cos(a), -0.32 - r() * 0.15, Math.sin(a)).normalize();
        const centre = new THREE.Vector3(0, y, 0).addScaledVector(dir, reach / 2);
        // The card lies along the branch, tilted to droop.
        const side = new THREE.Vector3().crossVectors(dir, up).normalize();
        const n = new THREE.Vector3().crossVectors(side, dir).normalize();
        const shade = 0.55 + (t / tiers) * 0.35 + r() * 0.1;
        cardAlong(out, centre, dir, n, reach, reach * 0.62, o, shade);
      }
    }
    // The leader at the top.
    for (let k = 0; k < 2; k += 1) {
      const n = new THREE.Vector3(Math.cos(k * 1.57), 0, Math.sin(k * 1.57));
      card(out, new THREE.Vector3(0, height - 0.6, 0), n, up, 1.4, 2.4, o, 0.95, 0.3);
    }
    const core = tint(lumpy(new THREE.ConeGeometry(1.3, height - 4, 8, 3), 0.12, seed).translate(0, (height - 4) / 2 + 2.4, 0), 0x16281a);
    return { trunk, crown: toGeometry(out), core, foliage: 'needles' };
  }

  const small = kind === 'small';
  const poplar = kind === 'poplar';
  const scale = small ? 0.62 : 1;
  const trunkH = (poplar ? 3.2 : 3.6 + r() * 1.2) * scale;
  const rx = (poplar ? 1.5 : 3 + r() * 0.6) * scale;
  const ry = (poplar ? 5.5 : 2.6 + r() * 0.5) * scale;
  const cy = trunkH + ry * 0.85;
  const o = new THREE.Vector3(0, cy, 0);
  const cards = small ? 48 : poplar ? 60 : 84;
  for (let k = 0; k < cards; k += 1) {
    // Points spread over the crown volume, more of them near the surface.
    const a = r() * Math.PI * 2;
    const e = Math.acos(1 - 2 * r());
    const d = 0.55 + Math.sqrt(r()) * 0.45;
    const local = new THREE.Vector3(Math.sin(e) * Math.cos(a) * rx * d, Math.cos(e) * ry * d * 0.9, Math.sin(e) * Math.sin(a) * rx * d);
    const centre = local.clone().add(o);
    const n = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().lerp(local.clone().normalize(), 0.45).normalize();
    const size = (1.5 + r() * 0.9) * scale * (poplar ? 0.85 : 1);
    // Lower and inner leaves sit in the crown's own shade.
    const shade = 0.42 + 0.34 * ((local.y / ry + 1) / 2) + 0.2 * d + (r() - 0.5) * 0.12;
    card(out, centre, n, up, size, size, o, Math.min(1.05, shade), 0.6);
  }
  const trunk = trunkOf(trunkH + ry * 0.6, 0.3 * scale + (poplar ? 0 : 0.05), poplar ? 2 : 4, seed, rx * 0.8);
  const core = tint(
    lumpy(new THREE.IcosahedronGeometry(1, 1), 0.25, seed)
      .scale(rx * 0.5, ry * 0.5, rx * 0.5)
      .translate(0, cy, 0),
    0x1c2e16,
  );
  return { trunk, crown: toGeometry(out), core, foliage: 'leaves' };
}

/** A card whose long side runs along `dir` (a branch), starting at its base. */
function cardAlong(
  out: { pos: number[]; nor: number[]; uv: number[]; col: number[]; idx: number[] },
  c: THREE.Vector3,
  dir: THREE.Vector3,
  n: THREE.Vector3,
  len: number,
  wide: number,
  o: THREE.Vector3,
  shade: number,
): void {
  const side = new THREE.Vector3().crossVectors(n, dir).normalize();
  const base = out.pos.length / 3;
  const p = new THREE.Vector3();
  const nn = new THREE.Vector3();
  const corners: [number, number, number, number][] = [
    [-0.5, -0.5, 0, 0],
    [0.5, -0.5, 1, 0],
    [0.5, 0.5, 1, 1],
    [-0.5, 0.5, 0, 1],
  ];
  for (const [a, b, u, v] of corners) {
    p.copy(c).addScaledVector(dir, a * len).addScaledVector(side, b * wide);
    nn.copy(p).sub(o).normalize().multiplyScalar(0.55).addScaledVector(n, 0.45).normalize();
    out.pos.push(p.x, p.y, p.z);
    out.nor.push(nn.x, nn.y, nn.z);
    out.uv.push(u, v);
    out.col.push(shade, shade, shade);
  }
  out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

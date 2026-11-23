// Close-up of a colony: the ground it stands on, its buildings, the people
// walking between them and the rovers on its roads. Built for a steady frame
// rate on modest hardware — every repeated thing is one instanced draw call,
// there are no shadow maps (soft blob shadows instead), and the figures are
// moved on the CPU, a few hundred matrices a frame.
//
// DOM/WebGL only: import dynamically from a client component.
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { isSoftwareRenderer } from '../globe/planet-renderer';

import type { BaseModel, Building, BuildingKind } from './model';

export type BaseRendererOptions = {
  canvas: HTMLCanvasElement;
  model: BaseModel;
  forceWebGL?: boolean;
  reducedMotion?: boolean;
};

const PALETTE = {
  moon: { ground: 0x8d8f94, groundDark: 0x5f6166, sky: 0x000004, fog: null as number | null, ambient: 0.16, road: 0x6f7278 },
  mars: { ground: 0xb5653d, groundDark: 0x7e4226, sky: 0xd8a47c, fog: 0xd8a47c as number | null, ambient: 0.5, road: 0x8d5236 },
  earth: { ground: 0x6f9a55, groundDark: 0x466f3c, sky: 0x9ccdf2, fog: 0xb9dcf5 as number | null, ambient: 0.6, road: 0x55595f },
} as const;

const SUN = new THREE.Vector3(-0.62, 0.5, 0.42).normalize();
const TERRAIN_SIZE = 1200;
/** Radius kept flat for the base; the land rises around it. */
const FLAT_RADIUS = 235;

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, z: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i += 1) {
    sum += valueNoise(x * freq, z * freq) * amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum;
}

/** Height of the land at a point, flat where the base stands. */
function heightAt(x: number, z: number, craters: readonly { x: number; z: number; r: number }[]): number {
  const r = Math.hypot(x, z);
  const rise = THREE.MathUtils.smoothstep(r, FLAT_RADIUS, FLAT_RADIUS + 140);
  let h = (fbm(x * 0.006 + 11, z * 0.006 + 5) - 0.45) * 46 + (fbm(x * 0.03, z * 0.03) - 0.5) * 5;
  for (const c of craters) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d < 1.35) {
      // A bowl with a raised rim.
      h += d < 1 ? -(1 - d * d) * c.r * 0.22 : (1.35 - d) * c.r * 0.12;
    }
  }
  // A whisper of relief stays under the base so it does not look machined.
  return h * rise + (fbm(x * 0.08, z * 0.08) - 0.5) * 0.35 * (1 - rise);
}

/**
 * Fine grain for the ground up close: speckles and pebbles on near-white, so
 * it multiplies the vertex colours without darkening them much. Tiled.
 */
function makeGrainTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e4e4e4';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i += 1) {
    const x = hash(i, 51) * size;
    const y = hash(i, 52) * size;
    const tone = hash(i, 53);
    const r = tone > 0.97 ? 2.4 : tone > 0.8 ? 1.2 : 0.7;
    g.fillStyle = tone > 0.5 ? `rgba(255,255,255,${0.25 + tone * 0.3})` : `rgba(70,70,70,${0.18 + tone * 0.4})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(140, 140);
  tex.anisotropy = 4;
  return tex;
}

// ---------------------------------------------------------------------------
// Building parts
// ---------------------------------------------------------------------------

type Part = THREE.BufferGeometry;

function paint(geo: THREE.BufferGeometry, color: number): Part {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const c = new THREE.Color(color);
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number) => g.translate(x, y, z);
const box = (w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) =>
  at(paint(new THREE.BoxGeometry(w, h, d), color), x, y + h / 2, z);
const cyl = (rTop: number, rBottom: number, h: number, color: number, x = 0, y = 0, z = 0, seg = 14) =>
  at(paint(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color), x, y + h / 2, z);
const dome = (r: number, color: number, x = 0, y = 0, z = 0, seg = 16) =>
  at(paint(new THREE.SphereGeometry(r, seg, 8, 0, Math.PI * 2, 0, Math.PI / 2), color), x, y, z);
/** A pressurised module lying on its side. */
const tube = (r: number, len: number, color: number, x = 0, y = 0, z = 0) =>
  at(paint(new THREE.CapsuleGeometry(r, len, 4, 10).rotateZ(Math.PI / 2), color), x, y + r * 0.9, z);

const WHITE = 0xe9ecef;
const GREY = 0x9aa0a8;
const DARK = 0x3d4148;
const ORANGE = 0xe08a3c;
const BLUE = 0x1f3f78;
const GLASS = 0xa9d4e6;
const GREEN = 0x5fa870;
const STEEL = 0x6c7783;

/** Geometry of each kind of building, its footprint radius and where its lights sit. */
function blueprint(kind: BuildingKind): { parts: Part[]; radius: number; height: number; lights: [number, number, number][] } {
  switch (kind) {
    case 'hub':
      return {
        parts: [
          cyl(11, 12, 3, GREY),
          dome(10, WHITE, 0, 3),
          cyl(2.2, 2.2, 6, STEEL, 0, 11),
          box(5, 3.2, 9, WHITE, 0, 0, 13),
          box(9, 3.2, 5, WHITE, 13, 0, 0),
        ],
        radius: 16,
        height: 16,
        lights: [[0, 4.2, 10.2], [10.2, 4.2, 0], [-10.2, 4.2, 0], [0, 17.4, 0], [0, 2, 17.6], [17.6, 2, 0]],
      };
    case 'pad':
      return {
        parts: [
          cyl(13, 13, 0.35, DARK, 0, 0, 0, 28),
          cyl(9, 9, 0.4, 0x565b63, 0, 0, 0, 28),
          cyl(1.9, 2.4, 7, WHITE, 0, 1.6),
          at(paint(new THREE.ConeGeometry(1.9, 3.6, 14), ORANGE), 0, 10.4, 0),
          box(0.35, 2.2, 0.35, STEEL, 2.4, 0, 2.4),
          box(0.35, 2.2, 0.35, STEEL, -2.4, 0, 2.4),
          box(0.35, 2.2, 0.35, STEEL, 2.4, 0, -2.4),
          box(0.35, 2.2, 0.35, STEEL, -2.4, 0, -2.4),
        ],
        radius: 14,
        height: 12,
        lights: [[12, 0.6, 0], [-12, 0.6, 0], [0, 0.6, 12], [0, 0.6, -12]],
      };
    case 'tower':
      return {
        parts: [
          cyl(0.35, 0.7, 24, STEEL),
          at(paint(new THREE.ConeGeometry(2.6, 1.4, 16, 1, true).rotateX(Math.PI * 0.62), WHITE), 0, 19, 1.2),
          box(2.4, 2, 2.4, GREY),
        ],
        radius: 3,
        height: 24,
        lights: [[0, 24.4, 0]],
      };
    case 'housing':
      return {
        parts: [tube(2, 7, WHITE), box(2, 2.2, 2.4, GREY, 5.4, 0, 0), box(0.5, 0.5, 4.6, STEEL, -1, 3.4, 0)],
        radius: 6,
        height: 4,
        lights: [[6.5, 1.3, 0], [0, 1.9, 2.05], [-2.5, 1.9, 2.05]],
      };
    case 'dome':
      return {
        parts: [cyl(13.5, 14, 1.6, GREY, 0, 0, 0, 24), dome(13, GLASS, 0, 1.6, 0, 20), cyl(2.6, 2.6, 8, WHITE, 0, 1.6), box(4, 3, 5, WHITE, 0, 0, 15)],
        radius: 15,
        height: 15,
        lights: [[0, 10, 0], [5, 3, 5], [-5, 3, 5], [5, 3, -5], [-5, 3, -5], [0, 2, 17.7]],
      };
    case 'habitat':
      return {
        parts: [cyl(6, 6.4, 9, WHITE, 0, 0, 0, 18), dome(6, GREY, 0, 9, 0, 18), cyl(6.3, 6.3, 0.5, ORANGE, 0, 4.4, 0, 18), box(3, 2.6, 4, GREY, 0, 0, 7.6)],
        radius: 9,
        height: 15,
        lights: [[6.1, 2.6, 0], [-6.1, 2.6, 0], [0, 6.6, 6.1], [0, 6.6, -6.1], [6.1, 6.6, 0]],
      };
    case 'lab':
      return {
        parts: [
          cyl(7, 7, 2.4, GREY, 0, 0, 0, 16),
          dome(6.4, WHITE, 0, 2.4),
          cyl(0.25, 0.25, 7, STEEL, 4, 2.4),
          at(paint(new THREE.ConeGeometry(2.2, 1.1, 14, 1, true).rotateX(Math.PI * 0.72), GLASS), 4, 9.6, 0.8),
          tube(1.5, 5, GLASS, -8.5, 0, 0),
        ],
        radius: 10,
        height: 10,
        lights: [[0, 3.4, 6.6], [6.6, 3.4, 0], [-11.5, 1.4, 0], [4, 9.9, 0]],
      };
    case 'mine':
      return {
        parts: [
          at(paint(new THREE.TorusGeometry(8, 1.6, 6, 18).rotateX(Math.PI / 2), 0x4c4a48), 0, 0.6, 0),
          cyl(6.6, 5, 0.3, 0x2b2a29, 0, -0.1, 0, 18),
          box(3, 3.4, 4, ORANGE, 9.5, 0, 0),
          at(paint(new THREE.BoxGeometry(11, 0.7, 1.4).rotateZ(0.32), STEEL), 4.6, 3, 0),
          box(4, 5, 4, GREY, -11, 0, 2),
          at(paint(new THREE.ConeGeometry(3.4, 4, 10), 0x7a7672), -4, 2, -11),
        ],
        radius: 13,
        height: 6,
        lights: [[9.5, 3.8, 2.2], [-11, 5.4, 4.2], [0, 1.6, 8]],
      };
    case 'foundry':
      return {
        parts: [
          box(13, 7, 9, STEEL),
          box(13.6, 0.8, 9.6, DARK, 0, 7, 0),
          cyl(1.3, 1.6, 15, GREY, -4, 0, -2.4),
          cyl(1.3, 1.6, 12, GREY, 3.6, 0, -2.4),
          box(5, 3.6, 5, ORANGE, 9.4, 0, 1),
        ],
        radius: 12,
        height: 15,
        lights: [[-4, 15.3, -2.4], [3.6, 12.3, -2.4], [0, 3, 4.7], [-5, 3, 4.7], [5, 3, 4.7]],
      };
    case 'solar': {
      const parts: Part[] = [];
      for (let i = -2; i <= 2; i += 1) {
        parts.push(at(paint(new THREE.BoxGeometry(3.6, 0.14, 6.4).rotateX(-0.5), BLUE), i * 4.2, 2.3, 0));
        parts.push(box(0.25, 2.2, 0.25, STEEL, i * 4.2, 0, 0));
      }
      return { parts, radius: 11, height: 4, lights: [] };
    }
    case 'greenhouse':
      return {
        parts: [tube(3.2, 14, GREEN), tube(3.2, 14, GREEN, 0, 0, 7.2), box(3, 3, 3, WHITE, 0, 0, 3.6)],
        radius: 12,
        height: 6,
        lights: [[8.6, 2.6, 0], [-8.6, 2.6, 0], [8.6, 2.6, 7.2], [-8.6, 2.6, 7.2]],
      };
    case 'extractor':
      return {
        parts: [
          box(6, 2, 6, GREY),
          at(paint(new THREE.CylinderGeometry(0.6, 2.6, 15, 4), STEEL), 0, 9.5, 0),
          cyl(2.4, 2.4, 5, WHITE, 6.5, 0, 0),
          cyl(2.4, 2.4, 5, WHITE, -6.5, 0, 0),
          box(13, 0.5, 0.5, STEEL, 0, 3, 0),
        ],
        radius: 10,
        height: 17,
        lights: [[0, 17.3, 0], [6.5, 5.3, 0], [-6.5, 5.3, 0]],
      };
    case 'driver':
      return {
        parts: [
          at(paint(new THREE.BoxGeometry(74, 1.2, 2.6).rotateZ(0.12), STEEL), 8, 5.6, 0),
          box(7, 4, 7, GREY, -27, 0, 0),
          box(1, 5, 1, DARK, -10, 0, 0),
          box(1, 7.4, 1, DARK, 10, 0, 0),
          box(1, 9.8, 1, DARK, 30, 0, 0),
        ],
        radius: 14,
        height: 11,
        lights: [[-27, 4.4, 3.7], [44, 10.3, 0], [-10, 5.3, 0], [10, 7.7, 0], [30, 10.1, 0]],
      };
    case 'plant':
      return {
        parts: [
          box(12, 6, 10, STEEL),
          at(paint(new THREE.CylinderGeometry(3, 4.6, 11, 14), GREY), -8, 5.5, -9),
          at(paint(new THREE.CylinderGeometry(3, 4.6, 11, 14), GREY), 2, 5.5, -9),
          box(4, 3, 14, DARK, 9, 0, 3),
        ],
        radius: 14,
        height: 11,
        lights: [[-8, 11.3, -9], [2, 11.3, -9], [0, 3, 5.2], [-4.5, 3, 5.2], [4.5, 3, 5.2]],
      };
    case 'site':
      // Foundations, a half-raised frame and stacked materials; the crane is
      // a separate mesh so its jib can turn.
      return {
        parts: [
          box(16, 0.5, 16, 0x55595f),
          box(0.6, 7, 0.6, ORANGE, -6, 0.5, -6),
          box(0.6, 7, 0.6, ORANGE, 6, 0.5, -6),
          box(0.6, 7, 0.6, ORANGE, -6, 0.5, 6),
          box(0.6, 4, 0.6, ORANGE, 6, 0.5, 6),
          box(12.6, 0.5, 0.6, ORANGE, 0, 7.5, -6),
          box(0.6, 0.5, 12.6, ORANGE, -6, 7.5, 0),
          box(3, 2, 3, GREY, 3, 0.5, 2),
          box(2.4, 1.2, 4, STEEL, -2, 0.5, 3),
        ],
        radius: 11,
        height: 8,
        lights: [[-6, 7.9, -6], [6, 7.9, -6], [-6, 7.9, 6]],
      };
    case 'capitol':
      // Seat of government: a colonnaded hall under a dome, with two wings.
      return {
        parts: [
          box(26, 1.2, 18, 0xd9d4c7),
          box(20, 7, 12, 0xeeeadf, 0, 1.2, 0),
          cyl(6, 6.4, 4, 0xeeeadf, 0, 8.2, 0, 18),
          dome(6, 0x6fa8a0, 0, 12.2, 0, 18),
          cyl(0.25, 0.25, 4, STEEL, 0, 18.2),
          box(8, 5, 9, 0xe4dfd2, -15, 1.2, 0),
          box(8, 5, 9, 0xe4dfd2, 15, 1.2, 0),
          ...[-8, -4, 0, 4, 8].map((x) => cyl(0.5, 0.5, 6.6, WHITE, x, 1.2, 6.6, 8)),
        ],
        radius: 20,
        height: 20,
        lights: [[0, 22.4, 0], [-15, 4, 4.7], [15, 4, 4.7], [-6, 4, 6.2], [6, 4, 6.2]],
      };
    case 'skyscraper':
      return {
        parts: [
          box(11, 2, 11, 0x8d949c),
          box(8, 30, 8, 0x7fa6c9, 0, 2, 0),
          box(6, 9, 6, 0x9cc0de, 0, 32, 0),
          box(0.3, 6, 0.3, STEEL, 0, 41, 0),
          box(8.3, 0.4, 8.3, DARK, 0, 12, 0),
          box(8.3, 0.4, 8.3, DARK, 0, 22, 0),
        ],
        radius: 8,
        height: 44,
        lights: [[0, 47.3, 0], [4.2, 8, 0], [-4.2, 16, 0], [0, 26, 4.2], [4.2, 30, 0], [0, 6, -4.2]],
      };
    case 'block':
      return {
        parts: [
          box(10, 5, 7, 0xd8c7a8),
          at(paint(new THREE.CylinderGeometry(0.01, 6.6, 3, 4).rotateY(Math.PI / 4).scale(1.1, 1, 0.78), 0xa5523c), 0, 6.5, 0),
          box(3, 3, 3, 0xcdbb9b, 6.4, 0, 1.5),
        ],
        radius: 7,
        height: 8,
        lights: [[2, 2.5, 3.6], [-2, 2.5, 3.6], [7.95, 1.6, 1.5]],
      };
    case 'factory':
      return {
        parts: [
          box(16, 6, 10, 0x8f8a82),
          ...[-5.3, 0, 5.3].map((x) => at(paint(new THREE.BoxGeometry(5.2, 2, 10).rotateZ(0.32), 0x6c6862), x, 7, 0)),
          cyl(1, 1.3, 14, 0xb8b2a8, -6, 0, -7),
          cyl(1, 1.3, 11, 0xb8b2a8, -3, 0, -7),
          box(6, 4, 5, ORANGE, 11, 0, 2),
        ],
        radius: 13,
        height: 14,
        lights: [[-6, 14.3, -7], [-3, 11.3, -7], [0, 3, 5.2], [5, 3, 5.2]],
      };
    case 'barracks':
      return {
        parts: [
          tube(2.6, 12, 0x5d6b4a),
          tube(2.6, 12, 0x5d6b4a, 0, 0, 6.4),
          box(4, 3, 4, 0x4a563b, -11, 0, 3.2),
          box(0.25, 9, 0.25, STEEL, 11, 0, 3.2),
          box(2.4, 1.5, 0.1, 0xb23b3b, 12.3, 7.2, 3.2),
        ],
        radius: 13,
        height: 9,
        lights: [[7.6, 2, 0], [7.6, 2, 6.4], [-11, 3.3, 3.2]],
      };
    case 'datacenter':
      return {
        parts: [
          box(14, 5, 9, 0x2f3a4a),
          box(14.2, 0.5, 9.2, 0x4d7fd6, 0, 2.2, 0),
          ...[-4.5, -1.5, 1.5, 4.5].map((x) => box(2, 1.6, 2, STEEL, x, 5, -2)),
          at(paint(new THREE.ConeGeometry(2, 1, 14, 1, true).rotateX(Math.PI * 0.7), WHITE), 4, 7.6, 3),
          box(0.2, 2.6, 0.2, STEEL, 4, 5, 3),
        ],
        radius: 11,
        height: 8,
        lights: [[-6, 2.4, 4.7], [-2, 2.4, 4.7], [2, 2.4, 4.7], [6, 2.4, 4.7]],
      };
    case 'arcology':
      // A city in one building: stepped terraces with gardens.
      return {
        parts: [
          box(24, 8, 24, 0xd9dee2),
          box(24.4, 0.6, 24.4, GREEN, 0, 8, 0),
          box(17, 9, 17, 0xcfd6dc, 0, 8.6, 0),
          box(17.4, 0.6, 17.4, GREEN, 0, 17.6, 0),
          box(10, 10, 10, 0xc3ccd4, 0, 18.2, 0),
          dome(5, GLASS, 0, 28.2, 0, 14),
        ],
        radius: 18,
        height: 33,
        lights: [[12.2, 4, 6], [12.2, 4, -6], [-12.2, 4, 0], [8.7, 13, 0], [0, 13, 8.7], [5.2, 23, 0], [0, 33.6, 0]],
      };
    case 'reactor':
      // Fusion: the torus hall, its dome, and cooling towers.
      return {
        parts: [
          cyl(13, 13, 5, 0xbfc6cc, 0, 0, 0, 22),
          at(paint(new THREE.TorusGeometry(9, 2.6, 8, 22).rotateX(Math.PI / 2), 0x7fd1e8), 0, 6.4, 0),
          dome(6, WHITE, 0, 5, 0, 16),
          at(paint(new THREE.CylinderGeometry(3.2, 5, 14, 14), 0xdfe3e6), -17, 7, -6),
          at(paint(new THREE.CylinderGeometry(3.2, 5, 14, 14), 0xdfe3e6), -17, 7, 6),
          box(7, 4, 6, STEEL, 15, 0, 0),
        ],
        radius: 18,
        height: 14,
        lights: [[0, 11.4, 0], [-17, 14.3, -6], [-17, 14.3, 6], [18.6, 2, 0], [9, 6.6, 9], [-9, 6.6, 9]],
      };
    case 'pylon': {
      const parts: Part[] = [];
      for (const x of [-9, 9]) {
        parts.push(at(paint(new THREE.CylinderGeometry(0.3, 1.6, 20, 4), STEEL), x, 10, 0));
        parts.push(box(8, 0.4, 0.4, STEEL, x, 16, 0));
        parts.push(box(6, 0.4, 0.4, STEEL, x, 12.5, 0));
      }
      parts.push(box(18, 0.12, 0.12, DARK, 0, 16.3, 3.8));
      parts.push(box(18, 0.12, 0.12, DARK, 0, 16.3, -3.8));
      parts.push(box(4, 2.6, 4, GREY));
      return { parts, radius: 11, height: 20, lights: [[-9, 20.3, 0], [9, 20.3, 0]] };
    }
    case 'gantry':
      // Launch tower with a rocket on the stand.
      return {
        parts: [
          box(10, 1.4, 10, 0x6c7077),
          at(paint(new THREE.CylinderGeometry(1.2, 1.8, 30, 4), 0xb5412f), -4, 16.4, 0),
          box(6, 0.6, 1, 0xb5412f, -1, 22, 0),
          box(6, 0.6, 1, 0xb5412f, -1, 12, 0),
          cyl(1.9, 1.9, 24, WHITE, 2.6, 1.4, 0, 16),
          at(paint(new THREE.ConeGeometry(1.9, 5, 16), ORANGE), 2.6, 27.9, 0),
          cyl(0.8, 0.8, 9, WHITE, 2.6, 1.4, 2.7, 10),
          cyl(0.8, 0.8, 9, WHITE, 2.6, 1.4, -2.7, 10),
        ],
        radius: 9,
        height: 32,
        lights: [[-4, 31.8, 0], [2.6, 30.6, 0], [5.2, 1.8, 5.2], [-5.2, 1.8, 5.2]],
      };
    case 'antenna':
      return {
        parts: [
          cyl(2.2, 3, 5, GREY, 0, 0, 0, 10),
          box(1, 6, 1, STEEL, 0, 5, 0),
          at(paint(new THREE.SphereGeometry(8, 18, 6, 0, Math.PI * 2, 0, Math.PI / 3).rotateX(Math.PI).rotateX(-0.5), WHITE), 0, 18.6, 3.4),
          box(0.25, 6, 0.25, STEEL, 0, 12, 3),
        ],
        radius: 9,
        height: 20,
        lights: [[0, 17.6, 4.6]],
      };
    case 'processor':
      return {
        parts: [
          cyl(7, 8, 3, GREY, 0, 0, 0, 16),
          at(paint(new THREE.CylinderGeometry(2, 6, 22, 14), WHITE), 0, 14, 0),
          cyl(2.6, 2.6, 1.4, ORANGE, 0, 25),
        ],
        radius: 10,
        height: 27,
        lights: [[0, 26.8, 0], [7.2, 1.6, 0], [-7.2, 1.6, 0]],
      };
  }
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

type Walker = { ax: number; az: number; bx: number; bz: number; t: number; speed: number; phase: number };
type Rover = { radius: number; angle: number; speed: number };

export class BaseRenderer {
  /** The GPU device was lost while the renderer was live. */
  onDeviceLost: ((message: string) => void) | null = null;

  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGPURenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.5, 6000);
  private readonly controls: OrbitControls;
  private readonly software: boolean;
  private readonly reducedMotion: boolean;
  private readonly body: BaseModel['body'];
  /** Everything that is rebuilt when the base changes. */
  private base = new THREE.Group();
  private people: THREE.InstancedMesh | null = null;
  private rovers: THREE.InstancedMesh | null = null;
  /** Tower cranes on building sites; their jibs turn. */
  private cranes: THREE.Object3D[] = [];
  /** The shuttle that comes and goes from the pad. */
  private shuttle: THREE.Object3D | null = null;
  private flame: THREE.Mesh | null = null;
  private padAt = new THREE.Vector3(0, 0, -29);
  private clock = 0;
  /** Buildings that can be picked, with what they are. */
  private pickables: { mesh: THREE.Mesh; kind: BuildingKind }[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private walkers: Walker[] = [];
  private drivers: Rover[] = [];
  private readonly dummy = new THREE.Object3D();
  private raf = 0;
  private last = 0;
  private disposed = false;
  private started = false;
  private readonly onVisibility = () => {
    if (document.hidden) cancelAnimationFrame(this.raf);
    else if (this.started && !this.disposed) this.raf = requestAnimationFrame(this.frame);
  };

  constructor(opts: BaseRendererOptions) {
    this.canvas = opts.canvas;
    this.body = opts.model.body;
    this.software = isSoftwareRenderer();
    this.reducedMotion = opts.reducedMotion ?? false;
    this.renderer = new THREE.WebGPURenderer({
      canvas: opts.canvas,
      antialias: !this.software,
      forceWebGL: opts.forceWebGL === true,
    });
    this.renderer.onDeviceLost = (info) => {
      if (!this.disposed) this.onDeviceLost?.(String(info?.message ?? 'device lost'));
    };
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const palette = PALETTE[this.body];
    this.scene.background = new THREE.Color(palette.sky);
    if (palette.fog !== null) this.scene.fog = new THREE.Fog(palette.fog, 420, 1900);

    const sun = new THREE.DirectionalLight(
      this.body === 'mars' ? 0xffe2c4 : this.body === 'earth' ? 0xfff4dd : 0xffffff,
      this.body === 'moon' ? 3 : 2.3,
    );
    sun.position.copy(SUN).multiplyScalar(500);
    this.scene.add(sun);
    // Fill light: on the Moon it is the glare bouncing off the regolith, on
    // Mars the dusty sky. Without it every shaded wall is a black hole.
    this.scene.add(
      this.body === 'mars'
        ? new THREE.HemisphereLight(0xf0c8a8, 0x6b3f2a, 1.5)
        : this.body === 'earth'
          ? new THREE.HemisphereLight(0xcfe6ff, 0x5a7a48, 1.6)
          : new THREE.HemisphereLight(0x9aa6c0, 0x7d7f85, 1.15),
    );

    this.buildTerrain();
    this.buildSky();
    this.scene.add(this.base);
    this.setModel(opts.model);

    this.camera.position.set(215, 150, 270);
    this.controls = new OrbitControls(this.camera, opts.canvas);
    // Aim beside the hub, at street level, so zooming in lands on a road.
    this.controls.target.set(0, 2, 40);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    // Scroll towards what is under the pointer, so you can dive at a building
    // or a road instead of always at the hub.
    this.controls.zoomToCursor = true;
    this.controls.maxDistance = 760;
    // Never under the ground, never quite flat on it.
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.zoomSpeed = 1.1;
    this.controls.rotateSpeed = 0.6;
    this.controls.panSpeed = 0.8;
    this.controls.screenSpacePanning = false;
    this.controls.update();
  }

  async init(): Promise<'webgpu' | 'webgl2'> {
    await this.renderer.init();
    this.resize();
    const backend = (this.renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
    return backend;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  resize(): void {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    const scale = this.software ? 0.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5) * scale);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Move the camera in or out by a factor (toolbar buttons). */
  zoomBy(factor: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.setLength(distance));
  }

  /** Look at a spot on the ground from close by (used to land next to a building). */
  lookAt(x: number, z: number, distance = 28): void {
    const offset = this.camera.position.clone().sub(this.controls.target).setLength(distance);
    this.controls.target.set(x, 1.5, z);
    this.camera.position.copy(this.controls.target).add(offset);
  }

  /** What kind of building is under a point of the canvas (CSS pixels), if any. */
  pickAt(x: number, y: number): BuildingKind | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    let best: { kind: BuildingKind; distance: number } | null = null;
    for (const p of this.pickables) {
      const hit = this.raycaster.intersectObject(p.mesh, false)[0];
      if (hit && (!best || hit.distance < best.distance)) best = { kind: p.kind, distance: hit.distance };
    }
    return best?.kind ?? null;
  }

  /** Back to the overview of the whole base. */
  resetView(): void {
    this.controls.target.set(0, 2, 40);
    this.camera.position.set(215, 150, 270);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.controls.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }

  // ---- Scene -------------------------------------------------------------

  private readonly craters: { x: number; z: number; r: number }[] = [];

  private buildTerrain(): void {
    const palette = PALETTE[this.body];
    // Craters beyond the base: plenty on the Moon, a few on Mars.
    const count = this.body === 'moon' ? 34 : this.body === 'mars' ? 10 : 0;
    for (let i = 0; i < count; i += 1) {
      const angle = hash(i, 3) * Math.PI * 2;
      const dist = FLAT_RADIUS + 60 + hash(i, 7) * (TERRAIN_SIZE / 2 - FLAT_RADIUS - 80);
      this.craters.push({ x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, r: 14 + hash(i, 11) * 46 });
    }
    const segments = this.software ? 90 : 200;
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segments, segments).rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const light = new THREE.Color(palette.ground);
    const dark = new THREE.Color(palette.groundDark);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, heightAt(x, z, this.craters));
      // Mottled ground: broad patches plus fine grain.
      const shade = fbm(x * 0.012 + 40, z * 0.012 + 9) * 0.75 + hash(Math.round(x * 3), Math.round(z * 3)) * 0.25;
      c.copy(dark).lerp(light, THREE.MathUtils.clamp(shade * 1.25, 0, 1));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardNodeMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      map: makeGrainTexture(),
    });
    this.scene.add(new THREE.Mesh(geo, mat));

    if (this.body === 'earth') {
      // Woods on the hills around the city: one instanced mesh.
      const tree = mergeGeometries(
        [cyl(0.5, 0.7, 3, 0x6b4a2f, 0, 0, 0, 6), at(paint(new THREE.ConeGeometry(3.2, 8, 7), 0x2f6b3a), 0, 6.5, 0), at(paint(new THREE.ConeGeometry(2.3, 6, 7), 0x3a7d45), 0, 10, 0)],
        false,
      )!;
      tree.computeVertexNormals();
      const n = this.software ? 220 : 700;
      const woods = new THREE.InstancedMesh(tree, new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 1 }), n);
      for (let i = 0; i < n; i += 1) {
        const angle = hash(i, 61) * Math.PI * 2;
        const dist = FLAT_RADIUS + 12 + hash(i, 62) ** 0.7 * (TERRAIN_SIZE / 2 - FLAT_RADIUS - 30);
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        this.dummy.position.set(x, heightAt(x, z, this.craters) - 0.3, z);
        this.dummy.rotation.set(0, hash(i, 63) * 6.28, 0);
        this.dummy.scale.setScalar(0.8 + hash(i, 64) * 1.1);
        this.dummy.updateMatrix();
        woods.setMatrixAt(i, this.dummy.matrix);
      }
      woods.instanceMatrix.needsUpdate = true;
      this.scene.add(woods);
    }
  }

  private buildSky(): void {
    if (this.body !== 'moon') return;
    // Stars over the horizon, and the Earth hanging in the black.
    const n = this.software ? 500 : 1600;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      const a = hash(i, 1) * Math.PI * 2;
      const e = Math.asin(hash(i, 2));
      positions[i * 3] = Math.cos(a) * Math.cos(e) * 3200;
      positions[i * 3 + 1] = Math.sin(e) * 3200 + 20;
      positions[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 3200;
    }
    const stars = new THREE.BufferGeometry();
    stars.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.scene.add(new THREE.Points(stars, new THREE.PointsNodeMaterial({ color: 0xffffff, sizeAttenuation: false })));

    const earthMap = new THREE.TextureLoader().load('/textures/earth_day.jpg');
    earthMap.colorSpace = THREE.SRGBColorSpace;
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(190, 40, 20),
      new THREE.MeshStandardNodeMaterial({ map: earthMap, roughness: 1 }),
    );
    earth.position.set(900, 1150, -2400);
    earth.rotation.set(0.3, 2.2, 0.2);
    this.scene.add(earth);
  }

  /** Rebuild the base from a (new) model. The ground and the sky stay. */
  setModel(model: BaseModel): void {
    for (const child of [...this.base.children]) {
      this.base.remove(child);
      // Groups (cranes, the shuttle) hold meshes of their own.
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        (mesh.material as THREE.Material | undefined)?.dispose();
      });
    }
    const palette = PALETTE[this.body];
    this.cranes = [];
    this.pickables = [];
    this.shuttle = null;
    this.flame = null;

    // Roads: the rings, and spokes from the hub to the outermost one.
    const roadMat = new THREE.MeshStandardNodeMaterial({ color: palette.road, roughness: 1 });
    for (const radius of model.rings) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 1.6, radius + 1.6, 72).rotateX(-Math.PI / 2), roadMat);
      ring.position.y = 0.22;
      this.base.add(ring);
    }
    const reach = model.rings[model.rings.length - 1] ?? 34;
    for (let i = 0; i < 4; i += 1) {
      const spoke = new THREE.Mesh(new THREE.PlaneGeometry(reach, 3).rotateX(-Math.PI / 2), roadMat);
      const angle = (i / 4) * Math.PI * 2 + 0.4;
      spoke.position.set((Math.cos(angle) * reach) / 2, 0.21, (Math.sin(angle) * reach) / 2);
      spoke.rotation.y = -angle;
      this.base.add(spoke);
    }

    // Buildings: one instanced mesh per kind.
    const byKind = new Map<BuildingKind, Building[]>();
    for (const b of model.buildings) byKind.set(b.kind, [...(byKind.get(b.kind) ?? []), b]);
    const material = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.12 });
    const craneMaterial = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.12 });
    const lightSpots: THREE.Vector3[] = [];
    const shadows: { x: number; z: number; r: number; h: number }[] = [];
    for (const [kind, list] of byKind) {
      const plan = blueprint(kind);
      const geometry = mergeGeometries(plan.parts, false);
      if (!geometry) continue;
      geometry.computeVertexNormals();
      // A kind with a single building is a plain mesh. The renderer builds
      // its instancing data once per (material, geometry layout) for
      // instanced meshes of count 1, so several of those would all be drawn
      // where the first one stands.
      const single = list.length === 1;
      const mesh: THREE.Mesh = single
        ? new THREE.Mesh(geometry, material)
        : new THREE.InstancedMesh(geometry, material, list.length);
      list.forEach((b, i) => {
        this.dummy.position.set(b.x, 0.2, b.z);
        this.dummy.rotation.set(0, b.rot, 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        if (single) {
          mesh.position.copy(this.dummy.position);
          mesh.rotation.copy(this.dummy.rotation);
        } else {
          (mesh as THREE.InstancedMesh).setMatrixAt(i, this.dummy.matrix);
        }
        for (const [lx, ly, lz] of plan.lights) {
          lightSpots.push(new THREE.Vector3(lx, ly, lz).applyMatrix4(this.dummy.matrix));
        }
        shadows.push({ x: b.x, z: b.z, r: plan.radius, h: plan.height });
      });
      if (!single) (mesh as THREE.InstancedMesh).instanceMatrix.needsUpdate = true;
      this.base.add(mesh);
      this.pickables.push({ mesh, kind });
      if (kind === 'pad' && list[0]) this.padAt.set(list[0].x, 0, list[0].z);
      if (kind === 'site') {
        for (const b of list) {
          // Mast (static) and jib (turning) of a tower crane beside the site.
          const crane = new THREE.Group();
          const mastGeo = mergeGeometries([box(0.8, 20, 0.8, 0xf2c230), box(2.4, 1, 2.4, DARK)], false)!;
          mastGeo.computeVertexNormals();
          crane.add(new THREE.Mesh(mastGeo, craneMaterial));
          const jibGeo = mergeGeometries(
            [box(20, 0.6, 0.6, 0xf2c230, 6, 20, 0), box(2, 1.6, 1.6, DARK, -3, 19.4, 0), box(0.15, 8, 0.15, DARK, 13, 12, 0), box(1.6, 1, 1.6, STEEL, 13, 11, 0)],
            false,
          )!;
          jibGeo.computeVertexNormals();
          const jib = new THREE.Mesh(jibGeo, craneMaterial);
          crane.add(jib);
          crane.position.set(b.x + Math.cos(-b.rot) * 9.5, 0.2, b.z + Math.sin(-b.rot) * 9.5);
          this.base.add(crane);
          this.cranes.push(jib);
        }
      }
    }

    // Lights: small glowing boxes at windows, doors and mast tops.
    if (lightSpots.length > 0) {
      const lamps = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.7, 0.7, 0.7),
        new THREE.MeshBasicNodeMaterial({ color: 0xffd9a0 }),
        lightSpots.length,
      );
      lightSpots.forEach((p, i) => {
        this.dummy.position.copy(p);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        lamps.setMatrixAt(i, this.dummy.matrix);
      });
      lamps.instanceMatrix.needsUpdate = true;
      this.base.add(lamps);
    }

    // Blob shadows, thrown away from the sun and longer for taller things.
    const shadowMesh = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicNodeMaterial({ color: 0x000000, transparent: true, opacity: this.body === 'moon' ? 0.5 : this.body === 'mars' ? 0.28 : 0.24, depthWrite: false }),
      shadows.length,
    );
    const away = new THREE.Vector2(-SUN.x, -SUN.z).normalize();
    const heading = Math.atan2(away.y, away.x);
    shadows.forEach((s, i) => {
      const reach = s.h * 0.55;
      this.dummy.position.set(s.x + (away.x * reach) / 2, 0.26, s.z + (away.y * reach) / 2);
      this.dummy.rotation.set(0, -heading, 0);
      this.dummy.scale.set(s.r * 0.72 + reach / 2, 1, s.r * 0.72);
      this.dummy.updateMatrix();
      shadowMesh.setMatrixAt(i, this.dummy.matrix);
    });
    shadowMesh.instanceMatrix.needsUpdate = true;
    this.solids = shadows;
    shadowMesh.renderOrder = 1;
    this.base.add(shadowMesh);

    // People and rovers. Fewer of each where the picture is drawn on the CPU.
    const doors = model.buildings.filter((b) => b.kind !== 'solar' && b.kind !== 'tower');
    const crowd = Math.max(0, Math.round(model.people * (this.software ? 0.35 : 1)));
    this.walkers = [];
    for (let i = 0; i < crowd && doors.length > 1; i += 1) {
      const a = doors[Math.floor(hash(i, 21) * doors.length)]!;
      // Mostly short trips to a neighbour; now and then across the base.
      const near = [...doors].sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z));
      const b = near[1 + Math.floor(hash(i, 22) * Math.min(5, near.length - 1))] ?? a;
      const edge = (p: Building, k: number) => {
        const r = blueprint(p.kind).radius * 0.8;
        const ang = hash(i, k) * Math.PI * 2;
        return { x: p.x + Math.cos(ang) * r, z: p.z + Math.sin(ang) * r };
      };
      const from = edge(a, 23);
      const to = edge(b, 24);
      this.walkers.push({ ax: from.x, az: from.z, bx: to.x, bz: to.z, t: hash(i, 25), speed: 1.1 + hash(i, 26) * 0.7, phase: hash(i, 27) * 6.28 });
    }
    if (this.walkers.length > 0) {
      // A suited figure: legs, torso, helmet with a dark visor, life-support pack.
      // The suit colour comes from the instance; the visor stays dark under it.
      const figure = mergeGeometries(
        [
          box(0.22, 0.7, 0.24, 0xffffff, -0.15, 0, 0),
          box(0.22, 0.7, 0.24, 0xffffff, 0.15, 0, 0),
          box(0.62, 0.72, 0.36, 0xffffff, 0, 0.7, 0),
          box(0.16, 0.6, 0.2, 0xffffff, -0.4, 0.76, 0),
          box(0.16, 0.6, 0.2, 0xffffff, 0.4, 0.76, 0),
          at(paint(new THREE.SphereGeometry(0.27, 10, 8), 0xffffff), 0, 1.68, 0),
          box(0.34, 0.2, 0.1, 0x10141c, 0, 1.6, 0.2),
          box(0.46, 0.6, 0.22, 0x8f97a3, 0, 0.78, -0.28),
        ],
        false,
      )!;
      figure.computeVertexNormals();
      this.people = new THREE.InstancedMesh(
        figure,
        new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.6 }),
        this.walkers.length,
      );
      const suit = new THREE.Color();
      this.walkers.forEach((_, i) => {
        // Mostly white suits, some orange and blue: crews are colour-coded.
        const pick = hash(i, 31);
        suit.set(pick > 0.82 ? 0xff9a3c : pick > 0.66 ? 0x6fb4ff : 0xf4f6f8);
        this.people!.setColorAt(i, suit);
      });
      if (this.people.instanceColor) this.people.instanceColor.needsUpdate = true;
      this.base.add(this.people);
    } else {
      this.people = null;
    }

    this.drivers = [];
    // Never a single rover: see the note on single instances above.
    const fleet = Math.max(2, Math.round(model.rovers * (this.software ? 0.5 : 1)));
    for (let i = 0; i < fleet && model.rings.length > 0; i += 1) {
      const radius = model.rings[i % model.rings.length]!;
      this.drivers.push({ radius, angle: hash(i, 41) * Math.PI * 2, speed: (i % 2 === 0 ? 1 : -1) * (4 + hash(i, 42) * 3) });
    }
    if (this.drivers.length > 0) {
      const body = mergeGeometries(
        [
          box(3.4, 1.1, 1.9, 0xf0f2f4, 0, 0.55, 0),
          box(1.5, 0.9, 1.7, GLASS, 0.5, 1.65, 0),
          box(0.7, 0.9, 2.3, DARK, 1.1, 0, 0),
          box(0.7, 0.9, 2.3, DARK, -1.1, 0, 0),
        ],
        false,
      )!;
      body.computeVertexNormals();
      this.rovers = new THREE.InstancedMesh(
        body,
        new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.7 }),
        this.drivers.length,
      );
      this.base.add(this.rovers);
    } else {
      this.rovers = null;
    }

    if (model.buildings.some((b) => b.kind === 'pad')) {
      // The supply shuttle: comes down on the pad, sits, lifts off again.
      const hull = mergeGeometries(
        [
          cyl(1.6, 2.1, 6, WHITE, 0, 1.4),
          at(paint(new THREE.ConeGeometry(1.6, 3, 14), ORANGE), 0, 8.9, 0),
          box(0.3, 2, 0.3, STEEL, 2.1, 0, 2.1),
          box(0.3, 2, 0.3, STEEL, -2.1, 0, 2.1),
          box(0.3, 2, 0.3, STEEL, 2.1, 0, -2.1),
          box(0.3, 2, 0.3, STEEL, -2.1, 0, -2.1),
        ],
        false,
      )!;
      hull.computeVertexNormals();
      const shuttle = new THREE.Group();
      shuttle.add(new THREE.Mesh(hull, new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.6 })));
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(1.2, 5, 10).rotateX(Math.PI).translate(0, -1.4, 0),
        new THREE.MeshBasicNodeMaterial({ color: 0xffc46b, transparent: true, opacity: 0.85 }),
      );
      shuttle.add(flame);
      shuttle.position.set(this.padAt.x + 9, 0.4, this.padAt.z);
      this.base.add(shuttle);
      this.shuttle = shuttle;
      this.flame = flame;
    }
    this.animate(0);
  }

  // ---- Loop --------------------------------------------------------------

  private animate(dt: number): void {
    const step = this.reducedMotion ? 0 : dt;
    if (this.people) {
      // The Moon's weak gravity turns a walk into a slow bounce.
      const hop = this.body === 'moon' ? 0.42 : this.body === 'mars' ? 0.12 : 0.05;
      const now = performance.now() / 1000;
      this.walkers.forEach((w, i) => {
        const length = Math.hypot(w.bx - w.ax, w.bz - w.az) || 1;
        w.t += (step * w.speed) / length;
        if (w.t >= 1) {
          // Turn round and walk back.
          w.t = 0;
          [w.ax, w.bx] = [w.bx, w.ax];
          [w.az, w.bz] = [w.bz, w.az];
        }
        this.dummy.position.set(
          w.ax + (w.bx - w.ax) * w.t,
          0.25 + Math.abs(Math.sin(now * w.speed * 2.6 + w.phase)) * hop * (step > 0 ? 1 : 0),
          w.az + (w.bz - w.az) * w.t,
        );
        this.dummy.rotation.set(0, Math.atan2(w.bx - w.ax, w.bz - w.az), 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        this.people!.setMatrixAt(i, this.dummy.matrix);
      });
      this.people.instanceMatrix.needsUpdate = true;
    }
    this.clock += step;
    this.cranes.forEach((jib, i) => {
      // Swing slowly back and forth, each crane on its own beat.
      jib.rotation.y = Math.sin(this.clock * 0.35 + i * 1.7) * 1.3 + i;
    });
    if (this.shuttle && this.flame) {
      // A 40-second round: descend, sit on the pad, climb away, stay gone.
      const t = (this.clock % 40) / 40;
      const TOP = 260;
      let y: number;
      let burning = true;
      if (t < 0.25) y = TOP * (1 - t / 0.25) ** 2;
      else if (t < 0.6) {
        y = 0;
        burning = false;
      } else if (t < 0.85) y = TOP * ((t - 0.6) / 0.25) ** 2;
      else {
        y = TOP;
        burning = false;
      }
      this.shuttle.visible = t < 0.85;
      this.shuttle.position.y = 0.4 + y;
      this.flame.visible = burning;
      this.flame.scale.setScalar(0.8 + Math.sin(this.clock * 30) * 0.15);
    }
    if (this.rovers) {
      this.drivers.forEach((d, i) => {
        d.angle += (step * d.speed) / d.radius;
        this.dummy.position.set(Math.cos(d.angle) * d.radius, 0.3, Math.sin(d.angle) * d.radius);
        this.dummy.rotation.set(0, -d.angle + (d.speed > 0 ? -Math.PI / 2 : Math.PI / 2), 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        this.rovers!.setMatrixAt(i, this.dummy.matrix);
      });
      this.rovers.instanceMatrix.needsUpdate = true;
    }
  }

  /** Solid footprints: where the camera may not be. */
  private solids: { x: number; z: number; r: number; h: number }[] = [];

  /** Lift the camera over any building it has wandered into, and off the ground. */
  private keepOutOfBuildings(): void {
    const p = this.camera.position;
    let floor = 1.6;
    for (const s of this.solids) {
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < s.r + 1.5) floor = Math.max(floor, s.h + 2);
    }
    if (p.y < floor) p.y = floor;
  }

  private readonly frame = (time: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const elapsed = time - this.last;
    // Software rendering: draw at most ~20 times a second.
    if (this.software && elapsed < 48) return;
    this.last = time;
    this.animate(Math.min(0.1, elapsed / 1000));
    this.controls.update();
    this.keepOutOfBuildings();
    this.renderer.render(this.scene, this.camera);
  };
}

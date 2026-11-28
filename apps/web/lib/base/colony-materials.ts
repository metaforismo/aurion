// Materials for the lunar and Martian bases: hull plating with seams,
// rivets and dust; glass held in a geodesic frame; solar cells. Painted on
// canvases once and shared. Building parts keep their colour in vertex
// colours, which these maps multiply.
//
// DOM/WebGL only.
import * as THREE from 'three/webgpu';

import { solarTexture } from './city-scene';

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return [c, c.getContext('2d')!];
}

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Hull plating: panels of slightly different tone, seams, rivets, dust at the foot. */
function hullMaps(size: number, dust: string): { map: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const [c, g] = canvas(size);
  const [n, gn] = canvas(size);
  const r = rng(11);
  gn.fillStyle = 'rgb(128,128,255)';
  gn.fillRect(0, 0, size, size);
  const cols = 4;
  const rows = 6;
  const pw = size / cols;
  const ph = size / rows;
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < rows; j += 1) {
      const v = 225 + Math.round((r() - 0.5) * 22);
      g.fillStyle = `rgb(${v},${v},${v + 2})`;
      g.fillRect(i * pw, j * ph, pw, ph);
    }
  }
  // Seams: dark lines, raised edges in the normal map.
  g.strokeStyle = 'rgba(60,64,70,0.55)';
  g.lineWidth = Math.max(1, size / 256);
  for (let i = 0; i <= cols; i += 1) {
    g.beginPath();
    g.moveTo(i * pw, 0);
    g.lineTo(i * pw, size);
    g.stroke();
    gn.fillStyle = 'rgb(90,128,255)';
    gn.fillRect(i * pw - 1, 0, 1, size);
    gn.fillStyle = 'rgb(166,128,255)';
    gn.fillRect(i * pw + 1, 0, 1, size);
  }
  for (let j = 0; j <= rows; j += 1) {
    g.beginPath();
    g.moveTo(0, j * ph);
    g.lineTo(size, j * ph);
    g.stroke();
    gn.fillStyle = 'rgb(128,90,255)';
    gn.fillRect(0, j * ph - 1, size, 1);
    gn.fillStyle = 'rgb(128,166,255)';
    gn.fillRect(0, j * ph + 1, size, 1);
  }
  // Rivets along the seams.
  g.fillStyle = 'rgba(90,94,100,0.6)';
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < rows; j += 1) {
      for (let k = 1; k < 6; k += 1) {
        g.fillRect(i * pw + (k * pw) / 6, j * ph + 4, 2, 2);
        g.fillRect(i * pw + (k * pw) / 6, (j + 1) * ph - 6, 2, 2);
      }
    }
  }
  // Dust settling on the lower panels, and a few scuffs.
  const grad = g.createLinearGradient(0, size, 0, size * 0.55);
  grad.addColorStop(0, dust);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  for (let k = 0; k < 40; k += 1) {
    g.fillStyle = `rgba(80,80,80,${0.04 + r() * 0.06})`;
    g.fillRect(r() * size, r() * size, 2 + r() * 30, 1 + r() * 3);
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const normal = new THREE.CanvasTexture(n);
  for (const t of [map, normal]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
  }
  return { map, normal };
}

/** Struts of a geodesic frame over clear panes. */
function frameMap(size: number): THREE.CanvasTexture {
  const [c, g] = canvas(size);
  g.fillStyle = 'rgba(190,225,240,0.28)';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(235,238,242,1)';
  g.lineWidth = Math.max(2, size / 128);
  const n = 8;
  const step = size / n;
  for (let k = 0; k <= n; k += 1) {
    g.beginPath();
    g.moveTo(k * step, 0);
    g.lineTo(k * step, size);
    g.stroke();
    g.beginPath();
    g.moveTo(0, k * step);
    g.lineTo(size, k * step);
    g.stroke();
  }
  // Diagonals: triangles, as in a real geodesic dome.
  for (let k = -n; k <= n; k += 1) {
    g.beginPath();
    g.moveTo(k * step, 0);
    g.lineTo(k * step + size, size);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 3);
  t.anisotropy = 4;
  return t;
}

export type ColonyMaterials = Record<'body' | 'glass' | 'solar' | 'green', THREE.Material>;

export function colonyMaterials(body: 'moon' | 'mars', software: boolean): ColonyMaterials {
  const size = software ? 256 : 512;
  const hull = hullMaps(size, body === 'mars' ? 'rgba(170,90,50,0.45)' : 'rgba(120,120,120,0.35)');
  hull.map.repeat.set(2, 2);
  hull.normal.repeat.set(2, 2);
  const glass = new THREE.MeshStandardNodeMaterial({
    map: frameMap(size),
    transparent: true,
    roughness: 0.08,
    metalness: 0.4,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const solar = new THREE.MeshStandardNodeMaterial({ map: solarTexture(), roughness: 0.25, metalness: 0.6 });
  solar.map!.repeat.set(2, 3);
  return {
    body: new THREE.MeshStandardNodeMaterial({
      vertexColors: true,
      map: hull.map,
      normalMap: hull.normal,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.5,
      metalness: 0.3,
    }),
    glass,
    solar,
    green: new THREE.MeshStandardNodeMaterial({ color: 0x7fc98a, roughness: 0.6, transparent: true, opacity: 0.85 }),
  };
}

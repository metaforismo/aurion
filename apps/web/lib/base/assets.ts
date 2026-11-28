// Materials for the close-up views. Surfaces come from photographed CC0
// textures (public/base, see LICENSES.md there); building facades are
// composed at load time on a canvas — the real wall texture, then windows,
// frames, glass and interiors drawn over it — so every style gets a
// colour, a normal and a roughness/metalness map that line up.
//
// Texture coordinates are in metres divided by the tile size, so one
// texture per material serves every building whatever its size.
//
// DOM/WebGL only.
import * as THREE from 'three/webgpu';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const BASE = '/base';

const images = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = images.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`could not load ${url}`));
      img.src = url;
    });
    images.set(url, p);
  }
  return p;
}

function textureOf(source: HTMLImageElement | HTMLCanvasElement, color: boolean, anisotropy = 8): THREE.Texture {
  const tex = source instanceof HTMLCanvasElement ? new THREE.CanvasTexture(source) : new THREE.Texture(source);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export type Surface = { map: HTMLImageElement; normal: HTMLImageElement; rough: HTMLImageElement };

export async function loadSurface(name: string): Promise<Surface> {
  const [map, normal, rough] = await Promise.all([
    loadImage(`${BASE}/tex/${name}-diff.jpg`),
    loadImage(`${BASE}/tex/${name}-nor.jpg`),
    loadImage(`${BASE}/tex/${name}-rough.jpg`),
  ]);
  return { map, normal, rough };
}

/** A tiling PBR material straight from a photographed surface. */
export function surfaceMaterial(
  s: Surface,
  opts: { color?: number; normalScale?: number; roughness?: number; metalness?: number; vertexColors?: boolean } = {},
): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({
    map: textureOf(s.map, true),
    normalMap: textureOf(s.normal, false),
    roughnessMap: textureOf(s.rough, false),
    roughness: opts.roughness ?? 1,
    metalness: opts.metalness ?? 0,
    color: opts.color ?? 0xffffff,
    vertexColors: opts.vertexColors ?? false,
  });
  m.normalScale = new THREE.Vector2(opts.normalScale ?? 1, opts.normalScale ?? 1);
  return m;
}

// ---------------------------------------------------------------------------
// Facades
// ---------------------------------------------------------------------------

export type FacadeSpec = {
  /** Wall surface, or null for an all-glass curtain wall. */
  wall: string | null;
  /** Wall tint multiplied over the texture. */
  tint?: string;
  /** One texture tile covers this many bays and floors. */
  bays: number;
  floors: number;
  /** Size of a bay and of a floor, in metres. */
  bayW: number;
  floorH: number;
  /** Window rectangle within a bay, as fractions (left, right, bottom, top). */
  win: [number, number, number, number];
  /** Glass colours, top and bottom of a pane. */
  glass: [string, string];
  frame: string;
  /** Vertical mullions per window. */
  mullions?: number;
  /** Horizontal spandrel band colour for curtain walls. */
  spandrel?: string;
  /** Metalness of the glass: how much it mirrors the sky. */
  glassMetal?: number;
  /** Chance that a window shows blinds or curtains. */
  blinds?: number;
  /** A sill under each window. */
  sill?: boolean;
};

export const FACADES: Record<string, FacadeSpec> = {
  glass_blue: { wall: null, bays: 4, floors: 4, bayW: 3, floorH: 3.9, win: [0.03, 0.97, 0.24, 0.98], glass: ['#3c5f86', '#1e3550'], frame: '#c8ced6', mullions: 1, spandrel: '#2a3c52', glassMetal: 0.65, blinds: 0.15 },
  glass_teal: { wall: null, bays: 4, floors: 4, bayW: 3, floorH: 3.9, win: [0.02, 0.98, 0.2, 0.98], glass: ['#4f8e8c', '#22494b'], frame: '#9aa4a8', mullions: 2, spandrel: '#23383a', glassMetal: 0.6, blinds: 0.12 },
  glass_bronze: { wall: null, bays: 4, floors: 4, bayW: 3.2, floorH: 4, win: [0.04, 0.96, 0.26, 0.97], glass: ['#7a6248', '#3b2c20'], frame: '#4a3a2c', mullions: 1, spandrel: '#2a2018', glassMetal: 0.6, blinds: 0.1 },
  glass_dark: { wall: null, bays: 4, floors: 4, bayW: 3, floorH: 3.8, win: [0.02, 0.98, 0.16, 0.99], glass: ['#3a4048', '#15181c'], frame: '#1a1c20', mullions: 2, spandrel: '#101214', glassMetal: 0.7, blinds: 0.05 },
  office_concrete: { wall: 'concrete_tile_facade', bays: 4, floors: 4, bayW: 3.2, floorH: 3.7, win: [0.0, 1.0, 0.32, 0.86], glass: ['#5b7590', '#26384a'], frame: '#4b5058', mullions: 2, glassMetal: 0.45, blinds: 0.35 },
  office_cladding: { wall: 'rectangular_facade_tiles', bays: 4, floors: 4, bayW: 3, floorH: 3.7, win: [0.16, 0.84, 0.28, 0.9], glass: ['#5d7894', '#223448'], frame: '#2d3138', mullions: 1, glassMetal: 0.45, blinds: 0.3, sill: true },
  apartment_plaster: { wall: 'white_plaster_rough_01', tint: '#efe9df', bays: 4, floors: 4, bayW: 3.4, floorH: 3, win: [0.28, 0.72, 0.28, 0.85], glass: ['#61768a', '#2a3644'], frame: '#f2f2f0', mullions: 1, glassMetal: 0.25, blinds: 0.55, sill: true },
  apartment_yellow: { wall: 'yellow_plaster', bays: 4, floors: 4, bayW: 3.4, floorH: 3, win: [0.3, 0.7, 0.26, 0.86], glass: ['#5a6e80', '#26323e'], frame: '#5b3b26', mullions: 1, glassMetal: 0.25, blinds: 0.6, sill: true },
  apartment_brick: { wall: 'red_brick_03', bays: 4, floors: 4, bayW: 3.2, floorH: 3, win: [0.26, 0.74, 0.26, 0.84], glass: ['#5e7286', '#28343f'], frame: '#e8e6e0', mullions: 1, glassMetal: 0.25, blinds: 0.5, sill: true },
  house_plaster: { wall: 'white_plaster_rough_01', tint: '#f3ede2', bays: 4, floors: 2, bayW: 3, floorH: 2.8, win: [0.32, 0.68, 0.3, 0.82], glass: ['#5d7184', '#27323d'], frame: '#ffffff', mullions: 1, glassMetal: 0.2, blinds: 0.6, sill: true },
  house_brick: { wall: 'red_brick_03', bays: 4, floors: 2, bayW: 3, floorH: 2.8, win: [0.32, 0.68, 0.3, 0.82], glass: ['#5d7184', '#27323d'], frame: '#f4f2ee', mullions: 1, glassMetal: 0.2, blinds: 0.6, sill: true },
  house_yellow: { wall: 'yellow_plaster', bays: 4, floors: 2, bayW: 3, floorH: 2.8, win: [0.32, 0.68, 0.3, 0.82], glass: ['#5d7184', '#27323d'], frame: '#6a4a30', mullions: 1, glassMetal: 0.2, blinds: 0.6, sill: true },
  storefront: { wall: 'concrete_tile_facade', tint: '#cfcac2', bays: 4, floors: 1, bayW: 3.2, floorH: 5, win: [0.04, 0.96, 0.04, 0.72], glass: ['#8aa0b0', '#2c343a'], frame: '#2a2c30', mullions: 2, glassMetal: 0.35, blinds: 0 },
  factory: { wall: 'factory_brick', bays: 4, floors: 2, bayW: 5, floorH: 6, win: [0.2, 0.8, 0.55, 0.88], glass: ['#7f8f98', '#3c464c'], frame: '#3a3d40', mullions: 3, glassMetal: 0.2, blinds: 0 },
  warehouse: { wall: 'rough_concrete', tint: '#c9c6c0', bays: 4, floors: 2, bayW: 6, floorH: 4.5, win: [0.38, 0.62, 0.7, 0.86], glass: ['#73828b', '#353d42'], frame: '#4c5054', mullions: 1, glassMetal: 0.2, blinds: 0 },
  lab: { wall: 'rectangular_facade_tiles', tint: '#e8ecef', bays: 4, floors: 4, bayW: 3, floorH: 4, win: [0.04, 0.96, 0.3, 0.92], glass: ['#6a92ae', '#27425a'], frame: '#d9dee2', mullions: 2, glassMetal: 0.5, blinds: 0.1 },
  barracks: { wall: 'rough_concrete', tint: '#a4a98e', bays: 4, floors: 2, bayW: 3.6, floorH: 3.2, win: [0.34, 0.66, 0.34, 0.78], glass: ['#5f6a70', '#2a3034'], frame: '#59603f', mullions: 1, glassMetal: 0.2, blinds: 0 },
  datacenter: { wall: 'rectangular_facade_tiles', tint: '#9aa2ac', bays: 4, floors: 2, bayW: 4, floorH: 6, win: [0.1, 0.9, 0.82, 0.9], glass: ['#2f5a9c', '#14284a'], frame: '#2b2f36', mullions: 0, glassMetal: 0.4, blinds: 0 },
  capitol: { wall: 'white_sandstone_blocks_02', bays: 4, floors: 2, bayW: 4, floorH: 6, win: [0.3, 0.7, 0.2, 0.8], glass: ['#4a5a68', '#1e262e'], frame: '#e9e2d0', mullions: 1, glassMetal: 0.25, blinds: 0.3, sill: true },
  arcology: { wall: null, bays: 4, floors: 4, bayW: 3.4, floorH: 4.2, win: [0.03, 0.97, 0.3, 0.97], glass: ['#5e8fa0', '#264652'], frame: '#e3e8ea', mullions: 1, spandrel: '#cfd8da', glassMetal: 0.55, blinds: 0.15 },
};

/** Real-world size of one tile of each photographed surface, in metres. */
const SURFACE_METRES = 2.4;

export type Facade = { material: THREE.MeshStandardNodeMaterial; tileW: number; tileH: number };

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export async function makeFacade(spec: FacadeSpec, seed: number, size = 1024): Promise<Facade> {
  const tileW = spec.bays * spec.bayW;
  const tileH = spec.floors * spec.floorH;
  const W = size;
  const H = Math.round(size * Math.min(2, tileH / tileW));
  const color = document.createElement('canvas');
  const normal = document.createElement('canvas');
  const orm = document.createElement('canvas');
  for (const c of [color, normal, orm]) {
    c.width = W;
    c.height = H;
  }
  const cc = color.getContext('2d')!;
  const nc = normal.getContext('2d')!;
  const oc = orm.getContext('2d')!;

  // Wall: the photographed surface tiled at its real size, or flat panels.
  const pxPerMetreX = W / tileW;
  const pxPerMetreY = H / tileH;
  if (spec.wall) {
    const s = await loadSurface(spec.wall);
    const tw = SURFACE_METRES * pxPerMetreX;
    const th = SURFACE_METRES * pxPerMetreY;
    for (let y = 0; y < H; y += th) {
      for (let x = 0; x < W; x += tw) {
        cc.drawImage(s.map, x, y, tw + 1, th + 1);
        nc.drawImage(s.normal, x, y, tw + 1, th + 1);
        oc.drawImage(s.rough, x, y, tw + 1, th + 1);
      }
    }
    if (spec.tint) {
      cc.globalCompositeOperation = 'multiply';
      cc.fillStyle = spec.tint;
      cc.fillRect(0, 0, W, H);
      cc.globalCompositeOperation = 'source-over';
    }
    // The roughness map is grey: keep it as green, no metal, full AO.
    const img = oc.getImageData(0, 0, W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const g = img.data[i + 1]!;
      img.data[i] = 255;
      img.data[i + 1] = Math.min(255, g * 0.9 + 25);
      img.data[i + 2] = 0;
    }
    oc.putImageData(img, 0, 0);
  } else {
    cc.fillStyle = spec.spandrel ?? '#333';
    cc.fillRect(0, 0, W, H);
    nc.fillStyle = 'rgb(128,128,255)';
    nc.fillRect(0, 0, W, H);
    oc.fillStyle = 'rgb(255,110,120)';
    oc.fillRect(0, 0, W, H);
  }

  // Windows, bay by bay, floor by floor. Rows are drawn top-down; the tile
  // starts at a floor line so storeys line up across buildings.
  let rng = seed * 9301 + 49297;
  const rnd = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };
  const [gl, gr, gb] = hexToRgb(spec.glass[0]);
  const bw = W / spec.bays;
  const fh = H / spec.floors;
  const frame = Math.max(2, Math.round(bw * 0.025));
  for (let f = 0; f < spec.floors; f += 1) {
    for (let b = 0; b < spec.bays; b += 1) {
      const x0 = b * bw + spec.win[0] * bw;
      const x1 = b * bw + spec.win[1] * bw;
      const yTop = f * fh + (1 - spec.win[3]) * fh;
      const yBot = f * fh + (1 - spec.win[2]) * fh;
      const w = x1 - x0;
      const h = yBot - yTop;
      // Glass: sky at the top fading to the dark interior, each pane a
      // little different so the facade does not look printed.
      const shade = 0.85 + rnd() * 0.3;
      const grad = cc.createLinearGradient(0, yTop, 0, yBot);
      grad.addColorStop(0, `rgb(${Math.min(255, gl * shade * 1.15)},${Math.min(255, gr * shade * 1.15)},${Math.min(255, gb * shade * 1.15)})`);
      grad.addColorStop(1, spec.glass[1]);
      cc.fillStyle = grad;
      cc.fillRect(x0, yTop, w, h);
      // Blinds or curtains behind some panes; a lit interior on a few.
      const r = rnd();
      if (r < (spec.blinds ?? 0)) {
        const drop = h * (0.25 + rnd() * 0.6);
        cc.fillStyle = rnd() < 0.5 ? 'rgba(225,222,212,0.55)' : 'rgba(190,175,150,0.5)';
        cc.fillRect(x0, yTop, w, drop);
        for (let s = yTop; s < yTop + drop; s += Math.max(2, h / 24)) {
          cc.fillStyle = 'rgba(0,0,0,0.08)';
          cc.fillRect(x0, s, w, 1);
        }
      } else if (r > 0.94) {
        cc.fillStyle = 'rgba(255,224,170,0.28)';
        cc.fillRect(x0, yTop + h * 0.3, w, h * 0.7);
      }
      // Frames and mullions.
      cc.fillStyle = spec.frame;
      cc.fillRect(x0, yTop, w, frame);
      cc.fillRect(x0, yBot - frame, w, frame);
      cc.fillRect(x0, yTop, frame, h);
      cc.fillRect(x1 - frame, yTop, frame, h);
      const m = spec.mullions ?? 0;
      for (let k = 1; k <= m; k += 1) cc.fillRect(x0 + (w * k) / (m + 1) - frame / 2, yTop, frame, h);
      if (spec.sill) {
        cc.fillStyle = 'rgba(235,232,225,0.9)';
        cc.fillRect(x0 - frame * 2, yBot, w + frame * 4, frame * 2);
      }

      // Normal map: the glass sits back in the wall, its reveal catches light.
      nc.fillStyle = 'rgb(128,128,255)';
      nc.fillRect(x0, yTop, w, h);
      if (spec.wall) {
        const reveal = frame * 2;
        nc.fillStyle = 'rgb(128,40,200)';
        nc.fillRect(x0, yTop, w, reveal);
        nc.fillStyle = 'rgb(128,216,200)';
        nc.fillRect(x0, yBot - reveal, w, reveal);
        nc.fillStyle = 'rgb(216,128,200)';
        nc.fillRect(x0, yTop, reveal, h);
        nc.fillStyle = 'rgb(40,128,200)';
        nc.fillRect(x1 - reveal, yTop, reveal, h);
      }
      // Glass: smooth and, on curtain walls, mirror-like.
      const metal = Math.round((spec.glassMetal ?? 0.3) * 255);
      oc.fillStyle = `rgb(255,${Math.round(0.06 * 255)},${metal})`;
      oc.fillRect(x0 + frame, yTop + frame, w - frame * 2, h - frame * 2);
      oc.fillStyle = 'rgb(255,120,160)';
      oc.fillRect(x0, yTop, w, frame);
      oc.fillRect(x0, yBot - frame, w, frame);
    }
  }

  const ormTex = textureOf(orm, false);
  const material = new THREE.MeshStandardNodeMaterial({
    map: textureOf(color, true),
    normalMap: textureOf(normal, false),
    roughnessMap: ormTex,
    metalnessMap: ormTex,
    roughness: 1,
    metalness: 1,
  });
  return { material, tileW, tileH };
}

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------

export type Sky = { background: THREE.Texture; environment: THREE.Texture; sun: THREE.Vector3 };

export async function loadEarthSky(): Promise<Sky> {
  const [img, env, info] = await Promise.all([
    loadImage(`${BASE}/sky/earth.jpg`),
    new RGBELoader().loadAsync(`${BASE}/sky/earth.hdr`),
    fetch(`${BASE}/sky/earth.json`).then((r) => r.json() as Promise<{ sun: [number, number, number] }>),
  ]);
  const background = new THREE.Texture(img);
  background.mapping = THREE.EquirectangularReflectionMapping;
  background.colorSpace = THREE.SRGBColorSpace;
  background.needsUpdate = true;
  env.mapping = THREE.EquirectangularReflectionMapping;
  return { background, environment: env, sun: new THREE.Vector3(...info.sun).normalize() };
}

/** Tiling material from a surface name, cached per renderer. */
export class SurfaceCache {
  private readonly made = new Map<string, Promise<THREE.MeshStandardNodeMaterial>>();

  get(name: string, opts: Parameters<typeof surfaceMaterial>[1] = {}): Promise<THREE.MeshStandardNodeMaterial> {
    const key = `${name}|${JSON.stringify(opts)}`;
    let p = this.made.get(key);
    if (!p) {
      p = loadSurface(name).then((s) => surfaceMaterial(s, opts));
      this.made.set(key, p);
    }
    return p;
  }
}

// Planet renderer — a physically-motivated globe drawn with Three.js'
// WebGPU renderer (which transparently falls back to WebGL2 where WebGPU is
// unavailable). Materials are written in TSL so the same node graph compiles
// to WGSL or GLSL.
//
// The Earth shader blends a day albedo with emissive city lights across a
// soft terminator, adds ocean glint from a water mask, drifting cloud cover
// with its own shadow, a Rayleigh-tinted limb and an additive atmosphere
// shell. A canvas-backed overlay texture carries the political layer
// (borders, player/rival tints) so game state never touches the shader.
//
// This module is DOM/WebGL only — it must be imported dynamically from a
// client component.

import * as THREE from 'three/webgpu';
import {
  cameraPosition,
  dot,
  float,
  mix,
  normalize,
  positionWorld,
  pow,
  reflect,
  saturate,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';

export type PlanetBody = 'earth' | 'moon' | 'mars';

export type PlanetRendererOptions = {
  canvas: HTMLCanvasElement;
  body: PlanetBody;
  /** Initial camera target. */
  lon?: number;
  lat?: number;
  /** Camera distance in planet radii (1 = surface). */
  distance?: number;
  /** Slowly spin the camera when the user is idle (menu attract mode). */
  autoRotate?: boolean;
  /** Disable pointer / wheel handling (decorative backdrop). */
  interactive?: boolean;
  reducedMotion?: boolean;
  /** Horizontal offset of the planet centre, in fractions of the viewport. */
  offsetX?: number;
  /** Skip WebGPU and use the WebGL2 backend. */
  forceWebGL?: boolean;
};

export type ScreenPoint = { x: number; y: number; visible: boolean; depth: number };

const DEG = Math.PI / 180;
export const MIN_DISTANCE = 1.28;
export const MAX_DISTANCE = 4.2;
const OVERLAY_W = 4096;
const OVERLAY_H = 2048;

/** Unit vector for a geographic coordinate (matches SphereGeometry's UVs). */
export function lonLatToVector(lon: number, lat: number, radius = 1): THREE.Vector3 {
  const la = lat * DEG;
  const lo = lon * DEG;
  return new THREE.Vector3(
    radius * Math.cos(la) * Math.cos(lo),
    radius * Math.sin(la),
    -radius * Math.cos(la) * Math.sin(lo),
  );
}

export function vectorToLonLat(v: THREE.Vector3): { lon: number; lat: number } {
  const n = v.clone().normalize();
  return { lon: Math.atan2(-n.z, n.x) / DEG, lat: Math.asin(n.y) / DEG };
}

function loadTexture(url: string, color = true): THREE.Texture {
  const tex = new THREE.TextureLoader().load(url);
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Deterministic star field painted once into an equirectangular canvas. */
function makeStarTexture(): THREE.CanvasTexture {
  const w = 4096;
  const h = 2048;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#010206';
  g.fillRect(0, 0, w, h);
  // Faint galactic band.
  const band = g.createLinearGradient(0, h * 0.25, w, h * 0.75);
  band.addColorStop(0, 'rgba(40,50,90,0)');
  band.addColorStop(0.5, 'rgba(70,80,130,0.16)');
  band.addColorStop(1, 'rgba(40,50,90,0)');
  g.fillStyle = band;
  g.fillRect(0, 0, w, h);
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 5200; i += 1) {
    const x = rnd() * w;
    // Uniform on the sphere: latitude from asin.
    const y = (0.5 - Math.asin(rnd() * 2 - 1) / Math.PI) * h;
    const mag = rnd();
    const r = mag > 0.985 ? 1.3 : mag > 0.9 ? 0.9 : 0.55;
    const a = 0.25 + mag * 0.75;
    const tint = rnd();
    g.fillStyle =
      tint > 0.85
        ? `rgba(255,214,170,${a})`
        : tint < 0.15
          ? `rgba(170,200,255,${a})`
          : `rgba(255,255,255,${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class PlanetRenderer {
  readonly body: PlanetBody;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGPURenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.05, 400);
  private readonly sunDir = uniform(new THREE.Vector3(1, 0.25, 0.4).normalize());
  private readonly cloudShift = uniform(0);
  private readonly overlayCanvas: HTMLCanvasElement | null = null;
  private overlayTexture: THREE.CanvasTexture | null = null;
  private clouds: THREE.Mesh | null = null;

  private lon: number;
  private lat: number;
  private distance: number;
  private velLon = 0;
  private velLat = 0;
  private tween: {
    fromLon: number; fromLat: number; fromDist: number;
    toLon: number; toLat: number; toDist: number;
    start: number; duration: number;
  } | null = null;

  private readonly autoRotate: boolean;
  private readonly reducedMotion: boolean;
  private offsetX: number;
  private offsetTarget: number;
  private width = 1;
  private height = 1;
  private disposed = false;
  private ready = false;
  private lastTime = 0;
  private lastInteraction = 0;
  /** Adaptive resolution: fraction of the device pixel ratio in use. */
  private renderScale = 1;
  private frameEma = 16;
  /** CPU-rendered WebGL: draw fewer, smaller frames. */
  private readonly software: boolean;
  private frameCounter = 0;
  private framesSinceScale = 0;
  private sunLon = 40;
  private sunLat = 12;
  /** Degrees of solar longitude per second (a full day ≈ 6 minutes). */
  sunSpeed = 1;

  private dragging: { id: number; x: number; y: number; moved: number } | null = null;
  private pinch: { d: number } | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();

  /** The GPU device was lost while the renderer was live. */
  onDeviceLost: ((message: string) => void) | null = null;
  /** Fired when sustained slow frames force (or lift) the low-detail mode. */
  onPerformance: ((level: 'high' | 'low') => void) | null = null;
  /** Called once per rendered frame, after the camera has been updated. */
  onFrame: (() => void) | null = null;
  /** Click on the surface (not a drag). */
  onPick: ((lon: number, lat: number) => void) | null = null;
  /** Pointer hovering the surface; null when off-planet. */
  onHover: ((coords: { lon: number; lat: number } | null, x: number, y: number) => void) | null =
    null;
  /** Fired when the camera distance changes (zoom UI state). */
  onZoom: ((distance: number) => void) | null = null;

  constructor(opts: PlanetRendererOptions) {
    this.canvas = opts.canvas;
    this.body = opts.body;
    this.lon = opts.lon ?? 12;
    this.lat = opts.lat ?? 28;
    this.distance = opts.distance ?? 2.9;
    this.autoRotate = opts.autoRotate ?? false;
    this.reducedMotion = opts.reducedMotion ?? false;
    this.offsetX = opts.offsetX ?? 0;
    this.offsetTarget = this.offsetX;
    this.software = isSoftwareRenderer();
    if (this.software) this.renderScale = 0.4;

    this.renderer = new THREE.WebGPURenderer({
      canvas: opts.canvas,
      antialias: true,
      forceWebGL: opts.forceWebGL === true,
    });
    // A lost GPU device (driver reset, software adapter giving up) leaves a
    // black canvas; let the host rebuild on the WebGL2 backend.
    this.renderer.onDeviceLost = (info) => {
      if (!this.disposed) this.onDeviceLost?.(String(info?.message ?? 'device lost'));
    };
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    if (this.body === 'earth') {
      this.overlayCanvas = document.createElement('canvas');
      this.overlayCanvas.width = OVERLAY_W;
      this.overlayCanvas.height = OVERLAY_H;
      // WebGPU refuses to upload a canvas that never acquired a context.
      this.overlayCanvas.getContext('2d');
    }

    this.buildScene();
    if (opts.interactive !== false) this.attachInput();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Which GPU backend ended up being used ("webgpu" | "webgl2"). */
  backend: 'webgpu' | 'webgl2' = 'webgl2';

  async start(): Promise<void> {
    await this.renderer.init();
    if (this.disposed) return;
    const backend = this.renderer.backend as { isWebGPUBackend?: boolean };
    this.backend = backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
    this.ready = true;
    this.resize();
    if (this.software) this.onPerformance?.('low');
    this.lastTime = performance.now();
    void this.renderer.setAnimationLoop((t: number) => this.frame(t));
  }

  dispose(): void {
    this.disposed = true;
    void this.renderer.setAnimationLoop(null);
    this.detachInput();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
    this.renderer.dispose();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w === this.width && h === this.height && this.ready) {
      // Still fall through on first call so the buffer matches DPR.
    }
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * this.renderScale);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Shift the planet sideways (e.g. to clear a side panel) without
    // distorting it, by offsetting the projection window.
    this.applyOffset();
  }

  private applyOffset(): void {
    if (this.offsetX !== 0) {
      this.camera.setViewOffset(this.width, this.height, -this.offsetX * this.width, 0, this.width, this.height);
    } else {
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();
  }

  /** Slide the planet sideways (fraction of the viewport) to clear UI. */
  setOffsetX(value: number): void {
    this.offsetTarget = value;
    if (this.reducedMotion) {
      this.offsetX = value;
      this.applyOffset();
    }
  }

  // -------------------------------------------------------------------------
  // Scene
  // -------------------------------------------------------------------------

  private buildScene(): void {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(200, 48, 24),
      new THREE.MeshBasicMaterial({ map: makeStarTexture(), side: THREE.BackSide }),
    );
    sky.rotation.z = 0.4;
    this.scene.add(sky);

    const geometry = new THREE.SphereGeometry(1, 192, 96);
    const N = normalize(positionWorld);
    const V = normalize(cameraPosition.sub(positionWorld));
    const ndl = dot(N, this.sunDir);
    const fresnel = pow(float(1).sub(saturate(dot(N, V))), 3.2);

    const material = new THREE.MeshBasicNodeMaterial();

    if (this.body === 'earth') {
      const dayMap = loadTexture('/textures/earth_day.jpg');
      const nightMap = loadTexture('/textures/earth_night.jpg');
      const cloudMap = loadTexture('/textures/earth_clouds.jpg', false);
      const waterMap = loadTexture('/textures/earth_water.jpg', false);
      this.overlayTexture = new THREE.CanvasTexture(this.overlayCanvas!);
      this.overlayTexture.colorSpace = THREE.SRGBColorSpace;
      this.overlayTexture.anisotropy = 8;

      const dayAmt = smoothstep(-0.14, 0.24, ndl);
      const day = texture(dayMap, uv()).rgb;
      const night = texture(nightMap, uv()).rgb;
      const water = texture(waterMap, uv()).r;
      const cloudUv = uv().add(vec2(this.cloudShift, 0));
      // Sample the clouds slightly toward the sun for a cheap cast shadow.
      const cloudShadow = texture(cloudMap, cloudUv.add(vec2(0.0035, 0.0018))).r;

      const lit = day.mul(mix(float(0.0), float(1.18), dayAmt)).mul(
        float(1).sub(cloudShadow.mul(0.42).mul(dayAmt)),
      );
      // Moonlit base so continents stay readable on the night side.
      const moonlit = day.mul(vec3(0.03, 0.045, 0.1));
      const cityLights = pow(night, vec3(1.35))
        .mul(vec3(1.0, 0.74, 0.4))
        .mul(2.6)
        .mul(float(1).sub(dayAmt));
      // Warm band hugging the terminator.
      const twilight = smoothstep(-0.16, 0.04, ndl)
        .mul(float(1).sub(smoothstep(0.04, 0.32, ndl)))
        .mul(0.22);
      const glint = pow(saturate(dot(reflect(this.sunDir.negate(), N), V)), 48)
        .mul(water)
        .mul(0.55)
        .mul(dayAmt);
      const rim = vec3(0.28, 0.52, 1.0)
        .mul(fresnel)
        .mul(mix(float(0.1), float(0.85), dayAmt));

      const surface = lit
        .add(moonlit)
        .add(cityLights)
        .add(vec3(1.0, 0.42, 0.18).mul(twilight).mul(day.add(0.15)))
        .add(vec3(1.0, 0.93, 0.8).mul(glint))
        .add(rim);

      const overlay = texture(this.overlayTexture, uv());
      material.colorNode = vec4(mix(surface, overlay.rgb, overlay.a), 1);

      // Cloud deck.
      const cloudMat = new THREE.MeshBasicNodeMaterial();
      cloudMat.transparent = true;
      cloudMat.depthWrite = false;
      const cloudAlpha = texture(cloudMap, cloudUv).r;
      const cloudLight = mix(vec3(0.02, 0.03, 0.06), vec3(1, 1, 1), dayAmt).add(
        vec3(1.0, 0.5, 0.25).mul(twilight).mul(1.4),
      );
      cloudMat.colorNode = vec4(cloudLight, 1);
      cloudMat.opacityNode = smoothstep(0.18, 0.9, cloudAlpha).mul(0.72);
      this.clouds = new THREE.Mesh(new THREE.SphereGeometry(1.006, 128, 64), cloudMat);
      this.scene.add(this.clouds);
    } else {
      const map = loadTexture(this.body === 'moon' ? '/textures/moon.jpg' : '/textures/mars.jpg');
      const albedo = texture(map, uv()).rgb;
      const diffuse = smoothstep(-0.05, 0.6, ndl);
      const earthshine = this.body === 'moon' ? vec3(0.012, 0.016, 0.026) : vec3(0.03, 0.014, 0.01);
      const rimColor = this.body === 'mars' ? vec3(0.95, 0.5, 0.28) : vec3(0.4, 0.42, 0.5);
      const rim = rimColor.mul(fresnel).mul(this.body === 'mars' ? 0.5 : 0.08).mul(diffuse.add(0.1));
      material.colorNode = vec4(
        albedo.mul(diffuse.mul(1.25)).add(albedo.mul(earthshine).mul(4)).add(rim),
        1,
      );
    }

    this.scene.add(new THREE.Mesh(geometry, material));

    // Atmosphere shell (additive, back faces only).
    if (this.body !== 'moon') {
      const shellRadius = this.body === 'earth' ? 1.13 : 1.045;
      const edge = Math.sqrt(1 - 1 / (shellRadius * shellRadius));
      const atmo = new THREE.MeshBasicNodeMaterial();
      atmo.side = THREE.BackSide;
      atmo.transparent = true;
      atmo.depthWrite = false;
      atmo.blending = THREE.AdditiveBlending;
      const facing = saturate(dot(N, V).negate().div(edge));
      const glow = pow(facing, 2.6);
      const sunny = smoothstep(-0.55, 0.5, dot(N, this.sunDir));
      const tint = this.body === 'earth' ? vec3(0.3, 0.58, 1.0) : vec3(1.0, 0.52, 0.3);
      const strength = this.body === 'earth' ? 1.15 : 0.2;
      atmo.colorNode = vec4(tint.mul(glow).mul(mix(float(0.06), float(1), sunny)).mul(strength), 1);
      this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(shellRadius, 96, 48), atmo));
    }
  }

  // -------------------------------------------------------------------------
  // Overlay (political layer)
  // -------------------------------------------------------------------------

  /**
   * Redraw the equirectangular overlay. The callback receives a 2D context
   * sized `width × height` where x spans −180…180° and y spans 90…−90°.
   */
  drawOverlay(draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void): void {
    if (!this.overlayCanvas || !this.overlayTexture) return;
    const ctx = this.overlayCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, OVERLAY_W, OVERLAY_H);
    draw(ctx, OVERLAY_W, OVERLAY_H);
    this.overlayTexture.needsUpdate = true;
  }

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------

  getView(): { lon: number; lat: number; distance: number } {
    return { lon: this.lon, lat: this.lat, distance: this.distance };
  }

  flyTo(lon: number, lat: number, distance?: number, duration = 900): void {
    const toDist = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, distance ?? this.distance));
    if (this.reducedMotion || duration <= 0) {
      this.lon = lon;
      this.lat = Math.max(-80, Math.min(80, lat));
      this.setDistance(toDist);
      this.tween = null;
      return;
    }
    // Take the short way around the antimeridian.
    let delta = ((lon - this.lon + 540) % 360) - 180;
    if (Number.isNaN(delta)) delta = 0;
    this.velLon = 0;
    this.velLat = 0;
    this.tween = {
      fromLon: this.lon, fromLat: this.lat, fromDist: this.distance,
      toLon: this.lon + delta, toLat: Math.max(-80, Math.min(80, lat)), toDist,
      start: performance.now(), duration,
    };
  }

  zoomBy(factor: number): void {
    this.flyTo(this.lon, this.lat, this.distance * factor, 350);
  }

  private setDistance(d: number): void {
    const next = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, d));
    if (next !== this.distance) {
      this.distance = next;
      this.onZoom?.(next);
    }
  }

  private updateCamera(): void {
    const pos = lonLatToVector(this.lon, this.lat, this.distance);
    this.camera.position.copy(pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
  }

  /** Project a geographic point to canvas CSS pixels. */
  project(lon: number, lat: number, altitude = 1): ScreenPoint {
    const p = lonLatToVector(lon, lat, altitude);
    // Visible when the camera is above the point's tangent plane.
    const facing = p.dot(this.camera.position) / altitude;
    const v = p.clone().project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.width,
      y: (-v.y * 0.5 + 0.5) * this.height,
      visible: facing > 1.0 + 0.02 * this.distance,
      depth: facing,
    };
  }

  /** Geographic coordinate under a canvas-relative CSS pixel, if any. */
  pickAt(x: number, y: number): { lon: number; lat: number } | null {
    const ndc = new THREE.Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), 1), new THREE.Vector3());
    return hit ? vectorToLonLat(hit) : null;
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  private frame(now: number): void {
    if (this.disposed || !this.ready) return;
    // On a CPU renderer every frame is expensive: draw one in three so the
    // page stays responsive to input.
    this.frameCounter += 1;
    if (this.software && this.frameCounter % 3 !== 0) return;
    const elapsed = Math.max(0, now - this.lastTime);
    const dt = Math.min(0.05, elapsed / 1000);
    this.lastTime = now;
    this.adaptResolution(elapsed);

    if (this.tween) {
      const t = Math.min(1, (now - this.tween.start) / this.tween.duration);
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      this.lon = this.tween.fromLon + (this.tween.toLon - this.tween.fromLon) * e;
      this.lat = this.tween.fromLat + (this.tween.toLat - this.tween.fromLat) * e;
      this.setDistance(this.tween.fromDist + (this.tween.toDist - this.tween.fromDist) * e);
      if (t >= 1) this.tween = null;
    } else if (!this.dragging) {
      // Inertia after a drag.
      if (Math.abs(this.velLon) > 0.01 || Math.abs(this.velLat) > 0.01) {
        this.lon += this.velLon * dt;
        this.lat = Math.max(-80, Math.min(80, this.lat + this.velLat * dt));
        const damp = Math.exp(-4.5 * dt);
        this.velLon *= damp;
        this.velLat *= damp;
      } else if (this.autoRotate && !this.reducedMotion && now - this.lastInteraction > 2500) {
        this.lon += 2.2 * dt;
      }
    }
    this.lon = ((this.lon + 540) % 360) - 180;

    if (!this.reducedMotion) {
      this.sunLon -= this.sunSpeed * dt;
      this.cloudShift.value = (this.cloudShift.value + dt * 0.0006) % 1;
    }
    this.sunDir.value.copy(lonLatToVector(this.sunLon, this.sunLat));

    if (Math.abs(this.offsetTarget - this.offsetX) > 0.0005) {
      this.offsetX += (this.offsetTarget - this.offsetX) * Math.min(1, dt * 6);
      this.applyOffset();
    }

    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
  }

  /**
   * Keep the frame rate playable on weak GPUs and software renderers: when
   * frames stay slow the drawing buffer shrinks (the CSS size is unchanged),
   * and it grows back when there is headroom again.
   */
  private adaptResolution(elapsedMs: number): void {
    // Ignore the long gaps of a backgrounded tab.
    if (elapsedMs > 1000) return;
    this.frameEma += (elapsedMs - this.frameEma) * 0.1;
    this.framesSinceScale += 1;
    if (this.framesSinceScale < 24) return;
    let next = this.renderScale;
    if (this.software) return;
    if (this.frameEma > 34 && this.renderScale > 0.3) next = Math.max(0.3, this.renderScale * 0.72);
    else if (this.frameEma < 13 && this.renderScale < 1) next = Math.min(1, this.renderScale * 1.2);
    if (next === this.renderScale) return;
    const wasLow = this.renderScale <= 0.55;
    this.renderScale = next;
    this.framesSinceScale = 0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * next);
    this.renderer.setSize(this.width, this.height, false);
    const isLow = next <= 0.55;
    if (isLow !== wasLow) this.onPerformance?.(isLow ? 'low' : 'high');
  }

  /** Place the sub-solar point explicitly (used to light a focused region). */
  setSun(lon: number, lat = 12): void {
    this.sunLon = lon;
    this.sunLat = lat;
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private readonly handlePointerDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.lastInteraction = performance.now();
    this.tween = null;
    if (this.pointers.size === 1) {
      this.dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
      this.velLon = 0;
      this.velLat = 0;
    } else if (this.pointers.size === 2) {
      const [a, b] = Array.from(this.pointers.values());
      this.pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y) };
      this.dragging = null;
    }
  };

  private readonly handlePointerMove = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = Array.from(this.pointers.values());
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (d > 0) this.setDistance(1 + (this.distance - 1) * (this.pinch.d / d));
      this.pinch.d = d;
      return;
    }
    if (this.dragging && this.dragging.id === e.pointerId) {
      const dx = e.clientX - this.dragging.x;
      const dy = e.clientY - this.dragging.y;
      this.dragging.x = e.clientX;
      this.dragging.y = e.clientY;
      this.dragging.moved += Math.abs(dx) + Math.abs(dy);
      // Degrees per pixel shrink as the camera approaches the surface so the
      // ground tracks the cursor at every zoom level.
      const k = (this.distance - 1) * 62 / Math.max(240, this.height);
      const dLon = -dx * k;
      const dLat = dy * k;
      this.lon += dLon;
      this.lat = Math.max(-80, Math.min(80, this.lat + dLat));
      this.velLon = dLon * 60;
      this.velLat = dLat * 60;
      this.lastInteraction = performance.now();
      return;
    }
    if (this.onHover) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.onHover(this.pickAt(x, y), x, y);
    }
  };

  private readonly handlePointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    const drag = this.dragging;
    if (drag && drag.id === e.pointerId) {
      this.dragging = null;
      if (drag.moved < 5) {
        this.velLon = 0;
        this.velLat = 0;
        const rect = this.canvas.getBoundingClientRect();
        const hit = this.pickAt(e.clientX - rect.left, e.clientY - rect.top);
        if (hit) this.onPick?.(hit.lon, hit.lat);
      }
    }
  };

  private readonly handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.tween = null;
    this.lastInteraction = performance.now();
    this.setDistance(1 + (this.distance - 1) * Math.exp(e.deltaY * 0.0012));
  };

  private readonly handleLeave = (): void => {
    this.onHover?.(null, 0, 0);
  };

  private attachInput(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', this.handlePointerDown);
    c.addEventListener('pointermove', this.handlePointerMove);
    c.addEventListener('pointerup', this.handlePointerUp);
    c.addEventListener('pointercancel', this.handlePointerUp);
    c.addEventListener('pointerleave', this.handleLeave);
    c.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  private detachInput(): void {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.handlePointerDown);
    c.removeEventListener('pointermove', this.handlePointerMove);
    c.removeEventListener('pointerup', this.handlePointerUp);
    c.removeEventListener('pointercancel', this.handlePointerUp);
    c.removeEventListener('pointerleave', this.handleLeave);
    c.removeEventListener('wheel', this.handleWheel);
  }

  /** Keyboard camera nudge (degrees). */
  nudge(dLon: number, dLat: number): void {
    this.flyTo(this.lon + dLon, this.lat + dLat, this.distance, 220);
  }
}

/**
 * True when a hardware WebGPU adapter is available. Software adapters
 * (SwiftShader, WARP) are slower than WebGL2 and prone to device loss, so
 * they are treated as "no WebGPU".
 */
export async function hasHardwareWebGPU(): Promise<boolean> {
  type Adapter = {
    isFallbackAdapter?: boolean;
    info?: { vendor?: string; architecture?: string; description?: string };
  };
  const gpu = (navigator as unknown as {
    gpu?: { requestAdapter: () => Promise<Adapter | null> };
  }).gpu;
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter || adapter.isFallbackAdapter) return false;
    const label = `${adapter.info?.vendor ?? ''} ${adapter.info?.architecture ?? ''} ${adapter.info?.description ?? ''}`;
    return !/swiftshader|llvmpipe|warp|software/i.test(label);
  } catch {
    return false;
  }
}

let softwareCache: boolean | null = null;

/**
 * True when WebGL is drawn on the CPU (SwiftShader, llvmpipe, WARP…): no GPU,
 * a remote desktop, or an automated browser. The planet then starts in its
 * cheapest configuration instead of discovering it one slow frame at a time.
 */
export function isSoftwareRenderer(): boolean {
  if (softwareCache !== null) return softwareCache;
  softwareCache = false;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && info) {
      const name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
      softwareCache = /swiftshader|llvmpipe|softpipe|warp|software/i.test(name);
    }
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    softwareCache = false;
  }
  return softwareCache;
}

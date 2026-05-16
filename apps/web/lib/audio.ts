// Browser-side audio manager. Singleton built on top of the HTML5 Audio API.
//
// Goals:
//  - Lazy-load files only when first played (no <link rel=preload> spam).
//  - Survive missing/404 assets without crashing the app. Each missing file
//    is logged exactly once, then play()/playLoop() become no-ops for that id.
//  - Two volume categories: "music" and "sfx". Per-category mute. Per-clip
//    base volume from the manifest is multiplied by the category volume.
//  - No external deps; no Web Audio API yet (kept simple). Designed so a
//    future Web Audio implementation can replace it behind the same surface.
//
// Not concerned with: licensing, preloading strategies, fading, ducking — all
// of those land in a later wave once real assets exist.

export type AudioCategory = 'music' | 'sfx';

export type AudioManifestEntry = {
  /** URL relative to /public, e.g. `/audio/sfx/click.mp3`. */
  src: string;
  /** Per-clip base volume 0..1. Multiplied by the category volume at play time. */
  volume?: number;
  /** Whether the clip should loop by default (manifest hint — caller can override). */
  loop?: boolean;
};

export type AudioManifest = Record<string, AudioManifestEntry>;

export type PlayOptions = {
  /** Override the manifest base volume for this single play. 0..1. */
  volume?: number;
  /** Override loop behaviour for this play. */
  loop?: boolean;
};

export type CategoryVolumes = Record<AudioCategory, number>;
export type CategoryMutes = Record<AudioCategory, boolean>;

/**
 * Default per-category volume. Used until the persisted user preference is
 * loaded. Music is intentionally lower than SFX — a UI click should always
 * cut through the underscore.
 */
export const DEFAULT_VOLUMES: CategoryVolumes = {
  music: 0.5,
  sfx: 0.7,
};

const DEFAULT_MUTES: CategoryMutes = {
  music: false,
  sfx: false,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Categorise an id by its `music.*` / `sfx.*` prefix. Anything that doesn't
 * carry an explicit prefix is treated as SFX so accidental ids don't compete
 * with the music bus for the master gain.
 */
function categoryForId(id: string): AudioCategory {
  return id.startsWith('music.') ? 'music' : 'sfx';
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

type CachedSound = {
  /** The actual <audio> instance — null while loading or after a hard failure. */
  audio: HTMLAudioElement | null;
  /** True when we've confirmed the file is missing / errored. Subsequent plays no-op. */
  failed: boolean;
};

export class AudioManager {
  private manifest: AudioManifest = {};
  private cache: Map<string, CachedSound> = new Map();
  private volumes: CategoryVolumes = { ...DEFAULT_VOLUMES };
  private mutes: CategoryMutes = { ...DEFAULT_MUTES };
  private warned: Set<string> = new Set();
  /** Tracks which loop-ids are currently meant to be playing, by element id. */
  private looping: Set<string> = new Set();

  // -------------------------------------------------------------------------
  // Manifest registration
  // -------------------------------------------------------------------------

  /** Replace the registered manifest. Existing cache entries are preserved. */
  registerManifest(manifest: AudioManifest): void {
    this.manifest = { ...manifest };
  }

  /** Register a single entry (or override an existing one). */
  register(id: string, entry: AudioManifestEntry): void {
    this.manifest[id] = entry;
  }

  hasEntry(id: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.manifest, id);
  }

  // -------------------------------------------------------------------------
  // Volume / mute
  // -------------------------------------------------------------------------

  setVolume(category: AudioCategory, value: number): void {
    this.volumes[category] = clamp01(value);
    this.applyVolumeToCachedAudio(category);
  }

  getVolume(category: AudioCategory): number {
    return this.volumes[category];
  }

  setVolumes(values: Partial<CategoryVolumes>): void {
    if (typeof values.music === 'number') this.setVolume('music', values.music);
    if (typeof values.sfx === 'number') this.setVolume('sfx', values.sfx);
  }

  getVolumes(): CategoryVolumes {
    return { ...this.volumes };
  }

  mute(category: AudioCategory): void {
    this.mutes[category] = true;
    // Stop anything currently audible in that category.
    for (const [id, entry] of this.cache.entries()) {
      if (categoryForId(id) !== category) continue;
      const audio = entry.audio;
      if (audio && !audio.paused) {
        audio.pause();
      }
    }
  }

  unmute(category: AudioCategory): void {
    this.mutes[category] = false;
    // Re-arm any loops that were paused by mute.
    for (const id of this.looping) {
      if (categoryForId(id) !== category) continue;
      this.playLoop(id);
    }
  }

  setMuted(category: AudioCategory, muted: boolean): void {
    if (muted) this.mute(category);
    else this.unmute(category);
  }

  isMuted(category: AudioCategory): boolean {
    return this.mutes[category];
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  /**
   * Eagerly load a clip into the cache. Called automatically by `play()` /
   * `playLoop()` on first use; exposed so callers can prefetch ahead of a
   * predictable trigger (e.g. after entering the gameplay screen).
   */
  load(id: string, url?: string): void {
    if (typeof window === 'undefined') return;
    if (this.cache.has(id)) return;
    const entry = this.manifest[id];
    const src = url ?? entry?.src;
    if (!src) {
      this.warnOnce(id, `[audio] No manifest entry for "${id}"`);
      this.cache.set(id, { audio: null, failed: true });
      return;
    }
    try {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.addEventListener('error', () => {
        this.warnOnce(id, `[audio] Failed to load "${id}" (${src})`);
        const cached = this.cache.get(id);
        if (cached) cached.failed = true;
      });
      this.cache.set(id, { audio, failed: false });
    } catch (err) {
      this.warnOnce(id, `[audio] Audio() ctor threw for "${id}": ${String(err)}`);
      this.cache.set(id, { audio: null, failed: true });
    }
  }

  // -------------------------------------------------------------------------
  // Playback
  // -------------------------------------------------------------------------

  /**
   * Fire-and-forget one-shot. Returns silently if the file is missing, the
   * category is muted, or audio isn't supported in this environment.
   */
  play(id: string, opts?: PlayOptions): void {
    if (typeof window === 'undefined') return;
    const category = categoryForId(id);
    if (this.mutes[category]) return;

    this.load(id);
    const cached = this.cache.get(id);
    if (!cached || cached.failed || !cached.audio) return;

    const entry = this.manifest[id];
    const baseVolume = opts?.volume ?? entry?.volume ?? 1;
    const finalVolume = clamp01(baseVolume) * this.volumes[category];
    const loop = opts?.loop ?? entry?.loop ?? false;

    const audio = cached.audio;
    audio.loop = loop;
    audio.volume = finalVolume;
    try {
      // Reset playback head so rapid-fire SFX aren't swallowed mid-play.
      // Music loops shouldn't be restarted by accident — guard with `loop`.
      if (!loop) {
        audio.currentTime = 0;
      }
      const result = audio.play();
      if (result && typeof result.catch === 'function') {
        result.catch((err: unknown) => {
          // Browsers reject play() before user-gesture; that's expected, not a bug.
          if (isAutoplayBlockedError(err)) return;
          this.warnOnce(`play:${id}`, `[audio] play("${id}") rejected: ${String(err)}`);
        });
      }
    } catch (err) {
      this.warnOnce(`play:${id}`, `[audio] play("${id}") threw: ${String(err)}`);
    }
  }

  /**
   * Convenience for music beds. Sets `loop = true` and remembers the id so
   * un-muting can resume it. Idempotent: calling twice with the same id while
   * already playing leaves the bed running.
   */
  playLoop(id: string, opts?: PlayOptions): void {
    this.looping.add(id);
    const cached = this.cache.get(id);
    // Don't restart an already-playing loop on subsequent calls.
    if (cached?.audio && !cached.audio.paused && cached.audio.loop) {
      return;
    }
    this.play(id, { ...opts, loop: true });
  }

  /** Pause and rewind a clip. Removes it from the loop tracker. */
  stop(id: string): void {
    this.looping.delete(id);
    const cached = this.cache.get(id);
    const audio = cached?.audio;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // Some browsers throw when seeking on a not-yet-loaded clip; swallow.
    }
  }

  /** Stop every currently-playing clip in the given category (or all). */
  stopAll(category?: AudioCategory): void {
    for (const [id] of this.cache.entries()) {
      if (category && categoryForId(id) !== category) continue;
      this.stop(id);
    }
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private applyVolumeToCachedAudio(category: AudioCategory): void {
    for (const [id, entry] of this.cache.entries()) {
      if (categoryForId(id) !== category) continue;
      const audio = entry.audio;
      if (!audio) continue;
      const manifestEntry = this.manifest[id];
      const baseVolume = manifestEntry?.volume ?? 1;
      audio.volume = clamp01(baseVolume) * this.volumes[category];
    }
  }

  private warnOnce(key: string, message: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    // Devs want to see each unique audio issue exactly once. In production
    // the warning is pure noise — the runtime already no-ops the failed
    // clip via `cached.failed`, so swallowing it keeps consoles clean.
    if (process.env.NODE_ENV === 'production') return;
    console.warn(message);
  }
}

function isAutoplayBlockedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: unknown }).name;
  return name === 'NotAllowedError' || name === 'AbortError';
}

// ---------------------------------------------------------------------------
// Singleton accessor
// ---------------------------------------------------------------------------

let _manager: AudioManager | null = null;

/**
 * Lazily construct the singleton manager. Safe to call from SSR — the
 * manager itself just won't load anything until methods that touch
 * `window.Audio` are called.
 */
export function getAudioManager(): AudioManager {
  if (!_manager) {
    _manager = new AudioManager();
  }
  return _manager;
}

/**
 * Fetch the manifest from `/audio/manifest.json` and register it on the
 * singleton. Returns the parsed manifest (or an empty object on failure).
 * Failures are logged once and treated as "no manifest declared" — the rest
 * of the app keeps working, just without sound.
 */
export async function loadManifest(
  url = '/audio/manifest.json',
): Promise<AudioManifest> {
  if (typeof window === 'undefined') return {};
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) {
      console.warn(`[audio] Manifest fetch returned ${res.status} for ${url}`);
      return {};
    }
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== 'object') {
      console.warn('[audio] Manifest is not an object');
      return {};
    }
    const manifest: AudioManifest = {};
    for (const [id, raw] of Object.entries(json as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as Record<string, unknown>;
      if (typeof entry.src !== 'string') continue;
      const out: AudioManifestEntry = { src: entry.src };
      if (typeof entry.volume === 'number') out.volume = entry.volume;
      if (typeof entry.loop === 'boolean') out.loop = entry.loop;
      manifest[id] = out;
    }
    getAudioManager().registerManifest(manifest);
    return manifest;
  } catch (err) {
    console.warn(`[audio] Manifest load failed: ${String(err)}`);
    return {};
  }
}

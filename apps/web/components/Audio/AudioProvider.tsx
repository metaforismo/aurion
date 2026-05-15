// React glue for the audio manager. Exposes a `useAudio()` hook that returns
// the singleton AudioManager (typed) plus reactive volume / mute state so HUD
// controls can render without poking the manager directly.
//
// Mounted on the play page (the only screen that actually triggers sound
// today). Loading the manifest, hydrating volumes from IndexedDB, and pushing
// volume changes back to disk all happen here on mount — not in the manager
// itself, which stays framework-agnostic.

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  AudioManager,
  DEFAULT_VOLUMES,
  getAudioManager,
  loadManifest,
  type AudioCategory,
  type CategoryMutes,
  type CategoryVolumes,
} from '../../lib/audio';
import {
  DEFAULT_AUDIO_VOLUMES,
  getAudioVolumes,
  setAudioVolumes,
  type AudioVolumePrefs,
} from '../../lib/persistence';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export type AudioContextValue = {
  /** Underlying singleton — useful for callers that need fine-grained control. */
  manager: AudioManager;
  /** Reactive snapshot of the per-category volumes (0..1). */
  volumes: CategoryVolumes;
  /** Reactive snapshot of the per-category mute state. */
  mutes: CategoryMutes;
  /** True until the persisted volumes have been hydrated from IndexedDB. */
  hydrating: boolean;
  /** Update one category's volume and persist the change (debounced). */
  setCategoryVolume: (category: AudioCategory, value: number) => void;
  /** Toggle mute on a category and persist the change (debounced). */
  setCategoryMuted: (category: AudioCategory, muted: boolean) => void;
};

const AudioContext = createContext<AudioContextValue | null>(null);

// Persist debounce window — tight enough that the slider feels responsive,
// loose enough that dragging doesn't write a hundred IndexedDB transactions.
const PERSIST_DEBOUNCE_MS = 200;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export type AudioProviderProps = {
  children: ReactNode;
};

export function AudioProvider({ children }: AudioProviderProps) {
  const manager = useMemo(() => getAudioManager(), []);
  const [volumes, setVolumesState] = useState<CategoryVolumes>(() => ({
    ...DEFAULT_VOLUMES,
  }));
  const [mutes, setMutesState] = useState<CategoryMutes>(() => ({
    music: false,
    sfx: false,
  }));
  const [hydrating, setHydrating] = useState(true);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPrefsRef = useRef<AudioVolumePrefs>({ ...DEFAULT_AUDIO_VOLUMES });

  // -------------------------------------------------------------------------
  // Bootstrap: load manifest + hydrate user prefs.
  //
  // We fire both in parallel because they're independent; the manifest fetch
  // is plain HTTP and the prefs fetch is IndexedDB. Either may fail silently
  // (no real audio shipped yet, no IndexedDB in private mode) and the rest
  // of the system keeps working with defaults.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([loadManifest(), getAudioVolumes()]).then(
      (results) => {
        if (cancelled) return;
        const prefsResult = results[1];
        const prefs =
          prefsResult.status === 'fulfilled'
            ? prefsResult.value
            : { ...DEFAULT_AUDIO_VOLUMES };
        latestPrefsRef.current = prefs;
        manager.setVolume('music', prefs.music);
        manager.setVolume('sfx', prefs.sfx);
        manager.setMuted('music', prefs.mutedMusic === true);
        manager.setMuted('sfx', prefs.mutedSfx === true);
        setVolumesState({ music: prefs.music, sfx: prefs.sfx });
        setMutesState({
          music: prefs.mutedMusic === true,
          sfx: prefs.mutedSfx === true,
        });
        setHydrating(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [manager]);

  // -------------------------------------------------------------------------
  // Cleanup: stop everything when the provider unmounts. This matters on
  // route changes — without it, music keeps playing after the user goes back
  // to the home screen.
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      manager.stopAll();
      if (persistTimerRef.current !== null) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [manager]);

  // -------------------------------------------------------------------------
  // Persist queue. Coalesces rapid changes (slider dragging, mute spam) into
  // a single write.
  // -------------------------------------------------------------------------
  const schedulePersist = useCallback(() => {
    if (persistTimerRef.current !== null) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      void setAudioVolumes(latestPrefsRef.current).catch((err) => {
        console.warn('[audio] Failed to persist volumes', err);
      });
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  const setCategoryVolume = useCallback(
    (category: AudioCategory, value: number) => {
      const clamped = Math.max(0, Math.min(1, value));
      manager.setVolume(category, clamped);
      setVolumesState((prev) => {
        if (prev[category] === clamped) return prev;
        return { ...prev, [category]: clamped };
      });
      latestPrefsRef.current = {
        ...latestPrefsRef.current,
        [category]: clamped,
      };
      schedulePersist();
    },
    [manager, schedulePersist],
  );

  const setCategoryMuted = useCallback(
    (category: AudioCategory, muted: boolean) => {
      manager.setMuted(category, muted);
      setMutesState((prev) => {
        if (prev[category] === muted) return prev;
        return { ...prev, [category]: muted };
      });
      const flagKey: keyof AudioVolumePrefs =
        category === 'music' ? 'mutedMusic' : 'mutedSfx';
      latestPrefsRef.current = {
        ...latestPrefsRef.current,
        [flagKey]: muted,
      };
      schedulePersist();
    },
    [manager, schedulePersist],
  );

  const value = useMemo<AudioContextValue>(
    () => ({
      manager,
      volumes,
      mutes,
      hydrating,
      setCategoryVolume,
      setCategoryMuted,
    }),
    [manager, volumes, mutes, hydrating, setCategoryVolume, setCategoryMuted],
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Read the audio context. Throws when called outside an `<AudioProvider>` —
 * intentional, since silently no-oping would mask bugs in the wiring.
 */
export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) {
    throw new Error('useAudio() must be called inside an <AudioProvider>');
  }
  return ctx;
}

/**
 * Soft variant of `useAudio()` that returns `null` outside a provider. Useful
 * for components that may render in environments where audio isn't mounted
 * (Storybook, isolated tests) and should still work without crashing.
 */
export function useAudioOptional(): AudioContextValue | null {
  return useContext(AudioContext);
}

export default AudioProvider;

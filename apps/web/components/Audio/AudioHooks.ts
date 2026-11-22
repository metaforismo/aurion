// Declarative audio hooks. Each one subscribes to a specific store slice and
// pokes the audio manager when the relevant transition happens. They are
// designed to be safe to mount unconditionally — if no <AudioProvider> is in
// scope, they no-op silently.
//
// All hooks here are intentionally side-effect-only (no return value). Drop
// them into a component that lives for the duration you want the behaviour
// active.

'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { AudioId, MusicId, PlayOptions } from '../../lib/audio';

import { useGameStore } from '../../lib/store';

import { useAudioOptional } from './AudioProvider';

// ---------------------------------------------------------------------------
// useSfx — the one-liner for components that just want to make a noise:
//
//   const sfx = useSfx();
//   <button onClick={() => { sfx('sfx.click'); ... }} onPointerEnter={() => sfx('sfx.hover')} />
//
// Safe outside an <AudioProvider> (no-op). The returned function is stable.
// Mutes, per-id throttling and missing files are all handled by the manager.
// ---------------------------------------------------------------------------

export function useSfx(): (id: AudioId, opts?: PlayOptions) => void {
  const audio = useAudioOptional();
  const manager = audio?.manager ?? null;
  return useCallback(
    (id: AudioId, opts?: PlayOptions) => {
      manager?.play(id, opts);
    },
    [manager],
  );
}

// ---------------------------------------------------------------------------
// useMusic — declaratively select the music bed for as long as the calling
// component is mounted. Changing `id` crossfades; `null` fades to silence.
// On unmount the bed fades out (only if it is still the selected one).
//
// Don't combine with useGameplayMusic() in the same tree — pass that hook an
// `override` instead (e.g. 'music.space' while the orbit view is open).
// ---------------------------------------------------------------------------

export function useMusic(id: MusicId | null, options: { fadeMs?: number } = {}): void {
  const audio = useAudioOptional();
  const manager = audio?.manager ?? null;
  const fadeMs = options.fadeMs;

  useEffect(() => {
    if (!manager) return;
    if (id) manager.playMusic(id, { fadeMs });
    else manager.stopMusic({ fadeMs });
  }, [manager, id, fadeMs]);

  useEffect(() => {
    if (!manager) return;
    return () => {
      manager.stopMusic({ fadeMs: 600 });
    };
  }, [manager]);
}

// ---------------------------------------------------------------------------
// Tick SFX — subtle clock-tock per N game ticks. Off by default; pass
// `enabled: true` to opt in. Set `everyNTicks` to throttle (1 = every tick).
// ---------------------------------------------------------------------------

export type UseTickSfxOptions = {
  /** Toggle the entire hook — default false because every-tick clicking is annoying. */
  enabled?: boolean;
  /** Play one click per N ticks. Defaults to 4 so 1× speed gives a calm pulse. */
  everyNTicks?: number;
};

export function useTickSfx(options: UseTickSfxOptions = {}): void {
  const audio = useAudioOptional();
  const tick = useGameStore((s) => s.state?.tick ?? 0);
  const enabled = options.enabled === true;
  const everyNTicks = Math.max(1, options.everyNTicks ?? 4);
  const lastTickRef = useRef<number>(tick);

  useEffect(() => {
    if (!enabled || !audio) {
      lastTickRef.current = tick;
      return;
    }
    const previous = lastTickRef.current;
    lastTickRef.current = tick;
    if (tick === previous) return;
    if (tick <= 0) return;
    if (tick % everyNTicks !== 0) return;
    audio.manager.play('sfx.tick');
  }, [audio, enabled, everyNTicks, tick]);
}

// ---------------------------------------------------------------------------
// Event modal SFX — fires a notification sting every time a fresh narrative
// event appears on screen. We key the effect on the tick at which the event
// fired so resolving an event doesn't replay the sting.
// ---------------------------------------------------------------------------

export function useEventModalSfx(): void {
  const audio = useAudioOptional();
  const events = useGameStore((s) => s.state?.events ?? null);
  const lastFiredRef = useRef<number | null>(null);

  useEffect(() => {
    if (!audio || !events || events.length === 0) {
      lastFiredRef.current = null;
      return;
    }
    const last = events[events.length - 1];
    if (!last || last.resolvedChoiceIndex !== null) return;
    if (lastFiredRef.current === last.firedAtTick) return;
    lastFiredRef.current = last.firedAtTick;
    audio.manager.play('sfx.event');
  }, [audio, events]);
}

// ---------------------------------------------------------------------------
// Notification SFX — plays a short ping when the events ring buffer grows.
// Distinct from the event-modal sting: this fires for every new entry, even
// already-resolved ones (in case the engine pushes a resolved-on-fire event
// later — e.g. an AI-only happening reported to the player).
// ---------------------------------------------------------------------------

export function useNotificationSfx(): void {
  const audio = useAudioOptional();
  const eventCount = useGameStore((s) => s.state?.events.length ?? 0);
  const lastCountRef = useRef<number>(eventCount);

  useEffect(() => {
    if (!audio) {
      lastCountRef.current = eventCount;
      return;
    }
    const previous = lastCountRef.current;
    lastCountRef.current = eventCount;
    if (eventCount > previous && previous >= 0) {
      audio.manager.play('sfx.notification');
    }
  }, [audio, eventCount]);
}

// ---------------------------------------------------------------------------
// Gameplay music — long-running bed selector.
//
// State machine:
//   override set (e.g. 'music.space')        → that bed
//   playing + tension <= TENSION_THRESHOLD  → music.gameplay
//   playing + tension > TENSION_THRESHOLD   → music.tension
//   won                                      → sfx.victory sting, then music.victory
//   lost                                     → sfx.defeat  (one-shot, music fades out)
//
// Beds crossfade through `manager.playMusic()`, so they never hard-cut. The
// threshold matches the spec ("worldTension > 70").
// ---------------------------------------------------------------------------

const TENSION_THRESHOLD = 70;
/** Hysteresis so a tension value hovering around the threshold doesn't flap. */
const TENSION_RELEASE = 62;

type MusicTrack = MusicId | null;

export type UseGameplayMusicOptions = {
  /**
   * Bed to play instead of the tension-driven choice while the run is still
   * `playing` — e.g. `'music.space'` while the orbit / Moon / Mars view is
   * open. `null` / omitted = automatic.
   */
  override?: MusicId | null;
};

export function useGameplayMusic(options: UseGameplayMusicOptions = {}): void {
  const audio = useAudioOptional();
  const manager = audio?.manager ?? null;
  const override = options.override ?? null;
  const winLoss = useGameStore((s) => s.state?.winLoss);
  const tension = useGameStore((s) => s.state?.worldTension ?? 0);
  const currentTrackRef = useRef<MusicTrack>(null);
  const tenseRef = useRef(false);
  const endStingFiredRef = useRef<'won' | 'lost' | null>(null);

  useEffect(() => {
    if (!manager) return;

    // End-of-game stings: fire exactly once when the run resolves.
    if (winLoss === 'won') {
      if (endStingFiredRef.current !== 'won') {
        endStingFiredRef.current = 'won';
        manager.play('sfx.victory');
        // The victory bed swells in underneath the fanfare.
        manager.playMusic('music.victory', { fadeMs: 4000 });
        currentTrackRef.current = 'music.victory';
      }
      return;
    }
    if (winLoss === 'lost') {
      if (endStingFiredRef.current !== 'lost') {
        endStingFiredRef.current = 'lost';
        manager.stopMusic({ fadeMs: 1200 });
        currentTrackRef.current = null;
        manager.play('sfx.defeat');
      }
      return;
    }
    // Reset the latch when the game flips back to playing (shouldn't happen
    // mid-run, but keeps the hook composable with future restart flows).
    endStingFiredRef.current = null;

    let desired: MusicTrack = null;
    if (winLoss === 'playing') {
      if (tension > TENSION_THRESHOLD) tenseRef.current = true;
      else if (tension < TENSION_RELEASE) tenseRef.current = false;
      desired = override ?? (tenseRef.current ? 'music.tension' : 'music.gameplay');
    }
    if (desired === currentTrackRef.current) return;

    if (desired) manager.playMusic(desired);
    else manager.stopMusic();
    currentTrackRef.current = desired;
  }, [manager, winLoss, tension, override]);

  // Stop the music when the consumer unmounts (route change, etc.).
  useEffect(() => {
    if (!manager) return;
    return () => {
      if (currentTrackRef.current) {
        manager.stop(currentTrackRef.current);
        currentTrackRef.current = null;
      }
    };
  }, [manager]);
}

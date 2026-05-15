// Declarative audio hooks. Each one subscribes to a specific store slice and
// pokes the audio manager when the relevant transition happens. They are
// designed to be safe to mount unconditionally — if no <AudioProvider> is in
// scope, they no-op silently.
//
// All hooks here are intentionally side-effect-only (no return value). Drop
// them into a component that lives for the duration you want the behaviour
// active.

'use client';

import { useEffect, useRef } from 'react';

import { useGameStore } from '../../lib/store';

import { useAudioOptional } from './AudioProvider';

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
//   playing + tension <= TENSION_THRESHOLD  → music.gameplay
//   playing + tension > TENSION_THRESHOLD   → music.tension
//   won                                      → sfx.victory (one-shot, music stops)
//   lost                                     → sfx.defeat  (one-shot, music stops)
//
// We stop the previous bed before starting the next one so the two never
// overlap. The threshold matches the spec ("worldTension > 70").
// ---------------------------------------------------------------------------

const TENSION_THRESHOLD = 70;

type MusicTrack = 'music.gameplay' | 'music.tension' | null;

function pickTrack(
  winLoss: 'playing' | 'won' | 'lost' | undefined,
  tension: number,
): MusicTrack {
  if (winLoss !== 'playing') return null;
  return tension > TENSION_THRESHOLD ? 'music.tension' : 'music.gameplay';
}

export function useGameplayMusic(): void {
  const audio = useAudioOptional();
  const winLoss = useGameStore((s) => s.state?.winLoss);
  const tension = useGameStore((s) => s.state?.worldTension ?? 0);
  const currentTrackRef = useRef<MusicTrack>(null);
  const endStingFiredRef = useRef<'won' | 'lost' | null>(null);

  useEffect(() => {
    if (!audio) return;

    // End-of-game stings: fire exactly once when the run resolves.
    if (winLoss === 'won' && endStingFiredRef.current !== 'won') {
      endStingFiredRef.current = 'won';
      audio.manager.stopAll('music');
      currentTrackRef.current = null;
      audio.manager.play('sfx.victory');
      return;
    }
    if (winLoss === 'lost' && endStingFiredRef.current !== 'lost') {
      endStingFiredRef.current = 'lost';
      audio.manager.stopAll('music');
      currentTrackRef.current = null;
      audio.manager.play('sfx.defeat');
      return;
    }
    // Reset the latch when the game flips back to playing (shouldn't happen
    // mid-run, but keeps the hook composable with future restart flows).
    if (winLoss === 'playing') {
      endStingFiredRef.current = null;
    }

    const desired = pickTrack(winLoss, tension);
    if (desired === currentTrackRef.current) return;

    if (currentTrackRef.current) {
      audio.manager.stop(currentTrackRef.current);
    }
    if (desired) {
      audio.manager.playLoop(desired);
    }
    currentTrackRef.current = desired;
  }, [audio, winLoss, tension]);

  // Stop the music when the consumer unmounts (route change, etc.).
  useEffect(() => {
    if (!audio) return;
    return () => {
      if (currentTrackRef.current) {
        audio.manager.stop(currentTrackRef.current);
        currentTrackRef.current = null;
      }
    };
  }, [audio]);
}

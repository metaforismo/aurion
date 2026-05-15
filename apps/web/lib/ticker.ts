// rAF-driven game ticker.
//
// Two layers:
//  - `Ticker` is a plain class with no React dependency. It owns the rAF loop,
//    accumulator, and visibility/event listeners.
//  - `useTicker` is the React hook that wires the class to the Zustand store
//    and exposes a small API for the play screen.

'use client';

import { useEffect, useRef, useState } from 'react';

import {
  selectHasOpenEvent,
  useGameStore,
  type GameStoreState,
  type Speed,
} from './store';

// ---------------------------------------------------------------------------
// Speed → ms-per-tick table.
// 0 = paused. 1x = 2000ms, 2x = 1000ms, 4x = 500ms (tunable in balance pass).
// ---------------------------------------------------------------------------

const SPEED_INTERVAL_MS: Record<Exclude<Speed, 0>, number> = {
  1: 2000,
  2: 1000,
  4: 500,
};

export type TickerOptions = {
  /** Called once per logical tick. Should advance the engine state. */
  onTick: () => void | Promise<void>;
  /** Initial speed. Default 0 (paused). */
  initialSpeed?: Speed;
};

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

export class Ticker {
  private speed: Speed;
  private rafHandle: number | null = null;
  private lastFrameMs = 0;
  private accumulator = 0;
  private isTicking = false;
  private readonly onTick: () => void | Promise<void>;

  constructor(options: TickerOptions) {
    this.onTick = options.onTick;
    this.speed = options.initialSpeed ?? 0;
  }

  start(): void {
    if (this.rafHandle !== null) return;
    this.lastFrameMs = 0;
    this.accumulator = 0;
    const step = (nowMs: number) => {
      this.frame(nowMs);
      this.rafHandle = requestAnimationFrame(step);
    };
    this.rafHandle = requestAnimationFrame(step);
  }

  stop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.lastFrameMs = 0;
    this.accumulator = 0;
  }

  setSpeed(speed: Speed): void {
    this.speed = speed;
    // Reset the accumulator on any change so a 4x→1x switch doesn't dump a
    // burst of pent-up ticks.
    this.accumulator = 0;
    this.lastFrameMs = 0;
  }

  private frame(nowMs: number): void {
    if (this.speed === 0) {
      this.lastFrameMs = nowMs;
      return;
    }
    if (this.lastFrameMs === 0) {
      this.lastFrameMs = nowMs;
      return;
    }
    const dt = nowMs - this.lastFrameMs;
    this.lastFrameMs = nowMs;
    this.accumulator += dt;

    const interval = SPEED_INTERVAL_MS[this.speed];
    // Avoid death spirals — cap the number of catch-up ticks per frame.
    let safety = 4;
    while (this.accumulator >= interval && safety-- > 0) {
      this.accumulator -= interval;
      if (this.isTicking) break;
      this.isTicking = true;
      void Promise.resolve(this.onTick()).finally(() => {
        this.isTicking = false;
      });
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export type UseTickerResult = {
  speed: Speed;
  setSpeed: (speed: Speed) => void;
  isPaused: boolean;
  isAutoPaused: boolean;
  /** Re-apply the user's preferred speed (clearing any auto-pause). */
  resume: () => void;
};

/**
 * Wires a Ticker to the global game store. Subscribes to:
 *  - the user-controlled `speed`
 *  - `document.visibilitychange` (auto-pause when tab hidden)
 *  - any unresolved engine event (auto-pause)
 *  - `state.winLoss` (auto-pause when not playing)
 *  - `state.eraState.pendingTransition` (auto-pause while EraTransitionModal
 *    is up; cleared by the `acknowledgeEraTransition` action)
 *
 * Auto-pauses preserve the user's last *non-zero* speed so we can restore it
 * automatically when the auto-pause condition clears (unless the user
 * explicitly paused before).
 */
export function useTicker(): UseTickerResult {
  const speed = useGameStore((s) => s.speed);
  const setStoreSpeed = useGameStore((s) => s.setSpeed);
  const advanceTick = useGameStore((s) => s.advanceTick);
  const hasOpenEvent = useGameStore(selectHasOpenEvent);
  const winLoss = useGameStore((s: GameStoreState) => s.state?.winLoss);
  // Era-paced mode pauses the loop on every era boundary so the player can
  // sit with the chapter beat. The flag is cleared by the engine when the
  // player dispatches `acknowledgeEraTransition`.
  const hasPendingEraTransition = useGameStore(
    (s: GameStoreState) => s.state?.eraState?.pendingTransition != null,
  );

  const tickerRef = useRef<Ticker | null>(null);
  const [isAutoPaused, setIsAutoPaused] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);

  // Track the user's last *intentional* non-zero speed so we can restore it
  // after auto-pause lifts. We don't restore if they explicitly chose pause.
  const userIntentRef = useRef<Speed>(speed);
  useEffect(() => {
    if (!isAutoPaused) {
      userIntentRef.current = speed;
    }
  }, [speed, isAutoPaused]);

  // Visibility listener.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = () => {
      setIsTabHidden(document.hidden);
    };
    handler();
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Bring up / tear down the underlying ticker.
  useEffect(() => {
    const ticker = new Ticker({
      onTick: () => advanceTick(),
      initialSpeed: speed,
    });
    tickerRef.current = ticker;
    ticker.start();
    return () => {
      ticker.stop();
      tickerRef.current = null;
    };
    // intentionally not depending on `speed`: we update via setSpeed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute effective speed (auto-pause takes precedence over user speed).
  useEffect(() => {
    const wantsAutoPause =
      isTabHidden ||
      hasOpenEvent ||
      winLoss !== 'playing' ||
      hasPendingEraTransition;
    // setIsAutoPaused mirrors derived state into hook output. The lint rule's
    // cascading-render warning is a false positive here — the value is a pure
    // function of the deps and we never re-enter this effect via the setter.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAutoPaused(wantsAutoPause);
    const ticker = tickerRef.current;
    if (!ticker) return;
    if (wantsAutoPause) {
      ticker.setSpeed(0);
    } else {
      ticker.setSpeed(speed);
    }
  }, [isTabHidden, hasOpenEvent, winLoss, hasPendingEraTransition, speed]);

  return {
    speed,
    setSpeed: setStoreSpeed,
    isPaused: speed === 0,
    isAutoPaused,
    resume: () => {
      const target = userIntentRef.current === 0 ? 1 : userIntentRef.current;
      setStoreSpeed(target);
    },
  };
}

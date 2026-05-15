'use client';

// React hook driving the first-time tutorial. Owns:
//   - the dismissed-flag bootstrap (read once on mount from IndexedDB)
//   - the current step index
//   - navigation helpers (next / prev / skip / complete)
//
// We deliberately keep this hook framework-light: it does NOT pause the game
// itself. The TutorialOverlay component (the only consumer) decides when to
// pause/resume the ticker. That separation makes the hook easy to test and
// keeps the pause side-effect explicit at the call site.

import { useCallback, useEffect, useState } from 'react';

import {
  getTutorialDismissed,
  setTutorialDismissed,
} from '../../lib/persistence';

import { TUTORIAL_STEPS, TUTORIAL_STEP_COUNT } from './tutorialSteps';

export type TutorialState = {
  /** True once the persisted flag has been read. Prevents a flash of the
   * intro modal on the very first paint. */
  isReady: boolean;
  /** True when the overlay should render (player hasn't dismissed yet AND
   * isReady has resolved). Becomes false on complete / skip. */
  shouldShow: boolean;
  /** 0-based index into TUTORIAL_STEPS. */
  currentStepIndex: number;
  /** Total number of steps. Convenient for "step N of M" labels. */
  totalSteps: number;
  /** Advance to the next step. On the last step this calls `complete()`. */
  next: () => void;
  /** Move to the previous step. No-op on the first step. */
  prev: () => void;
  /** Skip the entire tutorial (writes the dismissed flag). */
  skip: () => void;
  /** Mark the tutorial complete (writes the dismissed flag). */
  complete: () => void;
};

export function useTutorialState(): TutorialState {
  const [isReady, setIsReady] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // One-shot bootstrap. We tolerate persistence errors silently — when the
  // flag can't be read we behave as if it was set (skip the tutorial) so we
  // never spam returning players on a broken IndexedDB.
  useEffect(() => {
    let cancelled = false;
    void getTutorialDismissed()
      .then((dismissed) => {
        if (cancelled) return;
        setShouldShow(!dismissed);
        setIsReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setShouldShow(false);
        setIsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persistDismiss = useCallback(() => {
    void setTutorialDismissed(true).catch(() => {
      // Persistence failure here just means the player will see the tutorial
      // again next time — acceptable degradation.
    });
  }, []);

  const skip = useCallback(() => {
    setShouldShow(false);
    persistDismiss();
  }, [persistDismiss]);

  const complete = useCallback(() => {
    setShouldShow(false);
    persistDismiss();
  }, [persistDismiss]);

  const next = useCallback(() => {
    setCurrentStepIndex((idx) => {
      if (idx >= TUTORIAL_STEP_COUNT - 1) {
        // Last step → mark complete. We invoke the same code path as the
        // explicit "complete" button so persistence stays consistent.
        setShouldShow(false);
        persistDismiss();
        return idx;
      }
      return idx + 1;
    });
  }, [persistDismiss]);

  const prev = useCallback(() => {
    setCurrentStepIndex((idx) => (idx > 0 ? idx - 1 : 0));
  }, []);

  return {
    isReady,
    shouldShow,
    currentStepIndex,
    totalSteps: TUTORIAL_STEPS.length,
    next,
    prev,
    skip,
    complete,
  };
}

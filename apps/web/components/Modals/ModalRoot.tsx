// Single mount point for all modals. Reads the store, resolves which (if any)
// modal should be visible, and delegates to the matching component.
//
// Priority (only one modal at a time):
//   1. Win/Loss screen — game-ending
//   2. Eternal-mode first-victory celebration — fires once per run when the
//      player unlocks their FIRST milestone in eternal mode. Subsequent
//      milestones become non-blocking toasts (see VictoryToast).
//   3. UN resolution alert — auto-pops for new resolutions the player must
//      decide on. Player can dismiss to keep playing without voting now.
//   4. Narrative event modal — must be resolved before the loop resumes
//   5. Pending confirm request — user-initiated

'use client';

import { useCallback, useState } from 'react';

import {
  selectOpenEvent,
  selectShouldShowEternalFirstVictory,
  useGameStore,
} from '../../lib/store';

import { ConfirmModal } from './ConfirmModal';
import { EternalFirstVictoryModal } from './EternalFirstVictoryModal';
import { EventModal } from './EventModal';
import {
  UNResolutionModal,
  pickPendingUNResolution,
} from './UNResolutionModal';
import { WinLossModal } from './WinLossModal';

export function ModalRoot() {
  const winLoss = useGameStore((s) => s.state?.winLoss);
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const openEvent = useGameStore(selectOpenEvent);
  const pendingConfirm = useGameStore((s) => s.pendingConfirm);
  const showEternalFirstVictory = useGameStore(
    selectShouldShowEternalFirstVictory,
  );

  // Track which UN resolutions the player has explicitly dismissed in this
  // session so we don't re-pop the modal on every tick. We use plain state
  // (a frozen Set replaced on update) rather than a ref so we don't read a
  // mutable value during render — keeps the component compatible with React
  // 18+ strict-mode and the project's react-hooks/refs lint rule.
  const [dismissedUN, setDismissedUN] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const dismissUN = useCallback((id: string) => {
    setDismissedUN((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  if (winLoss && winLoss !== 'playing') {
    return <WinLossModal />;
  }

  if (showEternalFirstVictory) {
    return <EternalFirstVictoryModal />;
  }

  // UN modal — only when a scenario + state are loaded. The selector handles
  // the "no ONU / no eligible resolution" cases by returning null.
  if (state && scenario) {
    const pendingUN = pickPendingUNResolution(state, scenario, dismissedUN);
    if (pendingUN) {
      return (
        <UNResolutionModal
          resolution={pendingUN}
          state={state}
          scenario={scenario}
          onDismiss={() => dismissUN(pendingUN.id)}
        />
      );
    }
  }

  if (openEvent && scenario) {
    return <EventModal event={openEvent} scenario={scenario} />;
  }

  if (pendingConfirm) {
    return <ConfirmModal />;
  }

  return null;
}

export default ModalRoot;

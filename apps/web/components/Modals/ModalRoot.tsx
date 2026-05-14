// Single mount point for all modals. Reads the store, resolves which (if any)
// modal should be visible, and delegates to the matching component.
//
// Priority (only one modal at a time):
//   1. Win/Loss screen — game-ending
//   2. Narrative event modal — must be resolved before the loop resumes
//   3. Pending confirm request — user-initiated

'use client';

import { useGameStore, selectOpenEvent } from '../../lib/store';

import { ConfirmModal } from './ConfirmModal';
import { EventModal } from './EventModal';
import { WinLossModal } from './WinLossModal';

export function ModalRoot() {
  const winLoss = useGameStore((s) => s.state?.winLoss);
  const scenario = useGameStore((s) => s.scenario);
  const openEvent = useGameStore(selectOpenEvent);
  const pendingConfirm = useGameStore((s) => s.pendingConfirm);

  if (winLoss && winLoss !== 'playing') {
    return <WinLossModal />;
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

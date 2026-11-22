// Single mount point for all modals. Reads the store, resolves which (if any)
// modal should be visible, and delegates to the matching component.
//
// Priority (only one modal at a time):
//   1. Win/Loss screen — game-ending
//   2. Nuclear strike inbound — passive notification; the strike has already
//      landed in engine state but the player must acknowledge it before the
//      loop resumes. Wave 10.
//   3. Eternal-mode first-victory celebration — fires once per run when the
//      player unlocks their FIRST milestone in eternal mode. Subsequent
//      milestones become non-blocking toasts (see VictoryToast).
//   4. Era transition — fires when the engine sets
//      `state.eraState.pendingTransition`; narrative checkpoint between two
//      scenario eras (Wave 10 era-paced mode). Game auto-pauses while open.
//   5. UN resolution alert — auto-pops for new resolutions the player must
//      decide on. Player can dismiss to keep playing without voting now.
//   6. Narrative event modal — must be resolved before the loop resumes
//   7. Pending confirm request — user-initiated
//
// The two nuclear *launch* confirmation modals (NuclearLaunchConfirm) are NOT
// listed here: they are owned by `MilitaryPanel` (the only place that can
// trigger them) and rendered inline rather than going through this priority
// chain. ModalRoot only handles modals dispatched globally from the store.

'use client';

import {
  selectOpenEvent,
  selectShouldShowEternalFirstVictory,
  useGameStore,
} from '../../lib/store';

import { ConfirmModal } from './ConfirmModal';
import { EraTransitionModal } from './EraTransitionModal';
import { EternalFirstVictoryModal } from './EternalFirstVictoryModal';
import { EventModal } from './EventModal';
import { NuclearStrikeIncomingModal } from './NuclearStrikeIncomingModal';
import { WinLossModal } from './WinLossModal';

export function ModalRoot() {
  const winLoss = useGameStore((s) => s.state?.winLoss);
  const scenario = useGameStore((s) => s.scenario);
  const openEvent = useGameStore(selectOpenEvent);
  const pendingConfirm = useGameStore((s) => s.pendingConfirm);
  const showEternalFirstVictory = useGameStore(
    selectShouldShowEternalFirstVictory,
  );
  const pendingNuclearStrikeIncoming = useGameStore(
    (s) => s.pendingNuclearStrikeIncoming,
  );
  // Era-paced narrative checkpoint — when the engine ticks past an era
  // boundary it sets `eraState.pendingTransition` non-null and the modal
  // must capture the player's attention before the loop resumes.
  const pendingEraTransition = useGameStore(
    (s) => s.state?.eraState?.pendingTransition ?? null,
  );

  // UN ballots are deliberately NOT a dialog: they have a deadline rather
  // than stopping the clock, so they surface as a dock badge, a briefing
  // entry and a map pin, and are voted from the UN panel.

  if (winLoss && winLoss !== 'playing') {
    return <WinLossModal />;
  }

  if (pendingNuclearStrikeIncoming) {
    return (
      <NuclearStrikeIncomingModal notification={pendingNuclearStrikeIncoming} />
    );
  }

  if (showEternalFirstVictory) {
    return <EternalFirstVictoryModal />;
  }

  if (pendingEraTransition) {
    return <EraTransitionModal />;
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

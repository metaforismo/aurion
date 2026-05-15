// Celebratory modal that fires once per Eternal-mode run when the player
// unlocks their FIRST victory milestone. Subsequent milestones are surfaced
// as discrete bottom-right toasts via VictoryToast.
//
// The modal explains the Eternal contract — vittorie come milestone, gioca
// quanto vuoi — so the player understands why the game didn't terminate.

'use client';

import { useTranslations } from 'next-intl';
import type { VictoryConditionId } from '@aurion/engine';

import { useGameStore } from '../../lib/store';

import { Modal } from './Modal';

export function EternalFirstVictoryModal() {
  const state = useGameStore((s) => s.state);
  const acknowledge = useGameStore((s) => s.acknowledgeEternalFirstVictory);
  const t = useTranslations('modals.eternalFirstVictory');
  const tVictory = useTranslations('victory');

  // The ModalRoot priority chain already gates on the same conditions, but
  // we re-check defensively so the component is safe to mount standalone in
  // tests / Storybook.
  if (!state) return null;
  if ((state.gameMode ?? 'classic') !== 'eternal') return null;
  const unlocked = state.unlockedVictories ?? [];
  if (unlocked.length === 0) return null;

  const firstId = unlocked[0] as VictoryConditionId;
  const conditionName = safeT(tVictory, `${firstId}.name`, firstId);

  return (
    <Modal
      title={
        <span className="text-2xl font-bold text-accent">{t('title')}</span>
      }
      // Celebratory beat — must be acknowledged so the player understands the
      // Eternal contract. Non-dismissable via ESC / backdrop, only the
      // explicit "Continua" button closes it.
      dismissable={false}
      size="md"
      footer={
        <button
          type="button"
          onClick={acknowledge}
          className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-bg transition hover:bg-accent-strong"
        >
          {t('continue')}
        </button>
      }
    >
      <p className="leading-relaxed text-fg-muted">
        {t('body', { condition: conditionName })}
      </p>
    </Modal>
  );
}

/**
 * Resolve a translation key, falling back to a literal when the key is
 * missing. next-intl returns the raw key on miss; we detect that and use the
 * provided fallback so we never render `victory.economic.name` to the user.
 */
function safeT(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any) => string,
  key: string,
  fallback: string,
): string {
  try {
    const value = t(key);
    return value === key ? fallback : value;
  } catch {
    return fallback;
  }
}

export default EternalFirstVictoryModal;

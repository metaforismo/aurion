// "Nuclear strike inbound" notification — passive, irreversible bad news.
//
// Pops up automatically when the engine surfaces an inbound nuclear strike
// against the player (the store's `pendingNuclearStrikeIncoming` field is
// populated). The modal is *informational*: nothing the player can do at this
// point will change the outcome — the strike has already landed in the engine
// state. The single "Sigh" button dismisses the notification so the loop can
// resume. The framing is intentionally grave (no humour, no understatement).
//
// Mounted by `ModalRoot` and gated by store state. Non-dismissable via ESC /
// backdrop — the player must explicitly acknowledge the strike.

'use client';

import { useTranslations } from 'next-intl';
import { Skull } from 'lucide-react';
import type { Country } from '@aurion/engine';

import { cn } from '../../lib/cn';
import {
  useGameStore,
  type GameStoreState,
  type PendingNuclearStrikeIncoming,
} from '../../lib/store';
import { ScenarioId } from '../../lib/scenarios';
import { tone } from '../../lib/theme';
import { useScenarioMessages } from '../Panels/shared/useScenarioMessages';

import { Modal } from './Modal';

export type NuclearStrikeIncomingModalProps = {
  /** The active strike notification — caller passes the store value through. */
  notification: PendingNuclearStrikeIncoming;
};

export function NuclearStrikeIncomingModal({
  notification,
}: NuclearStrikeIncomingModalProps) {
  const t = useTranslations('modals.nuclearStrikeIncoming');
  const state = useGameStore((s: GameStoreState) => s.state);
  const scenario = useGameStore((s: GameStoreState) => s.scenario);
  const dismiss = useGameStore(
    (s: GameStoreState) => s.dismissNuclearStrikeIncoming,
  );

  const scenarioId = (scenario?.id ?? null) as ScenarioId | null;
  const { t: tScenario } = useScenarioMessages(scenarioId);

  // Resolve the attacker's display name. We tolerate missing scenario / state
  // (e.g. between save loads) by falling back to the raw country id so the
  // modal still mounts cleanly in tests. `useScenarioMessages.t` already
  // returns the raw key on miss, so the only extra fallback we need is when
  // the country itself isn't in state.
  const attacker: Country | undefined =
    state?.countries[notification.attacker];
  const attackerName = attacker
    ? tScenario(attacker.nameKey)
    : notification.attacker;

  const bodyKey = `body.${notification.kind}` as const;

  return (
    <Modal
      // Player MUST acknowledge — the strike is irreversible and the framing
      // demands a deliberate beat before the loop resumes.
      dismissable={false}
      size="md"
      className="border-danger"
      title={
        <span className="flex items-center gap-2">
          <Skull aria-hidden className={cn('h-4 w-4', tone('danger'))} />
          <span className={cn(tone('danger'))}>{t('title')}</span>
        </span>
      }
      footer={
        <button
          type="button"
          onClick={dismiss}
          className="rounded-sm border border-danger bg-transparent px-4 py-2 text-xs font-semibold text-danger transition hover:border-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          {t('dismiss')}
        </button>
      }
    >
      <div className="space-y-4">
        <p className={cn('font-semibold leading-relaxed', tone('danger'))}>
          {t(bodyKey, { attacker: attackerName })}
        </p>
        <ul className="ml-4 list-disc space-y-1 text-xs leading-relaxed text-fg-muted">
          <li>{t(`effects.${notification.kind}.population`)}</li>
          <li>{t(`effects.${notification.kind}.economy`)}</li>
          <li>{t(`effects.${notification.kind}.aftermath`)}</li>
        </ul>
        <p className="text-[11px] italic leading-relaxed text-fg-faint">
          {t('helper')}
        </p>
      </div>
    </Modal>
  );
}

export default NuclearStrikeIncomingModal;

// Narrative event dialog. Looks up the EventDefinition from the active
// scenario, renders the localized title + description, and lists every
// EventChoice as a button. Picking a choice resolves the event in the store
// (which both marks it resolved and applies effects). The modal is NOT
// dismissable: the player must choose so the loop can resume.

'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { EventChoice, GameEvent, Scenario } from '@aurion/engine';

import { useGameStore } from '../../lib/store';

import { Modal } from './Modal';

export type EventModalProps = {
  /** The unresolved event the modal is showing. */
  event: GameEvent;
  /** The active scenario (provides the event definitions). */
  scenario: Scenario;
};

export function EventModal({ event, scenario }: EventModalProps) {
  const t = useTranslations();
  const resolveCurrentEvent = useGameStore((s) => s.resolveCurrentEvent);

  const definition = useMemo(
    () => scenario.eventPool.find((e) => e.id === event.definitionId),
    [scenario.eventPool, event.definitionId],
  );

  // Defensive: the scenario could be missing the definition (legacy save).
  // Render a minimal fallback that lets the player dismiss.
  if (!definition) {
    return (
      <Modal
        title={event.definitionId}
        dismissable={false}
        size="md"
        footer={
          <button
            type="button"
            onClick={() => resolveCurrentEvent(0)}
            className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-bg hover:bg-accent-strong"
          >
            {t('common.confirm')}
          </button>
        }
      >
        <p className="text-fg-muted">
          {t('modals.event.unknownDefinition', { id: event.definitionId })}
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title={t(definition.nameKey)}
      dismissable={false}
      size="md"
      descriptionId={`event-${event.definitionId}-desc`}
    >
      <p
        id={`event-${event.definitionId}-desc`}
        className="leading-relaxed text-fg-muted"
      >
        {t(definition.descriptionKey)}
      </p>

      <ul className="mt-6 flex flex-col gap-2">
        {definition.choices.map((choice, idx) => (
          <ChoiceButton
            key={`${choice.labelKey}-${idx}`}
            choice={choice}
            onPick={() => resolveCurrentEvent(idx)}
          />
        ))}
      </ul>
    </Modal>
  );
}

function ChoiceButton({
  choice,
  onPick,
}: {
  choice: EventChoice;
  onPick: () => void;
}) {
  const t = useTranslations();
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="w-full rounded-lg border border-border-strong bg-bg/40 px-4 py-3 text-left text-sm text-fg transition hover:border-accent hover:bg-accent/10 focus-visible:border-accent focus-visible:bg-accent/10"
      >
        {t(choice.labelKey)}
      </button>
    </li>
  );
}

export default EventModal;

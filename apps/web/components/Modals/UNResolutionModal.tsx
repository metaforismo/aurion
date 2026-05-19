// United Nations resolution modal.
//
// Pops up automatically when a brand-new resolution opens that the player
// (a) sits on the council for, and (b) hasn't yet voted on. The Modal
// primitive auto-pauses gameplay through ModalRoot's existing focus-trap
// behaviour. The modal exposes three actions:
//
//   - Vote inline (Yes / No / Abstain — plus Veto for permanent council
//     members). Picking a vote dispatches the action and dismisses the modal.
//   - "Open panel" — closes the modal and switches the left rail to the
//     ONU panel for richer context.
//   - "Skip for now" — stashes the resolution id in the dismissed set so we
//     don't re-prompt for it until the engine resolves it. Player can still
//     vote later from the panel.
//
// Queueing: only ONE modal is rendered at a time. We pick the OLDEST unseen
// open resolution. When it's resolved or dismissed, the next pending one
// pops on the next render.

'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  HeartHandshake,
  Leaf,
  Megaphone,
  Shield,
  Stamp,
  type LucideIcon,
} from 'lucide-react';
import type {
  CountryId,
  GameState,
  Scenario,
  UNResolution,
  UNResolutionKind,
  UNVote,
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import type { ScenarioId } from '../../lib/scenarios';
import { useGameStore } from '../../lib/store';
import { useScenarioMessages } from '../Panels/shared/useScenarioMessages';

import { Modal } from './Modal';

// Lucide icon per resolution kind — mirrors UNResolutionCard so the visual
// language stays consistent between the inline list and the modal.
const KIND_ICON: Record<UNResolutionKind, LucideIcon> = {
  sanctions: Ban,
  peacekeeping: Shield,
  recognition: Stamp,
  humanitarian: HeartHandshake,
  climate: Leaf,
  nonProliferation: AlertTriangle,
  condemnation: Megaphone,
};

export type UNResolutionModalProps = {
  /** The open resolution this modal is showing. */
  resolution: UNResolution;
  /** Active game state — used for "weeks remaining" + name lookups. */
  state: GameState;
  /** Active scenario — provides council membership + name lookups. */
  scenario: Scenario;
  /** Called when the player closes the modal without voting. */
  onDismiss: () => void;
};

export function UNResolutionModal({
  resolution,
  state,
  scenario,
  onDismiss,
}: UNResolutionModalProps) {
  const t = useTranslations('modals.unResolution');
  const tPanel = useTranslations('panelUN');
  // Title / description / country-name keys for resolutions live in the
  // scenario side-car bundle (`un.<scenario>.*`, `country.<id>.name`), not
  // the global UI messages. Resolve them via `useScenarioMessages` — same
  // pattern as EventModal / UNResolutionCard.
  const scenarioId = scenario.id as ScenarioId;
  const { t: tScenario } = useScenarioMessages(scenarioId);
  const applyAction = useGameStore((s) => s.applyAction);
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);

  const [busy, setBusy] = useState(false);

  const Icon = KIND_ICON[resolution.kind];
  const playerId = state.playerCountryId;
  const councilMembers = scenario.unCouncilMembers ?? [];
  const playerIsCouncil = councilMembers.includes(playerId);
  const remainingTicks = Math.max(
    0,
    resolution.votingClosesAtTick - state.tick,
  );

  const targetLabel = useMemo<string | null>(() => {
    if (resolution.targetCountryId) {
      const c = state.countries[resolution.targetCountryId];
      if (!c) return resolution.targetCountryId;
      const resolved = tScenario(c.nameKey);
      return resolved && resolved !== c.nameKey
        ? resolved
        : resolution.targetCountryId;
    }
    if (resolution.targetRegionId) return resolution.targetRegionId;
    return null;
  }, [resolution, state.countries, tScenario]);

  const proposerLabel = (() => {
    const c = state.countries[resolution.proposerCountryId];
    if (!c) return resolution.proposerCountryId;
    const resolved = tScenario(c.nameKey);
    return resolved && resolved !== c.nameKey
      ? resolved
      : resolution.proposerCountryId;
  })();

  // Vote dispatcher used by the four buttons. After a successful dispatch we
  // close the modal; on error we keep it open so the player sees the toast
  // surfaced upstream by ModalRoot's parent (no toast wiring lives here).
  const handleVote = useCallback(
    async (vote: UNVote) => {
      if (busy) return;
      setBusy(true);
      try {
        await applyAction({ type: 'voteUN', resolutionId: resolution.id, vote });
      } finally {
        setBusy(false);
      }
      onDismiss();
    },
    [applyAction, busy, onDismiss, resolution.id],
  );

  const handleViewInPanel = () => {
    setSelectedPanel('un');
    onDismiss();
  };

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Icon aria-hidden className="h-5 w-5 text-warning" />
          <span>{t('title')}</span>
        </span>
      }
      // Player must acknowledge — but they CAN dismiss to keep playing without
      // voting (the engine will record an abstain at close time). So this is
      // dismissable via ESC / backdrop.
      dismissable
      onClose={onDismiss}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            className="rounded-sm border border-border bg-transparent px-3 py-2 text-xs font-semibold text-fg-muted transition hover:border-border-strong hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
          >
            {t('dismiss')}
          </button>
          <button
            type="button"
            onClick={handleViewInPanel}
            disabled={busy}
            className="rounded-sm border border-border bg-transparent px-3 py-2 text-xs font-semibold text-fg transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
          >
            {t('viewInPanel')}
          </button>
        </>
      }
    >
      {/* Resolution headline */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-fg">
          {translateScenarioKey(tScenario, resolution.titleKey, resolution.kind)}
        </h3>
        <p className="text-sm leading-relaxed text-fg-muted">
          {translateScenarioKey(tScenario, resolution.descriptionKey, '')}
        </p>
      </div>

      {/* Meta */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-y border-border py-2 text-xs">
        <div className="flex items-baseline gap-1">
          <dt className="font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {tPanel('proposer')}
          </dt>
          <dd className="font-mono text-fg">{proposerLabel}</dd>
        </div>
        {targetLabel ? (
          <div className="flex items-baseline gap-1">
            <dt className="font-semibold uppercase tracking-[0.14em] text-fg-muted">
              {tPanel('target.label')}
            </dt>
            <dd className="font-mono text-fg">{targetLabel}</dd>
          </div>
        ) : null}
        <div className="flex items-baseline gap-1">
          <dt className="font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {tPanel('votingClosesAt')}
          </dt>
          <dd className="font-mono text-warning">
            {tPanel('weeksRemaining', { n: remainingTicks })}
          </dd>
        </div>
        <div className="flex items-baseline gap-1">
          <dt className="font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {tPanel('kind.label')}
          </dt>
          <dd className="font-mono text-fg">{tPanel(`kind.${resolution.kind}`)}</dd>
        </div>
      </dl>

      {/* Vote buttons — only when the player is a council voter. Otherwise we
          show a hint and only the "view panel / dismiss" footer applies. */}
      {playerIsCouncil ? (
        <section className="mt-5 flex flex-col gap-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {t('voteNow')}
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <VoteButton
              tone="primary"
              label={tPanel('vote.yes')}
              onClick={() => handleVote('yes')}
              disabled={busy}
            />
            <VoteButton
              tone="neutral"
              label={tPanel('vote.no')}
              onClick={() => handleVote('no')}
              disabled={busy}
            />
            <VoteButton
              tone="neutral"
              label={tPanel('vote.abstain')}
              onClick={() => handleVote('abstain')}
              disabled={busy}
            />
          </div>
          <VoteButton
            tone="danger"
            label={tPanel('vote.veto')}
            onClick={() => handleVote('veto')}
            disabled={busy}
            hint={tPanel('vote.vetoHint')}
            full
          />
        </section>
      ) : (
        <p className="mt-5 border-t border-border px-1 py-3 text-xs italic text-fg-faint">
          {tPanel('notCouncilMember')}
        </p>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolution title / description keys are populated by the engine at trigger
 * time, sourced from the active scenario's side-car bundle. We resolve them
 * through `useScenarioMessages` (passed in by the caller as `tScenario`),
 * degrading to `fallback` when the key isn't shipped.
 */
function translateScenarioKey(
  tScenario: (key: string | undefined | null) => string,
  key: string | undefined,
  fallback: string,
): string {
  if (!key) return fallback;
  const resolved = tScenario(key);
  if (!resolved || resolved === key) return fallback;
  return resolved;
}

// ---------------------------------------------------------------------------
// Internal: small button reused for the four vote choices.
// ---------------------------------------------------------------------------

function VoteButton({
  tone,
  label,
  onClick,
  disabled,
  hint,
  full,
}: {
  tone: 'primary' | 'neutral' | 'danger';
  label: string;
  onClick: () => void;
  disabled: boolean;
  hint?: string;
  full?: boolean;
}) {
  const TONE_STYLES: Record<typeof tone, string> = {
    primary:
      'border-accent bg-accent text-bg hover:border-accent-strong hover:bg-accent-strong',
    neutral:
      'border-border bg-transparent text-fg hover:border-border-strong',
    danger:
      'border-border bg-transparent text-danger hover:border-danger',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-stretch gap-0.5 rounded-sm border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60',
        TONE_STYLES[tone],
        full ? 'w-full' : null,
      )}
    >
      <span>{label}</span>
      {hint ? (
        <span className="text-[10px] font-normal italic opacity-80">
          {hint}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Selector — kept here so the ModalRoot can decide whether to mount this
 * modal without re-implementing the queueing logic. Returns the OLDEST
 * resolution that:
 *   - has status === 'voting'
 *   - the player is a council voter on
 *   - the player has NOT yet voted on
 *   - has not been stashed in the dismissed set
 *
 * `dismissed` is provided by the caller so it can persist across render
 * cycles (typically a `useRef<Set<string>>` in the consumer).
 */
export function pickPendingUNResolution(
  state: GameState,
  scenario: Scenario,
  dismissed: ReadonlySet<string>,
): UNResolution | null {
  const list = state.unResolutions ?? [];
  if (list.length === 0) return null;
  const playerId: CountryId = state.playerCountryId;
  const council = scenario.unCouncilMembers ?? [];
  if (!council.includes(playerId)) return null;

  const eligible = list
    .filter(
      (r) =>
        r.status === 'voting' &&
        r.votes[playerId] === undefined &&
        !dismissed.has(r.id),
    )
    .sort((a, b) => a.proposedAtTick - b.proposedAtTick);
  return eligible[0] ?? null;
}

export default UNResolutionModal;

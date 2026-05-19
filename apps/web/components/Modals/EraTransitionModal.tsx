// Era transition celebratory modal — fires whenever the engine surfaces
// `state.eraState.pendingTransition`. Shows a snapshot of cumulative stats
// taken at the era boundary and dispatches `acknowledgeEraTransition` when
// the player clicks "Continua".
//
// The game auto-pauses while the modal is open (see `lib/ticker.ts`, which
// reads `pendingTransition` and forces speed=0) — this component only needs
// to render the chapter beat.
//
// Non-dismissable on purpose: an era boundary is a narrative checkpoint, so
// the player must explicitly acknowledge it via the "Continua" button (no
// ESC / backdrop close).

'use client';

import { useTranslations } from 'next-intl';
import type { Era, GameState } from '@aurion/engine';

import { useGameStore, type GameStoreState } from '../../lib/store';
import type { ScenarioId } from '../../lib/scenarios';
import { useScenarioMessages } from '../Panels/shared/useScenarioMessages';

import { Modal } from './Modal';

export function EraTransitionModal() {
  const state = useGameStore((s: GameStoreState) => s.state);
  const scenario = useGameStore((s: GameStoreState) => s.scenario);
  const applyAction = useGameStore((s: GameStoreState) => s.applyAction);

  const t = useTranslations('modals.eraTransition');
  // Era name keys (e.g. `era.mc.info-age.name`) live in the scenario side-car
  // bundle, NOT in the global messages file. Resolve them via the scenario
  // messages hook — same pattern as EventModal / WorldMap. Hooks must run
  // before any early return, so we always call this even when the modal will
  // bail out below.
  const scenarioId = (scenario?.id ?? null) as ScenarioId | null;
  const { t: tScenario } = useScenarioMessages(scenarioId);

  // Defensive guards — ModalRoot already gates on these conditions, but the
  // modal is safe to mount standalone in tests / Storybook.
  if (!state || !scenario) return null;
  const eraState = state.eraState;
  if (!eraState?.pendingTransition) return null;

  const { fromEraId, toEraId, ticksAtTransition, statsSnapshot } =
    eraState.pendingTransition;

  const fromEra = scenario.eras?.find((e: Era) => e.id === fromEraId) ?? null;
  const toEra = scenario.eras?.find((e: Era) => e.id === toEraId) ?? null;

  // Resolve era display names through the scenario message bundle, falling
  // back to the raw era id when no translation exists yet.
  const fromName = resolveEraName(tScenario, fromEra, fromEraId);
  const toName = resolveEraName(tScenario, toEra, toEraId);

  const handleAcknowledge = async () => {
    await applyAction({ type: 'acknowledgeEraTransition' });
  };

  return (
    <Modal
      title={t('title', { fromEra: fromName })}
      // Narrative checkpoint — must be acknowledged to keep the run moving.
      dismissable={false}
      size="md"
      footer={
        <button
          type="button"
          onClick={handleAcknowledge}
          className="rounded-sm border border-accent bg-accent px-4 py-2 text-xs font-semibold text-bg transition hover:border-accent-strong hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          {t('continue')}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="leading-relaxed text-fg">
          {t('subtitle', { toEra: toName })}
        </p>

        <StatsSnapshotList
          stats={statsSnapshot}
          ticksAtTransition={ticksAtTransition}
          baselineState={state}
        />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Stats snapshot
// ---------------------------------------------------------------------------

function StatsSnapshotList({
  stats,
  ticksAtTransition,
  baselineState,
}: {
  stats: NonNullable<
    NonNullable<GameState['eraState']>['pendingTransition']
  >['statsSnapshot'];
  ticksAtTransition: number;
  baselineState: GameState;
}) {
  const t = useTranslations('modals.eraTransition.stats');

  // The cumulative-stats snapshot may be undefined-keyed for older runs that
  // ship without the engine populating every field; we coerce numbers to a
  // safe display value rather than rendering "NaN".
  const ticks = Number.isFinite(ticksAtTransition) ? ticksAtTransition : 0;
  const peakRank = Number.isFinite(stats?.peakGdpRank)
    ? stats.peakGdpRank
    : null;
  const techsUnlocked = Number.isFinite(stats?.totalTechsUnlocked)
    ? stats.totalTechsUnlocked
    : countPlayerTechs(baselineState);
  const reputationGained = Number.isFinite(stats?.totalReputationGained)
    ? stats.totalReputationGained
    : 0;

  return (
    <ul
      className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm"
      aria-label={t('ariaLabel')}
    >
      <StatItem label={t('ticksPlayed')} value={`${ticks}`} />
      <StatItem
        label={t('peakRank')}
        value={peakRank !== null ? `#${peakRank}` : '—'}
      />
      <StatItem label={t('techsUnlocked')} value={`${techsUnlocked}`} />
      <StatItem
        label={t('reputationGained')}
        value={`${reputationGained >= 0 ? '+' : ''}${Math.round(reputationGained)}`}
      />
    </ul>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
        {label}
      </span>
      <span className="font-mono text-base text-fg">{value}</span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countPlayerTechs(state: GameState): number {
  const player = state.countries[state.playerCountryId];
  return player?.science.completedTechs.length ?? 0;
}

/**
 * Resolve the era display name through the scenario message bundle. Falls
 * back to the raw era id when no translation is available (the scenario
 * `t` getter returns the key on miss, which we treat as the "missing" signal
 * — same convention as `EternalFirstVictoryModal`).
 */
function resolveEraName(
  t: (key: string | undefined | null) => string,
  era: Era | null,
  fallbackId: string,
): string {
  if (!era) return fallbackId;
  try {
    const value = t(era.nameKey);
    return value === era.nameKey ? fallbackId : value;
  } catch {
    return fallbackId;
  }
}

export default EraTransitionModal;

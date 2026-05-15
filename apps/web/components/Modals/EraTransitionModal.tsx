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

import { Modal } from './Modal';

export function EraTransitionModal() {
  const state = useGameStore((s: GameStoreState) => s.state);
  const scenario = useGameStore((s: GameStoreState) => s.scenario);
  const applyAction = useGameStore((s: GameStoreState) => s.applyAction);

  const t = useTranslations('modals.eraTransition');
  // Scenario message bundle is loaded eagerly by the play screen, so era name
  // keys can be resolved through the global UI namespace as a fallback.
  const tGlobal = useTranslations();

  // Defensive guards — ModalRoot already gates on these conditions, but the
  // modal is safe to mount standalone in tests / Storybook.
  if (!state || !scenario) return null;
  const eraState = state.eraState;
  if (!eraState?.pendingTransition) return null;

  const { fromEraId, toEraId, ticksAtTransition, statsSnapshot } =
    eraState.pendingTransition;

  const fromEra = scenario.eras?.find((e: Era) => e.id === fromEraId) ?? null;
  const toEra = scenario.eras?.find((e: Era) => e.id === toEraId) ?? null;

  // Resolve era display names. We prefer the scenario-provided i18n key
  // (resolved via the global bundle), falling back to the raw era id when no
  // translation exists yet.
  const fromName = resolveEraName(tGlobal, fromEra, fromEraId);
  const toName = resolveEraName(tGlobal, toEra, toEraId);

  const handleAcknowledge = async () => {
    await applyAction({ type: 'acknowledgeEraTransition' });
  };

  return (
    <Modal
      title={
        <span className="text-2xl font-bold text-accent">
          {t('title', { fromEra: fromName })}
        </span>
      }
      // Narrative checkpoint — must be acknowledged to keep the run moving.
      dismissable={false}
      size="md"
      footer={
        <button
          type="button"
          onClick={handleAcknowledge}
          className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-bg transition hover:bg-accent-strong"
        >
          {t('continue')}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="leading-relaxed text-fg-muted">
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
      className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface-2/40 p-3 text-sm"
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
      <span className="text-[10px] uppercase tracking-wider text-fg-faint">
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
 * Resolve the era display name. Tries the scenario-provided i18n key against
 * the global UI bundle (where scenario message JSON gets merged at runtime);
 * falls back to the raw era id when no translation is available. Mirrors the
 * `safeT` pattern used by `EternalFirstVictoryModal`.
 */
function resolveEraName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any) => string,
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

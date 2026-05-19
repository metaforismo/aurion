// Reputation detail modal.
//
// Opens when the player clicks a reputation badge (or the "Dettagli" link)
// in the HUD. Shows:
//   - The full -100..+100 scale per active bloc with a horizontal bar.
//   - The last 20 pending reputation deltas (the engine does not yet keep
//     a historical log — only `state.pendingReputationDeltas` survives across
//     ticks, and is drained at every reputation tick step). When the queue is
//     empty, we render a friendly "history unavailable" message rather than
//     adding engine state for this UI.
//
// Strict TS: every selector returns a narrowly-typed slice; the modal is a
// no-op when the active scenario doesn't carry the bloc system.

'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type {
  ActiveBlocId,
  ReputationDelta,
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import { useGameStore } from '../../lib/store';

import { Modal } from './Modal';

const BLOC_ORDER: readonly ActiveBlocId[] = ['western', 'eastern', 'non-aligned'];

const BLOC_LABEL_KEY: Readonly<Record<ActiveBlocId, string>> = {
  western: 'bloc.western',
  eastern: 'bloc.eastern',
  'non-aligned': 'bloc.non-aligned',
};

export type ReputationDetailModalProps = {
  /** Called when the modal requests dismissal (ESC, backdrop, close button). */
  onClose: () => void;
};

export function ReputationDetailModal({ onClose }: ReputationDetailModalProps) {
  const reputation = useGameStore((s) => s.state?.reputation);
  const pending = useGameStore(
    (s) => s.state?.pendingReputationDeltas,
  );
  const t = useTranslations('hud.reputation');
  const tModal = useTranslations('modals.reputation');
  const tRep = useTranslations();

  // Newest first, hard-capped at 20 entries. The engine drains the queue
  // every reputation tick step so this list is naturally short-lived; for
  // most ticks it will be empty.
  const deltas = useMemo<readonly ReputationDelta[]>(() => {
    if (!pending || pending.length === 0) return [];
    const sorted = pending.slice().sort((a, b) => b.queuedAtTick - a.queuedAtTick);
    return sorted.slice(0, 20);
  }, [pending]);

  return (
    <Modal
      onClose={onClose}
      size="lg"
      title={tModal('title')}
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h3 className="border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {tModal('currentLabel')}
          </h3>
          {reputation ? (
            <ul className="flex flex-col gap-2">
              {BLOC_ORDER.map((blocId) => {
                const value = Math.round(reputation[blocId] ?? 0);
                return (
                  <li key={blocId}>
                    <ReputationBar
                      label={t(BLOC_LABEL_KEY[blocId])}
                      value={value}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs italic text-fg-faint">
              {tModal('unavailable')}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {tModal('historyLabel')}
          </h3>
          {deltas.length === 0 ? (
            <p className="px-1 py-3 text-xs italic text-fg-faint">
              {tModal('historyEmpty')}
            </p>
          ) : (
            <ol className="flex flex-col divide-y divide-border">
              {deltas.map((d, i) => {
                // Reason key is engine-supplied. We resolve through the root
                // translator so any namespace (e.g. `rep.reason.*`) works.
                let reason = d.reasonKey;
                try {
                  const resolved = tRep(d.reasonKey);
                  if (resolved && resolved !== d.reasonKey) reason = resolved;
                } catch {
                  // Fall back to the raw key — keeps the UI rendering when a
                  // scenario contributes an unknown reason.
                }
                const blocLabel =
                  d.bloc === 'unaligned'
                    ? '—'
                    : t(BLOC_LABEL_KEY[d.bloc as ActiveBlocId]);
                return (
                  <li
                    key={`${d.queuedAtTick}-${d.reasonKey}-${i}`}
                    className="flex items-center gap-2 py-2 text-xs"
                  >
                    <span className="flex-1 truncate text-fg">{reason}</span>
                    <span className="text-[10px] uppercase tracking-wider text-fg-faint">
                      {blocLabel}
                    </span>
                    <span
                      className={cn(
                        'numeric-tabular w-12 text-right font-mono',
                        d.delta > 0
                          ? 'text-success'
                          : d.delta < 0
                            ? 'text-danger'
                            : 'text-fg-muted',
                      )}
                    >
                      {formatSigned(d.delta)}
                    </span>
                    <span className="numeric-tabular w-12 text-right font-mono text-[10px] text-fg-faint">
                      t{d.queuedAtTick}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ReputationBar({ label, value }: { label: string; value: number }) {
  // Map -100..+100 → 0..100% with 50% as the zero baseline.
  const clamped = Math.max(-100, Math.min(100, value));
  const baseline = 50;
  const offset = (clamped / 100) * 50; // 50% width per direction
  const left = clamped >= 0 ? baseline : baseline + offset;
  const width = Math.abs(offset);

  const tone =
    value > 30 ? 'bg-success' : value < -30 ? 'bg-danger' : 'bg-warning';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-fg">{label}</span>
        <span
          className={cn(
            'numeric-tabular font-mono text-xs',
            value > 30
              ? 'text-success'
              : value < -30
                ? 'text-danger'
                : 'text-fg',
          )}
        >
          {formatSigned(value)}
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2">
        {/* zero baseline marker */}
        <span
          aria-hidden
          className="absolute top-0 h-full w-px bg-border-strong"
          style={{ left: `${baseline}%` }}
        />
        <span
          aria-hidden
          className={cn('absolute top-0 h-full rounded-full', tone)}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

export default ReputationDetailModal;

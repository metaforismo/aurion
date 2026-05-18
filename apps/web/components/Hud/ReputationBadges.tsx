// Per-bloc reputation badges. Three small chips (Western / Eastern / Non-Aligned)
// that show the player's current integer reputation in each active bloc plus a
// coloured indicator dot:
//
//   < -30 → red (danger)
//   -30..30 → amber (warning / neutral)
//   > 30 → green (success)
//
// The whole strip is hidden when the active scenario does not opt into the
// Phase 3 bloc system (i.e. `state.reputation === undefined`). This keeps
// Phase 1/2 saves visually quiet — the bloc system is purely additive.
//
// Clicking a chip — or the small "Dettagli" link on the right — opens the
// `ReputationDetailModal`, which surfaces the full -100..+100 bar per bloc
// and the most recent reputation deltas the engine has queued.
//
// Strict TS: we only render once we have a non-null `state` AND a defined
// `reputation` record.

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ActiveBlocId } from '@aurion/engine';

import { cn } from '../../lib/cn';
import { useGameStore } from '../../lib/store';
import { ReputationDetailModal } from '../Modals/ReputationDetailModal';

/** Active blocs in display order — left-to-right. */
const BLOC_ORDER: readonly ActiveBlocId[] = ['western', 'eastern', 'non-aligned'];

/** Maps an `ActiveBlocId` to the corresponding `hud.reputation.bloc.*` key. */
const BLOC_LABEL_KEY: Readonly<Record<ActiveBlocId, string>> = {
  western: 'bloc.western',
  eastern: 'bloc.eastern',
  'non-aligned': 'bloc.non-aligned',
};

/** Stable `data-testid` per bloc — consumed by E2E specs. */
const BLOC_TESTID: Readonly<Record<ActiveBlocId, string>> = {
  western: 'reputation-badge-western',
  eastern: 'reputation-badge-eastern',
  'non-aligned': 'reputation-badge-non-aligned',
};

export function ReputationBadges() {
  const reputation = useGameStore((s) => s.state?.reputation);
  const t = useTranslations('hud.reputation');
  const [open, setOpen] = useState(false);

  // No Phase 3 bloc system in use → render nothing. We deliberately also
  // suppress when the reputation record exists but is empty: an empty roster
  // would render a confusing zero-chip strip.
  if (!reputation) return null;

  return (
    <>
      <div
        className="flex items-center gap-1.5"
        role="group"
        aria-label={t('title')}
      >
        {BLOC_ORDER.map((blocId) => {
          // The engine guarantees an entry per active bloc once `reputation`
          // is initialised, but we defensively coerce to 0 so a partially-
          // populated record still renders rather than crashing.
          const value = Math.round(reputation[blocId] ?? 0);
          return (
            <BlocChip
              key={blocId}
              blocId={blocId}
              value={value}
              label={t(BLOC_LABEL_KEY[blocId])}
              tooltip={t('tooltip', { bloc: t(BLOC_LABEL_KEY[blocId]) })}
              onOpen={() => setOpen(true)}
            />
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-transparent px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-fg-faint transition hover:border-border-strong hover:text-fg"
        >
          {t('details')}
        </button>
      </div>
      {open ? <ReputationDetailModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Single bloc chip
// ---------------------------------------------------------------------------

type BlocChipProps = {
  blocId: ActiveBlocId;
  value: number;
  label: string;
  tooltip: string;
  onOpen: () => void;
};

function BlocChip({ blocId, value, label, tooltip, onOpen }: BlocChipProps) {
  const dotTone = reputationDotTone(value);
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={BLOC_TESTID[blocId]}
      className="flex w-[80px] items-center gap-1.5 rounded-md border border-border bg-surface/40 px-2 py-1.5 text-left transition hover:border-border-strong"
      title={tooltip}
      data-bloc={blocId}
    >
      <span
        className={cn('inline-block h-2 w-2 shrink-0 rounded-full', dotTone)}
        aria-hidden="true"
      />
      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
        {label}
      </span>
      <span
        className={cn(
          'numeric-tabular ml-auto font-mono text-xs',
          value > 30
            ? 'text-success'
            : value < -30
              ? 'text-danger'
              : 'text-fg',
        )}
      >
        {formatSigned(value)}
      </span>
    </button>
  );
}

/** Map a raw reputation value to the dot's Tailwind background utility. */
function reputationDotTone(value: number): string {
  if (value < -30) return 'bg-danger';
  if (value > 30) return 'bg-success';
  return 'bg-warning';
}

/** Render reputation with an explicit sign so trends read at a glance. */
function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

export default ReputationBadges;

// Per-bloc reputation chips. Three compact inline pairs (Western / Eastern /
// Non-Aligned) that show the player's current integer reputation in each
// active bloc. Rendered as ticker-style small caps + signed value:
//
//   W +24    E -18    NA +5
//
// Colour rules on the signed value:
//   value < -30 → red    (danger)
//   value >  30 → green  (success)
//   value !== 0 → fg     (earned visual weight in the ±30 dead-zone)
//   value === 0 → fg-faint (muted — the chip is a position anchor, not a fact)
//
// When every bloc reads zero (game-start or pre-event scenarios) we mute the
// whole strip so the chips don't punch above their weight. Once any value
// goes non-zero the relevant chips light up while remaining zeros stay
// muted — the eye is drawn to the bloc that actually changed.
//
// The whole strip is hidden when the active scenario does not opt into the
// Phase 3 bloc system (i.e. `state.reputation === undefined`). This keeps
// Phase 1/2 saves visually quiet — the bloc system is purely additive.
//
// Clicking any chip — or the small "Dettagli" link on the right — opens the
// `ReputationDetailModal`. The DETTAGLI affordance itself is hidden when the
// engine has nothing historical to show (no pending reputation deltas) — the
// modal's "Recent changes" section would otherwise be a dead "history
// unavailable" placeholder.
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

/** Short ticker-style code per bloc — fits the Bloomberg-header aesthetic. */
const BLOC_SHORT: Readonly<Record<ActiveBlocId, string>> = {
  western: 'W',
  eastern: 'E',
  'non-aligned': 'NA',
};

/** Stable `data-testid` per bloc — consumed by E2E specs. */
const BLOC_TESTID: Readonly<Record<ActiveBlocId, string>> = {
  western: 'reputation-badge-western',
  eastern: 'reputation-badge-eastern',
  'non-aligned': 'reputation-badge-non-aligned',
};

export function ReputationBadges() {
  const reputation = useGameStore((s) => s.state?.reputation);
  const pendingDeltas = useGameStore((s) => s.state?.pendingReputationDeltas);
  const t = useTranslations('hud.reputation');
  const [open, setOpen] = useState(false);

  // No Phase 3 bloc system in use → render nothing. We deliberately also
  // suppress when the reputation record exists but is empty: an empty roster
  // would render a confusing zero-chip strip.
  if (!reputation) return null;

  // Has the engine queued any historical deltas the modal can surface? The
  // modal's "Recent changes" section is otherwise a dead "history unavailable"
  // placeholder, so we hide the DETTAGLI affordance until there's something
  // to read.
  const hasHistory = (pendingDeltas?.length ?? 0) > 0;

  return (
    <>
      <div
        className="flex items-baseline gap-3"
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
              short={BLOC_SHORT[blocId]}
              tooltip={t('tooltip', { bloc: t(BLOC_LABEL_KEY[blocId]) })}
              onOpen={() => setOpen(true)}
            />
          );
        })}
        {hasHistory ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint transition-colors hover:text-accent"
          >
            {t('details')}
          </button>
        ) : null}
      </div>
      {open ? <ReputationDetailModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Single bloc chip — small caps short code + signed number, no chrome.
// ---------------------------------------------------------------------------

type BlocChipProps = {
  blocId: ActiveBlocId;
  value: number;
  short: string;
  tooltip: string;
  onOpen: () => void;
};

function BlocChip({ blocId, value, short, tooltip, onOpen }: BlocChipProps) {
  // Zero values are muted — a stable anchor in the row but visually quiet.
  // Non-zero values earn semantic colour (success / danger past ±30, fg in
  // the dead-zone).
  const valueClass =
    value === 0
      ? 'text-fg-faint'
      : value > 30
        ? 'text-success'
        : value < -30
          ? 'text-danger'
          : 'text-fg';

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={BLOC_TESTID[blocId]}
      className="flex items-baseline gap-1.5 text-left transition-colors hover:text-accent"
      title={tooltip}
      data-bloc={blocId}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
        {short}
      </span>
      <span className={cn('numeric-tabular font-mono text-sm', valueClass)}>
        {formatSigned(value)}
      </span>
    </button>
  );
}

/** Render reputation with an explicit sign so trends read at a glance. */
function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

export default ReputationBadges;

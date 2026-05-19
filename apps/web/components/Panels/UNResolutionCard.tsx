// United Nations resolution card.
//
// Renders a single UNResolution: kind icon + title, time-remaining, target,
// vote tallies (yes / no / abstain) with progress chips, and — when the
// player is a council voter on an open resolution — the Vote buttons
// (yes / no / abstain, plus an extra red Veto for permanent council members).
//
// Pure presentational + dispatch: it never reaches into the engine itself,
// only the store's `applyAction`. The parent UNPanel wires up `onErrors`.

'use client';

import { useTranslations } from 'next-intl';
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
  UNResolution,
  UNResolutionKind,
  UNVote,
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import { ActionButton } from './shared/ActionButton';
import { Section } from './shared/Section';

// ---------------------------------------------------------------------------
// Static metadata (icons + per-status tones).
// ---------------------------------------------------------------------------

const KIND_ICON: Record<UNResolutionKind, LucideIcon> = {
  sanctions: Ban,
  peacekeeping: Shield,
  recognition: Stamp,
  humanitarian: HeartHandshake,
  climate: Leaf,
  nonProliferation: AlertTriangle,
  condemnation: Megaphone,
};

// Editorial pass: each resolution shows status via a 2px left rule + a
// status-coloured chip in the header — never a tinted surface fill.
const STATUS_RULE: Record<UNResolution['status'], string> = {
  voting: 'border-l-2 border-warning',
  passed: 'border-l-2 border-success',
  failed: 'border-l-2 border-border',
  vetoed: 'border-l-2 border-danger',
};

const STATUS_CHIP: Record<UNResolution['status'], string> = {
  voting: 'text-warning',
  passed: 'text-success',
  failed: 'text-fg-faint',
  vetoed: 'text-danger',
};

// Per-vote chip styling. Veto pills reuse the danger token; abstain stays neutral.
const VOTE_CHIP_TONE: Record<UNVote, string> = {
  yes: 'border-success text-success',
  no: 'border-danger text-danger',
  abstain: 'border-border text-fg-muted',
  veto: 'border-danger text-danger',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type UNResolutionCardProps = {
  resolution: UNResolution;
  /** Current game tick — used to compute the "weeks remaining" countdown. */
  currentTick: number;
  /** Player country id — controls whether the Vote panel is shown. */
  playerCountryId: CountryId;
  /** Council member ids from the active scenario; empty when ONU is disabled. */
  councilMemberIds: readonly CountryId[];
  /** Lookup: country id → translated display name (from the scenario bundle). */
  countryName: (id: CountryId) => string;
  /** Lookup: region id → translated display name. */
  regionName: (id: string) => string;
  /**
   * Scenario message getter for resolving `un.<scenario>.<kind>.title` /
   * `*.description` keys that live in the side-car bundle. Returns the raw
   * key on miss; the card falls back to a generic per-kind label.
   */
  tScenario: (key: string | undefined | null) => string;
  /** Forwarded so the Vote / Veto buttons can surface engine errors. */
  onErrors?: (errors: string[]) => void;
  /** Vote dispatcher. Always returns the engine's i18n-key error array. */
  onVote: (resolutionId: string, vote: UNVote) => Promise<string[]>;
  /**
   * Optional confirm hook used by the Veto button — caller decides whether
   * to gate it behind a confirm modal (typically yes, given the rep cost).
   */
  onVeto?: (resolutionId: string) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UNResolutionCard({
  resolution,
  currentTick,
  playerCountryId,
  councilMemberIds,
  countryName,
  regionName,
  tScenario,
  onErrors,
  onVote,
  onVeto,
}: UNResolutionCardProps) {
  const t = useTranslations('panelUN');

  const Icon = KIND_ICON[resolution.kind];
  const isVoting = resolution.status === 'voting';

  // Council membership flags — used to gate the Vote / Veto panel.
  const playerIsCouncil = councilMemberIds.includes(playerCountryId);
  const playerHasVoted = resolution.votes[playerCountryId] !== undefined;

  // Time-remaining is reported in weeks (= ticks) so it matches the rest of
  // the HUD's vocabulary. Negative values clamp to 0 for the "closing now"
  // edge case where the engine hasn't yet flipped the status.
  const remainingTicks = Math.max(
    0,
    resolution.votingClosesAtTick - currentTick,
  );

  // Tally the votes. Veto is folded into the "no" column for the chip
  // breakdown but also surfaces explicitly as a separate badge below.
  const tally = countVotes(resolution.votes);

  const targetLine = resolveTargetLabel(resolution, countryName, regionName);

  return (
    <article
      className={cn(
        'flex flex-col gap-2 py-3 pl-3 transition',
        STATUS_RULE[resolution.status],
      )}
    >
      {/* Header: kind icon + title + status pill. */}
      <header className="flex items-start gap-2">
        <Icon
          aria-hidden
          className={cn('mt-0.5 h-4 w-4 shrink-0', STATUS_CHIP[resolution.status])}
        />
        <div className="flex flex-1 flex-col gap-0.5">
          <h3 className="text-sm font-semibold leading-tight text-fg">
            {resolveScenarioKey(
              tScenario,
              resolution.titleKey,
              fallbackKindTitle(resolution),
            )}
          </h3>
          <p className="text-[11px] leading-snug text-fg-muted">
            {resolveScenarioKey(tScenario, resolution.descriptionKey, '')}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 font-mono text-[10px] uppercase tracking-[0.14em]',
            STATUS_CHIP[resolution.status],
          )}
        >
          {t(`status.${resolution.status}`)}
        </span>
      </header>

      {/* Meta row: target country / region + countdown (only while voting). */}
      <dl className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-fg-muted">
        {targetLine ? (
          <div className="flex items-baseline gap-1">
            <dt className="uppercase tracking-wider text-fg-faint">
              {t('target.label')}
            </dt>
            <dd className="font-mono text-fg">{targetLine}</dd>
          </div>
        ) : null}
        <div className="flex items-baseline gap-1">
          <dt className="uppercase tracking-wider text-fg-faint">
            {t('proposer')}
          </dt>
          <dd className="font-mono text-fg">
            {countryName(resolution.proposerCountryId)}
          </dd>
        </div>
        {isVoting ? (
          <div className="flex items-baseline gap-1">
            <dt className="uppercase tracking-wider text-fg-faint">
              {t('votingClosesAt')}
            </dt>
            <dd className="font-mono text-warning">
              {t('weeksRemaining', { n: remainingTicks })}
            </dd>
          </div>
        ) : null}
      </dl>

      {/* Tally chips — yes / no / abstain (+ veto if any). */}
      <ul
        className="flex flex-wrap gap-1.5 text-[10px] font-mono uppercase"
        aria-label={t('tally.label')}
      >
        <TallyChip vote="yes" count={tally.yes} label={t('vote.yes')} />
        <TallyChip vote="no" count={tally.no} label={t('vote.no')} />
        <TallyChip
          vote="abstain"
          count={tally.abstain}
          label={t('vote.abstain')}
        />
        {tally.veto > 0 ? (
          <TallyChip vote="veto" count={tally.veto} label={t('vote.veto')} />
        ) : null}
      </ul>

      {/* Voting controls — only when player is a council voter, on an open
          resolution, and hasn't voted yet. */}
      {isVoting && playerIsCouncil && !playerHasVoted ? (
        <div className="grid grid-cols-3 gap-1.5">
          <ActionButton
            tone="primary"
            onClick={() => onVote(resolution.id, 'yes')}
            onErrors={onErrors}
          >
            {t('vote.yes')}
          </ActionButton>
          <ActionButton
            tone="neutral"
            onClick={() => onVote(resolution.id, 'no')}
            onErrors={onErrors}
          >
            {t('vote.no')}
          </ActionButton>
          <ActionButton
            tone="neutral"
            onClick={() => onVote(resolution.id, 'abstain')}
            onErrors={onErrors}
          >
            {t('vote.abstain')}
          </ActionButton>
          {/* Veto: shown only for permanent council members. The spec asks for
              a confirm step because the reputation hit is significant. */}
          {onVeto ? (
            <div className="col-span-3">
              <ActionButton
                tone="danger"
                onClick={() => onVeto(resolution.id)}
                onErrors={onErrors}
                hint={t('vote.vetoHint')}
              >
                {t('vote.veto')}
              </ActionButton>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* "Already voted" hint when applicable. */}
      {isVoting && playerIsCouncil && playerHasVoted ? (
        <p className="text-[11px] italic text-fg-faint">
          {t('alreadyVoted', {
            vote: t(`vote.${resolution.votes[playerCountryId] ?? 'abstain'}`),
          })}
        </p>
      ) : null}
      {isVoting && !playerIsCouncil ? (
        <p className="text-[11px] italic text-fg-faint">
          {t('notCouncilMember')}
        </p>
      ) : null}

      {/* Per-country vote pills (collapsible). */}
      {Object.keys(resolution.votes).length > 0 || councilMemberIds.length > 0 ? (
        <Section
          title={
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {t('detailedVotes')}
            </span>
          }
          defaultOpen={false}
          trailing={`${Object.keys(resolution.votes).length} / ${councilMemberIds.length}`}
        >
          <ul className="flex flex-wrap gap-1.5">
            {(councilMemberIds.length > 0
              ? councilMemberIds
              : (Object.keys(resolution.votes) as CountryId[])
            ).map((cid) => {
              const v = resolution.votes[cid];
              return (
                <li
                  key={cid}
                  className={cn(
                    'flex items-center gap-1 rounded-sm border bg-transparent px-2 py-0.5 text-[10px] font-mono uppercase',
                    v ? VOTE_CHIP_TONE[v] : 'border-border text-fg-faint',
                  )}
                >
                  <span className="truncate">{countryName(cid)}</span>
                  <span aria-hidden>·</span>
                  <span>{v ? t(`vote.${v}`) : t('vote.pending')}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

    </article>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countVotes(
  votes: Record<CountryId, UNVote>,
): Record<UNVote, number> {
  const out: Record<UNVote, number> = { yes: 0, no: 0, abstain: 0, veto: 0 };
  for (const v of Object.values(votes)) out[v] += 1;
  return out;
}

function resolveTargetLabel(
  resolution: UNResolution,
  countryName: (id: CountryId) => string,
  regionName: (id: string) => string,
): string | null {
  if (resolution.targetCountryId) return countryName(resolution.targetCountryId);
  if (resolution.targetRegionId) return regionName(resolution.targetRegionId);
  return null;
}

/**
 * Resolve a scenario-defined key (e.g. `un.gf.condemnation.title`) through
 * the scenario side-car bundle. The side-car getter returns the raw key on
 * miss, in which case we degrade to the supplied generic fallback so the
 * card never renders a dangling i18n key in front of the player.
 */
function resolveScenarioKey(
  tScenario: (key: string | undefined | null) => string,
  key: string | undefined,
  fallback: string,
): string {
  if (!key) return fallback;
  const value = tScenario(key);
  if (!value || value === key) return fallback;
  return value;
}

function fallbackKindTitle(resolution: UNResolution): string {
  return resolution.kind;
}

// ---------------------------------------------------------------------------
// Tally chip — small visual element used in the header strip.
// ---------------------------------------------------------------------------

function TallyChip({
  vote,
  count,
  label,
}: {
  vote: UNVote;
  count: number;
  label: string;
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-1 rounded-sm border bg-transparent px-2 py-0.5',
        VOTE_CHIP_TONE[vote],
      )}
    >
      <span aria-hidden>{label}</span>
      <span className="numeric-tabular font-semibold">{count}</span>
    </li>
  );
}

export default UNResolutionCard;

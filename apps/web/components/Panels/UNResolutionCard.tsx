'use client';

// One UN resolution: what it says, who tabled it against whom, how long the
// vote stays open, how the votes stand, what each outcome brings — and the
// ballot, when the player has not cast theirs yet.

import type { UNResolution, UNVote } from '@aurion/engine';
import { Check, ChevronDown, Minus, ShieldX, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { cn } from '../../lib/cn';
import { useGameStore } from '../../lib/store';
import { Button, Card, Chip, Meter, type Tone } from '../ui';

import { Fact } from './diplomacy/parts';
import { useCommit, type World } from './diplomacy/world';
import { KIND_ICON, tallyOf, useEffectLines, useResolutionText } from './un/shared';

const STATUS_TONE: Record<UNResolution['status'], Tone> = {
  voting: 'info',
  passed: 'success',
  failed: 'neutral',
  vetoed: 'danger',
};

const VOTE_FILL: Record<UNVote, string> = {
  yes: 'bg-success',
  no: 'bg-[#ff5d4d]',
  abstain: 'bg-white/40',
  veto: 'bg-warning',
};

const VOTES: readonly UNVote[] = ['yes', 'no', 'abstain', 'veto'];

export function UNResolutionCard({
  w,
  resolution,
  isCouncil,
  onErrors,
}: {
  w: World;
  resolution: UNResolution;
  /** Council members may veto. */
  isCouncil: boolean;
  onErrors?: (errors: string[]) => void;
}) {
  const t = useTranslations('panelUN');
  const confirm = useGameStore((s) => s.confirm);
  const commit = useCommit(onErrors);
  const text = useResolutionText(w)(resolution);
  const effectLines = useEffectLines(w);
  const [showVotes, setShowVotes] = useState(false);

  const Icon = KIND_ICON[resolution.kind];
  const voting = resolution.status === 'voting';
  const myVote = resolution.votes[w.player.id];
  const total = Object.keys(w.state.countries).length;
  const tally = tallyOf(resolution, total);
  const weeksLeft = Math.max(0, resolution.votingClosesAtTick - w.state.tick);
  const span = Math.max(1, resolution.votingClosesAtTick - resolution.proposedAtTick);
  const onPass = effectLines(resolution, resolution.effects.onPass);
  const onFail = effectLines(resolution, resolution.effects.onFail);
  const passText =
    onPass.length > 0
      ? onPass.join(' ')
      : resolution.kind === 'nonProliferation'
        ? t('effects.treaty')
        : t('effects.none');
  const target = resolution.targetCountryId
    ? w.nameOf(resolution.targetCountryId)
    : resolution.targetRegionId
      ? w.regionName(resolution.targetRegionId)
      : null;

  const cast = (vote: UNVote) => commit({ type: 'voteUN', resolutionId: resolution.id, vote });
  const veto = () =>
    confirm({
      titleKey: 'panelUN.confirm.veto.title',
      descriptionKey: 'panelUN.confirm.veto.description',
      confirmKey: 'panelUN.vote.veto',
      cancelKey: 'common.cancel',
      tone: 'danger',
      onConfirm: async () => {
        await cast('veto');
      },
    });

  return (
    <Card
      tone={voting && myVote === undefined ? 'info' : 'neutral'}
      data-testid={`un-resolution-${resolution.id}`}
      data-status={resolution.status}
      className="flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-fg-muted">
          <Icon aria-hidden className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-semibold leading-tight text-fg">{text.title}</h4>
          {text.title !== t(`kind.${resolution.kind}`) ? (
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-fg-faint">
              {t(`kind.${resolution.kind}`)}
            </p>
          ) : null}
        </div>
        <Chip tone={STATUS_TONE[resolution.status]}>{t(`status.${resolution.status}`)}</Chip>
      </div>
      {text.description ? <p className="text-[11px] leading-snug text-fg-muted">{text.description}</p> : null}

      <dl className="flex flex-col gap-1">
        <Fact label={t('card.proposer')} words>{w.nameOf(resolution.proposerCountryId)}</Fact>
        {target ? (
          <Fact label={t('card.target')} words>
            {target}
          </Fact>
        ) : null}
      </dl>

      {voting ? (
        <Meter
          tone="info"
          value={(w.state.tick - resolution.proposedAtTick) / span}
          label={t('card.closes')}
          valueLabel={t('weeksRemaining', { n: weeksLeft })}
        />
      ) : null}

      <div>
        <div
          className="flex h-2 overflow-hidden rounded-full bg-white/10"
          role="img"
          aria-label={t('tally.aria', { yes: tally.yes, no: tally.no, abstain: tally.abstain, veto: tally.veto })}
        >
          {VOTES.map((v) =>
            tally[v] > 0 ? (
              <span key={v} className={cn('h-full', VOTE_FILL[v])} style={{ width: `${(tally[v] / total) * 100}%` }} />
            ) : null,
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-fg-muted">
          {VOTES.filter((v) => v !== 'veto' || tally.veto > 0).map((v) => (
            <span key={v} className="inline-flex items-center gap-1">
              <span aria-hidden className={cn('h-2 w-2 rounded-full', VOTE_FILL[v])} />
              {t(`vote.${v}`)} <span className="numeric-tabular text-fg">{tally[v]}</span>
            </span>
          ))}
          {voting && tally.pending > 0 ? <span className="text-fg-faint">{t('tally.pending', { n: tally.pending })}</span> : null}
        </div>
        <button
          type="button"
          aria-expanded={showVotes}
          onClick={() => setShowVotes((v) => !v)}
          className="mt-1.5 inline-flex items-center gap-1 rounded text-[11px] font-medium text-fg-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t('detailedVotes')}
          <ChevronDown aria-hidden className={cn('h-3.5 w-3.5 transition-transform', showVotes && 'rotate-180')} />
        </button>
        {showVotes ? (
          <dl className="mt-1.5 flex flex-col gap-1.5 text-[11px] leading-snug">
            {VOTES.filter((v) => tally[v] > 0).map((v) => (
              <div key={v}>
                <dt className="font-semibold text-fg">{t(`vote.${v}`)}</dt>
                <dd className="text-fg-muted">
                  {Object.entries(resolution.votes)
                    .filter(([, vote]) => vote === v)
                    .map(([id]) => w.nameOf(id))
                    .join(', ')}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2.5 text-[11px] leading-snug">
        {voting ? (
          <>
            <p className="text-fg-muted">
              <span className="font-semibold text-success">{t('effects.ifPassed')}</span> {passText}
            </p>
            {onFail.length > 0 ? (
              <p className="text-fg-muted">
                <span className="font-semibold text-[#ff8a7d]">{t('effects.ifFailed')}</span> {onFail.join(' ')}
              </p>
            ) : null}
          </>
        ) : (
          // Closed: only the outcome that actually applied.
          <p className="text-fg-muted">
            <span className="font-semibold text-fg">{t('effects.applied')}</span>{' '}
            {resolution.status === 'passed'
              ? passText
              : resolution.status === 'failed' && onFail.length > 0
                ? onFail.join(' ')
                : t('effects.nothing')}
          </p>
        )}
      </div>

      {voting ? (
        myVote === undefined ? (
          <div className="flex flex-col gap-2" role="group" aria-label={t('vote.label')}>
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" icon={Check} onClick={() => void cast('yes')} data-testid="un-vote-yes">
                {t('vote.yes')}
              </Button>
              <Button size="sm" icon={X} onClick={() => void cast('no')} data-testid="un-vote-no">
                {t('vote.no')}
              </Button>
              <Button size="sm" icon={Minus} onClick={() => void cast('abstain')} data-testid="un-vote-abstain">
                {t('vote.abstain')}
              </Button>
            </div>
            {isCouncil ? (
              <Button size="sm" variant="danger" icon={ShieldX} onClick={veto} data-testid="un-vote-veto">
                {t('vote.vetoCta')}
              </Button>
            ) : null}
            <p className="text-[11px] leading-snug text-fg-faint">{t('vote.rules')}</p>
          </div>
        ) : (
          <p role="status" className="text-[11px] text-fg-muted" data-testid="un-voted">
            {t('alreadyVoted', { vote: t(`vote.${myVote}`) })}
          </p>
        )
      ) : myVote !== undefined ? (
        <p className="text-[11px] text-fg-faint">{t('youVoted', { vote: t(`vote.${myVote}`) })}</p>
      ) : null}
    </Card>
  );
}

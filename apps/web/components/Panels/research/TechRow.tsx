'use client';

// One technology in the tree: a compact line that says what state it is in,
// opening to the full card — what it does, what it needs, what it leads to,
// and the button to start it (or the reason it cannot start yet).

import { Check, ChevronDown, CircleDot, FlaskConical, Lock, Star } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { SpaceMilestoneEntry, TechId } from '@aurion/engine';

import { cn } from '../../../lib/cn';
import { Button, Chip, Meter } from '../../ui';

import { describeEffects, weeksFor, type EffectLine, type TechNode } from './model';

export type TechRowProps = {
  node: TechNode;
  name: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  recommended: boolean;
  /** Research points per week, policies included. */
  output: number;
  /** Points already gathered — only meaningful for the tech in progress. */
  accumulated: number;
  /** The research currently running, when it is not this one. */
  busyWith: { name: string; weeksLeft: number | null } | null;
  nameOf: (id: TechId) => string;
  isDone: (id: TechId) => boolean;
  onJump: (id: TechId) => void;
  onStart: () => void;
  starting: boolean;
  /** Set for space "firsts"; `entry` is undefined until anyone gets there. */
  milestone: {
    entry: SpaceMilestoneEntry | undefined;
    playerId: string;
    countryName: (id: string) => string;
  } | null;
};

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const SHELL: Record<TechNode['status'], string> = {
  done: 'border-success/20 bg-success/[0.04]',
  researching: 'border-[#5cc8ff]/35 bg-[#5cc8ff]/[0.06]',
  available: 'border-white/[0.12] bg-white/[0.04]',
  locked: 'border-white/[0.06] bg-transparent',
};

export function TechRow(props: TechRowProps) {
  const { node, name, open, onToggle, recommended, output, accumulated, milestone } = props;
  const t = useTranslations('panelResearch');
  const { tech, status } = node;
  const weeks = weeksFor(tech.cost - (status === 'researching' ? accumulated : 0), output);
  const progress = tech.cost > 0 ? Math.min(1, accumulated / tech.cost) : 0;

  let subtitle: string;
  if (status === 'done') subtitle = t('row.done');
  else if (status === 'researching') subtitle = t('row.researching', { pct: Math.round(progress * 100) });
  else if (status === 'locked') {
    subtitle = t('row.locked', { list: node.missing.map(props.nameOf).join(', ') });
  } else {
    subtitle =
      weeks === null ? t('row.cost', { points: tech.cost }) : t('row.costWeeks', { points: tech.cost, weeks });
  }

  const panelId = `tech-detail-${tech.id}`;

  return (
    <li
      id={`tech-${tech.id}`}
      data-testid={`tech-${tech.id}`}
      data-status={status}
      className={cn('scroll-mt-2 overflow-hidden rounded-xl border', SHELL[status], open && 'border-white/25')}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]',
          FOCUS,
        )}
      >
        <StatusIcon status={status} />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-[13px] font-medium',
              status === 'locked' ? 'text-fg-muted' : 'text-fg',
            )}
          >
            {name}
          </span>
          <span className="block truncate text-[11px] text-fg-faint">{subtitle}</span>
        </span>
        {milestone ? (
          <Star
            aria-hidden
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              milestone.entry?.firstAchieverCountryId === milestone.playerId
                ? 'fill-accent text-accent'
                : 'text-fg-faint',
            )}
          />
        ) : null}
        {milestone ? <span className="sr-only">{t('milestone.badge')}</span> : null}
        {recommended ? <Chip tone="accent">{t('recommended.chip')}</Chip> : null}
        <ChevronDown
          aria-hidden
          className={cn('h-4 w-4 shrink-0 text-fg-faint transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? <TechDetail {...props} panelId={panelId} weeks={weeks} progress={progress} /> : null}
    </li>
  );
}

function StatusIcon({ status }: { status: TechNode['status'] }) {
  const t = useTranslations('panelResearch.status');
  const box = 'grid h-7 w-7 shrink-0 place-items-center rounded-full';
  switch (status) {
    case 'done':
      return (
        <span className={cn(box, 'bg-success/15 text-success')} title={t('done')}>
          <Check aria-hidden className="h-3.5 w-3.5" />
        </span>
      );
    case 'researching':
      return (
        <span className={cn(box, 'bg-[#5cc8ff]/15 text-[#8ad8ff]')} title={t('researching')}>
          <FlaskConical aria-hidden className="h-3.5 w-3.5" />
        </span>
      );
    case 'available':
      return (
        <span className={cn(box, 'bg-accent/15 text-accent')} title={t('available')}>
          <CircleDot aria-hidden className="h-3.5 w-3.5" />
        </span>
      );
    case 'locked':
      return (
        <span className={cn(box, 'bg-white/[0.06] text-fg-faint')} title={t('locked')}>
          <Lock aria-hidden className="h-3.5 w-3.5" />
        </span>
      );
  }
}

function TechDetail({
  node,
  description,
  output,
  accumulated,
  busyWith,
  nameOf,
  isDone,
  onJump,
  onStart,
  starting,
  milestone,
  panelId,
  weeks,
  progress,
}: TechRowProps & { panelId: string; weeks: number | null; progress: number }) {
  const t = useTranslations('panelResearch');
  const fmt = useFormatter();
  const { tech, status } = node;
  const effects = describeEffects(tech.effects);

  const effectLabel = (line: EffectLine): string => {
    switch (line.kind) {
      case 'percent':
        return `${t(`fx.stat.${line.stat}`)} ${fmt.number(line.value, { style: 'percent', signDisplay: 'always', maximumFractionDigits: 1 })}`;
      case 'points':
        return `${t(`fx.stat.${line.stat}`)} ${fmt.number(line.value, { signDisplay: 'always', maximumFractionDigits: 1 })}`;
      case 'spy':
        return t('fx.spyUnlock', { name: t.has(`fx.spy.${line.spyType}`) ? t(`fx.spy.${line.spyType}`) : line.spyType });
      case 'action':
        return t.has(`fx.action.${line.action}`) ? t(`fx.action.${line.action}`) : t('fx.actionOther');
      case 'other':
        return t('fx.other');
    }
  };

  return (
    <div id={panelId} className="flex flex-col gap-3 border-t border-white/10 px-3 pb-3 pt-2.5">
      {description ? <p className="text-[12px] leading-relaxed text-fg-muted">{description}</p> : null}

      {effects.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-fg-faint">{t('detail.effects')}</p>
          <ul className="flex flex-wrap gap-1">
            {effects.map((line, i) => (
              <li key={i}>
                <Chip className="font-mono">{effectLabel(line)}</Chip>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tech.prereqs.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-fg-faint">{t('detail.requires')}</p>
          <ul className="flex flex-wrap gap-1">
            {tech.prereqs.map((id) => (
              <li key={id}>
                <JumpChip done={isDone(id)} onClick={() => onJump(id)}>
                  {nameOf(id)}
                </JumpChip>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {node.unlocks.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-fg-faint">{t('detail.leadsTo')}</p>
          <ul className="flex flex-wrap gap-1">
            {node.unlocks.map((id) => (
              <li key={id}>
                <JumpChip done={isDone(id)} onClick={() => onJump(id)}>
                  {nameOf(id)}
                </JumpChip>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {milestone ? <MilestoneNote tech={tech} milestone={milestone} /> : null}

      {status === 'researching' ? (
        <div>
          <Meter
            value={progress}
            tone="info"
            label={t('detail.progress')}
            valueLabel={t('points', { done: Math.floor(accumulated), total: tech.cost })}
          />
          <p className="mt-1.5 text-[11px] text-fg-faint">
            {weeks === null ? t('eta.never') : t('eta.weeks', { weeks })}
          </p>
        </div>
      ) : null}

      {status === 'available' ? (
        busyWith ? (
          <p className="text-[11px] leading-snug text-warning">
            {busyWith.weeksLeft === null
              ? t('blocked.busy', { name: busyWith.name })
              : t('blocked.busyWeeks', { name: busyWith.name, weeks: busyWith.weeksLeft })}
          </p>
        ) : (
          <div>
            <Button
              block
              icon={FlaskConical}
              loading={starting}
              onClick={onStart}
              data-testid={`tech-start-${tech.id}`}
            >
              {t('start')}
            </Button>
            <p className="mt-1.5 text-center text-[11px] text-fg-faint">
              {weeks === null
                ? t('startCostNoOutput', { points: tech.cost })
                : t('startCost', { points: tech.cost, weeks, output: fmt.number(output, { maximumFractionDigits: 1 }) })}
            </p>
          </div>
        )
      ) : null}

      {status === 'locked' ? (
        <p className="text-[11px] leading-snug text-warning">
          {t('blocked.locked', { list: node.missing.map(nameOf).join(', ') })}
        </p>
      ) : null}
    </div>
  );
}

/** A technology name that takes the player to that technology. */
function JumpChip({ done, onClick, children }: { done: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4 transition-colors hover:border-white/40 hover:text-fg',
        done ? 'border-success/30 bg-success/[0.07] text-success' : 'border-white/10 bg-white/[0.04] text-fg-muted',
        FOCUS,
      )}
    >
      {done ? <Check aria-hidden className="h-3 w-3" /> : null}
      {children}
    </button>
  );
}

function MilestoneNote({
  tech,
  milestone,
}: {
  tech: TechNode['tech'];
  milestone: NonNullable<TechRowProps['milestone']>;
}) {
  const t = useTranslations('panelResearch.milestone');
  const { entry, playerId, countryName } = milestone;
  const first = entry?.firstAchieverCountryId ?? null;
  const others = (entry?.achievers ?? []).filter((id) => id !== first);
  const mine = first === playerId;

  return (
    <div
      className={cn(
        'rounded-lg border px-2.5 py-2 text-[11px] leading-snug',
        mine ? 'border-accent/30 bg-accent/[0.08] text-fg' : 'border-white/10 bg-white/[0.03] text-fg-muted',
      )}
    >
      <p className="flex items-start gap-1.5">
        <Star aria-hidden className={cn('mt-0.5 h-3 w-3 shrink-0', mine ? 'fill-accent text-accent' : 'text-fg-faint')} />
        <span>
          {first === null
            ? t('open', { first: tech.prestigeFirst ?? 0, follow: tech.prestigeFollow ?? 0 })
            : mine
              ? t('yours', { week: entry?.firstAchievedAtTick ?? 0, first: tech.prestigeFirst ?? 0 })
              : t('taken', {
                  country: countryName(first),
                  week: entry?.firstAchievedAtTick ?? 0,
                  follow: tech.prestigeFollow ?? 0,
                })}
        </span>
      </p>
      {others.length > 0 ? (
        <p className="mt-1 pl-[18px] text-fg-faint">{t('followers', { list: others.map(countryName).join(', ') })}</p>
      ) : null}
    </div>
  );
}

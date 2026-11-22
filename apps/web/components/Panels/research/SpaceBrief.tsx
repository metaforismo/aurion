'use client';

// Space branch briefing: how much of the branch is researched, which
// megaprojects that share unlocks, and who holds each "first in the world".

import { Check, Lock, Rocket, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { SpaceMilestoneState, TechDefinition, TechId } from '@aurion/engine';

import { cn } from '../../../lib/cn';
import { Card, Chip } from '../../ui';

import type { SpaceGate } from './model';

export function SpaceBrief({
  done,
  total,
  gates,
  milestoneTechs,
  milestones,
  playerId,
  nameOf,
  countryName,
  onJump,
  onOpenCosmos,
}: {
  done: number;
  total: number;
  gates: readonly SpaceGate[];
  /** Technologies that grant prestige to whoever gets there first. */
  milestoneTechs: readonly TechDefinition[];
  milestones: SpaceMilestoneState | undefined;
  playerId: string;
  nameOf: (id: TechId) => string;
  countryName: (id: string) => string;
  onJump: (id: TechId) => void;
  onOpenCosmos: () => void;
}) {
  const t = useTranslations('panelResearch.space');
  const tCosmos = useTranslations('cosmos');
  const share = total > 0 ? done / total : 0;

  return (
    <Card tone="info" className="flex flex-col gap-3" data-testid="research-space-brief">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-medium text-fg">{t('title')}</p>
          <p className="numeric-tabular font-mono text-[13px] text-[#8ad8ff]">
            {t('count', { done, total })}
          </p>
        </div>
        {/* One segment per technology: gates are counted in technologies. */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label={t('title')}
          className="mt-2 flex gap-0.5"
        >
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn('h-1.5 flex-1 rounded-full', i < done ? 'bg-[#5cc8ff]' : 'bg-white/10')}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-fg-muted">
          {t('why', { pct: Math.round(share * 100) })}
        </p>
      </div>

      {gates.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-white/10 pt-3">
          {gates.map((gate) => (
            <li key={gate.projectId} className="flex items-center gap-2 text-[12px]">
              {gate.reached ? (
                <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-success" />
              ) : (
                <Lock aria-hidden className="h-3.5 w-3.5 shrink-0 text-fg-faint" />
              )}
              <span className={cn('min-w-0 flex-1 truncate', gate.reached ? 'text-fg' : 'text-fg-muted')}>
                {tCosmos(`projects.${gate.projectId}.name`)}
              </span>
              <span className="numeric-tabular shrink-0 font-mono text-[11px] text-fg-faint">
                {gate.reached
                  ? t('gateReached')
                  : t('gateMissing', { n: gate.needed - done, needed: gate.needed })}
              </span>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={onOpenCosmos}
              className="mt-1 inline-flex items-center gap-1.5 rounded text-[11px] font-medium text-[#8ad8ff] underline decoration-[#5cc8ff]/40 underline-offset-2 transition-colors hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Rocket aria-hidden className="h-3 w-3" />
              {t('openCosmos')}
            </button>
          </li>
        </ul>
      ) : null}

      {milestoneTechs.length > 0 ? (
        <div className="border-t border-white/10 pt-3">
          <p className="mb-1 text-[13px] font-medium text-fg">{t('firsts.title')}</p>
          <p className="mb-2 text-[11px] leading-snug text-fg-muted">{t('firsts.intro')}</p>
          <ul className="flex flex-col gap-1">
            {milestoneTechs.map((tech) => {
              const first = milestones?.[tech.id]?.firstAchieverCountryId ?? null;
              const mine = first === playerId;
              return (
                <li key={tech.id}>
                  <button
                    type="button"
                    onClick={() => onJump(tech.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[12px] transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <Star
                      aria-hidden
                      className={cn('h-3.5 w-3.5 shrink-0', mine ? 'fill-accent text-accent' : 'text-fg-faint')}
                    />
                    <span className="min-w-0 flex-1 truncate text-fg">{nameOf(tech.id)}</span>
                    {first === null ? (
                      <Chip tone="info">{t('firsts.open', { points: tech.prestigeFirst ?? 0 })}</Chip>
                    ) : mine ? (
                      <Chip tone="accent">{t('firsts.yours')}</Chip>
                    ) : (
                      <Chip>{countryName(first)}</Chip>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

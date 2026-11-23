'use client';

// One faction: how satisfied it is, how much it weighs, what it wants, and
// the concession button with its price and its result.

import { Briefcase, ChevronDown, Church, HandCoins, Megaphone, Scale, Shield, type LucideIcon } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { FACTION_HOSTILE_AT, FACTION_LEVERAGE, FACTION_LOYAL_AT, factionStance } from '@aurion/engine';
import type { FactionId, GovernmentType, PolicyId } from '@aurion/engine';

import { cn } from '../../../lib/cn';
import { money, percent } from '../../../lib/format';
import { Button, Card, Chip, Meter, type Tone } from '../../ui';
import { TAX_FACTION_EFFECT } from '../economy/model';

import { GOVERNMENT_BONUS, HOSTILE_THRESHOLD, PLACATE_BOOST, PLACATE_COST } from './model';

const ICON: Record<FactionId, LucideIcon> = {
  army: Shield,
  business: Briefcase,
  religious: Church,
  populist: Megaphone,
  reformist: Scale,
};

type Mood = 'hostile' | 'unhappy' | 'lukewarm' | 'content' | 'loyal';

function moodOf(satisfaction: number): Mood {
  if (satisfaction < HOSTILE_THRESHOLD) return 'hostile';
  if (satisfaction < 40) return 'unhappy';
  if (satisfaction < 60) return 'lukewarm';
  if (satisfaction < 80) return 'content';
  return 'loyal';
}

const MOOD_TONE: Record<Mood, Tone> = {
  hostile: 'danger',
  unhappy: 'warning',
  lukewarm: 'neutral',
  content: 'success',
  loyal: 'success',
};

export function FactionCard({
  id,
  satisfaction,
  share,
  drift,
  government,
  policies,
  urgent,
  canAfford,
  busy,
  onPlacate,
}: {
  id: FactionId;
  satisfaction: number;
  /** Share of total influence, 0..1. */
  share: number;
  /** Weekly satisfaction change if the player does nothing. */
  drift: number;
  government: GovernmentType;
  /** Policies this faction likes / dislikes; null when the save has no policies. */
  policies: { likes: PolicyId[]; dislikes: PolicyId[] } | null;
  urgent: boolean;
  canAfford: boolean;
  busy: boolean;
  onPlacate: () => void;
}) {
  const t = useTranslations('panelPolitics');
  const tPolicy = useTranslations('policies.items');
  const locale = useLocale();
  const fmt = useFormatter();
  const [open, setOpen] = useState(false);

  const Icon = ICON[id];
  const mood = moodOf(satisfaction);
  const tone = MOOD_TONE[mood];
  const after = Math.min(100, satisfaction + PLACATE_BOOST);
  const maxed = satisfaction >= 100;
  const abs = (n: number) => fmt.number(Math.abs(n), { maximumFractionDigits: 2 });
  const signed = (n: number) => fmt.number(n, { maximumFractionDigits: 2, signDisplay: 'exceptZero' });
  const pct = (n: number) => `${Math.round(n)}%`;
  const stance = factionStance(satisfaction);
  const lever = FACTION_LEVERAGE[id];
  // Popularity is points a week; every other lever is a percentage.
  const leverValue = (n: number) =>
    lever.lever === 'popularity'
      ? signed(n)
      : fmt.number(n, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' });

  const tax = TAX_FACTION_EFFECT[id];
  const gov = GOVERNMENT_BONUS[government][id] ?? 0;
  const governmentName = t(`government.${government}.name`);
  const detailId = `faction-moves-${id}`;

  return (
    <li data-testid={`faction-${id}`} data-mood={mood}>
      <Card tone={mood === 'hostile' ? 'danger' : 'neutral'} className="flex flex-col gap-2.5">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-fg-muted">
            <Icon aria-hidden className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="truncate text-[13px] font-semibold text-fg">{t(`faction.${id}.name`)}</h4>
              <span
                className={cn(
                  'numeric-tabular shrink-0 font-mono text-sm font-semibold',
                  tone === 'danger' ? 'text-[#ff8a7d]' : tone === 'warning' ? 'text-warning' : 'text-fg',
                )}
                data-testid={`faction-${id}-satisfaction`}
              >
                {pct(satisfaction)}
              </span>
            </div>
            <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-fg-faint">
              <span className={tone === 'danger' ? 'text-[#ff8a7d]' : tone === 'warning' ? 'text-warning' : undefined}>
                {t(`mood.${mood}`)}
              </span>
              <span aria-hidden>·</span>
              <span>{t('factions.weight', { pct: percent(share, locale) })}</span>
            </p>
          </div>
          {urgent ? <Chip tone="accent">{t('factions.urgent')}</Chip> : null}
        </div>

        <Meter value={satisfaction / 100} tone={tone} />
        <p className="text-[11px] leading-snug text-fg-muted">{t(`faction.${id}.wants`)}</p>

        {/* What this faction's loyalty is worth, and which side is in force. */}
        <dl className="grid grid-cols-2 gap-1.5 text-[11px] leading-snug" data-testid={`faction-${id}-leverage`}>
          {(['loyal', 'hostile'] as const).map((side) => {
            const on = stance === side;
            return (
              <div
                key={side}
                className={cn(
                  'rounded-lg border px-2 py-1.5',
                  on
                    ? side === 'loyal'
                      ? 'border-success/40 bg-success/10'
                      : 'border-[#ff5d4d]/40 bg-[#ff5d4d]/10'
                    : 'border-white/[0.06] text-fg-faint',
                )}
              >
                <dt className={cn('font-medium', on ? 'text-fg' : undefined)}>
                  {t(`leverage.${side}`, { at: side === 'loyal' ? FACTION_LOYAL_AT : FACTION_HOSTILE_AT })}
                  {on ? <span className="sr-only"> ({t('leverage.inForce')})</span> : null}
                </dt>
                <dd className={cn('numeric-tabular', on ? (side === 'loyal' ? 'text-success' : 'text-[#ff8a7d]') : undefined)}>
                  {t(`leverage.${lever.lever}`, { v: leverValue(lever[side]) })}
                </dd>
              </div>
            );
          })}
        </dl>

        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-[11px] leading-snug text-fg-faint">
            {maxed ? (
              t('placate.maxed')
            ) : (
              <>
                <span className="block">{t('placate.effectLabel')}</span>
                <span className="numeric-tabular font-mono text-fg">
                  {pct(satisfaction)} → {pct(after)}
                </span>
              </>
            )}
          </p>
          {maxed ? null : (
            <Button
              size="sm"
              variant={urgent ? 'primary' : 'secondary'}
              icon={HandCoins}
              loading={busy}
              disabled={!canAfford}
              title={canAfford ? undefined : t('placate.cannotAfford', { cost: money(PLACATE_COST, locale) })}
              onClick={onPlacate}
              data-testid={`faction-placate-${id}`}
            >
              {t('placate.button', { cost: money(PLACATE_COST, locale) })}
            </Button>
          )}
        </div>

        <div className="border-t border-white/10 pt-1.5">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => setOpen(!open)}
            className="flex w-full items-center justify-between gap-2 rounded py-1 text-left text-[11px] font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t('moves.title')}
            <ChevronDown aria-hidden className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
          </button>
          {open ? (
            <ul id={detailId} className="mt-1 flex flex-col gap-1 text-[11px] leading-snug text-fg-muted">
              <li>{t(tax < 0 ? 'moves.taxDown' : 'moves.taxUp', { points: abs(tax) })}</li>
              {gov !== 0 ? (
                <li>
                  {t(gov > 0 ? 'moves.governmentUp' : 'moves.governmentDown', {
                    government: governmentName,
                    points: abs(gov),
                  })}
                </li>
              ) : null}
              {policies && policies.likes.length > 0 ? (
                <li>{t('moves.likes', { list: policies.likes.map((p) => tPolicy(`${p}.name`)).join(', ') })}</li>
              ) : null}
              {policies && policies.dislikes.length > 0 ? (
                <li>{t('moves.dislikes', { list: policies.dislikes.map((p) => tPolicy(`${p}.name`)).join(', ') })}</li>
              ) : null}
              <li>{t('moves.drift', { points: signed(drift) })}</li>
            </ul>
          ) : null}
        </div>
      </Card>
    </li>
  );
}

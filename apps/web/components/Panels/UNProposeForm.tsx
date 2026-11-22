'use client';

// Tabling a resolution, one question at a time: what kind, against whom or
// where, then a plain summary of what the vote will and will not do.

import type { RegionId, UNResolutionKind } from '@aurion/engine';
import { Lock, MapPin, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { Button, Card, Row } from '../ui';

import { CountryPicker, type PickerItem } from './diplomacy/CountryPicker';
import { AttitudeValue, StanceChip, TargetHeader } from './diplomacy/parts';
import { stanceOf, useCommit, type World } from './diplomacy/world';
import { regionsOf } from './military/forces';
import { KINDS, KIND_ICON, KIND_TARGET, OPEN_KINDS, PLAYER_VOTING_WEEKS } from './un/shared';

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="flex items-center gap-2 text-[13px] font-semibold text-fg">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-accent/20 font-mono text-[11px] text-accent">{n}</span>
        {title}
      </h4>
      {children}
    </div>
  );
}

export function UNProposeForm({
  w,
  isCouncil,
  onErrors,
  onDone,
}: {
  w: World;
  isCouncil: boolean;
  onErrors?: (errors: string[]) => void;
  /** Called with the kind once the resolution is on the floor. */
  onDone: (kind: UNResolutionKind) => void;
}) {
  const t = useTranslations('panelUN');
  const commit = useCommit(onErrors);
  const [kind, setKind] = useState<UNResolutionKind | null>(null);
  const [region, setRegion] = useState<RegionId | null>(null);

  const items = useMemo<PickerItem[]>(
    () =>
      w.others.map((c) => {
        const rel = w.relation(c.id);
        const name = w.nameOf(c.id);
        return {
          id: c.id,
          name,
          color: c.color,
          subtitle: w.regionName(c.regionId),
          trailing: <AttitudeValue attitude={rel.attitude} className="text-xs" />,
          sort: { attitude: -rel.attitude, name },
        };
      }),
    [w],
  );

  const needs = kind ? KIND_TARGET[kind] : 'none';
  const country = needs === 'country' ? w.target : null;
  const ready = kind !== null && (needs === 'none' || (needs === 'country' ? country !== null : region !== null));
  const targetName = country ? w.nameOf(country.id) : needs === 'region' && region ? w.regionName(region) : null;

  const submit = async () => {
    if (!kind || !ready) return;
    const ok = await commit({
      type: 'proposeUNResolution',
      kind,
      ...(country ? { targetCountryId: country.id } : {}),
      ...(needs === 'region' && region ? { targetRegionId: region } : {}),
    });
    if (ok) onDone(kind);
  };

  return (
    <Card className="flex flex-col gap-4" data-testid="un-propose-form">
      <Step n={1} title={t('propose.stepKind')}>
        <ul role="radiogroup" aria-label={t('propose.stepKind')} className="flex flex-col gap-1">
          {KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            const locked = !isCouncil && !OPEN_KINDS.includes(k);
            const active = kind === k;
            return (
              <li key={k} role="presentation">
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-disabled={locked}
                  data-testid={`un-propose-kind-${k}`}
                  onClick={() => {
                    if (!locked) setKind(k);
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    active
                      ? 'border-accent/50 bg-accent/10'
                      : locked
                        ? 'cursor-not-allowed border-white/[0.06]'
                        : 'border-white/[0.08] bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.07]',
                  )}
                >
                  {locked ? (
                    <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-fg-faint" />
                  ) : (
                    <Icon aria-hidden className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-accent' : 'text-fg-muted')} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[13px] font-medium', locked ? 'text-fg-muted' : 'text-fg')}>
                      {t(`kind.${k}`)}
                    </span>
                    <span className={cn('block text-[11px] leading-snug', locked ? 'text-warning' : 'text-fg-faint')}>
                      {locked ? t('propose.councilOnly') : t(`kindDescription.${k}`)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Step>

      {kind && needs === 'country' ? (
        <Step n={2} title={t(`propose.stepCountry.${kind}`)}>
          {country ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
              <TargetHeader
                name={w.nameOf(country.id)}
                color={country.color}
                aside={<StanceChip stance={stanceOf(w.relation(country.id))} />}
                caption={w.regionName(country.regionId)}
                onClear={() => w.selectTarget(null)}
              />
            </div>
          ) : (
            <CountryPicker
              label={t(`propose.stepCountry.${kind}`)}
              testIdPrefix="un-propose-country"
              items={items}
              onPick={w.selectTarget}
              sorts={[
                { id: 'attitude', label: t('propose.sortHostile') },
                { id: 'name', label: t('propose.sortName') },
              ]}
              limit={5}
            />
          )}
        </Step>
      ) : null}

      {kind && needs === 'region' ? (
        <Step n={2} title={t('propose.stepRegion')}>
          <ul className="flex flex-col gap-1">
            {regionsOf(w).map((id) => (
              <li key={id}>
                <Row
                  testId={`un-propose-region-${id}`}
                  leading={<MapPin aria-hidden className="h-4 w-4 text-fg-muted" />}
                  title={w.regionName(id)}
                  selected={region === id}
                  onClick={() => setRegion(id)}
                  className="py-1.5"
                />
              </li>
            ))}
          </ul>
        </Step>
      ) : null}

      {kind ? (
        <Step n={needs === 'none' ? 2 : 3} title={t('propose.stepReview')}>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-[11px] leading-snug text-fg-muted">
            <li>{t('propose.reviewVote', { weeks: PLAYER_VOTING_WEEKS })}</li>
            <li>{t('propose.reviewRule')}</li>
            <li>{kind === 'nonProliferation' ? t('propose.reviewTreaty') : t('propose.reviewEffects')}</li>
          </ul>
          <Button
            variant="primary"
            block
            icon={Send}
            disabled={!ready}
            onClick={() => void submit()}
            data-testid="un-propose-submit"
          >
            {targetName
              ? t('propose.submitTarget', { kind: t(`kind.${kind}`), target: targetName })
              : t('propose.submit', { kind: t(`kind.${kind}`) })}
          </Button>
          {!ready ? (
            <p className="text-[11px] leading-snug text-warning">
              {needs === 'country' ? t('propose.pickCountry') : t('propose.pickRegion')}
            </p>
          ) : null}
        </Step>
      ) : null}
    </Card>
  );
}

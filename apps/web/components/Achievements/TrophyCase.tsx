// The trophy case: how far along you are, tier by tier, and every trophy —
// earned ones with when and where, open ones with what it takes, secret
// ones kept secret.

'use client';

import { BUILTIN_ACHIEVEMENTS, type AchievementDef, type AchievementId } from '@aurion/engine';
import { EyeOff, Trophy } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { useSfx } from '../Audio';
import { Card, Chip, EmptyState, Glass, Meter, Segmented, type Tone } from '../ui';
import { cn } from '../../lib/cn';
import { getUnlockedAchievements, type UnlockedAchievement } from '../../lib/persistence';
import { getScenarioMeta } from '../../lib/scenarios';
import { Medal, TIER_COLOR, TIER_ORDER, type Tier } from './Medal';

type StatusFilter = 'all' | 'unlocked' | 'locked';
type TierFilter = 'all' | Tier;

const TIER_TONE: Record<Tier, Tone> = { bronze: 'warning', silver: 'neutral', gold: 'accent' };

/** Segmented labels must stay on one line on narrow screens. */
const nowrap = (label: string) => <span className="whitespace-nowrap">{label}</span>;

export function TrophyCase() {
  const t = useTranslations('trofei');
  const tAch = useTranslations('achievements');
  const tAll = useTranslations();
  const format = useFormatter();
  const sfx = useSfx();

  // null until IndexedDB answers, so the tallies don't flash "0".
  const [unlocked, setUnlocked] = useState<ReadonlyMap<AchievementId, UnlockedAchievement> | null>(
    null,
  );
  const [status, setStatus] = useState<StatusFilter>('all');
  const [tier, setTier] = useState<TierFilter>('all');

  useEffect(() => {
    let cancelled = false;
    getUnlockedAchievements()
      .then((rows) => !cancelled && setUnlocked(new Map(rows.map((r) => [r.id, r]))))
      .catch(() => !cancelled && setUnlocked(new Map()));
    return () => {
      cancelled = true;
    };
  }, []);

  const all = useMemo(
    () =>
      [...BUILTIN_ACHIEVEMENTS].sort(
        (a, b) =>
          TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.id.localeCompare(b.id),
      ),
    [],
  );
  const has = (def: AchievementDef) => unlocked?.has(def.id) === true;
  const total = all.length;
  const done = all.filter(has).length;
  const secretsLeft = all.filter((d) => d.hidden === true && !has(d)).length;

  const latest = useMemo(() => {
    if (!unlocked || unlocked.size === 0) return null;
    const row = [...unlocked.values()].sort((a, b) => b.unlockedAt - a.unlockedAt)[0]!;
    const def = all.find((d) => d.id === row.id);
    return def ? { def, row } : null;
  }, [unlocked, all]);

  const shown = all.filter(
    (def) =>
      (tier === 'all' || def.tier === tier) &&
      (status === 'all' || (status === 'unlocked') === has(def)),
  );

  const worldName = (scenarioId: string) => {
    const meta = getScenarioMeta(scenarioId);
    return meta && tAll.has(meta.nameKey) ? tAll(meta.nameKey) : null;
  };
  const whenWhere = (row: UnlockedAchievement) => {
    const date = format.dateTime(new Date(row.unlockedAt), { dateStyle: 'medium' });
    const world = worldName(row.scenarioId);
    return world ? t('unlockedOnIn', { date, world }) : t('unlockedOn', { date });
  };

  return (
    <div className="flex flex-col gap-5">
      <Glass
        className="grid gap-5 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
        aria-busy={unlocked === null}
      >
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-fg-faint">
            {t('progress')}
          </p>
          <p className="numeric-tabular mt-1 font-mono text-5xl font-semibold leading-none text-fg">
            {unlocked === null ? '–' : done}
            <span className="text-2xl text-fg-faint"> / {total}</span>
          </p>
          <Meter className="mt-3" thick value={total > 0 ? done / total : 0} />
          <p className="mt-2 text-pretty text-xs leading-relaxed text-fg-muted" aria-live="polite">
            {unlocked === null
              ? ''
              : done === 0
                ? t('summary.none')
                : done === total
                  ? t('summary.all')
                  : t('summary.some', { left: total - done, secrets: secretsLeft })}
          </p>
        </div>

        <div className="flex flex-col justify-between gap-3">
          <ul className="grid grid-cols-3 gap-3">
            {TIER_ORDER.map((tr) => {
              const inTier = all.filter((d) => d.tier === tr);
              const got = inTier.filter(has).length;
              return (
                <li key={tr} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2">
                    <Medal tier={tr} size={28} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-fg">
                        {tAch(`list.tier.${tr}`)}
                      </p>
                      <p className="numeric-tabular font-mono text-[11px] text-fg-faint">
                        {unlocked === null ? '–' : got}/{inTier.length}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                      style={{
                        width: `${inTier.length ? (got / inTier.length) * 100 : 0}%`,
                        backgroundColor: TIER_COLOR[tr],
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {latest ? (
            <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/[0.07] p-3">
              <Medal tier={latest.def.tier} size={34} />
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-accent">
                  {t('latest')}
                </p>
                <p className="truncate text-sm font-semibold text-fg">{tAll(latest.def.nameKey)}</p>
                <p className="truncate text-[11px] text-fg-faint">{whenWhere(latest.row)}</p>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/15 p-3 text-pretty text-xs leading-relaxed text-fg-faint">
              {t('latestNone')}
            </p>
          )}
        </div>
      </Glass>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<StatusFilter>
          label={t('filter.statusLabel')}
          value={status}
          onChange={(v) => {
            sfx('sfx.tab');
            setStatus(v);
          }}
          options={[
            { value: 'all', label: nowrap(t('filter.all')) },
            { value: 'unlocked', label: nowrap(t('filter.unlocked')) },
            { value: 'locked', label: nowrap(t('filter.locked')) },
          ]}
        />
        <Segmented<TierFilter>
          label={t('filter.tierLabel')}
          value={tier}
          onChange={(v) => {
            sfx('sfx.tab');
            setTier(v);
          }}
          options={[
            { value: 'all', label: nowrap(t('filter.anyTier')) },
            ...TIER_ORDER.map((tr) => ({ value: tr, label: tAch(`list.tier.${tr}`) })),
          ]}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {t('filter.count', { count: shown.length })}
      </p>

      {shown.length === 0 ? (
        <EmptyState icon={Trophy} title={t('emptyFilter.title')}>
          {status === 'unlocked' ? t('emptyFilter.unlocked') : t('emptyFilter.locked')}
        </EmptyState>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={tAch('list.title')}>
          {shown.map((def) => {
            const row = unlocked?.get(def.id);
            const secret = def.hidden === true && !row;
            return (
              <li key={def.id}>
                <Card
                  tone={row ? TIER_TONE[def.tier] : 'neutral'}
                  data-testid={`trophy-${def.id}`}
                  data-unlocked={row ? 'true' : 'false'}
                  className={cn('flex h-full gap-3 p-3.5', !row && 'bg-white/[0.02]')}
                >
                  <Medal tier={def.tier} locked={!row} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className={cn(
                          'text-sm font-semibold leading-tight',
                          row ? 'text-fg' : 'text-fg-muted',
                        )}
                      >
                        {secret ? t('secret.name') : tAll(def.nameKey)}
                      </h3>
                      <Chip tone={row ? TIER_TONE[def.tier] : 'neutral'} className="shrink-0">
                        {tAch(`list.tier.${def.tier}`)}
                      </Chip>
                    </div>
                    <p className="mt-1 text-pretty text-xs leading-relaxed text-fg-muted">
                      {secret ? t('secret.body') : tAll(def.descKey)}
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-fg-faint">
                      {secret ? <EyeOff aria-hidden className="h-3 w-3" /> : null}
                      {row ? whenWhere(row) : secret ? t('secret.label') : t('locked')}
                    </p>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

'use client';

// National policies — standing choices with a weekly price. Rendered by the
// Politics panel. Up to three (four from Kardashev Type I) can be in force;
// each card states exactly what it gives and what it takes before the click.

import { Check, Clock, Lock, ScrollText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  POLICIES,
  POLICY_COOLDOWN_TICKS,
  POLICY_ENACT_POPULARITY_COST,
  getPolicyStatus,
  policySlots,
  type PolicyCategory,
  type PolicyDef,
  type PolicyStatus,
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import { useGameStore } from '../../lib/store';
import { useSfx } from '../Audio';
import { Button, Card, Chip, EmptyState, SectionTitle, Segmented, type Tone } from '../ui';

const CATEGORIES: readonly PolicyCategory[] = ['economy', 'society', 'security', 'science'];

type Fx = { label: string; tone: Tone };

export function PoliciesSection({ onErrors }: { onErrors?: (errors: string[]) => void }) {
  const t = useTranslations('policies');
  const tRoot = useTranslations();
  const state = useGameStore((s) => s.state);
  const applyAction = useGameStore((s) => s.applyAction);
  const sfx = useSfx();
  const [category, setCategory] = useState<PolicyCategory>('economy');

  const statuses = useMemo(() => {
    const out = new Map<string, PolicyStatus>();
    if (!state) return out;
    for (const def of POLICIES) out.set(def.id, getPolicyStatus(state, def));
    return out;
  }, [state]);

  if (!state?.policies) return null;

  const total = policySlots(state);
  const active = state.policies.active;

  const pct = (v: number) => {
    const n = Math.round(v * 100);
    return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`;
  };

  /** Plain-language effect chips, good news first. */
  const effectsOf = (def: PolicyDef): Fx[] => {
    const fx = def.effects;
    const out: Fx[] = [];
    if (fx.incomeMul) out.push({ label: t('fx.income', { v: pct(fx.incomeMul) }), tone: fx.incomeMul > 0 ? 'success' : 'danger' });
    if (fx.gdpGrowth) out.push({ label: t('fx.gdp', { v: (((1 + fx.gdpGrowth) ** 52 - 1) * 100).toFixed(1) }), tone: 'success' });
    if (fx.researchMul) out.push({ label: t('fx.research', { v: Math.round(fx.researchMul * 100) }), tone: 'success' });
    if (fx.projectCostMul) out.push({ label: t('fx.projectCost', { v: pct(fx.projectCostMul) }), tone: 'success' });
    if (fx.projectSpeed) out.push({ label: t('fx.projectSpeed', { v: Math.round(fx.projectSpeed * 100) }), tone: 'success' });
    if (fx.armyGrowth) out.push({ label: t('fx.army', { v: (fx.armyGrowth * 100).toFixed(1) }), tone: 'success' });
    if (fx.counterIntel) out.push({ label: t('fx.counterIntel'), tone: 'success' });
    if (fx.popularity) {
      const v = `${fx.popularity > 0 ? '+' : '−'}${Math.abs(fx.popularity).toFixed(2)}`;
      out.push({ label: t('fx.popularity', { v }), tone: fx.popularity > 0 ? 'success' : 'danger' });
    }
    for (const [fid, delta] of Object.entries(fx.factions ?? {})) {
      const name = t(`faction.${fid}`);
      out.push(
        delta > 0
          ? { label: t('fx.factionUp', { name }), tone: 'success' }
          : { label: t('fx.factionDown', { name }), tone: 'danger' },
      );
    }
    if (fx.upkeep) out.push({ label: t('fx.upkeep', { v: Math.round(fx.upkeep * 100) }), tone: 'warning' });
    return out.sort((a, b) => Number(a.tone !== 'success') - Number(b.tone !== 'success'));
  };

  const run = async (type: 'enactPolicy' | 'repealPolicy', def: PolicyDef) => {
    const errors = await applyAction({ type, policyId: def.id });
    if (errors.length > 0) {
      sfx('sfx.error');
      onErrors?.(errors.map((e) => (tRoot.has(e) ? tRoot(e) : e)));
    } else {
      sfx(type === 'enactPolicy' ? 'sfx.treaty' : 'sfx.confirm');
    }
  };

  const reasonOf = (status: PolicyStatus): string | null => {
    if (status.status === 'cooldown') return t('status.cooldown', { weeks: status.weeksLeft });
    if (status.status === 'excluded') {
      return t('status.excluded', { list: status.by.map((id) => t(`items.${id}.name`)).join(', ') });
    }
    if (status.status === 'noSlot') return t('status.noSlot', { total });
    return null;
  };

  const shown = POLICIES.filter((p) => p.category === category);

  return (
    <section aria-label={t('title')} data-testid="policies-section" className="flex flex-col gap-3">
      <SectionTitle aside={t('slots', { used: active.length, total })}>{t('title')}</SectionTitle>
      <p className="-mt-1 text-[11px] leading-snug text-fg-faint">{t('intro')}</p>

      {active.length === 0 ? (
        <EmptyState icon={ScrollText}>{t('none')}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {active.map((id) => {
            const def = POLICIES.find((p) => p.id === id);
            if (!def) return null;
            return (
              <li key={id}>
                <Card tone="accent" className="flex items-center gap-2 py-2">
                  <Check aria-hidden className="h-4 w-4 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
                    {t(`items.${id}.name`)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void run('repealPolicy', def)}
                    title={t('repealHint', { weeks: POLICY_COOLDOWN_TICKS })}
                    data-testid={`policy-repeal-${id}`}
                  >
                    {t('repeal')}
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Segmented
        label={t('category.label')}
        size="sm"
        value={category}
        onChange={setCategory}
        options={CATEGORIES.map((c) => ({ value: c, label: t(`category.${c}`) }))}
        className="w-full"
      />

      <ul className="flex flex-col gap-2">
        {shown.map((def) => {
          const status = statuses.get(def.id) ?? { status: 'available' as const };
          const isActive = status.status === 'active';
          const reason = reasonOf(status);
          return (
            <li key={def.id} data-testid={`policy-${def.id}`} data-status={status.status}>
              <Card tone={isActive ? 'accent' : 'neutral'} className={cn(reason && 'opacity-70')}>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-[13px] font-semibold leading-tight text-fg">{t(`items.${def.id}.name`)}</h4>
                  {isActive ? <Chip tone="accent">{t('active')}</Chip> : null}
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-fg-faint">{t(`items.${def.id}.desc`)}</p>
                <ul className="mt-2 flex flex-wrap gap-1">
                  {effectsOf(def).map((fx) => (
                    <li key={fx.label}>
                      <Chip tone={fx.tone}>{fx.label}</Chip>
                    </li>
                  ))}
                </ul>
                {reason ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-warning">
                    {status.status === 'cooldown' ? (
                      <Clock aria-hidden className="h-3 w-3" />
                    ) : (
                      <Lock aria-hidden className="h-3 w-3" />
                    )}
                    {reason}
                  </p>
                ) : null}
                {status.status === 'available' ? (
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-fg-faint">
                      {t('enactCost', { n: POLICY_ENACT_POPULARITY_COST })}
                    </span>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => void run('enactPolicy', def)}
                      data-testid={`policy-enact-${def.id}`}
                    >
                      {t('enact')}
                    </Button>
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
      {total < 4 ? <p className="text-[11px] text-fg-faint">{t('slotHint')}</p> : null}
    </section>
  );
}

export default PoliciesSection;

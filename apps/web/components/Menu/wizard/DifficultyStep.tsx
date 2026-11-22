'use client';

// Difficulty: three rule sets, shown as what they actually change, plus
// Iron Man as a separate, clearly consequential switch.

import type { DifficultyTuning } from '@aurion/engine';
import { Flame, Gauge, ShieldCheck, Skull, Sprout, type LucideIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { useSfx } from '../../Audio';
import { Card, Chip, EmptyState } from '../../ui';
import { cn } from '../../../lib/cn';
import { Switch } from '../Switch';
import { modifierDeltas } from './insight';
import { OptionCard, RadioCards } from './OptionCard';
import { RECOMMENDED_DIFFICULTY, type StepProps } from './plan';

const PRESET_ICON: Record<string, LucideIcon> = { easy: Sprout, normal: Gauge, hard: Flame };

export function DifficultyStep({ resolved, update }: StepProps) {
  const t = useTranslations('setup');
  const tAll = useTranslations();
  const sfx = useSfx();
  const { presets, ironPreset, ironMan, difficulty } = resolved;

  if (!resolved.scenario) {
    return (
      <div aria-busy="true" className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl bg-white/[0.04] motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }
  if (presets.length === 0) {
    return <EmptyState title={t('difficulty.emptyTitle')}>{t('difficulty.emptyBody')}</EmptyState>;
  }

  const nameOf = (preset: DifficultyTuning) =>
    tAll.has(preset.nameKey) ? tAll(preset.nameKey) : preset.id;
  const descriptionOf = (preset: DifficultyTuning) => {
    const key = `difficulty.${preset.id}.description`;
    return tAll.has(key) ? tAll(key) : null;
  };
  // With Iron Man on, its own rule set replaces the three presets.
  const basePreset = ironMan ? null : difficulty;

  return (
    <div className="flex flex-col gap-4">
      <RadioCards label={t('steps.difficulty.label')} className="grid gap-3 md:grid-cols-3">
        {presets.map((preset) => (
          <OptionCard
            key={preset.id}
            testId={`difficulty-option-${preset.id}`}
            checked={basePreset?.id === preset.id}
            onSelect={() =>
              update('difficulty', (prev) => ({ ...prev, difficultyId: preset.id, ironMan: false }))
            }
            icon={PRESET_ICON[preset.id] ?? Gauge}
            title={nameOf(preset)}
            description={descriptionOf(preset)}
            badges={
              preset.id === RECOMMENDED_DIFFICULTY ? (
                <Chip tone="accent">{t('recommended')}</Chip>
              ) : null
            }
            className={cn(ironMan && 'opacity-55')}
          >
            <ModifierList preset={preset} />
          </OptionCard>
        ))}
      </RadioCards>

      {ironPreset ? (
        <Card tone={ironMan ? 'danger' : 'neutral'} className="p-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-lg border',
                ironMan
                  ? 'border-[#ff5d4d]/50 bg-[#ff5d4d]/15 text-[#ff8a7d]'
                  : 'border-white/10 bg-white/[0.04] text-fg-muted',
              )}
            >
              <Skull className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 id="iron-man-title" className="text-[15px] font-semibold text-fg">
                {t('ironMan.title')}
              </h3>
              <p
                id="iron-man-body"
                className="mt-0.5 text-pretty text-xs leading-relaxed text-fg-muted"
              >
                {t('ironMan.body')}
              </p>
            </div>
            <Switch
              tone="danger"
              checked={ironMan}
              labelledBy="iron-man-title"
              describedBy="iron-man-body"
              testId="iron-man-switch"
              onChange={(next) => {
                sfx(next ? 'sfx.confirm' : 'sfx.click');
                update('difficulty', (prev) => ({ ...prev, ironMan: next }));
              }}
            />
          </div>

          <ul className="mt-3 grid gap-x-6 gap-y-1.5 border-t border-white/[0.08] pt-3 text-xs text-fg-muted sm:grid-cols-3">
            {(['saves', 'defeat', 'rules'] as const).map((id) => (
              <li key={id} className="flex gap-2">
                <ShieldCheck
                  aria-hidden
                  className={cn(
                    'mt-0.5 h-3.5 w-3.5 shrink-0',
                    ironMan ? 'text-[#ff8a7d]' : 'text-fg-faint',
                  )}
                />
                <span className="leading-relaxed">{t(`ironMan.consequence.${id}`)}</span>
              </li>
            ))}
          </ul>
          {ironMan ? (
            <div className="mt-3" aria-live="polite">
              <p className="mb-1.5 text-[11px] text-fg-faint">{t('ironMan.rulesIntro')}</p>
              <ModifierList preset={ironPreset} />
            </div>
          ) : null}
        </Card>
      ) : (
        <p className="text-xs text-fg-faint">{t('ironMan.unavailable')}</p>
      )}
    </div>
  );
}

/** A preset as the list of things it changes from the reference rules. */
export function ModifierList({ preset }: { preset: DifficultyTuning }) {
  const t = useTranslations('setup.difficulty');
  const locale = useLocale();
  const deltas = modifierDeltas(preset);
  const pct = new Intl.NumberFormat(locale, {
    style: 'percent',
    signDisplay: 'always',
    maximumFractionDigits: 0,
  });

  if (deltas.length === 0) {
    return (
      <span className="block w-full border-t border-white/[0.07] pt-2.5 text-[11px] leading-relaxed text-fg-faint">
        {t('reference')}
      </span>
    );
  }
  return (
    <span className="flex w-full flex-wrap gap-1.5 border-t border-white/[0.07] pt-2.5">
      {deltas.map((d) => (
        <Chip key={d.key} tone={d.helps ? 'success' : 'danger'}>
          {t(`mod.${d.key}`)}{' '}
          <span className="font-mono numeric-tabular">{pct.format(d.delta)}</span>
        </Chip>
      ))}
    </span>
  );
}

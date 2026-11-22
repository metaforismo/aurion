'use client';

// Step 2 — the world: which map, which nations, which rules are in play.

import { Earth, GraduationCap, Radiation, Sparkles, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Chip } from '../../ui';
import { listScenarios, type ScenarioId } from '../../../lib/scenarios';
import { worldFacts, worldHasEras } from './insight';
import { OptionCard, RadioCards } from './OptionCard';
import { RECOMMENDED_WORLD, type StepProps } from './plan';

const WORLD_ICON: Record<ScenarioId, LucideIcon> = {
  'quick-start': GraduationCap,
  'ascesa-aurion': Sparkles,
  'mondo-contemporaneo': Earth,
  'guerra-fredda': Radiation,
};

export function WorldStep({ plan, resolved, worlds, failed, update }: StepProps) {
  const t = useTranslations('setup');
  const tModes = useTranslations('modes');
  const tErrors = useTranslations('errors');
  const tAll = useTranslations();

  const selectedFacts = resolved.scenario ? worldFacts(resolved.scenario) : null;

  return (
    <div className="flex flex-col gap-3">
      <RadioCards label={t('steps.world.label')} className="grid gap-3 sm:grid-cols-2">
        {listScenarios().map((meta) => {
          const scenario = worlds[meta.id];
          const facts = scenario ? worldFacts(scenario) : null;
          const blocked = failed.has(meta.id)
            ? tErrors('scenarioNotFound')
            : resolved.mode.needsEras && !worldHasEras(meta.id, scenario)
              ? t('world.needsEras', { mode: tModes(`${resolved.mode.key}.name`) })
              : undefined;
          return (
            <OptionCard
              key={meta.id}
              testId={`scenario-option-${meta.id}`}
              checked={meta.id === plan.worldId}
              onSelect={() => update('world', (prev) => ({ ...prev, worldId: meta.id }))}
              icon={WORLD_ICON[meta.id]}
              title={tAll(meta.nameKey)}
              description={t(`worlds.${meta.id}.body`)}
              badges={
                meta.id === RECOMMENDED_WORLD ? <Chip tone="accent">{t('recommended')}</Chip> : null
              }
              disabledReason={blocked}
            >
              <span className="block w-full border-t border-white/[0.07] pt-2.5">
                <span className="block text-[13px] font-medium text-fg">
                  {t(`worlds.${meta.id}.tagline`)}
                </span>
                {facts ? (
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <Chip>{t('world.nations', { count: facts.nations })}</Chip>
                    <Chip>{t('world.playable', { count: facts.playable })}</Chip>
                    {facts.hasBlocs ? <Chip>{t('world.blocs')}</Chip> : null}
                    {facts.hasCouncil ? <Chip>{t('world.council')}</Chip> : null}
                    {facts.eras > 0 ? (
                      <Chip tone="info">{t('world.eras', { count: facts.eras })}</Chip>
                    ) : null}
                    {facts.nuclearPowers > 0 ? (
                      <Chip tone="warning" icon={Radiation}>
                        {t('world.nuclear', { count: facts.nuclearPowers })}
                      </Chip>
                    ) : null}
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className="mt-2 block h-[22px] w-2/3 animate-pulse rounded-full bg-white/[0.06] motion-reduce:animate-none"
                  />
                )}
                <span className="mt-2 block text-[11px] leading-relaxed text-fg-faint">
                  {t(`worlds.${meta.id}.feel`)}
                </span>
              </span>
            </OptionCard>
          );
        })}
      </RadioCards>
      <p
        aria-live="polite"
        className="min-h-[1.25rem] text-pretty text-xs leading-relaxed text-warning"
      >
        {selectedFacts && selectedFacts.nuclearPowers > 0 ? t('world.nuclearNote') : ''}
      </p>
    </div>
  );
}

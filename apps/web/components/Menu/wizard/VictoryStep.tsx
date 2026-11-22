'use client';

// Step 4 (Campaign only) — the one way this game can be won, with the
// concrete target the chosen world sets for it.

import type { Scenario, VictoryConditionId } from '@aurion/engine';
import {
  Coins,
  Globe,
  Handshake,
  Microscope,
  Rocket,
  Sword,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Chip } from '../../ui';
import { useScenarioMessages } from '../../Panels/shared/useScenarioMessages';
import type { ScenarioId } from '../../../lib/scenarios';
import { victoryTarget, type VictoryTarget } from './insight';
import { OptionCard, RadioCards } from './OptionCard';
import { RECOMMENDED_VICTORY, type StepProps } from './plan';

export const VICTORY_ICON: Record<VictoryConditionId, LucideIcon> = {
  economic: Coins,
  military: Sword,
  scientific: Microscope,
  diplomatic: Handshake,
  domination: Globe,
  ascension: Rocket,
};

const ROMAN = ['0', 'I', 'II', 'III'];

const ORDER: readonly VictoryConditionId[] = [
  'economic',
  'diplomatic',
  'scientific',
  'military',
  'domination',
  'ascension',
];

/**
 * Copy for a victory path as the chosen world defines it: the world's own
 * name and description when it has them (generic ones otherwise), plus the
 * rule reduced to one concrete target, or null when it has no simple one.
 */
export function useVictoryCopy(scenario: Scenario | undefined) {
  const t = useTranslations('setup.victory.target');
  const tVictory = useTranslations('victory');
  const { t: tScenario } = useScenarioMessages((scenario?.id ?? null) as ScenarioId | null);

  const def = (id: VictoryConditionId) => scenario?.victoryConditions.find((v) => v.id === id);
  // tScenario echoes the key when the world has no copy of its own.
  const own = (key: string | undefined) => {
    const text = key ? tScenario(key) : '';
    return text && text !== key ? text : null;
  };

  return {
    name: (id: VictoryConditionId) => own(def(id)?.nameKey) ?? tVictory(`${id}.name`),
    description: (id: VictoryConditionId) =>
      own(def(id)?.descriptionKey) ?? tVictory(`${id}.description`),
    target: (id: VictoryConditionId): string | null => {
      const rule = def(id)?.rule;
      const target: VictoryTarget = scenario && rule ? victoryTarget(scenario, rule) : null;
      if (!target) return null;
      switch (target.kind) {
        case 'gdpRank':
          return t('gdpRank', { rank: target.rank });
        case 'allies':
          return t('allies', { count: target.count });
        case 'tech':
          return t('tech', { tech: tScenario(target.techNameKey) });
        case 'coverage':
          return t('coverage', { percent: target.percent });
        case 'kardashev':
          return t('kardashev', { type: ROMAN[target.type] ?? String(target.type) });
      }
    },
  };
}

export function VictoryStep({ plan, resolved, update }: StepProps) {
  const t = useTranslations('setup');
  const copy = useVictoryCopy(resolved.scenario);
  const available = resolved.scenario
    ? ORDER.filter((id) => resolved.scenario!.victoryConditions.some((v) => v.id === id))
    : ORDER;

  return (
    <RadioCards
      label={t('steps.victory.label')}
      className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3"
    >
      {available.map((id) => {
        const target = copy.target(id);
        return (
          <OptionCard
            key={id}
            testId={`victory-option-${id}`}
            checked={id === plan.victory}
            onSelect={() => update('victory', (prev) => ({ ...prev, victory: id }))}
            icon={VICTORY_ICON[id]}
            title={copy.name(id)}
            description={copy.description(id)}
            badges={
              id === RECOMMENDED_VICTORY ? <Chip tone="accent">{t('recommendedF')}</Chip> : null
            }
          >
            {target ? (
              <span className="flex w-full items-start gap-2 border-t border-white/[0.07] pt-2.5">
                <Target aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                <span className="text-[12px] leading-relaxed text-fg">{target}</span>
              </span>
            ) : null}
          </OptionCard>
        );
      })}
    </RadioCards>
  );
}

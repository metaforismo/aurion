'use client';

// Step 1 — "what do I want to do?". Five modes, each with the same six
// answers: what you do, how you win, how you lose, how long it takes, who
// it's for, and what it changes in the steps that follow.

import type { GameMode } from '@aurion/engine';
import {
  Clock,
  Compass,
  Info,
  ListChecks,
  Skull,
  Trophy,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Card, Chip } from '../../ui';
import { cn } from '../../../lib/cn';
import { getScenarioMeta, listScenarios } from '../../../lib/scenarios';
import { MODES, RECOMMENDED_MODE, type ModeMeta } from '../modes';
import { worldFacts, worldHasEras } from './insight';
import { OptionCard, RadioCards } from './OptionCard';
import { DEFAULT_ERA_WORLD, type StepProps } from './plan';

const FIELDS: readonly {
  id: 'do' | 'win' | 'lose' | 'length' | 'forWho' | 'changes';
  icon: LucideIcon;
  tone: string;
}[] = [
  { id: 'do', icon: Compass, tone: 'text-fg-muted' },
  { id: 'win', icon: Trophy, tone: 'text-success' },
  { id: 'lose', icon: Skull, tone: 'text-[#ff8a7d]' },
  { id: 'length', icon: Clock, tone: 'text-fg-muted' },
  { id: 'forWho', icon: UserRound, tone: 'text-fg-muted' },
  { id: 'changes', icon: ListChecks, tone: 'text-[#8ad8ff]' },
];

export function ModeStep({
  plan,
  resolved,
  worlds,
  onPick,
}: StepProps & { onPick: (mode: GameMode) => void }) {
  const t = useTranslations('setup');
  const tModes = useTranslations('modes');
  const tAll = useTranslations();

  // Mode-specific caveat that depends on the world: Chronicles only runs
  // where eras exist, Throne's second defeat only where blocs do.
  const noteFor = (mode: ModeMeta): string | null => {
    if (mode.needsEras) {
      const eraWorlds = listScenarios()
        .filter((m) => worldHasEras(m.id, worlds[m.id]))
        .map((m) => tAll(m.nameKey));
      const fallback = getScenarioMeta(DEFAULT_ERA_WORLD);
      return tModes('chronicles.note', {
        worlds: eraWorlds.join(', '),
        world: fallback ? tAll(fallback.nameKey) : DEFAULT_ERA_WORLD,
      });
    }
    if (mode.id === 'dethrone' && resolved.scenario) {
      return worldFacts(resolved.scenario).isolationDefeat
        ? tModes('throne.noteIsolation')
        : tModes('throne.noteNoIsolation');
    }
    return null;
  };

  const selected = resolved.mode;

  return (
    <div
      className="grid items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
      data-testid="game-mode-picker"
    >
      <RadioCards label={t('steps.mode.label')} className="flex flex-col gap-2">
        {MODES.map((mode) => {
          const checked = mode.id === plan.mode;
          return (
            <OptionCard
              key={mode.id}
              testId={`game-mode-option-${mode.id}`}
              checked={checked}
              onSelect={() => onPick(mode.id)}
              icon={mode.icon}
              title={tModes(`${mode.key}.name`)}
              description={tModes(`${mode.key}.pitch`)}
              badges={
                <>
                  {mode.id === RECOMMENDED_MODE ? (
                    <Chip tone="accent">{t('recommendedF')}</Chip>
                  ) : null}
                  <Chip icon={Clock}>{tModes(`${mode.key}.lengthShort`)}</Chip>
                  {mode.needsEras ? <Chip tone="info">{tModes('chronicles.badge')}</Chip> : null}
                </>
              }
            >
              {/* Narrow screens read the brief inside the chosen card. */}
              {checked ? (
                <span className="block w-full xl:hidden">
                  <ModeBrief mode={mode} note={noteFor(mode)} />
                </span>
              ) : null}
            </OptionCard>
          );
        })}
      </RadioCards>

      <Card className="hidden p-5 xl:block" aria-live="polite">
        <div className="mb-4 flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-11 w-11 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent"
          >
            <selected.icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-fg">
              {tModes(`${selected.key}.name`)}
            </h3>
            <p className="text-xs text-fg-faint">{tModes(`${selected.key}.pitch`)}</p>
          </div>
        </div>
        <ModeBrief mode={selected} note={noteFor(selected)} />
      </Card>
    </div>
  );
}

/** The six answers for one mode. Uses spans so it can sit inside a button. */
export function ModeBrief({ mode, note }: { mode: ModeMeta; note?: string | null }) {
  const t = useTranslations('setup');
  const tModes = useTranslations('modes');
  return (
    <span className="flex flex-col gap-3">
      {FIELDS.map(({ id, icon: Icon, tone }) => (
        <span key={id} className="flex gap-3">
          <Icon aria-hidden className={cn('mt-0.5 h-4 w-4 shrink-0', tone)} />
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
              {t(`modeField.${id}`)}
            </span>
            <span className="block text-pretty text-[13px] leading-relaxed text-fg">
              {tModes(`${mode.key}.${id}`)}
            </span>
          </span>
        </span>
      ))}
      {note ? (
        <span className="flex gap-3 rounded-lg border border-[#5cc8ff]/30 bg-[#5cc8ff]/[0.07] p-2.5">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#8ad8ff]" />
          <span className="text-pretty text-xs leading-relaxed text-fg-muted">{note}</span>
        </span>
      ) : null}
    </span>
  );
}

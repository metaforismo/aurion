'use client';

// The expedition manifest: every choice so far, which ones are still the
// recommended default, and the Start button — visible on every step.

import { Rocket } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Button, Glass } from '../../ui';
import { useScenarioMessages } from '../../Panels/shared/useScenarioMessages';
import { cn } from '../../../lib/cn';
import { getScenarioMeta } from '../../../lib/scenarios';
import type { Plan, ResolvedPlan, StepId } from './plan';
import { useVictoryCopy } from './VictoryStep';

export function usePlanLabels(plan: Plan, resolved: ResolvedPlan) {
  const tModes = useTranslations('modes');
  const victoryCopy = useVictoryCopy(resolved.scenario);
  const tAll = useTranslations();
  const { t: tScenario } = useScenarioMessages(plan.worldId);

  const worldMeta = getScenarioMeta(plan.worldId);
  const nation = resolved.scenario?.countries.find((c) => c.id === resolved.nationId);
  const difficulty = resolved.difficulty;
  return {
    mode: tModes(`${resolved.mode.key}.name`),
    world: worldMeta ? tAll(worldMeta.nameKey) : plan.worldId,
    nation: nation ? tScenario(nation.nameKey) : null,
    nationColor: nation?.color ?? null,
    victory: victoryCopy.name(resolved.victory),
    difficulty: difficulty
      ? tAll.has(difficulty.nameKey)
        ? tAll(difficulty.nameKey)
        : difficulty.id
      : null,
  };
}

export function Manifest({
  plan,
  resolved,
  steps,
  current,
  touched,
  onJump,
  blocker,
  launching,
  onStart,
}: {
  plan: Plan;
  resolved: ResolvedPlan;
  steps: readonly StepId[];
  current: StepId;
  touched: ReadonlySet<StepId>;
  onJump: (step: StepId) => void;
  /** Why the game can't start yet; null when ready. */
  blocker: string | null;
  launching: boolean;
  onStart: () => void;
}) {
  const t = useTranslations('setup');
  const tModes = useTranslations('modes');
  const labels = usePlanLabels(plan, resolved);

  const value: Record<Exclude<StepId, 'launch'>, ReactNode> = {
    mode: (
      <span className="inline-flex items-center gap-1.5">
        <resolved.mode.icon aria-hidden className="h-3.5 w-3.5 text-accent" />
        {labels.mode}
      </span>
    ),
    world: labels.world,
    nation: labels.nation ? (
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: labels.nationColor ?? undefined }}
        />
        {labels.nation}
      </span>
    ) : (
      <span className="text-fg-faint">…</span>
    ),
    victory: labels.victory,
    difficulty: labels.difficulty ?? <span className="text-fg-faint">…</span>,
  };

  const rows = steps.filter((s): s is Exclude<StepId, 'launch'> => s !== 'launch');

  return (
    <Glass className="p-4" data-testid="wizard-manifest">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
        {t('manifest.title')}
      </h2>
      <ul className="mt-3 flex flex-col gap-1">
        {rows.map((step) => (
          <li key={step}>
            <button
              type="button"
              onClick={() => onJump(step)}
              aria-current={step === current ? 'step' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                step === current ? 'bg-white/[0.07]' : 'hover:bg-white/[0.05]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-fg-faint">
                  {t(`steps.${step}.label`)}
                </span>
                <span className="block truncate text-sm font-medium text-fg">{value[step]}</span>
              </span>
              {touched.has(step) ? null : (
                <span className="shrink-0 text-[10px] text-fg-faint">{t('manifest.default')}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-fg-faint">
          {t('manifest.goal')}
        </p>
        <p className="mt-1 text-pretty text-xs leading-relaxed text-fg-muted">
          {tModes(`${resolved.mode.key}.goal`)}
        </p>
      </div>

      <Button
        variant="primary"
        size="lg"
        block
        icon={Rocket}
        className="mt-4"
        loading={launching}
        disabled={blocker !== null}
        aria-describedby="wizard-start-note"
        data-testid="wizard-start"
        onClick={onStart}
      >
        {launching ? t('preparing') : t('start')}
      </Button>
      <p
        id="wizard-start-note"
        className="mt-2 text-pretty text-center text-[11px] leading-relaxed text-fg-faint"
      >
        {blocker ?? t('manifest.hint')}
      </p>
    </Glass>
  );
}

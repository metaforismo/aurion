'use client';

// New game, as the preparation of an expedition: choose what you want to
// do (mode) first, then where, as whom, and how hard. Every step has a
// recommended default, so "Start" works from anywhere and the manifest on
// the right always shows the whole plan.

import { ArrowLeft, ArrowRight, Check, Rocket } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSfx } from '../../Audio';
import { useScenarioMessages } from '../../Panels/shared/useScenarioMessages';
import { Button, Glass, Kbd } from '../../ui';
import { useRouter } from '../../../i18n/navigation';
import { cn } from '../../../lib/cn';
import { useGameStore } from '../../../lib/store';
import { DifficultyStep } from './DifficultyStep';
import { LaunchStep } from './LaunchStep';
import { Manifest } from './Manifest';
import { ModeStep } from './ModeStep';
import { NationStep } from './NationStep';
import { DEFAULT_PLAN, resolvePlan, stepsFor, withMode, type Plan, type StepId } from './plan';
import { useWorlds } from './useWorlds';
import { VictoryStep } from './VictoryStep';
import { WorldStep } from './WorldStep';

export function Wizard() {
  const t = useTranslations('setup');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tMenu = useTranslations('menu');
  const tModes = useTranslations('modes');
  const router = useRouter();
  const sfx = useSfx();
  const startNewGame = useGameStore((s) => s.startNewGame);

  const { worlds, failed } = useWorlds();
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  const { t: tScenario } = useScenarioMessages(plan.worldId);
  const [step, setStep] = useState<StepId>('mode');
  // Steps the player has actually decided on; the rest show as "recommended".
  const [touched, setTouched] = useState<ReadonlySet<StepId>>(new Set());
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = useMemo(() => stepsFor(plan.mode), [plan.mode]);
  const resolved = useMemo(() => resolvePlan(plan, worlds), [plan, worlds]);
  const index = Math.max(0, steps.indexOf(step));
  const isLast = index === steps.length - 1;

  const update = useCallback((stepId: StepId, patch: (prev: Plan) => Plan) => {
    setPlan(patch);
    setTouched((prev) => (prev.has(stepId) ? prev : new Set(prev).add(stepId)));
    setError(null);
  }, []);

  const goTo = useCallback(
    (target: StepId) => {
      if (target === step) return;
      sfx('sfx.tab');
      setStep(target);
    },
    [sfx, step],
  );
  const goNext = useCallback(() => {
    const next = steps[index + 1];
    if (next) goTo(next);
  }, [goTo, index, steps]);
  const goBack = useCallback(() => {
    const prev = steps[index - 1];
    if (prev) goTo(prev);
  }, [goTo, index, steps]);

  // Unnamed games get "<nation> · <mode>" rather than an id and a timestamp.
  const nation = resolved.scenario?.countries.find((c) => c.id === resolved.nationId);
  // (tScenario echoes the key until the world's names have loaded.)
  const nationName = nation ? tScenario(nation.nameKey) : '';
  const defaultSaveName =
    nation && nationName !== nation.nameKey
      ? tMenu('saveName', { nation: nationName, mode: tModes(`${resolved.mode.key}.name`) })
      : '';

  // Why the game can't start yet, in the player's words; null = ready.
  const blocker = failed.has(plan.worldId)
    ? tErrors('scenarioNotFound')
    : !resolved.scenario || !resolved.nationId || !resolved.difficulty
      ? t('launch.loadingWorld')
      : null;

  const handleStart = useCallback(async () => {
    if (launching || blocker || !resolved.nationId || !resolved.difficulty) return;
    setLaunching(true);
    setError(null);
    sfx('sfx.confirm');
    try {
      const saveId = await startNewGame({
        scenarioId: plan.worldId,
        playerCountryId: resolved.nationId,
        victory: resolved.victory,
        difficultyId: resolved.difficulty.id,
        gameMode: plan.mode,
        name: plan.saveName.trim() || defaultSaveName || undefined,
      });
      router.push(`/play/${encodeURIComponent(saveId)}`);
    } catch (err) {
      sfx('sfx.error');
      setError(err instanceof Error ? err.message : tErrors('newGameFailed'));
      setLaunching(false);
    }
  }, [blocker, defaultSaveName, launching, plan, resolved, router, sfx, startNewGame, tErrors]);

  // Keyboard: Enter = next step, Backspace = previous, Ctrl/Cmd+Enter = start.
  // Arrow keys belong to the radio cards of the current step.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void handleStart();
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey || typing) return;
      const onControl = target?.closest('a, button:not([role="radio"]), [role="switch"]');
      if (e.key === 'Enter' && !onControl) {
        e.preventDefault();
        if (isLast) void handleStart();
        else goNext();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBack, goNext, handleStart, isLast]);

  // Moving between steps lands focus on the current choice, so arrow keys
  // work straight away and screen readers hear where they are.
  const contentRef = useRef<HTMLDivElement | null>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const root = contentRef.current;
    if (!root) return;
    const target =
      root.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ??
      root.querySelector<HTMLElement>('[data-step-heading]');
    target?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step]);

  const stepProps = { plan, resolved, worlds, failed, update };

  return (
    <main className="mx-auto grid w-full max-w-[1400px] flex-1 gap-6 px-4 pb-32 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-10">
      <section className="min-w-0">
        <h1 className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
          {t('title')}
        </h1>

        <StepRail steps={steps} current={step} onJump={goTo} />

        <div
          ref={contentRef}
          key={step}
          style={{ animation: 'rise-in 260ms cubic-bezier(0, 0, 0.2, 1) both' }}
        >
          <header className="mb-5 mt-6" aria-live="polite">
            <p className="font-mono text-[11px] text-fg-faint">
              {t('stepOf', { current: index + 1, total: steps.length })}
            </p>
            <h2
              data-step-heading
              tabIndex={-1}
              className="mt-1 text-balance text-2xl font-bold tracking-tight text-fg outline-none sm:text-3xl"
            >
              {t(`steps.${step}.title`)}
            </h2>
            <p className="mt-1.5 max-w-2xl text-pretty text-sm leading-relaxed text-fg-muted">
              {t(`steps.${step}.description`)}
            </p>
          </header>

          {step === 'mode' ? (
            <ModeStep
              {...stepProps}
              onPick={(mode) => update('mode', (prev) => withMode(prev, mode, worlds))}
            />
          ) : null}
          {step === 'world' ? <WorldStep {...stepProps} /> : null}
          {step === 'nation' ? <NationStep {...stepProps} /> : null}
          {step === 'victory' ? <VictoryStep {...stepProps} /> : null}
          {step === 'difficulty' ? <DifficultyStep {...stepProps} /> : null}
          {step === 'launch' ? <LaunchStep {...stepProps} onJump={goTo} /> : null}
        </div>

        {/* Desktop step navigation; phones get the fixed bar below. */}
        <div className="mt-6 hidden items-center gap-3 lg:flex">
          {index === 0 ? (
            <span className="w-24" />
          ) : (
            <Button icon={ArrowLeft} variant="ghost" onClick={goBack} data-testid="wizard-back">
              {tCommon('back')}
            </Button>
          )}
          <p className="flex flex-1 flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-fg-faint">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> {t('keys.choose')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>{t('keys.enterKey')}</Kbd> {t('keys.next')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Backspace</Kbd> {t('keys.back')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Ctrl</Kbd>
              <Kbd>{t('keys.enterKey')}</Kbd> {t('keys.start')}
            </span>
          </p>
          {isLast ? (
            <p className="text-xs text-fg-muted">{t('launch.ready')}</p>
          ) : (
            <Button iconRight={ArrowRight} onClick={goNext} data-testid="wizard-next">
              {tCommon('next')}
            </Button>
          )}
        </div>

        <div aria-live="assertive">
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-[#ff5d4d]/35 bg-[#ff5d4d]/[0.08] px-3 py-2 text-sm text-[#ffb0a6]"
            >
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <aside className="hidden lg:block">
        <div className="sticky top-6">
          <Manifest
            plan={plan}
            resolved={resolved}
            steps={steps}
            current={step}
            touched={touched}
            onJump={goTo}
            blocker={blocker}
            launching={launching}
            onStart={() => void handleStart()}
          />
        </div>
      </aside>

      {/* Phone bar: where you are, back/next, and Start always one tap away. */}
      <Glass className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 rounded-b-none rounded-t-2xl px-3 py-3 lg:hidden">
        {index === 0 ? null : (
          <Button
            icon={ArrowLeft}
            variant="ghost"
            onClick={goBack}
            aria-label={tCommon('back')}
            className="px-3"
          />
        )}
        <Button
          variant="primary"
          icon={Rocket}
          className="min-w-0 flex-1"
          loading={launching}
          disabled={blocker !== null}
          title={blocker ?? undefined}
          data-testid="wizard-start-compact"
          onClick={() => void handleStart()}
        >
          <span className="truncate">{launching ? t('preparing') : t('start')}</span>
        </Button>
        {isLast ? null : (
          <Button iconRight={ArrowRight} onClick={goNext} data-testid="wizard-next-compact">
            {tCommon('next')}
          </Button>
        )}
      </Glass>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Step rail
// ---------------------------------------------------------------------------

function StepRail({
  steps,
  current,
  onJump,
}: {
  steps: readonly StepId[];
  current: StepId;
  onJump: (id: StepId) => void;
}) {
  const t = useTranslations('setup');
  const currentIndex = steps.indexOf(current);
  return (
    <nav aria-label={t('railLabel')} className="mt-3">
      <ol className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((id, i) => {
          const isCurrent = id === current;
          const done = i < currentIndex;
          return (
            <li key={id} className="flex shrink-0 items-center gap-1">
              {i > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    'h-px w-3 sm:w-5',
                    i <= currentIndex ? 'bg-accent/60' : 'bg-white/15',
                  )}
                />
              ) : null}
              <button
                type="button"
                aria-current={isCurrent ? 'step' : undefined}
                data-testid={`wizard-step-${id}`}
                onClick={() => onJump(id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-medium transition-colors',
                  isCurrent
                    ? 'border-accent/60 bg-accent/10 text-fg'
                    : 'border-transparent text-fg-muted hover:bg-white/[0.07] hover:text-fg',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid h-5 w-5 place-items-center rounded-full font-mono text-[10px] font-semibold',
                    isCurrent
                      ? 'bg-accent text-black'
                      : done
                        ? 'bg-accent/20 text-accent'
                        : 'border border-white/20 text-fg-faint',
                  )}
                >
                  {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn(!isCurrent && 'hidden sm:inline')}>
                  {t(`steps.${id}.label`)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// New-game wizard: 4 steps — scenario → country → victory → difficulty.
// Phase 2 expansion of the Phase 1 3-step skeleton: scenario selection picks
// from a registry (with planned scenarios shown greyed out), and the player
// commits to a difficulty preset whose modifiers are stamped into the save's
// GameState.difficultyId.

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import type {
  CountryId,
  DifficultyTuning,
  Scenario,
  VictoryConditionId,
} from '@aurion/engine';

import { Link, useRouter } from '../../../i18n/navigation';
import { cn } from '../../../lib/cn';
import {
  getEffectiveStatus,
  listScenarios,
  loadScenario,
  type ScenarioId,
  type ScenarioMeta,
} from '../../../lib/scenarios';
import { useGameStore } from '../../../lib/store';
import { tone, toneChip } from '../../../lib/theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type StepId = 'scenario' | 'country' | 'victory' | 'difficulty';
const STEPS: readonly StepId[] = ['scenario', 'country', 'victory', 'difficulty'];

const VICTORY_IDS: readonly VictoryConditionId[] = [
  'economic',
  'military',
  'scientific',
  'diplomatic',
  'domination',
];

/** Difficulty id treated as the recommended default in the picker. */
const RECOMMENDED_DIFFICULTY = 'normal';

/**
 * Modifier display order. Anything not in this list is shown afterwards in
 * insertion order. Centralised so the chip layout stays consistent across
 * presets even if a scenario reorders the keys in JSON.
 */
const MODIFIER_ORDER: readonly string[] = [
  'aiAggression',
  'aiResearchSpeed',
  'playerIncome',
  'eventDifficulty',
  'aiAllianceBias',
  'spyDetectionAgainstPlayer',
  'lossToleranceWeeks',
  'eventChanceMultiplier',
];

/**
 * Modifiers where a value > 1 is *bad* for the player (more aggressive AI,
 * faster enemy research, harder events, etc). Used to colour the chip
 * (success vs danger).
 */
const HARSH_WHEN_HIGH = new Set<string>([
  'aiAggression',
  'aiResearchSpeed',
  'eventDifficulty',
  'aiAllianceBias',
  'spyDetectionAgainstPlayer',
  'eventChanceMultiplier',
]);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewGamePage() {
  const t = useTranslations('setup');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();

  const startNewGame = useGameStore((s) => s.startNewGame);
  const isLoading = useGameStore((s) => s.isLoading);

  const [step, setStep] = useState<StepId>('scenario');
  const [scenarioId, setScenarioId] = useState<ScenarioId | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [countryId, setCountryId] = useState<CountryId | null>(null);
  const [victory, setVictory] = useState<VictoryConditionId | null>(null);
  const [difficultyId, setDifficultyId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load scenario data once a scenario is picked. Re-runs when the scenario
  // id changes; cancels stale work to avoid races between selections.
  useEffect(() => {
    if (!scenarioId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScenarioError(null);
    loadScenario(scenarioId)
      .then((s) => {
        if (!cancelled) {
          setScenario(s);
          // Default the difficulty selection to the recommended preset if it
          // exists in this scenario, otherwise the first available entry.
          const recommended = s.difficulties.find(
            (d) => d.id === RECOMMENDED_DIFFICULTY,
          );
          const fallback = s.difficulties[0];
          const next = recommended ?? fallback;
          setDifficultyId((prev) => prev ?? next?.id ?? null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setScenario(null);
          setScenarioError(
            err instanceof Error ? err.message : tErrors('scenarioNotFound'),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [scenarioId, tErrors]);

  // Index of the current step in STEPS — used by breadcrumbs / step counter.
  const currentStepIndex = STEPS.indexOf(step);

  // ---- Step navigation ---------------------------------------------------

  /**
   * Allow jumping back to an earlier step via breadcrumbs. Forward jumps are
   * prevented because each later step depends on data from earlier ones.
   */
  const handleGoToStep = (target: StepId) => {
    const targetIndex = STEPS.indexOf(target);
    if (targetIndex <= currentStepIndex) {
      setStep(target);
    }
  };

  // ---- Final commit ------------------------------------------------------

  const handleStart = async () => {
    if (!scenarioId) {
      setSubmitError(tErrors('scenarioNotFound'));
      return;
    }
    if (!countryId) {
      setSubmitError(tErrors('playerCountryUnselected'));
      return;
    }
    if (!victory) {
      setSubmitError(tErrors('victoryNotSelected'));
      return;
    }
    // Difficulty defaults to the recommended preset when the scenario data
    // loads; we still guard here to keep the engine call fully typed.
    const finalDifficulty = difficultyId ?? RECOMMENDED_DIFFICULTY;
    setSubmitError(null);
    try {
      const saveId = await startNewGame({
        scenarioId,
        playerCountryId: countryId,
        victory,
        difficultyId: finalDifficulty,
      });
      router.push(`/play/${encodeURIComponent(saveId)}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : tErrors('newGameFailed'),
      );
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 bg-bg px-6 py-12 text-fg">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-fg">{t('title')}</h1>
        <Link
          href="/"
          className="text-sm text-fg-muted hover:text-fg"
        >
          {tCommon('back')}
        </Link>
      </header>

      <Breadcrumbs current={step} onJump={handleGoToStep} />

      <p className="text-sm text-fg-faint">
        {t('stepOf', { current: currentStepIndex + 1, total: STEPS.length })}
      </p>

      {step === 'scenario' ? (
        <ScenarioStep
          selected={scenarioId}
          onSelect={(id) => {
            setScenarioId(id);
            // Reset downstream selections when the scenario changes.
            setCountryId(null);
            setDifficultyId(null);
          }}
          onNext={() => scenarioId && setStep('country')}
        />
      ) : null}

      {step === 'country' ? (
        <CountryStep
          scenario={scenario}
          scenarioError={scenarioError}
          selected={countryId}
          onSelect={(id) => setCountryId(id)}
          onBack={() => setStep('scenario')}
          onNext={() => countryId && setStep('victory')}
        />
      ) : null}

      {step === 'victory' ? (
        <VictoryStep
          selected={victory}
          onSelect={(id) => setVictory(id)}
          onBack={() => setStep('country')}
          onNext={() => victory && setStep('difficulty')}
        />
      ) : null}

      {step === 'difficulty' ? (
        <DifficultyStep
          scenario={scenario}
          selected={difficultyId}
          onSelect={(id) => setDifficultyId(id)}
          onBack={() => setStep('victory')}
          onStart={handleStart}
          isLoading={isLoading}
        />
      ) : null}

      {submitError ? (
        <p className="text-sm text-danger" role="alert">
          {submitError}
        </p>
      ) : null}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------

function Breadcrumbs({
  current,
  onJump,
}: {
  current: StepId;
  onJump: (id: StepId) => void;
}) {
  const t = useTranslations('setup.breadcrumbs');
  const currentIndex = STEPS.indexOf(current);

  return (
    <nav aria-label={t('label')} className="flex flex-wrap items-center gap-1 text-sm">
      {STEPS.map((id, idx) => {
        const isCurrent = id === current;
        const isPast = idx < currentIndex;
        const label = t(id);
        return (
          <span key={id} className="flex items-center gap-1">
            {idx > 0 ? (
              <span aria-hidden className="text-fg-faint">
                ›
              </span>
            ) : null}
            {isPast ? (
              <button
                type="button"
                onClick={() => onJump(id)}
                className="rounded px-1 text-fg-muted underline-offset-2 hover:text-fg hover:underline"
              >
                {label}
              </button>
            ) : (
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'px-1',
                  isCurrent ? 'font-semibold text-fg' : 'text-fg-faint',
                )}
              >
                {label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Step 1: scenario
// ---------------------------------------------------------------------------

function ScenarioStep({
  selected,
  onSelect,
  onNext,
}: {
  selected: ScenarioId | null;
  onSelect: (id: ScenarioId) => void;
  onNext: () => void;
}) {
  const t = useTranslations('setup');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('setup.scenario.status');
  const scenarios = useMemo(() => listScenarios(), []);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-fg">
          {t('stepScenario.title')}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          {t('stepScenario.description')}
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {scenarios.map((meta) => {
          const status = getEffectiveStatus(meta.id);
          const disabled = status === 'planned';
          return (
            <li key={meta.id}>
              <ScenarioCard
                meta={meta}
                status={status}
                statusLabel={tStatus(status)}
                selected={selected === meta.id}
                disabled={disabled}
                onSelect={() => !disabled && onSelect(meta.id)}
              />
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!selected}
          onClick={onNext}
          className={cn(
            'rounded-xl px-5 py-2 text-sm font-semibold transition-colors',
            selected
              ? 'bg-accent text-bg hover:bg-accent-strong'
              : 'bg-surface-1 text-fg-faint',
          )}
        >
          {tCommon('next')}
        </button>
      </div>
    </section>
  );
}

function ScenarioCard({
  meta,
  status,
  statusLabel,
  selected,
  disabled,
  onSelect,
}: {
  meta: ScenarioMeta;
  status: 'available' | 'planned';
  statusLabel: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations();
  const tFallback = useTranslations('setup.scenario.fallback');
  // Resolve scenario name/description through the global UI bundle. Returns
  // the key when missing — we surface a localised fallback in that case.
  const rawName = t(meta.nameKey);
  const rawDescription = t(meta.descriptionKey);
  const name = rawName === meta.nameKey ? tFallback('name', { id: meta.id }) : rawName;
  const description =
    rawDescription === meta.descriptionKey
      ? tFallback('description')
      : rawDescription;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex h-full w-full flex-col gap-2 rounded-xl border px-4 py-3 text-left transition-colors',
        selected
          ? 'border-accent bg-accent/15 text-fg shadow-md'
          : 'border-border bg-surface-1 text-fg hover:border-border-strong',
        disabled && 'cursor-not-allowed opacity-60 hover:border-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-semibold">{name}</span>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            status === 'planned' ? toneChip('warning') : toneChip('success'),
          )}
        >
          {statusLabel}
        </span>
      </div>
      <p className="text-xs text-fg-muted">{description}</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step 2: country
// ---------------------------------------------------------------------------

function CountryStep({
  scenario,
  scenarioError,
  selected,
  onSelect,
  onBack,
  onNext,
}: {
  scenario: Scenario | null;
  scenarioError: string | null;
  selected: CountryId | null;
  onSelect: (id: CountryId) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations('setup');
  const tCommon = useTranslations('common');
  const tStats = useTranslations('setup.country.stats');
  const tCountry = useTranslations();
  const fmt = useFormatter();

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-fg">
          {t('stepCountry.title')}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          {t('stepCountry.description')}
        </p>
      </div>
      {scenarioError ? (
        <p
          className={cn(
            'rounded-md px-3 py-2 text-sm',
            toneChip('danger'),
          )}
        >
          {scenarioError}
        </p>
      ) : null}
      {scenario ? (
        <ul className="flex flex-col gap-2">
          {scenario.playableCountries.map((id) => {
            const country = scenario.countries.find((c) => c.id === id);
            if (!country) return null;
            const factionsCount = Object.keys(country.politics?.factions ?? {})
              .length;
            // Display name resolves through the merged i18n bundle (or the
            // country's id when no message file ships it). Same logic as the
            // home/play screens use elsewhere.
            const rawName = tCountry(country.nameKey);
            const displayName = rawName === country.nameKey ? id : rawName;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  aria-pressed={selected === id}
                  className={cn(
                    'flex w-full flex-col gap-2 rounded-xl border px-4 py-3 text-left transition-colors',
                    selected === id
                      ? 'border-accent bg-accent/15 text-fg shadow-md'
                      : 'border-border bg-surface-1 text-fg hover:border-border-strong',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: country.color }}
                    />
                    <span className="font-medium">{displayName}</span>
                    <span className="ml-auto text-xs text-fg-faint">{id}</span>
                  </div>
                  <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                    <div className="flex items-center gap-1">
                      <dt>{tStats('gdp')}:</dt>
                      <dd className="font-mono text-fg">
                        {fmt.number(country.economy.gdp, {
                          notation: 'compact',
                          maximumFractionDigits: 1,
                        })}
                      </dd>
                    </div>
                    <div className="flex items-center gap-1">
                      <dt>{tStats('popularity')}:</dt>
                      <dd className="font-mono text-fg">
                        {fmt.number(country.politics?.popularity ?? 0, {
                          maximumFractionDigits: 0,
                        })}
                      </dd>
                    </div>
                    <div className="flex items-center gap-1">
                      <dt>{tStats('factions')}:</dt>
                      <dd className="font-mono text-fg">{factionsCount}</dd>
                    </div>
                  </dl>
                </button>
              </li>
            );
          })}
        </ul>
      ) : !scenarioError ? (
        <p className="text-sm text-fg-faint">…</p>
      ) : null}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-border bg-surface-1 px-5 py-2 text-sm text-fg hover:border-border-strong"
        >
          ← {tCommon('back')}
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={onNext}
          className={cn(
            'rounded-xl px-5 py-2 text-sm font-semibold transition-colors',
            selected
              ? 'bg-accent text-bg hover:bg-accent-strong'
              : 'bg-surface-1 text-fg-faint',
          )}
        >
          {tCommon('next')}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Step 3: victory
// ---------------------------------------------------------------------------

function VictoryStep({
  selected,
  onSelect,
  onBack,
  onNext,
}: {
  selected: VictoryConditionId | null;
  onSelect: (id: VictoryConditionId) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations('setup');
  const tCommon = useTranslations('common');
  const tVictory = useTranslations('victory');

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-fg">
          {t('stepVictory.title')}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          {t('stepVictory.description')}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {VICTORY_IDS.map((id) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              aria-pressed={selected === id}
              className={cn(
                'flex w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors',
                selected === id
                  ? 'border-accent bg-accent/15 text-fg shadow-md'
                  : 'border-border bg-surface-1 text-fg hover:border-border-strong',
              )}
            >
              <span className="font-medium">{tVictory(`${id}.name`)}</span>
              <span className="text-xs text-fg-muted">
                {tVictory(`${id}.description`)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-border bg-surface-1 px-5 py-2 text-sm text-fg hover:border-border-strong"
        >
          ← {tCommon('back')}
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={onNext}
          className={cn(
            'rounded-xl px-5 py-2 text-sm font-semibold transition-colors',
            selected
              ? 'bg-accent text-bg hover:bg-accent-strong'
              : 'bg-surface-1 text-fg-faint',
          )}
        >
          {tCommon('next')}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Step 4: difficulty
// ---------------------------------------------------------------------------

function DifficultyStep({
  scenario,
  selected,
  onSelect,
  onBack,
  onStart,
  isLoading,
}: {
  scenario: Scenario | null;
  selected: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onStart: () => void;
  isLoading: boolean;
}) {
  const t = useTranslations('setup');
  const tCommon = useTranslations('common');

  const presets = scenario?.difficulties ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-fg">
          {t('stepDifficulty.title')}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          {t('stepDifficulty.description')}
        </p>
      </div>
      {presets.length === 0 ? (
        <p className="text-sm text-fg-faint">…</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {presets.map((preset) => (
            <li key={preset.id}>
              <DifficultyCard
                preset={preset}
                selected={selected === preset.id}
                onSelect={() => onSelect(preset.id)}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-border bg-surface-1 px-5 py-2 text-sm text-fg hover:border-border-strong"
        >
          ← {tCommon('back')}
        </button>
        <button
          type="button"
          disabled={!selected || isLoading}
          onClick={onStart}
          className={cn(
            'rounded-xl px-5 py-2 text-sm font-semibold transition-colors',
            selected && !isLoading
              ? 'bg-success text-bg hover:opacity-90'
              : 'bg-surface-1 text-fg-faint',
          )}
        >
          {isLoading ? t('preparing') : t('start')}
        </button>
      </div>
    </section>
  );
}

function DifficultyCard({
  preset,
  selected,
  onSelect,
}: {
  preset: DifficultyTuning;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations();
  const tStep = useTranslations('setup.stepDifficulty');
  const tFallback = useTranslations('setup.difficulty.fallback');

  // Resolve preset name/description through the UI bundle (`difficulty.<id>.*`).
  // The DifficultyTuning entry only carries a name key; we synthesise the
  // description key from the same id since scenario JSON does not enforce it.
  const rawName = t(preset.nameKey);
  const name = rawName === preset.nameKey ? tFallback('name', { id: preset.id }) : rawName;
  const descriptionKey = `difficulty.${preset.id}.description`;
  const rawDescription = t(descriptionKey);
  const description = rawDescription === descriptionKey ? '' : rawDescription;

  // The PRESET_FROM_REGISTRY const ensures we surface the recommended badge
  // even when a scenario tweaks names / order; "normal" is the canonical id.
  const recommended = preset.id === RECOMMENDED_DIFFICULTY;
  // Iron Man may live as a separate preset id, OR as a flag on a preset (per
  // the Phase 2 spec's optional `ironMan?: boolean` extension). We treat both
  // equivalently for the UI badge and warning copy.
  const isIronMan =
    preset.id === 'ironMan' ||
    (preset as DifficultyTuning & { ironMan?: boolean }).ironMan === true;

  // Order modifiers for stable presentation; unknown keys append at the end.
  const modifierEntries: Array<[string, number]> = useMemo(() => {
    const entries = Object.entries(preset.modifiers ?? {}) as Array<[string, number]>;
    const known = MODIFIER_ORDER.filter((k) =>
      entries.some(([key]) => key === k),
    ).map((k) => entries.find(([key]) => key === k)!) as Array<[string, number]>;
    const extra = entries.filter(([key]) => !MODIFIER_ORDER.includes(key));
    return [...known, ...extra];
  }, [preset.modifiers]);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex h-full w-full flex-col gap-3 rounded-xl border px-4 py-4 text-left transition-colors',
        selected
          ? 'border-accent bg-accent/15 text-fg shadow-lg'
          : 'border-border bg-surface-1 text-fg hover:border-border-strong',
        recommended && !selected && 'shadow-[0_0_0_1px_var(--color-accent-soft)]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold">{name}</span>
        {recommended ? (
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', toneChip('accent'))}>
            {tStep('recommended')}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="text-xs text-fg-muted">{description}</p>
      ) : null}
      {isIronMan ? (
        <p className={cn('rounded-md px-2 py-1 text-[11px]', toneChip('danger'))}>
          {tStep('ironManWarning')}
        </p>
      ) : null}
      <ul className="flex flex-wrap gap-1.5">
        {modifierEntries.map(([key, value]) => (
          <li key={key}>
            <ModifierChip name={key} value={value} />
          </li>
        ))}
      </ul>
    </button>
  );
}

function ModifierChip({ name, value }: { name: string; value: number }) {
  const tMod = useTranslations('setup.stepDifficulty.modifier');
  const fmt = useFormatter();
  const label = (() => {
    const key = name as
      | 'aiAggression'
      | 'aiResearchSpeed'
      | 'playerIncome'
      | 'eventDifficulty'
      | 'aiAllianceBias'
      | 'spyDetectionAgainstPlayer'
      | 'lossToleranceWeeks'
      | 'eventChanceMultiplier';
    // Fall back to the raw key when no localisation exists yet — keeps the
    // chip visible during scenario authoring.
    const raw = tMod(key);
    return raw === `setup.stepDifficulty.modifier.${key}` ? name : raw;
  })();

  // Deltas are expressed as a percentage from the baseline 1.0. Round to the
  // nearest integer so chips stay compact.
  const deltaPct = Math.round((value - 1) * 100);
  const isNeutral = deltaPct === 0;
  const harshWhenHigh = HARSH_WHEN_HIGH.has(name);

  // A chip is "good for the player" when it represents an improvement: a
  // higher value on a player-friendly modifier, or a lower value on a harsh
  // one. Maps to success/danger tone.
  const playerBenefits = harshWhenHigh ? deltaPct < 0 : deltaPct > 0;

  const chipTone = isNeutral
    ? 'muted'
    : playerBenefits
      ? 'success'
      : 'danger';
  const text = isNeutral
    ? tMod('neutral')
    : deltaPct > 0
      ? tMod('deltaPositive', {
          percent: fmt.number(deltaPct, { maximumFractionDigits: 0 }),
        })
      : tMod('deltaNegative', {
          percent: fmt.number(deltaPct, { maximumFractionDigits: 0 }),
        });

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
        toneChip(chipTone),
      )}
    >
      <span className={cn('font-medium', tone('neutral'))}>{label}</span>
      <span className="font-mono">{text}</span>
    </span>
  );
}

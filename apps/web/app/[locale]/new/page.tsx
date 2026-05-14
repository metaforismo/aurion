// New-game wizard skeleton: scenario → country → victory. Functional but
// minimal — the visual polish comes in Wave 2.

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { CountryId, Scenario, VictoryConditionId } from '@aurion/engine';

import { Link, useRouter } from '../../../i18n/navigation';
import { cn } from '../../../lib/cn';
import { loadScenario, SCENARIO_IDS, type ScenarioId } from '../../../lib/scenarios';
import { useGameStore } from '../../../lib/store';

const VICTORY_IDS: readonly VictoryConditionId[] = [
  'economic',
  'military',
  'scientific',
  'diplomatic',
  'domination',
];

export default function NewGamePage() {
  const t = useTranslations('setup');
  const tVictory = useTranslations('victory');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();

  const startNewGame = useGameStore((s) => s.startNewGame);
  const isLoading = useGameStore((s) => s.isLoading);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scenarioId, setScenarioId] = useState<ScenarioId | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [countryId, setCountryId] = useState<CountryId | null>(null);
  const [victory, setVictory] = useState<VictoryConditionId | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load scenario data once a scenario is picked.
  useEffect(() => {
    if (!scenarioId) return;
    let cancelled = false;
    setScenarioError(null);
    loadScenario(scenarioId)
      .then((s) => {
        if (!cancelled) setScenario(s);
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
    setSubmitError(null);
    try {
      const saveId = await startNewGame({
        scenarioId,
        playerCountryId: countryId,
        victory,
      });
      router.push(`/play/${encodeURIComponent(saveId)}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : tErrors('newGameFailed'),
      );
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-50">{t('title')}</h1>
        <Link
          href="/"
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          {tCommon('back')}
        </Link>
      </header>

      <p className="text-sm text-slate-500">
        {t('stepOf', { current: step, total: 3 })}
      </p>

      {step === 1 ? (
        <ScenarioStep
          ids={SCENARIO_IDS}
          selected={scenarioId}
          onSelect={(id) => {
            setScenarioId(id);
            setCountryId(null);
          }}
          onNext={() => scenarioId && setStep(2)}
          title={t('stepScenario.title')}
          description={t('stepScenario.description')}
          nextLabel={tCommon('next')}
        />
      ) : null}

      {step === 2 ? (
        <CountryStep
          scenario={scenario}
          scenarioError={scenarioError}
          selected={countryId}
          onSelect={(id) => setCountryId(id)}
          onBack={() => setStep(1)}
          onNext={() => countryId && setStep(3)}
          title={t('stepCountry.title')}
          description={t('stepCountry.description')}
          backLabel={tCommon('back')}
          nextLabel={tCommon('next')}
        />
      ) : null}

      {step === 3 ? (
        <VictoryStep
          selected={victory}
          onSelect={(id) => setVictory(id)}
          onBack={() => setStep(2)}
          onStart={handleStart}
          title={t('stepVictory.title')}
          description={t('stepVictory.description')}
          backLabel={tCommon('back')}
          startLabel={isLoading ? t('preparing') : t('start')}
          getName={(id) => tVictory(`${id}.name`)}
          getDescription={(id) => tVictory(`${id}.description`)}
          isLoading={isLoading}
        />
      ) : null}

      {submitError ? (
        <p className="text-sm text-rose-400" role="alert">
          {submitError}
        </p>
      ) : null}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function ScenarioStep({
  ids,
  selected,
  onSelect,
  onNext,
  title,
  description,
  nextLabel,
}: {
  ids: readonly ScenarioId[];
  selected: ScenarioId | null;
  onSelect: (id: ScenarioId) => void;
  onNext: () => void;
  title: string;
  description: string;
  nextLabel: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {ids.map((id) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left',
                selected === id
                  ? 'border-indigo-500 bg-indigo-500/10 text-slate-50'
                  : 'border-slate-800 bg-slate-900/50 text-slate-200 hover:border-slate-700',
              )}
            >
              <span className="font-medium">{id}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={!selected}
        onClick={onNext}
        className={cn(
          'self-end rounded-xl px-5 py-2 text-sm font-semibold',
          selected
            ? 'bg-indigo-500 text-white hover:bg-indigo-400'
            : 'bg-slate-800 text-slate-500',
        )}
      >
        {nextLabel}
      </button>
    </section>
  );
}

function CountryStep({
  scenario,
  scenarioError,
  selected,
  onSelect,
  onBack,
  onNext,
  title,
  description,
  backLabel,
  nextLabel,
}: {
  scenario: Scenario | null;
  scenarioError: string | null;
  selected: CountryId | null;
  onSelect: (id: CountryId) => void;
  onBack: () => void;
  onNext: () => void;
  title: string;
  description: string;
  backLabel: string;
  nextLabel: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      {scenarioError ? (
        <p className="rounded-md border border-rose-700 bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
          {scenarioError}
        </p>
      ) : null}
      {scenario ? (
        <ul className="flex flex-col gap-2">
          {scenario.playableCountries.map((id) => {
            const country = scenario.countries.find((c) => c.id === id);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left',
                    selected === id
                      ? 'border-indigo-500 bg-indigo-500/10 text-slate-50'
                      : 'border-slate-800 bg-slate-900/50 text-slate-200 hover:border-slate-700',
                  )}
                >
                  <span
                    aria-hidden
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: country?.color ?? '#888' }}
                  />
                  <span className="font-medium">{country?.nameKey ?? id}</span>
                  <span className="ml-auto text-xs text-slate-500">{id}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : !scenarioError ? (
        <p className="text-sm text-slate-500">…</p>
      ) : null}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-800 px-5 py-2 text-sm text-slate-300 hover:bg-slate-900"
        >
          {backLabel}
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={onNext}
          className={cn(
            'rounded-xl px-5 py-2 text-sm font-semibold',
            selected
              ? 'bg-indigo-500 text-white hover:bg-indigo-400'
              : 'bg-slate-800 text-slate-500',
          )}
        >
          {nextLabel}
        </button>
      </div>
    </section>
  );
}

function VictoryStep({
  selected,
  onSelect,
  onBack,
  onStart,
  title,
  description,
  backLabel,
  startLabel,
  getName,
  getDescription,
  isLoading,
}: {
  selected: VictoryConditionId | null;
  onSelect: (id: VictoryConditionId) => void;
  onBack: () => void;
  onStart: () => void;
  title: string;
  description: string;
  backLabel: string;
  startLabel: string;
  getName: (id: VictoryConditionId) => string;
  getDescription: (id: VictoryConditionId) => string;
  isLoading: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {VICTORY_IDS.map((id) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              className={cn(
                'flex w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left',
                selected === id
                  ? 'border-indigo-500 bg-indigo-500/10 text-slate-50'
                  : 'border-slate-800 bg-slate-900/50 text-slate-200 hover:border-slate-700',
              )}
            >
              <span className="font-medium">{getName(id)}</span>
              <span className="text-xs text-slate-400">{getDescription(id)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-800 px-5 py-2 text-sm text-slate-300 hover:bg-slate-900"
        >
          {backLabel}
        </button>
        <button
          type="button"
          disabled={!selected || isLoading}
          onClick={onStart}
          className={cn(
            'rounded-xl px-5 py-2 text-sm font-semibold',
            selected && !isLoading
              ? 'bg-emerald-500 text-white hover:bg-emerald-400'
              : 'bg-slate-800 text-slate-500',
          )}
        >
          {startLabel}
        </button>
      </div>
    </section>
  );
}

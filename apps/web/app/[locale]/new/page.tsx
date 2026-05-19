// New-game wizard: 5 steps — scenario → country → victory → difficulty →
// gameMode. Phase 3 adds the game-mode picker as the final step before the
// commit button so the player explicitly opts into Endless / Eternal /
// Dethrone before the engine creates the initial state. Default is
// 'classic'; saves loaded later without a `gameMode` get migrated to
// 'classic' too — see lib/persistence.ts:migrateSaveEntry.

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import {
  BookOpen,
  Coins,
  Crown,
  Flag,
  Gauge,
  Globe,
  Handshake,
  Infinity as InfinityIcon,
  Microscope,
  Shield,
  Skull,
  Sword,
  Target,
} from 'lucide-react';
import type {
  CountryId,
  DifficultyTuning,
  GameMode,
  Scenario,
  VictoryConditionId,
} from '@aurion/engine';

import { useScenarioMessages } from '../../../components/Panels/shared/useScenarioMessages';
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

type StepId = 'scenario' | 'country' | 'victory' | 'difficulty' | 'gameMode';
const STEPS: readonly StepId[] = [
  'scenario',
  'country',
  'victory',
  'difficulty',
  'gameMode',
];

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
 * Game-mode options the wizard surfaces in step 5. Wave 10 ships era-paced
 * for the two scenarios that declare an `eras[]` schedule (Mondo
 * Contemporaneo, Guerra Fredda); the wizard greys out the card for scenarios
 * without ones (see `SCENARIOS_WITH_ERAS`).
 */
type SelectableGameMode = GameMode;
const GAME_MODES: readonly SelectableGameMode[] = [
  'classic',
  'eternal',
  'era-paced',
  'dethrone',
];

/**
 * Scenario ids that ship a full `eras` schedule and therefore support
 * era-paced. The card stays selectable on every scenario (so the player can
 * read about the mode) but is greyed-out + disabled when the active scenario
 * doesn't carry the metadata. Mirrors the JSON we ship in
 * `apps/web/content/scenarios/{mondo-contemporaneo,guerra-fredda}.json`.
 */
const SCENARIOS_WITH_ERAS: ReadonlySet<string> = new Set([
  'mondo-contemporaneo',
  'guerra-fredda',
]);

/** Default game mode pre-selected when the player lands on step 5. */
const DEFAULT_GAME_MODE: SelectableGameMode = 'classic';

/**
 * Game mode flagged with a "recommended" badge in the picker. Eternal is the
 * mode the spec recommends for most new players (open-ended, milestones
 * instead of hard endings).
 */
const RECOMMENDED_GAME_MODE: SelectableGameMode = 'eternal';

/**
 * Scenario ids whose blocs make the Dethrone-loss `isolation` trigger
 * meaningful. When a player picks Dethrone on a scenario NOT in this set the
 * wizard surfaces an informational warning explaining that only the
 * out-of-top-3 trigger will apply. Mirrors the spec's
 * `dethroneIsolationOnByDefault` flag (we don't read the JSON here because
 * the wizard already knows which scenarios are bloc-based).
 */
const DETHRONE_BLOC_SCENARIOS: ReadonlySet<string> = new Set([
  'mondo-contemporaneo',
  'guerra-fredda',
]);

/**
 * Scenario ids that ship a nuclear arsenal in their initial state OR have
 * `dethroneIsolationOnByDefault === true`. The scenario picker surfaces an
 * extra disclaimer when one of these is selected so the player knows nuclear
 * warfare mechanics are part of the run before committing.
 *
 * Hard-coded mirror of the Phase 3 scenarios — kept here (instead of read
 * from the JSON) so the picker doesn't have to load every scenario eagerly
 * just to render its disclaimer chip.
 */
const NUCLEAR_SCENARIOS: ReadonlySet<string> = new Set([
  'mondo-contemporaneo',
  'guerra-fredda',
]);

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
// Icon maps (lucide-react, monochrome outline). Centralised so each step
// composes a single source of truth and so we can swap icons without hunting
// through the cards. Rendered with `text-fg-muted` to keep the editorial
// monochrome direction (no decorative colour, only the active card's accent
// border carries hue).
// ---------------------------------------------------------------------------

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const VICTORY_ICONS: Readonly<Record<VictoryConditionId, IconComponent>> = {
  economic: Coins,
  military: Sword,
  scientific: Microscope,
  diplomatic: Handshake,
  domination: Globe,
};

const DIFFICULTY_ICONS: Readonly<Record<string, IconComponent>> = {
  easy: Shield,
  normal: Gauge,
  hard: Target,
  ironMan: Skull,
};

const GAME_MODE_ICONS: Readonly<Record<GameMode, IconComponent>> = {
  classic: Flag,
  eternal: InfinityIcon,
  'era-paced': BookOpen,
  dethrone: Crown,
};

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
  // Phase 3: game mode is required (no UI path that skips this step), so we
  // pre-seed it with the default rather than letting it be null.
  const [gameMode, setGameMode] = useState<SelectableGameMode>(
    DEFAULT_GAME_MODE,
  );
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

  // Era-paced safety: when the player swaps to a scenario that doesn't ship
  // an `eras[]` schedule, we silently coerce a previously-selected era-paced
  // mode back to the default. The wizard already disables the card in that
  // case but state may carry over from an earlier scenario pick.
  useEffect(() => {
    if (
      gameMode === 'era-paced' &&
      scenarioId !== null &&
      !SCENARIOS_WITH_ERAS.has(scenarioId)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGameMode(DEFAULT_GAME_MODE);
    }
  }, [gameMode, scenarioId]);

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
        gameMode,
      });
      router.push(`/play/${encodeURIComponent(saveId)}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : tErrors('newGameFailed'),
      );
    }
  };

  // Each step renders its own small-caps "Passo N di 5" line through
  // <StepHeading>, bound to the section title. The orphan line that used to
  // float between the breadcrumb and the cards was removed — the breadcrumb
  // already announces position via `aria-current` + the bolded current step.
  const stepCounterLabel = t('stepOf', {
    current: currentStepIndex + 1,
    total: STEPS.length,
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 bg-bg px-6 py-10 text-fg">
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

      {step === 'scenario' ? (
        <ScenarioStep
          stepLabel={stepCounterLabel}
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
          stepLabel={stepCounterLabel}
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
          stepLabel={stepCounterLabel}
          selected={victory}
          onSelect={(id) => setVictory(id)}
          onBack={() => setStep('country')}
          onNext={() => victory && setStep('difficulty')}
        />
      ) : null}

      {step === 'difficulty' ? (
        <DifficultyStep
          stepLabel={stepCounterLabel}
          scenario={scenario}
          selected={difficultyId}
          onSelect={(id) => setDifficultyId(id)}
          onBack={() => setStep('victory')}
          onNext={() => difficultyId && setStep('gameMode')}
        />
      ) : null}

      {step === 'gameMode' ? (
        <GameModeStep
          stepLabel={stepCounterLabel}
          scenarioId={scenarioId}
          selected={gameMode}
          onSelect={setGameMode}
          onBack={() => setStep('difficulty')}
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
// Shared step chrome
//
// Two tiny helpers used by every step so the wizard stays consistent:
//   - StepHeading: small-caps step counter + section title + description.
//     Replaces the previous orphan "Passo N di 5" line that floated above
//     each section.
//   - NavButton: editorial back/next button (rounded-sm, no pill chrome).
//     The primary variant matches the accent CTA used by ActionButton — the
//     final "Avvia partita" reuses it so the wizard ends on the same amber
//     accent the rest of the editorial chrome lands on (no more green-cyan).
// ---------------------------------------------------------------------------

function StepHeading({
  stepLabel,
  title,
  description,
}: {
  stepLabel: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
        {stepLabel}
      </span>
      <h2 className="text-xl font-semibold text-fg">{title}</h2>
      <p className="text-sm text-fg-muted">{description}</p>
    </div>
  );
}

type NavButtonVariant = 'primary' | 'secondary';

function NavButton({
  variant,
  disabled,
  onClick,
  children,
}: {
  variant: NavButtonVariant;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  // Both variants use the editorial radius (rounded-sm). Primary is the amber
  // accent CTA — same chrome as ActionButton's "primary" tone, so the
  // wizard's "Avvia partita" lines up with in-game action buttons. Secondary
  // is a hairline-bordered transparent surface for back/cancel.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        'rounded-sm border px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        variant === 'primary'
          ? disabled
            ? 'cursor-not-allowed border-border bg-transparent text-fg-faint'
            : 'border-accent bg-accent text-bg hover:border-accent-strong hover:bg-accent-strong'
          : disabled
            ? 'cursor-not-allowed border-border bg-transparent text-fg-faint'
            : 'border-border bg-transparent text-fg hover:border-border-strong',
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step 1: scenario
// ---------------------------------------------------------------------------

function ScenarioStep({
  stepLabel,
  selected,
  onSelect,
  onNext,
}: {
  stepLabel: string;
  selected: ScenarioId | null;
  onSelect: (id: ScenarioId) => void;
  onNext: () => void;
}) {
  const t = useTranslations('setup');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('setup.scenario.status');
  const tDisclaimer = useTranslations('setup.disclaimer');
  const scenarios = useMemo(() => listScenarios(), []);

  // Players can hide the disclaimer once they've read it. We don't persist
  // this — the dismissal is per-mount, matching how the dethrone-isolation
  // note (the closest comparable banner on step 5) behaves.
  const [nuclearDisclaimerDismissed, setNuclearDisclaimerDismissed] =
    useState(false);
  const showNuclearDisclaimer =
    !!selected &&
    NUCLEAR_SCENARIOS.has(selected) &&
    !nuclearDisclaimerDismissed;

  return (
    <section className="flex flex-col gap-4">
      <StepHeading
        stepLabel={stepLabel}
        title={t('stepScenario.title')}
        description={t('stepScenario.description')}
      />
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
                onSelect={() => {
                  if (disabled) return;
                  onSelect(meta.id);
                  // Re-arm the disclaimer when the player picks a different
                  // scenario — they should see it once per nuclear pick.
                  setNuclearDisclaimerDismissed(false);
                }}
              />
            </li>
          );
        })}
      </ul>
      {showNuclearDisclaimer ? (
        <div
          role="note"
          className={cn(
            'flex items-start gap-2 rounded-md px-3 py-2 text-xs',
            toneChip('warning'),
          )}
        >
          <span aria-hidden className="select-none">⚠</span>
          <span className="flex-1">{tDisclaimer('nuclearWarfare')}</span>
          <button
            type="button"
            onClick={() => setNuclearDisclaimerDismissed(true)}
            aria-label={tCommon('close')}
            className="rounded-sm px-1 text-fg-muted transition hover:text-fg"
          >
            ×
          </button>
        </div>
      ) : null}
      <div className="flex justify-end pt-2">
        <NavButton
          variant="primary"
          disabled={!selected}
          onClick={onNext}
        >
          {tCommon('next')}
        </NavButton>
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

  // Editorial direction: the "available" chip read as decorative noise when
  // every scenario was available. We only render a status chip for
  // non-available states (currently just `planned`). Future lock states
  // (Premium, Locked, …) can fold into the same `showStatus` branch.
  const showStatus = status !== 'available';

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex h-full w-full flex-col gap-2 rounded-md border px-4 py-3 text-left transition-colors',
        selected
          ? 'border-accent bg-accent/15 text-fg shadow-md'
          : 'border-border bg-surface-1 text-fg hover:border-border-strong',
        disabled && 'cursor-not-allowed opacity-60 hover:border-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-semibold">{name}</span>
        {showStatus ? (
          <span
            className={cn(
              'shrink-0 rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              toneChip('warning'),
            )}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-fg-muted">{description}</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step 2: country
// ---------------------------------------------------------------------------

function CountryStep({
  stepLabel,
  scenario,
  scenarioError,
  selected,
  onSelect,
  onBack,
  onNext,
}: {
  stepLabel: string;
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
  // Country / capital / faction names live ONLY in the scenario side-car
  // bundles (apps/web/content/scenarios/<id>.{en,it}.json) — they are NOT in
  // the global `messages/{en,it}.json` UI bundle. Using `useTranslations()`
  // here would surface MISSING_MESSAGE warnings for every `country.<id>.name`
  // key. We resolve them through the scenario message bundle instead, same
  // pattern as EventModal / NotificationItem / EraTransitionModal.
  const scenarioId = (scenario?.id ?? null) as ScenarioId | null;
  const { t: tScenario } = useScenarioMessages(scenarioId);
  const fmt = useFormatter();

  return (
    <section className="flex flex-col gap-4">
      <StepHeading
        stepLabel={stepLabel}
        title={t('stepCountry.title')}
        description={t('stepCountry.description')}
      />
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
            // Resolve display name + capital through the scenario message
            // bundle. `tScenario` returns the raw key on miss; we degrade to
            // the country id so the row never looks empty while the bundle
            // is still loading (or when content is missing).
            const rawName = tScenario(country.nameKey);
            const displayName =
              rawName && rawName !== country.nameKey ? rawName : id;
            const capitalKey = (country as { capitalKey?: string }).capitalKey;
            const rawCapital = capitalKey ? tScenario(capitalKey) : '';
            const capital =
              capitalKey && rawCapital !== capitalKey ? rawCapital : '';
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  aria-pressed={selected === id}
                  className={cn(
                    'flex w-full flex-col gap-2 rounded-md border px-4 py-3 text-left transition-colors',
                    selected === id
                      ? 'border-accent bg-accent/15 text-fg shadow-md'
                      : 'border-border bg-surface-1 text-fg hover:border-border-strong',
                  )}
                >
                  {/* Row: small colour dot + display name (+ optional capital).
                      The duplicated raw id chip on the right was a debug
                      remnant — removed so the row reads like a city + name
                      banner instead of "name … name" noise. */}
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: country.color }}
                    />
                    <span className="font-medium">{displayName}</span>
                    {capital ? (
                      <span className="text-xs text-fg-faint">· {capital}</span>
                    ) : null}
                  </div>
                  {/* Stats row: labels are `text-fg-faint` (one notch
                      softer than `text-fg-muted`) so the numbers carry the
                      visual weight per editorial direction. */}
                  <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <div className="flex items-center gap-1">
                      <dt className="text-fg-faint">{tStats('gdp')}:</dt>
                      <dd className="font-mono text-fg">
                        {fmt.number(country.economy.gdp, {
                          notation: 'compact',
                          maximumFractionDigits: 1,
                        })}
                      </dd>
                    </div>
                    <div className="flex items-center gap-1">
                      <dt className="text-fg-faint">{tStats('popularity')}:</dt>
                      <dd className="font-mono text-fg">
                        {fmt.number(country.politics?.popularity ?? 0, {
                          maximumFractionDigits: 0,
                        })}
                      </dd>
                    </div>
                    <div className="flex items-center gap-1">
                      <dt className="text-fg-faint">{tStats('factions')}:</dt>
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
      <div className="flex justify-between pt-2">
        <NavButton variant="secondary" onClick={onBack}>
          ← {tCommon('back')}
        </NavButton>
        <NavButton
          variant="primary"
          disabled={!selected}
          onClick={onNext}
        >
          {tCommon('next')}
        </NavButton>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Step 3: victory
// ---------------------------------------------------------------------------

function VictoryStep({
  stepLabel,
  selected,
  onSelect,
  onBack,
  onNext,
}: {
  stepLabel: string;
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
      <StepHeading
        stepLabel={stepLabel}
        title={t('stepVictory.title')}
        description={t('stepVictory.description')}
      />
      <ul className="flex flex-col gap-2">
        {VICTORY_IDS.map((id) => {
          // Single mono outline icon per victory type, sourced from
          // lucide-react and rendered with `text-fg-muted` — the active
          // card's accent border still carries the only colour cue.
          const Icon = VICTORY_ICONS[id];
          const isSelected = selected === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                aria-pressed={isSelected}
                className={cn(
                  'flex w-full flex-row items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors',
                  isSelected
                    ? 'border-accent bg-accent/15 text-fg shadow-md'
                    : 'border-border bg-surface-1 text-fg hover:border-border-strong',
                )}
              >
                <Icon
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-fg-muted"
                  strokeWidth={1.5}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-medium">{tVictory(`${id}.name`)}</span>
                  <span className="text-xs text-fg-muted">
                    {tVictory(`${id}.description`)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-between pt-2">
        <NavButton variant="secondary" onClick={onBack}>
          ← {tCommon('back')}
        </NavButton>
        <NavButton
          variant="primary"
          disabled={!selected}
          onClick={onNext}
        >
          {tCommon('next')}
        </NavButton>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Step 4: difficulty
// ---------------------------------------------------------------------------

function DifficultyStep({
  stepLabel,
  scenario,
  selected,
  onSelect,
  onBack,
  onNext,
}: {
  stepLabel: string;
  scenario: Scenario | null;
  selected: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations('setup');
  const tCommon = useTranslations('common');

  const presets = scenario?.difficulties ?? [];

  return (
    <section className="flex flex-col gap-4">
      <StepHeading
        stepLabel={stepLabel}
        title={t('stepDifficulty.title')}
        description={t('stepDifficulty.description')}
      />
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
      <div className="flex justify-between pt-2">
        <NavButton variant="secondary" onClick={onBack}>
          ← {tCommon('back')}
        </NavButton>
        <NavButton
          variant="primary"
          disabled={!selected}
          onClick={onNext}
        >
          {tCommon('next')}
        </NavButton>
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

  // Pick the icon by preset id; fall back to Gauge (generic difficulty meter)
  // so authors who add custom presets still get a visual anchor.
  const Icon = DIFFICULTY_ICONS[preset.id] ?? Gauge;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex h-full w-full flex-col gap-3 rounded-md border px-4 py-4 text-left transition-colors',
        selected
          ? 'border-accent bg-accent/15 text-fg shadow-lg'
          : 'border-border bg-surface-1 text-fg hover:border-border-strong',
        recommended && !selected && 'shadow-[0_0_0_1px_var(--color-accent-soft)]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <Icon
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-fg-muted"
            strokeWidth={1.5}
          />
          <span className="truncate text-base font-semibold">{name}</span>
        </span>
        {recommended ? (
          <span
            className="shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg"
            style={{ backgroundColor: 'var(--color-accent-soft)' }}
          >
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

// ---------------------------------------------------------------------------
// Step 5: game mode (Phase 3)
//
// Four cards: Classic / Eternal / Dethrone / Era-paced. The player commits to
// one before pressing the final "Avvia partita" button. `'era-paced'` is only
// pickable when the active scenario provides an `eras[]` schedule; otherwise
// the card is rendered disabled.
//
// `'dethrone'` shows an extra info banner when the active scenario doesn't
// have blocs (Quick Start, Ascesa di Aurion). The mode is still selectable
// in that case — we just warn that only the GDP-rank trigger will apply.
// ---------------------------------------------------------------------------

function GameModeStep({
  stepLabel,
  scenarioId,
  selected,
  onSelect,
  onBack,
  onStart,
  isLoading,
}: {
  stepLabel: string;
  scenarioId: ScenarioId | null;
  selected: SelectableGameMode;
  onSelect: (mode: SelectableGameMode) => void;
  onBack: () => void;
  onStart: () => void;
  isLoading: boolean;
}) {
  const t = useTranslations('setup');
  const tMode = useTranslations('setup.gameMode');
  const tCommon = useTranslations('common');

  // The dethrone "isolation" trigger only matters when the scenario has blocs.
  // Surface a friendly note (not a hard block) so the player knows what
  // they're opting into.
  const showDethroneIsolationWarning =
    selected === 'dethrone' &&
    (!scenarioId || !DETHRONE_BLOC_SCENARIOS.has(scenarioId));

  // Era-paced ships only with scenarios that declare an `eras` schedule. The
  // card stays visible across all scenarios but is disabled (greyed-out) when
  // the active scenario doesn't support it — so the player understands what
  // the mode is and why it's not available.
  const eraPacedAvailable = scenarioId
    ? SCENARIOS_WITH_ERAS.has(scenarioId)
    : false;

  return (
    <section
      className="flex flex-col gap-4"
      data-testid="game-mode-picker"
    >
      <StepHeading
        stepLabel={stepLabel}
        title={tMode('title')}
        description={tMode('description')}
      />
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {GAME_MODES.map((mode) => {
          const disabled = mode === 'era-paced' && !eraPacedAvailable;
          return (
            <li key={mode}>
              <GameModeCard
                mode={mode}
                selected={selected === mode}
                disabled={disabled}
                disabledReason={
                  disabled ? tMode('eraPaced.unavailable') : undefined
                }
                onSelect={() => {
                  if (disabled) return;
                  onSelect(mode);
                }}
              />
            </li>
          );
        })}
      </ul>
      {showDethroneIsolationWarning ? (
        <p
          role="note"
          className={cn('rounded-md px-3 py-2 text-xs', toneChip('warning'))}
        >
          {tMode('dethrone.isolationUnavailable')}
        </p>
      ) : null}
      <div className="flex justify-between pt-2">
        <NavButton variant="secondary" onClick={onBack}>
          ← {tCommon('back')}
        </NavButton>
        {/* "Avvia partita" is the final CTA. Editorial direction asks for
            the amber accent palette (same as ActionButton's primary tone)
            — not the previous green-cyan `bg-success` fill which sat
            outside the editorial palette. */}
        <NavButton
          variant="primary"
          disabled={isLoading}
          onClick={onStart}
        >
          {isLoading ? t('preparing') : t('start')}
        </NavButton>
      </div>
    </section>
  );
}

/**
 * Tone token used by each game-mode card. Mirrors the spec's visual hint:
 *   - Classic   → neutral chrome (no special highlight)
 *   - Eternal   → accent (the recommended, default mode)
 *   - Era-paced → info (narrative, chapter-driven)
 *   - Dethrone  → warning (tense, "spada di Damocle" framing)
 */
const GAME_MODE_TONE: Readonly<
  Record<SelectableGameMode, 'neutral' | 'accent' | 'warning' | 'info'>
> = {
  classic: 'neutral',
  eternal: 'accent',
  'era-paced': 'info',
  dethrone: 'warning',
};

function GameModeCard({
  mode,
  selected,
  disabled,
  disabledReason,
  onSelect,
}: {
  mode: SelectableGameMode;
  selected: boolean;
  /** Greys-out the card and ignores clicks. Used for era-paced on scenarios
   * that don't ship an `eras[]` schedule. */
  disabled?: boolean;
  /** Tooltip + helper line shown beneath the description when `disabled`. */
  disabledReason?: string;
  onSelect: () => void;
}) {
  const tMode = useTranslations('setup.gameMode');
  const cardTone = GAME_MODE_TONE[mode];
  // Monochrome outline icon per mode (Flag / Infinity / BookOpen / Crown).
  // Replaces the emoji glyphs (🚩 ∞ 📖 👑) per editorial direction — no
  // colour, no emoji noise; the card's accent border still carries the
  // selection cue and the recommended pill the "default" cue.
  const Icon = GAME_MODE_ICONS[mode];
  const recommended = mode === RECOMMENDED_GAME_MODE;
  const name = tMode(`${mode}.name`);
  const description = tMode(`${mode}.description`);

  // Selected card uses a stronger border + soft tinted background so the
  // active choice is unambiguous; unselected cards reuse the standard surface
  // chrome with the tone hint surfaced via the icon swatch only.
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      data-testid={`game-mode-option-${mode}`}
      className={cn(
        'flex h-full w-full flex-col gap-2 rounded-md border px-4 py-4 text-left transition-colors',
        selected
          ? cn(
              'shadow-md',
              cardTone === 'accent'
                ? 'border-accent bg-accent/15 text-fg'
                : cardTone === 'warning'
                  ? 'border-warning/70 bg-warning/15 text-fg'
                  : cardTone === 'info'
                    ? 'border-info/70 bg-info/15 text-fg'
                    : 'border-border-strong bg-surface-2 text-fg',
            )
          : 'border-border bg-surface-1 text-fg hover:border-border-strong',
        recommended && !selected && 'shadow-[0_0_0_1px_var(--color-accent-soft)]',
        disabled && 'cursor-not-allowed opacity-50 hover:border-border',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <Icon
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-fg-muted"
            strokeWidth={1.5}
          />
          <span className="truncate text-base font-semibold">{name}</span>
        </span>
        {recommended ? (
          // Smaller pill (no border, sharper corner) sitting on the soft
          // accent token rather than the solid accent fill — keeps the
          // "CONSIGLIATA" cue present but quieter.
          <span
            className="shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-fg"
            style={{ backgroundColor: 'var(--color-accent-soft)' }}
          >
            {tMode('recommended')}
          </span>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-fg-muted">{description}</p>
      {disabled && disabledReason ? (
        <p className="text-[11px] italic text-fg-faint">{disabledReason}</p>
      ) : null}
    </button>
  );
}


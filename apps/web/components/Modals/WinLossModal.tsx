// Game-over screen. Shows different copy for victory vs defeat, summarizes
// the run (ticks played, peak popularity, peak treasury, techs unlocked, spy
// ops launched), surfaces the win/loss reason, and offers CTAs to start a new
// game or return home.

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import type { GameState, Scenario, WinLossState } from '@aurion/engine';

import { Link } from '../../i18n/navigation';
import { useCountUp } from '../../lib/animations';
import { cn } from '../../lib/cn';
import type { ScenarioId } from '../../lib/scenarios';
import {
  selectLossReason,
  selectPlayerCountry,
  useGameStore,
  type LossReason,
} from '../../lib/store';
import { useScenarioMessages } from '../Panels/shared/useScenarioMessages';

import { Modal } from './Modal';

export function WinLossModal() {
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const player = useGameStore(selectPlayerCountry);
  const lossReason = useGameStore(selectLossReason);
  const t = useTranslations('modals.winLoss');
  const tCommon = useTranslations('common');
  const format = useFormatter();

  if (!state || state.winLoss === 'playing' || !player) return null;

  // Eternal mode never *wins* — the engine should never set
  // `winLoss = 'won'` for it, but we defend against a stale reconciliation by
  // suppressing the modal in that case. Eternal-mode losses still surface
  // normally so the player gets a post-mortem.
  const gameMode = state.gameMode ?? 'classic';
  if (gameMode === 'eternal' && state.winLoss === 'won') return null;

  const winLoss: Exclude<WinLossState, 'playing'> = state.winLoss;
  const isWin = winLoss === 'won';

  return (
    <Modal
      title={
        <span className={cn(isWin ? 'text-success' : 'text-danger')}>
          {isWin ? t('wonTitle') : t('lostTitle')}
        </span>
      }
      // Win/Loss modal is informational but the player must decide what's
      // next — keep it non-dismissable so ESC can't drop them back into a
      // dead game state.
      dismissable={false}
      size="md"
      className={isWin ? 'border-success/60' : 'border-danger/60'}
      footer={
        <>
          <Link
            href="/"
            className="rounded-sm border border-border bg-transparent px-4 py-2 text-xs font-semibold text-fg transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            {t('backHome')}
          </Link>
          <Link
            href="/new"
            className="rounded-sm border border-accent bg-accent px-4 py-2 text-xs font-semibold text-bg transition hover:border-accent-strong hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            {t('newGame')}
          </Link>
        </>
      }
    >
      <Verdict isWin={isWin}>
        {isWin ? t('wonTitle') : t('lostTitle')}
      </Verdict>
      <Reason
        winLoss={winLoss}
        lossReason={lossReason}
        scenario={scenario}
        selectedVictoryCondition={state.selectedVictoryCondition}
      />
      <Summary
        state={state}
        format={format}
        tickLabel={t('ticksPlayed', { tick: state.tick })}
        labels={{
          summary: t('summary'),
          peakPopularity: t('peakPopularity'),
          peakTreasury: t('peakTreasury'),
          techsUnlocked: t('techsUnlocked'),
          spyOpsLaunched: t('spyOpsLaunched'),
        }}
        unknownLabel={tCommon('loading')}
      />
    </Modal>
  );
}

/**
 * Set-piece banner: the big verdict word over a soft semantic glow. Rises
 * with a short delay so the modal card lands first; reduced-motion users get
 * an instant cut via the global animation override.
 */
function Verdict({ isWin, children }: { isWin: boolean; children: ReactNode }) {
  return (
    <div className="relative -mx-2 mb-4 overflow-hidden rounded-md px-2 py-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: isWin
            ? 'radial-gradient(ellipse 70% 90% at 50% 0%, oklch(0.74 0.09 165 / 0.18), transparent 70%)'
            : 'radial-gradient(ellipse 70% 90% at 50% 0%, oklch(0.66 0.10 18 / 0.16), transparent 70%)',
        }}
      />
      <p
        className={cn(
          'relative text-4xl font-bold uppercase tracking-[0.18em]',
          isWin ? 'text-success' : 'text-danger',
        )}
        style={{
          animation:
            'verdict-rise 480ms cubic-bezier(0.2, 0.8, 0.2, 1) 120ms both',
        }}
      >
        {children}
      </p>
    </div>
  );
}

/**
 * Count-up driver for the end-of-run tally. `useCountUp` only tweens
 * *changes*, so we mount at 0 and flip to the target one frame later — the
 * classic score-reveal. Reduced-motion users snap (handled inside the hook).
 */
function useTally(target: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setValue(target));
    return () => cancelAnimationFrame(id);
  }, [target]);
  return useCountUp(value);
}

function Reason({
  winLoss,
  lossReason,
  scenario,
  selectedVictoryCondition,
}: {
  winLoss: Exclude<WinLossState, 'playing'>;
  lossReason: LossReason | null;
  scenario: Scenario | null;
  selectedVictoryCondition: GameState['selectedVictoryCondition'];
}) {
  const t = useTranslations('modals.winLoss');
  const tVictory = useTranslations('victory');
  const tVictoryScreen = useTranslations('victoryScreen');
  // Scenario-scoped victory condition nameKeys (e.g. `victory.qs.economic.name`,
  // `victory.gf.economic.name`) live ONLY in the scenario side-car bundle.
  // Generic ones (`victory.economic.name`) ship in the global UI bundle.
  // We consult the side-car first so QS / GF / MC scenarios resolve cleanly.
  const scenarioId = (scenario?.id ?? null) as ScenarioId | null;
  const { t: tScenario } = useScenarioMessages(scenarioId);

  if (winLoss === 'won') {
    // Look up the descriptive name of the chosen victory condition.
    const cond = scenario?.victoryConditions.find(
      (v) => v.id === selectedVictoryCondition,
    );
    const nameKey = cond?.nameKey;
    return (
      <p className="text-sm text-fg-muted">
        {t('wonReason', {
          condition: nameKey
            ? resolveVictoryName(tScenario, tVictory, nameKey)
            : selectedVictoryCondition,
        })}
      </p>
    );
  }

  // Defeat — surface why. Dethrone-mode triggers live in their own
  // `victoryScreen.*` namespace so the localisation team can iterate on the
  // post-mortem copy independently from the classic loss reasons.
  const reason: LossReason = lossReason ?? 'popularity';
  const message =
    reason === 'dethroned'
      ? tVictoryScreen('dethroned')
      : reason === 'isolated'
        ? tVictoryScreen('isolated')
        : t(`lossReason.${reason}`);
  return <p className="text-sm text-fg-muted">{message}</p>;
}

/**
 * Resolve a victory-condition nameKey through both the scenario side-car
 * and the global UI bundle. Scenario-scoped variants
 * (`victory.qs.economic.name`, `victory.gf.economic.name`, …) live ONLY in
 * the side-car file; the generic shape (`victory.economic.name`) ships in
 * `messages/{en,it}.json` under the `victory` namespace. We consult the
 * side-car first, then strip the leading `victory.` prefix and ask the
 * global namespaced translator, finally degrading to the raw key.
 */
function resolveVictoryName(
  tScenario: (key: string | undefined | null) => string,
  tVictory: ReturnType<typeof useTranslations<'victory'>>,
  fullKey: string,
): string {
  const scenarioValue = tScenario(fullKey);
  if (scenarioValue && scenarioValue !== fullKey) return scenarioValue;
  const prefix = 'victory.';
  if (!fullKey.startsWith(prefix)) return fullKey;
  const rel = fullKey.slice(prefix.length);
  try {
    return (tVictory as unknown as (k: string) => string)(rel);
  } catch {
    return fullKey;
  }
}

function Summary({
  state,
  format,
  tickLabel,
  labels,
  unknownLabel,
}: {
  state: GameState;
  format: ReturnType<typeof useFormatter>;
  tickLabel: string;
  labels: {
    summary: string;
    peakPopularity: string;
    peakTreasury: string;
    techsUnlocked: string;
    spyOpsLaunched: string;
  };
  unknownLabel: string;
}) {
  const player = state.countries[state.playerCountryId];
  const peakPopularity = Math.round(player?.politics.popularity ?? 0);
  const peakTreasury = Math.round(player?.economy.treasury ?? 0);
  const techsUnlocked = player?.science.completedTechs.length ?? 0;
  const spyOpsLaunched = state.spyOperations.filter(
    (op) => op.ownerCountryId === state.playerCountryId,
  ).length;

  // Score-reveal tallies — each stat counts up from zero when the modal
  // mounts, so the post-mortem reads as a result screen, not a spreadsheet.
  const tickTally = useTally(state.tick);
  const popularityTally = useTally(peakPopularity);
  const treasuryTally = useTally(peakTreasury);
  const techsTally = useTally(techsUnlocked);
  const spyOpsTally = useTally(spyOpsLaunched);

  return (
    <section className="mt-4 space-y-3 border-t border-border pt-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
        {labels.summary}
      </h3>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Stat
          label={tickLabel.split(':')[0] ?? 'Weeks'}
          value={String(tickTally)}
        />
        <Stat label={labels.peakPopularity} value={`${popularityTally}%`} />
        <Stat
          label={labels.peakTreasury}
          value={format.number(treasuryTally, {
            style: 'currency',
            currency: 'EUR',
            notation: 'compact',
            maximumFractionDigits: 1,
          })}
        />
        <Stat label={labels.techsUnlocked} value={String(techsTally)} />
        <Stat label={labels.spyOpsLaunched} value={String(spyOpsTally)} />
      </dl>
      {/* Sr-only fallback to keep typescript happy when no labels are present */}
      <span className="sr-only">{unknownLabel}</span>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
        {label}
      </dt>
      <dd className="numeric-tabular font-mono text-base text-fg">{value}</dd>
    </div>
  );
}

export default WinLossModal;

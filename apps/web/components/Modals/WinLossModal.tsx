// Game-over screen. Shows different copy for victory vs defeat, summarizes
// the run (ticks played, peak popularity, peak treasury, techs unlocked, spy
// ops launched), surfaces the win/loss reason, and offers CTAs to start a new
// game or return home.

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { GameState, Scenario, WinLossState } from '@aurion/engine';

import { Link } from '../../i18n/navigation';
import { cn } from '../../lib/cn';
import {
  selectLossReason,
  selectPlayerCountry,
  useGameStore,
  type LossReason,
} from '../../lib/store';

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

  const winLoss: Exclude<WinLossState, 'playing'> = state.winLoss;
  const isWin = winLoss === 'won';

  return (
    <Modal
      title={
        <span
          className={cn(
            'text-2xl font-bold',
            isWin ? 'text-emerald-300' : 'text-rose-300',
          )}
        >
          {isWin ? t('wonTitle') : t('lostTitle')}
        </span>
      }
      // Win/Loss modal is informational but the player must decide what's
      // next — keep it non-dismissable so ESC can't drop them back into a
      // dead game state.
      dismissable={false}
      size="md"
      footer={
        <>
          <Link
            href="/"
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600"
          >
            {t('backHome')}
          </Link>
          <Link
            href="/new"
            className="rounded-md bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400"
          >
            {t('newGame')}
          </Link>
        </>
      }
    >
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

  if (winLoss === 'won') {
    // Look up the descriptive name of the chosen victory condition.
    const cond = scenario?.victoryConditions.find(
      (v) => v.id === selectedVictoryCondition,
    );
    const nameKey = cond?.nameKey;
    return (
      <p className="text-sm text-slate-300">
        {t('wonReason', {
          condition: nameKey ? tVictoryFallback(tVictory, nameKey) : selectedVictoryCondition,
        })}
      </p>
    );
  }

  // Defeat — surface why.
  const reason = lossReason ?? 'popularity';
  return (
    <p className="text-sm text-slate-300">{t(`lossReason.${reason}`)}</p>
  );
}

/**
 * `useTranslations('victory')` exposes a *namespaced* lookup, but the
 * scenario's nameKey is already fully-qualified (e.g. `victory.economic.name`).
 * We strip the leading namespace so the call resolves correctly. Falls back to
 * the raw key if the format isn't recognized.
 */
function tVictoryFallback(
  tVictory: ReturnType<typeof useTranslations<'victory'>>,
  fullKey: string,
): string {
  const prefix = 'victory.';
  if (!fullKey.startsWith(prefix)) return fullKey;
  // next-intl typings are intentionally strict about key shape; cast through
  // string here because our scenario data drives the value at runtime.
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
  const peakPopularity = useMemo(
    () => Math.round(player?.politics.popularity ?? 0),
    [player],
  );
  const peakTreasury = player?.economy.treasury ?? 0;
  const techsUnlocked = player?.science.completedTechs.length ?? 0;
  const spyOpsLaunched = state.spyOperations.filter(
    (op) => op.ownerCountryId === state.playerCountryId,
  ).length;

  return (
    <section className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {labels.summary}
      </h3>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Stat label={tickLabel.split(':')[0] ?? 'Weeks'} value={String(state.tick)} />
        <Stat label={labels.peakPopularity} value={`${peakPopularity}%`} />
        <Stat
          label={labels.peakTreasury}
          value={format.number(Math.round(peakTreasury), {
            style: 'currency',
            currency: 'EUR',
            notation: 'compact',
            maximumFractionDigits: 1,
          })}
        />
        <Stat label={labels.techsUnlocked} value={String(techsUnlocked)} />
        <Stat label={labels.spyOpsLaunched} value={String(spyOpsLaunched)} />
      </dl>
      {/* Sr-only fallback to keep typescript happy when no labels are present */}
      <span className="sr-only">{unknownLabel}</span>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="font-mono text-sm text-slate-100">{value}</dd>
    </div>
  );
}

export default WinLossModal;

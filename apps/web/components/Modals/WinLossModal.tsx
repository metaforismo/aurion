'use client';

// End screen. A run deserves a proper ending: the verdict, why it happened,
// what the player built along the way, one concrete lesson after a defeat,
// and a clear next move (including carrying a won game on as an Odyssey).

import { Crown, Home, Infinity as InfinityIcon, RotateCcw, Skull } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { kardashevType, spaceRaceLeader, type GameState } from '@aurion/engine';

import { Link } from '../../i18n/navigation';
import { money } from '../../lib/format';
import type { ScenarioId } from '../../lib/scenarios';
import { selectLossReason, selectPlayerCountry, useGameStore } from '../../lib/store';
import { useScenarioMessages } from '../Panels/shared/useScenarioMessages';
import { Button, Stat } from '../ui';

function gdpRank(state: GameState): number {
  const sorted = Object.values(state.countries).sort((a, b) => b.economy.gdp - a.economy.gdp);
  return sorted.findIndex((c) => c.id === state.playerCountryId) + 1;
}

export function WinLossModal() {
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const player = useGameStore(selectPlayerCountry);
  const lossReason = useGameStore(selectLossReason);
  const continueAsOdyssey = useGameStore((s) => s.continueAsOdyssey);
  const t = useTranslations('modals.winLoss');
  const tEnd = useTranslations('endScreen');
  const tVictory = useTranslations();
  const tCosmos = useTranslations('cosmos.kardashev');
  const locale = useLocale();
  const { t: tScenario } = useScenarioMessages((scenario?.id as ScenarioId | undefined) ?? null);
  const primaryRef = useRef<HTMLAnchorElement | null>(null);

  const visible =
    !!state &&
    !!player &&
    state.winLoss !== 'playing' &&
    // An Odyssey never ends on a win; its milestones are toasts.
    !((state.gameMode ?? 'classic') === 'eternal' && state.winLoss === 'won');

  useEffect(() => {
    if (visible) primaryRef.current?.focus();
  }, [visible]);

  if (!visible || !state || !player) return null;

  const isWin = state.winLoss === 'won';
  const mode = state.gameMode ?? 'classic';

  let reason: string;
  if (isWin) {
    if (mode === 'space-race') reason = tEnd('won.raceReason');
    else if (mode === 'dethrone') reason = tEnd('won.throne');
    else if (mode === 'era-paced' && state.eraState) reason = tEnd('won.chronicles');
    else {
      const cond = scenario?.victoryConditions.find((v) => v.id === state.selectedVictoryCondition);
      const fromScenario = cond ? tScenario(cond.nameKey) : '';
      const name =
        cond && fromScenario !== cond.nameKey
          ? fromScenario
          : cond && tVictory.has(cond.nameKey)
            ? tVictory(cond.nameKey)
            : state.selectedVictoryCondition;
      reason = t('wonReason', { condition: name });
    }
  } else if (lossReason === 'outpaced') {
    const leader = state.cosmos ? spaceRaceLeader(state.cosmos) : null;
    const c = leader ? state.countries[leader.countryId] : undefined;
    reason = tEnd('lost.outpaced', { name: c ? tScenario(c.nameKey) : '—' });
  } else if (lossReason) {
    reason = t(`lossReason.${lossReason}`);
  } else {
    reason = tEnd('lost.unknown');
  }

  const cosmos = state.cosmos;
  const rating = cosmos?.kardashev ?? 0.7;
  const firsts = cosmos ? Object.values(cosmos.firsts).filter((c) => c === player.id).length : 0;
  const allies = Object.values(state.relations).filter(
    (r) => (r.countryA === player.id || r.countryB === player.id) && r.treaties.includes('alliance'),
  ).length;
  const years = Math.floor(state.tick / 52);

  const stats: { label: string; value: string; hint?: string }[] = [
    { label: tEnd('stats.duration'), value: tEnd('stats.durationValue', { years, weeks: state.tick % 52 }).trim() },
    { label: tEnd('stats.kardashev'), value: rating.toFixed(2), hint: tCosmos(`type.${kardashevType(rating)}`) },
    { label: tEnd('stats.projects'), value: String(cosmos?.completed.length ?? 0) },
    { label: tEnd('stats.firsts'), value: String(firsts) },
    { label: tEnd('stats.techs'), value: String(player.science.completedTechs.length) },
    {
      label: tEnd('stats.rank'),
      value: tEnd('stats.rankValue', { rank: gdpRank(state), total: Object.keys(state.countries).length }),
      hint: money(player.economy.gdp, locale),
    },
    { label: tEnd('stats.allies'), value: String(allies) },
    { label: tEnd('stats.popularity'), value: `${Math.round(player.politics.popularity)}%` },
  ];

  const tone = isWin ? '#E8B45A' : '#ff5d4d';
  const Icon = isWin ? Crown : Skull;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-screen-title"
      data-testid="end-screen"
      data-outcome={state.winLoss}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      style={{
        background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${tone}26 0%, transparent 60%), color-mix(in oklch, var(--color-bg) 84%, transparent)`,
        backdropFilter: 'blur(6px)',
        animation: 'modal-backdrop-enter 600ms cubic-bezier(0, 0, 0.2, 1) both',
      }}
    >
      <div
        className="glass-panel my-auto w-full max-w-2xl rounded-3xl p-6 sm:p-8"
        style={{ animation: 'rise-in 700ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms both' }}
      >
        <div className="flex flex-col items-center text-center">
          <span
            className="grid h-14 w-14 place-items-center rounded-full border"
            style={{ borderColor: `${tone}80`, backgroundColor: `${tone}1f`, color: tone }}
          >
            <Icon aria-hidden className="h-6 w-6" />
          </span>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: tone }}>
            {tEnd(isWin ? 'won.kicker' : 'lost.kicker')}
          </p>
          <h2 id="end-screen-title" className="mt-1 text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
            {t(isWin ? 'wonTitle' : 'lostTitle')}
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-fg-muted">{reason}</p>
          {!isWin && lossReason ? (
            <p className="mt-3 max-w-md rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[13px] leading-relaxed text-fg-muted">
              {tEnd(`tip.${lossReason}`)}
            </p>
          ) : null}
        </div>

        <h3 className="mt-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-faint">
          {tEnd('stats.title')}
        </h3>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
              <Stat label={s.label} value={s.value} hint={s.hint} />
            </div>
          ))}
        </dl>

        <div className="mt-7 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-fg-muted transition-colors hover:bg-white/[0.07] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Home aria-hidden className="h-4 w-4" />
            {tEnd('home')}
          </Link>
          {isWin ? (
            <Button icon={InfinityIcon} onClick={continueAsOdyssey} title={tEnd('continueHint')} data-testid="end-continue">
              {tEnd('continue')}
            </Button>
          ) : null}
          <Link
            ref={primaryRef}
            href="/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-black transition-colors hover:bg-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <RotateCcw aria-hidden className="h-4 w-4" />
            {tEnd('newGame')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default WinLossModal;

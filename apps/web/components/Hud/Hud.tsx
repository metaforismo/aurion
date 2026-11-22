'use client';

// Top bar of the play screen. Left to right it answers, in order: when is
// it, how much can I spend, do people still back me, how far has my
// civilisation climbed, what am I aiming for — then the clock controls.

import { Coins, Heart, Pause, Play } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { cn } from '../../lib/cn';
import { money, signed } from '../../lib/format';
import { selectIronMan, selectPlayerCountry, useGameStore, type Speed } from '../../lib/store';
import { useTicker } from '../../lib/ticker';
import { useSfx } from '../Audio';

import { AudioVolumeButton } from './AudioVolumeButton';
import { EraBadge } from './EraBadge';
import { GoalChip } from './GoalChip';
import { IronManBadge } from './IronManBadge';
import { KardashevBadge } from './KardashevBadge';
import { MenuButton } from './MenuButton';
import { ReputationBadges } from './ReputationBadges';
import { VictoryCounter } from './VictoryCounter';

export type HudProps = {
  onNotify?: (message: string) => void;
};

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

/** Calendar year a real-world scenario opens in; fictional worlds count from 1. */
const SCENARIO_BASE_YEAR: Readonly<Record<string, number>> = {
  'mondo-contemporaneo': 2025,
  'guerra-fredda': 1950,
};

const PLAY_SPEEDS: readonly Speed[] = [1, 2, 4];

export function Hud({ onNotify }: HudProps) {
  const ticker = useTicker();
  const ironMan = useGameStore(selectIronMan);
  const mode = useGameStore((s) => s.state?.gameMode ?? 'classic');
  const tApp = useTranslations('app');
  const t = useTranslations('hud');
  const sfx = useSfx();
  // Save / export confirmations when no parent notifier is wired.
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Spacebar: pause / resume, unless the player is typing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      if (ticker.speed === 0) {
        sfx('sfx.resume');
        ticker.resume();
      } else {
        sfx('sfx.pause');
        ticker.setSpeed(0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ticker, sfx]);

  return (
    <header className="glass-panel pointer-events-auto relative z-20 flex h-14 shrink-0 items-center gap-1 rounded-2xl px-2 text-sm md:gap-2 md:px-3">
      <div className="mr-1 hidden flex-col leading-none sm:flex md:mr-2">
        <span aria-label={tApp('name')} className="select-none text-[13px] font-semibold uppercase tracking-[0.22em] text-fg">
          {tApp('name')}
        </span>
        <span className="mt-1 hidden text-[10px] font-medium uppercase tracking-[0.14em] text-accent sm:block" data-testid="hud-mode">
          {t(`mode.${mode}`)}
        </span>
      </div>

      <Divider />
      <DateReadout />
      <div className="hidden lg:block">
        <EraBadge />
      </div>
      {ironMan ? <IronManBadge /> : null}
      <Divider />
      <TreasuryReadout />
      <PopularityReadout />
      <div className="hidden sm:contents">
        <KardashevBadge />
      </div>
      <div className="hidden xl:contents">
        <ReputationBadges />
      </div>
      <div className="hidden sm:contents">
        <VictoryCounter />
      </div>
      <GoalChip />

      <div className="ml-auto flex items-center gap-1 md:gap-2">
        {ticker.isAutoPaused ? (
          <span
            role="status"
            aria-live="polite"
            title={t('autoPausedHint')}
            className="hidden items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-warning sm:flex"
          >
            <span
              aria-label={t('autoPausedDotLabel')}
              className="inline-block h-1.5 w-1.5 rounded-full bg-warning motion-safe:animate-pulse"
            />
            {t('autoPaused')}
          </span>
        ) : null}
        <SpeedControl />
        <div className="hidden sm:block">
          <AudioVolumeButton />
        </div>
        <MenuButton onNotify={onNotify ?? setToast} />
      </div>
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="glass-panel pointer-events-none absolute right-0 top-full z-50 mt-2 rounded-xl px-3 py-2 text-xs text-fg"
        >
          {toast}
        </div>
      ) : null}
    </header>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 hidden h-7 w-px bg-white/10 md:block" />;
}

function DateReadout() {
  const tick = useGameStore((s) => s.state?.tick ?? 0);
  const scenarioId = useGameStore((s) => s.scenario?.id);
  const t = useTranslations('hud');
  const yearIndex = Math.floor(tick / 52);
  const week = (tick % 52) + 1;
  const month = MONTH_KEYS[Math.min(11, Math.floor(((week - 1) / 52) * 12))] ?? 'jan';
  const base = scenarioId ? SCENARIO_BASE_YEAR[scenarioId] : undefined;
  const yearLabel = base !== undefined ? String(base + yearIndex) : t('dateFictional', { year: yearIndex + 1 });

  return (
    <div className="flex flex-col gap-1 rounded-lg px-2 py-1 leading-none" title={t('dateTooltip', { week })}>
      <span className="sr-only">{t('dateLabel')}</span>
      <span className="whitespace-nowrap text-[13px] font-medium text-fg" aria-hidden>
        <span className="hidden sm:inline">{t(`monthsLong.${month}`)} · </span>
        <span className="numeric-tabular">{yearLabel}</span>
      </span>
      {/* The long form screen readers (and the e2e tick parser) rely on. */}
      <span className="sr-only">{t('dateValue', { week, year: yearIndex + 1 })}</span>
      <span aria-hidden className="block h-[3px] w-full min-w-12 overflow-hidden rounded-full bg-white/10">
        <span className="block h-full rounded-full bg-white/50" style={{ width: `${(week / 52) * 100}%` }} />
      </span>
    </div>
  );
}

function TreasuryReadout() {
  const player = useGameStore(selectPlayerCountry);
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  const t = useTranslations('hud');
  const locale = useLocale();
  if (!player) return null;
  const { treasury, weeklyIncome } = player.economy;
  const negative = treasury < 0;
  return (
    <button
      type="button"
      data-testid="hud-treasury"
      onClick={() => setSelectedPanel('economy')}
      title={t('treasuryTooltip')}
      className="flex items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Coins aria-hidden className={cn('h-4 w-4', negative ? 'text-[#ff8a7d]' : 'text-accent')} />
      <span className="flex flex-col gap-0.5 leading-none">
        <span className="sr-only">{t('treasury')}</span>
        <span className={cn('numeric-tabular whitespace-nowrap font-mono text-sm', negative ? 'text-[#ff8a7d]' : 'text-fg')}>
          {money(treasury, locale)}
        </span>
        <span
          className={cn(
            'numeric-tabular hidden whitespace-nowrap font-mono text-[10px] sm:block',
            weeklyIncome >= 0 ? 'text-success' : 'text-[#ff8a7d]',
          )}
        >
          {t('weekly', { value: signed(weeklyIncome, locale) })}
          <span className="sr-only"> {t('perWeek')}</span>
        </span>
      </span>
    </button>
  );
}

function PopularityReadout() {
  const popularity = useGameStore((s) => selectPlayerCountry(s)?.politics.popularity);
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  const t = useTranslations('hud');
  if (popularity === undefined) return null;
  const pct = Math.round(popularity);
  const tone = pct < 25 ? '#ff5d4d' : pct < 40 ? '#ffab40' : '#5fe0a0';
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <button
      type="button"
      data-testid="hud-popularity"
      onClick={() => setSelectedPanel('politics')}
      title={t('popularityTooltip')}
      className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span className="relative grid h-6 w-6 place-items-center">
        <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="12" cy="12" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" />
          <circle
            cx="12"
            cy="12"
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <Heart aria-hidden className="h-2.5 w-2.5" style={{ color: tone }} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="sr-only">{t('popularity')}</span>
        <span className="numeric-tabular font-mono text-sm text-fg">{pct}%</span>
      </span>
    </button>
  );
}

function SpeedControl() {
  const ticker = useTicker();
  const t = useTranslations('hud.speed');
  const sfx = useSfx();
  const paused = ticker.speed === 0;

  const select = (s: Speed) => {
    if (s === ticker.speed) return;
    sfx(s === 0 ? 'sfx.pause' : paused ? 'sfx.resume' : 'sfx.tab');
    ticker.setSpeed(s);
  };

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-black/30 p-0.5"
    >
      {/* Narrates speed changes; aria-pressed alone is not re-read reliably. */}
      <span aria-live="polite" className="sr-only">
        {paused ? t('paused') : t(`x${ticker.speed}` as 'x1' | 'x2' | 'x4')}
      </span>
      <button
        type="button"
        onClick={() => select(0)}
        aria-pressed={paused}
        aria-label={t('paused')}
        title={t('pauseHint')}
        className={cn(
          'grid h-8 w-8 place-items-center rounded-[10px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
          paused ? 'bg-warning/20 text-warning' : 'text-fg-muted hover:bg-white/10 hover:text-fg',
        )}
      >
        {paused ? <Pause aria-hidden className="h-3.5 w-3.5" /> : <Play aria-hidden className="h-3.5 w-3.5" />}
      </button>
      {/* Phones: one button that cycles 1× → 2× → 4×. */}
      <button
        type="button"
        onClick={() => select(ticker.speed === 1 ? 2 : ticker.speed === 2 ? 4 : 1)}
        aria-label={t('cycle', { n: paused ? 1 : ticker.speed })}
        className={cn(
          'numeric-tabular h-8 rounded-[10px] px-2.5 font-mono text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:hidden',
          paused ? 'text-fg-muted' : 'bg-accent text-black',
        )}
      >
        {paused ? 1 : ticker.speed}×
      </button>
      <span className="hidden items-center gap-0.5 sm:flex">
        {PLAY_SPEEDS.map((s) => {
          const active = ticker.speed === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => select(s)}
              aria-pressed={active}
              aria-label={t(`x${s}` as 'x1' | 'x2' | 'x4')}
              title={t('speedHint', { n: s })}
              className={cn(
                'numeric-tabular h-8 rounded-[10px] px-2 font-mono text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                active ? 'bg-accent text-black' : 'text-fg-muted hover:bg-white/10 hover:text-fg',
              )}
            >
              {s}×
            </button>
          );
        })}
      </span>
    </div>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export default Hud;

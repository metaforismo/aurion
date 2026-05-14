// Game screen skeleton. Loads the save into the store, mounts the rAF
// ticker, and renders placeholder regions for the Map / Panels / Notifications
// that will be implemented in Wave 2.
//
// What IS implemented here:
//   - HUD with date / treasury / popularity / speed buttons (functional)
//   - tick counter (proves the rAF loop is alive)
//   - Save / Export / Import buttons wired to lib/persistence
//   - Win/loss banner that shows when state.winLoss !== 'playing'

'use client';

import { useTranslations } from 'next-intl';
import { use, useEffect, useState } from 'react';
import type { SaveId } from '@aurion/engine';

import { Link, useRouter } from '../../../../i18n/navigation';
import { cn } from '../../../../lib/cn';
import {
  exportSave,
  importSave,
  isPersistenceAvailable,
} from '../../../../lib/persistence';
import {
  selectPlayerCountry,
  useGameStore,
  type Speed,
} from '../../../../lib/store';
import { useTicker } from '../../../../lib/ticker';

const SPEEDS: readonly Speed[] = [0, 1, 2, 4];

export default function PlayPage({
  params,
}: {
  params: Promise<{ saveId: string; locale: string }>;
}) {
  const { saveId } = use(params);

  const t = useTranslations('play');
  const tHud = useTranslations('hud');
  const tCommon = useTranslations('common');
  const tPanels = useTranslations('panels');
  const tVictoryScreen = useTranslations('victoryScreen');

  const router = useRouter();

  const state = useGameStore((s) => s.state);
  const storeSaveId = useGameStore((s) => s.saveId);
  const ticksThisSession = useGameStore((s) => s.ticksThisSession);
  const isLoading = useGameStore((s) => s.isLoading);
  const player = useGameStore(selectPlayerCountry);
  const lastErrors = useGameStore((s) => s.lastErrors);
  const loadGame = useGameStore((s) => s.loadGame);
  const saveGame = useGameStore((s) => s.saveGame);

  // Hydrate the store from IndexedDB if the user landed here directly (e.g.
  // refreshed the page).
  useEffect(() => {
    if (storeSaveId === saveId && state) return;
    void loadGame(saveId as SaveId).catch(() => {
      // Surface via lastErrors below; nothing else to do here.
    });
  }, [saveId, storeSaveId, state, loadGame]);

  const ticker = useTicker();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((current) => (current === msg ? null : current)), 2500);
  };

  const handleSave = async () => {
    try {
      await saveGame();
      showToast(t('saveOk'));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'error');
    }
  };

  const handleExport = async () => {
    if (!storeSaveId) return;
    try {
      const blob = await exportSave(storeSaveId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${storeSaveId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(t('exportOk'));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'error');
    }
  };

  const handleImport = async (file: File) => {
    try {
      const entry = await importSave(file);
      showToast(t('importOk'));
      router.replace(`/play/${encodeURIComponent(entry.id)}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'error');
    }
  };

  if (isLoading || !state) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-400">
        {t('loadingState')}
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* HUD ----------------------------------------------------------- */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-800 bg-slate-900/60 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-500">
            {tHud('date', { tick: state.tick })}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-500">
            {tHud('treasury')}
          </span>
          <span className="font-mono text-sm text-emerald-300">
            {player ? formatBig(player.economy.treasury) : '—'}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-500">
            {tHud('popularity')}
          </span>
          <span className="font-mono text-sm text-amber-300">
            {player ? `${Math.round(player.politics.popularity)}%` : '—'}
          </span>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label={tHud('speed.label')}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ticker.setSpeed(s)}
              aria-pressed={ticker.speed === s}
              className={cn(
                'rounded-md border px-2 py-1 text-xs font-mono',
                ticker.speed === s
                  ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600',
              )}
            >
              {s === 0 ? '⏸' : `${s}×`}
            </button>
          ))}
        </div>

        {ticker.isAutoPaused ? (
          <span className="text-xs text-amber-400">{tHud('autoPaused')}</span>
        ) : null}

        <span className="text-xs text-slate-500">
          {t('ticksThisSession', { n: ticksThisSession })}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs hover:border-slate-600"
            disabled={!isPersistenceAvailable()}
          >
            {tHud('save')}
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs hover:border-slate-600"
            disabled={!storeSaveId}
          >
            {tHud('export')}
          </button>
          <label className="cursor-pointer rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs hover:border-slate-600">
            {tHud('import')}
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
                e.target.value = '';
              }}
            />
          </label>
          <Link
            href="/"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs hover:border-slate-600"
          >
            {tHud('exit')}
          </Link>
        </div>
      </header>

      {/* Body ---------------------------------------------------------- */}
      <div className="grid flex-1 grid-cols-1 gap-2 p-2 lg:grid-cols-[16rem_1fr_18rem]">
        <Placeholder
          label={t('placeholderPanels')}
          subtitle={[
            tPanels('economy'),
            tPanels('research'),
            tPanels('military'),
            tPanels('spies'),
            tPanels('diplomacy'),
            tPanels('politics'),
          ].join(' • ')}
          tone="left"
        />
        <Placeholder label={t('placeholderMap')} tone="center" />
        <Placeholder label={t('placeholderNotifications')} tone="right" />
      </div>

      {state.winLoss !== 'playing' ? (
        <WinLossOverlay
          state={state.winLoss}
          tickCount={state.tick}
          wonLabel={tVictoryScreen('wonTitle')}
          lostLabel={tVictoryScreen('lostTitle')}
          summaryLabel={tVictoryScreen('summary')}
          ticksLabel={tVictoryScreen('ticksPlayed', { tick: state.tick })}
          backLabel={tVictoryScreen('backHome')}
        />
      ) : null}

      {lastErrors.length > 0 ? (
        <ul
          className="pointer-events-none fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 flex-col gap-1"
          role="alert"
        >
          {lastErrors.map((err, idx) => (
            <li
              key={`${err}-${idx}`}
              className="rounded-md border border-rose-700 bg-rose-950/90 px-3 py-2 text-xs text-rose-200"
            >
              {err}
            </li>
          ))}
        </ul>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-md border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 shadow-lg">
          {toast}
        </div>
      ) : null}

      {/* Sr-only fallback so screen readers can announce common state */}
      <span className="sr-only">{tCommon('loading')}</span>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBig(n: number): string {
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(0);
}

function Placeholder({
  label,
  subtitle,
  tone,
}: {
  label: string;
  subtitle?: string;
  tone: 'left' | 'center' | 'right';
}) {
  const toneClass =
    tone === 'center'
      ? 'min-h-[60vh] border-dashed'
      : 'min-h-[20vh] border-dashed';
  return (
    <section
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-center',
        toneClass,
      )}
    >
      <span className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {subtitle ? (
        <span className="text-[11px] text-slate-600">{subtitle}</span>
      ) : null}
    </section>
  );
}

function WinLossOverlay({
  state,
  tickCount,
  wonLabel,
  lostLabel,
  summaryLabel,
  ticksLabel,
  backLabel,
}: {
  state: 'won' | 'lost';
  tickCount: number;
  wonLabel: string;
  lostLabel: string;
  summaryLabel: string;
  ticksLabel: string;
  backLabel: string;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="flex max-w-md flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <h2
          className={cn(
            'text-3xl font-bold',
            state === 'won' ? 'text-emerald-300' : 'text-rose-300',
          )}
        >
          {state === 'won' ? wonLabel : lostLabel}
        </h2>
        <p className="text-sm text-slate-400">{summaryLabel}</p>
        <p className="font-mono text-sm text-slate-200">{ticksLabel}</p>
        <Link
          href="/"
          className="mt-2 inline-flex justify-center rounded-xl bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          {backLabel}
        </Link>
        {/* unused-variable guard so the compiler keeps tickCount in scope */}
        <span className="hidden" data-tick={tickCount} />
      </div>
    </div>
  );
}

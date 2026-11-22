'use client';

// The title screen: the planet turning, the save you were playing (or, for
// a first visit, the one obvious way in) and the main menu.

import { BUILTIN_ACHIEVEMENTS } from '@aurion/engine';
import { BookOpen, Compass, FolderOpen, Settings, Trophy, Zap } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { useSfx } from '../../Audio';
import { Button, Glass } from '../../ui';
import { useRouter } from '../../../i18n/navigation';
import { getUnlockedAchievements, importSave } from '../../../lib/persistence';
import { isAppLocale } from '../../../i18n/routing';
import { loadScenario, loadScenarioMessages } from '../../../lib/scenarios';
import { useGameStore } from '../../../lib/store';
// Build-time constant: the bundler inlines the JSON, we only read `.version`.
import pkg from '../../../package.json';
import { useSaveList } from '../saves';
import { ContinueCard } from './ContinueCard';
import { MainMenu, moveMenuFocus, type MenuItem } from './MainMenu';
import { SaveBrowser } from './SaveBrowser';

// CI can stamp a public version; otherwise package.json is the source.
const APP_VERSION = process.env.NEXT_PUBLIC_VERSION || (pkg as { version: string }).version;
const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || '';

/** Megaproject stages, shown as the road ahead (names live in `cosmos`). */
const LADDER_STAGES = [0, 1, 2, 3, 4, 5, 6] as const;

export function TitleScreen() {
  const t = useTranslations('home');
  const tApp = useTranslations('app');
  const tMenu = useTranslations('menu');
  const tErrors = useTranslations('errors');
  const tCosmos = useTranslations('cosmos');
  const tModes = useTranslations('modes');
  const locale = useLocale();
  const router = useRouter();
  const sfx = useSfx();
  const startNewGame = useGameStore((s) => s.startNewGame);

  const { saves, refresh } = useSaveList();
  const [trophies, setTrophies] = useState<number | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [quickStarting, setQuickStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const columnRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUnlockedAchievements()
      .then((rows) => !cancelled && setTrophies(rows.length))
      .catch(() => !cancelled && setTrophies(0));
    return () => {
      cancelled = true;
    };
  }, []);

  // Arrow keys work from anywhere on the page, not only once a row has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (browserOpen || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && target !== document.body && !columnRef.current?.contains(target)) return;
      if (columnRef.current && moveMenuFocus(columnRef.current, e.key)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [browserOpen]);

  // One click into a small world with the recommended defaults: first
  // playable nation, normal difficulty, the open-ended mode.
  const handleQuickPlay = async () => {
    if (quickStarting) return;
    setQuickStarting(true);
    setError(null);
    sfx('sfx.confirm');
    try {
      const scenario = await loadScenario('quick-start');
      const countryId = scenario.playableCountries[0];
      const difficulty =
        scenario.difficulties.find((d) => d.id === 'normal') ?? scenario.difficulties[0];
      if (!countryId || !difficulty) throw new Error(tErrors('newGameFailed'));
      const country = scenario.countries.find((c) => c.id === countryId);
      const names = await loadScenarioMessages('quick-start', isAppLocale(locale) ? locale : 'it');
      const saveId = await startNewGame({
        scenarioId: 'quick-start',
        playerCountryId: countryId,
        victory: 'economic',
        difficultyId: difficulty.id,
        gameMode: 'eternal',
        // A name a person would give it, instead of an id and a timestamp.
        name: country
          ? tMenu('saveName', {
              nation: names[country.nameKey] ?? countryId,
              mode: tModes('odyssey.name'),
            })
          : undefined,
      });
      router.push(`/play/${encodeURIComponent(saveId)}`);
    } catch (err) {
      sfx('sfx.error');
      setError(err instanceof Error ? err.message : tErrors('newGameFailed'));
      setQuickStarting(false);
    }
  };

  const handleImport = async (file: File) => {
    setError(null);
    try {
      const entry = await importSave(file);
      await refresh();
      sfx('sfx.confirm');
      router.push(`/play/${encodeURIComponent(entry.id)}`);
    } catch (err) {
      sfx('sfx.error');
      setError(err instanceof Error ? err.message : tErrors('importFailed'));
    }
  };

  const latest = saves?.[0] ?? null;
  const firstVisit = saves !== null && saves.length === 0;

  const items: MenuItem[] = [
    { id: 'new', icon: Compass, label: t('newGame'), hint: t('newGameHint'), href: '/new' },
    // On a first visit Quick play is the hero card above, not a row.
    ...(firstVisit
      ? []
      : [
          {
            id: 'quick',
            icon: Zap,
            label: t('quickPlay'),
            hint: t('quickPlayHint'),
            busy: quickStarting,
            onSelect: () => void handleQuickPlay(),
          } satisfies MenuItem,
        ]),
    {
      id: 'load',
      icon: FolderOpen,
      label: t('loadGame'),
      hint: t('loadGameHint'),
      aside: saves && saves.length > 0 ? saves.length : undefined,
      onSelect: () => {
        sfx('sfx.panel-open');
        setBrowserOpen(true);
      },
    },
    {
      id: 'trophies',
      icon: Trophy,
      label: t('trophies'),
      hint: t('trophiesHint'),
      aside: trophies === null ? undefined : `${trophies}/${BUILTIN_ACHIEVEMENTS.length}`,
      href: '/trofei',
    },
    { id: 'guide', icon: BookOpen, label: t('guide'), hint: t('guideHint'), href: '/guida' },
    {
      id: 'settings',
      icon: Settings,
      label: t('settings'),
      hint: t('settingsHint'),
      href: '/settings',
    },
  ];

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-end px-4 pb-6 pt-[26dvh] sm:px-8 lg:justify-center lg:py-4">
        <div ref={columnRef} className="flex w-full max-w-[460px] flex-col gap-4">
          <div style={{ animation: 'rise-in 520ms cubic-bezier(0, 0, 0.2, 1) both' }}>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
              {tApp('tagline')}
            </p>
            <h1 className="mt-2 text-6xl font-bold leading-none tracking-tight text-fg sm:text-[clamp(3.5rem,8.5vh,4.5rem)]">
              {t('title')}
            </h1>
            <p className="mt-2.5 max-w-sm text-pretty text-[15px] leading-relaxed text-fg-muted">
              {t('subtitle')}
            </p>
          </div>

          {latest ? <ContinueCard save={latest} /> : null}

          {firstVisit ? (
            <Glass
              className="p-4 sm:p-5"
              style={{ animation: 'rise-in 420ms 60ms cubic-bezier(0, 0, 0.2, 1) both' }}
            >
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                {t('firstVisit.eyebrow')}
              </h2>
              <p
                id="quick-play-pitch"
                className="mt-2 text-pretty text-sm leading-relaxed text-fg-muted"
              >
                {t('firstVisit.body')}
              </p>
              <Button
                variant="primary"
                size="lg"
                block
                icon={Zap}
                loading={quickStarting}
                data-menu-item
                data-testid="menu-quick"
                aria-label={t('quickPlay')}
                aria-describedby="quick-play-pitch"
                className="mt-4"
                onClick={() => void handleQuickPlay()}
              >
                {t('quickPlay')}
              </Button>
            </Glass>
          ) : null}

          <MainMenu items={items} label={tMenu('mainMenu')} />

          <p className="font-mono text-[11px] text-fg-faint">
            <span className="numeric-tabular">v{APP_VERSION}</span>
            {GITHUB_URL ? (
              <>
                <span aria-hidden> · </span>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded transition-colors hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  GitHub
                </a>
              </>
            ) : null}
            <span className="hidden lg:inline">
              <span aria-hidden> · </span>
              {t('keysHint')}
            </span>
          </p>

          <div aria-live="polite">
            {error && !browserOpen ? (
              <p
                role="alert"
                className="rounded-lg border border-[#ff5d4d]/35 bg-[#ff5d4d]/[0.08] px-3 py-2 text-sm text-[#ffb0a6]"
              >
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </main>

      {/* The road ahead, as a quiet caption under the planet. */}
      <div
        role="group"
        aria-label={t('ladderLabel')}
        className="pointer-events-none absolute bottom-6 right-8 hidden lg:block"
      >
        <p className="mb-1.5 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
          {t('ladderLabel')}
        </p>
        <ol className="flex items-center">
          {LADDER_STAGES.map((stage) => (
            <li key={stage} className="flex items-center">
              {stage > 0 ? <span aria-hidden className="mx-2 h-px w-5 bg-white/20" /> : null}
              <span
                aria-hidden
                className={
                  stage === 0
                    ? 'mr-1.5 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]'
                    : 'mr-1.5 h-1.5 w-1.5 rounded-full border border-white/40'
                }
              />
              <span
                className={
                  stage === 0 ? 'text-[11px] font-medium text-fg' : 'text-[11px] text-fg-muted'
                }
              >
                {tCosmos(`stages.${stage}.name`)}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Always in the DOM so "import" works from the menu and the browser. */}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        aria-label={t('saves.import')}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImport(file);
          e.target.value = '';
        }}
      />

      {browserOpen && saves ? (
        <SaveBrowser
          saves={saves}
          importError={error}
          onChanged={refresh}
          onImport={() => fileRef.current?.click()}
          onClose={() => {
            sfx('sfx.panel-close');
            setBrowserOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

// Home screen. Shows a centered hero with a single primary CTA, a quiet list
// of existing saves (only when there are any), and a thin footer with the
// build version, language switch, and an optional GitHub link.
//
// Save list is read from IndexedDB so this page must be a client component.

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Globe } from 'lucide-react';

import { AchievementCounter } from '../../components/Hud/AchievementCounter';
import { Link, usePathname, useRouter } from '../../i18n/navigation';
import { routing, type AppLocale } from '../../i18n/routing';
import { cn } from '../../lib/cn';
import {
  importSave,
  isPersistenceAvailable,
  listSaves,
  type SaveSummary,
} from '../../lib/persistence';
import { getScenarioMeta } from '../../lib/scenarios';
import { MOTION } from '../../lib/theme';
// Build-time constant. Webpack inlines the JSON; we only consume `.version`.
import pkg from '../../package.json';

const APP_VERSION =
  // Public env wins if set (CI can stamp this), otherwise fall back to
  // package.json — both are evaluated at build time.
  process.env.NEXT_PUBLIC_VERSION || (pkg as { version: string }).version;

// Optional repo link, surfaced in the footer when configured.
const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || '';

export default function HomePage() {
  const t = useTranslations('home');
  const tApp = useTranslations('app');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tTrofei = useTranslations('trofei');

  const [saves, setSaves] = useState<SaveSummary[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPersistenceAvailable()) {
      // SSR/test environment: declare "no saves" up front rather than
      // leaving the placeholder dangling. The cascading-render warning here
      // is a false positive — this is a one-shot effect with no inputs.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaves([]);
      return;
    }
    let cancelled = false;
    listSaves()
      .then((rows) => {
        if (!cancelled) setSaves(rows);
      })
      .catch(() => {
        if (!cancelled) setSaves([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleImport = async (file: File) => {
    setImportError(null);
    try {
      const entry = await importSave(file);
      const rows = await listSaves();
      setSaves(rows);
      // Optimistically navigate into the imported game (handled by play page).
      window.location.assign(`./play/${entry.id}`);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : tErrors('importFailed'),
      );
    }
  };

  const hasSaves = saves !== null && saves.length > 0;

  return (
    <main
      className={cn(
        'relative flex min-h-screen w-full flex-col bg-bg',
        // Subtle vertical wash so the hero "lifts" off the page without
        // fighting content underneath.
        'bg-gradient-to-b from-bg via-bg to-surface-1/40',
      )}
    >
      {/* Top bar: wordmark on the left, language + achievements on the right.
          The wordmark intentionally uses a smaller, monospaced treatment so
          it reads as a quiet logotype, not a second H1 competing with the
          hero. */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 pt-6">
        <span
          aria-hidden
          className={cn(
            'font-mono text-xs font-semibold uppercase tracking-[0.32em] text-fg-muted',
          )}
        >
          {tApp('name')}
        </span>
        <div className="flex items-center gap-3">
          <AchievementCounter />
          <LanguageSwitcherMenu />
        </div>
      </div>

      {/* Subtle geo-hint backdrop. Sits behind the hero column and is purely
          decorative — opacity is low enough not to interfere with text.
          Pointer-events disabled so it never intercepts clicks. */}
      <GeoBackdrop />

      {/* Hero + saves block, centered and capped at ~720px per the redesign
          brief. `flex-1` pushes the footer to the viewport bottom. */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-16 sm:py-24">
        <div className="flex w-full max-w-[720px] flex-col items-center gap-12 text-center">
          <section className="flex flex-col items-center gap-5">
            <h1
              className={cn(
                'font-sans text-balance text-6xl font-bold tracking-tight text-fg',
                'sm:text-7xl',
              )}
            >
              {t('title')}
            </h1>
            <p className="max-w-xl text-balance text-lg text-fg-muted sm:text-xl">
              {t('subtitle')}
            </p>

            <Link
              href="/new"
              className={cn(
                'mt-4 inline-flex items-center justify-center rounded-xl bg-accent px-7 py-3.5',
                'text-base font-semibold text-bg shadow-md transition-colors',
                'hover:bg-accent-strong focus-visible:outline focus-visible:outline-2',
                'focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            >
              {t('newGame')}
            </Link>

            {/* Secondary actions sit below the primary CTA as quiet text
                links separated by a thin middle dot. The import "link" is
                actually a file input wrapped in a <label> for keyboard / a11y
                parity. */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-fg-muted">
              <ImportLink onPick={handleImport} label={t('import')} />
              <span aria-hidden className="text-fg-faint">
                ·
              </span>
              <Link
                href="/trofei"
                className="transition-colors hover:text-fg"
                style={{ transitionDuration: MOTION.fast }}
              >
                {tTrofei('linkLabel')}
              </Link>
            </div>

            {importError ? (
              <p
                className="text-sm text-danger"
                role="alert"
              >
                {importError}
              </p>
            ) : null}
          </section>

          {/* Saved games — only renders when there is at least one save.
              Empty state is intentionally NOTHING (no card, no copy) so
              first-time players see a calm, unbroken hero. */}
          {hasSaves ? (
            <section className="flex w-full flex-col gap-3 text-left">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">
                  {t('continue')}
                </h2>
                <span
                  className={cn(
                    'font-mono text-[11px] tabular-nums text-fg-faint',
                  )}
                  aria-label={String(saves!.length)}
                >
                  {saves!.length}
                </span>
              </div>
              <ul className="flex flex-col divide-y divide-border border-y border-border">
                {saves!.map((save) => (
                  <li key={save.id}>
                    <SaveRow save={save} />
                  </li>
                ))}
              </ul>
            </section>
          ) : saves === null ? (
            // Loading — render a single muted line, not a card.
            <p className="text-sm text-fg-faint">{tCommon('loading')}</p>
          ) : null}
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Top-right language switcher
// ---------------------------------------------------------------------------

/**
 * Compact globe-icon button that toggles between the available locales when
 * there are exactly two, or opens a small native <select> dropdown otherwise.
 * Keeps the top bar quiet vs. the previous always-visible pill, which was
 * fighting the hero for attention.
 */
function LanguageSwitcherMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();
  const t = useTranslations('home');

  // Two-locale case is the live config today — render an icon button that
  // simply toggles between them. The dropdown is only useful at 3+.
  if (routing.locales.length === 2) {
    const other = routing.locales.find((l) => l !== currentLocale) as
      | AppLocale
      | undefined;
    return (
      <button
        type="button"
        aria-label={t('languageSwitch')}
        title={`${t('languageSwitch')} (${other?.toUpperCase() ?? ''})`}
        onClick={() => {
          if (!other) return;
          router.replace(pathname, { locale: other });
        }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/40 px-2.5 py-1',
          'font-mono text-[11px] font-medium uppercase tracking-wider text-fg-muted',
          'transition-colors hover:border-border-strong hover:text-fg',
        )}
        style={{ transitionDuration: MOTION.fast }}
      >
        <Globe aria-hidden className="h-3.5 w-3.5" />
        <span>{currentLocale}</span>
      </button>
    );
  }

  // Generic fallback for >2 locales.
  return (
    <label
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/40 px-2.5 py-1',
        'font-mono text-[11px] font-medium uppercase tracking-wider text-fg-muted',
      )}
    >
      <Globe aria-hidden className="h-3.5 w-3.5" />
      <span className="sr-only">{t('languageSwitch')}</span>
      <select
        aria-label={t('languageSwitch')}
        value={currentLocale}
        onChange={(e) => {
          router.replace(pathname, { locale: e.target.value as AppLocale });
        }}
        className="bg-transparent text-inherit outline-none"
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {loc.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Footer-scoped locale switch — same data source, different presentation
 * (inline `IT | EN` buttons rather than a chip). Quieter visual weight so
 * the footer stays a single thin line.
 */
function FooterLocaleSwitch() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();
  const t = useTranslations('home');

  return (
    <span
      role="group"
      aria-label={t('languageSwitch')}
      className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider"
    >
      {routing.locales.map((loc, i) => {
        const isActive = loc === currentLocale;
        return (
          <span key={loc} className="inline-flex items-center">
            {i > 0 ? (
              <span aria-hidden className="px-1 text-fg-faint">
                |
              </span>
            ) : null}
            <button
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                if (isActive) return;
                router.replace(pathname, { locale: loc as AppLocale });
              }}
              className={cn(
                'rounded-sm px-0.5 transition-colors',
                isActive
                  ? 'text-fg'
                  : 'text-fg-faint hover:text-fg',
              )}
              style={{ transitionDuration: MOTION.fast }}
            >
              {loc}
            </button>
          </span>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function SiteFooter() {
  return (
    <footer
      className={cn(
        'mt-auto w-full border-t border-border/60',
        'px-6 py-4',
      )}
    >
      <div
        className={cn(
          'mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-2',
          'font-mono text-xs text-fg-faint',
        )}
      >
        <span className="tabular-nums">v{APP_VERSION}</span>
        <span aria-hidden>·</span>
        <FooterLocaleSwitch />
        {GITHUB_URL ? (
          <>
            <span aria-hidden>·</span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="transition-colors hover:text-fg"
              style={{ transitionDuration: MOTION.fast }}
            >
              GitHub
            </a>
          </>
        ) : null}
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Decorative backdrop
// ---------------------------------------------------------------------------

/**
 * A very low-opacity hint that this is a geopolitics game: stylised continent
 * silhouettes anchored to the right of the hero. Deliberately abstract —
 * not a real world map — so it never reads as "wrong" projection or
 * outdated borders. Sits below content (`z-0`) and ignores pointer events.
 */
function GeoBackdrop() {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 z-0 overflow-hidden',
        'opacity-[0.06]',
      )}
    >
      <svg
        viewBox="0 0 1200 600"
        fill="currentColor"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-y-0 right-0 h-full w-full text-fg"
      >
        {/* Abstract landmass shapes. Hand-tuned ellipses + paths that
            evoke continents without committing to any specific borders. */}
        <path d="M120 180 Q 200 140 290 175 Q 360 200 340 270 Q 310 330 230 320 Q 150 305 110 250 Z" />
        <path d="M380 120 Q 470 90 560 130 Q 620 165 600 220 Q 570 270 490 265 Q 410 250 380 200 Z" />
        <path d="M640 200 Q 740 170 830 210 Q 910 245 880 320 Q 830 380 720 365 Q 630 340 610 270 Z" />
        <path d="M260 380 Q 340 360 400 400 Q 440 440 390 470 Q 320 485 270 450 Z" />
        <path d="M730 410 Q 810 395 870 430 Q 905 465 855 495 Q 790 510 745 480 Z" />
        <circle cx="990" cy="170" r="40" />
        <circle cx="1070" cy="280" r="55" />
        <circle cx="180" cy="470" r="28" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save list row
// ---------------------------------------------------------------------------

/**
 * A single row in the "Continue" list. Resolves the save's scenario id to a
 * localised name through the registry; the difficulty preset is intentionally
 * not displayed here because `SaveSummary` omits the heavy `state` field that
 * carries `state.difficultyId` (the cheapest path that avoids a per-save load
 * is to widen the summary type, which is out of scope for the wizard refactor).
 *
 * Presentation changed in the redesign from card-chrome to a divider list:
 * the parent wraps these rows with `divide-y` so each row only needs flat
 * padding + hover state.
 */
function SaveRow({ save }: { save: SaveSummary }) {
  const t = useTranslations('home');
  const tAll = useTranslations();
  const locale = useLocale();
  const meta = getScenarioMeta(save.scenarioId);
  const rawScenarioName = meta ? tAll(meta.nameKey) : null;
  const scenarioName =
    rawScenarioName && rawScenarioName !== meta?.nameKey
      ? rawScenarioName
      : save.scenarioId;

  const relative = useMemo(
    () => formatRelative(save.savedAt, locale),
    [save.savedAt, locale],
  );
  const fullDate = useMemo(
    () => new Date(save.savedAt).toLocaleString(locale),
    [save.savedAt, locale],
  );

  return (
    <Link
      href={`/play/${encodeURIComponent(save.id)}`}
      className={cn(
        'group flex items-center gap-3 px-2 py-3',
        'transition-colors hover:bg-surface-1',
      )}
      style={{ transitionDuration: MOTION.normal }}
    >
      <span
        aria-hidden
        className="h-7 w-1 shrink-0 rounded-full"
        style={{
          backgroundColor: save.thumbnailColor,
          boxShadow: `0 0 10px -2px ${save.thumbnailColor}80`,
        }}
      />
      <span className="flex flex-1 flex-col truncate">
        <span className="truncate font-medium text-fg">{save.name}</span>
        <span className="truncate text-xs text-fg-muted">{scenarioName}</span>
      </span>
      <span
        className={cn(
          'shrink-0 font-mono text-xs tabular-nums text-fg-faint',
          // Compact relative time on small screens, full timestamp from
          // the sm breakpoint upward.
          'hidden sm:inline',
        )}
        title={fullDate}
      >
        {t('saveSavedAt', { date: fullDate })}
      </span>
      <span
        className="shrink-0 font-mono text-xs tabular-nums text-fg-faint sm:hidden"
        title={fullDate}
      >
        {relative}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Import "link" — a file input dressed as a quiet text link
// ---------------------------------------------------------------------------

function ImportLink({
  onPick,
  label,
}: {
  onPick: (file: File) => void;
  label: string;
}) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center rounded-sm transition-colors',
        'hover:text-fg focus-within:outline focus-within:outline-2',
        'focus-within:outline-offset-2 focus-within:outline-accent',
      )}
      style={{ transitionDuration: MOTION.fast }}
    >
      <span>{label}</span>
      <input
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Render a save's age relative to now, in the active locale, using
 * `Intl.RelativeTimeFormat`. Falls back to a plain timestamp on environments
 * without `Intl.RelativeTimeFormat` (very old Safari).
 */
function formatRelative(timestamp: number, locale: string): string {
  if (typeof Intl === 'undefined' || typeof Intl.RelativeTimeFormat !== 'function') {
    return new Date(timestamp).toLocaleString(locale);
  }
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diffSec = Math.round((timestamp - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return fmt.format(diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return fmt.format(diffMin, 'minute');
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return fmt.format(diffHr, 'hour');
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 30) return fmt.format(diffDay, 'day');
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return fmt.format(diffMonth, 'month');
  const diffYear = Math.round(diffMonth / 12);
  return fmt.format(diffYear, 'year');
}

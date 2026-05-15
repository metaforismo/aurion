// Home screen. Shows the title, a "new game" CTA, the list of existing saves,
// and a language switcher. Save list is read from IndexedDB so this page must
// be a client component.

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

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

export default function HomePage() {
  const t = useTranslations('home');
  const tApp = useTranslations('app');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

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

  const savesCount = saves?.length ?? 0;

  return (
    <main
      className={cn(
        'relative min-h-screen w-full bg-bg',
        // Subtle vertical wash so the hero "lifts" off the page without
        // fighting content underneath.
        'bg-gradient-to-b from-bg via-bg to-surface-1/40',
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-6 py-20">
        <header className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-3">
            <h1
              className={cn(
                'font-sans text-balance text-5xl font-bold tracking-tight text-fg',
                'sm:text-6xl',
              )}
            >
              {t('title')}
            </h1>
            <p className="text-balance text-lg text-fg-muted sm:text-xl">
              {t('subtitle')}
            </p>
            <p className="text-sm text-fg-faint">{tApp('tagline')}</p>
          </div>
          <LanguageSwitcher />
        </header>

        <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/new"
            className={cn(
              'inline-flex w-full items-center justify-center rounded-xl bg-accent px-6 py-3',
              'text-base font-semibold text-bg shadow-md transition-colors',
              'hover:bg-accent-strong sm:w-auto',
            )}
          >
            {t('newGame')}
          </Link>

          <ImportButton onPick={handleImport} label={t('import')} />
          {importError ? (
            <p
              className="text-sm text-danger sm:basis-full"
              role="alert"
            >
              {importError}
            </p>
          ) : null}
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">
              {t('continue')}
            </h2>
            {saves && saves.length > 0 ? (
              <span
                className={cn(
                  'rounded-full border border-border bg-surface/60 px-2.5 py-0.5',
                  'font-mono text-[11px] tabular-nums text-fg-muted',
                )}
                aria-label={String(savesCount)}
              >
                {savesCount}
              </span>
            ) : null}
          </div>

          {saves === null ? (
            <p className="text-sm text-fg-faint">{tCommon('loading')}</p>
          ) : saves.length === 0 ? (
            <EmptyState
              title={t('noSaves')}
              hint={t('emptyHint')}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {saves.map((save) => (
                <li key={save.id}>
                  <SaveRow save={save} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();
  const t = useTranslations('home');

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="sr-only">{t('languageSwitch')}</span>
      <div
        role="group"
        aria-label={t('languageSwitch')}
        className="flex items-center gap-1 rounded-full border border-border bg-surface/60 p-0.5"
      >
        {routing.locales.map((loc) => {
          const isActive = loc === currentLocale;
          return (
            <button
              key={loc}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                if (isActive) return;
                router.replace(pathname, { locale: loc as AppLocale });
              }}
              className={cn(
                'rounded-full px-2.5 py-1 font-mono text-xs font-medium uppercase tracking-wider',
                'transition-colors',
                isActive
                  ? 'bg-accent/15 text-accent'
                  : 'text-fg-muted hover:bg-surface-1 hover:text-fg',
              )}
              style={{ transitionDuration: MOTION.fast }}
            >
              {loc}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A single row in the "Continue" list. Resolves the save's scenario id to a
 * localised name through the registry; the difficulty preset is intentionally
 * not displayed here because `SaveSummary` omits the heavy `state` field that
 * carries `state.difficultyId` (the cheapest path that avoids a per-save load
 * is to widen the summary type, which is out of scope for the wizard refactor).
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
        'group flex items-center gap-3 rounded-xl border border-border bg-surface-1 px-4 py-3',
        'transition-colors hover:border-border-strong hover:bg-surface-2',
      )}
      style={{ transitionDuration: MOTION.normal }}
    >
      <span
        aria-hidden
        className={cn(
          'h-8 w-1.5 shrink-0 rounded-full',
          'transition-shadow',
        )}
        style={{
          backgroundColor: save.thumbnailColor,
          boxShadow: `0 0 12px -2px ${save.thumbnailColor}80`,
        }}
      />
      <span className="flex flex-1 flex-col truncate">
        <span className="truncate font-medium text-fg">{save.name}</span>
        <span className="truncate text-xs text-fg-muted">{scenarioName}</span>
      </span>
      <span
        className={cn(
          'shrink-0 font-mono text-xs tabular-nums text-fg-faint',
          // Show the relative time on small screens (compact), the full
          // formatted timestamp from the sm breakpoint upward.
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

function ImportButton({
  onPick,
  label,
}: {
  onPick: (file: File) => void;
  label: string;
}) {
  return (
    <label
      className={cn(
        'inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-border bg-surface/40 px-6 py-3',
        'text-base font-medium text-fg transition-colors',
        'hover:border-border-strong hover:bg-surface sm:w-auto',
      )}
      style={{ transitionDuration: MOTION.fast }}
    >
      <span>{label}</span>
      <input
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
    </label>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-2 rounded-xl border border-dashed border-border bg-surface/30 px-5 py-6',
      )}
    >
      <p className="text-sm font-medium text-fg-muted">{title}</p>
      <p className="text-sm text-fg-faint">{hint}</p>
    </div>
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

// Home screen. Shows the title, a "new game" CTA, the list of existing saves,
// and a language switcher. Save list is read from IndexedDB so this page must
// be a client component.

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Link, usePathname, useRouter } from '../../i18n/navigation';
import { routing, type AppLocale } from '../../i18n/routing';
import { cn } from '../../lib/cn';
import {
  importSave,
  isPersistenceAvailable,
  listSaves,
  type SaveSummary,
} from '../../lib/persistence';

export default function HomePage() {
  const t = useTranslations('home');
  const tApp = useTranslations('app');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

  const [saves, setSaves] = useState<SaveSummary[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPersistenceAvailable()) {
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-12 px-6 py-16">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-slate-50">
            {t('title')}
          </h1>
          <p className="mt-2 text-lg text-slate-400">{t('subtitle')}</p>
          <p className="mt-1 text-sm text-slate-500">{tApp('tagline')}</p>
        </div>
        <LanguageSwitcher />
      </header>

      <section className="flex flex-col gap-3">
        <Link
          href="/new"
          className={cn(
            'inline-flex w-full items-center justify-center rounded-xl bg-indigo-500 px-6 py-3 text-base font-semibold text-white',
            'transition-colors hover:bg-indigo-400 sm:w-auto sm:self-start',
          )}
        >
          {t('newGame')}
        </Link>

        <ImportButton onPick={handleImport} label={t('import')} />
        {importError ? (
          <p className="text-sm text-rose-400" role="alert">
            {importError}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          {t('continue')}
        </h2>
        {saves === null ? (
          <p className="text-sm text-slate-500">{tCommon('loading')}</p>
        ) : saves.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noSaves')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {saves.map((save) => (
              <li key={save.id}>
                <Link
                  href={`/play/${encodeURIComponent(save.id)}`}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3',
                    'transition-colors hover:border-slate-700 hover:bg-slate-900',
                  )}
                >
                  <span
                    aria-hidden
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: save.thumbnailColor }}
                  />
                  <span className="flex-1 truncate text-slate-100">
                    {save.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {t('saveSavedAt', {
                      date: new Date(save.savedAt).toLocaleString(),
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('home');

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">{t('languageSwitch')}:</span>
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => {
            router.replace(pathname, { locale: loc as AppLocale });
          }}
          className="rounded-md border border-slate-800 px-2 py-1 text-slate-300 hover:bg-slate-900"
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
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
        'inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 px-6 py-3 text-base font-medium text-slate-200',
        'transition-colors hover:border-slate-700 hover:bg-slate-900 sm:w-auto sm:self-start',
      )}
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

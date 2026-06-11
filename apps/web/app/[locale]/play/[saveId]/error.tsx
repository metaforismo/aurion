// Route-segment error boundary for the gameplay screen.
// Snapshots the current store state and offers a download so the player can
// recover their progress even if the play UI itself crashes.

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Link } from '../../../../i18n/navigation';
import { useGameStore } from '../../../../lib/store';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// English fallbacks in case the crash originated inside the intl provider —
// an error page must never throw while rendering.
const FALLBACK_LABELS = {
  title: 'Aurion crashed',
  description:
    'Something went wrong while rendering the game. Your progress can still be exported below.',
  download: 'Download crash report',
  downloaded: 'Downloaded ✓',
  retry: 'Retry',
  home: 'Home',
} as const;

type CrashLabelKey = keyof typeof FALLBACK_LABELS;

export default function PlayError({ error, reset }: ErrorPageProps) {
  const t = useTranslations('errors.crash');
  const state = useGameStore((s) => s.state);
  const saveId = useGameStore((s) => s.saveId);
  const saveName = useGameStore((s) => s.saveName);
  const [downloaded, setDownloaded] = useState(false);

  const label = (key: CrashLabelKey): string => {
    try {
      return t(key);
    } catch {
      return FALLBACK_LABELS[key];
    }
  };

  // Log to the console for debugging in dev / collected production logs.
  useEffect(() => {
    console.error('[play] route error boundary caught', error);
  }, [error]);

  const handleDownload = () => {
    if (!state) return;
    const payload = {
      id: saveId ?? 'unknown',
      name: saveName ?? `Crash recovery (${new Date().toISOString()})`,
      scenarioId: state.scenarioId,
      engineVersion: 'unknown',
      state,
      savedAt: Date.now(),
      thumbnailColor: '#ef4444',
      crash: {
        message: error.message,
        digest: error.digest ?? null,
        stack: error.stack ?? null,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aurion-crash-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-fg">
      <h1 className="text-2xl font-bold text-danger">{label('title')}</h1>
      <p className="text-sm text-fg-muted">{label('description')}</p>
      {error.message ? (
        <p className="max-w-full truncate rounded-sm border border-border bg-surface px-3 py-2 font-mono text-xs text-fg-faint">
          {error.message}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={!state}
          className="rounded-sm border border-accent bg-accent px-4 py-2 text-sm font-semibold text-bg transition hover:border-accent-strong hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-fg-faint"
        >
          {downloaded ? label('downloaded') : label('download')}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-sm border border-border bg-transparent px-4 py-2 text-sm text-fg transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          {label('retry')}
        </button>
        <Link
          href="/"
          className="rounded-sm border border-border bg-transparent px-4 py-2 text-sm text-fg transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          {label('home')}
        </Link>
      </div>
    </main>
  );
}

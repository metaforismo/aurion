// Route-segment error boundary for the gameplay screen.
// Snapshots the current store state and offers a download so the player can
// recover their progress even if the play UI itself crashes.

'use client';

import { useEffect, useState } from 'react';

import { Link } from '../../../../i18n/navigation';
import { useGameStore } from '../../../../lib/store';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function PlayError({ error, reset }: ErrorPageProps) {
  const state = useGameStore((s) => s.state);
  const saveId = useGameStore((s) => s.saveId);
  const saveName = useGameStore((s) => s.saveName);
  const [downloaded, setDownloaded] = useState(false);

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
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold text-rose-300">Aurion crashed</h1>
      <p className="text-sm text-slate-400">{error.message}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={!state}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500"
        >
          {downloaded ? 'Downloaded ✓' : 'Download crash report'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm hover:border-slate-600"
        >
          Retry
        </button>
        <Link
          href="/"
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm hover:border-slate-600"
        >
          Home
        </Link>
      </div>
    </main>
  );
}

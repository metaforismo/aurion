'use client';

// Game screen. Three-column layout:
//   left   — vertical panel rail (PanelTabs) with the active panel rendered in-place
//   center — interactive world map
//   right  — narrative event stream
// HUD sticks to the top, ModalRoot lives at the document root.

import { useEffect } from 'react';
import { use } from 'react';
import { useTranslations } from 'next-intl';
import type { SaveId } from '@aurion/engine';

import Hud from '../../../../components/Hud';
import WorldMap from '../../../../components/Map';
import ModalRoot from '../../../../components/Modals';
import NotificationStream from '../../../../components/Notifications';
import PanelTabs from '../../../../components/Panels';
import TutorialOverlay from '../../../../components/Tutorial';
import { useGameStore } from '../../../../lib/store';
import { useTicker } from '../../../../lib/ticker';

export default function PlayPage({
  params,
}: {
  params: Promise<{ saveId: string; locale: string }>;
}) {
  const { saveId } = use(params);
  const t = useTranslations('play');

  const state = useGameStore((s) => s.state);
  const storeSaveId = useGameStore((s) => s.saveId);
  const isLoading = useGameStore((s) => s.isLoading);
  const loadGame = useGameStore((s) => s.loadGame);

  // Hydrate the store from IndexedDB if the user landed here directly
  // (refresh, deep link, etc.).
  useEffect(() => {
    if (storeSaveId === saveId && state) return;
    void loadGame(saveId as SaveId).catch(() => {
      // Errors surface via store.lastErrors (and the in-app toasts).
    });
  }, [saveId, storeSaveId, state, loadGame]);

  // Drives the rAF tick loop. Mounted at the page level so it lives for the
  // whole game session.
  useTicker();

  if (isLoading || !state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        {t('loadingState')}
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <Hud />
      <div className="grid flex-1 grid-cols-1 gap-2 p-2 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
        <PanelTabs />
        <WorldMap />
        <NotificationStream />
      </div>
      <ModalRoot />
      {/* First-time tutorial — self-bootstraps from the persisted dismissed
          flag. Renders nothing once the player has seen / skipped it. */}
      <TutorialOverlay />
    </main>
  );
}

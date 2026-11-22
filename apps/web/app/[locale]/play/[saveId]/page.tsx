'use client';

// Game screen. The world fills the viewport; the HUD (top), the system dock
// and drawer (left) and the briefing (right) float over it as glass.

import { use, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { SaveId } from '@aurion/engine';

import { AchievementToast } from '../../../../components/Achievements';
import { AudioProvider } from '../../../../components/Audio';
import { Briefing } from '../../../../components/Briefing/Briefing';
import MapStage from '../../../../components/Globe/MapStage';
import Hud from '../../../../components/Hud';
import ModalRoot from '../../../../components/Modals';
import { ActionToastStack, VictoryToast } from '../../../../components/Notifications';
import PanelTabs from '../../../../components/Panels';
import { PlayAudio } from '../../../../components/Play/PlayAudio';
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
  const tApp = useTranslations('app');

  const state = useGameStore((s) => s.state);
  const storeSaveId = useGameStore((s) => s.saveId);
  const isLoading = useGameStore((s) => s.isLoading);
  const loadGame = useGameStore((s) => s.loadGame);

  // Hydrate the store from IndexedDB when the player lands here directly
  // (refresh, deep link).
  useEffect(() => {
    if (storeSaveId === saveId && state) return;
    void loadGame(saveId as SaveId).catch(() => {
      // Errors surface via store.lastErrors and the in-app toasts.
    });
  }, [saveId, storeSaveId, state, loadGame]);

  // Drives the tick loop for the whole session.
  useTicker();

  if (isLoading || !state) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#010206] text-fg-muted">
        <span
          aria-hidden
          className="animate-pulse select-none font-mono text-xs font-semibold uppercase tracking-[0.32em] text-fg-faint"
        >
          {tApp('name')}
        </span>
        <span role="status" className="text-sm">
          {t('loadingState')}
        </span>
      </main>
    );
  }

  return (
    <AudioProvider>
      {/* Music and sound cues that follow the game state. No DOM. */}
      <PlayAudio />
      <main className="relative h-[100dvh] overflow-hidden bg-[#010206] text-fg">
        <MapStage />
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col gap-2 p-2">
          <Hud />
          <div className="flex min-h-0 flex-1 flex-col justify-between gap-2 lg:flex-row">
            <PanelTabs className="max-h-[55%] lg:max-h-none" />
            {/* Desktop: a rail on the right. Phone: a pill at the bottom that
                opens as a sheet over the lower half of the planet. */}
            <div className="flex max-h-[55%] min-h-0 items-end pb-24 lg:max-h-none lg:items-start lg:pb-0">
              <Briefing />
            </div>
          </div>
        </div>
        <ModalRoot />
        {/* Self-managed toasts: achievements, Odyssey milestones, action
            confirmations. Each reads its own slice of the store. */}
        <AchievementToast />
        <VictoryToast />
        <ActionToastStack />
        {/* First-run tour; renders nothing once seen or skipped. */}
        <TutorialOverlay />
      </main>
    </AudioProvider>
  );
}

'use client';

// Game screen. Three-column layout:
//   left   — vertical panel rail (PanelTabs) with the active panel rendered in-place
//   center — interactive world map
//   right  — narrative event stream
// HUD sticks to the top, ModalRoot lives at the document root.

import { useCallback, useEffect, useState } from 'react';
import { use } from 'react';
import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import type { SaveId } from '@aurion/engine';

import { AchievementToast } from '../../../../components/Achievements';
import {
  AudioProvider,
  useEventModalSfx,
  useGameplayMusic,
  useNotificationSfx,
} from '../../../../components/Audio';
import Hud from '../../../../components/Hud';
import WorldMap from '../../../../components/Map';
import ModalRoot from '../../../../components/Modals';
import NotificationStream, {
  ActionToastStack,
  VictoryToast,
} from '../../../../components/Notifications';
import { FirstGameHints } from '../../../../components/Onboarding';
import { ObjectivesCard } from '../../../../components/Onboarding/ObjectivesCard';
import PanelTabs from '../../../../components/Panels';
import TutorialOverlay from '../../../../components/Tutorial';
import { useGameStore } from '../../../../lib/store';
import { useTicker } from '../../../../lib/ticker';

// Initial value for the right-rail grid track. The NotificationStream pushes
// updates via `onWidthChange` once mounted; this matches the previous static
// width so the first paint is unchanged.
const DEFAULT_RAIL_W = '20rem';

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

  // Right rail width — driven by NotificationStream via `onWidthChange`. We
  // publish it as a CSS custom property on the grid container so the third
  // track resizes smoothly (the rail itself transitions its own internal
  // width over 200ms, this keeps the grid in lock-step).
  const [railWidth, setRailWidth] = useState<string>(DEFAULT_RAIL_W);
  const handleRailWidth = useCallback((w: string) => setRailWidth(w), []);
  // CSSProperties doesn't type custom properties; the cast is the standard
  // workaround when publishing variables inline.
  const gridStyle = { '--rail-w': railWidth } as CSSProperties;

  if (isLoading || !state) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg text-fg-muted">
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
      {/* Audio behaviours mounted *inside* the provider so they have a
          context to read from. Side-effect-only — no DOM. */}
      <PlayAudioBindings />
      <main className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-bg text-fg">
        <Hud />
        {/* Three-column work surface. We give the row a fixed height equal to
            the viewport minus the HUD (52px — see Hud.tsx) so that the map
            column never inherits the natural height of an oversized panel
            (e.g. the full Research tech tree, which can grow to >10k px and
            push the SVG's preserveAspectRatio off-screen). Each column owns
            its own overflow: the left rail and the right notification stream
            scroll independently; the centre map stays pinned and resizes via
            preserveAspectRatio.

            The right column's width comes from `--rail-w` (defaulting to
            20rem) so the NotificationStream can shrink itself to its slim
            collapsed state without leaving a gap. */}
        <div
          className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden p-2 lg:grid-cols-[18rem_minmax(0,1fr)_var(--rail-w,20rem)]"
          style={gridStyle}
        >
          <PanelTabs />
          <WorldMap />
          <NotificationStream
            onWidthChange={handleRailWidth}
            topSlot={<ObjectivesCard />}
          />
        </div>
        <ModalRoot />
        {/* Cross-game achievement toast — self-managed: reads
            `pendingAchievementToast` from the store and auto-dismisses. */}
        <AchievementToast />
        {/* Eternal-mode victory milestone toast — self-managed: reads
            `pendingVictoryToast` from the store and auto-dismisses. The
            celebratory first-victory modal lives in ModalRoot above; this
            toast covers every subsequent milestone in an Eternal run. */}
        <VictoryToast />
        {/* Action-confirmation toasts — UN propose, nuclear launch, bloc
            join/leave. Self-managed: reads `actionToasts` from the store
            and auto-dismisses each entry. */}
        <ActionToastStack />
        {/* First-time tutorial — self-bootstraps from the persisted dismissed
            flag. Renders nothing once the player has seen / skipped it. */}
        <TutorialOverlay />
        {/* Light-touch hint annotations for the very first game. Suppresses
            itself when the tutorial is active or once the player has
            dismissed (see FirstGameHints for the localStorage key). */}
        <FirstGameHints />
      </main>
    </AudioProvider>
  );
}

/**
 * Empty component whose only job is to mount the audio hooks under the
 * AudioProvider. Splitting them out keeps the page component readable and
 * lets us add / remove behaviours without touching the JSX tree.
 */
function PlayAudioBindings() {
  useGameplayMusic();
  useEventModalSfx();
  useNotificationSfx();
  return null;
}

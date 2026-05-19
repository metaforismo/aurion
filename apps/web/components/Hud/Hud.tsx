// Top HUD bar. Flat editorial row (FT terminal / Bloomberg header aesthetic):
// brand wordmark left, then date · treasury · popularity · reputation · speed
// counters · menu. No glass background — a single 1px hairline bottom border
// on the base `bg-bg` separates the strip from the play area. Composes the
// date / treasury / popularity / speed / menu sub-components and installs the
// global spacebar-to-toggle-pause shortcut.
//
// Vertical rhythm: 52px tall, dense but readable. Horizontal rhythm: ~28px
// gap between groups, 8px within a group. Sub-badges render as inline
// label + value pairs — they own no border, no background, no radius. The
// only chrome lives on interactive controls (speed buttons, icon buttons,
// menu trigger) and reduces to a hover tint.

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useTicker } from '../../lib/ticker';
import { selectIronMan, useGameStore } from '../../lib/store';

import { AudioVolumeButton } from './AudioVolumeButton';
import { DateBadge } from './DateBadge';
import { IronManBadge } from './IronManBadge';
import { MenuButton } from './MenuButton';
import { PopularityBadge } from './PopularityBadge';
import { ReputationBadges } from './ReputationBadges';
import { SpeedControls } from './SpeedControls';
import { TreasuryBadge } from './TreasuryBadge';
import { VictoryCounter } from './VictoryCounter';

export type HudProps = {
  /** Optional toast callback for menu actions. */
  onNotify?: (message: string) => void;
};

export function Hud({ onNotify }: HudProps) {
  const ticker = useTicker();
  const ironMan = useGameStore(selectIronMan);
  const tApp = useTranslations('app');
  const [internalToast, setInternalToast] = useState<string | null>(null);

  // Spacebar = toggle pause. Ignored when the user is typing in an input or
  // when an interactive (text-edit) element is focused, so we don't fight the
  // OS / Next.js form widgets.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      if (ticker.speed === 0) {
        ticker.resume();
      } else {
        ticker.setSpeed(0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ticker]);

  const notify = onNotify ?? setInternalToast;

  return (
    <header className="sticky top-0 z-20 flex h-[52px] items-center gap-x-7 border-b border-border bg-bg px-5 text-sm">
      {/* Brand wordmark — small caps, wide tracking, anchors the row left. */}
      <span
        aria-label={tApp('name')}
        className="select-none text-xs font-semibold uppercase tracking-[0.18em] text-fg"
      >
        {tApp('name')}
      </span>
      <span aria-hidden="true" className="text-fg-faint">
        ·
      </span>
      <DateBadge />
      {ironMan ? <IronManBadge /> : null}
      <TreasuryBadge />
      <PopularityBadge />
      {/* Phase 3 — bloc reputation chips. Hide themselves when the active
          scenario does not opt into the bloc system (i.e. state.reputation
          is undefined), so Phase 1/2 saves see the previous HUD layout. */}
      <ReputationBadges />
      {/* Phase 3 — Eternal-mode multi-victory counter. Hides itself unless
          state.gameMode === 'eternal'. */}
      <VictoryCounter />
      <SpeedControls />
      <div className="ml-auto flex items-center gap-1">
        <AudioVolumeButton />
        <MenuButton onNotify={notify} />
      </div>
      {/* Internal fallback toast — only used if no parent notifier is wired. */}
      {!onNotify && internalToast ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-md border border-border-strong bg-surface-1/90 px-3 py-2 text-xs text-fg shadow-lg"
        >
          {internalToast}
        </div>
      ) : null}
    </header>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export default Hud;

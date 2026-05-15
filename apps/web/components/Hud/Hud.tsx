// Top HUD bar. Sticky, dark slate, ~56px tall. Composes the date / treasury /
// popularity / speed / menu sub-components. Also installs the global
// spacebar-to-toggle-pause shortcut.

'use client';

import { useEffect, useState } from 'react';

import { useTicker } from '../../lib/ticker';

import { DateBadge } from './DateBadge';
import { MenuButton } from './MenuButton';
import { PopularityBadge } from './PopularityBadge';
import { SpeedControls } from './SpeedControls';
import { TreasuryBadge } from './TreasuryBadge';

export type HudProps = {
  /** Optional toast callback for menu actions. */
  onNotify?: (message: string) => void;
};

export function Hud({ onNotify }: HudProps) {
  const ticker = useTicker();
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
    <header className="glass-surface sticky top-0 z-20 flex h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4">
      <DateBadge />
      <TreasuryBadge />
      <PopularityBadge />
      <div className="ml-2">
        <SpeedControls />
      </div>
      <div className="ml-auto flex items-center gap-2">
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

// Speed control row. Plain text buttons — `⏸  1×  2×  4×` — with the active
// speed coloured in `text-accent`. No pill background, no segmented border:
// in the FT-terminal aesthetic the buttons are typographic, not chromed.
//
// Visual grouping: the pause glyph sits with the speed multipliers as one
// transport-style cluster `[⏸] [1× 2× 4×]`, then a wider gap before the
// "auto-pausa" state tag — so the row reads `[transport] ... STATE` rather
// than `[icon] [speeds] [state]` running together. The state caps tag only
// appears when the engine has paused itself for an open event / hidden tab /
// win-loss state.
//
// Two motion treatments live on the speed buttons:
//   1. Click flash — a short 200ms ease that bumps the colour briefly on
//      selection. Triggers on EVERY click, including identical consecutive
//      clicks (we bump a key so the keyframe restarts cleanly).
//   2. Active pulse — a slow 1.6s opacity wobble on the active button when
//      the game is running above 1× (so `2×` and `4×` only). 1× and pause
//      stay perfectly still — pulsing the baseline would read as "always
//      alarmed". The pulse is suspended while the flash is in flight so
//      the two animations don't fight for the `animation` property.
//
// Both animations honour `prefers-reduced-motion: reduce` via the blanket
// CSS rule in `globals.css` (animation-duration → 0.01ms).
//
// Auto-pause indicator: when the engine has auto-paused itself, the caps
// tag earns a 1.5px ring (in `--color-warning`) and a small pulsing dot
// before the label. Both the ring and the dot make the state impossible to
// miss compared to the previous text-only treatment.

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/cn';
import { type Speed } from '../../lib/store';
import { useTicker } from '../../lib/ticker';

const PAUSE_SPEED: Speed = 0;
const PLAY_SPEEDS: readonly Speed[] = [1, 2, 4];

// Total flash window: 90ms in + 110ms ease-back. Used to clear the
// `flashId` after the keyframe finishes so a re-click can re-trigger.
const FLASH_DURATION_MS = 200;

export function SpeedControls() {
  const ticker = useTicker();
  const t = useTranslations('hud.speed');
  const tHud = useTranslations('hud');

  // Track which speed the user just clicked so we can briefly flash its
  // colour. `flashKey` is bumped on every click so identical consecutive
  // clicks (e.g. clicking 1× while already at 1×) still retrigger the
  // animation by changing the inline `animation-name` cache key.
  const [flash, setFlash] = useState<{ speed: Speed; key: number } | null>(
    null,
  );
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const handleSelect = (s: Speed) => {
    ticker.setSpeed(s);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlash((prev) => ({ speed: s, key: (prev?.key ?? 0) + 1 }));
    flashTimerRef.current = setTimeout(() => {
      setFlash(null);
    }, FLASH_DURATION_MS);
  };

  const renderButton = (s: Speed) => {
    const active = ticker.speed === s;
    const flashing = flash?.speed === s;
    // Pulse only the active button when running above 1×. 1× is the calm
    // baseline; pause is definitively still — neither should pulse. The
    // pulse is suspended while the click-flash is in flight (single
    // `animation` slot per element).
    const pulsing = active && !flashing && (s === 2 || s === 4);
    // `key={flash.key}` forces React to remount the <button> on each flash,
    // which restarts the CSS animation cleanly. Cheap (single text node).
    const reactKey = flashing ? `${s}-${flash!.key}` : `${s}`;
    return (
      <button
        key={reactKey}
        type="button"
        onClick={() => handleSelect(s)}
        aria-pressed={active}
        aria-label={speedAriaLabel(s, t)}
        style={
          flashing
            ? { animation: 'speed-flash 200ms cubic-bezier(0.4, 0, 0.2, 1) both' }
            : pulsing
              ? { animation: 'hud-speed-pulse 1.6s ease-in-out infinite' }
              : undefined
        }
        className={cn(
          'numeric-tabular transition-colors',
          active ? 'text-accent' : 'text-fg-muted hover:text-fg',
        )}
      >
        <span aria-hidden="true">{speedGlyph(s)}</span>
      </button>
    );
  };

  return (
    <div className="flex items-baseline gap-5">
      <div
        className="flex items-baseline gap-3 font-mono text-sm"
        role="group"
        aria-label={t('label')}
      >
        {/* Transport cluster: pause sits with the speeds, separated by a
            slightly wider gap so it reads as a related-but-distinct control. */}
        {renderButton(PAUSE_SPEED)}
        <div className="flex items-baseline gap-2">
          {PLAY_SPEEDS.map(renderButton)}
        </div>
      </div>
      {ticker.isAutoPaused ? (
        <span
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning"
          style={{
            // 1.5px warning ring around the tag — strong enough to read
            // without becoming a chip. Inline so we don't burn a Tailwind
            // arbitrary-value token on a one-off.
            boxShadow: 'inset 0 0 0 1.5px var(--color-warning)',
          }}
        >
          <span
            aria-label={tHud('autoPausedDotLabel')}
            className="inline-block h-1.5 w-1.5 rounded-full bg-warning"
            style={{
              animation: 'hud-auto-pause-pulse 1.1s ease-in-out infinite',
            }}
          />
          {tHud('autoPaused')}
        </span>
      ) : null}
    </div>
  );
}

function speedGlyph(s: Speed): string {
  switch (s) {
    case 0:
      return '⏸';
    case 1:
      return '1×';
    case 2:
      return '2×';
    case 4:
      return '4×';
  }
}

function speedAriaLabel(s: Speed, t: ReturnType<typeof useTranslations<'hud.speed'>>): string {
  switch (s) {
    case 0:
      return t('paused');
    case 1:
      return t('x1');
    case 2:
      return t('x2');
    case 4:
      return t('x4');
  }
}

export default SpeedControls;

// Speed control segmented button. Pause / 1x / 2x / 4x. Wires to the ticker
// hook so that pressing a button actually drives the rAF loop. A small
// "auto-pausa" pill appears when the engine has paused itself for an open
// event / hidden tab / win-loss state.

'use client';

import { useTranslations } from 'next-intl';

import { cn } from '../../lib/cn';
import { type Speed } from '../../lib/store';
import { useTicker } from '../../lib/ticker';

const SPEEDS: readonly Speed[] = [0, 1, 2, 4];

export function SpeedControls() {
  const ticker = useTicker();
  const t = useTranslations('hud.speed');
  const tHud = useTranslations('hud');

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-0.5 rounded-md border border-border bg-bg/40 p-0.5"
        role="group"
        aria-label={t('label')}
      >
        {SPEEDS.map((s) => {
          const active = ticker.speed === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => ticker.setSpeed(s)}
              aria-pressed={active}
              aria-label={speedAriaLabel(s, t)}
              className={cn(
                'rounded-sm px-2 py-1 text-xs font-mono transition',
                active
                  ? 'bg-accent/20 text-accent shadow-inner'
                  : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              <span aria-hidden="true">{speedGlyph(s)}</span>
            </button>
          );
        })}
      </div>
      {ticker.isAutoPaused ? (
        <span className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-warning">
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
      return '▶';
    case 2:
      return '▶▶';
    case 4:
      return '▶▶▶';
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

// Speed control row. Plain text buttons — `⏸  1×  2×  4×` — with the active
// speed coloured in `text-accent`. No pill background, no segmented border:
// in the FT-terminal aesthetic the buttons are typographic, not chromed.
// A small "auto-pausa" caps tag appears when the engine has paused itself
// for an open event / hidden tab / win-loss state.

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
    <div className="flex items-baseline gap-2">
      <div
        className="flex items-baseline gap-2 font-mono text-sm"
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
                'numeric-tabular transition-colors',
                active
                  ? 'text-accent'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              <span aria-hidden="true">{speedGlyph(s)}</span>
            </button>
          );
        })}
      </div>
      {ticker.isAutoPaused ? (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-warning">
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

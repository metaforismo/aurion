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

'use client';

import { useTranslations } from 'next-intl';

import { cn } from '../../lib/cn';
import { type Speed } from '../../lib/store';
import { useTicker } from '../../lib/ticker';

const PAUSE_SPEED: Speed = 0;
const PLAY_SPEEDS: readonly Speed[] = [1, 2, 4];

export function SpeedControls() {
  const ticker = useTicker();
  const t = useTranslations('hud.speed');
  const tHud = useTranslations('hud');

  const renderButton = (s: Speed) => {
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

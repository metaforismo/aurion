// Iron Man badge — small chip rendered in the HUD bar whenever the active
// difficulty has `ironMan: true`. It is purely informational: it tells the
// player that autosave is off, manual saves are locked while the run is in
// progress, and the partita ends permanently on the first defeat. The
// gameplay enforcement itself lives in `lib/store.ts` (`saveGame`,
// `advanceTick`) and `components/Hud/MenuButton.tsx` (UI gating).
//
// The badge uses the `danger` tone so it reads as a meaningful gameplay
// state. It exposes its tooltip via `title` (browser native) and an aria
// label so assistive tech still surfaces the explanation.

'use client';

import { useTranslations } from 'next-intl';

import { toneChip } from '../../lib/theme';

export function IronManBadge() {
  const t = useTranslations('hud.ironMan');
  const tooltip = t('tooltip');

  return (
    <span
      role="status"
      aria-label={tooltip}
      title={tooltip}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${toneChip(
        'danger',
      )}`}
    >
      <SkullIcon />
      <span className="numeric-tabular">{t('badge')}</span>
    </span>
  );
}

function SkullIcon() {
  // Inline SVG keeps the HUD bundle dep-free (no lucide-react import) while
  // matching the visual weight of the other HUD badges.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 1.5a6.5 6.5 0 0 0-3.5 11.99V15a1.5 1.5 0 0 0 1.5 1.5h.5v1.25a.75.75 0 0 0 1.5 0V16.5h0V16.5h0v1.25a.75.75 0 0 0 1.5 0V16.5h.5a1.5 1.5 0 0 0 1.5-1.5v-1.51A6.5 6.5 0 0 0 10 1.5Zm-3 7a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm-2.75 3.25a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default IronManBadge;

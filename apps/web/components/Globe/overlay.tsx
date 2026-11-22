'use client';

// Map lenses: what the political layer is coloured by, and the control that
// switches between them.

import { Eye, Flame, Handshake, Layers, Shapes } from 'lucide-react';
import type { ActiveBlocId, CountryId, GameState, IntelLevel } from '@aurion/engine';

import { Segmented, type SegmentedOption } from '../ui';

export type OverlayMode = 'none' | 'tension' | 'alliances' | 'intel' | 'blocs';
export type BlocColorKey = ActiveBlocId | 'unaligned';

export const BLOC_HEX: Readonly<Record<BlocColorKey, string>> = {
  western: '#4d8dff',
  eastern: '#ff5d4d',
  'non-aligned': '#5fe0a0',
  unaligned: '#9aa3b2',
};

const ICONS = { none: Layers, tension: Flame, alliances: Handshake, intel: Eye, blocs: Shapes } as const;
const ORDER: readonly OverlayMode[] = ['none', 'tension', 'alliances', 'intel', 'blocs'];

/** What the player knows about every country (their own is always full). */
export function computeIntelMask(state: GameState): Map<CountryId, IntelLevel> {
  const out = new Map<CountryId, IntelLevel>();
  const player = state.countries[state.playerCountryId];
  if (!player) return out;
  for (const id of Object.keys(state.countries)) {
    out.set(id, id === player.id ? 'full' : (player.intelligence.knownIntel[id] ?? 'none'));
  }
  return out;
}

export function OverlaySwitch({
  mode,
  onChange,
  label,
  labels,
  blocsDisabledReason,
  blocLabels,
  blocGroupLabel,
}: {
  mode: OverlayMode;
  onChange: (mode: OverlayMode) => void;
  /** Accessible name of the control. */
  label: string;
  labels: Record<OverlayMode, string>;
  /** Set when the scenario has no blocs; shown as the option's tooltip. */
  blocsDisabledReason?: string;
  blocLabels: Record<BlocColorKey, string>;
  blocGroupLabel: string;
}) {
  const options: SegmentedOption<OverlayMode>[] = ORDER.map((m) => ({
    value: m,
    label: <span className="hidden sm:inline">{labels[m]}</span>,
    icon: ICONS[m],
    disabled: m === 'blocs' && blocsDisabledReason !== undefined,
    title: m === 'blocs' && blocsDisabledReason ? blocsDisabledReason : labels[m],
  }));
  return (
    <div className="flex flex-col items-center gap-2">
      {mode === 'blocs' ? (
        <ul
          aria-label={blocGroupLabel}
          className="glass-panel flex flex-wrap items-center gap-3 rounded-full px-3 py-1.5 text-[11px] text-fg-muted"
        >
          {(Object.keys(BLOC_HEX) as BlocColorKey[]).map((key) => (
            <li key={key} className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: BLOC_HEX[key] }} />
              {blocLabels[key]}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="glass-panel rounded-2xl p-0.5" data-testid="map-overlay-switch">
        <Segmented label={label} value={mode} onChange={onChange} options={options} size="sm" className="border-0 bg-transparent" />
      </div>
    </div>
  );
}

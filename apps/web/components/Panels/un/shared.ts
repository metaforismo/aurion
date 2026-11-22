'use client';

// What the UN panel needs to know about a resolution beyond its raw record:
// which target each kind takes, who may table it, how to name it, how the
// votes stand and what its effects mean in words.

import type { EventEffect, UNResolution, UNResolutionKind, UNVote } from '@aurion/engine';
import {
  Ban,
  Gavel,
  HandHeart,
  Landmark,
  Leaf,
  Radiation,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { signed } from '../../../lib/format';
import { formatAttitude, type World } from '../diplomacy/world';

export const KINDS: readonly UNResolutionKind[] = [
  'humanitarian',
  'climate',
  'sanctions',
  'condemnation',
  'recognition',
  'peacekeeping',
  'nonProliferation',
];

export const KIND_ICON: Record<UNResolutionKind, LucideIcon> = {
  humanitarian: HandHeart,
  climate: Leaf,
  sanctions: Ban,
  condemnation: Gavel,
  recognition: Landmark,
  peacekeeping: ShieldCheck,
  nonProliferation: Radiation,
};

/** What a resolution of this kind is aimed at. */
export const KIND_TARGET: Record<UNResolutionKind, 'country' | 'region' | 'none'> = {
  humanitarian: 'none',
  climate: 'none',
  sanctions: 'country',
  condemnation: 'country',
  recognition: 'country',
  peacekeeping: 'region',
  nonProliferation: 'none',
};

/** Kinds any member may table; the rest are reserved to the council (engine: SOFT_KINDS). */
export const OPEN_KINDS: readonly UNResolutionKind[] = ['humanitarian', 'climate'];

/** Weeks a resolution tabled by the player stays open (engine: proposeUNResolution). */
export const PLAYER_VOTING_WEEKS = 4;

export type Tally = Record<UNVote, number> & { cast: number; pending: number };

export function tallyOf(resolution: UNResolution, countries: number): Tally {
  const out: Tally = { yes: 0, no: 0, abstain: 0, veto: 0, cast: 0, pending: 0 };
  for (const vote of Object.values(resolution.votes)) {
    out[vote] += 1;
    out.cast += 1;
  }
  out.pending = Math.max(0, countries - out.cast);
  return out;
}

/**
 * Title and description of a resolution. Scenario resolutions carry keys of
 * the scenario bundle; anything else falls back to the name of its kind.
 */
export function useResolutionText(w: World): (r: UNResolution) => { title: string; description: string } {
  const t = useTranslations();
  const resolve = (key: string, fallback: string): string => {
    const fromScenario = w.tScenario(key);
    if (fromScenario && fromScenario !== key) return fromScenario;
    return t.has(key) ? t(key) : fallback;
  };
  return (r) => ({
    title: resolve(r.titleKey, t(`panelUN.kind.${r.kind}`)),
    description: resolve(r.descriptionKey, t(`panelUN.kindDescription.${r.kind}`)),
  });
}

const STATS = ['worldTension', 'popularity', 'treasury', 'gdp', 'armySize', 'doctrineLevel', 'taxRate', 'spyCount'];

/** The effects of one outcome as sentences; effects the engine ignores are left out. */
export function useEffectLines(w: World): (r: UNResolution, effects: readonly EventEffect[]) => string[] {
  const t = useTranslations('panelUN.effects');
  return (r, effects) => {
    const lines: string[] = [];
    for (const e of effects) {
      if (e.type === 'modifyStat') {
        if (e.delta === 0 || !STATS.includes(e.stat)) continue;
        const delta =
          e.stat === 'treasury' || e.stat === 'gdp' ? signed(e.delta, w.locale) : formatAttitude(e.delta);
        if (e.stat === 'worldTension') {
          lines.push(t('worldTension', { delta }));
          continue;
        }
        const id = e.target === 'player' ? w.player.id : e.target === 'target' ? r.targetCountryId : e.target;
        if (!id || !w.state.countries[id]) continue;
        lines.push(t(`stat.${e.stat}`, { delta, name: id === w.player.id ? t('you') : w.nameOf(id) }));
      } else if (e.type === 'shiftAttitude') {
        if (e.delta === 0 || !w.state.countries[e.with]) continue;
        lines.push(
          t('attitude', {
            delta: formatAttitude(e.delta),
            a: w.nameOf(r.proposerCountryId),
            b: w.nameOf(e.with),
          }),
        );
      }
    }
    return lines;
  };
}

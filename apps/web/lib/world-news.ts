// World news — what changed between nations, derived by watching the game
// state. The engine keeps relations but not their history, so this records
// each change (a war, a peace, an alliance, sanctions, a trade deal) the
// moment it happens, for the globe pins and the briefing feed. Session-only:
// a reloaded save starts with a quiet wire.

import { create } from 'zustand';
import type { CountryId, GameState } from '@aurion/engine';

import { useGameStore } from './store';

export type WorldNewsKind = 'warStart' | 'peace' | 'alliance' | 'allianceBroken' | 'sanctions' | 'trade';

export type WorldNewsItem = {
  id: string;
  tick: number;
  kind: WorldNewsKind;
  a: CountryId;
  b: CountryId;
};

const LIMIT = 40;

type WorldNewsState = { saveId: string | null; items: WorldNewsItem[] };

export const useWorldNews = create<WorldNewsState>(() => ({ saveId: null, items: [] }));

function diff(prev: GameState, next: GameState): WorldNewsItem[] {
  const out: WorldNewsItem[] = [];
  for (const [key, rel] of Object.entries(next.relations)) {
    const before = prev.relations[key as keyof typeof prev.relations];
    const had = (t: string) => before?.treaties.includes(t as never) ?? false;
    const has = (t: string) => rel.treaties.includes(t as never);
    const push = (kind: WorldNewsKind) =>
      out.push({ id: `${kind}:${key}:${next.tick}`, tick: next.tick, kind, a: rel.countryA, b: rel.countryB });
    if (rel.atWar && !(before?.atWar ?? false)) push('warStart');
    if (!rel.atWar && (before?.atWar ?? false)) push('peace');
    if (has('alliance') && !had('alliance')) push('alliance');
    if (!has('alliance') && had('alliance')) push('allianceBroken');
    if (has('sanctions') && !had('sanctions')) push('sanctions');
    if (has('tradeDeal') && !had('tradeDeal')) push('trade');
  }
  return out;
}

let started = false;

/** Start recording. Idempotent; called by the play screen. */
export function startWorldNews(): void {
  if (started) return;
  started = true;
  useGameStore.subscribe((state, prev) => {
    const next = state.state;
    if (!next) return;
    const current = useWorldNews.getState();
    // A different save (or the first one): reset, nothing to compare against.
    if (current.saveId !== state.saveId || !prev.state || prev.saveId !== state.saveId) {
      if (current.saveId !== state.saveId) useWorldNews.setState({ saveId: state.saveId, items: [] });
      return;
    }
    if (prev.state.relations === next.relations) return;
    const fresh = diff(prev.state, next);
    if (fresh.length === 0) return;
    useWorldNews.setState({ saveId: state.saveId, items: [...current.items, ...fresh].slice(-LIMIT) });
  });
}

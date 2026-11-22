'use client';

// Save-game helpers shared by the title screen, the save browser and
// Settings: list/refresh, a light "digest" of a save's state for display,
// and the download side of export.

import type { GameMode, GameState } from '@aurion/engine';
import { useCallback, useEffect, useState } from 'react';

import {
  exportSave,
  isPersistenceAvailable,
  listSaves,
  loadSave,
  type SaveEntry,
  type SaveSummary,
} from '../../lib/persistence';

const WEEKS_PER_YEAR = 52;

/** What the menus show about a save without mounting the game. */
export type SaveDigest = {
  nationKey: string;
  nationColor: string;
  tick: number;
  gameMode: GameMode;
  difficultyId: string;
  outcome: GameState['winLoss'];
  /** Player's Kardashev rating; null for saves that predate megaprojects. */
  kardashev: number | null;
  projectsDone: number | null;
  treasury: number;
  gdp: number;
  gdpRank: number;
  nations: number;
  popularity: number;
  /** Milestones reached in open-ended modes; null elsewhere. */
  victories: number | null;
};

export function digestSave(entry: SaveEntry): SaveDigest | null {
  const { state } = entry;
  const player = state.countries[state.playerCountryId];
  if (!player) return null;
  const all = Object.values(state.countries);
  const gdpRank = 1 + all.filter((c) => c.economy.gdp > player.economy.gdp).length;
  return {
    nationKey: player.nameKey,
    nationColor: player.color,
    tick: state.tick,
    gameMode: state.gameMode ?? 'classic',
    difficultyId: state.difficultyId,
    outcome: state.winLoss,
    kardashev: state.cosmos ? state.cosmos.kardashev : null,
    projectsDone: state.cosmos ? state.cosmos.completed.length : null,
    treasury: player.economy.treasury,
    gdp: player.economy.gdp,
    gdpRank,
    nations: all.length,
    popularity: player.politics.popularity,
    victories: state.unlockedVictories ? state.unlockedVictories.length : null,
  };
}

/** Game ticks are weeks; the calendar is 1-based like the in-game HUD. */
export function gameDate(tick: number): { year: number; week: number } {
  const t = Math.max(0, Math.floor(tick));
  return { year: Math.floor(t / WEEKS_PER_YEAR) + 1, week: (t % WEEKS_PER_YEAR) + 1 };
}

/** Saves, newest first. `null` while the first read is in flight. */
export function useSaveList(): {
  saves: SaveSummary[] | null;
  refresh: () => Promise<void>;
} {
  const [saves, setSaves] = useState<SaveSummary[] | null>(null);

  const refresh = useCallback(async () => {
    if (!isPersistenceAvailable()) {
      setSaves([]);
      return;
    }
    try {
      setSaves(await listSaves());
    } catch {
      setSaves([]);
    }
  }, []);

  useEffect(() => {
    // One-shot hydration from IndexedDB; state is set from the async result.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return { saves, refresh };
}

// Digests are derived from immutable (id, savedAt) pairs, so they can be
// cached for the lifetime of the page.
const digestCache = new Map<string, SaveDigest | null>();

/**
 * Digest of one save. `undefined` while loading, `null` when the save can't
 * be read (deleted meanwhile, or corrupted).
 */
export function useSaveDigest(save: SaveSummary | null): SaveDigest | null | undefined {
  const key = save ? `${save.id}@${save.savedAt}` : null;
  const [loaded, setLoaded] = useState<{ key: string; digest: SaveDigest | null } | null>(null);

  useEffect(() => {
    if (!save || !key || digestCache.has(key)) return;
    let cancelled = false;
    loadSave(save.id)
      .then((entry) => (entry ? digestSave(entry) : null))
      .catch(() => null)
      .then((digest) => {
        digestCache.set(key, digest);
        if (!cancelled) setLoaded({ key, digest });
      });
    return () => {
      cancelled = true;
    };
  }, [save, key]);

  if (!key) return null;
  if (digestCache.has(key)) return digestCache.get(key);
  return loaded?.key === key ? loaded.digest : undefined;
}

/** Export a save and hand it to the browser as a download. */
export async function downloadSave(save: SaveSummary): Promise<void> {
  const blob = await exportSave(save.id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug(save.name) || save.id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function slug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60);
}

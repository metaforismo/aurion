// Read-only military facts derived from the game state. Where a rule lives
// in the engine without being exported, it is restated here next to a note
// naming the source, so the panel never promises what the engine won't do.

import type { Country, RegionId } from '@aurion/engine';

import { compactNumber } from '../../../lib/format';
import { regionHost, type World } from '../diplomacy/world';

/** Countries the player is at war with. */
export function enemiesOf(w: World): Country[] {
  return w.others.filter((c) => w.relation(c.id).atWar);
}

/** A figure the player only knows roughly: one significant digit, marked ≈. */
export function approx(value: number, locale: string): string {
  if (value <= 0) return '≈ 0';
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return `≈ ${compactNumber(Math.round(value / magnitude) * magnitude, locale, 0)}`;
}

/** Every region of the scenario, in a stable order. */
export function regionsOf(w: World): RegionId[] {
  return [...new Set(Object.values(w.state.countries).map((c) => c.regionId))].sort();
}

export function unitsIn(country: Country, regionId: RegionId): number {
  return country.military.deployedUnits
    .filter((d) => d.regionId === regionId)
    .reduce((sum, d) => sum + d.units, 0);
}

export type RegionAccess =
  | { ok: true; via: 'home' | 'free' | 'ally' | 'war'; host: Country | null }
  | { ok: false; host: Country };

/**
 * Whether the player may send troops into a region. Same rule as the
 * engine's `isDeployAllowed`: own territory and unclaimed regions are open;
 * a foreign region needs an alliance or a war with its host.
 */
export function regionAccess(w: World, regionId: RegionId): RegionAccess {
  const host = regionHost(w.state, regionId);
  if (!host) return { ok: true, via: 'free', host: null };
  if (host.id === w.player.id) return { ok: true, via: 'home', host };
  const rel = w.relation(host.id);
  if (rel.atWar) return { ok: true, via: 'war', host };
  if (rel.treaties.includes('alliance')) return { ok: true, via: 'ally', host };
  return { ok: false, host };
}

/**
 * Regions a tactical warhead may hit: the home region of a country at war
 * with the player, or any region where such a country has troops (engine:
 * `isEnemyRegion`).
 */
export function enemyRegions(w: World): RegionId[] {
  const out = new Set<RegionId>();
  for (const enemy of enemiesOf(w)) {
    out.add(enemy.regionId);
    for (const d of enemy.military.deployedUnits) out.add(d.regionId);
  }
  return [...out].sort();
}

/** Enemy units standing in a region. */
export function hostileUnitsIn(w: World, regionId: RegionId): number {
  return enemiesOf(w).reduce((sum, c) => sum + unitsIn(c, regionId), 0);
}

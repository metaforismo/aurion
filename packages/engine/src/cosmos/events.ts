// Space-age events — scenario-independent decisions that fire once the
// player's megaprojects reach a milestone. They ride the normal event system
// (condition triggers, the engine's effect applier), so a host only has to
// append `COSMOS_EVENTS` to its scenario's event pool.
//
// Copy lives with the host under `cosmosEvent.<id>.{name,desc,a,b}`.

import type { EventDefinition, EventEffect } from '../types.js';

const stat = (name: string, delta: number, multiplier?: number): EventEffect => ({
  type: 'modifyStat',
  target: 'player',
  stat: name,
  delta,
  ...(multiplier !== undefined ? { multiplier } : {}),
});

/** Once per run: the cooldown outlasts any game. */
const ONCE = 1_000_000;

function event(
  id: string,
  expression: string,
  a: EventEffect[],
  b: EventEffect[],
  tag: 'space' | 'crisis' | 'opportunity' = 'space',
): EventDefinition {
  const key = `cosmosEvent.${id}`;
  return {
    id: `event_cosmos_${id}`,
    nameKey: `${key}.name`,
    descriptionKey: `${key}.desc`,
    trigger: { type: 'condition', expression },
    cooldownTicks: ONCE,
    weight: 3,
    tags: [tag, 'space'],
    choices: [
      { labelKey: `${key}.a`, effects: a },
      { labelKey: `${key}.b`, effects: b },
    ],
  };
}

export const COSMOS_EVENTS: readonly EventDefinition[] = [
  event('cheap_power', 'megaprojects contains earth_fusion',
    [stat('politics.popularity', 6), stat('economy.treasury', -3)],
    [stat('economy.weeklyIncome', 0, 1.03), stat('politics.factions.populist.satisfaction', -4)],
    'opportunity'),
  event('pad_accident', 'megaprojects contains earth_spaceport',
    [stat('politics.popularity', 3), stat('economy.treasury', -3)],
    [stat('politics.popularity', -4), stat('science.researchOutput', 0, 1.04)],
    'crisis'),
  event('orbital_tourism', 'megaprojects contains orbit_station',
    [stat('economy.treasury', 5), stat('politics.factions.reformist.satisfaction', -3)],
    [stat('science.researchOutput', 0, 1.06)],
    'opportunity'),
  event('lunar_claim', 'megaprojects contains moon_base',
    [stat('worldTension', -6), stat('politics.factions.army.satisfaction', -4)],
    [stat('politics.popularity', 4), stat('worldTension', 8)]),
  event('helium_rush', 'megaprojects contains moon_helium3',
    [stat('economy.treasury', 8), stat('politics.factions.business.satisfaction', -8)],
    [stat('economy.weeklyIncome', 0, 1.04), stat('politics.factions.populist.satisfaction', -5)],
    'opportunity'),
  event('mars_silence', 'megaprojects contains mars_mission',
    [stat('economy.treasury', -6), stat('politics.popularity', 6)],
    [stat('politics.popularity', -5)],
    'crisis'),
  event('mars_autonomy', 'megaprojects contains mars_city',
    [stat('politics.popularity', 4), stat('politics.factions.reformist.satisfaction', 6), stat('economy.weeklyIncome', 0, 0.98)],
    [stat('politics.factions.reformist.satisfaction', -8), stat('politics.factions.army.satisfaction', 5)]),
  event('type_one_day', 'kardashev >= 1',
    [stat('politics.popularity', 8), stat('economy.treasury', -4)],
    [stat('science.researchOutput', 0, 1.08)],
    'opportunity'),
  event('belt_strike', 'megaprojects contains belt_mining',
    [stat('economy.treasury', -5), stat('politics.factions.populist.satisfaction', 6)],
    [stat('economy.weeklyIncome', 0, 0.97), stat('politics.factions.business.satisfaction', 4)],
    'crisis'),
  event('europa_life', 'megaprojects contains jupiter_europa',
    [stat('worldTension', -10), stat('politics.popularity', 5)],
    [stat('science.researchOutput', 0, 1.1), stat('politics.factions.reformist.satisfaction', -6)],
    'opportunity'),
  event('swarm_shadow', 'megaprojects contains sun_swarm_1',
    [stat('economy.treasury', -8)],
    [stat('politics.popularity', -6), stat('economy.sectors.agriculture', 0, 0.95)],
    'crisis'),
  event('ark_lottery', 'megaprojects contains star_ark',
    [stat('politics.popularity', 6), stat('politics.factions.business.satisfaction', -5)],
    [stat('science.researchOutput', 0, 1.05), stat('politics.factions.populist.satisfaction', -6)]),
] as const;

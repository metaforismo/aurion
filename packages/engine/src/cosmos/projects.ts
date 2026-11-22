// Catalogue of civilisation megaprojects — the long game of Aurion.
//
// The ladder starts on Earth (grids, fusion, a spaceport), climbs to orbit,
// the Moon and Mars, spreads through the asteroid belt and the outer planets,
// and ends with a Dyson sphere and the first interstellar colony. Every
// project is scenario-independent: costs are expressed in "units" (1 unit =
// 1% of the player's GDP at game start) so the same catalogue is balanced
// for a 18-billion island state and a 25-trillion superpower alike.

import type { CosmosProjectDef } from '../types.js';

/** Kardashev rating every civilisation starts from (humanity today ≈ 0.7). */
export const KARDASHEV_START = 0.7;

/**
 * Ordered catalogue. Array order is also the canonical order AI rivals walk
 * the ladder in, so prerequisites must always appear before their dependants.
 */
export const COSMOS_PROJECTS: readonly CosmosProjectDef[] = [
  // ---- Stage 0 — Earth -------------------------------------------------
  {
    id: 'earth_smart_grid', body: 'earth', stage: 0, cost: 6, durationTicks: 10,
    requires: [], effects: { kardashev: 0.01, gdpMul: 1.05 },
  },
  {
    id: 'earth_quantum_net', body: 'earth', stage: 0, cost: 9, durationTicks: 14,
    requires: [], effects: { kardashev: 0.005, gdpMul: 1.04, research: 1.5 },
  },
  {
    id: 'earth_arcologies', body: 'earth', stage: 0, cost: 12, durationTicks: 18,
    requires: ['earth_smart_grid'], effects: { kardashev: 0.005, gdpMul: 1.06, popularity: 4 },
  },
  {
    id: 'earth_fusion', body: 'earth', stage: 0, cost: 18, durationTicks: 26,
    requires: ['earth_smart_grid'], effects: { kardashev: 0.03, gdpMul: 1.1, research: 1, prestige: 6 },
  },
  {
    id: 'earth_spaceport', body: 'earth', stage: 0, cost: 15, durationTicks: 20,
    requires: [], minSpaceTechShare: 0.01, effects: { kardashev: 0.005, gdpMul: 1.03, prestige: 4 },
  },

  // ---- Stage 1 — Low orbit ---------------------------------------------
  {
    id: 'orbit_station', body: 'orbit', stage: 1, cost: 23, durationTicks: 26,
    requires: ['earth_spaceport'], effects: { kardashev: 0.005, research: 2.5, colonists: 12, prestige: 8 },
  },
  {
    id: 'orbit_shipyard', body: 'orbit', stage: 1, cost: 34, durationTicks: 34,
    requires: ['orbit_station'], effects: { kardashev: 0.005, gdpMul: 1.05, slots: 1, colonists: 200 },
  },
  {
    id: 'orbit_solar', body: 'orbit', stage: 1, cost: 41, durationTicks: 36,
    requires: ['orbit_station', 'earth_smart_grid'], effects: { kardashev: 0.04, gdpMul: 1.12 },
  },
  {
    id: 'orbit_elevator', body: 'orbit', stage: 1, cost: 66, durationTicks: 52,
    requires: ['orbit_shipyard'], effects: { kardashev: 0.02, gdpMul: 1.15, prestige: 10 },
  },

  // ---- Stage 2 — The Moon ----------------------------------------------
  {
    id: 'moon_survey', body: 'moon', stage: 2, cost: 26, durationTicks: 16,
    requires: ['earth_spaceport'], minSpaceTechShare: 0.4, effects: { research: 1.5, prestige: 5 },
  },
  {
    id: 'moon_base', body: 'moon', stage: 2, cost: 58, durationTicks: 40,
    requires: ['moon_survey', 'orbit_station'], effects: { kardashev: 0.01, colonists: 150, prestige: 14, research: 2 },
  },
  {
    id: 'moon_helium3', body: 'moon', stage: 2, cost: 89, durationTicks: 48,
    requires: ['moon_base', 'earth_fusion'], effects: { kardashev: 0.05, gdpMul: 1.2 },
  },
  {
    id: 'moon_mass_driver', body: 'moon', stage: 2, cost: 110, durationTicks: 48,
    requires: ['moon_base'], effects: { kardashev: 0.01, gdpMul: 1.08, slots: 1 },
  },
  {
    id: 'moon_city', body: 'moon', stage: 2, cost: 150, durationTicks: 64,
    requires: ['moon_helium3'], effects: { kardashev: 0.01, gdpMul: 1.1, popularity: 5, colonists: 60_000, prestige: 12 },
  },

  // ---- Stage 3 — Mars & the planetary grid -----------------------------
  {
    id: 'mars_mission', body: 'mars', stage: 3, cost: 110, durationTicks: 52,
    requires: ['moon_base'], minSpaceTechShare: 0.7, effects: { research: 3, prestige: 18, colonists: 6 },
  },
  {
    id: 'mars_colony', body: 'mars', stage: 3, cost: 190, durationTicks: 70,
    requires: ['mars_mission', 'orbit_shipyard'], effects: { kardashev: 0.01, gdpMul: 1.08, colonists: 2_500, prestige: 14 },
  },
  {
    id: 'mars_industry', body: 'mars', stage: 3, cost: 300, durationTicks: 80,
    requires: ['mars_colony'], effects: { kardashev: 0.02, gdpMul: 1.22 },
  },
  {
    id: 'mars_city', body: 'mars', stage: 3, cost: 420, durationTicks: 90,
    requires: ['mars_industry'], effects: { kardashev: 0.01, gdpMul: 1.12, popularity: 5, colonists: 1_200_000, prestige: 12 },
  },
  {
    id: 'earth_planetary_grid', body: 'earth', stage: 3, cost: 600, durationTicks: 100,
    requires: ['orbit_solar', 'moon_helium3', 'orbit_elevator'],
    effects: { kardashevFloor: 1, gdpMul: 1.5, popularity: 6, prestige: 30 },
  },
  {
    id: 'mars_terraform', body: 'mars', stage: 3, cost: 1_300, durationTicks: 220,
    requires: ['mars_city', 'earth_planetary_grid'], effects: { kardashev: 0.03, gdpMul: 1.35, colonists: 80_000_000, prestige: 25 },
  },

  // ---- Stage 4 — Belt & outer planets ----------------------------------
  {
    id: 'belt_mining', body: 'belt', stage: 4, cost: 680, durationTicks: 80,
    requires: ['orbit_shipyard', 'mars_mission'], effects: { kardashev: 0.03, gdpMul: 1.4 },
  },
  {
    id: 'belt_ceres', body: 'belt', stage: 4, cost: 990, durationTicks: 100,
    requires: ['belt_mining'], effects: { kardashev: 0.02, gdpMul: 1.15, colonists: 40_000, slots: 1 },
  },
  {
    id: 'jupiter_europa', body: 'jupiter', stage: 4, cost: 1_500, durationTicks: 120,
    requires: ['belt_ceres'], effects: { kardashev: 0.01, research: 8, colonists: 800, prestige: 20 },
  },
  {
    id: 'jupiter_helium', body: 'jupiter', stage: 4, cost: 2_100, durationTicks: 130,
    requires: ['jupiter_europa', 'earth_planetary_grid'], effects: { kardashev: 0.08, gdpMul: 1.45 },
  },
  {
    id: 'saturn_titan', body: 'saturn', stage: 4, cost: 2_700, durationTicks: 140,
    requires: ['jupiter_europa'], effects: { kardashev: 0.03, gdpMul: 1.25, colonists: 300_000, prestige: 20 },
  },

  // ---- Stage 5 — The Sun -----------------------------------------------
  {
    id: 'sun_mercury', body: 'sun', stage: 5, cost: 4_100, durationTicks: 160,
    requires: ['belt_ceres', 'jupiter_helium'], effects: { kardashev: 0.1, gdpMul: 1.5 },
  },
  {
    id: 'sun_swarm_1', body: 'sun', stage: 5, cost: 6_300, durationTicks: 180,
    requires: ['sun_mercury'], effects: { kardashev: 0.25, gdpMul: 1.9, prestige: 30 },
  },
  {
    id: 'sun_swarm_2', body: 'sun', stage: 5, cost: 11_000, durationTicks: 200,
    requires: ['sun_swarm_1'], effects: { kardashev: 0.25, gdpMul: 1.9 },
  },
  {
    id: 'sun_sphere', body: 'sun', stage: 5, cost: 19_000, durationTicks: 240,
    requires: ['sun_swarm_2'], effects: { kardashevFloor: 2, gdpMul: 2.2, popularity: 10, prestige: 50 },
  },

  // ---- Stage 6 — Interstellar ------------------------------------------
  {
    id: 'star_antimatter', body: 'centauri', stage: 6, cost: 14_000, durationTicks: 160,
    requires: ['sun_swarm_1'], effects: { kardashev: 0.02, research: 20 },
  },
  {
    id: 'star_ark', body: 'centauri', stage: 6, cost: 29_000, durationTicks: 240,
    requires: ['star_antimatter', 'saturn_titan'], effects: { kardashev: 0.03, prestige: 40 },
  },
  {
    id: 'star_proxima', body: 'centauri', stage: 6, cost: 48_000, durationTicks: 320,
    requires: ['star_ark', 'sun_sphere'], effects: { kardashev: 0.1, gdpMul: 1.5, colonists: 500_000, prestige: 60 },
  },
] as const;

const BY_ID: ReadonlyMap<string, CosmosProjectDef> = new Map(
  COSMOS_PROJECTS.map((p) => [p.id, p]),
);

export function getCosmosProject(id: string): CosmosProjectDef | undefined {
  return BY_ID.get(id);
}

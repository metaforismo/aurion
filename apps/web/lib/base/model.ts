// What stands on the ground of a colony, worked out from the game state.
// Pure and deterministic: the same colony always lays out the same way, and
// every new project, structure or wave of settlers adds to the base without
// moving what is already there.

import {
  COSMOS_PROJECTS,
  STRUCTURE_KINDS,
  colonyHousing,
  heldSectors,
  structureCount,
  type ColonyBody,
  type GameState,
  type StructureKind,
} from '@aurion/engine';

export type BuildingKind =
  | 'hub'
  | 'pad'
  | 'tower'
  | 'housing'
  | 'dome'
  | 'solar'
  | 'greenhouse'
  | 'extractor'
  | 'driver'
  | 'plant'
  | 'processor'
  | 'site'
  // A capital on Earth.
  | 'capitol'
  | 'skyscraper'
  | 'block'
  | 'factory'
  | 'barracks'
  | 'datacenter'
  | 'arcology'
  | 'reactor'
  | 'pylon'
  | 'gantry'
  | 'antenna'
  | StructureKind;

export type Building = {
  kind: BuildingKind;
  /** Ground position in metres, hub at the origin. */
  x: number;
  z: number;
  /** Heading in radians. */
  rot: number;
};

/** Where a base stands: a colony's world, or the player's capital on Earth. */
export type BaseBody = ColonyBody | 'earth';

export type BaseModel = {
  body: BaseBody;
  population: number;
  capacity: number;
  buildings: Building[];
  /** Radii of the ring roads laid so far. */
  rings: number[];
  /** Figures walking the base, and vehicles driving its roads. */
  people: number;
  rovers: number;
  /** Building sites: cranes turning, work under way. */
  sites: number;
};

/** Ring roads: radius, and how many plots each one has along it. */
export const RINGS: ReadonlyArray<{ radius: number; plots: number }> = [
  // About 32 m of road per plot: room for the largest footprint.
  { radius: 58, plots: 11 },
  { radius: 92, plots: 18 },
  { radius: 126, plots: 25 },
  { radius: 160, plots: 31 },
  { radius: 194, plots: 38 },
];
export const MAX_PEOPLE = 240;
export const MAX_ROVERS = 16;

/** What each megaproject puts on the ground of its world. */
const PROJECT_BUILDINGS: Record<string, BuildingKind[]> = {
  moon_helium3: ['extractor', 'extractor'],
  moon_mass_driver: ['driver'],
  moon_city: ['dome', 'dome'],
  mars_colony: ['greenhouse', 'greenhouse'],
  mars_industry: ['plant', 'plant'],
  mars_city: ['dome', 'dome', 'dome'],
  mars_terraform: ['processor', 'processor', 'processor'],
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Plots in filling order: ring by ring, alternating sides so the base grows evenly. */
function plots(): { x: number; z: number; rot: number; ring: number }[] {
  const out: { x: number; z: number; rot: number; ring: number }[] = [];
  RINGS.forEach((ring, r) => {
    // Step around the ring by a stride coprime with its size, so plots are
    // handed out on alternating sides and each one exactly once.
    let stride = Math.round(ring.plots * 0.38);
    while (gcd(stride, ring.plots) !== 1) stride += 1;
    for (let i = 0; i < ring.plots; i += 1) {
      const order = (i * stride) % ring.plots;
      const angle = (order / ring.plots) * Math.PI * 2 + r * 0.37;
      out.push({ x: Math.cos(angle) * ring.radius, z: Math.sin(angle) * ring.radius, rot: -angle, ring: r });
    }
  });
  return out;
}

const PLOTS = plots();

export function housingUnits(population: number): number {
  return Math.round(4 + 5 * Math.log10(population + 1));
}

export function peopleShown(population: number): number {
  return Math.min(MAX_PEOPLE, Math.round(8 + 22 * Math.log10(population + 1)));
}

/** The base on a world, or null while nobody lives there. */
export function buildBaseModel(state: GameState, body: ColonyBody): BaseModel | null {
  const colony = state.cosmos?.colonies?.[body];
  if (!state.cosmos || !colony) return null;
  const completed = state.cosmos.completed;
  const sectors = heldSectors(state, body).length;

  // The order of this list is the order plots are handed out, so it must
  // only ever grow at the end of each group.
  const wanted: BuildingKind[] = [];
  for (const def of COSMOS_PROJECTS) {
    if (def.body !== body || !completed.includes(def.id)) continue;
    wanted.push(...(PROJECT_BUILDINGS[def.id] ?? []));
  }
  for (const kind of STRUCTURE_KINDS) {
    for (let i = 0; i < structureCount(state, body, kind); i += 1) wanted.push(kind);
  }
  // A solar field per sector held, then homes for the people who are there.
  for (let i = 0; i < Math.max(1, sectors); i += 1) wanted.push('solar');
  for (let i = 0; i < housingUnits(colony.population); i += 1) wanted.push('housing');

  // Work under way: a megaproject being built on this world, a structure
  // going up, a sector being staked out. Each shows as a building site.
  let sites = 0;
  for (const active of state.cosmos.active) {
    if (COSMOS_PROJECTS.find((p) => p.id === active.projectId)?.body === body) sites += 1;
  }
  sites += (state.cosmos.works ?? []).filter((w) => w.body === body).length;
  for (let i = 0; i < sites; i += 1) wanted.push('site');

  const buildings: Building[] = [
    { kind: 'hub', x: 0, z: 0, rot: 0 },
    { kind: 'pad', x: 0, z: -29, rot: 0 },
    { kind: 'tower', x: 19, z: 14, rot: 0 },
  ];
  let outer = 0;
  wanted.slice(0, PLOTS.length).forEach((kind, i) => {
    const plot = PLOTS[i]!;
    outer = Math.max(outer, plot.ring);
    buildings.push({ kind, x: plot.x, z: plot.z, rot: plot.rot });
  });

  return {
    body,
    population: colony.population,
    capacity: colonyHousing(state, body),
    buildings,
    rings: RINGS.slice(0, outer + 1).map((r) => r.radius),
    people: peopleShown(colony.population),
    rovers: Math.min(MAX_ROVERS, 2 + sectors * 2),
    sites,
  };
}

/** What each Earth megaproject adds to the capital. */
const EARTH_PROJECT_BUILDINGS: Record<string, BuildingKind[]> = {
  earth_smart_grid: ['pylon', 'pylon', 'solar'],
  earth_quantum_net: ['datacenter', 'datacenter'],
  earth_arcologies: ['arcology', 'arcology'],
  earth_fusion: ['reactor'],
  earth_spaceport: ['pad', 'gantry'],
  earth_planetary_grid: ['antenna', 'antenna', 'antenna'],
};

/**
 * The player's capital. It is a portrait of the nation: towers follow the
 * size of the economy, factories its industry, labs its research, barracks
 * its army, and every Earth megaproject leaves its mark.
 */
export function buildCapitalModel(state: GameState): BaseModel | null {
  const player = state.countries[state.playerCountryId];
  if (!player) return null;
  const completed = state.cosmos?.completed ?? [];
  const active = state.cosmos?.active ?? [];
  // How much the economy has grown since the start (1 = unchanged).
  const unit = state.cosmos?.unit ?? player.economy.gdp * 0.01;
  const growth = unit > 0 ? player.economy.gdp / (unit * 100) : 1;
  const count = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n)));

  const wanted: BuildingKind[] = [];
  let pad = false;
  for (const def of COSMOS_PROJECTS) {
    if (def.body !== 'earth' || !completed.includes(def.id)) continue;
    const kinds = EARTH_PROJECT_BUILDINGS[def.id] ?? [];
    if (kinds.includes('pad')) pad = true;
    wanted.push(...kinds.filter((k) => k !== 'pad'));
  }
  const towers = count(5 + 7 * Math.log2(growth + 1), 26);
  const factories = count(2 + player.economy.sectors.industry * 12 * Math.sqrt(growth), 14);
  const labs = count(1 + player.science.researchOutput / 3, 8);
  const barracks = count(player.military.armySize / 4000, 6);
  // Interleave, so districts mix instead of forming one ring of each kind.
  const groups: BuildingKind[][] = [
    Array<BuildingKind>(towers).fill('skyscraper'),
    Array<BuildingKind>(factories).fill('factory'),
    Array<BuildingKind>(labs).fill('lab'),
    Array<BuildingKind>(barracks).fill('barracks'),
  ];
  for (let i = 0; groups.some((g) => i < g.length); i += 1) {
    for (const g of groups) if (i < g.length) wanted.push(g[i]!);
  }
  let sites = 0;
  for (const a of active) if (COSMOS_PROJECTS.find((p) => p.id === a.projectId)?.body === 'earth') sites += 1;
  if (state.territoryWork) sites += 1;
  for (let i = 0; i < sites; i += 1) wanted.push('site');
  const homes = count(10 + 6 * Math.log10(player.population + 1), 60);
  for (let i = 0; i < homes; i += 1) wanted.push('block');

  const buildings: Building[] = [
    { kind: 'capitol', x: 0, z: 0, rot: 0 },
    { kind: 'tower', x: 19, z: 14, rot: 0 },
  ];
  if (pad) buildings.push({ kind: 'pad', x: 0, z: -29, rot: 0 });
  let outer = 0;
  wanted.slice(0, PLOTS.length).forEach((kind, i) => {
    const plot = PLOTS[i]!;
    outer = Math.max(outer, plot.ring);
    buildings.push({ kind, x: plot.x, z: plot.z, rot: plot.rot });
  });
  return {
    body: 'earth',
    population: player.population,
    capacity: player.population,
    buildings,
    rings: RINGS.slice(0, outer + 1).map((r) => r.radius),
    people: peopleShown(player.population),
    rovers: Math.min(MAX_ROVERS, 6 + Math.round(4 * Math.log2(growth + 1))),
    sites,
  };
}

/** Changes whenever the base needs rebuilding on screen. */
export function baseSignature(model: BaseModel): string {
  return `${model.body}|${model.buildings.map((b) => b.kind.slice(0, 3)).join('')}|${model.people}|${model.rovers}`;
}

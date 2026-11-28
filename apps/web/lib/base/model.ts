// What stands on the ground of a colony, worked out from the game state.
// Pure and deterministic: the same colony always lays out the same way, and
// every new project, structure or wave of settlers adds to the base without
// moving what is already there.

import { layoutCity, type CityLayout, type LotKind } from './city';
import {
  COSMOS_PROJECTS,
  STRUCTURE_KINDS,
  WORKS,
  workProgress,
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
  | 'office'
  | 'apartment'
  | 'house'
  | 'warehouse'
  | 'park'
  | 'solarFarm'
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
  /** For the capital: the city plan the 3D view is built from. */
  city?: CityLayout;
  /** For the capital: how far along each national work being built is (0..1). */
  workProgress?: Record<string, number>;
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

const LOT_KIND: Record<LotKind, BuildingKind> = {
  capitol: 'capitol',
  tower: 'skyscraper',
  office: 'office',
  apartment: 'apartment',
  house: 'house',
  factory: 'factory',
  warehouse: 'warehouse',
  lab: 'lab',
  barracks: 'barracks',
  arcology: 'arcology',
  datacenter: 'datacenter',
  site: 'site',
};

/**
 * The player's capital: a city that is a portrait of the nation. Towers
 * follow the size of the economy, the industrial quarter its industry, the
 * campus its research, the barracks its army, the suburbs its population,
 * and every Earth megaproject has its place on the outskirts.
 */
export function buildCapitalModel(state: GameState): BaseModel | null {
  const player = state.countries[state.playerCountryId];
  if (!player) return null;
  const completed = state.cosmos?.completed ?? [];
  const active = state.cosmos?.active ?? [];
  const unit = state.cosmos?.unit ?? player.economy.gdp * 0.01;
  const earth = (id: string) => COSMOS_PROJECTS.find((p) => p.id === id)?.body === 'earth';
  const city = layoutCity({
    growth: unit > 0 ? player.economy.gdp / (unit * 100) : 1,
    population: player.population,
    industry: player.economy.sectors.industry,
    research: player.science.researchOutput,
    army: player.military.armySize,
    projects: completed.filter(earth),
    building: active.map((a) => a.projectId).filter(earth),
    extraSites: state.territoryWork ? 1 : 0,
    seed: player.id,
    works: WORKS.map((w) => ({
      id: w.id,
      level: state.works?.levels[w.id] ?? 0,
      building: state.works?.active.find((b) => b.workId === w.id)?.toLevel ?? null,
    })),
  });
  const workProgressById: Record<string, number> = {};
  for (const b of state.works?.active ?? []) workProgressById[b.workId] = workProgress(b);
  const buildings: Building[] = city.lots.map((l) => ({ kind: LOT_KIND[l.kind], x: l.x, z: l.z, rot: 0 }));
  for (const s of city.specials) {
    buildings.push({
      kind: s.site ? 'site' : s.kind === 'reactor' ? 'reactor' : s.kind === 'spaceport' ? 'gantry' : s.kind === 'solarFarm' ? 'solarFarm' : 'antenna',
      x: s.x,
      z: s.z,
      rot: 0,
    });
  }
  return {
    body: 'earth',
    population: player.population,
    capacity: player.population,
    buildings,
    rings: [],
    people: 0,
    rovers: 0,
    sites: buildings.filter((b) => b.kind === 'site').length,
    city,
    workProgress: workProgressById,
  };
}

/** Changes whenever the base needs rebuilding on screen. */
export function baseSignature(model: BaseModel): string {
  const works = model.city?.works.map((w) => `${w.id}${w.level}${w.building ?? ''}`).join(',') ?? '';
  return `${model.body}|${model.buildings.map((b) => b.kind.slice(0, 3)).join('')}|${model.people}|${model.rovers}|${works}`;
}

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
  | StructureKind;

export type Building = {
  kind: BuildingKind;
  /** Ground position in metres, hub at the origin. */
  x: number;
  z: number;
  /** Heading in radians. */
  rot: number;
};

export type BaseModel = {
  body: ColonyBody;
  population: number;
  capacity: number;
  buildings: Building[];
  /** Radii of the ring roads laid so far. */
  rings: number[];
  /** Figures walking the base, and vehicles driving its roads. */
  people: number;
  rovers: number;
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
  };
}

/** Changes whenever the base needs rebuilding on screen. */
export function baseSignature(model: BaseModel): string {
  return `${model.body}|${model.buildings.map((b) => b.kind.slice(0, 2)).join('')}|${model.people}|${model.rovers}`;
}

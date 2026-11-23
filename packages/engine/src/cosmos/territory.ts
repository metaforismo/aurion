// Territory on other worlds. The Moon and Mars are divided into twenty
// sectors each. A colony starts with the sector its first settlement stands
// on; from there the player claims neighbouring sectors and raises
// structures on them. Rival space powers claim land too, so it runs out.

import { createRng } from '../rng.js';
import type {
  ApplyActionResult,
  ColonyBody,
  CosmosState,
  CountryId,
  GameState,
  SectorHolding,
  StructureKind,
  TerritoryWork,
} from '../types.js';
import { COSMOS_PROJECTS } from './projects.js';
import { PROJECT_SITES } from './sites.js';

export type SectorDef = {
  id: string;
  body: ColonyBody;
  /** Proper name of the best-known feature in the sector (Latin: not translated). */
  name: string;
  /** Bounds in degrees: longitude east, latitude north. */
  lon0: number;
  lon1: number;
  lat0: number;
  lat1: number;
  neighbours: string[];
};

const COLUMNS = 6;
const BANDS: ReadonlyArray<{ key: 'n' | 'e' | 's'; lat0: number; lat1: number }> = [
  { key: 'n', lat0: 20, lat1: 60 },
  { key: 'e', lat0: -20, lat1: 20 },
  { key: 's', lat0: -60, lat1: -20 },
];

/** Names by band (north, equatorial, south) and column, west to east from 180°W. */
const NAMES: Record<ColonyBody, { n: string[]; e: string[]; s: string[]; np: string; sp: string }> = {
  moon: {
    n: ['Birkhoff', 'Lorentz', 'Mare Imbrium', 'Mare Serenitatis', 'Mare Humboldtianum', 'Mare Moscoviense'],
    e: ['Korolev', 'Mare Orientale', 'Oceanus Procellarum', 'Mare Tranquillitatis', 'Mare Smythii', 'Mendeleev'],
    s: ['Apollo', 'Mendel-Rydberg', 'Mare Humorum', 'Janssen', 'Mare Australe', 'Mare Ingenii'],
    np: 'Peary',
    sp: 'Shackleton',
  },
  mars: {
    n: ['Arcadia Planitia', 'Alba Mons', 'Acidalia Planitia', 'Arabia Terra', 'Utopia Planitia', 'Phlegra Montes'],
    e: ['Olympus Mons', 'Tharsis', 'Valles Marineris', 'Terra Sabaea', 'Isidis Planitia', 'Elysium Planitia'],
    s: ['Terra Sirenum', 'Solis Planum', 'Argyre Planitia', 'Hellespontus Montes', 'Hellas Planitia', 'Terra Cimmeria'],
    np: 'Planum Boreum',
    sp: 'Planum Australe',
  },
};

function buildSectors(body: ColonyBody): SectorDef[] {
  const names = NAMES[body];
  const width = 360 / COLUMNS;
  const id = (band: string, col: number) => `${body}_${band}${col}`;
  const out: SectorDef[] = [];
  BANDS.forEach((band, row) => {
    for (let col = 0; col < COLUMNS; col += 1) {
      const neighbours = [id(band.key, (col + 1) % COLUMNS), id(band.key, (col + COLUMNS - 1) % COLUMNS)];
      neighbours.push(row === 0 ? `${body}_np` : id(BANDS[row - 1]!.key, col));
      neighbours.push(row === BANDS.length - 1 ? `${body}_sp` : id(BANDS[row + 1]!.key, col));
      out.push({
        id: id(band.key, col),
        body,
        name: names[band.key][col]!,
        lon0: -180 + col * width,
        lon1: -180 + (col + 1) * width,
        lat0: band.lat0,
        lat1: band.lat1,
        neighbours,
      });
    }
  });
  const all = (band: string) => Array.from({ length: COLUMNS }, (_, col) => id(band, col));
  out.push({ id: `${body}_np`, body, name: names.np, lon0: -180, lon1: 180, lat0: 60, lat1: 90, neighbours: all('n') });
  out.push({ id: `${body}_sp`, body, name: names.sp, lon0: -180, lon1: 180, lat0: -90, lat1: -60, neighbours: all('s') });
  return out;
}

export const SECTORS: Readonly<Record<ColonyBody, readonly SectorDef[]>> = {
  moon: buildSectors('moon'),
  mars: buildSectors('mars'),
};

export function getSector(body: ColonyBody, id: string): SectorDef | undefined {
  return SECTORS[body].find((s) => s.id === id);
}

/** The sector under a point of the surface. */
export function sectorAt(body: ColonyBody, lon: number, lat: number): SectorDef {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  return (
    SECTORS[body].find((s) => lat >= s.lat0 && lat < s.lat1 && wrapped >= s.lon0 && wrapped < s.lon1) ??
    SECTORS[body][SECTORS[body].length - (lat >= 0 ? 2 : 1)]!
  );
}

/** Centre of a sector, for labels and for placing structures. */
export function sectorCentre(sector: SectorDef): { lon: number; lat: number } {
  if (sector.lat1 === 90) return { lon: 0, lat: 78 };
  if (sector.lat0 === -90) return { lon: 0, lat: -78 };
  return { lon: (sector.lon0 + sector.lon1) / 2, lat: (sector.lat0 + sector.lat1) / 2 };
}

// ---------------------------------------------------------------------------
// Structures
// ---------------------------------------------------------------------------

export const STRUCTURE_KINDS: readonly StructureKind[] = ['habitat', 'lab', 'mine', 'foundry'];
/** Structures a sector has room for. */
export const SECTOR_SLOTS = 2;

/** Cost of a first claim or structure, in cosmos units, and how long it takes. */
const BASE: Record<ColonyBody, { claim: number; build: number; claimTicks: number; buildTicks: number }> = {
  moon: { claim: 10, build: 8, claimTicks: 16, buildTicks: 12 },
  mars: { claim: 24, build: 18, claimTicks: 26, buildTicks: 20 },
};
/** Each sector already held makes the next claim this much dearer. */
export const CLAIM_COST_GROWTH = 0.3;
/** Each structure of a kind already built makes the next of that kind this much dearer. */
export const BUILD_COST_GROWTH = 0.2;

/** Housing each extra sector, and each habitat, adds as a share of what the projects provide. */
export const SECTOR_HOUSING_SHARE = 0.08;
export const HABITAT_HOUSING_SHARE = 0.2;
/** What a lab, mine or foundry yields per point of colony size (see `colonySize`). */
export const STRUCTURE_YIELD = { lab: 0.25, mine: 0.01, foundry: 0.008 } as const;
/** Weekly chance that some rival space power claims a sector on a body. */
export const RIVAL_CLAIM_CHANCE_PER_TICK = 1 / 45;

function sectorsOf(cosmos: CosmosState | undefined, body: ColonyBody): Record<string, SectorHolding> {
  return cosmos?.sectors?.[body] ?? {};
}

/** Sectors a country holds on a body. */
export function heldSectors(state: GameState, body: ColonyBody, owner: CountryId = state.playerCountryId): string[] {
  return Object.entries(sectorsOf(state.cosmos, body))
    .filter(([, h]) => h.owner === owner)
    .map(([id]) => id);
}

/** How many structures of a kind the player has on a body. */
export function structureCount(state: GameState, body: ColonyBody, kind: StructureKind): number {
  let n = 0;
  for (const h of Object.values(sectorsOf(state.cosmos, body))) {
    if (h.owner !== state.playerCountryId) continue;
    n += h.structures.filter((s) => s === kind).length;
  }
  return n;
}

export function claimCost(state: GameState, body: ColonyBody): number {
  const unit = state.cosmos?.unit ?? 0;
  const held = heldSectors(state, body).length;
  return Math.round(BASE[body].claim * (1 + CLAIM_COST_GROWTH * Math.max(0, held - 1)) * unit);
}

export function buildCost(state: GameState, body: ColonyBody, kind: StructureKind): number {
  const unit = state.cosmos?.unit ?? 0;
  return Math.round(BASE[body].build * (1 + BUILD_COST_GROWTH * structureCount(state, body, kind)) * unit);
}

export function claimDuration(body: ColonyBody): number {
  return BASE[body].claimTicks;
}
export function buildDuration(body: ColonyBody): number {
  return BASE[body].buildTicks;
}

/** The sector the colony was founded in: where its first inhabited project stands. */
export function homeSector(completed: readonly string[], body: ColonyBody): SectorDef | null {
  for (const def of COSMOS_PROJECTS) {
    if (def.body !== body || !completed.includes(def.id) || !(def.effects.colonists ?? 0)) continue;
    const site = PROJECT_SITES[def.id];
    if (site) return sectorAt(body, site.lon, site.lat);
  }
  return null;
}

/** Extra housing from land and habitats, as a multiplier on the projects' housing. */
export function housingMultiplier(state: GameState, body: ColonyBody): number {
  const sectors = heldSectors(state, body).length;
  return (
    1 +
    SECTOR_HOUSING_SHARE * Math.max(0, sectors - 1) +
    HABITAT_HOUSING_SHARE * structureCount(state, body, 'habitat')
  );
}

export type SectorStatus = {
  def: SectorDef;
  owner: CountryId | null;
  structures: StructureKind[];
  /** A claim or a structure under way here. */
  work: TerritoryWork | null;
  /** Free, and next to land the player already holds. */
  claimable: boolean;
};

export function getSectorStatus(state: GameState, body: ColonyBody): SectorStatus[] {
  const holdings = sectorsOf(state.cosmos, body);
  const mine = new Set(heldSectors(state, body));
  const works = state.cosmos?.works ?? [];
  return SECTORS[body].map((def) => {
    const holding = holdings[def.id];
    return {
      def,
      owner: holding?.owner ?? null,
      structures: holding?.structures ?? [],
      work: works.find((w) => w.body === body && w.sectorId === def.id) ?? null,
      claimable: !holding && def.neighbours.some((n) => mine.has(n)),
    };
  });
}

/** One work at a time per world. */
export function territoryBusy(state: GameState, body: ColonyBody): boolean {
  return (state.cosmos?.works ?? []).some((w) => w.body === body);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function pay(state: GameState, cost: number): GameState | null {
  const player = state.countries[state.playerCountryId];
  if (!player || player.economy.treasury < cost) return null;
  return {
    ...state,
    countries: {
      ...state.countries,
      [player.id]: { ...player, economy: { ...player.economy, treasury: player.economy.treasury - cost } },
    },
  };
}

function withWork(state: GameState, work: TerritoryWork): GameState {
  return { ...state, cosmos: { ...state.cosmos!, works: [...(state.cosmos!.works ?? []), work] } };
}

export function applyClaimSector(
  state: GameState,
  action: { type: 'claimSector'; body: ColonyBody; sectorId: string },
  countryId: CountryId,
): ApplyActionResult {
  if (countryId !== state.playerCountryId) return { state, errors: ['errors.territory.playerOnly'] };
  if (!state.cosmos?.colonies?.[action.body]) return { state, errors: ['errors.territory.noColony'] };
  const status = getSectorStatus(state, action.body).find((s) => s.def.id === action.sectorId);
  if (!status) return { state, errors: ['errors.territory.unknownSector'] };
  if (status.owner) return { state, errors: ['errors.territory.taken'] };
  if (!status.claimable) return { state, errors: ['errors.territory.notAdjacent'] };
  if (territoryBusy(state, action.body)) return { state, errors: ['errors.territory.busy'] };
  const paid = pay(state, claimCost(state, action.body));
  if (!paid) return { state, errors: ['errors.territory.insufficientTreasury'] };
  return {
    state: withWork(paid, {
      kind: 'claim',
      body: action.body,
      sectorId: action.sectorId,
      remainingTicks: claimDuration(action.body),
    }),
    errors: [],
  };
}

export function applyBuildStructure(
  state: GameState,
  action: { type: 'buildStructure'; body: ColonyBody; sectorId: string; structure: StructureKind },
  countryId: CountryId,
): ApplyActionResult {
  if (countryId !== state.playerCountryId) return { state, errors: ['errors.territory.playerOnly'] };
  if (!STRUCTURE_KINDS.includes(action.structure)) return { state, errors: ['errors.territory.unknownStructure'] };
  const holding = sectorsOf(state.cosmos, action.body)[action.sectorId];
  if (!holding || holding.owner !== state.playerCountryId) return { state, errors: ['errors.territory.notYours'] };
  if (holding.structures.length >= SECTOR_SLOTS) return { state, errors: ['errors.territory.noSlot'] };
  if (territoryBusy(state, action.body)) return { state, errors: ['errors.territory.busy'] };
  const paid = pay(state, buildCost(state, action.body, action.structure));
  if (!paid) return { state, errors: ['errors.territory.insufficientTreasury'] };
  return {
    state: withWork(paid, {
      kind: 'build',
      body: action.body,
      sectorId: action.sectorId,
      structure: action.structure,
      remainingTicks: buildDuration(action.body),
    }),
    errors: [],
  };
}

// ---------------------------------------------------------------------------
// Weekly step
// ---------------------------------------------------------------------------

const BODIES: readonly ColonyBody[] = ['moon', 'mars'];
/** The project that puts a rival's people on a body. */
const RIVAL_FOOTHOLD: Record<ColonyBody, string> = { moon: 'moon_base', mars: 'mars_colony' };

/**
 * Grant the home sector when a colony is founded, advance the player's
 * works, and let rivals with a foothold take free land.
 */
export function tickTerritory(state: GameState): GameState {
  const cosmos = state.cosmos;
  if (!cosmos) return state;
  let sectors = cosmos.sectors;
  let works = cosmos.works;
  let changed = false;
  const setHolding = (body: ColonyBody, id: string, holding: SectorHolding) => {
    sectors = { ...(sectors ?? {}), [body]: { ...(sectors?.[body] ?? {}), [id]: holding } };
    changed = true;
  };

  for (const body of BODIES) {
    if (!cosmos.colonies?.[body]) continue;
    const mine = Object.values(sectors?.[body] ?? {}).some((h) => h.owner === state.playerCountryId);
    if (mine) continue;
    const home = homeSector(cosmos.completed, body);
    // The player's own base always has its ground, whoever was there first.
    if (home) setHolding(body, home.id, { owner: state.playerCountryId, structures: [] });
  }

  if (works && works.length > 0) {
    const remaining: TerritoryWork[] = [];
    for (const work of works) {
      if (work.remainingTicks > 1) {
        remaining.push({ ...work, remainingTicks: work.remainingTicks - 1 });
        continue;
      }
      const current = sectors?.[work.body]?.[work.sectorId];
      if (work.kind === 'claim') {
        // A rival may have got there while the claim was being staked.
        if (!current) setHolding(work.body, work.sectorId, { owner: state.playerCountryId, structures: [] });
      } else if (current && current.owner === state.playerCountryId && work.structure) {
        setHolding(work.body, work.sectorId, { ...current, structures: [...current.structures, work.structure] });
      }
    }
    works = remaining;
    changed = true;
  }

  // Rivals: one roll a week per body, on a stream of its own.
  const rng = createRng(`${state.rngSeed}::territory::${state.tick}`);
  for (const body of BODIES) {
    if (rng.next() >= RIVAL_CLAIM_CHANCE_PER_TICK) continue;
    const powers = Object.entries(cosmos.rivals)
      .filter(([, r]) => r.completed.includes(RIVAL_FOOTHOLD[body]))
      .map(([id]) => id)
      .sort();
    if (powers.length === 0) continue;
    const rival = rng.pick(powers);
    const holdings = sectors?.[body] ?? {};
    const reserved = new Set((works ?? []).filter((w) => w.body === body && w.kind === 'claim').map((w) => w.sectorId));
    const free = SECTORS[body].filter((s) => !holdings[s.id] && !reserved.has(s.id));
    if (free.length === 0) continue;
    const theirs = new Set(Object.entries(holdings).filter(([, h]) => h.owner === rival).map(([id]) => id));
    // They grow outward from what they hold; a newcomer lands anywhere free.
    const adjacent = free.filter((s) => s.neighbours.some((n) => theirs.has(n)));
    const target = rng.pick(theirs.size > 0 && adjacent.length > 0 ? adjacent : free);
    setHolding(body, target.id, { owner: rival, structures: [] });
  }

  return changed ? { ...state, cosmos: { ...cosmos, sectors, works } } : state;
}

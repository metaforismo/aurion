// Wars with an outcome. Every war keeps a running score from the battles
// fought and the capitals occupied; when either side makes peace, the score
// decides the terms: a draw, reparations, or capitulation.

import { clamp } from '../actions/helpers.js';
import { createRng } from '../rng.js';
import { cedeProtectorate } from '../territory/earth.js';
import type { Country, CountryId, GameState, PeaceRecord, PeaceTier, Relation, WarState } from '../types.js';

/** Score (0..100) from which the leading side can demand reparations. */
export const WAR_REPARATIONS_SCORE = 20;
/** Score from which the losing side capitulates. */
export const WAR_CAPITULATION_SCORE = 60;
/** Score moved by destroying a force as large as both armies at the outbreak. */
export const WAR_SCORE_PER_SCALE = 150;
/** Weekly score for holding the enemy's home region against its garrison. */
export const WAR_OCCUPATION_SCORE_PER_TICK = 0.6;
/** Weekly score the stronger side gains at full superiority, with no battle fought. */
export const WAR_PRESSURE_SCORE_PER_TICK = 0.5;
/** Weekly popularity both governments lose while the war lasts. */
export const WAR_WEARINESS_PER_TICK = 0.04;
/** Weeks of the loser's income paid as reparations, by tier. */
export const WAR_REPARATION_WEEKS: Record<PeaceTier, number> = { white: 0, reparations: 26, capitulation: 78 };
/** Share of the loser's GDP that changes hands on capitulation. */
export const WAR_CAPITULATION_GDP_SHARE = 0.03;
/** Weeks after a peace during which the two sides cannot go back to war. */
export const WAR_TRUCE_TICKS = 104;
const PEACE_LOG_LIMIT = 24;

export function warKey(a: CountryId, b: CountryId): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function totalForces(c: Country | undefined): number {
  if (!c) return 0;
  return c.military.armySize + c.military.deployedUnits.reduce((sum, d) => sum + d.units, 0);
}

function newWar(state: GameState, a: CountryId, b: CountryId): WarState {
  const [first, second] = a < b ? [a, b] : [b, a];
  return {
    a: first,
    b: second,
    startedAtTick: state.tick,
    score: 0,
    lossesA: 0,
    lossesB: 0,
    scale: Math.max(1, totalForces(state.countries[first]) + totalForces(state.countries[second])),
  };
}

/** Start tracking a war (idempotent). Called when war is declared. */
export function openWar(state: GameState, a: CountryId, b: CountryId): GameState {
  const key = warKey(a, b);
  if (state.wars?.[key]) return state;
  return { ...state, wars: { ...(state.wars ?? {}), [key]: newWar(state, a, b) } };
}

/** Wars in progress, creating records for any the state does not track yet. */
function syncedWars(state: GameState): Record<string, WarState> {
  const wars: Record<string, WarState> = {};
  for (const rel of Object.values(state.relations)) {
    if (!rel.atWar) continue;
    const key = warKey(rel.countryA, rel.countryB);
    wars[key] = state.wars?.[key] ?? newWar(state, rel.countryA, rel.countryB);
  }
  return wars;
}

/** Book the losses of one skirmish; killing more than you lose moves the score your way. */
export function recordBattle(
  wars: Record<string, WarState>,
  x: CountryId,
  y: CountryId,
  xLoss: number,
  yLoss: number,
): void {
  const key = warKey(x, y);
  const war = wars[key];
  if (!war) return;
  const [aLoss, bLoss] = war.a === x ? [xLoss, yLoss] : [yLoss, xLoss];
  wars[key] = {
    ...war,
    lossesA: war.lossesA + aLoss,
    lossesB: war.lossesB + bLoss,
    score: clamp(war.score + ((bLoss - aLoss) / war.scale) * WAR_SCORE_PER_SCALE, -100, 100),
  };
}

/** True when `occupier` has more troops in `defender`'s home region than its garrison. */
function holdsHomeRegion(occupier: Country, defender: Country): boolean {
  const region = defender.regionId;
  const hostile = occupier.military.deployedUnits
    .filter((d) => d.regionId === region)
    .reduce((sum, d) => sum + d.units, 0);
  if (hostile <= 0) return false;
  const garrison =
    defender.military.armySize +
    defender.military.deployedUnits.filter((d) => d.regionId === region).reduce((sum, d) => sum + d.units, 0);
  return hostile > garrison;
}

/**
 * Weekly upkeep of every war: battle losses booked this tick (`battles`),
 * occupation pressure, and the weariness of both home fronts.
 */
export function tickWars(
  state: GameState,
  battles: ReadonlyArray<{ x: CountryId; y: CountryId; xLoss: number; yLoss: number }> = [],
  /** Combat multiplier of a country (doctrine, sea and air support). */
  powerOf: (c: Country) => number = () => 1,
): GameState {
  const wars = syncedWars(state);
  const keys = Object.keys(wars);
  if (keys.length === 0) {
    return state.wars && Object.keys(state.wars).length > 0 ? { ...state, wars: {} } : state;
  }
  for (const b of battles) recordBattle(wars, b.x, b.y, b.xLoss, b.yLoss);

  const countries: Record<CountryId, Country> = {};
  const get = (id: CountryId) => countries[id] ?? state.countries[id];
  for (const key of keys) {
    const war = wars[key]!;
    const a = get(war.a);
    const b = get(war.b);
    if (!a || !b) continue;
    let score = war.score;
    // Blockade, raids, border pressure: without a single pitched battle the
    // stronger military slowly gets the upper hand.
    const pa = totalForces(a) * powerOf(a);
    const pb = totalForces(b) * powerOf(b);
    if (pa + pb > 0) score += ((pa - pb) / (pa + pb)) * WAR_PRESSURE_SCORE_PER_TICK;
    if (holdsHomeRegion(a, b)) score += WAR_OCCUPATION_SCORE_PER_TICK;
    if (holdsHomeRegion(b, a)) score -= WAR_OCCUPATION_SCORE_PER_TICK;
    wars[key] = { ...war, score: clamp(score, -100, 100) };
    for (const c of [a, b]) {
      countries[c.id] = {
        ...c,
        politics: { ...c.politics, popularity: clamp(c.politics.popularity - WAR_WEARINESS_PER_TICK, 0, 100) },
      };
    }
  }
  return { ...state, wars, countries: { ...state.countries, ...countries } };
}

/** The war between two countries, if they are fighting one. */
export function warBetween(state: GameState, x: CountryId, y: CountryId): WarState | undefined {
  return state.wars?.[warKey(x, y)];
}

/** War score from `me`'s side: positive when `me` is winning. */
export function warScoreFor(state: GameState, me: CountryId, other: CountryId): number {
  const war = warBetween(state, me, other);
  if (!war) return 0;
  return war.a === me ? war.score : -war.score;
}

export type PeaceTerms = {
  tier: PeaceTier;
  /** Null for a draw. */
  winner: CountryId | null;
  loser: CountryId | null;
  /** Cash the loser pays the winner. */
  reparations: number;
  /** GDP that moves from loser to winner (capitulation only). */
  gdpTransfer: number;
};

/** What peace would cost right now, whoever asks for it. */
export function peaceTerms(state: GameState, x: CountryId, y: CountryId): PeaceTerms {
  const score = warScoreFor(state, x, y);
  const lead = Math.abs(score);
  if (lead < WAR_REPARATIONS_SCORE) {
    return { tier: 'white', winner: null, loser: null, reparations: 0, gdpTransfer: 0 };
  }
  const winner = score > 0 ? x : y;
  const loser = score > 0 ? y : x;
  const tier: PeaceTier = lead >= WAR_CAPITULATION_SCORE ? 'capitulation' : 'reparations';
  const l = state.countries[loser];
  const weekly = l ? Math.max(l.economy.weeklyIncome, l.economy.gdp / 400) : 0;
  return {
    tier,
    winner,
    loser,
    // A loser pays what it has: reparations never push a treasury into debt.
    reparations: Math.round(
      Math.min(weekly * WAR_REPARATION_WEEKS[tier], Math.max(0, l?.economy.treasury ?? 0)),
    ),
    gdpTransfer: tier === 'capitulation' && l ? Math.round(l.economy.gdp * WAR_CAPITULATION_GDP_SHARE) : 0,
  };
}

const POPULARITY_SWING: Record<PeaceTier, { winner: number; loser: number }> = {
  white: { winner: 2, loser: 2 },
  reparations: { winner: 3, loser: -4 },
  capitulation: { winner: 6, loser: -10 },
};

/**
 * End the war between `x` and `y` on the terms the score dictates. Returns
 * the new state and relation; the caller stores the relation.
 */
export function concludePeace(
  state: GameState,
  relation: Relation,
  x: CountryId,
  y: CountryId,
): { state: GameState; relation: Relation } {
  const terms = peaceTerms(state, x, y);
  const countries = { ...state.countries };
  const adjust = (id: CountryId, cash: number, gdp: number, popularity: number) => {
    const c = countries[id];
    if (!c) return;
    countries[id] = {
      ...c,
      economy: { ...c.economy, treasury: c.economy.treasury + cash, gdp: Math.max(0, c.economy.gdp + gdp) },
      politics: { ...c.politics, popularity: clamp(c.politics.popularity + popularity, 0, 100) },
    };
  };
  const swing = POPULARITY_SWING[terms.tier];
  if (terms.winner && terms.loser) {
    adjust(terms.winner, terms.reparations, terms.gdpTransfer, swing.winner);
    adjust(terms.loser, -terms.reparations, -terms.gdpTransfer, swing.loser);
  } else {
    adjust(x, 0, 0, swing.winner);
    adjust(y, 0, 0, swing.loser);
  }

  // On a capitulation the loser's latest protectorate changes hands.
  let territories = state.territories;
  let ceded: string | null = null;
  if (terms.tier === 'capitulation' && terms.winner && terms.loser) {
    const spoils = cedeProtectorate({ ...state, territories }, terms.loser, terms.winner);
    territories = spoils.state.territories;
    ceded = spoils.ceded;
  }

  const wars = { ...(state.wars ?? {}) };
  const war = wars[warKey(x, y)];
  delete wars[warKey(x, y)];
  const record: PeaceRecord = {
    a: relation.countryA,
    b: relation.countryB,
    endedAtTick: state.tick,
    startedAtTick: war?.startedAtTick ?? state.tick,
    tier: terms.tier,
    winner: terms.winner,
    reparations: terms.reparations,
    gdpTransfer: terms.gdpTransfer,
    proposedBy: x,
    ceded,
  };
  return {
    state: {
      ...state,
      countries,
      wars,
      ...(territories ? { territories } : {}),
      peaceLog: [...(state.peaceLog ?? []), record].slice(-PEACE_LOG_LIMIT),
    },
    relation: {
      ...relation,
      atWar: false,
      // A dictated peace leaves more bitterness than a draw.
      attitude: clamp(relation.attitude + (terms.tier === 'white' ? 15 : terms.tier === 'reparations' ? 8 : 0), -100, 100),
      truceUntilTick: state.tick + WAR_TRUCE_TICKS,
    },
  };
}

/** Weeks a war must last before the losing AI side asks for terms. */
export const WAR_MIN_WEEKS_BEFORE_SUING = 26;
/** Weeks after which a war nobody is winning is called off. */
export const WAR_STALEMATE_WEEKS = 104;

/**
 * AI governments end their wars: the side far enough ahead dictates terms,
 * the side that is losing asks for them, and a war going nowhere is called
 * off. Kept outside the AI's action scoring so wars reliably end.
 */
export function tickWarDiplomacy(state: GameState): GameState {
  const wars = Object.values(state.wars ?? {});
  if (wars.length === 0) return state;
  const rng = createRng(`${state.rngSeed}::warDiplomacy::${state.tick}`);
  let next = state;
  for (const war of wars) {
    const key = warKey(war.a, war.b);
    const relation = next.relations[key as keyof typeof next.relations];
    if (!relation?.atWar) continue;
    const weeks = state.tick - war.startedAtTick;
    const roll = rng.next();
    // Each AI belligerent in turn; the player decides for themselves.
    for (const [me, other] of [[war.a, war.b], [war.b, war.a]] as const) {
      if (me === state.playerCountryId || !next.countries[me]?.aiPersonality) continue;
      const score = war.a === me ? war.score : -war.score;
      const wants =
        (score >= WAR_CAPITULATION_SCORE && weeks >= WAR_MIN_WEEKS_BEFORE_SUING) ||
        (score <= -WAR_REPARATIONS_SCORE && weeks >= WAR_MIN_WEEKS_BEFORE_SUING && roll < 0.06) ||
        (weeks >= WAR_STALEMATE_WEEKS && Math.abs(score) < WAR_CAPITULATION_SCORE && roll < 0.03);
      if (!wants) continue;
      const peace = concludePeace(next, relation, me, other);
      next = { ...peace.state, relations: { ...peace.state.relations, [key]: peace.relation } };
      break;
    }
  }
  return next;
}

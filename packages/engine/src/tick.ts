// Single tick of the simulation. Pure function: returns a new GameState,
// never mutates `state`. Implements the 10-step loop from docs/SPEC.md.

import { applyAction } from './actions/index.js';
import { decideAiAction } from './ai/index.js';
import { checkWinLoss } from './checkWinLoss.js';
import { createRng, type Rng } from './rng.js';
import type {
  Country,
  CountryId,
  EventDefinition,
  GameEvent,
  GameState,
  MilitaryDeployment,
  Relation,
  ScienceState,
  SpyOperation,
  TechDefinition,
  TechEffect,
  VictoryRule,
} from './types.js';
import { clamp } from './actions/helpers.js';

export type TickContext = {
  /** Tech catalog from the current scenario; used to complete research and apply effects. */
  techCatalog?: readonly TechDefinition[];
  /** Event pool for narrative event triggers. */
  eventPool?: readonly EventDefinition[];
  /** Selected victory rule from the scenario. */
  victoryRule?: VictoryRule;
  /** AI is consulted every N ticks per country (staggered). Default: 4. */
  aiCadenceTicks?: number;
};

const DEFAULT_AI_CADENCE = 4;
const EVENTS_RING_SIZE = 50;

export function tick(state: GameState, ctx: TickContext = {}): GameState {
  if (state.winLoss !== 'playing') return state;

  const techCatalog = ctx.techCatalog ?? [];
  const eventPool = ctx.eventPool ?? [];

  const rng = createRng(`${state.rngSeed}::tick::${state.tick}`);

  let next: GameState = state;

  // 1. Economy.
  next = stepEconomy(next);

  // 2. Research.
  next = stepResearch(next, techCatalog);

  // 3. Spy operations.
  next = stepSpies(next, rng, techCatalog);

  // 4. Military: advance deployment & resolve battles.
  next = stepMilitary(next, rng);

  // 5. Politics: popularity drift.
  next = stepPolitics(next);

  // 6. Factions: drift satisfaction toward investment baseline.
  next = stepFactions(next);

  // 7. AI turn: each non-player country every aiCadenceTicks.
  next = stepAi(next, rng, techCatalog, ctx.aiCadenceTicks ?? DEFAULT_AI_CADENCE);

  // 8. Events.
  next = stepEvents(next, rng, eventPool);

  // 9. World tension.
  next = stepWorldTension(next);

  // 10. Win/loss.
  next = checkWinLoss(next, ctx.victoryRule);

  // Finally bump tick.
  return { ...next, tick: next.tick + 1 };
}

// ---------- 1. Economy ----------

function stepEconomy(state: GameState): GameState {
  const updated: Record<CountryId, Country> = {};
  for (const [id, country] of Object.entries(state.countries)) {
    const weeklyIncome = computeWeeklyIncome(country, state);
    updated[id] = {
      ...country,
      economy: {
        ...country.economy,
        weeklyIncome,
        treasury: country.economy.treasury + weeklyIncome,
      },
    };
  }
  return { ...state, countries: updated };
}

export function computeWeeklyIncome(country: Country, state: GameState): number {
  const gdp = country.economy.gdp;
  const taxRate = country.economy.taxRate / 100;
  // Weekly take = gdp * taxRate / 52 (rough), with sector multipliers and trade/sanctions.
  const sectorBonus =
    1 + country.economy.sectors.tech * 0.4 + country.economy.sectors.services * 0.2;
  let income = (gdp * taxRate * sectorBonus) / 52;

  // Trade deals raise, sanctions lower.
  for (const rel of Object.values(state.relations)) {
    if (rel.countryA !== country.id && rel.countryB !== country.id) continue;
    if (rel.treaties.includes('tradeDeal')) income *= 1.02;
    if (rel.treaties.includes('sanctions')) income *= 0.95;
  }
  // Wars are expensive.
  for (const rel of Object.values(state.relations)) {
    if (rel.countryA !== country.id && rel.countryB !== country.id) continue;
    if (rel.atWar) income -= country.military.armySize * 50;
  }
  return Math.round(income);
}

// ---------- 2. Research ----------

function stepResearch(state: GameState, techCatalog: readonly TechDefinition[]): GameState {
  const updatedCountries: Record<CountryId, Country> = { ...state.countries };
  const updatedProgress = { ...state.techTreeProgress };
  let mutated = false;

  for (const [id, country] of Object.entries(state.countries)) {
    const active = country.science.activeResearch;
    if (!active) continue;
    const tech = techCatalog.find((t) => t.id === active);
    const progress = state.techTreeProgress[id] ?? {
      activeResearch: active,
      accumulatedPoints: 0,
    };
    const newPoints = progress.accumulatedPoints + country.science.researchOutput;

    if (tech && newPoints >= tech.cost) {
      // Complete research: append id, apply effects, clear active.
      const completed = withCompletedTech(country, tech.id);
      const sciencePatched: ScienceState = applyTechEffectsToScience(
        completed.science,
        tech.effects,
      );
      const cleared: Country = {
        ...completed,
        science: { ...sciencePatched, activeResearch: null },
      };
      const newCountry: Country = applyTechEffectsToCountry(cleared, tech.effects);
      updatedCountries[id] = newCountry;
      updatedProgress[id] = { activeResearch: null, accumulatedPoints: 0 };
      mutated = true;
    } else {
      updatedProgress[id] = { activeResearch: active, accumulatedPoints: newPoints };
      mutated = true;
    }
  }

  if (!mutated) return state;
  return { ...state, countries: updatedCountries, techTreeProgress: updatedProgress };
}

function applyTechEffectsToScience(science: ScienceState, effects: TechEffect[]): ScienceState {
  let next = { ...science };
  for (const effect of effects) {
    if (effect.type === 'modifyStat' && effect.stat === 'researchOutput') {
      next = {
        ...next,
        researchOutput:
          (next.researchOutput + (effect.delta || 0)) * (effect.multiplier ?? 1),
      };
    }
  }
  // Mark tech as completed (caller passes it via science.activeResearch reset path).
  return next;
}

function applyTechEffectsToCountry(country: Country, effects: TechEffect[]): Country {
  let next = country;
  for (const effect of effects) {
    if (effect.type !== 'modifyStat') continue;
    switch (effect.stat) {
      case 'doctrineLevel':
        next = {
          ...next,
          military: {
            ...next.military,
            doctrineLevel:
              (next.military.doctrineLevel + (effect.delta || 0)) * (effect.multiplier ?? 1),
          },
        };
        break;
      case 'counterIntelLevel':
        next = {
          ...next,
          intelligence: {
            ...next.intelligence,
            counterIntelLevel: clamp(
              (next.intelligence.counterIntelLevel + (effect.delta || 0)) *
                (effect.multiplier ?? 1),
              0,
              1,
            ),
          },
        };
        break;
      case 'gdp':
        next = {
          ...next,
          economy: {
            ...next.economy,
            gdp: (next.economy.gdp + (effect.delta || 0)) * (effect.multiplier ?? 1),
          },
        };
        break;
      default:
        break;
    }
  }
  return next;
}

// We also append the completed tech id; do that in stepResearch when we know it:
function withCompletedTech(country: Country, techId: string): Country {
  if (country.science.completedTechs.includes(techId)) return country;
  return {
    ...country,
    science: {
      ...country.science,
      completedTechs: [...country.science.completedTechs, techId],
    },
  };
}

// ---------- 3. Spies ----------

function stepSpies(
  state: GameState,
  rng: Rng,
  techCatalog: readonly TechDefinition[],
): GameState {
  if (state.spyOperations.length === 0) return state;
  const newOps: SpyOperation[] = [];
  const countriesPatch: Record<CountryId, Country> = {};
  const getCountry = (id: CountryId): Country | undefined =>
    countriesPatch[id] ?? state.countries[id];

  for (const op of state.spyOperations) {
    if (op.status !== 'active') {
      newOps.push(op);
      continue;
    }
    const newProgress = op.progressTicks + 1;
    if (newProgress < op.durationTicks) {
      newOps.push({ ...op, progressTicks: newProgress });
      continue;
    }
    // Roll outcomes.
    const successRoll = rng.next();
    const detectionRoll = rng.next();
    const success = successRoll < op.successProbability;
    const detected = detectionRoll < op.detectionRisk;

    let status: SpyOperation['status'] = success ? 'completed' : 'failed';
    if (detected) status = 'detected';

    if (success) {
      const owner = getCountry(op.ownerCountryId);
      const target = getCountry(op.targetCountryId);
      if (owner && target) {
        const { newOwner, newTarget } = applySpySuccess(owner, target, op, techCatalog);
        countriesPatch[owner.id] = newOwner;
        countriesPatch[target.id] = newTarget;
      }
    }

    newOps.push({ ...op, progressTicks: newProgress, status });
  }

  // Trim completed/failed/detected ops older than 50 ticks to keep the array bounded.
  const trimmed = newOps.filter(
    (o) => o.status === 'active' || state.tick - o.startedAtTick - o.durationTicks < 50,
  );

  if (Object.keys(countriesPatch).length === 0) {
    return { ...state, spyOperations: trimmed };
  }
  return {
    ...state,
    countries: { ...state.countries, ...countriesPatch },
    spyOperations: trimmed,
  };
}

function applySpySuccess(
  owner: Country,
  target: Country,
  op: SpyOperation,
  techCatalog: readonly TechDefinition[],
): { newOwner: Country; newTarget: Country } {
  let newOwner = owner;
  let newTarget = target;
  switch (op.payload.kind) {
    case 'steal_tech': {
      const techId = op.payload.techId;
      if (!owner.science.completedTechs.includes(techId)) {
        const tech = techCatalog.find((t) => t.id === techId);
        const stolen = withCompletedTech(newOwner, techId);
        newOwner = tech ? applyTechEffectsToCountry(stolen, tech.effects) : stolen;
      }
      break;
    }
    case 'sabotage': {
      const sector = op.payload.targetSector;
      if (sector === 'military') {
        newTarget = {
          ...newTarget,
          military: {
            ...newTarget.military,
            armySize: Math.max(0, newTarget.military.armySize - 50),
          },
        };
      } else if (sector === 'science') {
        newTarget = {
          ...newTarget,
          science: {
            ...newTarget.science,
            researchOutput: Math.max(0, newTarget.science.researchOutput - 1),
          },
        };
      } else {
        // economy sector hit
        newTarget = {
          ...newTarget,
          economy: {
            ...newTarget.economy,
            gdp: Math.max(0, newTarget.economy.gdp * 0.98),
          },
        };
      }
      break;
    }
    case 'propaganda': {
      newTarget = {
        ...newTarget,
        politics: {
          ...newTarget.politics,
          popularity: clamp(newTarget.politics.popularity - 5, 0, 100),
        },
      };
      break;
    }
    case 'destabilize': {
      const factions = newTarget.politics.factions;
      const updated = { ...factions };
      for (const fid of Object.keys(updated) as Array<keyof typeof updated>) {
        const cur = updated[fid];
        updated[fid] = { ...cur, satisfaction: clamp(cur.satisfaction - 5, 0, 100) };
      }
      newTarget = {
        ...newTarget,
        politics: { ...newTarget.politics, factions: updated },
      };
      break;
    }
    case 'assassinate': {
      newTarget = {
        ...newTarget,
        politics: {
          ...newTarget.politics,
          popularity: clamp(newTarget.politics.popularity - 10, 0, 100),
        },
      };
      break;
    }
  }
  return { newOwner, newTarget };
}

// ---------- 4. Military ----------

function stepMilitary(state: GameState, rng: Rng): GameState {
  // Determine each region's deployments (across countries) and resolve battles
  // in regions where two enemies are present.
  type RegionEntry = { countryId: CountryId; deployment: MilitaryDeployment };
  const byRegion = new Map<string, RegionEntry[]>();
  for (const country of Object.values(state.countries)) {
    for (const dep of country.military.deployedUnits) {
      const list = byRegion.get(dep.regionId) ?? [];
      list.push({ countryId: country.id, deployment: dep });
      byRegion.set(dep.regionId, list);
    }
  }

  // Patch deployments per country if battle resolves losses.
  const patches: Record<CountryId, MilitaryDeployment[]> = {};
  for (const country of Object.values(state.countries)) {
    patches[country.id] = country.military.deployedUnits.map((d) => ({ ...d }));
  }

  for (const [, entries] of byRegion) {
    if (entries.length < 2) continue;
    // Find any two entries that are at war with each other and resolve.
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (!a || !b) continue;
        if (a.countryId === b.countryId) continue;
        const rel = lookupRelation(state, a.countryId, b.countryId);
        if (!rel?.atWar) continue;
        // Resolve a small skirmish.
        const aDoct = state.countries[a.countryId]?.military.doctrineLevel ?? 1;
        const bDoct = state.countries[b.countryId]?.military.doctrineLevel ?? 1;
        const aPower = a.deployment.units * (1 + aDoct);
        const bPower = b.deployment.units * (1 + bDoct);
        const total = aPower + bPower;
        if (total <= 0) continue;
        const aWinChance = aPower / total;
        const aLoss = Math.floor(a.deployment.units * (1 - aWinChance) * 0.5 * (0.5 + rng.next()));
        const bLoss = Math.floor(b.deployment.units * aWinChance * 0.5 * (0.5 + rng.next()));
        const aPatch = patches[a.countryId];
        const bPatch = patches[b.countryId];
        if (aPatch) {
          const idx = aPatch.findIndex((d) => d.id === a.deployment.id);
          const cur = idx >= 0 ? aPatch[idx] : undefined;
          if (idx >= 0 && cur) {
            aPatch[idx] = { ...cur, units: Math.max(0, cur.units - aLoss) };
          }
        }
        if (bPatch) {
          const idx = bPatch.findIndex((d) => d.id === b.deployment.id);
          const cur = idx >= 0 ? bPatch[idx] : undefined;
          if (idx >= 0 && cur) {
            bPatch[idx] = { ...cur, units: Math.max(0, cur.units - bLoss) };
          }
        }
      }
    }
  }

  // Filter out fully-destroyed deployments and rebuild countries.
  const updated: Record<CountryId, Country> = {};
  for (const country of Object.values(state.countries)) {
    const patch = (patches[country.id] ?? country.military.deployedUnits).filter(
      (d) => d.units > 0,
    );
    updated[country.id] = {
      ...country,
      military: { ...country.military, deployedUnits: patch },
    };
  }
  return { ...state, countries: updated };
}

function lookupRelation(state: GameState, a: CountryId, b: CountryId): Relation | undefined {
  const key = a < b ? `${a}::${b}` : `${b}::${a}`;
  return state.relations[key as keyof typeof state.relations];
}

// ---------- 5. Politics ----------

function stepPolitics(state: GameState): GameState {
  const updated: Record<CountryId, Country> = {};
  for (const [id, country] of Object.entries(state.countries)) {
    const baseline = 50;
    let pop = country.politics.popularity;
    pop += (baseline - pop) * 0.02; // gentle drift toward baseline
    // Faction satisfaction influences popularity weighted by influence.
    let factionWeighted = 0;
    let totalInfluence = 0;
    for (const f of Object.values(country.politics.factions)) {
      factionWeighted += f.satisfaction * f.influence;
      totalInfluence += f.influence;
    }
    if (totalInfluence > 0) {
      const factionAvg = factionWeighted / totalInfluence;
      pop += (factionAvg - pop) * 0.05;
    }
    // Negative treasury hurts popularity.
    if (country.economy.treasury < 0) pop -= 0.5;
    updated[id] = {
      ...country,
      politics: { ...country.politics, popularity: clamp(pop, 0, 100) },
    };
  }
  return { ...state, countries: updated };
}

// ---------- 6. Factions ----------

function stepFactions(state: GameState): GameState {
  const updated: Record<CountryId, Country> = {};
  for (const [id, country] of Object.entries(state.countries)) {
    const factions = { ...country.politics.factions };
    for (const fid of Object.keys(factions) as Array<keyof typeof factions>) {
      const f = factions[fid];
      // Drift gently toward 50.
      const drifted = f.satisfaction + (50 - f.satisfaction) * 0.01;
      // Government type affects which faction prospers.
      const govBonus = governmentBonus(country.politics.governmentType, fid);
      factions[fid] = {
        ...f,
        satisfaction: clamp(drifted + govBonus, 0, 100),
      };
    }
    updated[id] = {
      ...country,
      politics: { ...country.politics, factions },
    };
  }
  return { ...state, countries: updated };
}

function governmentBonus(
  gov: Country['politics']['governmentType'],
  faction: keyof Country['politics']['factions'],
): number {
  // Tiny weekly nudges; net-zero on average.
  const map: Record<typeof gov, Partial<Record<typeof faction, number>>> = {
    democracy: { reformist: 0.05, business: 0.02, populist: 0.02 },
    autocracy: { army: 0.05, business: 0.02, reformist: -0.05 },
    oligarchy: { business: 0.08, populist: -0.05 },
    theocracy: { religious: 0.08, reformist: -0.05 },
    monarchy: { army: 0.04, religious: 0.04, populist: -0.02 },
  };
  return map[gov][faction] ?? 0;
}

// ---------- 7. AI ----------

function stepAi(
  state: GameState,
  rng: Rng,
  techCatalog: readonly TechDefinition[],
  cadence: number,
): GameState {
  let next = state;
  for (const country of Object.values(state.countries)) {
    if (country.id === state.playerCountryId) continue;
    if (!country.aiPersonality) continue;
    // Stagger so not every AI moves every tick.
    const offset = simpleStableHash(country.id) % cadence;
    if ((state.tick + offset) % cadence !== 0) continue;
    const action = decideAiAction(next, country.id, rng, techCatalog);
    if (!action) continue;
    const result = applyAction(next, action, country.id, techCatalog);
    if (result.errors.length === 0) {
      next = result.state;
    }
  }
  return next;
}

function simpleStableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ---------- 8. Events ----------

function stepEvents(state: GameState, rng: Rng, eventPool: readonly EventDefinition[]): GameState {
  if (eventPool.length === 0) return state;
  const fired: GameEvent[] = [];

  for (const def of eventPool) {
    // Cooldown check.
    const lastIdx = findLastIndex(state.events, (e) => e.definitionId === def.id);
    if (lastIdx >= 0) {
      const last = state.events[lastIdx];
      if (last && state.tick - last.firedAtTick < def.cooldownTicks) continue;
    }
    let triggered = false;
    switch (def.trigger.type) {
      case 'periodic':
        triggered = def.trigger.everyTicks > 0 && state.tick % def.trigger.everyTicks === 0;
        break;
      case 'random':
        triggered = rng.next() < def.trigger.chancePerTick;
        break;
      case 'condition':
        // Mini-DSL not implemented in Phase 1; treat as never-trigger.
        triggered = false;
        break;
    }
    if (triggered) {
      fired.push({
        definitionId: def.id,
        firedAtTick: state.tick,
        resolvedChoiceIndex: null,
      });
    }
  }

  if (fired.length === 0) return state;
  // Weighted single pick if multiple eligible at once.
  const chosen = fired.length === 1 ? fired : [pickWeighted(fired, eventPool, rng)];
  const events = [...state.events, ...chosen];
  // Cap to last EVENTS_RING_SIZE.
  const trimmed = events.length > EVENTS_RING_SIZE ? events.slice(-EVENTS_RING_SIZE) : events;
  return { ...state, events: trimmed };
}

function pickWeighted(
  fired: GameEvent[],
  pool: readonly EventDefinition[],
  rng: Rng,
): GameEvent {
  const weights = fired.map((e) => pool.find((d) => d.id === e.definitionId)?.weight ?? 1);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    const first = fired[0];
    if (!first) throw new Error('pickWeighted: empty array');
    return first;
  }
  let r = rng.next() * total;
  for (let i = 0; i < fired.length; i++) {
    const w = weights[i] ?? 0;
    r -= w;
    if (r <= 0) {
      const item = fired[i];
      if (item) return item;
    }
  }
  const last = fired[fired.length - 1];
  if (!last) throw new Error('pickWeighted: unreachable');
  return last;
}

function findLastIndex<T>(arr: T[], pred: (t: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (v !== undefined && pred(v)) return i;
  }
  return -1;
}

// ---------- 9. World tension ----------

function stepWorldTension(state: GameState): GameState {
  let tension = 0;
  for (const rel of Object.values(state.relations)) {
    if (rel.atWar) tension += 5;
    if (rel.treaties.includes('sanctions')) tension += 1;
  }
  // Recent detected spy ops add tension.
  for (const op of state.spyOperations) {
    if (op.status === 'detected' && state.tick - op.startedAtTick - op.durationTicks < 10) {
      tension += 1;
    }
  }
  return { ...state, worldTension: clamp(tension, 0, 100) };
}


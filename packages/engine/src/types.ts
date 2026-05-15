// Aurion engine — public type model.
// All types are pure data (no methods, no classes). The engine operates on
// immutable snapshots of these structures via pure functions in tick.ts and
// actions/*.ts. See docs/SPEC.md for the high-level design.

// ---------------------------------------------------------------------------
// Identifier brands (kept as plain strings to keep JSON serialization trivial).
// ---------------------------------------------------------------------------

export type CountryId = string;
export type RegionId = string;
export type TechId = string;
export type EventId = string;
export type SpyOperationId = string;
export type DeploymentId = string;
export type SaveId = string;

/** Stable key for a (countryA, countryB) pair, sorted lex so it is unique. */
export type RelationKey = `${CountryId}::${CountryId}`;

// ---------------------------------------------------------------------------
// Closed enumerations.
// ---------------------------------------------------------------------------

export type FactionId = 'army' | 'business' | 'religious' | 'populist' | 'reformist';

export type GovernmentType = 'democracy' | 'autocracy' | 'oligarchy' | 'theocracy' | 'monarchy';

export type IntelLevel = 'none' | 'rumors' | 'partial' | 'full';

export type SpyOperationType =
  | 'steal_tech'
  | 'sabotage'
  | 'propaganda'
  | 'destabilize'
  | 'assassinate';

export type SpyOperationStatus = 'active' | 'completed' | 'detected' | 'failed';

export type AiArchetype =
  | 'pacifist_trader'
  | 'regional_bully'
  | 'cold_isolationist'
  | 'opportunist'
  | 'superpower';

export type DiplomacyKind =
  | 'proposeAlliance'
  | 'breakAlliance'
  | 'imposeSanction'
  | 'liftSanction'
  | 'tradeDeal'
  | 'declareWar'
  | 'sueForPeace';

export type InvestTarget = 'economy' | 'research' | 'military' | 'intel' | 'infra';

export type WinLossState = 'playing' | 'won' | 'lost';

export type VictoryConditionId =
  | 'economic'
  | 'military'
  | 'scientific'
  | 'diplomatic'
  | 'domination';

export type TechBranch = 'military' | 'civil' | 'intelligence' | 'space';

// ---------------------------------------------------------------------------
// Country sub-structures.
// ---------------------------------------------------------------------------

export type EconomySectors = {
  /** Each value in [0,1]. The four together must sum to 1.0 (± rounding). */
  agriculture: number;
  industry: number;
  services: number;
  tech: number;
};

export type EconomyState = {
  /** Money on hand. May go negative; sustained negative triggers loss. */
  treasury: number;
  /** Gross domestic product per year, used as a scale reference. */
  gdp: number;
  /** Net income added to treasury each tick (computed from gdp, taxes, sanctions, trade). */
  weeklyIncome: number;
  /** 0..100 percent. Affects popularity and weeklyIncome. */
  taxRate: number;
  sectors: EconomySectors;
};

export type MilitaryDeployment = {
  id: DeploymentId;
  /** Region currently occupied or contested by these units. */
  regionId: RegionId;
  units: number;
  /** Country whose territory the deployment is on, if any. */
  hostCountryId: CountryId | null;
  /** Tick when the deployment was issued; used for travel time / readiness. */
  issuedAtTick: number;
};

export type MilitaryState = {
  armySize: number;
  navy: number;
  airforce: number;
  /** 0..1 — multiplier on combat effectiveness, raised by doctrine techs. */
  doctrineLevel: number;
  deployedUnits: MilitaryDeployment[];
};

export type ResearchProgress = {
  /** Tech currently being researched, null if idle. */
  activeResearch: TechId | null;
  /** Accumulated points toward the active tech. */
  accumulatedPoints: number;
};

export type ScienceState = {
  /** Research points produced per tick, scaled by sectors and modifiers. */
  researchOutput: number;
  /** Mirrors techTreeProgress[countryId] for convenience. Engine keeps them in sync. */
  activeResearch: TechId | null;
  completedTechs: TechId[];
};

export type IntelligenceState = {
  spyCount: number;
  /** 0..1 — multiplier on detection rolls against incoming foreign ops. */
  counterIntelLevel: number;
  /** What this country knows about each other country. */
  knownIntel: Record<CountryId, IntelLevel>;
};

export type FactionState = {
  /** 0..100 — how happy this faction is with the current government. */
  satisfaction: number;
  /** 0..100 — political weight; how much its (un)happiness affects popularity. */
  influence: number;
};

export type PoliticsState = {
  /** 0..100 — overall popular support of the government. */
  popularity: number;
  factions: Record<FactionId, FactionState>;
  governmentType: GovernmentType;
};

export type AiPersonality = {
  archetype: AiArchetype;
  aggressiveness: number; // 0..1
  expansionism: number; // 0..1
  paranoia: number; // 0..1
  pragmatism: number; // 0..1
};

export type Country = {
  id: CountryId;
  /** i18n message key (e.g. "country.aurion.name"). */
  nameKey: string;
  /** CSS color string used in map / UI. */
  color: string;
  regionId: RegionId;
  /** i18n key for the capital city's display name. */
  capitalKey: string;
  population: number;

  economy: EconomyState;
  military: MilitaryState;
  science: ScienceState;
  intelligence: IntelligenceState;
  politics: PoliticsState;

  isPlayer: boolean;
  /** Required for non-player countries; undefined for the human-controlled one. */
  aiPersonality?: AiPersonality;
};

// ---------------------------------------------------------------------------
// Diplomacy.
// ---------------------------------------------------------------------------

export type TreatyKind = 'nonAggression' | 'tradeDeal' | 'alliance' | 'sanctions';

export type Relation = {
  countryA: CountryId;
  countryB: CountryId;
  /** -100..+100 — how much A and B like each other (symmetric). */
  attitude: number;
  treaties: TreatyKind[];
  atWar: boolean;
};

// ---------------------------------------------------------------------------
// Spy operations.
// ---------------------------------------------------------------------------

export type SpyPayload =
  | { kind: 'steal_tech'; techId: TechId }
  | { kind: 'sabotage'; targetSector: keyof EconomySectors | 'military' | 'science' }
  | { kind: 'propaganda'; targetFaction: FactionId | null }
  | { kind: 'destabilize' }
  | { kind: 'assassinate'; targetRoleKey: string };

export type SpyOperation = {
  id: SpyOperationId;
  type: SpyOperationType;
  ownerCountryId: CountryId;
  targetCountryId: CountryId;
  payload: SpyPayload;
  progressTicks: number;
  durationTicks: number;
  /** 0..1 — pre-computed at deployment time. */
  successProbability: number;
  /** 0..1 — pre-computed at deployment time. */
  detectionRisk: number;
  status: SpyOperationStatus;
  /** Tick at which the operation was created. */
  startedAtTick: number;
};

// ---------------------------------------------------------------------------
// Narrative events.
// ---------------------------------------------------------------------------

export type EventEffect =
  | { type: 'modifyStat'; target: 'player' | CountryId; stat: string; delta: number }
  | { type: 'startResearch'; target: CountryId; techId: TechId }
  | { type: 'shiftAttitude'; with: CountryId; delta: number }
  | { type: 'spawnSpy'; against: CountryId; opType: SpyOperationType };

export type EventChoice = {
  /** i18n key for the choice label. */
  labelKey: string;
  effects: EventEffect[];
};

export type EventTrigger =
  | { type: 'periodic'; everyTicks: number }
  | { type: 'condition'; expression: string } // mini-DSL evaluated by the engine
  | { type: 'random'; chancePerTick: number };

/**
 * Closed taxonomy of categories an event can belong to. Panels filter the
 * event log against this taxonomy (e.g. PoliticsPanel keeps `politics`,
 * `faction`, `social`) instead of pattern-matching event ids. An event may
 * carry 1..3 tags; engine code never reads the field directly.
 *
 * The runtime allows any string in JSON for forward compatibility, but the
 * scenario validator warns on tags outside this union.
 */
export type EventTag =
  | 'politics'
  | 'faction'
  | 'economy'
  | 'military'
  | 'diplomacy'
  | 'intelligence'
  | 'space'
  | 'social'
  | 'crisis'
  | 'opportunity'
  | 'narrative';

export type EventDefinition = {
  id: EventId;
  nameKey: string;
  descriptionKey: string;
  trigger: EventTrigger;
  cooldownTicks: number;
  /** Weight in random selection when several events are eligible at once. */
  weight: number;
  choices: EventChoice[];
  /**
   * Optional category tags used by UI panels to filter the event log.
   * Pure metadata: the engine never reads this field.
   */
  tags?: readonly EventTag[];
};

export type GameEvent = {
  /** Reference to the EventDefinition that fired. */
  definitionId: EventId;
  /** Tick at which it fired. */
  firedAtTick: number;
  /** Index into choices[] picked by the player (or AI). null until resolved. */
  resolvedChoiceIndex: number | null;
};

// ---------------------------------------------------------------------------
// Tech tree.
// ---------------------------------------------------------------------------

export type TechEffect =
  | { type: 'modifyStat'; stat: string; delta: number; multiplier?: number }
  | { type: 'unlockAction'; action: string }
  | { type: 'unlockSpyType'; spyType: SpyOperationType };

export type TechDefinition = {
  id: TechId;
  nameKey: string;
  descriptionKey: string;
  branch: TechBranch;
  cost: number;
  prereqs: TechId[];
  effects: TechEffect[];
};

// ---------------------------------------------------------------------------
// Scenario file shape.
// ---------------------------------------------------------------------------

export type CountryInit = Omit<Country, 'science'> & {
  /** science.completedTechs at game start; researchOutput is derived. */
  initialCompletedTechs: TechId[];
};

export type RelationInit = {
  countryA: CountryId;
  countryB: CountryId;
  attitude: number;
  treaties?: TreatyKind[];
  atWar?: boolean;
};

export type VictoryConditionDef = {
  id: VictoryConditionId;
  nameKey: string;
  descriptionKey: string;
  /** Engine evaluates `(state) => boolean`; serialized as a small DSL. */
  rule: VictoryRule;
};

/** A composable rule evaluated by the engine against the current GameState. */
export type VictoryRule =
  | { kind: 'gdpRank'; ofPlayer: true; rankAtMost: number }
  | { kind: 'controlNCountries'; n: number }
  | { kind: 'completeTech'; techId: TechId }
  | { kind: 'allianceCoverage'; minPercent: number }
  | { kind: 'and'; rules: VictoryRule[] }
  | { kind: 'or'; rules: VictoryRule[] };

export type DifficultyTuning = {
  id: string;
  nameKey: string;
  /** Multipliers applied during balancing. */
  modifiers: {
    aiAggression: number;
    aiResearchSpeed: number;
    playerIncome: number;
    eventDifficulty: number;
  };
};

export type Scenario = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  version: string;
  /** Tick at which the game starts. Default 0. */
  startTick: number;
  /** Country IDs the human player may pick at game setup. */
  playableCountries: CountryId[];
  countries: CountryInit[];
  relations: RelationInit[];
  techTree: TechDefinition[];
  eventPool: EventDefinition[];
  victoryConditions: VictoryConditionDef[];
  /** Phase 1: exactly one entry. Phase 2: three. */
  difficulties: DifficultyTuning[];
};

// ---------------------------------------------------------------------------
// Player actions.
// ---------------------------------------------------------------------------

export type Action =
  | { type: 'invest'; target: InvestTarget; amount: number }
  | {
      type: 'deploySpy';
      op: Omit<SpyOperation, 'id' | 'status' | 'progressTicks' | 'startedAtTick'>;
    }
  | { type: 'startResearch'; techId: TechId }
  | { type: 'setTaxRate'; rate: number }
  | { type: 'diplomacy'; target: CountryId; kind: DiplomacyKind }
  | { type: 'deployArmy'; target: RegionId; units: number }
  | { type: 'placateFaction'; factionId: FactionId };

// ---------------------------------------------------------------------------
// Top-level game state.
// ---------------------------------------------------------------------------

/** Per-loss-condition streak counters maintained by the engine; persists across saves. */
export type LoseStreaks = {
  /** Consecutive ticks the player country has had popularity < 10. */
  lowPopularityWeeks: number;
  /** Consecutive ticks the player country has had treasury < 0. */
  negativeTreasuryWeeks: number;
  /** Consecutive ticks the player capital region has been occupied by a hostile power. */
  capitalOccupiedWeeks: number;
  /** Consecutive ticks all 5 player factions have had satisfaction < 20 simultaneously. */
  allFactionsAngryWeeks: number;
};

export type GameState = {
  /** Monotonically increasing; 1 tick = 1 in-game week. */
  tick: number;
  scenarioId: string;
  difficultyId: string;
  playerCountryId: CountryId;
  countries: Record<CountryId, Country>;
  relations: Record<RelationKey, Relation>;
  techTreeProgress: Record<CountryId, ResearchProgress>;
  spyOperations: SpyOperation[];
  /** Bounded ring buffer of recent events (length capped by engine). */
  events: GameEvent[];
  /** 0..100 — global tension; rises with wars, sanctions, detected ops. */
  worldTension: number;
  winLoss: WinLossState;
  selectedVictoryCondition: VictoryConditionId;
  /** Stable string fed to the seeded PRNG. */
  rngSeed: string;
  /** Engine-managed loss-condition streaks. Optional so older saves load cleanly. */
  _loseStreaks?: LoseStreaks;
};

// ---------------------------------------------------------------------------
// Engine API result shapes.
// ---------------------------------------------------------------------------

export type ApplyActionResult = {
  state: GameState;
  /** i18n keys for any reasons the action was rejected; empty on success. */
  errors: string[];
};

export type CreateGameOptions = {
  /** Optional fixed seed; if omitted, the engine generates one. */
  seed?: string;
  victory: VictoryConditionId;
  playerCountryId: CountryId;
  difficultyId?: string;
};

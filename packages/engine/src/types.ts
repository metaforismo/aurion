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
  /** Phase 3: which bloc this country currently belongs to. Undefined = unaligned. */
  blocId?: ActiveBlocId;
  /** Phase 3 (Wave 10): nuclear arsenal. Absent = no nuclear capability. */
  nuclear?: NuclearArsenal;
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
  /**
   * Phase 3 Wave 10 — space prestige.
   * If set, the FIRST country to complete this tech receives `prestigeFirst`
   * reputation across all blocs; subsequent achievers receive `prestigeFollow`.
   * Engine tracks via state.spaceMilestones. Omit to skip prestige tracking.
   */
  prestigeFirst?: number;
  prestigeFollow?: number;
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
    // — Phase 1 (existing) —
    /** >1 = AI more aggressive (multiplier on declareWar / deployArmy scoring). */
    aiAggression: number;
    /** >1 = non-player nations research faster (multiplier on their researchOutput). */
    aiResearchSpeed: number;
    /** >1 = player gets more weeklyIncome (player only, multiplied at tick time). */
    playerIncome: number;
    /** >1 = event consequences hit harder. Reserved for narrative effect tuning. */
    eventDifficulty: number;

    // — Phase 2 (new, optional in JSON, defaulted to 1.0 at consumption sites) —
    /** Multiplier on AI utility for `proposeAlliance` actions (>1 = friendlier, alliance-bias). */
    aiAllianceBias?: number;
    /** Multiplier on detectionRisk computed for spy ops where the target is the player. */
    spyDetectionAgainstPlayer?: number;
    /** Multiplier on the four LOSS_*_WEEKS thresholds in checkWinLoss (>1 = more forgiving). */
    lossToleranceWeeks?: number;
    /** Multiplier on event trigger probability for `random` events (<1 = fewer events). */
    eventChanceMultiplier?: number;
  };
  /** If true: no autosave / no manual save / no import. UI-only flag; engine ignores. */
  ironMan?: boolean;
  /** Optional UI badge i18n key (e.g. "Insane"). */
  badgeKey?: string;
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

  // — Phase 3 (optional; absent = scenario doesn't participate in Phase 3 systems) —
  /** Bloc declarations + initial membership. If absent, no blocs / no reputation system. */
  blocs?: ScenarioBlocInit[];
  /** Country IDs that hold permanent UN council seats (with veto). */
  unCouncilMembers?: CountryId[];
  /** Map from action trigger key → UN resolution template (Q2 contextual triggers). */
  unTriggerMap?: Partial<Record<ActionTriggerKey, UNResolutionTemplate>>;
  /** When true + game mode is 'dethrone', the isolation streak counts as a loss trigger. */
  dethroneIsolationOnByDefault?: boolean;
  /** Era schedule for era-paced mode (Wave 10+). */
  eras?: Era[];
};

/** A bloc as declared in scenario data (without runtime fields like leader). */
export type ScenarioBlocInit = {
  id: ActiveBlocId;
  nameKey: string;
  /** Country IDs that start in this bloc. */
  foundingMembers: CountryId[];
  /** Optional explicit leader; otherwise computed from GDP+military weight. */
  leaderCountryId?: CountryId;
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
  | { type: 'placateFaction'; factionId: FactionId }
  // — Phase 3 actions —
  | {
      type: 'proposeUNResolution';
      kind: UNResolutionKind;
      targetCountryId?: CountryId;
      targetRegionId?: RegionId;
    }
  | { type: 'voteUN'; resolutionId: string; vote: UNVote }
  | { type: 'joinBloc'; blocId: ActiveBlocId }
  | { type: 'leaveBloc' }
  // — Phase 3 Wave 10: nuclear actions —
  | { type: 'launchTactical'; targetRegionId: RegionId }
  | { type: 'launchStrategic'; targetCountryId: CountryId }
  | { type: 'dismantleNuclear'; count: number }
  | { type: 'acknowledgeEraTransition' };

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

  // — Phase 3 (all optional; undefined means "system not in use") —
  /** Player's reputation in each active bloc. Initialized only when scenario has blocs. */
  reputation?: ReputationByBloc;
  /** Queue of pending deltas to apply at the next reputation tick step. */
  pendingReputationDeltas?: ReputationDelta[];
  /** Current bloc roster. Initialized from scenario.blocs at createGame. */
  blocs?: BlocState;
  /** Active + recently-resolved UN resolutions (capped ring buffer). */
  unResolutions?: UNResolution[];
  /** Game mode chosen at game setup. Undefined treated as 'classic'. */
  gameMode?: GameMode;
  /** Cumulative metrics shown in Eternal mode HUD. */
  cumulativeStats?: CumulativeStats;
  /** Victory conditions the player has already met (Eternal multi-victory counter). */
  unlockedVictories?: VictoryConditionId[];
  /** Action log for Replay mode (Wave 11+ consumes; Wave 9+ populates if enabled). */
  actionLog?: ActionLogEntry[];
  /** Engine-managed Dethrone-mode streak counters. */
  _dethroneStreaks?: DethroneStreaks;

  // — Phase 3 Wave 10 (all optional) —
  /** Per-tech first-achiever / followers tracking for space prestige. */
  spaceMilestones?: SpaceMilestoneState;
  /** Era runtime state when gameMode === 'era-paced'. */
  eraState?: EraRuntimeState;
};

// ---------------------------------------------------------------------------
// Achievements (cross-game / global unlocks).
// ---------------------------------------------------------------------------

export type AchievementId = string;

/**
 * Composable, declarative predicate over the current GameState. The runtime
 * never carries closures so achievement definitions remain JSON-serialisable
 * (which keeps them friendly to future "load extra achievements from a
 * scenario" flows). All numeric thresholds are inclusive (>= / <=) unless
 * noted otherwise on the matching evaluator branch.
 */
export type AchievementCondition =
  | { kind: 'completeTech'; techId: TechId }
  | { kind: 'reachPopularity'; threshold: number }
  | { kind: 'reachGdpRank'; rank: number }
  | { kind: 'allianceCount'; n: number }
  | { kind: 'spyOpsCompleted'; n: number }
  | { kind: 'completeWar'; wins: number }
  | { kind: 'survivedTicks'; n: number }
  /**
   * Phase 3 Wave 10 — at least one tactical OR strategic nuclear strike event
   * is present in the (ring-buffered) `state.events` history. Used by the
   * `scorched_earth` hidden achievement. Note: ring buffer caps at 50; the
   * achievement is intended to be evaluated soon after the strike fires.
   */
  | { kind: 'launchedNuclear' }
  /**
   * Phase 3 Wave 10 — a strategic-MAD strike event is present in
   * `state.events`, the player's country still exists with a nuclear arsenal
   * present, and the player has not lost. Used by `mutually_assured`.
   */
  | { kind: 'survivedMad' }
  /**
   * Phase 3 Wave 10 — the player country has a `nuclear` field present (was
   * nuclear at some point), currently has `warheadCount === 0`, and a UN
   * non-proliferation resolution with status 'passed' is in force. Used by
   * `disarmer` as a proxy for "dismantled ≥10 warheads under treaty" — the
   * engine has no per-action dismantle counter yet (OPEN, Wave 11+).
   */
  | { kind: 'dismantledUnderTreaty' }
  | { kind: 'and'; conditions: AchievementCondition[] }
  | { kind: 'or'; conditions: AchievementCondition[] };

export type AchievementDef = {
  id: AchievementId;
  nameKey: string;
  descKey: string;
  condition: AchievementCondition;
  /** 'bronze' | 'silver' | 'gold' difficulty hint for UI. */
  tier: 'bronze' | 'silver' | 'gold';
  /** Hidden until unlocked — secret achievements get a placeholder name in UI. */
  hidden?: boolean;
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
  /** Phase 3: which game-mode to play (default 'classic' for backward compat). */
  gameMode?: GameMode;
};

// ===========================================================================
// PHASE 3 — World standing, blocs, UN, endless mode
// ===========================================================================
// All Phase 3 fields are OPTIONAL on the existing GameState / Country /
// Scenario / Action types. This keeps Phase 1+2 saves and scenarios fully
// backward-compatible. The engine treats undefined Phase 3 state as "system
// not in use" (no-op tick steps, no UI badges, no resolutions).

// ---------------------------------------------------------------------------
// Blocs (NATO-style alliance groups)
// ---------------------------------------------------------------------------

/** Active blocs in Phase 3. `unaligned` is a sentinel for "not in any bloc". */
export type BlocId = 'western' | 'eastern' | 'non-aligned' | 'unaligned';

/** Real bloc ids that have a Bloc record (excludes the sentinel). */
export type ActiveBlocId = Exclude<BlocId, 'unaligned'>;

export type Bloc = {
  id: ActiveBlocId;
  /** i18n key for the bloc's display name. */
  nameKey: string;
  /** Highest GDP+military weight member. Null if bloc is unbalanced or empty. */
  leaderCountryId: CountryId | null;
  memberCountryIds: CountryId[];
  /** Tick at which the bloc was instantiated (usually scenario.startTick). */
  foundedAtTick: number;
};

export type BlocState = Record<ActiveBlocId, Bloc>;

// ---------------------------------------------------------------------------
// World reputation (per-bloc)
// ---------------------------------------------------------------------------

/** Player reputation in each active bloc (-100..+100). Unaligned not tracked. */
export type ReputationByBloc = Record<ActiveBlocId, number>;

/**
 * A pending reputation delta to apply at the next reputation tick step.
 * The engine accumulates these from action effects and event resolutions,
 * then applies + decays once per tick. Persisted in GameState.
 */
export type ReputationDelta = {
  bloc: BlocId; // 'unaligned' is a no-op sink
  delta: number; // signed
  /** i18n key for the reason shown in the reputation history panel. */
  reasonKey: string;
  /** Tick at which the delta was queued. */
  queuedAtTick: number;
};

// ---------------------------------------------------------------------------
// United Nations
// ---------------------------------------------------------------------------

export type UNResolutionKind =
  | 'sanctions'
  | 'peacekeeping'
  | 'recognition'
  | 'humanitarian'
  | 'climate'
  | 'nonProliferation'
  | 'condemnation';

export type UNVote = 'yes' | 'no' | 'abstain' | 'veto';

export type UNResolution = {
  id: string;
  kind: UNResolutionKind;
  /** Optional target depending on kind (sanctions / condemnation → country, peacekeeping → region). */
  targetCountryId?: CountryId;
  targetRegionId?: RegionId;
  proposerCountryId: CountryId;
  proposedAtTick: number;
  /** Voting closes at this tick; resolution flips to passed/failed at that point. */
  votingClosesAtTick: number;
  /** Effect bundle applied based on outcome. References EventEffect for reuse. */
  effects: { onPass: EventEffect[]; onFail: EventEffect[] };
  /** Recorded votes per country. Permanent council members may use 'veto'. */
  votes: Record<CountryId, UNVote>;
  status: 'voting' | 'passed' | 'failed' | 'vetoed';
  /** i18n key for a short title shown in the UN panel. */
  titleKey: string;
  /** i18n key for a one-line description shown in the resolution card. */
  descriptionKey: string;
};

/**
 * Template for an action-triggered UN resolution. Lives on the scenario's
 * `unTriggerMap`; instantiated into a UNResolution when the matching action
 * fires. The engine fills proposer/target from action context.
 */
export type UNResolutionTemplate = {
  kind: UNResolutionKind;
  titleKey: string;
  descriptionKey: string;
  votingDurationTicks: number;
  effects: { onPass: EventEffect[]; onFail: EventEffect[] };
};

/** Keys used in `Scenario.unTriggerMap` for action → resolution mapping. */
export type ActionTriggerKey =
  | 'declareWar'
  | 'launchTactical'
  | 'launchStrategic'
  | 'tradeDealLowGdp'
  | 'sanctionsImposed'
  | 'highWorldTension'
  | 'climatePeriodic';

// ---------------------------------------------------------------------------
// Game modes (Phase 3 endless)
// ---------------------------------------------------------------------------

/**
 * - 'classic' — Phase 1+2 behavior. First win condition met → game ends.
 * - 'eternal' — never ends. Victories are toasts; the player chooses to quit.
 * - 'dethrone' — game ends if player drops out of GDP top-3 for 5+ years OR
 *   (when scenario has blocs and `dethroneIsolationOnByDefault`) reputation
 *   < -50 in all blocs for 5+ years.
 * - 'era-paced' — chapters with summary screens (Wave 10+).
 */
export type GameMode = 'classic' | 'eternal' | 'dethrone' | 'era-paced';

/** Cumulative metrics tracked across an Eternal/Dethrone playthrough. */
export type CumulativeStats = {
  peakGdpRank: number;
  peakTreasury: number;
  totalTechsUnlocked: number;
  totalReputationGained: number;
  totalSpyOpsCompleted: number;
  totalTicksPlayed: number;
};

/** Counters maintained by the engine for the Dethrone-loss check. */
export type DethroneStreaks = {
  /** Consecutive ticks the player has been outside GDP top-3. */
  outOfTop3Weeks: number;
  /** Consecutive ticks reputation has been < -50 in ALL blocs simultaneously. */
  isolationWeeks: number;
};

// ---------------------------------------------------------------------------
// Eras (Era-paced mode — Wave 10+)
// ---------------------------------------------------------------------------

export type Era = {
  id: string;
  nameKey: string;
  /** Tick at which the era starts (relative to scenario.startTick). */
  startTick: number;
  /** Tick at which the era ends and a transition modal fires. */
  endTick: number;
};

// ---------------------------------------------------------------------------
// Action log (Replay — Wave 11+, scaffold here for Wave 9 onward to populate)
// ---------------------------------------------------------------------------

export type ActionLogEntry = {
  tick: number;
  countryId: CountryId;
  action: Action;
};

// ===========================================================================
// PHASE 3 — Wave 10 additions (nuclear, space prestige, era runtime)
// ===========================================================================

// ---------------------------------------------------------------------------
// Nuclear weapons (deterrent / tactical / strategic + MAD)
// ---------------------------------------------------------------------------

/**
 * Per-country nuclear arsenal. Only present once a country has researched
 * `tech_*_nuclear_arsenal`. Absent = country has no nuclear capability and
 * cannot launch.
 */
export type NuclearArsenal = {
  warheadCount: number;
  /**
   * Delivery sophistication:
   *   0 = strategic bombers (slow, easier to intercept)
   *   1 = ICBM (fast, hard to intercept)
   *   2 = hypersonic (instant, near-impossible to intercept)
   */
  deliverySystemLevel: 0 | 1 | 2;
  /** Convenience flag: warheadCount > 0. Engine keeps in sync; UI reads this. */
  mad: boolean;
};

// ---------------------------------------------------------------------------
// Space prestige milestones
// ---------------------------------------------------------------------------

/**
 * Per-tech milestone tracking. Populated only for techs that declare
 * `prestigeFirst` / `prestigeFollow` in TechDefinition. Engine fills in
 * `firstAchieverCountryId` and `firstAchievedAtTick` the first time any
 * country completes the tech; subsequent achievers receive the smaller
 * `prestigeFollow` reputation boost.
 */
export type SpaceMilestoneEntry = {
  techId: TechId;
  firstAchieverCountryId: CountryId | null;
  firstAchievedAtTick: number | null;
  /** Country IDs that have completed this tech, in achievement order. */
  achievers: CountryId[];
};

export type SpaceMilestoneState = Record<TechId, SpaceMilestoneEntry>;

// ---------------------------------------------------------------------------
// Era runtime state (Era-paced mode)
// ---------------------------------------------------------------------------

/**
 * Tracks the player's progression through scenario.eras when game mode is
 * 'era-paced'. The pendingTransition field is set non-null when an era ends
 * and the UI should show the EraTransitionModal (engine auto-pauses).
 */
export type EraRuntimeState = {
  /** Index into scenario.eras[] of the currently active era. */
  currentEraIndex: number;
  /** Era IDs the player has completed (chapter screens shown for each). */
  completedEraIds: string[];
  /** Set when an era boundary fires; cleared by acknowledgeEraTransition action. */
  pendingTransition: {
    fromEraId: string;
    toEraId: string;
    ticksAtTransition: number;
    /** Snapshot of cumulative stats at the transition (shown in summary). */
    statsSnapshot: CumulativeStats;
  } | null;
};

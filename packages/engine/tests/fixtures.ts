// Reusable test fixtures: a tiny scenario with 3 countries and a few techs.

import type {
  CountryInit,
  Era,
  EventDefinition,
  RelationInit,
  Scenario,
  ScenarioBlocInit,
  TechDefinition,
  UNResolutionTemplate,
  VictoryConditionDef,
} from '../src/index.js';

export function makeCountry(
  id: string,
  overrides: Partial<CountryInit> = {},
): CountryInit {
  const base: CountryInit = {
    id,
    nameKey: `country.${id}.name`,
    color: '#888888',
    regionId: `region_${id}`,
    capitalKey: `country.${id}.capital`,
    population: 10_000_000,
    economy: {
      treasury: 1_000_000_000,
      gdp: 100_000_000_000,
      weeklyIncome: 0,
      taxRate: 20,
      sectors: { agriculture: 0.1, industry: 0.3, services: 0.4, tech: 0.2 },
    },
    military: {
      armySize: 1000,
      navy: 50,
      airforce: 50,
      doctrineLevel: 0.3,
      deployedUnits: [],
    },
    intelligence: {
      spyCount: 5,
      counterIntelLevel: 0.3,
      knownIntel: {},
    },
    politics: {
      popularity: 50,
      governmentType: 'democracy',
      factions: {
        army: { satisfaction: 50, influence: 20 },
        business: { satisfaction: 50, influence: 25 },
        religious: { satisfaction: 50, influence: 15 },
        populist: { satisfaction: 50, influence: 20 },
        reformist: { satisfaction: 50, influence: 20 },
      },
    },
    isPlayer: false,
    initialCompletedTechs: [],
  };
  return { ...base, ...overrides };
}

export const sampleTechs: TechDefinition[] = [
  {
    id: 'tech_industry_basics',
    nameKey: 'tech.industry.name',
    descriptionKey: 'tech.industry.desc',
    branch: 'civil',
    cost: 50,
    prereqs: [],
    effects: [{ type: 'modifyStat', stat: 'gdp', delta: 1_000_000_000 }],
  },
  {
    id: 'tech_doctrine_basic',
    nameKey: 'tech.doctrine.name',
    descriptionKey: 'tech.doctrine.desc',
    branch: 'military',
    cost: 80,
    prereqs: [],
    effects: [{ type: 'modifyStat', stat: 'doctrineLevel', delta: 0.1 }],
  },
  {
    id: 'tech_intel_basics',
    nameKey: 'tech.intel.name',
    descriptionKey: 'tech.intel.desc',
    branch: 'intelligence',
    cost: 60,
    prereqs: [],
    effects: [{ type: 'modifyStat', stat: 'counterIntelLevel', delta: 0.1 }],
  },
  {
    id: 'tech_advanced_industry',
    nameKey: 'tech.adv.name',
    descriptionKey: 'tech.adv.desc',
    branch: 'civil',
    cost: 200,
    prereqs: ['tech_industry_basics'],
    effects: [{ type: 'modifyStat', stat: 'gdp', delta: 5_000_000_000 }],
  },
];

export const sampleVictoryConditions: VictoryConditionDef[] = [
  {
    id: 'economic',
    nameKey: 'victory.economic.name',
    descriptionKey: 'victory.economic.desc',
    rule: { kind: 'gdpRank', ofPlayer: true, rankAtMost: 1 },
  },
  {
    id: 'scientific',
    nameKey: 'victory.scientific.name',
    descriptionKey: 'victory.scientific.desc',
    rule: { kind: 'completeTech', techId: 'tech_advanced_industry' },
  },
  {
    id: 'diplomatic',
    nameKey: 'victory.diplo.name',
    descriptionKey: 'victory.diplo.desc',
    rule: { kind: 'allianceCoverage', minPercent: 50 },
  },
  {
    id: 'military',
    nameKey: 'victory.military.name',
    descriptionKey: 'victory.military.desc',
    rule: { kind: 'controlNCountries', n: 2 },
  },
  {
    id: 'domination',
    nameKey: 'victory.dom.name',
    descriptionKey: 'victory.dom.desc',
    rule: {
      kind: 'and',
      rules: [
        { kind: 'gdpRank', ofPlayer: true, rankAtMost: 1 },
        { kind: 'controlNCountries', n: 2 },
      ],
    },
  },
];

export const sampleEvents: EventDefinition[] = [
  {
    id: 'event_market_dip',
    nameKey: 'event.dip.name',
    descriptionKey: 'event.dip.desc',
    trigger: { type: 'periodic', everyTicks: 25 },
    cooldownTicks: 10,
    weight: 1,
    choices: [{ labelKey: 'event.dip.ok', effects: [] }],
  },
];

export function makeScenario(): Scenario {
  return {
    id: 'test-scenario',
    nameKey: 'scenario.test.name',
    descriptionKey: 'scenario.test.desc',
    version: '0.0.1-test',
    startTick: 0,
    playableCountries: ['aurion'],
    countries: [
      makeCountry('aurion', { isPlayer: true }),
      makeCountry('borealis', {
        aiPersonality: {
          archetype: 'pacifist_trader',
          aggressiveness: 0.2,
          expansionism: 0.2,
          paranoia: 0.4,
          pragmatism: 0.7,
        },
      }),
      makeCountry('khanate', {
        aiPersonality: {
          archetype: 'regional_bully',
          aggressiveness: 0.8,
          expansionism: 0.6,
          paranoia: 0.5,
          pragmatism: 0.3,
        },
      }),
    ],
    relations: [
      { countryA: 'aurion', countryB: 'borealis', attitude: 30 },
      // attitude < DECLARE_WAR_ATTITUDE_THRESHOLD so war tests still work.
      { countryA: 'aurion', countryB: 'khanate', attitude: -40 },
    ],
    techTree: sampleTechs,
    eventPool: sampleEvents,
    victoryConditions: sampleVictoryConditions,
    difficulties: [
      {
        id: 'easy',
        nameKey: 'diff.easy',
        modifiers: {
          aiAggression: 0.7,
          aiResearchSpeed: 0.85,
          playerIncome: 1.3,
          eventDifficulty: 0.8,
          aiAllianceBias: 0.5,
          spyDetectionAgainstPlayer: 0.7,
          lossToleranceWeeks: 1.5,
          eventChanceMultiplier: 0.9,
        },
      },
      {
        id: 'normal',
        nameKey: 'diff.normal',
        modifiers: {
          aiAggression: 1,
          aiResearchSpeed: 1,
          playerIncome: 1,
          eventDifficulty: 1,
        },
      },
      {
        id: 'hard',
        nameKey: 'diff.hard',
        modifiers: {
          aiAggression: 1.35,
          aiResearchSpeed: 1.2,
          playerIncome: 0.85,
          eventDifficulty: 1.25,
          aiAllianceBias: 1.5,
          spyDetectionAgainstPlayer: 1.3,
          lossToleranceWeeks: 0.75,
          eventChanceMultiplier: 1.15,
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Phase 3 fixture scenario.
// 4 countries split across 2 blocs (western: aurion+borealis; eastern:
// khanate+meridia). Country 'aurion' is the player. UN trigger map declares
// one entry (declareWar → peacekeeping resolution). No eras.
// ---------------------------------------------------------------------------

export const PHASE3_BLOCS: ScenarioBlocInit[] = [
  {
    id: 'western',
    nameKey: 'bloc.western.name',
    foundingMembers: ['aurion', 'borealis'],
    leaderCountryId: 'aurion',
  },
  {
    id: 'eastern',
    nameKey: 'bloc.eastern.name',
    foundingMembers: ['khanate', 'meridia'],
    leaderCountryId: 'khanate',
  },
];

export const PHASE3_PEACEKEEPING_TEMPLATE: UNResolutionTemplate = {
  kind: 'peacekeeping',
  titleKey: 'un.peacekeeping.title',
  descriptionKey: 'un.peacekeeping.desc',
  votingDurationTicks: 4,
  effects: {
    onPass: [
      { type: 'modifyStat', target: 'player', stat: 'worldTension', delta: -5 },
    ],
    onFail: [],
  },
};

// ---------------------------------------------------------------------------
// Space prestige fixture scenario (Wave 10, System 6).
// Adds 3 milestone techs to the Phase 3 fixture so the space module can be
// exercised end-to-end (research completes → recordTechCompletion fires →
// reputation deltas queue → tickReputation drains them).
//
// Costs are intentionally tiny so a tick loop in tests can complete a tech
// in a handful of ticks without the test having to crank the fixture's
// researchOutput. The real scenarios use far larger costs.
// ---------------------------------------------------------------------------

export const SPACE_MILESTONE_TECHS: TechDefinition[] = [
  {
    id: 'tech_space_first_satellite',
    nameKey: 'tech.space.satellite.name',
    descriptionKey: 'tech.space.satellite.desc',
    branch: 'space',
    cost: 100,
    prereqs: [],
    effects: [],
    prestigeFirst: 5,
    prestigeFollow: 2,
  },
  {
    id: 'tech_space_moon_landing',
    nameKey: 'tech.space.moon.name',
    descriptionKey: 'tech.space.moon.desc',
    branch: 'space',
    cost: 500,
    prereqs: [],
    effects: [],
    prestigeFirst: 20,
    prestigeFollow: 8,
  },
  {
    id: 'tech_space_mars_mission',
    nameKey: 'tech.space.mars.name',
    descriptionKey: 'tech.space.mars.desc',
    branch: 'space',
    cost: 2000,
    prereqs: [],
    effects: [],
    prestigeFirst: 30,
    prestigeFollow: 12,
  },
];

/**
 * Phase 3 fixture extended with the 3 milestone techs above. Used by the
 * space module's tests; everything else (blocs, UN, countries) is identical
 * to `makePhase3Scenario`.
 */
export function makeSpaceFixtureScenario(): Scenario {
  const base = makePhase3Scenario();
  return {
    ...base,
    id: 'space-fixture',
    techTree: [...base.techTree, ...SPACE_MILESTONE_TECHS],
  };
}

export const SPACE_FIXTURE_SCENARIO: Scenario = makeSpaceFixtureScenario();

export function makePhase3Scenario(): Scenario {
  const base = makeScenario();
  // Replace the country roster: 4 countries, two per bloc; mark blocId on each.
  const countries: CountryInit[] = [
    makeCountry('aurion', { isPlayer: true, blocId: 'western', economy: { ...makeCountry('aurion').economy, gdp: 200_000_000_000 } }),
    makeCountry('borealis', {
      blocId: 'western',
      aiPersonality: {
        archetype: 'pacifist_trader',
        aggressiveness: 0.2,
        expansionism: 0.2,
        paranoia: 0.4,
        pragmatism: 0.7,
      },
    }),
    makeCountry('khanate', {
      blocId: 'eastern',
      aiPersonality: {
        archetype: 'regional_bully',
        aggressiveness: 0.8,
        expansionism: 0.6,
        paranoia: 0.5,
        pragmatism: 0.3,
      },
    }),
    makeCountry('meridia', {
      blocId: 'eastern',
      economy: { ...makeCountry('meridia').economy, gdp: 150_000_000_000 },
      aiPersonality: {
        archetype: 'superpower',
        aggressiveness: 0.6,
        expansionism: 0.6,
        paranoia: 0.6,
        pragmatism: 0.5,
      },
    }),
  ];

  return {
    ...base,
    id: 'phase3-fixture',
    playableCountries: ['aurion'],
    countries,
    relations: [
      { countryA: 'aurion', countryB: 'borealis', attitude: 50 },
      { countryA: 'aurion', countryB: 'khanate', attitude: -40 },
      { countryA: 'aurion', countryB: 'meridia', attitude: -10 },
      { countryA: 'borealis', countryB: 'khanate', attitude: -30 },
      { countryA: 'khanate', countryB: 'meridia', attitude: 60 },
    ],
    blocs: PHASE3_BLOCS,
    unCouncilMembers: ['aurion', 'khanate', 'meridia'],
    unTriggerMap: {
      declareWar: PHASE3_PEACEKEEPING_TEMPLATE,
      climatePeriodic: {
        kind: 'climate',
        titleKey: 'un.climate.title',
        descriptionKey: 'un.climate.desc',
        votingDurationTicks: 4,
        effects: { onPass: [], onFail: [] },
      },
    },
    dethroneIsolationOnByDefault: true,
  };
}

// ---------------------------------------------------------------------------
// Era-paced fixture scenario (Wave 10, System 5).
// 2 eras spanning ticks [0..50) and [50..100). Identical to the Phase 3
// fixture in every other respect so era tests can reuse the existing
// blocs / countries / UN trigger setup. The endTick of the FINAL era is the
// "narrative end" — checkWinLoss flips the run to 'won' on that tick.
// ---------------------------------------------------------------------------

export const ERA_FIXTURE_ERAS: readonly Era[] = [
  {
    id: 'era_dawn',
    nameKey: 'era.dawn.name',
    startTick: 0,
    endTick: 50,
  },
  {
    id: 'era_zenith',
    nameKey: 'era.zenith.name',
    startTick: 50,
    endTick: 100,
  },
];

export function makeEraFixtureScenario(): Scenario {
  const base = makePhase3Scenario();
  return {
    ...base,
    id: 'era-fixture',
    eras: [...ERA_FIXTURE_ERAS],
  };
}

export const ERA_FIXTURE_SCENARIO: Scenario = makeEraFixtureScenario();

// ---------------------------------------------------------------------------
// Nuclear fixture scenario (Wave 10, System 4).
// Adds 4 nuclear-tech tree nodes following the SPEC-PHASE-3 naming convention
// so `inferArsenalFromTechs` populates `country.nuclear` correctly. Two
// countries (aurion + khanate) start with the basic arsenal tech completed →
// each holds 1 warhead. Borealis stays non-nuclear so unilateral strikes can
// be tested. Aurion and khanate begin AT WAR so launch preconditions pass
// without further setup. Also adds a launchTactical / launchStrategic UN
// trigger map so the condemnation flow is exercised.
// ---------------------------------------------------------------------------

export const NUCLEAR_TECHS: TechDefinition[] = [
  {
    id: 'tech_military_nuclear_research',
    nameKey: 'tech.nuclear.research.name',
    descriptionKey: 'tech.nuclear.research.desc',
    branch: 'military',
    cost: 100,
    prereqs: [],
    effects: [],
  },
  {
    id: 'tech_military_nuclear_arsenal',
    nameKey: 'tech.nuclear.arsenal.name',
    descriptionKey: 'tech.nuclear.arsenal.desc',
    branch: 'military',
    cost: 200,
    prereqs: ['tech_military_nuclear_research'],
    effects: [],
  },
  {
    id: 'tech_military_nuclear_arsenal_advanced',
    nameKey: 'tech.nuclear.advanced.name',
    descriptionKey: 'tech.nuclear.advanced.desc',
    branch: 'military',
    cost: 300,
    prereqs: ['tech_military_nuclear_arsenal'],
    effects: [],
  },
  {
    id: 'tech_military_hypersonic_delivery',
    nameKey: 'tech.nuclear.hypersonic.name',
    descriptionKey: 'tech.nuclear.hypersonic.desc',
    branch: 'military',
    cost: 400,
    prereqs: ['tech_military_nuclear_arsenal_advanced'],
    effects: [],
  },
];

export const NUCLEAR_CONDEMNATION_TEMPLATE: UNResolutionTemplate = {
  kind: 'condemnation',
  titleKey: 'un.condemnation.title',
  descriptionKey: 'un.condemnation.desc',
  votingDurationTicks: 4,
  effects: { onPass: [], onFail: [] },
};

export function makeNuclearFixtureScenario(): Scenario {
  const base = makePhase3Scenario();
  // Pre-arm aurion and khanate by giving each the nuclear arsenal tech.
  // Borealis and meridia stay non-nuclear.
  const countries: CountryInit[] = base.countries.map((c) => {
    if (c.id === 'aurion') {
      return {
        ...c,
        initialCompletedTechs: [
          ...c.initialCompletedTechs,
          'tech_military_nuclear_research',
          'tech_military_nuclear_arsenal',
        ],
      };
    }
    if (c.id === 'khanate') {
      return {
        ...c,
        initialCompletedTechs: [
          ...c.initialCompletedTechs,
          'tech_military_nuclear_research',
          'tech_military_nuclear_arsenal',
        ],
      };
    }
    return c;
  });
  // Aurion at war with khanate by default so launch tests have a valid target.
  const relations: RelationInit[] = base.relations.map((r) => {
    if (
      (r.countryA === 'aurion' && r.countryB === 'khanate') ||
      (r.countryB === 'aurion' && r.countryA === 'khanate')
    ) {
      return { ...r, atWar: true, attitude: -90 };
    }
    return r;
  });
  return {
    ...base,
    id: 'nuclear-fixture',
    countries,
    relations,
    techTree: [...base.techTree, ...NUCLEAR_TECHS],
    unTriggerMap: {
      ...base.unTriggerMap,
      launchTactical: NUCLEAR_CONDEMNATION_TEMPLATE,
      launchStrategic: NUCLEAR_CONDEMNATION_TEMPLATE,
    },
  };
}

export const NUCLEAR_FIXTURE_SCENARIO: Scenario = makeNuclearFixtureScenario();

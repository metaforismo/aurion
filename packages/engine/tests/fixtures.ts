// Reusable test fixtures: a tiny scenario with 3 countries and a few techs.

import type {
  CountryInit,
  EventDefinition,
  RelationInit,
  Scenario,
  TechDefinition,
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

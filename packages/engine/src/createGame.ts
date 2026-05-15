// Builds the initial GameState from a Scenario and CreateGameOptions.

import type {
  Country,
  CountryId,
  CountryInit,
  CreateGameOptions,
  CumulativeStats,
  EconomySectors,
  GameState,
  Relation,
  RelationKey,
  ResearchProgress,
  Scenario,
  TechId,
} from './types.js';
import { initBlocs } from './blocs/index.js';
import { initReputation } from './reputation/index.js';
import { initUN } from './un/index.js';

/** Stable RelationKey: lex-sorted pair so (A,B) and (B,A) collide. */
export function relationKey(a: CountryId, b: CountryId): RelationKey {
  return (a < b ? `${a}::${b}` : `${b}::${a}`) as RelationKey;
}

/**
 * researchOutput is derived from the country's economy sectors and population.
 * Tech and services sectors contribute most. Tunable; numbers chosen to give
 * sensible early-game values (a few research points per tick).
 */
export function deriveResearchOutput(
  sectors: EconomySectors,
  population: number,
  gdp: number,
): number {
  const techWeight = sectors.tech * 4;
  const servicesWeight = sectors.services * 1.5;
  const industryWeight = sectors.industry * 0.6;
  const sectorScore = techWeight + servicesWeight + industryWeight;
  // Scale by population (millions) and gdp (billions). Keep numbers small.
  const popM = Math.max(0, population) / 1_000_000;
  const gdpB = Math.max(0, gdp) / 1_000_000_000;
  const raw = sectorScore * (1 + Math.log10(1 + popM) + Math.log10(1 + gdpB));
  return Math.max(0, Number(raw.toFixed(3)));
}

function initCountry(init: CountryInit): Country {
  const completedTechs: TechId[] = [...init.initialCompletedTechs];
  const country: Country = {
    id: init.id,
    nameKey: init.nameKey,
    color: init.color,
    regionId: init.regionId,
    capitalKey: init.capitalKey,
    population: init.population,
    economy: {
      treasury: init.economy.treasury,
      gdp: init.economy.gdp,
      weeklyIncome: init.economy.weeklyIncome,
      taxRate: init.economy.taxRate,
      sectors: { ...init.economy.sectors },
    },
    military: {
      armySize: init.military.armySize,
      navy: init.military.navy,
      airforce: init.military.airforce,
      doctrineLevel: init.military.doctrineLevel,
      deployedUnits: init.military.deployedUnits.map((d) => ({ ...d })),
    },
    science: {
      researchOutput: deriveResearchOutput(
        init.economy.sectors,
        init.population,
        init.economy.gdp,
      ),
      activeResearch: null,
      completedTechs,
    },
    intelligence: {
      spyCount: init.intelligence.spyCount,
      counterIntelLevel: init.intelligence.counterIntelLevel,
      knownIntel: { ...init.intelligence.knownIntel },
    },
    politics: {
      popularity: init.politics.popularity,
      governmentType: init.politics.governmentType,
      factions: {
        army: { ...init.politics.factions.army },
        business: { ...init.politics.factions.business },
        religious: { ...init.politics.factions.religious },
        populist: { ...init.politics.factions.populist },
        reformist: { ...init.politics.factions.reformist },
      },
    },
    isPlayer: init.isPlayer,
    ...(init.aiPersonality ? { aiPersonality: { ...init.aiPersonality } } : {}),
    ...(init.blocId ? { blocId: init.blocId } : {}),
  };
  return country;
}

export function createGame(scenario: Scenario, options: CreateGameOptions): GameState {
  if (!scenario.playableCountries.includes(options.playerCountryId)) {
    throw new Error(
      `createGame: playerCountryId "${options.playerCountryId}" is not in scenario.playableCountries`,
    );
  }
  const playerExists = scenario.countries.some((c) => c.id === options.playerCountryId);
  if (!playerExists) {
    throw new Error(
      `createGame: playerCountryId "${options.playerCountryId}" not found in scenario.countries`,
    );
  }
  const hasVictory = scenario.victoryConditions.some((v) => v.id === options.victory);
  if (!hasVictory) {
    throw new Error(
      `createGame: victory "${options.victory}" not in scenario.victoryConditions`,
    );
  }

  // Build countries record, marking the player and stripping isPlayer otherwise.
  const countries: Record<CountryId, Country> = {};
  const techTreeProgress: Record<CountryId, ResearchProgress> = {};
  for (const init of scenario.countries) {
    const country = initCountry(init);
    // Force isPlayer flag to match options.playerCountryId for safety.
    country.isPlayer = country.id === options.playerCountryId;
    countries[country.id] = country;
    techTreeProgress[country.id] = { activeResearch: null, accumulatedPoints: 0 };
  }

  // Build relations record from RelationInit[].
  const relations: Record<RelationKey, Relation> = {};
  for (const r of scenario.relations) {
    if (r.countryA === r.countryB) continue;
    if (!countries[r.countryA] || !countries[r.countryB]) continue;
    const key = relationKey(r.countryA, r.countryB);
    // Sorted-pair canonicalization: store the sorted (countryA, countryB) form.
    const [a, b] = r.countryA < r.countryB
      ? [r.countryA, r.countryB]
      : [r.countryB, r.countryA];
    relations[key] = {
      countryA: a,
      countryB: b,
      attitude: r.attitude,
      treaties: r.treaties ? [...r.treaties] : [],
      atWar: r.atWar ?? false,
    };
  }

  // Ensure every pair has a (default) relation entry to simplify lookups elsewhere.
  const ids = Object.keys(countries).sort();
  for (let i = 0; i < ids.length; i++) {
    const a = ids[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < ids.length; j++) {
      const b = ids[j];
      if (b === undefined) continue;
      const key = relationKey(a, b);
      if (!relations[key]) {
        relations[key] = {
          countryA: a,
          countryB: b,
          attitude: 0,
          treaties: [],
          atWar: false,
        };
      }
    }
  }

  // Pick difficulty: explicit id > 'normal' fallback > first entry in scenario.
  const requestedDifficultyId = options.difficultyId ?? 'normal';
  const matchedDifficulty =
    scenario.difficulties.find((d) => d.id === requestedDifficultyId) ??
    (options.difficultyId === undefined ? scenario.difficulties[0] : undefined);
  if (!matchedDifficulty) {
    throw new Error(
      `createGame: difficultyId "${requestedDifficultyId}" not found in scenario.difficulties`,
    );
  }
  const difficultyId = matchedDifficulty.id;
  const seed = options.seed ?? `${scenario.id}::${options.playerCountryId}::${Date.now()}`;

  const baseState: GameState = {
    tick: scenario.startTick,
    scenarioId: scenario.id,
    difficultyId,
    playerCountryId: options.playerCountryId,
    countries,
    relations,
    techTreeProgress,
    spyOperations: [],
    events: [],
    worldTension: 0,
    winLoss: 'playing',
    selectedVictoryCondition: options.victory,
    rngSeed: seed,
  };

  // Phase 3 initialisation. All fields are optional and only populated when
  // the scenario opts in (declares blocs / unTriggerMap / unCouncilMembers).
  const reputation = initReputation(scenario);
  const blocs = initBlocs(scenario, scenario.startTick);
  const unResolutions = initUN(scenario);

  // GameMode: only stamp the field when caller explicitly chose one. Saves
  // without a gameMode are treated as 'classic' wherever the engine reads it.
  const gameMode = options.gameMode;
  const effectiveGameMode = gameMode ?? 'classic';

  // Cumulative stats and unlockedVictories are tracked for non-classic modes.
  const wantsCumulative = effectiveGameMode !== 'classic';
  const cumulativeStats: CumulativeStats | undefined = wantsCumulative
    ? {
        peakGdpRank: 999,
        peakTreasury: countries[options.playerCountryId]?.economy.treasury ?? 0,
        totalTechsUnlocked: countries[options.playerCountryId]?.science.completedTechs.length ?? 0,
        totalReputationGained: 0,
        totalSpyOpsCompleted: 0,
        totalTicksPlayed: 0,
      }
    : undefined;

  const state: GameState = {
    ...baseState,
    ...(reputation !== undefined ? { reputation, pendingReputationDeltas: [] } : {}),
    ...(blocs !== undefined ? { blocs } : {}),
    ...(unResolutions !== undefined ? { unResolutions } : {}),
    ...(gameMode !== undefined ? { gameMode } : {}),
    ...(cumulativeStats !== undefined ? { cumulativeStats } : {}),
    ...(wantsCumulative ? { unlockedVictories: [], actionLog: [] } : {}),
  };
  return state;
}

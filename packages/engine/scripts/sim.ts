// Headless simulation runner.
// Loads `apps/web/content/scenarios/ascesa-aurion.json` if it exists,
// otherwise falls back to a small mock scenario built inline. Then runs
// N games where every country (including the "player" slot) is driven by AI,
// and prints win/loss/timeout distribution + average ticks-to-completion.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyAction } from '../src/actions/index.js';
import { decideAiAction } from '../src/ai/index.js';
import { createGame } from '../src/createGame.js';
import { createRng } from '../src/rng.js';
import { tick } from '../src/tick.js';
import type { Action, AiPersonality, GameState, Scenario } from '../src/index.js';

const SCENARIO_PATH = resolve(
  process.cwd(),
  '../../apps/web/content/scenarios/ascesa-aurion.json',
);
const RUNS = Number.parseInt(process.env['SIM_RUNS'] ?? '100', 10);
const MAX_TICKS = 2000;

function loadScenario(): Scenario {
  if (existsSync(SCENARIO_PATH)) {
    try {
      const raw = readFileSync(SCENARIO_PATH, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      // Trust the scenario file's shape; engine validates at createGame time.
      return parsed as Scenario;
    } catch (e) {
      console.warn(`Could not read scenario at ${SCENARIO_PATH}, using mock:`, e);
    }
  } else {
    console.warn(`Scenario file not found at ${SCENARIO_PATH}, using mock.`);
  }
  return mockScenario();
}

function mockScenario(): Scenario {
  const personalities: AiPersonality[] = [
    { archetype: 'pacifist_trader', aggressiveness: 0.2, expansionism: 0.2, paranoia: 0.4, pragmatism: 0.7 },
    { archetype: 'regional_bully', aggressiveness: 0.8, expansionism: 0.6, paranoia: 0.5, pragmatism: 0.3 },
    { archetype: 'opportunist', aggressiveness: 0.5, expansionism: 0.5, paranoia: 0.5, pragmatism: 0.6 },
    { archetype: 'cold_isolationist', aggressiveness: 0.3, expansionism: 0.2, paranoia: 0.7, pragmatism: 0.4 },
    { archetype: 'superpower', aggressiveness: 0.6, expansionism: 0.6, paranoia: 0.6, pragmatism: 0.5 },
  ];
  const colors = ['#aa3333', '#33aa33', '#3333aa', '#aaaa33', '#aa33aa'];
  const countries = Array.from({ length: 5 }, (_, i) => {
    const id = `nation_${i}`;
    return {
      id,
      nameKey: `country.${id}`,
      color: colors[i] ?? '#888',
      regionId: `region_${id}`,
      capitalKey: `country.${id}.capital`,
      population: 5_000_000 + i * 1_000_000,
      economy: {
        treasury: 1_000_000_000,
        gdp: 100_000_000_000,
        weeklyIncome: 0,
        taxRate: 20,
        sectors: { agriculture: 0.1, industry: 0.3, services: 0.4, tech: 0.2 },
      },
      military: {
        armySize: 1000,
        navy: 100,
        airforce: 100,
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
        governmentType: 'democracy' as const,
        factions: {
          army: { satisfaction: 50, influence: 20 },
          business: { satisfaction: 50, influence: 20 },
          religious: { satisfaction: 50, influence: 20 },
          populist: { satisfaction: 50, influence: 20 },
          reformist: { satisfaction: 50, influence: 20 },
        },
      },
      isPlayer: i === 0,
      aiPersonality: personalities[i % personalities.length],
      initialCompletedTechs: [],
    };
  });
  return {
    id: 'mock-sim',
    nameKey: 'sim.mock',
    descriptionKey: 'sim.mock.desc',
    version: '0.0.0',
    startTick: 0,
    playableCountries: ['nation_0'],
    countries,
    relations: [],
    techTree: [
      {
        id: 'tech_basic',
        nameKey: 'tech.basic',
        descriptionKey: 'tech.basic',
        branch: 'civil',
        cost: 50,
        prereqs: [],
        effects: [{ type: 'modifyStat', stat: 'gdp', delta: 1_000_000_000 }],
      },
    ],
    eventPool: [],
    victoryConditions: [
      {
        id: 'economic',
        nameKey: 'v.eco',
        descriptionKey: 'v.eco',
        rule: { kind: 'gdpRank', ofPlayer: true, rankAtMost: 1 },
      },
    ],
    difficulties: [
      {
        id: 'normal',
        nameKey: 'd.normal',
        modifiers: { aiAggression: 1, aiResearchSpeed: 1, playerIncome: 1, eventDifficulty: 1 },
      },
    ],
  };
}

type Outcome = 'won' | 'lost' | 'timeout';
type Result = { outcome: Outcome; ticks: number };

function runOne(scenario: Scenario, seed: string): Result {
  let s: GameState = createGame(scenario, {
    seed,
    victory: scenario.victoryConditions[0]?.id ?? 'economic',
    playerCountryId: scenario.playableCountries[0] ?? scenario.countries[0]!.id,
  });

  const playerRng = createRng(`${seed}::playerAi`);
  const playerId = s.playerCountryId;
  const techCatalog = scenario.techTree;
  const eventPool = scenario.eventPool;
  const victoryRule = scenario.victoryConditions[0]?.rule;

  // Force-attach an AI personality to the "player" so all countries are AI-driven.
  // Default archetype matches the scenario fantasy ("small nation rising peacefully"):
  // a pacifist_trader baseline keeps the sim from immediately auto-declaring war on
  // every neighbour, so we measure scenario balance rather than self-induced collapse.
  s = {
    ...s,
    countries: {
      ...s.countries,
      [playerId]: {
        ...s.countries[playerId]!,
        aiPersonality: s.countries[playerId]!.aiPersonality ?? {
          archetype: 'pacifist_trader',
          aggressiveness: 0.2,
          expansionism: 0.2,
          paranoia: 0.4,
          pragmatism: 0.7,
        },
      },
    },
  };

  for (let i = 0; i < MAX_TICKS; i++) {
    if (s.winLoss !== 'playing') break;
    // Player slot: also let AI act.
    const action: Action | null = decideAiAction(s, playerId, playerRng, techCatalog);
    if (action) {
      const r = applyAction(s, action, playerId, techCatalog);
      if (r.errors.length === 0) s = r.state;
    }
    s = tick(s, { techCatalog, eventPool, victoryRule });
  }

  if (s.winLoss === 'won') return { outcome: 'won', ticks: s.tick };
  if (s.winLoss === 'lost') return { outcome: 'lost', ticks: s.tick };
  return { outcome: 'timeout', ticks: s.tick };
}

function main(): void {
  const scenario = loadScenario();
  const counts: Record<Outcome, number> = { won: 0, lost: 0, timeout: 0 };
  let totalTicks = 0;
  let crashes = 0;

  console.log(`Running ${RUNS} simulations on scenario "${scenario.id}" (max ${MAX_TICKS} ticks each)…`);
  for (let i = 0; i < RUNS; i++) {
    try {
      const res = runOne(scenario, `seed-${i}`);
      counts[res.outcome]++;
      totalTicks += res.ticks;
    } catch (e) {
      crashes++;
      console.error(`Run ${i} crashed:`, e);
    }
  }
  const completed = RUNS - crashes;
  const avgTicks = completed > 0 ? (totalTicks / completed).toFixed(1) : 'n/a';
  console.log('---');
  console.log(`Won:     ${counts.won}`);
  console.log(`Lost:    ${counts.lost}`);
  console.log(`Timeout: ${counts.timeout}`);
  console.log(`Crashes: ${crashes}`);
  console.log(`Avg ticks-to-completion: ${avgTicks}`);
  if (crashes > 0) process.exitCode = 1;
}

main();

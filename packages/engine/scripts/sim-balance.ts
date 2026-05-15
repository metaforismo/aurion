// Sim balance runner.
//
// Always runs all 3 difficulties N times each on the chosen scenario and
// prints a markdown table with win/loss/timeout percentages. Exits non-zero if
// any difficulty's win-rate strays from the Phase 2 target by more than
// `WIN_RATE_SLACK_PP` percentage points.
//
// The `WIN_RATE_SLACK_PP = 25` value is intentionally loose for first-pass
// scaffolding so that early Phase 2 work doesn't break CI; tighten this to
// match `docs/SPEC-PHASE-2.md` (±10pp in Phase 2, stricter in Phase 3) once
// the engine + content have stabilised.
//
// Env knobs (mirrors sim.ts so the two stay in sync):
//   SIM_RUNS=100                                — number of runs per difficulty
//   SIM_SCENARIO=ascesa-aurion|quick-start|...  — which scenario JSON to load
//   SIM_PLAYER_ARCHETYPE=opportunist|...        — archetype for the player AI slot
//   SIM_PLAYER_COUNTRY=<countryId>              — country in the player slot
//   SIM_VICTORY=economic|military|...           — victory condition
//
// Defaults (opportunist player + economic victory) are deliberately tuned to
// surface difficulty in the distribution. The historical defaults
// (pacifist_trader + economic) hid the difficulty signal because the
// pacifist_trader spent its turns growing GDP while other AIs fought, so
// Hard's `aiAggression` ended up *helping* the player by destroying its
// rivals' GDP. The opportunist plays more aggressively and is exposed to
// `playerIncome`, `aiResearchSpeed`, and AI-on-player aggression — the
// three modifiers that actually map to "harder for the player".

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyAction } from '../src/actions/index.js';
import { decideAiAction } from '../src/ai/index.js';
import { createGame } from '../src/createGame.js';
import { createRng } from '../src/rng.js';
import { tick } from '../src/tick.js';
import type {
  Action,
  AiArchetype,
  AiPersonality,
  DifficultyTuning,
  GameState,
  Scenario,
  VictoryConditionId,
} from '../src/index.js';

type DifficultyId = 'easy' | 'normal' | 'hard';
type Outcome = 'won' | 'lost' | 'timeout';

const KNOWN_ARCHETYPES: readonly AiArchetype[] = [
  'pacifist_trader',
  'regional_bully',
  'cold_isolationist',
  'opportunist',
  'superpower',
];
const KNOWN_VICTORIES: readonly VictoryConditionId[] = [
  'economic',
  'military',
  'scientific',
  'diplomatic',
  'domination',
];

const RUNS = Number.parseInt(process.env['SIM_RUNS'] ?? '100', 10);
const MAX_TICKS = 2000;
const SCENARIO_ID = (process.env['SIM_SCENARIO'] ?? 'ascesa-aurion').trim();
const PLAYER_ARCHETYPE: AiArchetype = parseArchetype(process.env['SIM_PLAYER_ARCHETYPE']);
const PLAYER_COUNTRY_OVERRIDE = (process.env['SIM_PLAYER_COUNTRY'] ?? '').trim() || undefined;
const VICTORY_ID: VictoryConditionId = parseVictory(process.env['SIM_VICTORY']);

function parseArchetype(raw: string | undefined): AiArchetype {
  if (!raw) return 'opportunist';
  const v = raw.trim() as AiArchetype;
  if (KNOWN_ARCHETYPES.includes(v)) return v;
  console.warn(`Unknown SIM_PLAYER_ARCHETYPE="${raw}", defaulting to "opportunist".`);
  return 'opportunist';
}

function parseVictory(raw: string | undefined): VictoryConditionId {
  if (!raw) return 'economic';
  const v = raw.trim() as VictoryConditionId;
  if (KNOWN_VICTORIES.includes(v)) return v;
  console.warn(`Unknown SIM_VICTORY="${raw}", defaulting to "economic".`);
  return 'economic';
}

const PERSONALITY_BY_ARCHETYPE: Record<AiArchetype, AiPersonality> = {
  pacifist_trader: { archetype: 'pacifist_trader', aggressiveness: 0.2, expansionism: 0.2, paranoia: 0.4, pragmatism: 0.7 },
  regional_bully: { archetype: 'regional_bully', aggressiveness: 0.8, expansionism: 0.6, paranoia: 0.5, pragmatism: 0.3 },
  cold_isolationist: { archetype: 'cold_isolationist', aggressiveness: 0.3, expansionism: 0.2, paranoia: 0.7, pragmatism: 0.4 },
  opportunist: { archetype: 'opportunist', aggressiveness: 0.5, expansionism: 0.5, paranoia: 0.5, pragmatism: 0.6 },
  superpower: { archetype: 'superpower', aggressiveness: 0.6, expansionism: 0.6, paranoia: 0.6, pragmatism: 0.5 },
};

/**
 * Acceptable deviation (in percentage points) of measured win-rate from the
 * Phase 2 target before we consider the balance broken. Loose on purpose for
 * first-pass scaffolding — tighten as the tuning pass progresses.
 */
const WIN_RATE_SLACK_PP = 25;

/** Phase 2 target distributions, from `docs/SPEC-PHASE-2.md`. */
const TARGETS: Record<
  DifficultyId,
  { winRatePct: number; timeoutPct: number; lossPct: number }
> = {
  easy: { winRatePct: 50, timeoutPct: 30, lossPct: 20 },
  normal: { winRatePct: 30, timeoutPct: 40, lossPct: 30 },
  hard: { winRatePct: 10, timeoutPct: 30, lossPct: 60 },
};

/**
 * Difficulty presets, mirroring `docs/SPEC-PHASE-2.md`. Used as a fallback
 * when the scenario JSON hasn't been updated yet to ship the easy/hard
 * tunings (Phase 2 in flight).
 */
const DIFFICULTY_PRESETS: Record<DifficultyId, DifficultyTuning> = {
  easy: {
    id: 'easy',
    nameKey: 'difficulty.easy.name',
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
  normal: {
    id: 'normal',
    nameKey: 'difficulty.normal.name',
    modifiers: {
      aiAggression: 1.0,
      aiResearchSpeed: 1.0,
      playerIncome: 1.0,
      eventDifficulty: 1.0,
      aiAllianceBias: 1.0,
      spyDetectionAgainstPlayer: 1.0,
      lossToleranceWeeks: 1.0,
      eventChanceMultiplier: 1.0,
    },
  },
  hard: {
    id: 'hard',
    nameKey: 'difficulty.hard.name',
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
};

function scenarioPath(id: string): string {
  return resolve(process.cwd(), `../../apps/web/content/scenarios/${id}.json`);
}

function loadScenario(id: string): Scenario {
  const path = scenarioPath(id);
  if (existsSync(path)) {
    try {
      const raw = readFileSync(path, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      return parsed as Scenario;
    } catch (e) {
      console.warn(`Could not read scenario at ${path}, using mock:`, e);
    }
  } else {
    console.warn(`Scenario file not found at ${path}, using mock.`);
  }
  return mockScenario();
}

function mockScenario(): Scenario {
  // Compact 5-country fallback so the balance script remains useful in a
  // scratch checkout. Mirrors sim.ts's mock; kept inline (no shared module)
  // to stay self-contained and avoid the script importing from the other.
  const personalities: AiPersonality[] = [
    PERSONALITY_BY_ARCHETYPE.pacifist_trader,
    PERSONALITY_BY_ARCHETYPE.regional_bully,
    PERSONALITY_BY_ARCHETYPE.opportunist,
    PERSONALITY_BY_ARCHETYPE.cold_isolationist,
    PERSONALITY_BY_ARCHETYPE.superpower,
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
    id: 'mock-balance',
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
      {
        id: 'military',
        nameKey: 'v.mil',
        descriptionKey: 'v.mil',
        rule: { kind: 'controlNCountries', n: 4 },
      },
    ],
    difficulties: [
      DIFFICULTY_PRESETS.easy,
      DIFFICULTY_PRESETS.normal,
      DIFFICULTY_PRESETS.hard,
    ],
  };
}

function resolveDifficulty(scenario: Scenario, id: DifficultyId): DifficultyTuning {
  return scenario.difficulties.find((d) => d.id === id) ?? DIFFICULTY_PRESETS[id];
}

function resolveSetup(scenario: Scenario): {
  victoryId: VictoryConditionId;
  playerCountryId: string;
} {
  const victoryId: VictoryConditionId = scenario.victoryConditions.some(
    (v) => v.id === VICTORY_ID,
  )
    ? VICTORY_ID
    : ((scenario.victoryConditions[0]?.id ?? 'economic') as VictoryConditionId);
  if (victoryId !== VICTORY_ID) {
    console.warn(
      `Scenario "${scenario.id}" has no victory "${VICTORY_ID}"; falling back to "${victoryId}".`,
    );
  }
  const playerCountryId =
    PLAYER_COUNTRY_OVERRIDE && scenario.playableCountries.includes(PLAYER_COUNTRY_OVERRIDE)
      ? PLAYER_COUNTRY_OVERRIDE
      : (scenario.playableCountries[0] ?? scenario.countries[0]!.id);
  if (PLAYER_COUNTRY_OVERRIDE && playerCountryId !== PLAYER_COUNTRY_OVERRIDE) {
    console.warn(
      `Scenario "${scenario.id}" has no playable country "${PLAYER_COUNTRY_OVERRIDE}"; falling back to "${playerCountryId}".`,
    );
  }
  return { victoryId, playerCountryId };
}

type Result = { outcome: Outcome; ticks: number };

function runOne(
  scenario: Scenario,
  difficulty: DifficultyTuning,
  seed: string,
  victoryId: VictoryConditionId,
  playerCountryId: string,
): Result {
  let s: GameState = createGame(scenario, {
    seed,
    victory: victoryId,
    playerCountryId,
    difficultyId: difficulty.id,
  });

  const playerRng = createRng(`${seed}::playerAi`);
  const playerId = s.playerCountryId;
  const techCatalog = scenario.techTree;
  const eventPool = scenario.eventPool;
  // Match sim.ts: pick the rule for the selected victory id, not just [0].
  const victoryRule = scenario.victoryConditions.find((v) => v.id === victoryId)?.rule;

  // Same convention as sim.ts: ensure the "player" slot has an AI personality
  // so balance runs are fully self-driven.
  s = {
    ...s,
    countries: {
      ...s.countries,
      [playerId]: {
        ...s.countries[playerId]!,
        aiPersonality: PERSONALITY_BY_ARCHETYPE[PLAYER_ARCHETYPE],
      },
    },
  };

  for (let i = 0; i < MAX_TICKS; i++) {
    if (s.winLoss !== 'playing') break;
    // Player slot: AI-driven for the sim, but deliberately WITHOUT the
    // difficulty modifiers. The world around the player changes (AIs become
    // more aggressive on Hard, proposeAlliance bias rises on Easy via the
    // *other* countries) — the player itself is the constant the difficulty
    // tuning is measured against.
    const action: Action | null = decideAiAction(s, playerId, playerRng, techCatalog);
    if (action) {
      const r = applyAction(s, action, playerId, techCatalog);
      if (r.errors.length === 0) s = r.state;
    }
    s = tick(s, { techCatalog, eventPool, victoryRule, difficulty });
  }

  if (s.winLoss === 'won') return { outcome: 'won', ticks: s.tick };
  if (s.winLoss === 'lost') return { outcome: 'lost', ticks: s.tick };
  return { outcome: 'timeout', ticks: s.tick };
}

type Distribution = {
  difficulty: DifficultyId;
  runs: number;
  counts: Record<Outcome, number>;
  crashes: number;
  avgTicks: number;
  winRatePct: number;
  lossRatePct: number;
  timeoutRatePct: number;
};

function runMany(
  scenario: Scenario,
  difficulty: DifficultyTuning,
  runs: number,
  victoryId: VictoryConditionId,
  playerCountryId: string,
): Distribution {
  const counts: Record<Outcome, number> = { won: 0, lost: 0, timeout: 0 };
  let totalTicks = 0;
  let crashes = 0;
  for (let i = 0; i < runs; i++) {
    try {
      const res = runOne(
        scenario,
        difficulty,
        `${difficulty.id}-bal-${i}`,
        victoryId,
        playerCountryId,
      );
      counts[res.outcome]++;
      totalTicks += res.ticks;
    } catch (e) {
      crashes++;
      console.error(`Run ${i} (${difficulty.id}) crashed:`, e);
    }
  }
  const completed = runs - crashes;
  const denom = completed > 0 ? completed : 1;
  return {
    difficulty: difficulty.id as DifficultyId,
    runs,
    counts,
    crashes,
    avgTicks: completed > 0 ? totalTicks / completed : 0,
    winRatePct: (counts.won / denom) * 100,
    lossRatePct: (counts.lost / denom) * 100,
    timeoutRatePct: (counts.timeout / denom) * 100,
  };
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function printConfig(scenario: Scenario, victoryId: VictoryConditionId, playerCountryId: string): void {
  console.log('Sim configuration:');
  console.log(`  Scenario:          ${scenario.id}`);
  console.log(`  Player country:    ${playerCountryId}`);
  console.log(`  Player archetype:  ${PLAYER_ARCHETYPE}`);
  console.log(`  Victory condition: ${victoryId}`);
  console.log(`  Runs/difficulty:   ${RUNS}`);
  console.log(`  Max ticks/run:     ${MAX_TICKS}`);
}

function printMarkdownTable(scenario: Scenario, results: readonly Distribution[]): void {
  console.log('');
  console.log(
    `## Balance: \`${scenario.id}\` — ${results[0]?.runs ?? 0} runs / difficulty`,
  );
  console.log('');
  console.log(
    '| Difficulty | Won | Lost | Timeout | Avg ticks | Crashes | Target win | Δ vs target |',
  );
  console.log(
    '|------------|----:|-----:|--------:|----------:|--------:|-----------:|-------------|',
  );
  for (const d of results) {
    const target = TARGETS[d.difficulty];
    const delta = d.winRatePct - target.winRatePct;
    const deltaStr = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}pp`;
    const ok = Math.abs(delta) <= WIN_RATE_SLACK_PP ? 'OK' : 'OUT';
    console.log(
      `| ${d.difficulty} | ${fmtPct(d.winRatePct)} | ${fmtPct(d.lossRatePct)} | ` +
        `${fmtPct(d.timeoutRatePct)} | ${d.avgTicks.toFixed(1)} | ${d.crashes} | ` +
        `${fmtPct(target.winRatePct)} | ${deltaStr} (${ok}) |`,
    );
  }
  console.log('');
  console.log(
    `Slack: ±${WIN_RATE_SLACK_PP}pp on win-rate (loose first-pass scaffolding). ` +
      `Tighten in docs/SPEC-PHASE-2.md once tuning has settled.`,
  );
}

function main(): void {
  const scenario = loadScenario(SCENARIO_ID);
  const { victoryId, playerCountryId } = resolveSetup(scenario);
  printConfig(scenario, victoryId, playerCountryId);
  console.log(
    `Running ${RUNS} simulations per difficulty on scenario "${scenario.id}" ` +
      `(max ${MAX_TICKS} ticks each)…`,
  );
  const results: Distribution[] = (['easy', 'normal', 'hard'] as const).map((id) =>
    runMany(scenario, resolveDifficulty(scenario, id), RUNS, victoryId, playerCountryId),
  );
  printMarkdownTable(scenario, results);

  let exitCode = 0;
  if (results.some((r) => r.crashes > 0)) {
    console.error('FAIL: one or more runs crashed.');
    exitCode = 1;
  }
  const offenders = results.filter(
    (r) => Math.abs(r.winRatePct - TARGETS[r.difficulty].winRatePct) > WIN_RATE_SLACK_PP,
  );
  if (offenders.length > 0) {
    for (const r of offenders) {
      const target = TARGETS[r.difficulty];
      console.error(
        `FAIL: ${r.difficulty} win-rate ${fmtPct(r.winRatePct)} is more than ` +
          `${WIN_RATE_SLACK_PP}pp from target ${fmtPct(target.winRatePct)}.`,
      );
    }
    exitCode = 1;
  }
  if (exitCode !== 0) process.exitCode = exitCode;
}

main();

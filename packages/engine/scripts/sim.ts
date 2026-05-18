// Headless simulation runner.
//
// Loads a scenario JSON from `apps/web/content/scenarios/<scenario>.json` if
// it exists, otherwise falls back to a small mock scenario built inline. Then
// runs N games where every country (including the "player" slot) is driven by
// AI, and prints win/loss/timeout distribution + average ticks-to-completion.
//
// Env knobs:
//   SIM_RUNS=100                                — number of runs (per difficulty)
//   SIM_DIFFICULTY=easy|normal|hard             — which difficulty preset to use
//   SIM_SCENARIO=ascesa-aurion|quick-start|...  — which scenario JSON to load
//   SIM_COMPARE=true                            — run all 3 difficulties + table
//   SIM_PLAYER_ARCHETYPE=pacifist_trader|opportunist|regional_bully|cold_isolationist|superpower
//                                               — archetype for the player AI slot
//   SIM_PLAYER_COUNTRY=<countryId>              — country in the player slot
//   SIM_VICTORY=economic|military|scientific|diplomatic|domination
//                                               — victory condition the player tries to reach
//
// Defaults are chosen to expose difficulty in the win/loss/timeout
// distribution. The combination is `opportunist` player AI chasing the
// `economic` (top-3 GDP) victory: Aurion starts well outside the top 3,
// so the player has to actively grow / steal tech / outmaneuver larger
// rivals. Easy gives them income room to do it, Hard makes the same
// growth slow enough that timeouts dominate.

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyAction } from '../src/actions/index.js';
import { decideAiAction } from '../src/ai/index.js';
import { createGame } from '../src/createGame.js';
import { createRng } from '../src/rng.js';
import { tick } from '../src/tick.js';
import {
  BUILTIN_ACHIEVEMENTS,
  evaluateAchievements,
} from '../src/achievements/index.js';
import type {
  Action,
  AiArchetype,
  AiPersonality,
  DifficultyTuning,
  GameState,
  Scenario,
  VictoryConditionId,
} from '../src/index.js';

export type DifficultyId = 'easy' | 'normal' | 'hard';

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
const COMPARE = (process.env['SIM_COMPARE'] ?? '').toLowerCase() === 'true';
const DIFFICULTY_ID: DifficultyId = parseDifficulty(process.env['SIM_DIFFICULTY']);
/**
 * Default to an `opportunist` player: middle-of-the-road AI that does spend
 * on research/military and is therefore exposed to bankruptcy and to wars
 * it can't sustain — much more difficulty-sensitive than the historical
 * `pacifist_trader` default which auto-wins by sitting on top GDP.
 */
const PLAYER_ARCHETYPE: AiArchetype = parseArchetype(process.env['SIM_PLAYER_ARCHETYPE']);
const PLAYER_COUNTRY_OVERRIDE = (process.env['SIM_PLAYER_COUNTRY'] ?? '').trim() || undefined;
/**
 * Default to the `economic` victory (top-3 GDP). With an `opportunist`
 * player on Aurion (who starts at GDP rank ~16/25), Easy lets the player
 * out-grow rivals via tech / spies; Normal makes it a coin flip; Hard's
 * `playerIncome` reduction + faster AI research keeps Aurion off the
 * podium. This combo is empirically the cleanest difficulty signal on
 * the current `ascesa-aurion` scenario — see `sim-balance` output. We
 * deliberately avoid `military` / `domination` here because their
 * `controlNCountries` rule interacts with `aiAllianceBias`: on Hard,
 * AIs propose alliance with the player too eagerly and trivially win
 * the count, inverting the difficulty signal.
 */
const VICTORY_ID: VictoryConditionId = parseVictory(process.env['SIM_VICTORY']);

/**
 * Optional JSONL trace path. When set, every tick of every run emits one JSON
 * line summarising the player state plus any "interesting" events that fired
 * since the previous tick (UN outcome, bloc transition, nuclear strike, era
 * transition, achievement unlock). Used by audit tooling and as a smoke-test
 * artefact for the engine — set to /tmp/sim.jsonl to inspect a single run.
 */
const SIM_JSONL_PATH = (process.env['SIM_JSONL'] ?? '').trim() || undefined;

function parseDifficulty(raw: string | undefined): DifficultyId {
  const v = (raw ?? 'normal').toLowerCase();
  if (v === 'easy' || v === 'normal' || v === 'hard') return v;
  console.warn(`Unknown SIM_DIFFICULTY="${raw}", defaulting to "normal".`);
  return 'normal';
}

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

/**
 * Personality presets per archetype. Mirrors the values used in the mock
 * scenario below and in scenario JSONs; kept here so a single env knob
 * (`SIM_PLAYER_ARCHETYPE`) is enough to retune the player slot for a sim run.
 */
export const PERSONALITY_BY_ARCHETYPE: Record<AiArchetype, AiPersonality> = {
  pacifist_trader: { archetype: 'pacifist_trader', aggressiveness: 0.2, expansionism: 0.2, paranoia: 0.4, pragmatism: 0.7 },
  regional_bully: { archetype: 'regional_bully', aggressiveness: 0.8, expansionism: 0.6, paranoia: 0.5, pragmatism: 0.3 },
  cold_isolationist: { archetype: 'cold_isolationist', aggressiveness: 0.3, expansionism: 0.2, paranoia: 0.7, pragmatism: 0.4 },
  opportunist: { archetype: 'opportunist', aggressiveness: 0.5, expansionism: 0.5, paranoia: 0.5, pragmatism: 0.6 },
  superpower: { archetype: 'superpower', aggressiveness: 0.6, expansionism: 0.6, paranoia: 0.6, pragmatism: 0.5 },
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
      // Trust the scenario file's shape; engine validates at createGame time.
      return parsed as Scenario;
    } catch (e) {
      console.warn(`Could not read scenario at ${path}, using mock:`, e);
    }
  } else {
    console.warn(`Scenario file not found at ${path}, using mock.`);
  }
  return mockScenario();
}

// ---------------------------------------------------------------------------
// Difficulty presets.
//
// Mirrors `docs/SPEC-PHASE-2.md` — used as a fallback when the scenario JSON
// hasn't been updated yet to ship the easy/hard tunings (Phase 2 in flight).
// We prefer a scenario's own DifficultyTuning entry if present so content
// authors can override per-scenario.
// ---------------------------------------------------------------------------

export const DIFFICULTY_PRESETS: Record<DifficultyId, DifficultyTuning> = {
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

/**
 * Pick the DifficultyTuning to feed to the engine for `id`.
 *
 * Preference order:
 *   1. Scenario JSON's own entry with that id (authors may override).
 *   2. Hard-coded preset from `docs/SPEC-PHASE-2.md`.
 */
export function resolveDifficulty(scenario: Scenario, id: DifficultyId): DifficultyTuning {
  const fromScenario = scenario.difficulties.find((d) => d.id === id);
  return fromScenario ?? DIFFICULTY_PRESETS[id];
}

function mockScenario(): Scenario {
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
      {
        id: 'military',
        nameKey: 'v.mil',
        descriptionKey: 'v.mil',
        rule: { kind: 'controlNCountries', n: 4 },
      },
    ],
    // Mock ships all 3 phase-2 presets so a default sim works without a real
    // scenario JSON or a content-side update to add easy/hard tunings.
    difficulties: [
      DIFFICULTY_PRESETS.easy,
      DIFFICULTY_PRESETS.normal,
      DIFFICULTY_PRESETS.hard,
    ],
  };
}

type Outcome = 'won' | 'lost' | 'timeout';
type Result = { outcome: Outcome; ticks: number };

export type RunOptions = {
  victoryId?: VictoryConditionId;
  playerCountryId?: string;
  playerArchetype?: AiArchetype;
};

/**
 * Resolve the (victoryId, playerCountryId) the run should use, falling back to
 * the scenario's first declarations and warning when an env override is
 * incompatible with the loaded scenario.
 */
function resolveRunSetup(
  scenario: Scenario,
  options: RunOptions,
): { victoryId: VictoryConditionId; playerCountryId: string } {
  const requestedVictory = options.victoryId;
  const victoryId: VictoryConditionId =
    requestedVictory && scenario.victoryConditions.some((v) => v.id === requestedVictory)
      ? requestedVictory
      : ((scenario.victoryConditions[0]?.id ?? 'economic') as VictoryConditionId);
  if (requestedVictory && victoryId !== requestedVictory) {
    console.warn(
      `Scenario "${scenario.id}" has no victory "${requestedVictory}"; falling back to "${victoryId}".`,
    );
  }
  const requestedCountry = options.playerCountryId;
  const playerCountryId =
    requestedCountry && scenario.playableCountries.includes(requestedCountry)
      ? requestedCountry
      : (scenario.playableCountries[0] ?? scenario.countries[0]!.id);
  if (requestedCountry && playerCountryId !== requestedCountry) {
    console.warn(
      `Scenario "${scenario.id}" has no playable country "${requestedCountry}"; falling back to "${playerCountryId}".`,
    );
  }
  return { victoryId, playerCountryId };
}

// ---------------------------------------------------------------------------
// JSONL trace — one record per tick (when SIM_JSONL is set).
//
// Records:
//   - tick snapshots: { kind: 'tick', tick, scenario, seed, gdpRank, reputation,
//                       activeUNResolutions, warheadCount, gameMode }
//   - events emitted between ticks:
//       { kind: 'un.outcome', tick, scenario, seed, resolutionId, kind, status }
//       { kind: 'bloc.transition', tick, country, fromBloc, toBloc }
//       { kind: 'nuclear.strike', tick, definitionId }
//       { kind: 'era.transition', tick, fromEraId, toEraId }
//       { kind: 'achievement.unlock', tick, id }
//
// We diff the previous state against the current state to detect transitions
// that the engine doesn't surface as a single dedicated counter. This keeps
// the engine free of trace hooks at the cost of a little bookkeeping here.
// ---------------------------------------------------------------------------

type JsonlBaseFields = {
  tick: number;
  scenario: string;
  seed: string;
};

function gdpRankOfPlayer(state: GameState): number {
  const ids = Object.values(state.countries)
    .map((c) => ({ id: c.id, gdp: c.economy.gdp }))
    .sort((a, b) => b.gdp - a.gdp);
  const idx = ids.findIndex((s) => s.id === state.playerCountryId);
  return idx < 0 ? -1 : idx + 1;
}

function totalWarheads(state: GameState): number {
  let n = 0;
  for (const c of Object.values(state.countries)) {
    if (c.nuclear) n += c.nuclear.warheadCount;
  }
  return n;
}

function tickSnapshot(state: GameState, base: JsonlBaseFields): Record<string, unknown> {
  const active = state.unResolutions?.filter((r) => r.status === 'voting').length ?? 0;
  return {
    kind: 'tick',
    ...base,
    gdpRank: gdpRankOfPlayer(state),
    reputation: state.reputation
      ? {
          western: state.reputation['western'] ?? 0,
          eastern: state.reputation['eastern'] ?? 0,
          nonAligned: state.reputation['non-aligned'] ?? 0,
        }
      : null,
    activeUNResolutions: active,
    warheadCount: totalWarheads(state),
    gameMode: state.gameMode ?? 'classic',
  };
}

function writeJsonlLine(path: string, record: Record<string, unknown>): void {
  appendFileSync(path, `${JSON.stringify(record)}\n`);
}

function diffAndEmitEvents(
  prev: GameState,
  next: GameState,
  base: JsonlBaseFields,
  prevUnlocked: ReadonlySet<string>,
  path: string,
): Set<string> {
  // UN: status transitions from 'voting' → terminal.
  if (prev.unResolutions && next.unResolutions) {
    for (const r of next.unResolutions) {
      const before = prev.unResolutions.find((p) => p.id === r.id);
      if (before && before.status === 'voting' && r.status !== 'voting') {
        writeJsonlLine(path, {
          kind: 'un.outcome',
          ...base,
          resolutionId: r.id,
          resolutionKind: r.kind,
          status: r.status,
        });
      }
    }
  }
  // Bloc transitions: country.blocId changed.
  for (const c of Object.values(next.countries)) {
    const before = prev.countries[c.id];
    if (!before) continue;
    if (before.blocId !== c.blocId) {
      writeJsonlLine(path, {
        kind: 'bloc.transition',
        ...base,
        country: c.id,
        fromBloc: before.blocId ?? null,
        toBloc: c.blocId ?? null,
      });
    }
  }
  // Nuclear strikes: any new event with the STRIKE prefix.
  const newEvents = next.events.slice(prev.events.length);
  for (const e of newEvents) {
    if (e.definitionId.startsWith('event_nuclear_strike_')) {
      writeJsonlLine(path, {
        kind: 'nuclear.strike',
        ...base,
        definitionId: e.definitionId,
      });
    }
  }
  // Era transitions: eraState.pendingTransition newly populated.
  if (
    next.eraState?.pendingTransition &&
    prev.eraState?.pendingTransition?.fromEraId !==
      next.eraState.pendingTransition.fromEraId
  ) {
    writeJsonlLine(path, {
      kind: 'era.transition',
      ...base,
      fromEraId: next.eraState.pendingTransition.fromEraId,
      toEraId: next.eraState.pendingTransition.toEraId,
    });
  }
  // Achievement unlocks: new ids since the previous tick.
  const currentlyUnlocked = new Set(evaluateAchievements(next, BUILTIN_ACHIEVEMENTS));
  for (const id of currentlyUnlocked) {
    if (!prevUnlocked.has(id)) {
      writeJsonlLine(path, { kind: 'achievement.unlock', ...base, id });
    }
  }
  return currentlyUnlocked;
}

export function runOne(
  scenario: Scenario,
  difficulty: DifficultyTuning,
  seed: string,
  options: RunOptions = {},
): Result {
  const { victoryId, playerCountryId: chosenPlayerId } = resolveRunSetup(scenario, options);
  const archetype = options.playerArchetype ?? 'opportunist';

  let s: GameState = createGame(scenario, {
    seed,
    victory: victoryId,
    playerCountryId: chosenPlayerId,
    difficultyId: difficulty.id,
  });

  const playerRng = createRng(`${seed}::playerAi`);
  const playerId = s.playerCountryId;
  const techCatalog = scenario.techTree;
  const eventPool = scenario.eventPool;
  // Pick the rule that matches the chosen victory id (NOT victoryConditions[0])
  // so the win check actually reflects the configured victory condition.
  const victoryRule = scenario.victoryConditions.find((v) => v.id === victoryId)?.rule;

  // Force-attach an AI personality to the "player" so all countries are AI-driven.
  // The chosen archetype controls how exposed the player is to difficulty: a
  // pacifist_trader hides behind GDP and trivializes Hard; an opportunist
  // commits to research/military and feels Hard properly.
  s = {
    ...s,
    countries: {
      ...s.countries,
      [playerId]: {
        ...s.countries[playerId]!,
        aiPersonality: PERSONALITY_BY_ARCHETYPE[archetype],
      },
    },
  };

  const jsonlPath = SIM_JSONL_PATH;
  const base: JsonlBaseFields = { tick: s.tick, scenario: scenario.id, seed };
  let prevUnlocked: ReadonlySet<string> = new Set(
    jsonlPath ? evaluateAchievements(s, BUILTIN_ACHIEVEMENTS) : [],
  );
  if (jsonlPath) {
    writeJsonlLine(jsonlPath, tickSnapshot(s, { ...base, tick: s.tick }));
  }

  for (let i = 0; i < MAX_TICKS; i++) {
    if (s.winLoss !== 'playing') break;
    // Player slot: also let AI act. Note we deliberately do NOT pass the
    // difficulty into the player's AI scoring — difficulty modifiers describe
    // the world the player faces, not the player's own behaviour. Otherwise
    // Hard would *also* boost the player's `proposeAlliance` weight via
    // `aiAllianceBias` and trivialize the `military` victory by spamming
    // alliances on the player slot itself.
    const action: Action | null = decideAiAction(s, playerId, playerRng, techCatalog);
    if (action) {
      const r = applyAction(s, action, playerId, techCatalog);
      if (r.errors.length === 0) s = r.state;
    }
    const prev = s;
    s = tick(s, { techCatalog, eventPool, victoryRule, difficulty, scenario });
    if (jsonlPath) {
      const tickBase = { tick: s.tick, scenario: scenario.id, seed };
      writeJsonlLine(jsonlPath, tickSnapshot(s, tickBase));
      prevUnlocked = diffAndEmitEvents(prev, s, tickBase, prevUnlocked, jsonlPath);
    }
  }

  if (s.winLoss === 'won') return { outcome: 'won', ticks: s.tick };
  if (s.winLoss === 'lost') return { outcome: 'lost', ticks: s.tick };
  return { outcome: 'timeout', ticks: s.tick };
}

export type Distribution = {
  difficulty: DifficultyId;
  runs: number;
  counts: Record<Outcome, number>;
  crashes: number;
  avgTicks: number;
};

export function runMany(
  scenario: Scenario,
  difficulty: DifficultyTuning,
  runs: number,
  options: RunOptions = {},
): Distribution {
  const counts: Record<Outcome, number> = { won: 0, lost: 0, timeout: 0 };
  let totalTicks = 0;
  let crashes = 0;
  for (let i = 0; i < runs; i++) {
    try {
      const res = runOne(scenario, difficulty, `${difficulty.id}-seed-${i}`, options);
      counts[res.outcome]++;
      totalTicks += res.ticks;
    } catch (e) {
      crashes++;
      console.error(`Run ${i} (${difficulty.id}) crashed:`, e);
    }
  }
  const completed = runs - crashes;
  const avgTicks = completed > 0 ? totalTicks / completed : 0;
  return {
    difficulty: difficulty.id as DifficultyId,
    runs,
    counts,
    crashes,
    avgTicks,
  };
}

export function pct(n: number, total: number): string {
  if (total <= 0) return '0.0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}

function printSingle(scenario: Scenario, dist: Distribution): void {
  console.log('---');
  console.log(`Scenario:   ${scenario.id}`);
  console.log(`Difficulty: ${dist.difficulty}`);
  console.log(`Runs:       ${dist.runs}`);
  console.log(`Won:        ${dist.counts.won} (${pct(dist.counts.won, dist.runs)})`);
  console.log(`Lost:       ${dist.counts.lost} (${pct(dist.counts.lost, dist.runs)})`);
  console.log(`Timeout:    ${dist.counts.timeout} (${pct(dist.counts.timeout, dist.runs)})`);
  console.log(`Crashes:    ${dist.crashes}`);
  console.log(`Avg ticks-to-completion: ${dist.avgTicks.toFixed(1)}`);
}

function printCompareTable(scenario: Scenario, results: readonly Distribution[]): void {
  const cols = ['Difficulty', 'Runs', 'Won', 'Lost', 'Timeout', 'Avg ticks', 'Crashes'];
  const rows = results.map((d) => [
    d.difficulty,
    String(d.runs),
    `${d.counts.won} (${pct(d.counts.won, d.runs)})`,
    `${d.counts.lost} (${pct(d.counts.lost, d.runs)})`,
    `${d.counts.timeout} (${pct(d.counts.timeout, d.runs)})`,
    d.avgTicks.toFixed(1),
    String(d.crashes),
  ]);
  const widths = cols.map((c, i) =>
    Math.max(c.length, ...rows.map((r) => (r[i] ?? '').length)),
  );
  const fmt = (cells: readonly string[]): string =>
    '| ' + cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join(' | ') + ' |';
  const sep = '|' + widths.map((w) => '-'.repeat(w + 2)).join('|') + '|';
  console.log('---');
  console.log(`Scenario: ${scenario.id} (${results[0]?.runs ?? 0} runs each)`);
  console.log(fmt(cols));
  console.log(sep);
  for (const r of rows) console.log(fmt(r));
}

function printConfig(scenario: Scenario, options: RunOptions): void {
  const { victoryId, playerCountryId } = resolveRunSetup(scenario, options);
  console.log('Sim configuration:');
  console.log(`  Scenario:          ${scenario.id}`);
  console.log(`  Player country:    ${playerCountryId}`);
  console.log(`  Player archetype:  ${options.playerArchetype ?? 'opportunist'}`);
  console.log(`  Victory condition: ${victoryId}`);
  console.log(`  Runs:              ${RUNS}`);
  console.log(`  Max ticks/run:     ${MAX_TICKS}`);
}

function main(): void {
  const scenario = loadScenario(SCENARIO_ID);
  const options: RunOptions = {
    victoryId: VICTORY_ID,
    playerArchetype: PLAYER_ARCHETYPE,
    ...(PLAYER_COUNTRY_OVERRIDE ? { playerCountryId: PLAYER_COUNTRY_OVERRIDE } : {}),
  };
  // Truncate any pre-existing JSONL trace once at the start so multi-run
  // batches produce a single fresh file regardless of `appendFileSync`'s
  // open-or-create semantics.
  if (SIM_JSONL_PATH) {
    writeFileSync(SIM_JSONL_PATH, '');
    console.log(`Sim JSONL trace → ${SIM_JSONL_PATH}`);
  }
  printConfig(scenario, options);

  if (COMPARE) {
    console.log(
      `Running ${RUNS} simulations per difficulty on scenario "${scenario.id}" (max ${MAX_TICKS} ticks each)…`,
    );
    const results: Distribution[] = (['easy', 'normal', 'hard'] as const).map((id) =>
      runMany(scenario, resolveDifficulty(scenario, id), RUNS, options),
    );
    printCompareTable(scenario, results);
    if (results.some((r) => r.crashes > 0)) process.exitCode = 1;
    return;
  }

  const difficulty = resolveDifficulty(scenario, DIFFICULTY_ID);
  console.log(
    `Running ${RUNS} simulations on scenario "${scenario.id}" @ ${difficulty.id} (max ${MAX_TICKS} ticks each)…`,
  );
  const dist = runMany(scenario, difficulty, RUNS, options);
  printSingle(scenario, dist);
  if (dist.crashes > 0) process.exitCode = 1;
}

main();

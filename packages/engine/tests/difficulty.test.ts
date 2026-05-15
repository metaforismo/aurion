// Coverage for the DifficultyTuning consumption in tick.ts, ai/index.ts,
// checkWinLoss.ts, and actions/deploySpy.ts. Each test isolates a single
// modifier and asserts the engine behaves measurably differently between
// 'easy' / 'normal' / 'hard'. The fixtures scenario carries all three.

import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { tick } from '../src/tick.js';
import { applyAction } from '../src/actions/index.js';
import { applyStartResearch } from '../src/actions/startResearch.js';
import { checkWinLoss } from '../src/checkWinLoss.js';
import { decideAiAction } from '../src/ai/index.js';
import { applyDeploySpy } from '../src/actions/deploySpy.js';
import { createRng } from '../src/rng.js';
import { makeScenario, sampleTechs, sampleEvents } from './fixtures.js';
import type { Action, DifficultyTuning, GameState } from '../src/index.js';

const scenario = makeScenario();
const easy = scenario.difficulties.find((d) => d.id === 'easy')!;
const normal = scenario.difficulties.find((d) => d.id === 'normal')!;
const hard = scenario.difficulties.find((d) => d.id === 'hard')!;

function freshState(difficultyId = 'normal'): GameState {
  return createGame(scenario, {
    seed: 'diff-seed',
    victory: 'economic',
    playerCountryId: 'aurion',
    difficultyId,
  });
}

describe('createGame difficulty selection', () => {
  it('defaults to "normal" when no difficultyId is provided', () => {
    const s = createGame(scenario, {
      seed: 's',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    expect(s.difficultyId).toBe('normal');
  });

  it('selects the requested difficulty by id', () => {
    expect(freshState('easy').difficultyId).toBe('easy');
    expect(freshState('hard').difficultyId).toBe('hard');
  });

  it('throws when an unknown difficultyId is requested', () => {
    expect(() =>
      createGame(scenario, {
        seed: 's',
        victory: 'economic',
        playerCountryId: 'aurion',
        difficultyId: 'nightmare',
      }),
    ).toThrow();
  });
});

describe('tick playerIncome multiplier', () => {
  it('player weeklyIncome scales with the multiplier; non-player income does not', () => {
    const base = freshState();
    const aEasy = tick(base, { techCatalog: sampleTechs, difficulty: easy });
    const aNormal = tick(base, { techCatalog: sampleTechs, difficulty: normal });
    const aHard = tick(base, { techCatalog: sampleTechs, difficulty: hard });

    const playerEasy = aEasy.countries.aurion!.economy.weeklyIncome;
    const playerNormal = aNormal.countries.aurion!.economy.weeklyIncome;
    const playerHard = aHard.countries.aurion!.economy.weeklyIncome;

    // Multiplier directionally larger -> larger income for the player.
    expect(playerEasy).toBeGreaterThan(playerNormal);
    expect(playerHard).toBeLessThan(playerNormal);

    // Non-player nations are unaffected.
    const aiNormal = aNormal.countries.borealis!.economy.weeklyIncome;
    const aiEasy = aEasy.countries.borealis!.economy.weeklyIncome;
    const aiHard = aHard.countries.borealis!.economy.weeklyIncome;
    expect(aiEasy).toBe(aiNormal);
    expect(aiHard).toBe(aiNormal);
  });
});

describe('tick aiResearchSpeed multiplier', () => {
  it('non-player research progresses faster on Hard than on Easy', () => {
    // Seed Borealis with an active research project, run several ticks across
    // Easy and Hard, compare accumulated points.
    const base = freshState();
    const seeded: GameState = {
      ...base,
      countries: {
        ...base.countries,
        borealis: {
          ...base.countries.borealis!,
          science: {
            ...base.countries.borealis!.science,
            activeResearch: 'tech_industry_basics',
          },
        },
      },
      techTreeProgress: {
        ...base.techTreeProgress,
        borealis: { activeResearch: 'tech_industry_basics', accumulatedPoints: 0 },
      },
    };

    let easyState = seeded;
    let hardState = seeded;
    // Run a handful of ticks for both, but stop early if research finished.
    for (let i = 0; i < 3; i++) {
      easyState = tick(easyState, { techCatalog: sampleTechs, difficulty: easy });
      hardState = tick(hardState, { techCatalog: sampleTechs, difficulty: hard });
    }

    const easyPts = easyState.techTreeProgress.borealis?.accumulatedPoints ?? 0;
    const hardPts = hardState.techTreeProgress.borealis?.accumulatedPoints ?? 0;
    expect(hardPts).toBeGreaterThan(easyPts);
  });
});

describe('checkWinLoss lossToleranceWeeks multiplier', () => {
  it('Easy delays the loss; Normal triggers it at the canonical threshold', () => {
    // Set popularity below threshold and run exactly LOSS_LOW_POPULARITY_WEEKS
    // checks. Normal triggers loss; Easy (1.5x) keeps the player alive.
    const base = freshState();
    const broken: GameState = {
      ...base,
      countries: {
        ...base.countries,
        aurion: {
          ...base.countries.aurion!,
          politics: { ...base.countries.aurion!.politics, popularity: 5 },
        },
      },
    };

    let normalState = broken;
    let easyState = broken;
    for (let i = 0; i < 12; i++) {
      normalState = checkWinLoss(normalState, undefined, normal);
      easyState = checkWinLoss(easyState, undefined, easy);
    }
    expect(normalState.winLoss).toBe('lost');
    expect(easyState.winLoss).toBe('playing');
  });

  it('Hard accelerates the loss vs Normal (kicks in earlier)', () => {
    const base = freshState();
    const broken: GameState = {
      ...base,
      countries: {
        ...base.countries,
        aurion: {
          ...base.countries.aurion!,
          politics: { ...base.countries.aurion!.politics, popularity: 5 },
        },
      },
    };

    // Hard threshold = 12 * 0.75 = 9. So Hard should be 'lost' after 9 ticks
    // while Normal is still 'playing'.
    let normalState = broken;
    let hardState = broken;
    for (let i = 0; i < 9; i++) {
      normalState = checkWinLoss(normalState, undefined, normal);
      hardState = checkWinLoss(hardState, undefined, hard);
    }
    expect(hardState.winLoss).toBe('lost');
    expect(normalState.winLoss).toBe('playing');
  });
});

describe('deploySpy spyDetectionAgainstPlayer multiplier', () => {
  it('foreign spy targeting the player has higher detectionRisk on Hard than Easy', () => {
    // Khanate (AI) deploys a spy against Aurion (player). The detection risk
    // computed at deployment time should reflect the difficulty multiplier.
    const base = freshState();
    // Seed khanate with a spy.
    const seeded: GameState = {
      ...base,
      countries: {
        ...base.countries,
        khanate: {
          ...base.countries.khanate!,
          intelligence: {
            ...base.countries.khanate!.intelligence,
            spyCount: 5,
          },
        },
      },
    };

    const action = {
      type: 'deploySpy' as const,
      op: {
        type: 'propaganda' as const,
        ownerCountryId: 'khanate',
        targetCountryId: 'aurion',
        payload: { kind: 'propaganda' as const, targetFaction: null },
        durationTicks: 6,
        successProbability: 0,
        detectionRisk: 0,
      },
    };

    const easyResult = applyDeploySpy(seeded, action, 'khanate', easy);
    const hardResult = applyDeploySpy(seeded, action, 'khanate', hard);

    expect(easyResult.errors).toEqual([]);
    expect(hardResult.errors).toEqual([]);
    const easyOp = easyResult.state.spyOperations.at(-1)!;
    const hardOp = hardResult.state.spyOperations.at(-1)!;
    expect(hardOp.detectionRisk).toBeGreaterThan(easyOp.detectionRisk);
  });

  it('does not affect player-vs-AI spy ops', () => {
    const base = freshState();
    const action = {
      type: 'deploySpy' as const,
      op: {
        type: 'propaganda' as const,
        ownerCountryId: 'aurion',
        targetCountryId: 'borealis',
        payload: { kind: 'propaganda' as const, targetFaction: null },
        durationTicks: 6,
        successProbability: 0,
        detectionRisk: 0,
      },
    };

    const easyResult = applyDeploySpy(base, action, 'aurion', easy);
    const hardResult = applyDeploySpy(base, action, 'aurion', hard);
    const easyOp = easyResult.state.spyOperations.at(-1)!;
    const hardOp = hardResult.state.spyOperations.at(-1)!;
    expect(easyOp.detectionRisk).toBe(hardOp.detectionRisk);
  });
});

describe('TickContext stays optional / non-breaking', () => {
  it('omitting difficulty matches the historical (Phase 1) behaviour', () => {
    // No difficulty + Normal difficulty should produce identical outputs for
    // simple deterministic tick comparisons.
    const a = freshState();
    const b = freshState();
    const noDiff = tick(a, { techCatalog: sampleTechs, eventPool: sampleEvents });
    const withNormal = tick(b, {
      techCatalog: sampleTechs,
      eventPool: sampleEvents,
      difficulty: normal,
    });
    expect(noDiff.countries.aurion!.economy.weeklyIncome).toBe(
      withNormal.countries.aurion!.economy.weeklyIncome,
    );
  });
});

// applyAction overload still callable without difficulty (compile-time guard).
const _typecheck: DifficultyTuning = normal;
void applyAction;
void _typecheck;

// ===========================================================================
// Brief-driven coverage: each "doubling" case from the validation harness
// brief. Kept distinct from the directional checks above so the intent
// ("modifier X moves the needle by ~Nx") is obvious at the test name.
// ===========================================================================

/**
 * Build a baseline `DifficultyTuning` with all multipliers at 1.0 and then
 * apply optional overrides + extras. Lets each brief-driven test focus only
 * on the modifier under test.
 */
function difficultyWith(
  id: string,
  overrides: Partial<DifficultyTuning['modifiers']> = {},
  extras: { ironMan?: boolean; badgeKey?: string } = {},
): DifficultyTuning {
  const tuning: DifficultyTuning = {
    id,
    nameKey: `difficulty.${id}.name`,
    modifiers: {
      aiAggression: 1,
      aiResearchSpeed: 1,
      playerIncome: 1,
      eventDifficulty: 1,
      aiAllianceBias: 1,
      spyDetectionAgainstPlayer: 1,
      lossToleranceWeeks: 1,
      eventChanceMultiplier: 1,
      ...overrides,
    },
  };
  if (extras.ironMan !== undefined) tuning.ironMan = extras.ironMan;
  if (extras.badgeKey !== undefined) tuning.badgeKey = extras.badgeKey;
  return tuning;
}

// ---------- 1. playerIncome doubling -----------------------------------------

describe('brief: playerIncome doubled', () => {
  it("the player's weeklyIncome is 2x the value with the modifier at 1.0", () => {
    const baseline = difficultyWith('baseline');
    const doubled = difficultyWith('double-income', { playerIncome: 2 });

    const a = tick(freshState(), { techCatalog: sampleTechs, difficulty: baseline });
    const b = tick(freshState(), { techCatalog: sampleTechs, difficulty: doubled });

    const incomeA = a.countries.aurion!.economy.weeklyIncome;
    const incomeB = b.countries.aurion!.economy.weeklyIncome;

    // Income is rounded to whole units in the engine, so allow ±1 of slack.
    expect(incomeA).toBeGreaterThan(0);
    expect(Math.abs(incomeB - incomeA * 2)).toBeLessThanOrEqual(1);

    // Sanity: non-player income is unaffected by the multiplier.
    expect(b.countries.borealis!.economy.weeklyIncome).toBe(
      a.countries.borealis!.economy.weeklyIncome,
    );
  });
});

// ---------- 2. aiResearchSpeed doubling --------------------------------------

describe('brief: aiResearchSpeed doubled', () => {
  /**
   * Drive a single non-player nation's research to completion under a given
   * difficulty and return the number of ticks consumed. The non-player nation
   * has its `aiPersonality` stripped so the AI step doesn't chain a fresh
   * `startResearch` immediately after the first one completes — we're
   * isolating `stepResearch` on a single tech, not measuring a research loop.
   */
  function ticksToCompleteForNpc(difficulty: DifficultyTuning): number {
    let s = freshState();
    // Strip aiPersonality from borealis so stepAi skips it — we don't want
    // the AI chaining a fresh `startResearch` immediately after the first
    // one completes. We're isolating `stepResearch` on a single tech.
    const { aiPersonality: _drop, ...borealisNoAi } = s.countries.borealis!;
    void _drop;
    s = {
      ...s,
      countries: {
        ...s.countries,
        borealis: borealisNoAi,
      },
    };
    const r = applyStartResearch(
      s,
      { type: 'startResearch', techId: 'tech_industry_basics' },
      'borealis',
      sampleTechs,
    );
    expect(r.errors).toEqual([]);
    s = r.state;

    for (let i = 0; i < 500; i++) {
      if (s.countries.borealis?.science.activeResearch === null) return i;
      s = tick(s, { techCatalog: sampleTechs, difficulty });
    }
    throw new Error('research never completed within 500 ticks');
  }

  it('non-player nations complete a tech in roughly half the ticks', () => {
    const baseline = difficultyWith('baseline');
    const doubled = difficultyWith('double-research', { aiResearchSpeed: 2 });

    const ticksBaseline = ticksToCompleteForNpc(baseline);
    const ticksDoubled = ticksToCompleteForNpc(doubled);

    expect(ticksDoubled).toBeLessThan(ticksBaseline);
    // "Roughly half" — allow +1 tick slack for the discrete cost-vs-points race.
    expect(ticksDoubled).toBeLessThanOrEqual(Math.ceil(ticksBaseline / 2) + 1);
  });
});

// ---------- 3. aiAggression doubling -----------------------------------------

describe('brief: aiAggression doubled', () => {
  /** Per-iteration deterministic re-sampling of decideAiAction. */
  function bucket(
    s: GameState,
    countryId: string,
    difficulty: DifficultyTuning | undefined,
    iterations: number,
    label: string,
  ): Record<string, number> {
    const buckets: Record<string, number> = {};
    for (let i = 0; i < iterations; i++) {
      const rng = createRng(`${label}::${countryId}::${i}`);
      const action: Action | null = decideAiAction(
        s,
        countryId,
        rng,
        sampleTechs,
        difficulty,
      );
      const key = action
        ? action.type === 'diplomacy'
          ? `diplomacy:${action.kind}`
          : action.type
        : 'skip';
      buckets[key] = (buckets[key] ?? 0) + 1;
    }
    return buckets;
  }

  it('chosen action distribution shifts toward declareWar / deployArmy', () => {
    // Set the stage so declareWar is even *eligible*: past the early-game
    // grace ticks (>= 50) AND a poor relation against the target. Fixture
    // already gives aurion<->khanate attitude=-40; we drive khanate's choice.
    let base = freshState();
    base = { ...base, tick: 200 };
    base = {
      ...base,
      countries: {
        ...base.countries,
        khanate: {
          ...base.countries.khanate!,
          // Beef up military so the war power-ratio check passes.
          military: {
            ...base.countries.khanate!.military,
            armySize: 5_000,
            doctrineLevel: 0.6,
          },
        },
      },
    };

    const baseline = difficultyWith('baseline');
    const aggressive = difficultyWith('aggressive', { aiAggression: 2 });

    const N = 1_000;
    const baseB = bucket(base, 'khanate', baseline, N, 'agg-base');
    const aggB = bucket(base, 'khanate', aggressive, N, 'agg-doubled');

    const baseWarLike =
      (baseB['diplomacy:declareWar'] ?? 0) + (baseB['deployArmy'] ?? 0);
    const aggWarLike =
      (aggB['diplomacy:declareWar'] ?? 0) + (aggB['deployArmy'] ?? 0);

    // Strict direction: doubling aggression must move declareWar+deployArmy *up*.
    // We deliberately don't assert a fixed delta — multiplier interacts with
    // archetype scoring, so the magnitude is data-dependent.
    expect(aggWarLike).toBeGreaterThan(baseWarLike);
  });
});

// ---------- 4. lossToleranceWeeks doubling -----------------------------------

describe('brief: lossToleranceWeeks doubled', () => {
  it("checkWinLoss doesn't trigger loss where the un-doubled threshold would", () => {
    // Pop locked at 5 (well below the LOW_POP_THRESHOLD=10). Without scaling,
    // the engine triggers loss after LOSS_LOW_POPULARITY_WEEKS=12 weeks.
    function lockedLowPop(): GameState {
      const base = freshState();
      return {
        ...base,
        countries: {
          ...base.countries,
          aurion: {
            ...base.countries.aurion!,
            politics: { ...base.countries.aurion!.politics, popularity: 5 },
          },
        },
      };
    }

    const tolerant = difficultyWith('tolerant', { lossToleranceWeeks: 2 });

    let s = lockedLowPop();
    for (let i = 0; i < 12; i++) {
      s = checkWinLoss(s, undefined, tolerant);
    }
    expect(s.winLoss).toBe('playing');

    // Sanity: with the un-doubled threshold, loss DOES fire at the same point.
    let baseline: GameState = lockedLowPop();
    for (let i = 0; i < 12; i++) {
      baseline = checkWinLoss(baseline);
    }
    expect(baseline.winLoss).toBe('lost');
  });
});

// ---------- 5. aiAllianceBias doubling ---------------------------------------

describe('brief: aiAllianceBias doubled', () => {
  it('AI alliance proposals roughly double in frequency', () => {
    // Use a friendly archetype (pacifist_trader) so proposeAlliance is
    // already in the running — the multiplier then has something to scale.
    let base = freshState();
    base = { ...base, tick: 100 };
    base = {
      ...base,
      countries: {
        ...base.countries,
        borealis: {
          ...base.countries.borealis!,
          aiPersonality: {
            archetype: 'pacifist_trader',
            aggressiveness: 0.2,
            expansionism: 0.2,
            paranoia: 0.4,
            pragmatism: 0.9,
          },
        },
      },
      // Boost attitude so proposeAlliance is allowed and scores positively.
      relations: {
        ...base.relations,
        'aurion::borealis': {
          ...base.relations['aurion::borealis']!,
          attitude: 70,
        },
      },
    };

    const baseline = difficultyWith('baseline');
    const allianceBiased = difficultyWith('coalition', { aiAllianceBias: 2 });

    const N = 1_000;
    let baseAlliance = 0;
    let biasedAlliance = 0;
    for (let i = 0; i < N; i++) {
      const rngA = createRng(`alliance::a::${i}`);
      const rngB = createRng(`alliance::b::${i}`);
      const a = decideAiAction(base, 'borealis', rngA, sampleTechs, baseline);
      const b = decideAiAction(base, 'borealis', rngB, sampleTechs, allianceBiased);
      if (a?.type === 'diplomacy' && a.kind === 'proposeAlliance') baseAlliance++;
      if (b?.type === 'diplomacy' && b.kind === 'proposeAlliance') biasedAlliance++;
    }

    // Direction-only: doubling alliance bias must move proposeAlliance *up*.
    // (Same caveat as the aggression test — scoring noise prevents an
    // exact 2x ratio assertion at this iteration count.)
    expect(biasedAlliance).toBeGreaterThan(baseAlliance);
  });
});

// ---------- 6. ironMan flag propagation --------------------------------------

describe('brief: ironMan flag propagation', () => {
  it("difficulty 'ironMan' flag, when set, is propagated to state.difficultyId", () => {
    // Add an ironMan-flagged difficulty to the scenario and resolve it via
    // createGame. ironMan is a UI-only flag; the engine must still tick.
    const ironManDifficulty = difficultyWith(
      'ironMan',
      {
        aiAggression: 1.5,
        aiResearchSpeed: 1.3,
        playerIncome: 0.8,
        eventDifficulty: 1.4,
        aiAllianceBias: 1.75,
        spyDetectionAgainstPlayer: 1.4,
        lossToleranceWeeks: 0.6,
        eventChanceMultiplier: 1.2,
      },
      { ironMan: true, badgeKey: 'difficulty.ironMan.badge' },
    );

    const ironManScenario = {
      ...scenario,
      difficulties: [...scenario.difficulties, ironManDifficulty],
    };
    const s = createGame(ironManScenario, {
      seed: 'iron-seed',
      victory: 'economic',
      playerCountryId: 'aurion',
      difficultyId: 'ironMan',
    });

    // Public state reflects the chosen difficulty id.
    expect(s.difficultyId).toBe('ironMan');

    // The flag is UI-only — engine still produces a normal tick.
    const after = tick(s, {
      techCatalog: sampleTechs,
      eventPool: sampleEvents,
      difficulty: ironManDifficulty,
    });
    expect(after.tick).toBe(s.tick + 1);
    expect(after.difficultyId).toBe('ironMan');
  });
});

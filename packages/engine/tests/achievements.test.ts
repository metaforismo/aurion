import { describe, expect, it } from 'vitest';

import { createGame } from '../src/createGame.js';
import {
  BUILTIN_ACHIEVEMENTS,
  evaluateAchievements,
  evaluateAchievementCondition,
} from '../src/index.js';
import type {
  AchievementDef,
  GameState,
  SpyOperation,
} from '../src/index.js';
import { makeScenario } from './fixtures.js';

const scenario = makeScenario();

function freshState(): GameState {
  return createGame(scenario, {
    seed: 'achievements',
    victory: 'economic',
    playerCountryId: 'aurion',
  });
}

describe('evaluateAchievements — pure helpers', () => {
  it('returns an empty array when no condition is met yet', () => {
    const s = freshState();
    // Tier-by-tier predicates that should all be false at tick 0.
    const fakeDefs: AchievementDef[] = [
      {
        id: 'never_alliance',
        nameKey: 'x.name',
        descKey: 'x.desc',
        tier: 'silver',
        condition: { kind: 'allianceCount', n: 99 },
      },
      {
        id: 'never_spy',
        nameKey: 'x.name',
        descKey: 'x.desc',
        tier: 'silver',
        condition: { kind: 'spyOpsCompleted', n: 99 },
      },
    ];
    expect(evaluateAchievements(s, fakeDefs)).toEqual([]);
  });

  it('detects completeTech when the player has the tech', () => {
    const base = freshState();
    const player = base.countries.aurion!;
    const s: GameState = {
      ...base,
      countries: {
        ...base.countries,
        aurion: {
          ...player,
          science: {
            ...player.science,
            completedTechs: ['tech_industry_basics'],
          },
        },
      },
    };
    const defs: AchievementDef[] = [
      {
        id: 't',
        nameKey: 'x.name',
        descKey: 'x.desc',
        tier: 'bronze',
        condition: { kind: 'completeTech', techId: 'tech_industry_basics' },
      },
    ];
    expect(evaluateAchievements(s, defs)).toEqual(['t']);
  });

  it('detects reachPopularity threshold (inclusive)', () => {
    const base = freshState();
    const player = base.countries.aurion!;
    const s: GameState = {
      ...base,
      countries: {
        ...base.countries,
        aurion: {
          ...player,
          politics: { ...player.politics, popularity: 80 },
        },
      },
    };
    expect(
      evaluateAchievementCondition(s, { kind: 'reachPopularity', threshold: 80 }),
    ).toBe(true);
    expect(
      evaluateAchievementCondition(s, { kind: 'reachPopularity', threshold: 81 }),
    ).toBe(false);
  });

  it('detects reachGdpRank — fixture has all-equal GDPs so player ties at rank 1', () => {
    const s = freshState();
    expect(
      evaluateAchievementCondition(s, { kind: 'reachGdpRank', rank: 1 }),
    ).toBe(true);
  });

  it('counts allianceCount across the player relations', () => {
    const base = freshState();
    const s: GameState = {
      ...base,
      relations: {
        ...base.relations,
        'aurion::borealis': {
          ...base.relations['aurion::borealis']!,
          treaties: ['alliance'],
        },
      },
    };
    expect(
      evaluateAchievementCondition(s, { kind: 'allianceCount', n: 1 }),
    ).toBe(true);
    expect(
      evaluateAchievementCondition(s, { kind: 'allianceCount', n: 2 }),
    ).toBe(false);
  });

  it('counts only the player-owned, completed spy ops', () => {
    const base = freshState();
    const ops: SpyOperation[] = [
      {
        id: 'op-1',
        type: 'steal_tech',
        ownerCountryId: 'aurion',
        targetCountryId: 'borealis',
        payload: { kind: 'steal_tech', techId: 'tech_industry_basics' },
        progressTicks: 5,
        durationTicks: 5,
        successProbability: 1,
        detectionRisk: 0,
        status: 'completed',
        startedAtTick: 0,
      },
      {
        id: 'op-2',
        type: 'sabotage',
        ownerCountryId: 'aurion',
        targetCountryId: 'khanate',
        payload: { kind: 'sabotage', targetSector: 'military' },
        progressTicks: 5,
        durationTicks: 5,
        successProbability: 1,
        detectionRisk: 0,
        status: 'failed', // does not count
        startedAtTick: 0,
      },
      {
        id: 'op-3',
        type: 'propaganda',
        ownerCountryId: 'borealis', // foreign owner — does not count
        targetCountryId: 'aurion',
        payload: { kind: 'propaganda', targetFaction: null },
        progressTicks: 5,
        durationTicks: 5,
        successProbability: 1,
        detectionRisk: 0,
        status: 'completed',
        startedAtTick: 0,
      },
    ];
    const s: GameState = { ...base, spyOperations: ops };
    expect(
      evaluateAchievementCondition(s, { kind: 'spyOpsCompleted', n: 1 }),
    ).toBe(true);
    expect(
      evaluateAchievementCondition(s, { kind: 'spyOpsCompleted', n: 2 }),
    ).toBe(false);
  });

  it('survivedTicks: only fires while not lost', () => {
    const s: GameState = { ...freshState(), tick: 600 };
    expect(
      evaluateAchievementCondition(s, { kind: 'survivedTicks', n: 500 }),
    ).toBe(true);
    const lost: GameState = { ...s, winLoss: 'lost' };
    expect(
      evaluateAchievementCondition(lost, { kind: 'survivedTicks', n: 500 }),
    ).toBe(false);
  });

  it('and / or composition short-circuits correctly', () => {
    const s = freshState();
    expect(
      evaluateAchievementCondition(s, {
        kind: 'and',
        conditions: [
          { kind: 'reachGdpRank', rank: 1 },
          { kind: 'reachPopularity', threshold: 1000 },
        ],
      }),
    ).toBe(false);
    expect(
      evaluateAchievementCondition(s, {
        kind: 'or',
        conditions: [
          { kind: 'reachGdpRank', rank: 1 },
          { kind: 'reachPopularity', threshold: 1000 },
        ],
      }),
    ).toBe(true);
  });
});

describe('BUILTIN_ACHIEVEMENTS catalogue', () => {
  it('ships at least 20 entries', () => {
    expect(BUILTIN_ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20);
  });

  it('every id is unique', () => {
    const ids = BUILTIN_ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only declares known tier values', () => {
    for (const def of BUILTIN_ACHIEVEMENTS) {
      expect(['bronze', 'silver', 'gold']).toContain(def.tier);
    }
  });

  it('every entry references an `achievements.<id>.name|description` key pair', () => {
    for (const def of BUILTIN_ACHIEVEMENTS) {
      expect(def.nameKey).toBe(`achievements.${def.id}.name`);
      expect(def.descKey).toBe(`achievements.${def.id}.description`);
    }
  });

  it('produces no false positives on a fresh game', () => {
    const s = freshState();
    const unlocked = evaluateAchievements(s, BUILTIN_ACHIEVEMENTS);
    // Fresh game ranks all countries equal (rank 1 ties) so the GDP-rank
    // gold achievement DOES fire on tick 0 of the synthetic fixture; that's
    // OK because the assertion below only forbids the player-progress ones.
    expect(unlocked).not.toContain('master_spy');
    expect(unlocked).not.toContain('survivor');
    expect(unlocked).not.toContain('long_haul');
    // Phase 3 Wave 10 — fresh game has no nuclear strikes, no MAD, no
    // dismantled arsenals; none of the hidden nuclear achievements fire.
    expect(unlocked).not.toContain('scorched_earth');
    expect(unlocked).not.toContain('mutually_assured');
    expect(unlocked).not.toContain('disarmer');
  });
});

// ---------------------------------------------------------------------------
// Phase 3 Wave 10 — nuclear / MAD-tier hidden achievements.
//
// These conditions cannot be expressed with the legacy condition kinds, so
// the engine grew `launchedNuclear`, `survivedMad`, and `dismantledUnderTreaty`
// in this wave. The tests below construct minimal synthetic GameStates that
// either satisfy or don't satisfy each predicate and assert
// `evaluateAchievements` returns the expected ids.
// ---------------------------------------------------------------------------

describe('Phase 3 Wave 10 — nuclear MAD-tier hidden achievements', () => {
  function withPlayerNuclear(
    s: GameState,
    arsenal: { warheadCount: number; deliverySystemLevel: 0 | 1 | 2; mad: boolean },
  ): GameState {
    const player = s.countries.aurion!;
    return {
      ...s,
      countries: {
        ...s.countries,
        aurion: { ...player, nuclear: { ...arsenal } },
      },
    };
  }

  function withEvents(s: GameState, definitionIds: readonly string[]): GameState {
    return {
      ...s,
      events: definitionIds.map((id) => ({
        definitionId: id,
        firedAtTick: s.tick,
        resolvedChoiceIndex: null,
      })),
    };
  }

  // -------- scorched_earth -------------------------------------------------

  it('scorched_earth fires when a tactical strike event is in state.events', () => {
    const s = withEvents(freshState(), ['event_nuclear_strike_tactical_r-1']);
    const unlocked = evaluateAchievements(s, BUILTIN_ACHIEVEMENTS);
    expect(unlocked).toContain('scorched_earth');
  });

  it('scorched_earth also fires for strategic (unilateral) strike events', () => {
    const s = withEvents(freshState(), ['event_nuclear_strike_strategic_borealis']);
    expect(
      evaluateAchievementCondition(s, { kind: 'launchedNuclear' }),
    ).toBe(true);
  });

  it('scorched_earth is NOT met when state.events has no strike entries', () => {
    const s = withEvents(freshState(), [
      'event_economic_boom',
      'event_political_crisis',
    ]);
    const unlocked = evaluateAchievements(s, BUILTIN_ACHIEVEMENTS);
    expect(unlocked).not.toContain('scorched_earth');
  });

  // -------- mutually_assured ----------------------------------------------

  it('mutually_assured fires after a MAD strategic strike if the player kept an arsenal and is alive', () => {
    const base = freshState();
    const armed = withPlayerNuclear(base, {
      warheadCount: 1,
      deliverySystemLevel: 1,
      mad: true,
    });
    const s = withEvents(armed, [
      'event_nuclear_strike_strategic_borealis_mad',
    ]);
    const unlocked = evaluateAchievements(s, BUILTIN_ACHIEVEMENTS);
    expect(unlocked).toContain('mutually_assured');
  });

  it('mutually_assured does NOT fire on a unilateral strategic strike (no _mad suffix)', () => {
    const base = freshState();
    const armed = withPlayerNuclear(base, {
      warheadCount: 1,
      deliverySystemLevel: 1,
      mad: true,
    });
    const s = withEvents(armed, ['event_nuclear_strike_strategic_borealis']);
    const unlocked = evaluateAchievements(s, BUILTIN_ACHIEVEMENTS);
    expect(unlocked).not.toContain('mutually_assured');
  });

  it('mutually_assured does NOT fire when the player has lost', () => {
    const base = freshState();
    const armed = withPlayerNuclear(base, {
      warheadCount: 1,
      deliverySystemLevel: 1,
      mad: true,
    });
    const eventful = withEvents(armed, [
      'event_nuclear_strike_strategic_borealis_mad',
    ]);
    const lost: GameState = { ...eventful, winLoss: 'lost' };
    expect(
      evaluateAchievementCondition(lost, { kind: 'survivedMad' }),
    ).toBe(false);
  });

  // -------- disarmer ------------------------------------------------------

  it('disarmer fires when player had an arsenal, now 0 warheads, and non-prolif passed', () => {
    const base = freshState();
    const disarmed = withPlayerNuclear(base, {
      warheadCount: 0,
      deliverySystemLevel: 0,
      mad: false,
    });
    const s: GameState = {
      ...disarmed,
      unResolutions: [
        {
          id: 'res-1',
          kind: 'nonProliferation',
          proposerCountryId: 'aurion',
          proposedAtTick: 0,
          votingClosesAtTick: 10,
          effects: { onPass: [], onFail: [] },
          votes: {},
          status: 'passed',
          titleKey: 'un.npt.title',
          descriptionKey: 'un.npt.desc',
        },
      ],
    };
    const unlocked = evaluateAchievements(s, BUILTIN_ACHIEVEMENTS);
    expect(unlocked).toContain('disarmer');
  });

  it('disarmer does NOT fire when the player still holds warheads', () => {
    const base = freshState();
    const stillArmed = withPlayerNuclear(base, {
      warheadCount: 1,
      deliverySystemLevel: 0,
      mad: true,
    });
    const s: GameState = {
      ...stillArmed,
      unResolutions: [
        {
          id: 'res-1',
          kind: 'nonProliferation',
          proposerCountryId: 'aurion',
          proposedAtTick: 0,
          votingClosesAtTick: 10,
          effects: { onPass: [], onFail: [] },
          votes: {},
          status: 'passed',
          titleKey: 'un.npt.title',
          descriptionKey: 'un.npt.desc',
        },
      ],
    };
    expect(
      evaluateAchievementCondition(s, { kind: 'dismantledUnderTreaty' }),
    ).toBe(false);
  });

  it('disarmer does NOT fire without a passed non-proliferation resolution', () => {
    const base = freshState();
    const disarmed = withPlayerNuclear(base, {
      warheadCount: 0,
      deliverySystemLevel: 0,
      mad: false,
    });
    // No unResolutions at all.
    const unlocked = evaluateAchievements(disarmed, BUILTIN_ACHIEVEMENTS);
    expect(unlocked).not.toContain('disarmer');
    // Or a pending (not yet passed) resolution.
    const pending: GameState = {
      ...disarmed,
      unResolutions: [
        {
          id: 'res-1',
          kind: 'nonProliferation',
          proposerCountryId: 'aurion',
          proposedAtTick: 0,
          votingClosesAtTick: 10,
          effects: { onPass: [], onFail: [] },
          votes: {},
          status: 'voting',
          titleKey: 'un.npt.title',
          descriptionKey: 'un.npt.desc',
        },
      ],
    };
    expect(
      evaluateAchievementCondition(pending, { kind: 'dismantledUnderTreaty' }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Branch coverage backfill (audit): playerWarsConsideredWon heuristic.
// The branch that adds hostCountryIds (~line 143) and the relation lookup
// loop (~line 149-154) were only stub-tested. Each test asserts the
// observable `completeWar` evaluation, not just code-path entry.
// ---------------------------------------------------------------------------
describe('completeWar heuristic — playerWarsConsideredWon coverage', () => {
  it('counts a deployment on a former-enemy territory when no longer at war', () => {
    const base = freshState();
    const player = base.countries.aurion!;
    const s: GameState = {
      ...base,
      countries: {
        ...base.countries,
        aurion: {
          ...player,
          military: {
            ...player.military,
            deployedUnits: [
              {
                id: 'd-1',
                regionId: 'region_khanate',
                units: 200,
                hostCountryId: 'khanate',
                issuedAtTick: 0,
              },
            ],
          },
        },
      },
      relations: {
        ...base.relations,
        // Fixture starts attitude at -40 with atWar=false; explicit for clarity.
        'aurion::khanate': {
          ...base.relations['aurion::khanate']!,
          atWar: false,
        },
      },
    };
    // 1 deployment on khanate territory + relation is NOT at war → count = 1.
    expect(
      evaluateAchievementCondition(s, { kind: 'completeWar', wins: 1 }),
    ).toBe(true);
    expect(
      evaluateAchievementCondition(s, { kind: 'completeWar', wins: 2 }),
    ).toBe(false);
  });

  it('does NOT count deployments on territories the player is still at war with', () => {
    const base = freshState();
    const player = base.countries.aurion!;
    const s: GameState = {
      ...base,
      countries: {
        ...base.countries,
        aurion: {
          ...player,
          military: {
            ...player.military,
            deployedUnits: [
              {
                id: 'd-1',
                regionId: 'region_khanate',
                units: 200,
                hostCountryId: 'khanate',
                issuedAtTick: 0,
              },
            ],
          },
        },
      },
      relations: {
        ...base.relations,
        'aurion::khanate': {
          ...base.relations['aurion::khanate']!,
          atWar: true, // still at war → does NOT count as won
        },
      },
    };
    expect(
      evaluateAchievementCondition(s, { kind: 'completeWar', wins: 1 }),
    ).toBe(false);
  });

  it('skips deployments without a hostCountryId or pointing back at the player', () => {
    const base = freshState();
    const player = base.countries.aurion!;
    const s: GameState = {
      ...base,
      countries: {
        ...base.countries,
        aurion: {
          ...player,
          military: {
            ...player.military,
            deployedUnits: [
              // Deployment with no host (own region) — must be ignored.
              { id: 'd-self', regionId: 'region_aurion', units: 50, hostCountryId: null, issuedAtTick: 0 },
              // Deployment with host == player — also ignored.
              { id: 'd-own', regionId: 'region_aurion', units: 50, hostCountryId: 'aurion', issuedAtTick: 0 },
            ],
          },
        },
      },
    };
    expect(
      evaluateAchievementCondition(s, { kind: 'completeWar', wins: 1 }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Idempotent unlock cases (audit gap: only 1 case previously). Each test
// confirms evaluateAchievements is referentially-pure for unchanged input,
// so repeated invocations return identical id lists.
// ---------------------------------------------------------------------------
describe('evaluateAchievements idempotency', () => {
  it('returns identical id sets on repeated evaluation of an unchanged state', () => {
    const s = freshState();
    const a = evaluateAchievements(s, BUILTIN_ACHIEVEMENTS);
    const b = evaluateAchievements(s, BUILTIN_ACHIEVEMENTS);
    const c = evaluateAchievements(s, BUILTIN_ACHIEVEMENTS);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('idempotently re-fires met conditions when re-evaluated', () => {
    const base = freshState();
    const player = base.countries.aurion!;
    const s: GameState = {
      ...base,
      countries: {
        ...base.countries,
        aurion: {
          ...player,
          politics: { ...player.politics, popularity: 95 },
        },
      },
    };
    // Both bronze (80) and silver (90) popularity triggers should appear,
    // and remain present across repeated evaluations.
    const first = evaluateAchievements(s, BUILTIN_ACHIEVEMENTS);
    const second = evaluateAchievements(s, BUILTIN_ACHIEVEMENTS);
    expect(first).toContain('popular_leader');
    expect(first).toContain('beloved_government');
    expect(first).toEqual(second);
  });
});

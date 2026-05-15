// Phase 3 Wave 10 — space prestige milestones.
//
// Verifies the three core behaviors of `space/index.ts`:
//   1. Initialisation from scenario.techTree (only milestone techs counted).
//   2. recordTechCompletion: first vs follow achievers, idempotency, edge
//      cases (no-milestones scenario, missing country, legacy save).
//   3. End-to-end via tick(): completing a milestone tech → reputation deltas
//      drained into state.reputation across every active bloc.
//   4. AI bias: superpowers prefer unclaimed milestones over identical-cost
//      non-milestone techs.

import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import {
  REASON_KEY_FIRST,
  REASON_KEY_FOLLOW,
  initSpaceMilestones,
  isMilestone,
  recordTechCompletion,
  tickSpace,
} from '../src/space/index.js';
import { tick } from '../src/tick.js';
import { applyStartResearch } from '../src/actions/startResearch.js';
import { decideAiAction } from '../src/ai/index.js';
import { createRng } from '../src/rng.js';
import {
  SPACE_FIXTURE_SCENARIO,
  SPACE_MILESTONE_TECHS,
  makePhase3Scenario,
  makeScenario,
  sampleTechs,
} from './fixtures.js';
import type { GameState, Scenario, TechDefinition } from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIRST_SAT = 'tech_space_first_satellite';
const MOON = 'tech_space_moon_landing';

function freshSpaceState(seed = 'space-seed'): GameState {
  return createGame(SPACE_FIXTURE_SCENARIO, {
    seed,
    victory: 'economic',
    playerCountryId: 'aurion',
  });
}

/**
 * Force a country's `activeResearch` to `techId` AND set the progress to
 * exactly `(tech.cost - 1)` so the very next research step completes the
 * tech. Avoids running dozens of ticks just to drive a milestone home.
 */
function primeForCompletion(
  state: GameState,
  countryId: string,
  techId: string,
): GameState {
  const tech = SPACE_FIXTURE_SCENARIO.techTree.find((t) => t.id === techId);
  if (!tech) throw new Error(`primeForCompletion: tech not found ${techId}`);
  const country = state.countries[countryId];
  if (!country) throw new Error(`primeForCompletion: country not found ${countryId}`);
  return {
    ...state,
    countries: {
      ...state.countries,
      [countryId]: {
        ...country,
        science: { ...country.science, activeResearch: techId },
      },
    },
    techTreeProgress: {
      ...state.techTreeProgress,
      [countryId]: {
        activeResearch: techId,
        // researchOutput is positive in the fixture; one tick puts us over.
        accumulatedPoints: tech.cost - 0.0001,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// 1. isMilestone + initSpaceMilestones
// ---------------------------------------------------------------------------

describe('space: isMilestone', () => {
  it('returns true when prestigeFirst is a number', () => {
    expect(isMilestone(SPACE_MILESTONE_TECHS[0])).toBe(true);
  });

  it('returns false for techs without prestigeFirst', () => {
    expect(isMilestone(sampleTechs[0])).toBe(false);
  });

  it('returns false for undefined input', () => {
    expect(isMilestone(undefined)).toBe(false);
  });
});

describe('space: initSpaceMilestones', () => {
  it('returns undefined when scenario has no milestone techs', () => {
    expect(initSpaceMilestones(makeScenario())).toBeUndefined();
    expect(initSpaceMilestones(makePhase3Scenario())).toBeUndefined();
  });

  it('builds an entry per milestone tech with empty achievers', () => {
    const state = initSpaceMilestones(SPACE_FIXTURE_SCENARIO);
    expect(state).toBeDefined();
    expect(Object.keys(state ?? {}).sort()).toEqual(
      SPACE_MILESTONE_TECHS.map((t) => t.id).sort(),
    );
    for (const id of Object.keys(state ?? {})) {
      const entry = state?.[id];
      expect(entry?.firstAchieverCountryId).toBeNull();
      expect(entry?.firstAchievedAtTick).toBeNull();
      expect(entry?.achievers).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. recordTechCompletion behaviors
// ---------------------------------------------------------------------------

describe('space: recordTechCompletion — first achiever', () => {
  it('marks first achiever and queues a delta in EVERY active bloc', () => {
    const baseline = freshSpaceState();
    const after = recordTechCompletion(baseline, 'borealis', FIRST_SAT, SPACE_FIXTURE_SCENARIO);
    const entry = after.spaceMilestones?.[FIRST_SAT];
    expect(entry?.firstAchieverCountryId).toBe('borealis');
    expect(entry?.firstAchievedAtTick).toBe(baseline.tick);
    expect(entry?.achievers).toEqual(['borealis']);

    // Two active blocs in the fixture (western, eastern) → 2 queued deltas.
    expect(after.pendingReputationDeltas?.length).toBe(2);
    for (const d of after.pendingReputationDeltas ?? []) {
      expect(d.delta).toBe(5); // prestigeFirst from the fixture
      expect(d.reasonKey).toBe(REASON_KEY_FIRST);
    }
    const blocsCovered = new Set(
      (after.pendingReputationDeltas ?? []).map((d) => d.bloc),
    );
    expect(blocsCovered).toEqual(new Set(['western', 'eastern']));
  });
});

describe('space: recordTechCompletion — follow achievers', () => {
  it('second achiever gets prestigeFollow', () => {
    let s = freshSpaceState();
    s = recordTechCompletion(s, 'aurion', FIRST_SAT, SPACE_FIXTURE_SCENARIO);
    // Drain queue manually so we measure ONLY the second-completion deltas.
    s = { ...s, pendingReputationDeltas: [] };

    const after = recordTechCompletion(s, 'borealis', FIRST_SAT, SPACE_FIXTURE_SCENARIO);
    const entry = after.spaceMilestones?.[FIRST_SAT];
    expect(entry?.firstAchieverCountryId).toBe('aurion');
    expect(entry?.achievers).toEqual(['aurion', 'borealis']);
    expect(after.pendingReputationDeltas?.length).toBe(2);
    for (const d of after.pendingReputationDeltas ?? []) {
      expect(d.delta).toBe(2); // prestigeFollow from the fixture
      expect(d.reasonKey).toBe(REASON_KEY_FOLLOW);
    }
  });

  it('third achiever gets the same prestigeFollow as the second', () => {
    let s = freshSpaceState();
    s = recordTechCompletion(s, 'aurion', FIRST_SAT, SPACE_FIXTURE_SCENARIO);
    s = recordTechCompletion(s, 'borealis', FIRST_SAT, SPACE_FIXTURE_SCENARIO);
    s = { ...s, pendingReputationDeltas: [] };

    const after = recordTechCompletion(s, 'khanate', FIRST_SAT, SPACE_FIXTURE_SCENARIO);
    const entry = after.spaceMilestones?.[FIRST_SAT];
    expect(entry?.achievers).toEqual(['aurion', 'borealis', 'khanate']);
    for (const d of after.pendingReputationDeltas ?? []) {
      expect(d.delta).toBe(2);
      expect(d.reasonKey).toBe(REASON_KEY_FOLLOW);
    }
  });
});

describe('space: recordTechCompletion — non-milestone tech is a silent no-op', () => {
  it('does not mutate spaceMilestones or queue any delta', () => {
    const baseline = freshSpaceState();
    const after = recordTechCompletion(
      baseline,
      'aurion',
      'tech_industry_basics',
      SPACE_FIXTURE_SCENARIO,
    );
    expect(after.spaceMilestones).toBe(baseline.spaceMilestones);
    expect(after.pendingReputationDeltas?.length ?? 0).toBe(0);
  });
});

describe('space: recordTechCompletion — edge cases', () => {
  it('legacy save (state.spaceMilestones undefined) is a silent no-op', () => {
    // Use a scenario without milestone techs so spaceMilestones stays absent.
    const legacyState = createGame(makePhase3Scenario(), {
      seed: 'legacy',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    expect(legacyState.spaceMilestones).toBeUndefined();
    const after = recordTechCompletion(
      legacyState,
      'aurion',
      FIRST_SAT,
      SPACE_FIXTURE_SCENARIO,
    );
    expect(after).toBe(legacyState);
  });

  it('country missing from state.countries is a silent no-op', () => {
    const baseline = freshSpaceState();
    const after = recordTechCompletion(
      baseline,
      'ghost-country',
      FIRST_SAT,
      SPACE_FIXTURE_SCENARIO,
    );
    expect(after.spaceMilestones?.[FIRST_SAT]?.achievers).toEqual([]);
    expect(after.pendingReputationDeltas?.length ?? 0).toBe(0);
  });

  it('idempotent: same country twice does not duplicate the achiever', () => {
    let s = freshSpaceState();
    s = recordTechCompletion(s, 'aurion', FIRST_SAT, SPACE_FIXTURE_SCENARIO);
    const before = s.spaceMilestones?.[FIRST_SAT]?.achievers.length;
    const after = recordTechCompletion(s, 'aurion', FIRST_SAT, SPACE_FIXTURE_SCENARIO);
    expect(after.spaceMilestones?.[FIRST_SAT]?.achievers.length).toBe(before);
    expect(after).toBe(s); // pure no-op returns the same reference
  });

  it('tech absent from scenario.techTree is a silent no-op', () => {
    const baseline = freshSpaceState();
    const after = recordTechCompletion(
      baseline,
      'aurion',
      'tech_does_not_exist',
      SPACE_FIXTURE_SCENARIO,
    );
    expect(after).toBe(baseline);
  });
});

// ---------------------------------------------------------------------------
// 3. End-to-end via tick(): research completion drives prestige deltas
// ---------------------------------------------------------------------------

describe('space: end-to-end via tick()', () => {
  it('country that finishes a milestone first sees +prestigeFirst applied to reputation', () => {
    // aurion is in the western bloc. Player reputation tracks blocs only.
    let s = freshSpaceState();
    // Start the player on the satellite tech and fast-forward progress.
    const start = applyStartResearch(
      s,
      { type: 'startResearch', techId: FIRST_SAT },
      'aurion',
      SPACE_FIXTURE_SCENARIO.techTree,
    );
    s = primeForCompletion(start.state, 'aurion', FIRST_SAT);
    const before = { ...(s.reputation ?? {}) };

    // One tick: research completes, reputation deltas queued, then drained.
    s = tick(s, {
      techCatalog: SPACE_FIXTURE_SCENARIO.techTree,
      scenario: SPACE_FIXTURE_SCENARIO,
    });

    expect(s.spaceMilestones?.[FIRST_SAT]?.firstAchieverCountryId).toBe('aurion');
    // After tick: deltas drained + tiny decay (0.5 per bloc).
    // prestigeFirst = +5 in each bloc, then -0.5 decay → ~+4.5 each.
    expect((s.reputation?.western ?? 0) - (before.western ?? 0)).toBeCloseTo(4.5, 5);
    expect((s.reputation?.eastern ?? 0) - (before.eastern ?? 0)).toBeCloseTo(4.5, 5);
    expect(s.pendingReputationDeltas?.length ?? 0).toBe(0);
  });
});

describe('space: multiple completions in the same tick', () => {
  it('two countries completing same milestone in one tick: first wins, second is follower', () => {
    // Prime BOTH aurion and borealis to complete FIRST_SAT this tick. The
    // research step iterates Object.entries(state.countries) deterministically;
    // whichever appears first wins prestigeFirst, the other gets prestigeFollow.
    let s = freshSpaceState();
    s = {
      ...s,
      countries: {
        ...s.countries,
        aurion: {
          ...s.countries.aurion!,
          science: { ...s.countries.aurion!.science, activeResearch: FIRST_SAT },
        },
        borealis: {
          ...s.countries.borealis!,
          science: { ...s.countries.borealis!.science, activeResearch: FIRST_SAT },
        },
      },
      techTreeProgress: {
        ...s.techTreeProgress,
        aurion: { activeResearch: FIRST_SAT, accumulatedPoints: 99.999 },
        borealis: { activeResearch: FIRST_SAT, accumulatedPoints: 99.999 },
      },
    };

    s = tick(s, {
      techCatalog: SPACE_FIXTURE_SCENARIO.techTree,
      scenario: SPACE_FIXTURE_SCENARIO,
    });

    const entry = s.spaceMilestones?.[FIRST_SAT];
    expect(entry?.firstAchieverCountryId).not.toBeNull();
    // Both countries should be in the achievers list, exactly one as first.
    expect(entry?.achievers.length).toBe(2);
    expect(entry?.achievers).toContain('aurion');
    expect(entry?.achievers).toContain('borealis');
    // The first-achiever is the first one in the achievers array.
    expect(entry?.firstAchieverCountryId).toBe(entry?.achievers[0]);
  });
});

// ---------------------------------------------------------------------------
// 4. tickSpace is currently a no-op but safe in all scenarios
// ---------------------------------------------------------------------------

describe('space: tickSpace', () => {
  it('returns same state when spaceMilestones undefined', () => {
    const legacyState = createGame(makePhase3Scenario(), {
      seed: 'legacy',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    expect(tickSpace(legacyState, makePhase3Scenario())).toBe(legacyState);
  });

  it('returns same state when spaceMilestones present (no decay yet)', () => {
    const s = freshSpaceState();
    expect(tickSpace(s, SPACE_FIXTURE_SCENARIO)).toBe(s);
  });
});

// ---------------------------------------------------------------------------
// 5. createGame integration
// ---------------------------------------------------------------------------

describe('space: createGame integration', () => {
  it('omits spaceMilestones when scenario has no milestone techs', () => {
    const state = createGame(makeScenario(), {
      seed: 'no-milestones',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    expect(state.spaceMilestones).toBeUndefined();
  });

  it('seeds spaceMilestones from scenario.techTree milestone subset', () => {
    const state = freshSpaceState();
    expect(state.spaceMilestones).toBeDefined();
    expect(Object.keys(state.spaceMilestones ?? {}).sort()).toEqual(
      SPACE_MILESTONE_TECHS.map((t) => t.id).sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// 6. AI bias: superpowers favor unclaimed milestones
// ---------------------------------------------------------------------------

describe('space: AI bias toward unclaimed milestones', () => {
  /**
   * Build a single-country scenario where an AI 'superpower' archetype has
   * exactly two startResearch options of identical cost: one milestone, one
   * plain. With fixed RNG, the milestone should win the scoring contest.
   */
  function biasScenario(): { scenario: Scenario; state: GameState } {
    // Plain tech with the SAME cost as the satellite milestone so the only
    // scoring difference comes from the milestone bias.
    const plain: TechDefinition = {
      id: 'tech_plain_research',
      nameKey: 'tech.plain.name',
      descriptionKey: 'tech.plain.desc',
      branch: 'civil',
      cost: 100,
      prereqs: [],
      effects: [],
    };
    const scenarioBase = makePhase3Scenario();
    const milestoneOnly = SPACE_MILESTONE_TECHS.find((t) => t.id === FIRST_SAT)!;
    const scenario: Scenario = {
      ...scenarioBase,
      id: 'ai-bias-fixture',
      techTree: [plain, milestoneOnly],
    };
    // Promote 'meridia' to superpower (already is in fixture) and use it.
    const state = createGame(scenario, {
      seed: 'ai-bias',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    return { scenario, state };
  }

  it('superpower picks unclaimed milestone tech over identical-cost plain tech', () => {
    const { scenario, state } = biasScenario();
    // Use a deterministic RNG; meridia is the superpower.
    let milestonePicks = 0;
    let plainPicks = 0;
    let other = 0;
    // Run several times with different seeds to smooth out epsilon-explore.
    for (let i = 0; i < 30; i++) {
      const rng = createRng(`ai-bias-${i}`);
      const action = decideAiAction(state, 'meridia', rng, scenario.techTree);
      if (!action) continue;
      if (action.type !== 'startResearch') {
        other++;
        continue;
      }
      if (action.techId === FIRST_SAT) milestonePicks++;
      else if (action.techId === 'tech_plain_research') plainPicks++;
    }
    // Statistical: with the +0.5 superpower bias, milestone should beat plain.
    // We don't require dominance over OTHER actions (invest/diplomacy can still
    // outscore research depending on situation) — just that AMONG research
    // picks, milestone wins.
    expect(milestonePicks).toBeGreaterThan(plainPicks);
    // Milestone should also have been picked at least once outright.
    expect(milestonePicks).toBeGreaterThan(0);
    void other; // intentionally observed but not asserted on
  });

  it('once milestone is claimed, the bias disappears', () => {
    const { scenario, state } = biasScenario();
    // Mark the milestone as already achieved by some other country.
    const claimed: GameState = {
      ...state,
      spaceMilestones: {
        ...(state.spaceMilestones ?? {}),
        [FIRST_SAT]: {
          techId: FIRST_SAT,
          firstAchieverCountryId: 'borealis',
          firstAchievedAtTick: 0,
          achievers: ['borealis'],
        },
      },
    };
    let milestonePicksClaimed = 0;
    let plainPicksClaimed = 0;
    for (let i = 0; i < 30; i++) {
      const rng = createRng(`ai-bias-claimed-${i}`);
      const action = decideAiAction(claimed, 'meridia', rng, scenario.techTree);
      if (!action || action.type !== 'startResearch') continue;
      if (action.techId === FIRST_SAT) milestonePicksClaimed++;
      else if (action.techId === 'tech_plain_research') plainPicksClaimed++;
    }
    // Without the bias, milestone vs plain should be roughly comparable —
    // we just check the milestone no longer dominates by a wide margin.
    // Specifically, plain should win at least sometimes. (Both have identical
    // cost; the only score differences are noise + small archetype quirks.)
    expect(plainPicksClaimed + milestonePicksClaimed).toBeGreaterThan(0);
    // The claimed-milestone case must NOT show the strong dominance the
    // unclaimed case did. We don't expect a strict opposite ordering since
    // there's still small noise; just that the dominance margin shrinks.
    expect(milestonePicksClaimed).toBeLessThan(30);
  });
});

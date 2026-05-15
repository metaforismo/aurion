import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { applyAction, getAvailableActions } from '../src/actions/index.js';
import { applyJoinBloc } from '../src/actions/joinBloc.js';
import { applyLeaveBloc } from '../src/actions/leaveBloc.js';
import { applyVoteUN } from '../src/actions/voteUN.js';
import { applyProposeUNResolution } from '../src/actions/proposeUNResolution.js';
import { tick } from '../src/tick.js';
import { tickReputation, pushReputationCause } from '../src/reputation/index.js';
import { tickBlocs, recomputeLeaders } from '../src/blocs/index.js';
import { tickUN, computeAiVote } from '../src/un/index.js';
import { createRng } from '../src/rng.js';
import { makePhase3Scenario, makeScenario } from './fixtures.js';

const scenario = makePhase3Scenario();

describe('phase3-edge: scenario without blocs is fully no-op', () => {
  it('createGame leaves Phase 3 fields undefined', () => {
    const s = createGame(makeScenario(), {
      seed: 's',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    expect(s.reputation).toBeUndefined();
    expect(s.blocs).toBeUndefined();
    expect(s.unResolutions).toBeUndefined();
    expect(s.pendingReputationDeltas).toBeUndefined();
  });

  it('all tick steps are no-ops on a non-Phase3 state', () => {
    let s = createGame(makeScenario(), {
      seed: 's',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    for (let i = 0; i < 50; i++) {
      s = tick(s, {
        techCatalog: makeScenario().techTree,
        eventPool: makeScenario().eventPool,
      });
    }
    expect(s.reputation).toBeUndefined();
    expect(s.blocs).toBeUndefined();
    expect(s.unResolutions).toBeUndefined();
  });
});

describe('phase3-edge: action validation', () => {
  it('proposeUNResolution rejects invalid target', () => {
    const s = createGame(scenario, {
      seed: 'p',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    const r = applyProposeUNResolution(
      s,
      { type: 'proposeUNResolution', kind: 'sanctions', targetCountryId: 'doesnt-exist' },
      'aurion',
      scenario,
    );
    expect(r.errors).toContain('errors.un.invalidTarget');
  });

  it('voteUN errors for closed resolution', () => {
    let s = createGame(scenario, {
      seed: 'p',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    s = applyProposeUNResolution(
      s,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'aurion',
      scenario,
    ).state;
    const id = s.unResolutions![0]!.id;
    // Force-close the resolution by manipulating status.
    s = {
      ...s,
      unResolutions: [
        { ...s.unResolutions![0]!, status: 'passed' as const },
      ],
    };
    const r = applyVoteUN(s, { type: 'voteUN', resolutionId: id, vote: 'yes' }, 'borealis');
    expect(r.errors).toContain('errors.un.alreadyClosed');
  });

  it('joinBloc errors when already in target bloc', () => {
    const s = createGame(scenario, {
      seed: 'p',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    const r = applyJoinBloc(s, { type: 'joinBloc', blocId: 'western' }, 'aurion');
    expect(r.errors).toContain('errors.bloc.alreadyMember');
  });

  it('leaveBloc errors when not in any bloc', () => {
    let s = createGame(scenario, {
      seed: 'p',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    s = applyLeaveBloc(s, { type: 'leaveBloc' }, 'aurion').state;
    const r = applyLeaveBloc(s, { type: 'leaveBloc' }, 'aurion');
    expect(r.errors).toContain('errors.bloc.notMember');
  });

  it('joinBloc errors for nonexistent bloc id', () => {
    const s = createGame(scenario, {
      seed: 'p',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    const r = applyJoinBloc(
      s,
      { type: 'joinBloc', blocId: 'non-aligned' },
      'aurion',
    );
    expect(r.errors).toContain('errors.bloc.notFound');
  });
});

describe('phase3-edge: dispatcher routes correctly', () => {
  it('dispatcher applies proposeUNResolution', () => {
    const s = createGame(scenario, {
      seed: 'p',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    const r = applyAction(
      s,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'aurion',
      [],
      undefined,
      scenario,
    );
    expect(r.errors).toEqual([]);
    expect(r.state.unResolutions?.length).toBe(1);
  });

  it('dispatcher applies leaveBloc and joinBloc', () => {
    let s = createGame(scenario, {
      seed: 'p',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    s = applyAction(s, { type: 'leaveBloc' }, 'aurion').state;
    expect(s.countries.aurion?.blocId).toBeUndefined();
    s = applyAction(s, { type: 'joinBloc', blocId: 'eastern' }, 'aurion').state;
    expect(s.countries.aurion?.blocId).toBe('eastern');
  });

  it('dispatcher applies voteUN', () => {
    let s = createGame(scenario, {
      seed: 'p',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    s = applyAction(
      s,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'aurion',
      [],
      undefined,
      scenario,
    ).state;
    const id = s.unResolutions![0]!.id;
    const r = applyAction(s, { type: 'voteUN', resolutionId: id, vote: 'yes' }, 'borealis');
    expect(r.errors).toEqual([]);
  });
});

describe('phase3-edge: cumulative stats overflow safety', () => {
  it('cumulativeStats values stay finite after many ticks', () => {
    let s = createGame(scenario, {
      seed: 'p',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    for (let i = 0; i < 500; i++) {
      // Periodically push positive reputation deltas to drive totalReputationGained.
      if (i % 10 === 0) s = pushReputationCause(s, 'western', 5, 'rep.reason.tick');
      s = tick(s, { scenario, techCatalog: scenario.techTree, eventPool: scenario.eventPool });
    }
    const cs = s.cumulativeStats;
    expect(cs).toBeDefined();
    expect(Number.isFinite(cs!.totalReputationGained)).toBe(true);
    expect(Number.isFinite(cs!.peakTreasury)).toBe(true);
    expect(Number.isFinite(cs!.totalTicksPlayed)).toBe(true);
    expect(cs!.totalTicksPlayed).toBe(500);
  });
});

describe('phase3-edge: bloc with leader pointing at non-member', () => {
  it('recomputeLeaders fixes stale leader after defection', () => {
    const s = createGame(scenario, {
      seed: 'p',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    // Synthesize a state where a bloc has a leader id that's not a member.
    const blocs = {
      ...s.blocs!,
      western: {
        ...s.blocs!.western!,
        leaderCountryId: 'meridia', // not in western
        memberCountryIds: ['aurion'],
      },
    };
    const recomputed = recomputeLeaders(blocs, s.countries);
    expect(recomputed.western?.leaderCountryId).toBe('aurion');
  });
});

describe('phase3-edge: UN voting when proposer is destroyed (negative treasury)', () => {
  it('still resolves the resolution even if proposer is broke', () => {
    let s = createGame(scenario, {
      seed: 'p',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    s = applyProposeUNResolution(
      s,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'aurion',
      scenario,
    ).state;
    // Tank aurion treasury way negative.
    s = {
      ...s,
      countries: {
        ...s.countries,
        aurion: {
          ...s.countries.aurion!,
          economy: { ...s.countries.aurion!.economy, treasury: -999_999_999_999 },
        },
      },
      tick: s.tick + 5,
    };
    const rng = createRng('broke');
    s = tickUN(s, scenario, rng);
    expect(s.unResolutions?.[0]?.status).not.toBe('voting');
  });
});

describe('phase3-edge: getAvailableActions includes Phase 3 actions', () => {
  it('lists joinBloc / leaveBloc / voteUN when applicable', () => {
    let s = createGame(scenario, {
      seed: 'p',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    s = applyProposeUNResolution(
      s,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'aurion',
      scenario,
    ).state;
    const actions = getAvailableActions(s, 'aurion', scenario.techTree);
    const types = new Set(actions.map((a) => a.type));
    expect(types.has('leaveBloc')).toBe(true);
    expect(types.has('joinBloc')).toBe(true);
    expect(types.has('voteUN')).toBe(false); // aurion is the proposer (auto-voted).
    // borealis hasn't voted on this resolution.
    const borealisActions = getAvailableActions(s, 'borealis', scenario.techTree);
    const btypes = new Set(borealisActions.map((a) => a.type));
    expect(btypes.has('voteUN')).toBe(true);
  });

  it('omits Phase 3 actions on a non-Phase3 scenario', () => {
    const s = createGame(makeScenario(), {
      seed: 's',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    const actions = getAvailableActions(s, 'aurion', makeScenario().techTree);
    const types = new Set(actions.map((a) => a.type));
    expect(types.has('joinBloc')).toBe(false);
    expect(types.has('leaveBloc')).toBe(false);
    expect(types.has('voteUN')).toBe(false);
  });
});

describe('phase3-edge: AI vote computation', () => {
  it('returns abstain when country has no AI personality', () => {
    const s = createGame(scenario, {
      seed: 'p',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    const player = s.countries.aurion!;
    const r = applyProposeUNResolution(
      s,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'aurion',
      scenario,
    );
    const resolution = r.state.unResolutions![0]!;
    expect(computeAiVote(resolution, player, r.state, scenario)).toBe('abstain');
  });

  it('returns a deterministic vote for AI countries', () => {
    let s = createGame(scenario, {
      seed: 'p',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    s = applyProposeUNResolution(
      s,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'aurion',
      scenario,
    ).state;
    const resolution = s.unResolutions![0]!;
    const v1 = computeAiVote(resolution, s.countries.borealis!, s, scenario);
    const v2 = computeAiVote(resolution, s.countries.borealis!, s, scenario);
    expect(v1).toBe(v2);
  });
});

describe('phase3-edge: reputation tick is no-op without scenario blocs', () => {
  it('tickReputation returns same state', () => {
    const s = createGame(makeScenario(), {
      seed: 's',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    expect(tickReputation(s)).toBe(s);
  });

  it('tickBlocs returns same state', () => {
    const s = createGame(makeScenario(), {
      seed: 's',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    expect(tickBlocs(s)).toBe(s);
  });
});

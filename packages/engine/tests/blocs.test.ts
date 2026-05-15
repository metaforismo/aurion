import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import {
  DEFECTION_ATTITUDE_THRESHOLD,
  LEADER_RECOMPUTE_INTERVAL_TICKS,
  initBlocs,
  isMemberOf,
  recomputeLeaders,
  tickBlocs,
} from '../src/blocs/index.js';
import { applyJoinBloc } from '../src/actions/joinBloc.js';
import { applyLeaveBloc } from '../src/actions/leaveBloc.js';
import { tick } from '../src/tick.js';
import { makePhase3Scenario, makeScenario } from './fixtures.js';

describe('initBlocs', () => {
  it('returns undefined when scenario has no blocs', () => {
    expect(initBlocs(makeScenario(), 0)).toBeUndefined();
  });

  it('seeds members and computes leaders', () => {
    const blocs = initBlocs(makePhase3Scenario(), 0);
    expect(blocs).toBeDefined();
    expect(blocs?.western?.memberCountryIds).toContain('aurion');
    expect(blocs?.western?.leaderCountryId).toBe('aurion');
    expect(blocs?.eastern?.leaderCountryId).toBe('khanate');
    expect(blocs?.western?.foundedAtTick).toBe(0);
  });
});

describe('recomputeLeaders', () => {
  const scenario = makePhase3Scenario();
  const baseState = createGame(scenario, {
    seed: 'blocs',
    victory: 'economic',
    playerCountryId: 'aurion',
  });

  it('picks the highest gdp + military_size country', () => {
    const blocs = baseState.blocs!;
    const out = recomputeLeaders(blocs, baseState.countries);
    expect(out.western?.leaderCountryId).toBe('aurion');
    expect(out.eastern?.leaderCountryId).toBe('meridia'); // higher gdp than khanate
  });

  it('returns null leader for empty bloc rosters', () => {
    const blocs = baseState.blocs!;
    const empty = { ...blocs, western: { ...blocs.western!, memberCountryIds: [] } };
    const out = recomputeLeaders(empty, baseState.countries);
    expect(out.western?.leaderCountryId).toBeNull();
  });
});

describe('tickBlocs', () => {
  const scenario = makePhase3Scenario();
  const baseState = createGame(scenario, {
    seed: 'tickblocs',
    victory: 'economic',
    playerCountryId: 'aurion',
  });

  it('is a no-op when blocs undefined', () => {
    const noBlocs = createGame(makeScenario(), {
      seed: 'noblocs',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    const next = tickBlocs(noBlocs);
    expect(next).toBe(noBlocs);
  });

  it('does not auto-defect the player country', () => {
    // Force player attitude very low; the player must NEVER auto-defect.
    let s = { ...baseState, tick: 1 };
    // Sour aurion vs borealis dramatically.
    s = {
      ...s,
      relations: {
        ...s.relations,
        'aurion::borealis': {
          ...s.relations['aurion::borealis']!,
          attitude: -90,
        },
      },
    };
    const next = tickBlocs(s);
    expect(next.blocs?.western?.memberCountryIds).toContain('aurion');
  });

  it('AI defects when attitude toward bloc-mates falls below threshold', () => {
    // Fresh state at tick 1 (so we don't recompute leaders this tick).
    let s = { ...baseState, tick: 1 };
    // Sour borealis (AI) vs aurion below threshold.
    s = {
      ...s,
      relations: {
        ...s.relations,
        'aurion::borealis': {
          ...s.relations['aurion::borealis']!,
          attitude: DEFECTION_ATTITUDE_THRESHOLD - 5,
        },
      },
    };
    const next = tickBlocs(s);
    expect(next.blocs?.western?.memberCountryIds).not.toContain('borealis');
    expect(next.countries.borealis?.blocId).toBeUndefined();
  });

  it('recomputes leaders on the periodic interval', () => {
    // Inflate borealis economy so leader should flip after recompute.
    let s = { ...baseState };
    s = {
      ...s,
      countries: {
        ...s.countries,
        borealis: {
          ...s.countries.borealis!,
          economy: { ...s.countries.borealis!.economy, gdp: 999_000_000_000 },
        },
      },
      tick: LEADER_RECOMPUTE_INTERVAL_TICKS, // align to recompute tick
    };
    const next = tickBlocs(s);
    expect(next.blocs?.western?.leaderCountryId).toBe('borealis');
  });
});

describe('joinBloc / leaveBloc reducers', () => {
  const scenario = makePhase3Scenario();
  const baseState = createGame(scenario, {
    seed: 'jl',
    victory: 'economic',
    playerCountryId: 'aurion',
  });

  it('joinBloc errors when scenario has no blocs', () => {
    const noBlocs = createGame(makeScenario(), {
      seed: 'noblocs',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    const r = applyJoinBloc(noBlocs, { type: 'joinBloc', blocId: 'western' }, 'aurion');
    expect(r.errors).toContain('errors.bloc.notAvailable');
  });

  it('joinBloc errors when already a member of target', () => {
    const r = applyJoinBloc(baseState, { type: 'joinBloc', blocId: 'western' }, 'aurion');
    expect(r.errors).toContain('errors.bloc.alreadyMember');
  });

  it('joinBloc moves the country from old bloc to new', () => {
    const r = applyJoinBloc(baseState, { type: 'joinBloc', blocId: 'eastern' }, 'aurion');
    expect(r.errors).toEqual([]);
    expect(r.state.countries.aurion?.blocId).toBe('eastern');
    expect(r.state.blocs?.western?.memberCountryIds).not.toContain('aurion');
    expect(r.state.blocs?.eastern?.memberCountryIds).toContain('aurion');
  });

  it('leaveBloc errors when not in any bloc', () => {
    // First leave, then call leave again.
    const r1 = applyLeaveBloc(baseState, { type: 'leaveBloc' }, 'aurion');
    expect(r1.errors).toEqual([]);
    const r2 = applyLeaveBloc(r1.state, { type: 'leaveBloc' }, 'aurion');
    expect(r2.errors).toContain('errors.bloc.notMember');
  });

  it('leaveBloc strips blocId and removes from roster', () => {
    const r = applyLeaveBloc(baseState, { type: 'leaveBloc' }, 'aurion');
    expect(r.errors).toEqual([]);
    expect(r.state.countries.aurion?.blocId).toBeUndefined();
    expect(r.state.blocs?.western?.memberCountryIds).not.toContain('aurion');
  });
});

describe('isMemberOf', () => {
  const scenario = makePhase3Scenario();
  const baseState = createGame(scenario, {
    seed: 'm',
    victory: 'economic',
    playerCountryId: 'aurion',
  });

  it('returns true for a current member', () => {
    expect(isMemberOf(baseState, 'aurion', 'western')).toBe(true);
  });

  it('returns false for a non-member', () => {
    expect(isMemberOf(baseState, 'aurion', 'eastern')).toBe(false);
  });

  it('returns false when blocs undefined', () => {
    const noBlocs = createGame(makeScenario(), {
      seed: 'noblocs',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    expect(isMemberOf(noBlocs, 'aurion', 'western')).toBe(false);
  });
});

describe('full tick integration with Phase 3 scenario', () => {
  it('runs N ticks without crashing', () => {
    const scenario = makePhase3Scenario();
    let s = createGame(scenario, {
      seed: 'p3-int',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    for (let i = 0; i < 30; i++) {
      s = tick(s, { scenario, techCatalog: scenario.techTree, eventPool: scenario.eventPool });
    }
    expect(s.tick).toBe(30);
    expect(s.blocs).toBeDefined();
    expect(s.reputation).toBeDefined();
    expect(s.unResolutions).toBeDefined();
  });
});

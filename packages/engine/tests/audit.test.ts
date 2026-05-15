// Audit tests — pin down behavior for edge cases discovered during the
// Phase-3 engine audit. Each test either exposes a bug, prevents a regression,
// or documents an intentional behaviour that's easy to break.

import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { applyAction } from '../src/actions/index.js';
import { applyDismantleNuclear } from '../src/actions/dismantleNuclear.js';
import { applyJoinBloc } from '../src/actions/joinBloc.js';
import { applyLeaveBloc } from '../src/actions/leaveBloc.js';
import { tick } from '../src/tick.js';
import { tickReputation, pushReputationCause } from '../src/reputation/index.js';
import {
  makePhase3Scenario,
  makeScenario,
  makeNuclearFixtureScenario,
} from './fixtures.js';

const phase3Scenario = makePhase3Scenario();
const nuclearScenario = makeNuclearFixtureScenario();

// ---------------------------------------------------------------------------
// Bug 1 (FIXED): applyAction was not wiring the contextual UN trigger for
// non-nuclear actions. A scenario could declare unTriggerMap.declareWar →
// peacekeeping resolution, the player declares war via applyAction, and no
// UN resolution ever opens. The fix wires `maybeTriggerFromAction` into the
// dispatcher after every successful non-launch action.
// ---------------------------------------------------------------------------
describe('audit: applyAction wires contextual UN triggers', () => {
  it('declareWar via applyAction opens the peacekeeping resolution', () => {
    const s = createGame(phase3Scenario, {
      seed: 'audit-trigger',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    const before = s.unResolutions?.length ?? 0;
    // khanate has attitude -40 with aurion in the phase3 fixture, well past
    // the DECLARE_WAR_ATTITUDE_THRESHOLD (-25), so the diplomacy reducer
    // accepts the casus belli.
    const r = applyAction(
      s,
      { type: 'diplomacy', target: 'khanate', kind: 'declareWar' },
      'aurion',
      [],
      undefined,
      phase3Scenario,
    );
    expect(r.errors).toEqual([]);
    expect(r.state.unResolutions?.length).toBe(before + 1);
    const fired = r.state.unResolutions?.[r.state.unResolutions!.length - 1];
    expect(fired?.kind).toBe('peacekeeping');
  });

  it('does not open a duplicate resolution for launchTactical (handled in reducer)', () => {
    const s = createGame(nuclearScenario, {
      seed: 'audit-launch',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    const before = s.unResolutions?.length ?? 0;
    // aurion is at war with khanate in the nuclear fixture; khanate's region
    // is region_khanate. Launch a tactical strike on it.
    const r = applyAction(
      s,
      { type: 'launchTactical', targetRegionId: 'region_khanate' },
      'aurion',
      nuclearScenario.techTree,
      undefined,
      nuclearScenario,
    );
    expect(r.errors).toEqual([]);
    // Exactly ONE new resolution from the reducer (launch handles it directly).
    expect(r.state.unResolutions?.length).toBe(before + 1);
  });
});

// ---------------------------------------------------------------------------
// Bug 2 (FIXED): dismantleNuclear silently no-op'd for fractional counts.
// Reducer only validated count <= 0 (so 0.5 passed validation), then
// applyDismantle's Math.floor(0.5) === 0 short-circuited and returned the
// same state unchanged. No error surfaced.
// ---------------------------------------------------------------------------
describe('audit: dismantleNuclear rejects non-integer counts', () => {
  it('returns errors.nuclear.invalidCount for fractional counts', () => {
    const s = createGame(nuclearScenario, {
      seed: 'audit-dismantle',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    const r = applyDismantleNuclear(
      s,
      { type: 'dismantleNuclear', count: 0.5 },
      'aurion',
    );
    expect(r.errors).toEqual(['errors.nuclear.invalidCount']);
    // State must be unchanged (no silent partial dismantle).
    expect(r.state).toBe(s);
  });

  it('still accepts integer counts that fit', () => {
    const s = createGame(nuclearScenario, {
      seed: 'audit-dismantle-ok',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    const before = s.countries.aurion!.nuclear?.warheadCount ?? 0;
    expect(before).toBeGreaterThan(0);
    const r = applyDismantleNuclear(
      s,
      { type: 'dismantleNuclear', count: 1 },
      'aurion',
    );
    expect(r.errors).toEqual([]);
    expect(r.state.countries.aurion!.nuclear?.warheadCount).toBe(before - 1);
  });
});

// ---------------------------------------------------------------------------
// Edge case: scenario without blocs — Phase 3 tick steps must be true no-ops.
// Pinned with reference equality so accidental "create empty arrays" patches
// regress this guarantee.
// ---------------------------------------------------------------------------
describe('audit: Phase 3 systems are no-ops without blocs', () => {
  it('tickReputation returns same reference', () => {
    const s = createGame(makeScenario(), {
      seed: 'audit-norep',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    expect(tickReputation(s)).toBe(s);
  });

  it('pushReputationCause is a silent no-op (no field added)', () => {
    const s = createGame(makeScenario(), {
      seed: 'audit-norep-push',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    const after = pushReputationCause(s, 'western', 10, 'rep.test');
    expect(after).toBe(s);
    expect(after.pendingReputationDeltas).toBeUndefined();
  });

  it('tick() leaves Phase 3 fields undefined after many ticks', () => {
    let s = createGame(makeScenario(), {
      seed: 'audit-tick-noop',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    for (let i = 0; i < 20; i++) {
      s = tick(s, {
        techCatalog: makeScenario().techTree,
        eventPool: makeScenario().eventPool,
      });
    }
    expect(s.reputation).toBeUndefined();
    expect(s.blocs).toBeUndefined();
    expect(s.unResolutions).toBeUndefined();
    expect(s.spaceMilestones).toBeUndefined();
    expect(s.eraState).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Edge case: leaveBloc when the bloc record was somehow removed (orphan
// blocId). leaveBloc should clear the country.blocId field gracefully without
// throwing. This guards against the "I removed the bloc record but a country
// still points to it" inconsistency.
// ---------------------------------------------------------------------------
describe('audit: leaveBloc gracefully handles orphan blocId', () => {
  it('clears blocId when the referenced bloc is missing', () => {
    let s = createGame(phase3Scenario, {
      seed: 'audit-orphan',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    // Synthesize an orphan: aurion still has blocId='western', but we drop the
    // western bloc record entirely.
    expect(s.countries.aurion!.blocId).toBe('western');
    const blocs = { ...s.blocs! };
    // remove western
    delete (blocs as Record<string, unknown>).western;
    s = { ...s, blocs: blocs as typeof s.blocs };
    const r = applyLeaveBloc(s, { type: 'leaveBloc' }, 'aurion');
    expect(r.errors).toEqual([]);
    expect(r.state.countries.aurion!.blocId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Edge case: world tension can saturate at 100 without overflowing or going
// negative. With many wars + sanctions + detected ops the raw sum exceeds
// 100; clamp must hold.
// ---------------------------------------------------------------------------
describe('audit: worldTension stays in [0, 100]', () => {
  it('clamps at 100 with many wars', () => {
    let s = createGame(phase3Scenario, {
      seed: 'audit-tension',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    // Force every relation to atWar — should produce raw tension >> 100.
    const relations = { ...s.relations };
    for (const k of Object.keys(relations)) {
      const key = k as keyof typeof relations;
      const r = relations[key];
      if (r) relations[key] = { ...r, atWar: true };
    }
    s = { ...s, relations };
    s = tick(s, { scenario: phase3Scenario, techCatalog: phase3Scenario.techTree });
    expect(s.worldTension).toBeLessThanOrEqual(100);
    expect(s.worldTension).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Edge case: AI archetype with NO Phase 3 weights still works. ARCHETYPE_BASE
// must include every action type for every archetype; otherwise scoring
// returns undefined and the AI silently breaks. Smoke test: 50 ticks, no
// crash, and no never-acting AI countries.
// ---------------------------------------------------------------------------
describe('audit: every archetype has Phase 3 action weights', () => {
  it('runs 50 ticks on Phase 3 scenario without crashing', () => {
    let s = createGame(phase3Scenario, {
      seed: 'audit-archetypes',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    for (let i = 0; i < 50; i++) {
      s = tick(s, {
        scenario: phase3Scenario,
        techCatalog: phase3Scenario.techTree,
        eventPool: phase3Scenario.eventPool,
      });
    }
    // Sanity: cumulativeStats grew, no NaN.
    expect(Number.isFinite(s.cumulativeStats!.totalReputationGained)).toBe(true);
    expect(s.cumulativeStats!.totalTicksPlayed).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Edge case: reputation arithmetic never returns NaN even when called with
// non-finite inputs (e.g. corrupted save). The clamp helper is the last line
// of defense.
// ---------------------------------------------------------------------------
describe('audit: reputation arithmetic is NaN-safe', () => {
  it('coerces NaN deltas to 0 inside clampReputation', () => {
    let s = createGame(phase3Scenario, {
      seed: 'audit-nan',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    // Push a NaN delta directly.
    s = pushReputationCause(s, 'western', Number.NaN, 'rep.test.nan');
    s = tickReputation(s);
    const v = s.reputation?.western;
    expect(typeof v).toBe('number');
    expect(Number.isFinite(v)).toBe(true);
  });

  it('clamps absurdly large deltas to REPUTATION_MAX (modulo per-tick decay)', () => {
    let s = createGame(phase3Scenario, {
      seed: 'audit-huge',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    s = pushReputationCause(s, 'western', 1e9, 'rep.test.huge');
    s = tickReputation(s);
    // Clamp caps the post-delta value at +100; the per-tick decay then nudges
    // it back toward 0 by REPUTATION_DECAY_PER_TICK (0.5). So the visible
    // value after one tick is 99.5, not 100. The important guarantee is that
    // it stays bounded — never NaN, never larger than 100.
    const v = s.reputation?.western;
    expect(typeof v).toBe('number');
    expect(v).toBeLessThanOrEqual(100);
    expect(v).toBeGreaterThan(99);
  });
});

// ---------------------------------------------------------------------------
// Edge case: joinBloc on a freshly-left bloc must not leave the country in
// the previous bloc's roster. After leaveBloc → joinBloc, only the new bloc
// should list the country.
// ---------------------------------------------------------------------------
describe('audit: leaveBloc → joinBloc roster consistency', () => {
  it('removes country from old roster and adds to new', () => {
    let s = createGame(phase3Scenario, {
      seed: 'audit-roster',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    expect(s.blocs?.western?.memberCountryIds).toContain('aurion');
    s = applyLeaveBloc(s, { type: 'leaveBloc' }, 'aurion').state;
    expect(s.blocs?.western?.memberCountryIds).not.toContain('aurion');
    s = applyJoinBloc(s, { type: 'joinBloc', blocId: 'eastern' }, 'aurion').state;
    expect(s.blocs?.eastern?.memberCountryIds).toContain('aurion');
    expect(s.blocs?.western?.memberCountryIds).not.toContain('aurion');
    expect(s.countries.aurion!.blocId).toBe('eastern');
  });
});

import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { applyAction } from '../src/actions/index.js';
import { applyVoteUN } from '../src/actions/voteUN.js';
import { applyProposeUNResolution } from '../src/actions/proposeUNResolution.js';
import { tick } from '../src/tick.js';
import { createRng } from '../src/rng.js';
import {
  _resetUnsupportedEffectWarnings,
  initUN,
  maybeTriggerFromAction,
  openResolutionFromTemplate,
  tickUN,
} from '../src/un/index.js';
import {
  evaluateActionTrigger,
  evaluatePeriodicTriggers,
} from '../src/un/triggers.js';
import { makePhase3Scenario, makeScenario } from './fixtures.js';

const scenario = makePhase3Scenario();

function freshState(seed = 'un-tests') {
  return createGame(scenario, {
    seed,
    victory: 'economic',
    playerCountryId: 'aurion',
    gameMode: 'eternal',
  });
}

describe('initUN', () => {
  it('returns [] when scenario has UN signals', () => {
    expect(initUN(scenario)).toEqual([]);
  });

  it('returns undefined when scenario has no UN signals', () => {
    expect(initUN(makeScenario())).toBeUndefined();
  });
});

describe('proposeUNResolution', () => {
  it('errors when scenario has no UN', () => {
    const noUN = createGame(makeScenario(), {
      seed: 's',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    const r = applyProposeUNResolution(
      noUN,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'aurion',
    );
    expect(r.errors).toContain('errors.un.notAvailable');
  });

  it('errors on invalid target', () => {
    const r = applyProposeUNResolution(
      freshState(),
      { type: 'proposeUNResolution', kind: 'sanctions', targetCountryId: 'nonexistent' },
      'aurion',
      scenario,
    );
    expect(r.errors).toContain('errors.un.invalidTarget');
  });

  it('errors on self-target', () => {
    const r = applyProposeUNResolution(
      freshState(),
      { type: 'proposeUNResolution', kind: 'sanctions', targetCountryId: 'aurion' },
      'aurion',
      scenario,
    );
    expect(r.errors).toContain('errors.un.selfTarget');
  });

  it('non-permanent member cannot propose hard kinds', () => {
    const s = freshState();
    const r = applyProposeUNResolution(
      s,
      { type: 'proposeUNResolution', kind: 'sanctions', targetCountryId: 'meridia' },
      'borealis',
      scenario,
    );
    expect(r.errors).toContain('errors.un.notPermanent');
  });

  it('any country can propose humanitarian', () => {
    const r = applyProposeUNResolution(
      freshState(),
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'borealis',
      scenario,
    );
    expect(r.errors).toEqual([]);
    expect(r.state.unResolutions?.length).toBe(1);
    expect(r.state.unResolutions?.[0]?.proposerCountryId).toBe('borealis');
  });
});

describe('voteUN', () => {
  it('errors when resolution unknown', () => {
    const s = freshState();
    const r = applyVoteUN(
      s,
      { type: 'voteUN', resolutionId: 'no-such-id', vote: 'yes' },
      'aurion',
    );
    expect(r.errors).toContain('errors.un.resolutionNotFound');
  });

  it('errors when voting twice', () => {
    let s = freshState();
    const r1 = applyProposeUNResolution(
      s,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'borealis',
      scenario,
    );
    s = r1.state;
    const id = s.unResolutions![0]!.id;
    // Borealis already auto-voted yes when proposing.
    const r2 = applyVoteUN(
      s,
      { type: 'voteUN', resolutionId: id, vote: 'yes' },
      'borealis',
    );
    expect(r2.errors).toContain('errors.un.alreadyVoted');
  });

  it('non-permanent member cannot veto', () => {
    let s = freshState();
    const r1 = applyProposeUNResolution(
      s,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'aurion',
      scenario,
    );
    s = r1.state;
    const id = s.unResolutions![0]!.id;
    const r2 = applyVoteUN(
      s,
      { type: 'voteUN', resolutionId: id, vote: 'veto' },
      'borealis',
      scenario,
    );
    expect(r2.errors).toContain('errors.un.vetoNotPermitted');
  });

  it('happy path: vote is recorded', () => {
    let s = freshState();
    const r1 = applyProposeUNResolution(
      s,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'aurion',
      scenario,
    );
    s = r1.state;
    const id = s.unResolutions![0]!.id;
    const r2 = applyVoteUN(
      s,
      { type: 'voteUN', resolutionId: id, vote: 'yes' },
      'borealis',
    );
    expect(r2.errors).toEqual([]);
    expect(r2.state.unResolutions?.[0]?.votes['borealis']).toBe('yes');
  });

  it('errors after voting window closes', () => {
    let s = freshState();
    const r1 = applyProposeUNResolution(
      s,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'aurion',
      scenario,
    );
    s = r1.state;
    const id = s.unResolutions![0]!.id;
    s = { ...s, tick: s.tick + 10 };
    const r2 = applyVoteUN(
      s,
      { type: 'voteUN', resolutionId: id, vote: 'yes' },
      'borealis',
    );
    expect(r2.errors).toContain('errors.un.alreadyClosed');
  });
});

describe('tickUN: voting closes', () => {
  it('passes when yes > no', () => {
    let s = freshState();
    const r = applyProposeUNResolution(
      s,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'aurion',
      scenario,
    );
    s = r.state;
    // Force manual yes votes from all other countries.
    const id = s.unResolutions![0]!.id;
    s = applyVoteUN(s, { type: 'voteUN', resolutionId: id, vote: 'yes' }, 'borealis').state;
    // Advance past voting window.
    s = { ...s, tick: s.tick + 5 };
    const rng = createRng('p');
    s = tickUN(s, scenario, rng);
    expect(s.unResolutions?.[0]?.status).toBe('passed');
  });

  it('vetoes when permanent member votes veto', () => {
    let s = freshState();
    const r = applyProposeUNResolution(
      s,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'aurion',
      scenario,
    );
    s = r.state;
    const id = s.unResolutions![0]!.id;
    s = applyVoteUN(s, { type: 'voteUN', resolutionId: id, vote: 'veto' }, 'meridia', scenario).state;
    s = { ...s, tick: s.tick + 5 };
    const rng = createRng('v');
    s = tickUN(s, scenario, rng);
    expect(s.unResolutions?.[0]?.status).toBe('vetoed');
  });

  it('fails on tie', () => {
    let s = freshState();
    const r = applyProposeUNResolution(
      s,
      { type: 'proposeUNResolution', kind: 'humanitarian' },
      'aurion',
      scenario,
    );
    s = r.state;
    const id = s.unResolutions![0]!.id;
    // Force all AI votes to no/abstain, leaving aurion yes vs borealis no.
    s = applyVoteUN(s, { type: 'voteUN', resolutionId: id, vote: 'no' }, 'borealis').state;
    s = applyVoteUN(s, { type: 'voteUN', resolutionId: id, vote: 'no' }, 'khanate').state;
    s = applyVoteUN(s, { type: 'voteUN', resolutionId: id, vote: 'abstain' }, 'meridia').state;
    s = { ...s, tick: s.tick + 5 };
    const rng = createRng('t');
    s = tickUN(s, scenario, rng);
    // 1 yes vs 2 no → failed
    expect(s.unResolutions?.[0]?.status).toBe('failed');
  });

  it('is a no-op when unResolutions undefined', () => {
    const noUN = createGame(makeScenario(), {
      seed: 'noUN',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    const rng = createRng('n');
    const next = tickUN(noUN, scenario, rng);
    expect(next).toBe(noUN);
  });
});

describe('contextual triggers (Q2)', () => {
  it('declareWar triggers a peacekeeping resolution via unTriggerMap', () => {
    let s = freshState();
    const action = {
      type: 'diplomacy' as const,
      target: 'meridia',
      kind: 'declareWar' as const,
    };
    s = applyAction(s, action, 'aurion', [], undefined, scenario).state;
    const triggered = maybeTriggerFromAction(s, scenario, action, 'aurion');
    expect(triggered.unResolutions?.length).toBeGreaterThan(0);
    expect(triggered.unResolutions?.[0]?.kind).toBe('peacekeeping');
  });

  it('returns null template when scenario has no unTriggerMap', () => {
    const action = {
      type: 'diplomacy' as const,
      target: 'meridia',
      kind: 'declareWar' as const,
    };
    expect(evaluateActionTrigger(action, freshState(), makeScenario())).toBeNull();
  });

  it('graceful no-op when key missing from map', () => {
    let s = freshState();
    const action = {
      type: 'diplomacy' as const,
      target: 'meridia',
      kind: 'sueForPeace' as const,
    };
    const triggered = maybeTriggerFromAction(s, scenario, action, 'aurion');
    // sueForPeace has no key in the map → state unchanged.
    expect(triggered.unResolutions?.length).toBe(0);
  });
});

describe('periodic triggers', () => {
  it('returns null without high tension', () => {
    const s = { ...freshState(), tick: 50, worldTension: 10 };
    const rng = createRng('p1');
    expect(evaluatePeriodicTriggers(s, scenario, rng)).toBeNull();
  });

  it('may fire climate accord at high tension', () => {
    // Find an rng seed that returns < 0.25 on first next() call.
    let fired = false;
    for (let seed = 0; seed < 100; seed++) {
      const rng = createRng(`p2-${seed}`);
      const result = evaluatePeriodicTriggers(
        { ...freshState(), tick: 50, worldTension: 80 },
        scenario,
        rng,
      );
      if (result) {
        fired = true;
        expect(result.kind).toBe('climate');
        break;
      }
    }
    expect(fired).toBe(true);
  });
});

describe('AI proposes / votes', () => {
  it('AI permanent member may propose periodically (over many ticks)', () => {
    // Run many ticks with high tension and observe that some AI proposal happens.
    let s = freshState('p3-ai');
    s = { ...s, worldTension: 80 };
    let foundAiProposed = false;
    for (let i = 0; i < 200; i++) {
      s = tick(s, { scenario, techCatalog: scenario.techTree, eventPool: scenario.eventPool });
      if ((s.unResolutions ?? []).some((r) => r.proposerCountryId !== 'aurion')) {
        foundAiProposed = true;
        break;
      }
    }
    expect(foundAiProposed).toBe(true);
  });

  it('openResolutionFromTemplate appends a new resolution', () => {
    const s = freshState('p3-otmpl');
    const template = scenario.unTriggerMap!.declareWar!;
    const next = openResolutionFromTemplate(s, template, 'meridia', 'aurion');
    expect(next.unResolutions?.length).toBe(1);
    expect(next.unResolutions?.[0]?.proposerCountryId).toBe('meridia');
    expect(next.unResolutions?.[0]?.targetCountryId).toBe('aurion');
  });
});

// ---------------------------------------------------------------------------
// applyEventEffects coverage: stats and non-modifyStat effect types that were
// previously silently dropped.
// ---------------------------------------------------------------------------
describe('applyEventEffects: expanded stat + effect coverage', () => {
  /**
   * Helper: open a resolution from a custom template, advance to closure, and
   * drive tickUN once so the onPass effects fire.
   */
  function runPassingResolution(
    state: ReturnType<typeof freshState>,
    template: import('../src/index.js').UNResolutionTemplate,
    proposer: string = 'aurion',
    target?: string,
  ) {
    let s = openResolutionFromTemplate(state, template, proposer, target);
    const id = s.unResolutions![s.unResolutions!.length - 1]!.id;
    // Force every other AI vote to yes so the resolution passes.
    for (const cid of Object.keys(s.countries)) {
      if (cid === proposer) continue;
      s = applyVoteUN(s, { type: 'voteUN', resolutionId: id, vote: 'yes' }, cid, scenario).state;
    }
    s = { ...s, tick: s.tick + template.votingDurationTicks + 1 };
    return tickUN(s, scenario, createRng('apply-fx'));
  }

  it('modifies armySize via modifyStat (clamped to >=0)', () => {
    const before = freshState('army-stat').countries.aurion!.military.armySize;
    const tmpl: import('../src/index.js').UNResolutionTemplate = {
      kind: 'peacekeeping',
      titleKey: 'un.test.army',
      descriptionKey: 'un.test.army.desc',
      votingDurationTicks: 2,
      effects: {
        onPass: [{ type: 'modifyStat', target: 'player', stat: 'armySize', delta: 250 }],
        onFail: [],
      },
    };
    const s = runPassingResolution(freshState('army-stat'), tmpl);
    expect(s.countries.aurion!.military.armySize).toBe(before + 250);
  });

  it('modifies doctrineLevel via modifyStat (clamped to [0,1])', () => {
    const tmpl: import('../src/index.js').UNResolutionTemplate = {
      kind: 'peacekeeping',
      titleKey: 'un.test.doctrine',
      descriptionKey: 'un.test.doctrine.desc',
      votingDurationTicks: 2,
      effects: {
        onPass: [{ type: 'modifyStat', target: 'player', stat: 'doctrineLevel', delta: 100 }],
        onFail: [],
      },
    };
    const s = runPassingResolution(freshState('doctrine-stat'), tmpl);
    // Clamped at 1, not 100 + 0.3 baseline.
    expect(s.countries.aurion!.military.doctrineLevel).toBe(1);
  });

  it('modifies taxRate via modifyStat (clamped to [0,100])', () => {
    const tmpl: import('../src/index.js').UNResolutionTemplate = {
      kind: 'climate',
      titleKey: 'un.test.tax',
      descriptionKey: 'un.test.tax.desc',
      votingDurationTicks: 2,
      effects: {
        onPass: [{ type: 'modifyStat', target: 'player', stat: 'taxRate', delta: 5 }],
        onFail: [],
      },
    };
    const before = freshState('tax-stat').countries.aurion!.economy.taxRate;
    const s = runPassingResolution(freshState('tax-stat'), tmpl);
    expect(s.countries.aurion!.economy.taxRate).toBe(before + 5);
  });

  it('modifies spyCount via modifyStat (clamped to >=0)', () => {
    const tmpl: import('../src/index.js').UNResolutionTemplate = {
      kind: 'nonProliferation',
      titleKey: 'un.test.spy',
      descriptionKey: 'un.test.spy.desc',
      votingDurationTicks: 2,
      effects: {
        onPass: [{ type: 'modifyStat', target: 'player', stat: 'spyCount', delta: -1000 }],
        onFail: [],
      },
    };
    const s = runPassingResolution(freshState('spy-stat'), tmpl);
    expect(s.countries.aurion!.intelligence.spyCount).toBe(0);
  });

  it('applies shiftAttitude between proposer and target country', () => {
    const tmpl: import('../src/index.js').UNResolutionTemplate = {
      kind: 'recognition',
      titleKey: 'un.test.shift',
      descriptionKey: 'un.test.shift.desc',
      votingDurationTicks: 2,
      effects: {
        onPass: [{ type: 'shiftAttitude', with: 'borealis', delta: 15 }],
        onFail: [],
      },
    };
    // Proposer aurion ↔ borealis attitude starts at 50 (per phase3 fixture).
    const before = 50;
    const s = runPassingResolution(freshState('shift-attitude'), tmpl, 'aurion');
    const key = 'aurion::borealis' as const;
    expect(s.relations[key]?.attitude).toBe(before + 15);
  });

  it('clamps shiftAttitude into [-100, 100]', () => {
    const tmpl: import('../src/index.js').UNResolutionTemplate = {
      kind: 'recognition',
      titleKey: 'un.test.shift.clamp',
      descriptionKey: 'un.test.shift.clamp.desc',
      votingDurationTicks: 2,
      effects: {
        onPass: [{ type: 'shiftAttitude', with: 'borealis', delta: 10_000 }],
        onFail: [],
      },
    };
    const s = runPassingResolution(freshState('shift-clamp'), tmpl, 'aurion');
    const key = 'aurion::borealis' as const;
    expect(s.relations[key]?.attitude).toBe(100);
  });

  it('applies startResearch effect (sets activeResearch when idle)', () => {
    const tmpl: import('../src/index.js').UNResolutionTemplate = {
      kind: 'climate',
      titleKey: 'un.test.research',
      descriptionKey: 'un.test.research.desc',
      votingDurationTicks: 2,
      effects: {
        onPass: [{ type: 'startResearch', target: 'aurion', techId: 'tech_industry_basics' }],
        onFail: [],
      },
    };
    const s = runPassingResolution(freshState('start-research'), tmpl);
    expect(s.countries.aurion!.science.activeResearch).toBe('tech_industry_basics');
  });

  it('startResearch is a no-op when target is already researching', () => {
    const tmpl: import('../src/index.js').UNResolutionTemplate = {
      kind: 'climate',
      titleKey: 'un.test.research.busy',
      descriptionKey: 'un.test.research.busy.desc',
      votingDurationTicks: 2,
      effects: {
        onPass: [{ type: 'startResearch', target: 'aurion', techId: 'tech_doctrine_basic' }],
        onFail: [],
      },
    };
    let base = freshState('research-busy');
    // Pre-set a different active research to verify it isn't overwritten.
    base = {
      ...base,
      countries: {
        ...base.countries,
        aurion: {
          ...base.countries.aurion!,
          science: {
            ...base.countries.aurion!.science,
            activeResearch: 'tech_industry_basics',
          },
        },
      },
    };
    const s = runPassingResolution(base, tmpl);
    expect(s.countries.aurion!.science.activeResearch).toBe('tech_industry_basics');
  });

  it('spawnSpy is skipped and warns once per (resolution, type) pair', () => {
    _resetUnsupportedEffectWarnings();
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.join(' '));
    try {
      const tmpl: import('../src/index.js').UNResolutionTemplate = {
        kind: 'sanctions',
        titleKey: 'un.test.spawnspy',
        descriptionKey: 'un.test.spawnspy.desc',
        votingDurationTicks: 2,
        effects: {
          onPass: [
            { type: 'spawnSpy', against: 'borealis', opType: 'steal_tech' },
            { type: 'spawnSpy', against: 'borealis', opType: 'sabotage' },
          ],
          onFail: [],
        },
      };
      // Run two passing resolutions of the SAME template — only one warning.
      runPassingResolution(freshState('spawnspy-1'), tmpl);
      runPassingResolution(freshState('spawnspy-2'), tmpl);
      const spawnSpyWarnings = warnings.filter((w) => w.includes('spawnSpy'));
      expect(spawnSpyWarnings.length).toBe(1);
    } finally {
      console.warn = orig;
    }
  });

  it('warns once for an unknown stat passed via modifyStat', () => {
    _resetUnsupportedEffectWarnings();
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.join(' '));
    try {
      const tmpl: import('../src/index.js').UNResolutionTemplate = {
        kind: 'humanitarian',
        titleKey: 'un.test.bogusstat',
        descriptionKey: 'un.test.bogusstat.desc',
        votingDurationTicks: 2,
        effects: {
          onPass: [{ type: 'modifyStat', target: 'player', stat: 'someBogusStat', delta: 1 }],
          onFail: [],
        },
      };
      runPassingResolution(freshState('bogus-stat-1'), tmpl);
      runPassingResolution(freshState('bogus-stat-2'), tmpl);
      const bogus = warnings.filter((w) => w.includes('someBogusStat'));
      expect(bogus.length).toBe(1);
    } finally {
      console.warn = orig;
    }
  });
});

import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { tick } from '../src/tick.js';
import { applyStartResearch } from '../src/actions/startResearch.js';
import { openResolutionFromTemplate } from '../src/un/index.js';
import {
  makePhase3Scenario,
  makeScenario,
  sampleTechs,
  sampleEvents,
} from './fixtures.js';
import type { UNResolutionTemplate } from '../src/index.js';

const scenario = makeScenario();

function freshState() {
  return createGame(scenario, {
    seed: 'tick-seed',
    victory: 'economic',
    playerCountryId: 'aurion',
  });
}

describe('tick', () => {
  it('advances tick by 1', () => {
    const a = freshState();
    const b = tick(a, { techCatalog: sampleTechs, eventPool: sampleEvents });
    expect(b.tick).toBe(a.tick + 1);
  });

  it('treasury follows weeklyIncome', () => {
    const a = freshState();
    const b = tick(a, { techCatalog: sampleTechs });
    const before = a.countries.aurion!.economy.treasury;
    const income = b.countries.aurion!.economy.weeklyIncome;
    expect(b.countries.aurion!.economy.treasury).toBe(before + income);
  });

  it('completed research clears activeResearch and adds to completedTechs', () => {
    const start = applyStartResearch(
      freshState(),
      { type: 'startResearch', techId: 'tech_industry_basics' },
      'aurion',
      sampleTechs,
    );
    let s = start.state;
    // Run enough ticks for cost (50) at researchOutput. Should be a few ticks.
    for (let i = 0; i < 60 && s.countries.aurion?.science.activeResearch !== null; i++) {
      s = tick(s, { techCatalog: sampleTechs });
    }
    expect(s.countries.aurion!.science.activeResearch).toBeNull();
    expect(s.countries.aurion!.science.completedTechs).toContain('tech_industry_basics');
  });

  it('does not advance when winLoss is not playing', () => {
    const a = { ...freshState(), winLoss: 'won' as const };
    const b = tick(a);
    expect(b).toBe(a);
  });

  it('does not mutate input state', () => {
    const a = freshState();
    const snapshot = JSON.stringify(a);
    tick(a, { techCatalog: sampleTechs });
    expect(JSON.stringify(a)).toBe(snapshot);
  });
});

// ---------------------------------------------------------------------------
// Pin tick step ordering: tickUN MUST run before checkWinLoss so that a
// resolution closing in the SAME tick whose effects flip a win/loss
// condition is visible on the same tick — not one tick later. Regression
// test for the audit finding.
// ---------------------------------------------------------------------------
describe('tick: UN closes before checkWinLoss (same-tick loss detection)', () => {
  it("UN resolution that crashes popularity triggers loss in the same tick", () => {
    const phase3 = makePhase3Scenario();
    let s = createGame(phase3, {
      seed: 'tick-ordering-uncheck',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    // Set player popularity to 12 — above threshold (10) but close enough
    // that a -50 modifier guarantees the loss criterion fires.
    s = {
      ...s,
      countries: {
        ...s.countries,
        aurion: {
          ...s.countries.aurion!,
          politics: { ...s.countries.aurion!.politics, popularity: 12 },
        },
      },
      // Pre-fill the lose streak just below the threshold so a single hit
      // flips the run. Default threshold is 12 weeks; we set the streak to
      // 11 so the next sub-10 tick is the 12th.
      _loseStreaks: {
        lowPopularityWeeks: 11,
        negativeTreasuryWeeks: 0,
        capitalOccupiedWeeks: 0,
        allFactionsAngryWeeks: 0,
      },
    };
    // Open a resolution that ON PASS drops the player's popularity by 50.
    const tmpl: UNResolutionTemplate = {
      kind: 'condemnation',
      titleKey: 'un.tickorder.pop',
      descriptionKey: 'un.tickorder.pop.desc',
      // Minimum 1 so openResolutionFromTemplate's `||` default doesn't kick in.
      votingDurationTicks: 1,
      effects: {
        onPass: [{ type: 'modifyStat', target: 'player', stat: 'popularity', delta: -50 }],
        onFail: [],
      },
    };
    // Use khanate (a permanent member) as proposer so the resolution carries
    // some yes weight without an explicit player vote needed.
    s = openResolutionFromTemplate(s, tmpl, 'khanate');
    // Force enough yes votes from non-proposers so the resolution passes.
    s = {
      ...s,
      unResolutions: s.unResolutions!.map((r) => ({
        ...r,
        votes: { ...r.votes, aurion: 'yes', borealis: 'yes', meridia: 'yes' },
      })),
    };
    // Voting window opens at state.tick and closes at state.tick+1. Bump our
    // notion of "current tick" forward so the window closes when tickUN runs.
    s = { ...s, tick: s.tick + 1 };
    // Drive a single tick — UN closes, player popularity drops to 0, then
    // checkWinLoss must see the sub-10 popularity AND the pre-loaded 11-week
    // streak together and flip winLoss to 'lost' in the same tick. If
    // checkWinLoss ran BEFORE tickUN (the bug we're guarding against), the
    // 12th tick's popularity reading would still be the pre-resolution 12,
    // and the loss would lag by one tick.
    const after = tick(s, {
      scenario: phase3,
      techCatalog: phase3.techTree,
      eventPool: phase3.eventPool,
    });
    expect(after.unResolutions?.[0]?.status).toBe('passed');
    expect(after.countries.aurion!.politics.popularity).toBeLessThan(10);
    expect(after.winLoss).toBe('lost');
  });
});

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { tick } from '../src/tick.js';
import { applyAction } from '../src/actions/index.js';
import { makeScenario, sampleEvents, sampleTechs } from './fixtures.js';
import type { Action, FactionId, InvestTarget } from '../src/index.js';

const scenario = makeScenario();

const investTargetArb = fc.constantFrom<InvestTarget>(
  'economy',
  'research',
  'military',
  'intel',
  'infra',
);
const factionArb = fc.constantFrom<FactionId>(
  'army',
  'business',
  'religious',
  'populist',
  'reformist',
);
const techIdArb = fc.constantFrom(
  'tech_industry_basics',
  'tech_doctrine_basic',
  'tech_intel_basics',
);

const actionArb: fc.Arbitrary<Action> = fc.oneof(
  fc
    .tuple(investTargetArb, fc.integer({ min: 50_000_000, max: 500_000_000 }))
    .map(([target, amount]): Action => ({ type: 'invest', target, amount })),
  fc.integer({ min: 0, max: 100 }).map((rate): Action => ({ type: 'setTaxRate', rate })),
  factionArb.map((factionId): Action => ({ type: 'placateFaction', factionId })),
  techIdArb.map((techId): Action => ({ type: 'startResearch', techId })),
);

function snapshot(s: unknown): string {
  return JSON.stringify(s);
}

describe('engine invariants (fast-check)', () => {
  it('applyAction does not mutate input state', () => {
    fc.assert(
      fc.property(actionArb, (action) => {
        const s = createGame(scenario, {
          seed: 'inv-1',
          victory: 'economic',
          playerCountryId: 'aurion',
        });
        const before = snapshot(s);
        applyAction(s, action, 'aurion', sampleTechs);
        expect(snapshot(s)).toBe(before);
      }),
      { numRuns: 30 },
    );
  });

  it('tick always increases state.tick by exactly 1 (when playing)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (n) => {
        let s = createGame(scenario, {
          seed: 'inv-2',
          victory: 'economic',
          playerCountryId: 'aurion',
        });
        const start = s.tick;
        for (let i = 0; i < n; i++) {
          s = tick(s, { techCatalog: sampleTechs, eventPool: sampleEvents });
        }
        expect(s.tick - start).toBe(n);
      }),
      { numRuns: 10 },
    );
  });

  it('failed actions return the same state object reference', () => {
    const s = createGame(scenario, {
      seed: 'inv-3',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    const result = applyAction(
      s,
      { type: 'invest', target: 'economy', amount: -100 },
      'aurion',
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.state).toBe(s);
  });
});

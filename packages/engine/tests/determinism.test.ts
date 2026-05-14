import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { tick } from '../src/tick.js';
import { applyAction } from '../src/actions/index.js';
import { makeScenario, sampleEvents, sampleTechs } from './fixtures.js';
import type { Action, GameState } from '../src/index.js';

const scenario = makeScenario();

function hashState(s: GameState): string {
  return createHash('sha256').update(JSON.stringify(s)).digest('hex');
}

describe('determinism', () => {
  it('same seed + same actions → identical state hash', () => {
    const actions: Action[] = [
      { type: 'invest', target: 'economy', amount: 100_000_000 },
      { type: 'startResearch', techId: 'tech_industry_basics' },
      { type: 'setTaxRate', rate: 30 },
      { type: 'placateFaction', factionId: 'army' },
    ];
    function run(): GameState {
      let s = createGame(scenario, {
        seed: 'fixed-determinism',
        victory: 'economic',
        playerCountryId: 'aurion',
      });
      for (const a of actions) {
        const r = applyAction(s, a, 'aurion', sampleTechs);
        s = r.state;
      }
      for (let i = 0; i < 30; i++) {
        s = tick(s, { techCatalog: sampleTechs, eventPool: sampleEvents });
      }
      return s;
    }
    const h1 = hashState(run());
    const h2 = hashState(run());
    expect(h1).toBe(h2);
  });
});

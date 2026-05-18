import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { tick } from '../src/tick.js';
import { applyAction } from '../src/actions/index.js';
import {
  makePhase3Scenario,
  makeScenario,
  sampleEvents,
  sampleTechs,
} from './fixtures.js';
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

  // -------------------------------------------------------------------------
  // Phase 3 determinism: bloc + UN + nuclear actions remain hash-stable.
  //
  // Action sequence (per run):
  //   1. joinBloc('eastern')                         — aurion swaps from western to eastern
  //   2. 5 ticks                                     — let bloc/reputation systems advance
  //   3. proposeUNResolution(humanitarian)           — any country can propose this soft kind
  //   4. voteUN(<id>, 'yes') from borealis           — second vote on the same resolution
  //   5. 5 ticks                                     — let voting window advance toward closure
  //   6. launchTactical(<khanate region>)            — succeeds because the fixture starts aurion
  //                                                    and khanate at war and we patch in an arsenal
  //
  // We use the standard `makePhase3Scenario` which is dethrone-by-default and
  // declares both blocs + a permanent UN council. The seed is a fixed hex
  // string so re-running the loop yields the same hash.
  // -------------------------------------------------------------------------
  it('determinism with Phase 3 actions', () => {
    const phase3 = makePhase3Scenario();
    function run(): GameState {
      let s = createGame(phase3, {
        seed: 'fixed-determinism-p3-0xC0FFEE',
        victory: 'economic',
        playerCountryId: 'aurion',
        gameMode: 'eternal',
      });
      // Pre-arm aurion with one warhead so `launchTactical` passes its
      // gating without depending on tech research mid-test. The fixture
      // declares aurion and khanate at war elsewhere, so the region target
      // is valid.
      s = {
        ...s,
        relations: {
          ...s.relations,
          'aurion::khanate': {
            ...s.relations['aurion::khanate']!,
            atWar: true,
          },
        },
        countries: {
          ...s.countries,
          aurion: {
            ...s.countries['aurion']!,
            nuclear: { warheadCount: 1, deliverySystemLevel: 0, mad: true },
          },
        },
      };

      const techCatalog = phase3.techTree;
      const eventPool = phase3.eventPool;
      const tickCtx = { techCatalog, eventPool, scenario: phase3 };

      // 1. joinBloc — aurion swaps to eastern.
      s = applyAction(
        s,
        { type: 'joinBloc', blocId: 'eastern' },
        'aurion',
        techCatalog,
        undefined,
        phase3,
      ).state;

      // 2. 5 ticks.
      for (let i = 0; i < 5; i++) s = tick(s, tickCtx);

      // 3. proposeUNResolution — humanitarian is allowed for any country.
      s = applyAction(
        s,
        { type: 'proposeUNResolution', kind: 'humanitarian' },
        'aurion',
        techCatalog,
        undefined,
        phase3,
      ).state;
      const lastResolutionId = s.unResolutions?.[s.unResolutions.length - 1]?.id;
      expect(lastResolutionId).toBeDefined();

      // 4. voteUN from borealis (proposer auto-voted yes).
      const voteAction: Action = {
        type: 'voteUN',
        resolutionId: lastResolutionId!,
        vote: 'yes',
      };
      s = applyAction(s, voteAction, 'borealis', techCatalog, undefined, phase3).state;

      // 5. 5 ticks — voting window closes inside this stretch.
      for (let i = 0; i < 5; i++) s = tick(s, tickCtx);

      // 6. launchTactical — strike khanate's home region. Attempt is logged
      // even if effects mutate further state; the hash only requires that
      // the same code path runs twice and lands on the same bytes.
      const target = s.countries['khanate']!.regionId;
      s = applyAction(
        s,
        { type: 'launchTactical', targetRegionId: target },
        'aurion',
        techCatalog,
        undefined,
        phase3,
      ).state;
      return s;
    }
    const h1 = hashState(run());
    const h2 = hashState(run());
    expect(h1).toBe(h2);
  });
});

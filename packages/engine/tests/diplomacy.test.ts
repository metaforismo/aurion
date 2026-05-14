import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { applyDiplomacy } from '../src/actions/diplomacy.js';
import { makeScenario } from './fixtures.js';

const scenario = makeScenario();
const baseState = createGame(scenario, {
  seed: 'dipl',
  victory: 'economic',
  playerCountryId: 'aurion',
});

describe('applyDiplomacy', () => {
  it('happy path: declares war and flips relation', () => {
    const result = applyDiplomacy(
      baseState,
      { type: 'diplomacy', target: 'khanate', kind: 'declareWar' },
      'aurion',
    );
    expect(result.errors).toEqual([]);
    expect(result.state.relations['aurion::khanate']?.atWar).toBe(true);
    expect(result.state.relations['aurion::khanate']?.attitude).toBeLessThan(
      baseState.relations['aurion::khanate']!.attitude,
    );
  });

  it('rejects sueForPeace when not at war', () => {
    const result = applyDiplomacy(
      baseState,
      { type: 'diplomacy', target: 'khanate', kind: 'sueForPeace' },
      'aurion',
    );
    expect(result.errors).toContain('errors.diplomacy.notAtWar');
  });

  it('rejects self-target', () => {
    const result = applyDiplomacy(
      baseState,
      { type: 'diplomacy', target: 'aurion', kind: 'tradeDeal' },
      'aurion',
    );
    expect(result.errors).toContain('errors.diplomacy.selfTarget');
  });

  it('proposeAlliance sets alliance treaty when attitude positive', () => {
    const result = applyDiplomacy(
      baseState,
      { type: 'diplomacy', target: 'borealis', kind: 'proposeAlliance' },
      'aurion',
    );
    expect(result.errors).toEqual([]);
    expect(result.state.relations['aurion::borealis']?.treaties).toContain('alliance');
  });

  it('proposeAlliance refuses when attitude is negative', () => {
    const result = applyDiplomacy(
      baseState,
      { type: 'diplomacy', target: 'khanate', kind: 'proposeAlliance' },
      'aurion',
    );
    expect(result.errors).toContain('errors.diplomacy.attitudeTooLow');
  });

  it('declareWar is blocked while an alliance is in place', () => {
    const allied = applyDiplomacy(
      baseState,
      { type: 'diplomacy', target: 'borealis', kind: 'proposeAlliance' },
      'aurion',
    );
    const warred = applyDiplomacy(
      allied.state,
      { type: 'diplomacy', target: 'borealis', kind: 'declareWar' },
      'aurion',
    );
    expect(warred.errors).toContain('errors.diplomacy.alliedCannotWar');
    expect(warred.state.relations['aurion::borealis']?.atWar).toBe(false);
  });

  it('declareWar is blocked while a non-aggression pact is in place', () => {
    // Inject a non-aggression treaty by hand (we have no action that adds one).
    const stateWithPact = {
      ...baseState,
      relations: {
        ...baseState.relations,
        'aurion::khanate': {
          ...baseState.relations['aurion::khanate']!,
          treaties: [
            ...baseState.relations['aurion::khanate']!.treaties,
            'nonAggression' as const,
          ],
        },
      },
    };
    const result = applyDiplomacy(
      stateWithPact,
      { type: 'diplomacy', target: 'khanate', kind: 'declareWar' },
      'aurion',
    );
    expect(result.errors).toContain('errors.diplomacy.nonAggressionPact');
  });

  it('declareWar is blocked when attitude is too high (no casus belli)', () => {
    // borealis attitude is +30 in fixture: above the -25 threshold.
    const result = applyDiplomacy(
      baseState,
      { type: 'diplomacy', target: 'borealis', kind: 'declareWar' },
      'aurion',
    );
    expect(result.errors).toContain('errors.diplomacy.attitudeTooHighForWar');
  });

  it('declareWar is allowed against a sanctioned country regardless of attitude', () => {
    // Make the borealis relation friendly but sanctioned.
    const stateWithSanction = {
      ...baseState,
      relations: {
        ...baseState.relations,
        'aurion::borealis': {
          ...baseState.relations['aurion::borealis']!,
          attitude: 50,
          treaties: [
            ...baseState.relations['aurion::borealis']!.treaties,
            'sanctions' as const,
          ],
        },
      },
    };
    const result = applyDiplomacy(
      stateWithSanction,
      { type: 'diplomacy', target: 'borealis', kind: 'declareWar' },
      'aurion',
    );
    expect(result.errors).toEqual([]);
    expect(result.state.relations['aurion::borealis']?.atWar).toBe(true);
  });
});

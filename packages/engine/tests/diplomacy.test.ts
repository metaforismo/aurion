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

  it('declareWar drops any existing alliance', () => {
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
    expect(warred.state.relations['aurion::borealis']?.atWar).toBe(true);
    expect(warred.state.relations['aurion::borealis']?.treaties).not.toContain('alliance');
  });
});

import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import {
  applyPlacateFaction,
  PLACATE_BOOST,
  PLACATE_COST,
} from '../src/actions/placateFaction.js';
import { makeScenario } from './fixtures.js';

const scenario = makeScenario();
const baseState = createGame(scenario, {
  seed: 'pf',
  victory: 'economic',
  playerCountryId: 'aurion',
});

describe('applyPlacateFaction', () => {
  it('happy path: spends treasury and raises faction satisfaction', () => {
    const result = applyPlacateFaction(
      baseState,
      { type: 'placateFaction', factionId: 'army' },
      'aurion',
    );
    expect(result.errors).toEqual([]);
    expect(result.state.countries.aurion!.economy.treasury).toBe(
      baseState.countries.aurion!.economy.treasury - PLACATE_COST,
    );
    expect(
      result.state.countries.aurion!.politics.factions.army.satisfaction,
    ).toBeGreaterThanOrEqual(50 + PLACATE_BOOST - 1);
  });

  it('rejects when treasury is insufficient', () => {
    const broke = {
      ...baseState,
      countries: {
        ...baseState.countries,
        aurion: {
          ...baseState.countries.aurion!,
          economy: { ...baseState.countries.aurion!.economy, treasury: 0 },
        },
      },
    };
    const result = applyPlacateFaction(
      broke,
      { type: 'placateFaction', factionId: 'army' },
      'aurion',
    );
    expect(result.errors).toContain('errors.placate.insufficientTreasury');
  });
});

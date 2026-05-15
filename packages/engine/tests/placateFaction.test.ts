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

  it('rejects when the actor country is missing', () => {
    const result = applyPlacateFaction(
      baseState,
      { type: 'placateFaction', factionId: 'army' },
      'ghostland',
    );
    expect(result.errors).toContain('errors.country.notFound');
  });

  it('rejects when the faction id is unknown', () => {
    // Engineer a state where the targeted faction key is genuinely missing
    // from the factions record (e.g. truncated save data). Cast the action
    // through the raw type to drive the unknown-faction branch.
    const stripped = {
      ...baseState,
      countries: {
        ...baseState.countries,
        aurion: {
          ...baseState.countries.aurion!,
          politics: {
            ...baseState.countries.aurion!.politics,
            factions: {} as NonNullable<typeof baseState.countries.aurion>['politics']['factions'],
          },
        },
      },
    };
    const result = applyPlacateFaction(
      stripped,
      { type: 'placateFaction', factionId: 'army' },
      'aurion',
    );
    expect(result.errors).toContain('errors.placate.unknownFaction');
  });
});

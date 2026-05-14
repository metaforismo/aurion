import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { makeScenario } from './fixtures.js';

describe('createGame', () => {
  const scenario = makeScenario();

  it('creates a fresh GameState with the requested player', () => {
    const state = createGame(scenario, {
      seed: 'fixed-seed',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    expect(state.tick).toBe(0);
    expect(state.scenarioId).toBe('test-scenario');
    expect(state.playerCountryId).toBe('aurion');
    expect(state.selectedVictoryCondition).toBe('economic');
    expect(state.winLoss).toBe('playing');
    expect(state.rngSeed).toBe('fixed-seed');
    expect(state.countries.aurion?.isPlayer).toBe(true);
    expect(state.countries.borealis?.isPlayer).toBe(false);
  });

  it('derives science.researchOutput from sectors', () => {
    const state = createGame(scenario, {
      seed: 's',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    expect(state.countries.aurion?.science.researchOutput).toBeGreaterThan(0);
    expect(state.countries.aurion?.science.activeResearch).toBeNull();
    expect(state.countries.aurion?.science.completedTechs).toEqual([]);
  });

  it('seeds techTreeProgress for every country', () => {
    const state = createGame(scenario, {
      seed: 's',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    expect(Object.keys(state.techTreeProgress).sort()).toEqual([
      'aurion',
      'borealis',
      'khanate',
    ]);
  });

  it('builds canonical sorted-pair RelationKeys for every pair of countries', () => {
    const state = createGame(scenario, {
      seed: 's',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    const keys = Object.keys(state.relations).sort();
    expect(keys).toEqual([
      'aurion::borealis',
      'aurion::khanate',
      'borealis::khanate',
    ]);
    // Check seeded relations preserved.
    expect(state.relations['aurion::borealis']?.attitude).toBe(30);
    expect(state.relations['aurion::khanate']?.attitude).toBe(-20);
    // The unseeded pair defaulted to 0.
    expect(state.relations['borealis::khanate']?.attitude).toBe(0);
  });

  it('rejects an invalid playerCountryId', () => {
    expect(() =>
      createGame(scenario, {
        victory: 'economic',
        playerCountryId: 'nonexistent',
      }),
    ).toThrow();
  });

  it('rejects a victory not in the scenario', () => {
    expect(() =>
      createGame(scenario, {
        // @ts-expect-error testing invalid input
        victory: 'cosmic',
        playerCountryId: 'aurion',
      }),
    ).toThrow();
  });
});

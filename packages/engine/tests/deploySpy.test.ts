import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { applyDeploySpy, computeSpyProbabilities } from '../src/actions/deploySpy.js';
import { makeScenario } from './fixtures.js';

const scenario = makeScenario();
const baseState = createGame(scenario, {
  seed: 'spy-seed',
  victory: 'economic',
  playerCountryId: 'aurion',
});

describe('applyDeploySpy', () => {
  it('happy path: creates an active SpyOperation and decrements spies', () => {
    const before = baseState.countries.aurion!.intelligence.spyCount;
    const result = applyDeploySpy(
      baseState,
      {
        type: 'deploySpy',
        op: {
          type: 'steal_tech',
          ownerCountryId: 'aurion',
          targetCountryId: 'borealis',
          payload: { kind: 'steal_tech', techId: 'tech_industry_basics' },
          durationTicks: 8,
          successProbability: 0,
          detectionRisk: 0,
        },
      },
      'aurion',
    );
    expect(result.errors).toEqual([]);
    expect(result.state.spyOperations).toHaveLength(1);
    const op = result.state.spyOperations[0]!;
    expect(op.status).toBe('active');
    expect(op.progressTicks).toBe(0);
    expect(op.startedAtTick).toBe(0);
    expect(result.state.countries.aurion!.intelligence.spyCount).toBe(before - 1);
  });

  it('refuses if owner has no spies', () => {
    const noSpyState = {
      ...baseState,
      countries: {
        ...baseState.countries,
        aurion: {
          ...baseState.countries.aurion!,
          intelligence: { ...baseState.countries.aurion!.intelligence, spyCount: 0 },
        },
      },
    };
    const result = applyDeploySpy(
      noSpyState,
      {
        type: 'deploySpy',
        op: {
          type: 'sabotage',
          ownerCountryId: 'aurion',
          targetCountryId: 'borealis',
          payload: { kind: 'sabotage', targetSector: 'military' },
          durationTicks: 4,
          successProbability: 0,
          detectionRisk: 0,
        },
      },
      'aurion',
    );
    expect(result.errors).toContain('errors.spy.noSpies');
  });

  it('refuses self-targeting', () => {
    const result = applyDeploySpy(
      baseState,
      {
        type: 'deploySpy',
        op: {
          type: 'propaganda',
          ownerCountryId: 'aurion',
          targetCountryId: 'aurion',
          payload: { kind: 'propaganda', targetFaction: null },
          durationTicks: 4,
          successProbability: 0,
          detectionRisk: 0,
        },
      },
      'aurion',
    );
    expect(result.errors).toContain('errors.spy.selfTarget');
  });

  it('refuses owner mismatch', () => {
    const result = applyDeploySpy(
      baseState,
      {
        type: 'deploySpy',
        op: {
          type: 'propaganda',
          ownerCountryId: 'borealis',
          targetCountryId: 'khanate',
          payload: { kind: 'propaganda', targetFaction: null },
          durationTicks: 4,
          successProbability: 0,
          detectionRisk: 0,
        },
      },
      'aurion',
    );
    expect(result.errors).toContain('errors.spy.ownerMismatch');
  });

  it('computeSpyProbabilities returns clamped probabilities', () => {
    const owner = baseState.countries.aurion!;
    const target = baseState.countries.borealis!;
    const probs = computeSpyProbabilities(owner, target, 'steal_tech');
    expect(probs.successProbability).toBeGreaterThan(0);
    expect(probs.successProbability).toBeLessThanOrEqual(0.99);
    expect(probs.detectionRisk).toBeGreaterThan(0);
    expect(probs.detectionRisk).toBeLessThanOrEqual(0.99);
  });
});

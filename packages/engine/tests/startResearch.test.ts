import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { applyStartResearch } from '../src/actions/startResearch.js';
import { makeScenario, sampleTechs } from './fixtures.js';

const scenario = makeScenario();
const baseState = createGame(scenario, {
  seed: 'sr',
  victory: 'economic',
  playerCountryId: 'aurion',
});

describe('applyStartResearch', () => {
  it('happy path: sets activeResearch and seeds techTreeProgress', () => {
    const result = applyStartResearch(
      baseState,
      { type: 'startResearch', techId: 'tech_industry_basics' },
      'aurion',
      sampleTechs,
    );
    expect(result.errors).toEqual([]);
    expect(result.state.countries.aurion!.science.activeResearch).toBe(
      'tech_industry_basics',
    );
    expect(result.state.techTreeProgress.aurion?.activeResearch).toBe(
      'tech_industry_basics',
    );
  });

  it('rejects unknown tech ids', () => {
    const result = applyStartResearch(
      baseState,
      { type: 'startResearch', techId: 'not_a_tech' },
      'aurion',
      sampleTechs,
    );
    expect(result.errors).toContain('errors.research.techNotFound');
  });

  it('rejects when prereqs not met', () => {
    const result = applyStartResearch(
      baseState,
      { type: 'startResearch', techId: 'tech_advanced_industry' },
      'aurion',
      sampleTechs,
    );
    expect(result.errors).toContain('errors.research.missingPrereq');
  });

  it('rejects starting a second research while one is active', () => {
    const r1 = applyStartResearch(
      baseState,
      { type: 'startResearch', techId: 'tech_industry_basics' },
      'aurion',
      sampleTechs,
    );
    const r2 = applyStartResearch(
      r1.state,
      { type: 'startResearch', techId: 'tech_doctrine_basic' },
      'aurion',
      sampleTechs,
    );
    expect(r2.errors).toContain('errors.research.alreadyActive');
  });

  it('rejects when the actor country is missing', () => {
    const result = applyStartResearch(
      baseState,
      { type: 'startResearch', techId: 'tech_industry_basics' },
      'ghostland',
      sampleTechs,
    );
    expect(result.errors).toContain('errors.country.notFound');
  });

  it('rejects when the tech is already completed', () => {
    const withCompleted = {
      ...baseState,
      countries: {
        ...baseState.countries,
        aurion: {
          ...baseState.countries.aurion!,
          science: {
            ...baseState.countries.aurion!.science,
            completedTechs: ['tech_industry_basics'],
          },
        },
      },
    };
    const result = applyStartResearch(
      withCompleted,
      { type: 'startResearch', techId: 'tech_industry_basics' },
      'aurion',
      sampleTechs,
    );
    expect(result.errors).toContain('errors.research.alreadyCompleted');
  });
});

// Reducer for the 'startResearch' action.

import type { Action, ApplyActionResult, CountryId, GameState, TechDefinition } from '../types.js';
import { withCountry } from './helpers.js';

export type StartResearchAction = Extract<Action, { type: 'startResearch' }>;

/**
 * Engine has no global tech catalog at runtime; we accept it via getter so
 * scenarios stay data-driven. Callers (UI / tick) hold the techTree array.
 * Internal tests / sim pass a small inline catalog.
 */
export function applyStartResearch(
  state: GameState,
  action: StartResearchAction,
  countryId: CountryId,
  techCatalog: readonly TechDefinition[],
): ApplyActionResult {
  const errors: string[] = [];
  const country = state.countries[countryId];
  if (!country) {
    errors.push('errors.country.notFound');
    return { state, errors };
  }
  const tech = techCatalog.find((t) => t.id === action.techId);
  if (!tech) {
    errors.push('errors.research.techNotFound');
    return { state, errors };
  }
  if (country.science.completedTechs.includes(action.techId)) {
    errors.push('errors.research.alreadyCompleted');
    return { state, errors };
  }
  if (country.science.activeResearch !== null) {
    errors.push('errors.research.alreadyActive');
    return { state, errors };
  }
  for (const prereq of tech.prereqs) {
    if (!country.science.completedTechs.includes(prereq)) {
      errors.push('errors.research.missingPrereq');
      return { state, errors };
    }
  }

  const updated = {
    ...country,
    science: {
      ...country.science,
      activeResearch: action.techId,
    },
  };
  const progress = state.techTreeProgress[countryId] ?? {
    activeResearch: null,
    accumulatedPoints: 0,
  };
  const next: GameState = {
    ...withCountry(state, updated),
    techTreeProgress: {
      ...state.techTreeProgress,
      [countryId]: {
        activeResearch: action.techId,
        accumulatedPoints: progress.accumulatedPoints, // keep any leftover from previous abandoned project
      },
    },
  };
  return { state: next, errors: [] };
}

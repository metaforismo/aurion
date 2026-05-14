// Scenario loader. Phase 1 ships exactly one scenario ("ascesa-aurion") that
// is being authored in parallel by the Scenario Designer agent. The JSON file
// may not yet exist — `loadScenario` handles that gracefully and surfaces a
// clear error.

import type { Scenario } from '@aurion/engine';

export type ScenarioId = 'ascesa-aurion';

export const SCENARIO_IDS: readonly ScenarioId[] = ['ascesa-aurion'] as const;

export class ScenarioNotFoundError extends Error {
  constructor(id: string) {
    super(`Scenario "${id}" is not available.`);
    this.name = 'ScenarioNotFoundError';
  }
}

export class ScenarioMessagesNotFoundError extends Error {
  constructor(id: string, locale: string) {
    super(`Scenario messages for "${id}" (${locale}) are not available.`);
    this.name = 'ScenarioMessagesNotFoundError';
  }
}

const scenarioCache = new Map<ScenarioId, Scenario>();
const messagesCache = new Map<string, Record<string, string>>();

/**
 * Dynamically import a scenario JSON. Centralised here so the rest of the
 * app stays agnostic to where scenarios live on disk. We use dynamic import
 * with a literal string per branch so that the bundler can statically resolve
 * each one — but wrap in try/catch because the file may not exist yet during
 * Wave 1 development.
 */
export async function loadScenario(id: ScenarioId): Promise<Scenario> {
  const cached = scenarioCache.get(id);
  if (cached) return cached;

  let scenario: Scenario;
  try {
    if (id === 'ascesa-aurion') {
      const mod = (await import(
        '../content/scenarios/ascesa-aurion.json'
      )) as { default: Scenario };
      scenario = mod.default;
    } else {
      throw new ScenarioNotFoundError(id);
    }
  } catch (err) {
    if (err instanceof ScenarioNotFoundError) throw err;
    throw new ScenarioNotFoundError(
      `${id} (file missing or invalid: ${err instanceof Error ? err.message : String(err)})`,
    );
  }

  scenarioCache.set(id, scenario);
  return scenario;
}

/**
 * Best-effort loader for scenario-scoped messages (country names, capital
 * names, tech labels…). Returns an empty object when no message file exists
 * yet — the UI should fall back to raw keys in that case.
 */
export async function loadScenarioMessages(
  id: ScenarioId,
  locale: 'it' | 'en',
): Promise<Record<string, string>> {
  const cacheKey = `${id}::${locale}`;
  const cached = messagesCache.get(cacheKey);
  if (cached) return cached;

  let messages: Record<string, string> = {};
  try {
    if (id === 'ascesa-aurion' && locale === 'it') {
      const mod = (await import(
        '../content/scenarios/ascesa-aurion.it.json'
      )) as { default: Record<string, string> };
      messages = mod.default;
    } else if (id === 'ascesa-aurion' && locale === 'en') {
      const mod = (await import(
        '../content/scenarios/ascesa-aurion.en.json'
      )) as { default: Record<string, string> };
      messages = mod.default;
    }
  } catch {
    // No localised message file yet — return empty so callers can fall back.
    messages = {};
  }

  messagesCache.set(cacheKey, messages);
  return messages;
}

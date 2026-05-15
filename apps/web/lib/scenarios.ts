// Scenario loader. Phase 2 introduces a small in-source registry of scenarios
// so the new-game wizard can enumerate options (including those that are not
// yet shipped) without grepping the filesystem at runtime. The registry is the
// single source of truth: the wizard reads from `listScenarios()`, lazy
// imports happen only when the player commits to a scenario.

import type { Scenario } from '@aurion/engine';

/**
 * Closed enumeration of scenario ids that may appear in the registry. Adding
 * a new scenario means: (1) add the id here, (2) add an entry in
 * SCENARIO_REGISTRY, (3) wire its dynamic-import branch in `loadScenario`
 * and `loadScenarioMessages`.
 */
export type ScenarioId =
  | 'ascesa-aurion'
  | 'quick-start'
  | 'mondo-contemporaneo'
  | 'guerra-fredda';

/** Lifecycle status of a scenario. `available` shows up as a playable card,
 * `planned` shows greyed out with a "coming soon" badge. */
export type ScenarioStatus = 'available' | 'planned';

export type ScenarioMeta = {
  id: ScenarioId;
  /** i18n key for the scenario display name, resolved against the global UI bundle. */
  nameKey: string;
  /** i18n key for the scenario short description (one paragraph). */
  descriptionKey: string;
  status: ScenarioStatus;
  /** Stable sort order for the picker grid. Lower = earlier. */
  sortOrder: number;
};

/**
 * The registry. Phase 2 ships `ascesa-aurion` (existing) and `quick-start`
 * (scaffolded by a parallel agent — its file may or may not exist yet, the
 * loader handles both). Mondo Contemporaneo and Guerra Fredda are listed as
 * `planned` placeholders so they appear in the wizard with a "coming soon"
 * badge.
 */
export const SCENARIO_REGISTRY: Record<ScenarioId, ScenarioMeta> = {
  'ascesa-aurion': {
    id: 'ascesa-aurion',
    nameKey: 'scenario.ascesa-aurion.name',
    descriptionKey: 'scenario.ascesa-aurion.description',
    status: 'available',
    sortOrder: 10,
  },
  'quick-start': {
    id: 'quick-start',
    nameKey: 'scenario.quick-start.name',
    descriptionKey: 'scenario.quick-start.description',
    status: 'available',
    sortOrder: 0,
  },
  'mondo-contemporaneo': {
    id: 'mondo-contemporaneo',
    nameKey: 'scenario.mondo-contemporaneo.name',
    descriptionKey: 'scenario.mondo-contemporaneo.description',
    status: 'available',
    sortOrder: 20,
  },
  'guerra-fredda': {
    id: 'guerra-fredda',
    nameKey: 'scenario.guerra-fredda.name',
    descriptionKey: 'scenario.guerra-fredda.description',
    status: 'planned',
    sortOrder: 30,
  },
};

/** Stable list of scenario ids in registry order. Kept for back-compat with
 * code that previously imported `SCENARIO_IDS`. */
export const SCENARIO_IDS: readonly ScenarioId[] = (
  Object.values(SCENARIO_REGISTRY) as ScenarioMeta[]
)
  .slice()
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((m) => m.id);

/** All scenarios sorted by their `sortOrder`. */
export function listScenarios(): ScenarioMeta[] {
  return (Object.values(SCENARIO_REGISTRY) as ScenarioMeta[])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Convenience lookup: registry entry by id (or null when unknown). */
export function getScenarioMeta(id: string): ScenarioMeta | null {
  return (SCENARIO_REGISTRY as Record<string, ScenarioMeta>)[id] ?? null;
}

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
/** Tracks which scenario files are missing on disk so we can downgrade their
 * registry status to `planned` for the duration of the session. */
const missingScenarioFiles = new Set<ScenarioId>();

/**
 * Dynamically import a scenario JSON. Centralised here so the rest of the
 * app stays agnostic to where scenarios live on disk. We use dynamic import
 * with a literal string per branch so that the bundler can statically resolve
 * each one — but wrap in try/catch because some scenario files may not yet
 * exist (Phase 2 scaffolding).
 */
export async function loadScenario(id: ScenarioId): Promise<Scenario> {
  const cached = scenarioCache.get(id);
  if (cached) return cached;

  // Treat scenarios marked planned (or known to be missing) as unavailable.
  const meta = SCENARIO_REGISTRY[id];
  if (!meta) throw new ScenarioNotFoundError(id);
  if (meta.status === 'planned' || missingScenarioFiles.has(id)) {
    throw new ScenarioNotFoundError(id);
  }

  let scenario: Scenario;
  try {
    if (id === 'ascesa-aurion') {
      const mod = (await import(
        '../content/scenarios/ascesa-aurion.json'
      )) as { default: Scenario };
      scenario = mod.default;
    } else if (id === 'quick-start') {
      const mod = (await import(
        '../content/scenarios/quick-start.json'
      )) as { default: Scenario };
      scenario = mod.default;
    } else if (id === 'mondo-contemporaneo') {
      const mod = (await import(
        '../content/scenarios/mondo-contemporaneo.json'
      )) as { default: Scenario };
      scenario = mod.default;
    } else {
      throw new ScenarioNotFoundError(id);
    }
  } catch (err) {
    // Mark missing so subsequent calls (and `listScenarios`-aware UIs that
    // call `getEffectiveStatus`) can downgrade gracefully without retrying
    // every render.
    missingScenarioFiles.add(id);
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
    } else if (id === 'quick-start' && locale === 'it') {
      const mod = (await import(
        '../content/scenarios/quick-start.it.json'
      )) as { default: Record<string, string> };
      messages = mod.default;
    } else if (id === 'quick-start' && locale === 'en') {
      const mod = (await import(
        '../content/scenarios/quick-start.en.json'
      )) as { default: Record<string, string> };
      messages = mod.default;
    } else if (id === 'mondo-contemporaneo' && locale === 'it') {
      const mod = (await import(
        '../content/scenarios/mondo-contemporaneo.it.json'
      )) as { default: Record<string, string> };
      messages = mod.default;
    } else if (id === 'mondo-contemporaneo' && locale === 'en') {
      const mod = (await import(
        '../content/scenarios/mondo-contemporaneo.en.json'
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

/**
 * Best-effort runtime status: a scenario flagged `available` in the registry
 * but whose file failed to import (e.g. Quick Start during scaffolding) gets
 * downgraded to `planned` so the wizard renders it as "coming soon" instead
 * of erroring on click.
 */
export function getEffectiveStatus(id: ScenarioId): ScenarioStatus {
  const meta = SCENARIO_REGISTRY[id];
  if (!meta) return 'planned';
  if (missingScenarioFiles.has(id)) return 'planned';
  return meta.status;
}

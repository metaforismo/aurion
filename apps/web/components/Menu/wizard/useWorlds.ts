'use client';

import type { Scenario } from '@aurion/engine';
import { useEffect, useState } from 'react';

import { listScenarios, loadScenario, type ScenarioId } from '../../../lib/scenarios';

export type Worlds = Partial<Record<ScenarioId, Scenario>>;

/**
 * Loads every world up front so the wizard can show real numbers on each
 * card. A world that fails to load is reported in `failed` and stays
 * unselectable instead of breaking the flow.
 */
export function useWorlds(): { worlds: Worlds; failed: ReadonlySet<ScenarioId> } {
  const [worlds, setWorlds] = useState<Worlds>({});
  const [failed, setFailed] = useState<ReadonlySet<ScenarioId>>(new Set());

  useEffect(() => {
    let cancelled = false;
    for (const meta of listScenarios()) {
      loadScenario(meta.id)
        .then((scenario) => {
          if (!cancelled) setWorlds((prev) => ({ ...prev, [meta.id]: scenario }));
        })
        .catch(() => {
          if (!cancelled) setFailed((prev) => new Set(prev).add(meta.id));
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return { worlds, failed };
}

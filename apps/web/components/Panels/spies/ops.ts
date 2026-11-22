// Catalogue of covert operations: what each one needs, how long it runs and
// which technology opens it up. Odds are never restated here — they are read
// from the engine by staging the operation on a copy of the game.

import { applyAction } from '@aurion/engine';
import type {
  Country,
  EconomySectors,
  FactionId,
  IntelLevel,
  Scenario,
  SpyOperationType,
  SpyPayload,
  TechDefinition,
} from '@aurion/engine';

import type { World } from '../diplomacy/world';

export const SPY_TYPES: readonly SpyOperationType[] = [
  'steal_tech',
  'sabotage',
  'propaganda',
  'destabilize',
  'assassinate',
];

/** How long each kind of operation stays in the field, in weeks. */
export const DURATION_WEEKS: Record<SpyOperationType, number> = {
  steal_tech: 12,
  sabotage: 8,
  propaganda: 10,
  destabilize: 14,
  assassinate: 16,
};

export type SabotageTarget = keyof EconomySectors | 'military' | 'science';
export const SABOTAGE_TARGETS: readonly SabotageTarget[] = [
  'industry',
  'services',
  'tech',
  'agriculture',
  'military',
  'science',
];

export const FACTIONS: readonly FactionId[] = ['army', 'business', 'religious', 'populist', 'reformist'];

export const ROLES = ['head_of_state', 'defence_minister', 'intelligence_chief'] as const;
export type Role = (typeof ROLES)[number];

export const INTEL_LEVELS: readonly IntelLevel[] = ['none', 'rumors', 'partial', 'full'];

/** Points of success gained (and of exposure shed) at each intel level. */
export const INTEL_EDGE: Record<IntelLevel, number> = { none: 0, rumors: 5, partial: 15, full: 25 };

/** Technologies of the scenario that open up a kind of operation. */
export function unlockingTechs(scenario: Scenario | null, type: SpyOperationType): TechDefinition[] {
  return (scenario?.techTree ?? []).filter((tech) =>
    tech.effects.some((e) => e.type === 'unlockSpyType' && e.spyType === type),
  );
}

/**
 * An operation is open when the scenario ties no technology to it, or when
 * the player has completed one that does.
 */
export function isUnlocked(scenario: Scenario | null, player: Country, type: SpyOperationType): boolean {
  const techs = unlockingTechs(scenario, type);
  return techs.length === 0 || techs.some((tech) => player.science.completedTechs.includes(tech.id));
}

/**
 * Success and exposure odds exactly as the engine would stamp them on the
 * operation. Staged with one agent on hand so the odds stay readable even
 * when the roster is empty.
 */
export function oddsFor(
  w: World,
  target: Country,
  type: SpyOperationType,
): { success: number; detection: number } {
  const staffed: Country = {
    ...w.player,
    intelligence: { ...w.player.intelligence, spyCount: Math.max(1, w.player.intelligence.spyCount) },
  };
  const staged = applyAction(
    { ...w.state, countries: { ...w.state.countries, [staffed.id]: staffed } },
    {
      type: 'deploySpy',
      op: {
        type,
        ownerCountryId: staffed.id,
        targetCountryId: target.id,
        payload: { kind: 'destabilize' },
        durationTicks: DURATION_WEEKS[type],
        successProbability: 0,
        detectionRisk: 0,
      },
    },
    staffed.id,
  );
  const op = staged.state.spyOperations[staged.state.spyOperations.length - 1];
  return { success: op?.successProbability ?? 0, detection: op?.detectionRisk ?? 0 };
}

/** Technologies the target has and the player lacks. */
export function stealable(w: World, target: Country): string[] {
  const mine = new Set(w.player.science.completedTechs);
  return target.science.completedTechs.filter((id) => !mine.has(id));
}

export type Draft = {
  type: SpyOperationType;
  techId: string | null;
  sector: SabotageTarget;
  faction: FactionId | 'any';
  role: Role;
};

export function payloadOf(draft: Draft): SpyPayload | null {
  switch (draft.type) {
    case 'steal_tech':
      return draft.techId ? { kind: 'steal_tech', techId: draft.techId } : null;
    case 'sabotage':
      return { kind: 'sabotage', targetSector: draft.sector };
    case 'propaganda':
      return { kind: 'propaganda', targetFaction: draft.faction === 'any' ? null : draft.faction };
    case 'destabilize':
      return { kind: 'destabilize' };
    case 'assassinate':
      return { kind: 'assassinate', targetRoleKey: `role.${draft.role}` };
  }
}

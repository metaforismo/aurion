// Research maths for the panel: the state of every technology, the shape of
// the tree, what to research next and how long it will take.

import {
  COSMOS_PROJECTS,
  type CosmosProjectId,
  type TechBranch,
  type TechDefinition,
  type TechEffect,
  type TechId,
} from '@aurion/engine';

export const BRANCHES: readonly TechBranch[] = ['civil', 'military', 'intelligence', 'space'];

export type TechStatus = 'done' | 'researching' | 'available' | 'locked';

export type TechNode = {
  tech: TechDefinition;
  status: TechStatus;
  /** Prerequisites not yet researched. */
  missing: TechId[];
  /** Technologies that list this one as a prerequisite. */
  unlocks: TechId[];
  /** 1 for technologies with no prerequisite, then one more per step. */
  tier: number;
};

export function buildTree(
  techTree: readonly TechDefinition[],
  completed: readonly TechId[],
  active: TechId | null,
): Map<TechId, TechNode> {
  const byId = new Map(techTree.map((tech) => [tech.id, tech]));
  const done = new Set(completed);
  const tiers = new Map<TechId, number>();
  const tierOf = (id: TechId, seen: ReadonlySet<TechId>): number => {
    const known = tiers.get(id);
    if (known !== undefined) return known;
    const tech = byId.get(id);
    // Unknown ids and cycles in scenario data count as roots instead of looping.
    if (!tech || seen.has(id)) return 1;
    const next = new Set(seen).add(id);
    const tier = 1 + Math.max(0, ...tech.prereqs.map((p) => tierOf(p, next)));
    tiers.set(id, tier);
    return tier;
  };

  const nodes = new Map<TechId, TechNode>();
  for (const tech of techTree) {
    const missing = tech.prereqs.filter((p) => !done.has(p));
    const status: TechStatus = done.has(tech.id)
      ? 'done'
      : active === tech.id
        ? 'researching'
        : missing.length > 0
          ? 'locked'
          : 'available';
    nodes.set(tech.id, {
      tech,
      status,
      missing,
      unlocks: techTree.filter((other) => other.prereqs.includes(tech.id)).map((other) => other.id),
      tier: tierOf(tech.id, new Set()),
    });
  }
  return nodes;
}

/**
 * The suggestion shown as "recommended next": among what can be started
 * now, the technology that opens the most new ones per research point, so
 * the tree keeps widening. Ties go to the cheaper one.
 */
export function recommendNext(nodes: ReadonlyMap<TechId, TechNode>): TechNode | null {
  let best: TechNode | null = null;
  let bestScore = -1;
  for (const node of nodes.values()) {
    if (node.status !== 'available') continue;
    const pending = node.unlocks.filter((id) => nodes.get(id)?.status !== 'done').length;
    const score = (pending + 1) / Math.max(1, node.tech.cost);
    if (score > bestScore || (score === bestScore && best && node.tech.cost < best.tech.cost)) {
      best = node;
      bestScore = score;
    }
  }
  return best;
}

/** Whole weeks to gather `points` at `output` per week; null when output is zero. */
export function weeksFor(points: number, output: number): number | null {
  if (points <= 0) return 0;
  if (output <= 0) return null;
  return Math.ceil(points / output);
}

// ---------------------------------------------------------------------------
// Effects in plain words
// ---------------------------------------------------------------------------

export type EffectLine =
  /** `value` is a share: 0.08 → "+8%". */
  | { kind: 'percent'; stat: StatId; value: number }
  /** `value` is a plain amount: +3 popularity, +2 spies. */
  | { kind: 'points'; stat: StatId; value: number }
  | { kind: 'spy'; spyType: string }
  | { kind: 'action'; action: string }
  | { kind: 'other' };

const STATS = [
  'researchOutput',
  'weeklyIncome',
  'gdp',
  'agriculture',
  'industry',
  'services',
  'tech',
  'popularity',
  'army',
  'business',
  'religious',
  'populist',
  'reformist',
  'doctrineLevel',
  'counterIntelLevel',
  'spyCount',
  'armySize',
  'navy',
  'airforce',
  'population',
] as const;
export type StatId = (typeof STATS)[number];

/** Stats stored as a 0..1 level, shown as percentage points. */
const LEVEL_STATS: ReadonlySet<StatId> = new Set<StatId>(['doctrineLevel', 'counterIntelLevel']);

function statId(path: string): StatId | null {
  // Scenario data writes paths such as "politics.factions.reformist.satisfaction".
  const parts = path.split('.').filter((part) => part !== 'satisfaction');
  const last = parts[parts.length - 1];
  return (STATS as readonly string[]).includes(last ?? '') ? (last as StatId) : null;
}

export function describeEffects(effects: readonly TechEffect[]): EffectLine[] {
  const lines: EffectLine[] = [];
  for (const effect of effects) {
    if (effect.type === 'unlockSpyType') {
      lines.push({ kind: 'spy', spyType: effect.spyType });
    } else if (effect.type === 'unlockAction') {
      lines.push({ kind: 'action', action: effect.action });
    } else {
      const stat = statId(effect.stat);
      if (!stat) {
        lines.push({ kind: 'other' });
        continue;
      }
      if (effect.multiplier !== undefined && effect.multiplier !== 1) {
        lines.push({ kind: 'percent', stat, value: effect.multiplier - 1 });
      }
      if (effect.delta !== 0) {
        lines.push(
          LEVEL_STATS.has(stat)
            ? { kind: 'percent', stat, value: effect.delta }
            : { kind: 'points', stat, value: effect.delta },
        );
      }
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Space technology and megaprojects
// ---------------------------------------------------------------------------

export type SpaceGate = {
  projectId: CosmosProjectId;
  /** Space technologies needed, out of `total`. */
  needed: number;
  reached: boolean;
};

/** The megaprojects that require a share of the space branch, easiest first. */
export function spaceGates(spaceTotal: number, spaceDone: number): SpaceGate[] {
  if (spaceTotal === 0) return [];
  return COSMOS_PROJECTS.filter((def) => (def.minSpaceTechShare ?? 0) > 0)
    .map((def) => {
      const needed = Math.max(1, Math.ceil((def.minSpaceTechShare ?? 0) * spaceTotal - 1e-9));
      return { projectId: def.id, needed, reached: spaceDone >= needed };
    })
    .sort((a, b) => a.needed - b.needed);
}

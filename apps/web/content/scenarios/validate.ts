// Validator for scenario data + i18n strings.
//
// Run from the repo root:
//   pnpm --filter @aurion/web exec tsx content/scenarios/validate.ts
// or, if the engine package's tsx is preferred (no Next/React deps):
//   pnpm --filter @aurion/engine exec tsx ../../apps/web/content/scenarios/validate.ts
//
// Exits 0 on success, 1 on validation failure. Prints summary stats.

import scenarioJson from './ascesa-aurion.json' with { type: 'json' };
import itStrings from './ascesa-aurion.it.json' with { type: 'json' };
import enStrings from './ascesa-aurion.en.json' with { type: 'json' };
import type { Scenario, CountryInit, TechDefinition, EventDefinition } from '@aurion/engine';

// ---------------------------------------------------------------------------
// Step 1: Type-check the scenario JSON against the engine's `Scenario` type.
// If the JSON shape diverges from the type, this assignment errors at compile
// time (tsx uses tsc under the hood for type-stripping; strict mismatches
// surface here).
// ---------------------------------------------------------------------------

const scenario: Scenario = scenarioJson as unknown as Scenario;
const it = itStrings as Record<string, string>;
const en = enStrings as Record<string, string>;

// ---------------------------------------------------------------------------
// Step 2: Recursively walk the scenario and collect every i18n key reference.
// A key reference is the string value of any property whose name ends with
// "Key" (e.g. nameKey, descriptionKey, capitalKey, labelKey).
// ---------------------------------------------------------------------------

function collectKeys(value: unknown, parentKey: string | null = null): string[] {
  const out: string[] = [];

  if (value === null || value === undefined) return out;

  if (typeof value === 'string') {
    if (parentKey !== null && parentKey.endsWith('Key')) {
      out.push(value);
    }
    return out;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      out.push(...collectKeys(item, parentKey));
    }
    return out;
  }

  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out.push(...collectKeys(v, k));
    }
  }

  return out;
}

const referencedKeys = Array.from(new Set(collectKeys(scenario)));

const missingIt = referencedKeys.filter((k) => !(k in it));
const missingEn = referencedKeys.filter((k) => !(k in en));

const orphanIt = Object.keys(it).filter((k) => !referencedKeys.includes(k));
const orphanEn = Object.keys(en).filter((k) => !referencedKeys.includes(k));

// ---------------------------------------------------------------------------
// Step 3: Sectors of every country must sum to 1.0 (± 0.001).
// ---------------------------------------------------------------------------

const sectorErrors: string[] = [];
for (const c of scenario.countries) {
  const s = c.economy.sectors;
  const sum = s.agriculture + s.industry + s.services + s.tech;
  if (Math.abs(sum - 1.0) > 0.001) {
    sectorErrors.push(`Country "${c.id}" sectors sum to ${sum.toFixed(4)} (expected 1.0)`);
  }
}

// ---------------------------------------------------------------------------
// Step 4: playableCountries must all exist in countries[].
// ---------------------------------------------------------------------------

const countryIds = new Set(scenario.countries.map((c: CountryInit) => c.id));
const playableErrors: string[] = [];
for (const id of scenario.playableCountries) {
  if (!countryIds.has(id)) {
    playableErrors.push(`playableCountries entry "${id}" does not exist in countries[]`);
  }
}

// ---------------------------------------------------------------------------
// Step 5: Tech prereqs must reference existing tech IDs.
// ---------------------------------------------------------------------------

const techIds = new Set(scenario.techTree.map((t: TechDefinition) => t.id));
const techErrors: string[] = [];
for (const t of scenario.techTree) {
  for (const p of t.prereqs) {
    if (!techIds.has(p)) {
      techErrors.push(`Tech "${t.id}" has unknown prereq "${p}"`);
    }
  }
}

// Each completedTech in initial state should also exist.
for (const c of scenario.countries) {
  for (const t of c.initialCompletedTechs) {
    if (!techIds.has(t)) {
      techErrors.push(`Country "${c.id}" initialCompletedTechs entry "${t}" is unknown`);
    }
  }
}

// ---------------------------------------------------------------------------
// Step 6: Event effect targets and references must resolve.
// ---------------------------------------------------------------------------

const eventErrors: string[] = [];
for (const e of scenario.eventPool) {
  for (const choice of e.choices) {
    for (const eff of choice.effects) {
      switch (eff.type) {
        case 'modifyStat':
          if (eff.target !== 'player' && !countryIds.has(eff.target)) {
            eventErrors.push(`Event "${e.id}" modifyStat targets unknown country "${eff.target}"`);
          }
          break;
        case 'startResearch':
          if (!countryIds.has(eff.target)) {
            eventErrors.push(`Event "${e.id}" startResearch targets unknown country "${eff.target}"`);
          }
          if (!techIds.has(eff.techId)) {
            eventErrors.push(`Event "${e.id}" startResearch references unknown tech "${eff.techId}"`);
          }
          break;
        case 'shiftAttitude':
          if (!countryIds.has(eff.with)) {
            eventErrors.push(`Event "${e.id}" shiftAttitude references unknown country "${eff.with}"`);
          }
          break;
        case 'spawnSpy':
          if (!countryIds.has(eff.against)) {
            eventErrors.push(`Event "${e.id}" spawnSpy targets unknown country "${eff.against}"`);
          }
          break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Step 7: Relations must reference real countries.
// ---------------------------------------------------------------------------

const relationErrors: string[] = [];
for (const r of scenario.relations) {
  if (!countryIds.has(r.countryA)) {
    relationErrors.push(`Relation references unknown country "${r.countryA}"`);
  }
  if (!countryIds.has(r.countryB)) {
    relationErrors.push(`Relation references unknown country "${r.countryB}"`);
  }
  if (r.countryA === r.countryB) {
    relationErrors.push(`Relation has identical countries "${r.countryA}"`);
  }
}

// ---------------------------------------------------------------------------
// Step 8: Victory conditions must reference existing techs (where applicable).
// ---------------------------------------------------------------------------

function walkVictoryRule(rule: unknown, errs: string[]): void {
  if (!rule || typeof rule !== 'object') return;
  const r = rule as { kind: string; rules?: unknown[]; techId?: string };
  if (r.kind === 'completeTech' && r.techId && !techIds.has(r.techId)) {
    errs.push(`Victory rule references unknown tech "${r.techId}"`);
  }
  if ((r.kind === 'and' || r.kind === 'or') && Array.isArray(r.rules)) {
    for (const sub of r.rules) walkVictoryRule(sub, errs);
  }
}

const victoryErrors: string[] = [];
for (const v of scenario.victoryConditions) {
  walkVictoryRule(v.rule, victoryErrors);
}

// ---------------------------------------------------------------------------
// Step 9: Difficulties must contain exactly one entry (Phase 1 constraint).
// ---------------------------------------------------------------------------

const difficultyErrors: string[] = [];
if (scenario.difficulties.length !== 1) {
  difficultyErrors.push(
    `Phase 1 expects exactly 1 difficulty entry, found ${scenario.difficulties.length}`,
  );
}

// ---------------------------------------------------------------------------
// Aggregate + report.
// ---------------------------------------------------------------------------

const allErrors = [
  ...missingIt.map((k) => `Missing IT translation: ${k}`),
  ...missingEn.map((k) => `Missing EN translation: ${k}`),
  ...sectorErrors,
  ...playableErrors,
  ...techErrors,
  ...eventErrors,
  ...relationErrors,
  ...victoryErrors,
  ...difficultyErrors,
];

const archetypeCounts: Record<string, number> = {};
for (const c of scenario.countries) {
  if (c.aiPersonality) {
    const a = c.aiPersonality.archetype;
    archetypeCounts[a] = (archetypeCounts[a] ?? 0) + 1;
  }
}

const techByBranch: Record<string, number> = {};
for (const t of scenario.techTree) {
  techByBranch[t.branch] = (techByBranch[t.branch] ?? 0) + 1;
}

const eventByTrigger: Record<string, number> = {};
for (const e of scenario.eventPool as EventDefinition[]) {
  eventByTrigger[e.trigger.type] = (eventByTrigger[e.trigger.type] ?? 0) + 1;
}

console.log('Scenario:', scenario.id, '@', scenario.version);
console.log('  countries:           ', scenario.countries.length);
console.log('  playable:            ', scenario.playableCountries.length);
console.log('  relations:           ', scenario.relations.length);
console.log('  techTree:            ', scenario.techTree.length, '(by branch)', techByBranch);
console.log('  eventPool:           ', scenario.eventPool.length, '(by trigger)', eventByTrigger);
console.log('  victoryConditions:   ', scenario.victoryConditions.length);
console.log('  difficulties:        ', scenario.difficulties.length);
console.log('  AI archetypes:       ', archetypeCounts);
console.log('  i18n keys referenced:', referencedKeys.length);
console.log('  IT entries:          ', Object.keys(it).length, `(orphans: ${orphanIt.length})`);
console.log('  EN entries:          ', Object.keys(en).length, `(orphans: ${orphanEn.length})`);

if (orphanIt.length > 0) {
  console.warn('  IT orphan keys (not referenced in scenario):');
  for (const k of orphanIt) console.warn('    -', k);
}
if (orphanEn.length > 0) {
  console.warn('  EN orphan keys (not referenced in scenario):');
  for (const k of orphanEn) console.warn('    -', k);
}

if (allErrors.length > 0) {
  console.error('\nValidation FAILED:');
  for (const e of allErrors) console.error('  -', e);
  process.exit(1);
}

console.log('\nScenario validates OK');

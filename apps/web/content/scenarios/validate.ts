// Validator for scenario data + i18n strings.
//
// Run from the repo root:
//   pnpm --filter @aurion/web exec tsx content/scenarios/validate.ts
// or, if the engine package's tsx is preferred (no Next/React deps):
//   pnpm --filter @aurion/engine exec tsx ../../apps/web/content/scenarios/validate.ts
//
// Validates every scenario listed in `SCENARIO_FILES` below. Add new scenarios
// to that registry as they come online; entries marked with `planned: true` are
// skipped (with an info line) so a registry can list upcoming scenarios without
// failing CI before their JSON files exist.
//
// Exits 0 on success, 1 on any validation failure across the suite.

import ascesaJson from './ascesa-aurion.json' with { type: 'json' };
import ascesaIt from './ascesa-aurion.it.json' with { type: 'json' };
import ascesaEn from './ascesa-aurion.en.json' with { type: 'json' };
import quickStartJson from './quick-start.json' with { type: 'json' };
import quickStartIt from './quick-start.it.json' with { type: 'json' };
import quickStartEn from './quick-start.en.json' with { type: 'json' };
import mondoJson from './mondo-contemporaneo.json' with { type: 'json' };
import mondoIt from './mondo-contemporaneo.it.json' with { type: 'json' };
import mondoEn from './mondo-contemporaneo.en.json' with { type: 'json' };
import guerraFreddaJson from './guerra-fredda.json' with { type: 'json' };
import guerraFreddaIt from './guerra-fredda.it.json' with { type: 'json' };
import guerraFreddaEn from './guerra-fredda.en.json' with { type: 'json' };
import type {
  Scenario,
  CountryInit,
  TechDefinition,
  EventDefinition,
  EventTag,
  ActionTriggerKey,
  UNResolutionKind,
  ScenarioBlocInit,
  UNResolutionTemplate,
  ActiveBlocId,
} from '@aurion/engine';

// Mirror the EventTag union as a runtime allow-list so the validator can warn
// on tags outside the closed taxonomy. Keep this in sync with `EventTag` in
// packages/engine/src/types.ts.
const KNOWN_EVENT_TAGS: ReadonlySet<EventTag> = new Set<EventTag>([
  'politics',
  'faction',
  'economy',
  'military',
  'diplomacy',
  'intelligence',
  'space',
  'social',
  'crisis',
  'opportunity',
  'narrative',
]);

// Phase 3 — closed enumerations mirrored as runtime allow-lists. Keep in sync
// with `ActionTriggerKey`, `UNResolutionKind` and `ActiveBlocId` in
// packages/engine/src/types.ts.
const KNOWN_ACTION_TRIGGER_KEYS: ReadonlySet<ActionTriggerKey> = new Set<ActionTriggerKey>([
  'declareWar',
  'launchTactical',
  'launchStrategic',
  'tradeDealLowGdp',
  'sanctionsImposed',
  'highWorldTension',
  'climatePeriodic',
]);

const KNOWN_UN_RESOLUTION_KINDS: ReadonlySet<UNResolutionKind> = new Set<UNResolutionKind>([
  'sanctions',
  'peacekeeping',
  'recognition',
  'humanitarian',
  'climate',
  'nonProliferation',
  'condemnation',
]);

const KNOWN_ACTIVE_BLOC_IDS: ReadonlySet<ActiveBlocId> = new Set<ActiveBlocId>([
  'western',
  'eastern',
  'non-aligned',
]);

// ---------------------------------------------------------------------------
// Scenario registry. Mirror this list with `apps/web/lib/scenarios.ts`.
// Entries flagged `planned: true` are skipped with an info line so CI does not
// fail before their JSON / i18n files exist.
// ---------------------------------------------------------------------------

type ScenarioBundle = {
  id: string;
  scenarioJson: unknown;
  it: unknown;
  en: unknown;
};

type RegistryEntry =
  | (ScenarioBundle & { planned?: false })
  | { id: string; planned: true; reason?: string };

const SCENARIO_FILES: readonly RegistryEntry[] = [
  {
    id: 'ascesa-aurion',
    scenarioJson: ascesaJson,
    it: ascesaIt,
    en: ascesaEn,
  },
  {
    id: 'quick-start',
    scenarioJson: quickStartJson,
    it: quickStartIt,
    en: quickStartEn,
  },
  {
    id: 'mondo-contemporaneo',
    scenarioJson: mondoJson,
    it: mondoIt,
    en: mondoEn,
  },
  {
    id: 'guerra-fredda',
    scenarioJson: guerraFreddaJson,
    it: guerraFreddaIt,
    en: guerraFreddaEn,
  },
];

// ---------------------------------------------------------------------------
// Per-scenario validation. Returns a tuple of [errorCount, warningCount].
// ---------------------------------------------------------------------------

function validateScenario(bundle: ScenarioBundle): { errors: number; warnings: number } {
  const scenario: Scenario = bundle.scenarioJson as unknown as Scenario;
  const it = bundle.it as Record<string, string>;
  const en = bundle.en as Record<string, string>;

  // -------------------------------------------------------------------------
  // Step 1: Recursively walk the scenario and collect every i18n key
  // reference. A key reference is the string value of any property whose
  // name ends with "Key" (e.g. nameKey, descriptionKey, capitalKey, labelKey).
  // -------------------------------------------------------------------------

  const collectKeys = (value: unknown, parentKey: string | null = null): string[] => {
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
  };

  const referencedKeys = Array.from(new Set(collectKeys(scenario)));

  const missingIt = referencedKeys.filter((k) => !(k in it));
  const missingEn = referencedKeys.filter((k) => !(k in en));

  const orphanIt = Object.keys(it).filter((k) => !referencedKeys.includes(k));
  const orphanEn = Object.keys(en).filter((k) => !referencedKeys.includes(k));

  // -------------------------------------------------------------------------
  // Step 2: Sectors of every country must sum to 1.0 (± 0.001).
  // -------------------------------------------------------------------------

  const sectorErrors: string[] = [];
  for (const c of scenario.countries) {
    const s = c.economy.sectors;
    const sum = s.agriculture + s.industry + s.services + s.tech;
    if (Math.abs(sum - 1.0) > 0.001) {
      sectorErrors.push(`Country "${c.id}" sectors sum to ${sum.toFixed(4)} (expected 1.0)`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: playableCountries must all exist in countries[].
  // -------------------------------------------------------------------------

  const countryIds = new Set(scenario.countries.map((c: CountryInit) => c.id));
  const playableErrors: string[] = [];
  for (const id of scenario.playableCountries) {
    if (!countryIds.has(id)) {
      playableErrors.push(`playableCountries entry "${id}" does not exist in countries[]`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Tech prereqs must reference existing tech IDs.
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Step 5: Event effect targets and references must resolve.
  // -------------------------------------------------------------------------

  const eventErrors: string[] = [];
  const eventTagWarnings: string[] = [];
  const tagCounts: Record<string, number> = {};

  for (const e of scenario.eventPool) {
    // ---- 5a: tags taxonomy ------------------------------------------------
    const tags = e.tags;
    if (!tags || tags.length === 0) {
      eventErrors.push(`Event "${e.id}" has no tags (every event must have at least one)`);
    } else {
      for (const tag of tags) {
        if (typeof tag !== 'string' || tag !== tag.toLowerCase() || /\s/.test(tag)) {
          eventErrors.push(
            `Event "${e.id}" has invalid tag "${String(tag)}" (must be lowercase, no whitespace)`,
          );
          continue;
        }
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
        if (!KNOWN_EVENT_TAGS.has(tag as EventTag)) {
          eventTagWarnings.push(`Event "${e.id}" uses unknown tag "${tag}"`);
        }
      }
    }

    // ---- 5b: choice effect references ------------------------------------
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

  // -------------------------------------------------------------------------
  // Step 6: Relations must reference real countries.
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Step 7: Victory conditions must reference existing techs (where applicable).
  // -------------------------------------------------------------------------

  const walkVictoryRule = (rule: unknown, errs: string[]): void => {
    if (!rule || typeof rule !== 'object') return;
    const r = rule as { kind: string; rules?: unknown[]; techId?: string };
    if (r.kind === 'completeTech' && r.techId && !techIds.has(r.techId)) {
      errs.push(`Victory rule references unknown tech "${r.techId}"`);
    }
    if ((r.kind === 'and' || r.kind === 'or') && Array.isArray(r.rules)) {
      for (const sub of r.rules) walkVictoryRule(sub, errs);
    }
  };

  const victoryErrors: string[] = [];
  for (const v of scenario.victoryConditions) {
    walkVictoryRule(v.rule, victoryErrors);
  }

  // -------------------------------------------------------------------------
  // Step 8: Difficulties must contain at least one entry. Phase 1 ships
  // exactly one ("normal"); Phase 2 ships three (easy/normal/hard). We accept
  // any positive count >= 1, so the validator stays useful as scenarios
  // migrate between phases.
  // -------------------------------------------------------------------------

  const difficultyErrors: string[] = [];
  if (scenario.difficulties.length < 1) {
    difficultyErrors.push(
      `Scenario must declare at least 1 difficulty entry, found ${scenario.difficulties.length}`,
    );
  }

  // -------------------------------------------------------------------------
  // Step 9 (Phase 3 — optional fields). When `blocs`, `unCouncilMembers`,
  // `unTriggerMap` or `dethroneIsolationOnByDefault` are present we cross-
  // check them against `countries[]`, the engine's closed enumerations, and
  // the i18n bundles. Scenarios that do not opt into Phase 3 (e.g. quick-
  // start) skip every check below.
  // -------------------------------------------------------------------------

  const phase3Errors: string[] = [];
  const phase3Stats: {
    blocs: number;
    blocMembersTotal: number;
    councilMembers: number;
    triggers: number;
    dethroneIsolation: boolean | null;
    eras: number;
    spaceMilestones: number;
  } = {
    blocs: 0,
    blocMembersTotal: 0,
    councilMembers: 0,
    triggers: 0,
    dethroneIsolation: null,
    eras: 0,
    spaceMilestones: 0,
  };

  // 9a — blocs
  if (scenario.blocs !== undefined) {
    if (!Array.isArray(scenario.blocs)) {
      phase3Errors.push('Phase 3: blocs must be an array');
    } else {
      phase3Stats.blocs = scenario.blocs.length;
      const seenBlocIds = new Set<string>();
      for (const bloc of scenario.blocs as ScenarioBlocInit[]) {
        if (!KNOWN_ACTIVE_BLOC_IDS.has(bloc.id)) {
          phase3Errors.push(`Phase 3: bloc has unknown id "${String(bloc.id)}"`);
        }
        if (seenBlocIds.has(bloc.id)) {
          phase3Errors.push(`Phase 3: duplicate bloc id "${bloc.id}"`);
        }
        seenBlocIds.add(bloc.id);
        if (!Array.isArray(bloc.foundingMembers) || bloc.foundingMembers.length === 0) {
          phase3Errors.push(`Phase 3: bloc "${bloc.id}" has empty foundingMembers`);
        } else {
          for (const member of bloc.foundingMembers) {
            if (!countryIds.has(member)) {
              phase3Errors.push(
                `Phase 3: bloc "${bloc.id}" foundingMember "${member}" does not exist in countries[]`,
              );
            }
          }
          phase3Stats.blocMembersTotal += bloc.foundingMembers.length;
        }
        if (bloc.leaderCountryId !== undefined) {
          if (!countryIds.has(bloc.leaderCountryId)) {
            phase3Errors.push(
              `Phase 3: bloc "${bloc.id}" leaderCountryId "${bloc.leaderCountryId}" does not exist in countries[]`,
            );
          } else if (!bloc.foundingMembers.includes(bloc.leaderCountryId)) {
            phase3Errors.push(
              `Phase 3: bloc "${bloc.id}" leaderCountryId "${bloc.leaderCountryId}" is not in foundingMembers`,
            );
          }
        }
      }
      // A country may belong to at most one bloc at start.
      const memberToBloc = new Map<string, string>();
      for (const bloc of scenario.blocs as ScenarioBlocInit[]) {
        for (const member of bloc.foundingMembers) {
          const existing = memberToBloc.get(member);
          if (existing !== undefined && existing !== bloc.id) {
            phase3Errors.push(
              `Phase 3: country "${member}" is a foundingMember of both "${existing}" and "${bloc.id}"`,
            );
          }
          memberToBloc.set(member, bloc.id);
        }
      }
    }
  }

  // 9b — unCouncilMembers
  if (scenario.unCouncilMembers !== undefined) {
    if (!Array.isArray(scenario.unCouncilMembers)) {
      phase3Errors.push('Phase 3: unCouncilMembers must be an array');
    } else {
      phase3Stats.councilMembers = scenario.unCouncilMembers.length;
      const seenCouncil = new Set<string>();
      for (const id of scenario.unCouncilMembers) {
        if (!countryIds.has(id)) {
          phase3Errors.push(
            `Phase 3: unCouncilMembers entry "${id}" does not exist in countries[]`,
          );
        }
        if (seenCouncil.has(id)) {
          phase3Errors.push(`Phase 3: duplicate unCouncilMembers entry "${id}"`);
        }
        seenCouncil.add(id);
      }
    }
  }

  // 9c — unTriggerMap
  if (scenario.unTriggerMap !== undefined) {
    if (typeof scenario.unTriggerMap !== 'object' || scenario.unTriggerMap === null) {
      phase3Errors.push('Phase 3: unTriggerMap must be an object');
    } else {
      const entries = Object.entries(scenario.unTriggerMap) as Array<
        [string, UNResolutionTemplate | undefined]
      >;
      phase3Stats.triggers = entries.length;
      for (const [key, template] of entries) {
        if (!KNOWN_ACTION_TRIGGER_KEYS.has(key as ActionTriggerKey)) {
          phase3Errors.push(`Phase 3: unTriggerMap key "${key}" is not a valid ActionTriggerKey`);
        }
        if (!template || typeof template !== 'object') {
          phase3Errors.push(`Phase 3: unTriggerMap entry "${key}" must be a UNResolutionTemplate`);
          continue;
        }
        if (!KNOWN_UN_RESOLUTION_KINDS.has(template.kind)) {
          phase3Errors.push(
            `Phase 3: unTriggerMap entry "${key}" has unknown kind "${String(template.kind)}"`,
          );
        }
        if (typeof template.titleKey !== 'string' || template.titleKey.length === 0) {
          phase3Errors.push(`Phase 3: unTriggerMap entry "${key}" missing titleKey`);
        }
        if (typeof template.descriptionKey !== 'string' || template.descriptionKey.length === 0) {
          phase3Errors.push(`Phase 3: unTriggerMap entry "${key}" missing descriptionKey`);
        }
        if (
          typeof template.votingDurationTicks !== 'number' ||
          template.votingDurationTicks <= 0
        ) {
          phase3Errors.push(
            `Phase 3: unTriggerMap entry "${key}" votingDurationTicks must be > 0`,
          );
        }
        if (
          !template.effects ||
          typeof template.effects !== 'object' ||
          !Array.isArray(template.effects.onPass) ||
          !Array.isArray(template.effects.onFail)
        ) {
          phase3Errors.push(
            `Phase 3: unTriggerMap entry "${key}" must declare effects.onPass and effects.onFail arrays`,
          );
        }
      }
    }
  }

  // 9d — dethroneIsolationOnByDefault
  if (scenario.dethroneIsolationOnByDefault !== undefined) {
    if (typeof scenario.dethroneIsolationOnByDefault !== 'boolean') {
      phase3Errors.push('Phase 3: dethroneIsolationOnByDefault must be a boolean');
    } else {
      phase3Stats.dethroneIsolation = scenario.dethroneIsolationOnByDefault;
    }
  }

  // 9e — eras (Wave 10 era-paced mode)
  if (scenario.eras !== undefined) {
    if (!Array.isArray(scenario.eras)) {
      phase3Errors.push('Phase 3: eras must be an array');
    } else {
      phase3Stats.eras = scenario.eras.length;
      const seenEraIds = new Set<string>();
      let prevEnd: number | null = null;
      for (let i = 0; i < scenario.eras.length; i++) {
        const era = scenario.eras[i] as {
          id: unknown;
          nameKey: unknown;
          startTick: unknown;
          endTick: unknown;
        };
        if (typeof era.id !== 'string' || era.id.length === 0) {
          phase3Errors.push(`Phase 3: era[${i}] missing id`);
          continue;
        }
        if (seenEraIds.has(era.id)) {
          phase3Errors.push(`Phase 3: duplicate era id "${era.id}"`);
        }
        seenEraIds.add(era.id);
        if (typeof era.nameKey !== 'string' || era.nameKey.length === 0) {
          phase3Errors.push(`Phase 3: era "${era.id}" missing nameKey`);
        }
        if (typeof era.startTick !== 'number' || era.startTick < 0) {
          phase3Errors.push(`Phase 3: era "${era.id}" startTick must be a number ≥ 0`);
          continue;
        }
        if (
          typeof era.endTick !== 'number' ||
          era.endTick <= era.startTick
        ) {
          phase3Errors.push(`Phase 3: era "${era.id}" endTick must be > startTick`);
          continue;
        }
        if (prevEnd !== null && era.startTick !== prevEnd) {
          phase3Errors.push(
            `Phase 3: era "${era.id}" startTick (${era.startTick}) must equal previous era endTick (${prevEnd})`,
          );
        }
        prevEnd = era.endTick;
      }
    }
  }

  // 9f — space milestones (techs that declare prestigeFirst / prestigeFollow)
  for (const tech of scenario.techTree) {
    const hasFirst = typeof tech.prestigeFirst === 'number';
    const hasFollow = typeof tech.prestigeFollow === 'number';
    if (hasFirst || hasFollow) {
      phase3Stats.spaceMilestones += 1;
      if (hasFirst && (tech.prestigeFirst! < 0 || !Number.isFinite(tech.prestigeFirst!))) {
        phase3Errors.push(
          `Phase 3: tech "${tech.id}" prestigeFirst must be a finite non-negative number`,
        );
      }
      if (
        hasFollow &&
        (tech.prestigeFollow! < 0 || !Number.isFinite(tech.prestigeFollow!))
      ) {
        phase3Errors.push(
          `Phase 3: tech "${tech.id}" prestigeFollow must be a finite non-negative number`,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Aggregate + per-scenario report.
  // -------------------------------------------------------------------------

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
    ...phase3Errors,
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

  console.log('');
  console.log('Scenario:', scenario.id, '@', scenario.version);
  console.log('  countries:           ', scenario.countries.length);
  console.log('  playable:            ', scenario.playableCountries.length);
  console.log('  relations:           ', scenario.relations.length);
  console.log('  techTree:            ', scenario.techTree.length, '(by branch)', techByBranch);
  console.log('  eventPool:           ', scenario.eventPool.length, '(by trigger)', eventByTrigger);
  console.log('  event tags:          ', tagCounts);
  console.log('  victoryConditions:   ', scenario.victoryConditions.length);
  console.log('  difficulties:        ', scenario.difficulties.length);
  console.log('  AI archetypes:       ', archetypeCounts);
  console.log('  i18n keys referenced:', referencedKeys.length);
  console.log('  IT entries:          ', Object.keys(it).length, `(orphans: ${orphanIt.length})`);
  console.log('  EN entries:          ', Object.keys(en).length, `(orphans: ${orphanEn.length})`);

  const hasPhase3 =
    scenario.blocs !== undefined ||
    scenario.unCouncilMembers !== undefined ||
    scenario.unTriggerMap !== undefined ||
    scenario.dethroneIsolationOnByDefault !== undefined ||
    scenario.eras !== undefined ||
    phase3Stats.spaceMilestones > 0;
  if (hasPhase3) {
    console.log(
      '  Phase 3 — blocs:     ',
      phase3Stats.blocs,
      `(${phase3Stats.blocMembersTotal} member${phase3Stats.blocMembersTotal === 1 ? '' : 's'} total)`,
    );
    console.log('  Phase 3 — UN council:', phase3Stats.councilMembers);
    console.log('  Phase 3 — UN triggers:', phase3Stats.triggers);
    console.log(
      '  Phase 3 — dethrone isolation:',
      phase3Stats.dethroneIsolation === null
        ? '(unset → default off)'
        : phase3Stats.dethroneIsolation
          ? 'on'
          : 'off',
    );
    console.log('  Phase 3 — eras:      ', phase3Stats.eras);
    console.log('  Phase 3 — space milestones:', phase3Stats.spaceMilestones);
  } else {
    console.log('  Phase 3:              not in use');
  }

  if (orphanIt.length > 0) {
    console.warn('  IT orphan keys (not referenced in scenario):');
    for (const k of orphanIt) console.warn('    -', k);
  }
  if (orphanEn.length > 0) {
    console.warn('  EN orphan keys (not referenced in scenario):');
    for (const k of orphanEn) console.warn('    -', k);
  }
  if (eventTagWarnings.length > 0) {
    console.warn('  Event tag warnings (unknown tag values, non-fatal):');
    for (const w of eventTagWarnings) console.warn('    -', w);
  }

  if (allErrors.length > 0) {
    console.error(`\n  Validation FAILED for "${scenario.id}":`);
    for (const e of allErrors) console.error('    -', e);
  } else {
    console.log(`  ✓ "${scenario.id}" validates OK`);
  }

  return { errors: allErrors.length, warnings: eventTagWarnings.length };
}

// ---------------------------------------------------------------------------
// Run validation across the registry.
// ---------------------------------------------------------------------------

let totalErrors = 0;
let totalWarnings = 0;
let validatedCount = 0;
let plannedCount = 0;

console.log(`Validating ${SCENARIO_FILES.length} scenario entr${SCENARIO_FILES.length === 1 ? 'y' : 'ies'}...`);

for (const entry of SCENARIO_FILES) {
  if ('planned' in entry && entry.planned) {
    console.log(`\nScenario: ${entry.id} — SKIPPED (planned${entry.reason ? `: ${entry.reason}` : ''})`);
    plannedCount += 1;
    continue;
  }

  const bundle = entry as ScenarioBundle;
  try {
    const { errors, warnings } = validateScenario(bundle);
    totalErrors += errors;
    totalWarnings += warnings;
    validatedCount += 1;
  } catch (err) {
    console.error(`\n  ✗ "${bundle.id}" threw during validation:`, err instanceof Error ? err.message : err);
    totalErrors += 1;
  }
}

console.log(
  `\n— Done: ${validatedCount} scenario${validatedCount === 1 ? '' : 's'} validated, ` +
    `${plannedCount} skipped (planned), ${totalErrors} error${totalErrors === 1 ? '' : 's'}, ` +
    `${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}.`,
);

if (totalErrors > 0) {
  process.exit(1);
}

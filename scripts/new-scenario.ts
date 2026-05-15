#!/usr/bin/env tsx
// Aurion scenario scaffolder.
//
// Generates the three files required by the engine + i18n layer for a brand
// new scenario, pre-filled with a minimal but type-valid template (3 nations,
// 1 tech, 1 event, the 5 canonical victory conditions, 1 difficulty preset).
// The result is shaped so that authors can immediately run the validator and
// the simulator against it, then iterate.
//
// Usage:
//   pnpm new-scenario <id>
//   pnpm tsx scripts/new-scenario.ts <id>
//
// `<id>` must be kebab-case and not collide with an existing scenario file.

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// CLI entry point.
// ---------------------------------------------------------------------------

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const SCENARIOS_DIR = join(REPO_ROOT, 'apps', 'web', 'content', 'scenarios');
const REGISTRY_PATH = join(REPO_ROOT, 'apps', 'web', 'lib', 'scenarios.ts');

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

async function main(): Promise<void> {
  const id = process.argv[2];

  if (!id) {
    fail(
      'Missing scenario id.\n' +
        '  Usage: pnpm new-scenario <id>\n' +
        '  Example: pnpm new-scenario mondo-contemporaneo',
    );
  }

  if (!KEBAB_CASE.test(id)) {
    fail(
      `Invalid id "${id}".\n` +
        '  Must be kebab-case: lowercase letters, digits, and dashes; must start with a letter.\n' +
        '  Examples: quick-start, mondo-contemporaneo, guerra-fredda',
    );
  }

  // Refuse to clobber any of the three target files.
  const targets = {
    json: join(SCENARIOS_DIR, `${id}.json`),
    it: join(SCENARIOS_DIR, `${id}.it.json`),
    en: join(SCENARIOS_DIR, `${id}.en.json`),
  } as const;

  for (const [label, path] of Object.entries(targets)) {
    if (await exists(path)) {
      fail(`Refusing to overwrite existing ${label} file: ${path}`);
    }
  }

  // Confirm the scenarios directory exists; create it if not.
  await mkdir(SCENARIOS_DIR, { recursive: true });

  // Render and write the three files.
  await writeFile(targets.json, renderScenarioJson(id), 'utf8');
  await writeFile(targets.it, renderMessagesJson(id, 'it'), 'utf8');
  await writeFile(targets.en, renderMessagesJson(id, 'en'), 'utf8');

  // Friendly report.
  console.log('');
  console.log('Aurion scenario scaffolder');
  console.log(`  id: ${id}`);
  console.log(`  Created: ${relativeToRepo(targets.json)}`);
  console.log(`  Created: ${relativeToRepo(targets.it)}`);
  console.log(`  Created: ${relativeToRepo(targets.en)}`);
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Add "${id}" to the SCENARIO_IDS registry in:`);
  console.log(`     ${relativeToRepo(REGISTRY_PATH)}`);
  console.log('     (and to the loader / messages-loader branches in the same file)');
  console.log('  2. Add the same id to SCENARIO_FILES in:');
  console.log(`     ${relativeToRepo(join(SCENARIOS_DIR, 'validate.ts'))}`);
  console.log('  3. Edit the new .json file to flesh out countries, tech tree, events, etc.');
  console.log('  4. Run the validator as you fill in:');
  console.log('     pnpm tsx apps/web/content/scenarios/validate.ts');
  console.log('  5. Once balanced, add this scenario to the e2e suite (apps/web/tests/e2e).');
  console.log('');
}

main().catch((err) => {
  console.error('new-scenario: unexpected failure');
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function fail(message: string): never {
  console.error(`new-scenario: ${message}`);
  process.exit(1);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}

function relativeToRepo(absolute: string): string {
  if (absolute.startsWith(REPO_ROOT + '/')) {
    return absolute.slice(REPO_ROOT.length + 1);
  }
  return absolute;
}

// ---------------------------------------------------------------------------
// Template renderers. Kept inline (no external template files) so the script
// is fully self-contained — no new deps, no I/O beyond the three writes.
// ---------------------------------------------------------------------------

function renderScenarioJson(id: string): string {
  // Three placeholder nations (one is the player), one tech per branch is
  // overkill for a "hello world" but the brief asks for one tech total — so
  // we ship a single tech in the civil branch. One placeholder event covers
  // the EventDefinition + EventChoice + EventEffect surface. Five victory
  // conditions are the engine canon. One difficulty (`normal`) keeps the
  // file Phase-1 compatible; authors layer easy/hard later.
  const placeholderTech = `tech_${id.replace(/-/g, '_')}_civil_starter`;
  const playerCountry = `${id}-alpha`;
  const aiCountryA = `${id}-bravo`;
  const aiCountryB = `${id}-charlie`;
  const regionId = `${id}-region`;

  const scenario = {
    id,
    nameKey: `scenario.${id}.name`,
    descriptionKey: `scenario.${id}.description`,
    version: '0.0.1',
    startTick: 0,
    playableCountries: [playerCountry],
    countries: [
      countryTemplate({
        id: playerCountry,
        regionId,
        isPlayer: true,
      }),
      countryTemplate({
        id: aiCountryA,
        regionId,
        isPlayer: false,
        archetype: 'pacifist_trader',
      }),
      countryTemplate({
        id: aiCountryB,
        regionId,
        isPlayer: false,
        archetype: 'regional_bully',
      }),
    ],
    relations: [
      {
        countryA: playerCountry,
        countryB: aiCountryA,
        attitude: 20,
      },
      {
        countryA: playerCountry,
        countryB: aiCountryB,
        attitude: -10,
      },
    ],
    techTree: [
      {
        id: placeholderTech,
        nameKey: `tech.${id}.civil.starter.name`,
        descriptionKey: `tech.${id}.civil.starter.description`,
        branch: 'civil',
        cost: 100,
        prereqs: [],
        effects: [
          {
            type: 'modifyStat',
            stat: 'economy.weeklyIncome',
            delta: 0,
            multiplier: 1.05,
          },
        ],
      },
    ],
    eventPool: [
      {
        id: `event_${id.replace(/-/g, '_')}_starter`,
        nameKey: `event.${id}.starter.name`,
        descriptionKey: `event.${id}.starter.description`,
        trigger: {
          type: 'random',
          chancePerTick: 0.01,
        },
        cooldownTicks: 50,
        weight: 5,
        tags: ['narrative', 'opportunity'],
        choices: [
          {
            labelKey: `event.${id}.starter.choice.accept`,
            effects: [
              {
                type: 'modifyStat',
                target: 'player',
                stat: 'politics.popularity',
                delta: 3,
              },
            ],
          },
          {
            labelKey: `event.${id}.starter.choice.refuse`,
            effects: [
              {
                type: 'modifyStat',
                target: 'player',
                stat: 'economy.treasury',
                delta: 2,
              },
            ],
          },
        ],
      },
    ],
    victoryConditions: [
      {
        id: 'economic',
        nameKey: `victory.${id}.economic.name`,
        descriptionKey: `victory.${id}.economic.description`,
        rule: { kind: 'gdpRank', ofPlayer: true, rankAtMost: 1 },
      },
      {
        id: 'military',
        nameKey: `victory.${id}.military.name`,
        descriptionKey: `victory.${id}.military.description`,
        rule: { kind: 'controlNCountries', n: 2 },
      },
      {
        id: 'scientific',
        nameKey: `victory.${id}.scientific.name`,
        descriptionKey: `victory.${id}.scientific.description`,
        rule: { kind: 'completeTech', techId: placeholderTech },
      },
      {
        id: 'diplomatic',
        nameKey: `victory.${id}.diplomatic.name`,
        descriptionKey: `victory.${id}.diplomatic.description`,
        rule: { kind: 'allianceCoverage', minPercent: 60 },
      },
      {
        id: 'domination',
        nameKey: `victory.${id}.domination.name`,
        descriptionKey: `victory.${id}.domination.description`,
        rule: { kind: 'controlNCountries', n: 3 },
      },
    ],
    difficulties: [
      {
        id: 'normal',
        nameKey: 'difficulty.normal.name',
        modifiers: {
          aiAggression: 1.0,
          aiResearchSpeed: 1.0,
          playerIncome: 1.0,
          eventDifficulty: 1.0,
        },
      },
    ],
  };

  return JSON.stringify(scenario, null, 2) + '\n';
}

type CountryTemplateOpts = {
  id: string;
  regionId: string;
  isPlayer: boolean;
  archetype?: 'pacifist_trader' | 'regional_bully' | 'cold_isolationist' | 'opportunist' | 'superpower';
};

function countryTemplate(opts: CountryTemplateOpts): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: opts.id,
    nameKey: `country.${opts.id}.name`,
    color: opts.isPlayer ? '#2E86AB' : '#7B4B94',
    regionId: opts.regionId,
    capitalKey: `country.${opts.id}.capital`,
    population: 5000000,
    economy: {
      treasury: 1000000000,
      gdp: 20000000000,
      weeklyIncome: 30000000,
      taxRate: 28,
      sectors: {
        agriculture: 0.2,
        industry: 0.35,
        services: 0.35,
        tech: 0.1,
      },
    },
    military: {
      armySize: 10000,
      navy: 3000,
      airforce: 2000,
      doctrineLevel: 0.3,
      deployedUnits: [],
    },
    intelligence: {
      spyCount: 2,
      counterIntelLevel: 0.3,
      knownIntel: {},
    },
    politics: {
      popularity: 60,
      factions: {
        army: { satisfaction: 55, influence: 45 },
        business: { satisfaction: 60, influence: 55 },
        religious: { satisfaction: 55, influence: 30 },
        populist: { satisfaction: 60, influence: 50 },
        reformist: { satisfaction: 60, influence: 50 },
      },
      governmentType: 'democracy',
    },
    isPlayer: opts.isPlayer,
    initialCompletedTechs: [],
  };

  if (!opts.isPlayer) {
    base.aiPersonality = {
      archetype: opts.archetype ?? 'pacifist_trader',
      aggressiveness: 0.3,
      expansionism: 0.3,
      paranoia: 0.4,
      pragmatism: 0.6,
    };
  }

  return base;
}

function renderMessagesJson(id: string, locale: 'it' | 'en'): string {
  // Mirror the keys produced by the scenario template above. Values are
  // human-friendly TODO markers so authors can grep `FILL:` to find them.
  const playerCountry = `${id}-alpha`;
  const aiCountryA = `${id}-bravo`;
  const aiCountryB = `${id}-charlie`;

  const todo = (label: string): string => `FILL (${locale}): ${label}`;

  const messages: Record<string, string> = {
    [`scenario.${id}.name`]: todo(`scenario "${id}" — display name`),
    [`scenario.${id}.description`]: todo(`scenario "${id}" — short description shown in the picker`),

    [`country.${playerCountry}.name`]: todo(`country "${playerCountry}" — name`),
    [`country.${playerCountry}.capital`]: todo(`country "${playerCountry}" — capital city`),
    [`country.${aiCountryA}.name`]: todo(`country "${aiCountryA}" — name`),
    [`country.${aiCountryA}.capital`]: todo(`country "${aiCountryA}" — capital city`),
    [`country.${aiCountryB}.name`]: todo(`country "${aiCountryB}" — name`),
    [`country.${aiCountryB}.capital`]: todo(`country "${aiCountryB}" — capital city`),

    [`tech.${id}.civil.starter.name`]: todo('starter civil tech — name'),
    [`tech.${id}.civil.starter.description`]: todo('starter civil tech — description'),

    [`event.${id}.starter.name`]: todo('starter event — name'),
    [`event.${id}.starter.description`]: todo('starter event — description'),
    [`event.${id}.starter.choice.accept`]: todo('starter event — accept choice label'),
    [`event.${id}.starter.choice.refuse`]: todo('starter event — refuse choice label'),

    [`victory.${id}.economic.name`]: todo('economic victory — name'),
    [`victory.${id}.economic.description`]: todo('economic victory — description'),
    [`victory.${id}.military.name`]: todo('military victory — name'),
    [`victory.${id}.military.description`]: todo('military victory — description'),
    [`victory.${id}.scientific.name`]: todo('scientific victory — name'),
    [`victory.${id}.scientific.description`]: todo('scientific victory — description'),
    [`victory.${id}.diplomatic.name`]: todo('diplomatic victory — name'),
    [`victory.${id}.diplomatic.description`]: todo('diplomatic victory — description'),
    [`victory.${id}.domination.name`]: todo('domination victory — name'),
    [`victory.${id}.domination.description`]: todo('domination victory — description'),

    'difficulty.normal.name': locale === 'it' ? 'Normale' : 'Normal',
  };

  return JSON.stringify(messages, null, 2) + '\n';
}

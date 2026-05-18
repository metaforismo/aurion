// Built-in achievement catalogue. ~20 entries spanning bronze / silver / gold
// tiers and covering common play patterns. The ids are stable strings keyed
// directly into the i18n bundles (see `apps/web/messages/{it,en}.json` under
// the `achievements.<id>.{name,description}` namespace).
//
// Hidden achievements are listed but display as a placeholder until unlocked.

import type { AchievementDef } from '../types.js';

export const BUILTIN_ACHIEVEMENTS: readonly AchievementDef[] = [
  // ---- Bronze: introductory milestones ----------------------------------
  {
    id: 'complete_first_tech',
    nameKey: 'achievements.complete_first_tech.name',
    descKey: 'achievements.complete_first_tech.description',
    tier: 'bronze',
    // Any of the three "starter" techs we ship in the bundled scenarios.
    condition: {
      kind: 'or',
      conditions: [
        { kind: 'completeTech', techId: 'tech_industry_basics' },
        { kind: 'completeTech', techId: 'tech_doctrine_basic' },
        { kind: 'completeTech', techId: 'tech_intel_basics' },
      ],
    },
  },
  {
    id: 'popular_leader',
    nameKey: 'achievements.popular_leader.name',
    descKey: 'achievements.popular_leader.description',
    tier: 'bronze',
    condition: { kind: 'reachPopularity', threshold: 80 },
  },
  {
    id: 'first_alliance',
    nameKey: 'achievements.first_alliance.name',
    descKey: 'achievements.first_alliance.description',
    tier: 'bronze',
    condition: { kind: 'allianceCount', n: 1 },
  },
  {
    id: 'first_spy_op',
    nameKey: 'achievements.first_spy_op.name',
    descKey: 'achievements.first_spy_op.description',
    tier: 'bronze',
    condition: { kind: 'spyOpsCompleted', n: 1 },
  },
  {
    id: 'first_century',
    nameKey: 'achievements.first_century.name',
    descKey: 'achievements.first_century.description',
    tier: 'bronze',
    condition: { kind: 'survivedTicks', n: 100 },
  },

  // ---- Silver: mid-game accomplishments ----------------------------------
  {
    id: 'master_spy',
    nameKey: 'achievements.master_spy.name',
    descKey: 'achievements.master_spy.description',
    tier: 'silver',
    condition: { kind: 'spyOpsCompleted', n: 10 },
  },
  {
    id: 'peace_through_strength',
    nameKey: 'achievements.peace_through_strength.name',
    descKey: 'achievements.peace_through_strength.description',
    tier: 'silver',
    condition: { kind: 'completeWar', wins: 3 },
  },
  {
    id: 'survivor',
    nameKey: 'achievements.survivor.name',
    descKey: 'achievements.survivor.description',
    tier: 'silver',
    condition: { kind: 'survivedTicks', n: 500 },
  },
  {
    id: 'cold_warrior',
    nameKey: 'achievements.cold_warrior.name',
    descKey: 'achievements.cold_warrior.description',
    tier: 'silver',
    // Long survival under pressure approximates a sustained Cold-War stance.
    condition: { kind: 'survivedTicks', n: 250 },
  },
  {
    id: 'coalition_builder',
    nameKey: 'achievements.coalition_builder.name',
    descKey: 'achievements.coalition_builder.description',
    tier: 'silver',
    condition: { kind: 'allianceCount', n: 3 },
  },
  {
    id: 'beloved_government',
    nameKey: 'achievements.beloved_government.name',
    descKey: 'achievements.beloved_government.description',
    tier: 'silver',
    condition: { kind: 'reachPopularity', threshold: 90 },
  },
  {
    id: 'top3_economy',
    nameKey: 'achievements.top3_economy.name',
    descKey: 'achievements.top3_economy.description',
    tier: 'silver',
    condition: { kind: 'reachGdpRank', rank: 3 },
  },
  {
    id: 'industrial_powerhouse',
    nameKey: 'achievements.industrial_powerhouse.name',
    descKey: 'achievements.industrial_powerhouse.description',
    tier: 'silver',
    condition: { kind: 'completeTech', techId: 'tech_advanced_industry' },
  },

  // ---- Gold: late-game / ambitious objectives ----------------------------
  {
    id: 'economic_titan',
    nameKey: 'achievements.economic_titan.name',
    descKey: 'achievements.economic_titan.description',
    tier: 'gold',
    condition: { kind: 'reachGdpRank', rank: 1 },
  },
  {
    id: 'space_pioneer',
    nameKey: 'achievements.space_pioneer.name',
    descKey: 'achievements.space_pioneer.description',
    tier: 'gold',
    // Any of the canonical "space programme" tech ids across scenarios.
    condition: {
      kind: 'or',
      conditions: [
        { kind: 'completeTech', techId: 'tech_space_program' },
        { kind: 'completeTech', techId: 'tech_orbital_launch' },
        { kind: 'completeTech', techId: 'tech_satellite_network' },
      ],
    },
  },
  {
    id: 'global_alliance',
    nameKey: 'achievements.global_alliance.name',
    descKey: 'achievements.global_alliance.description',
    tier: 'gold',
    condition: { kind: 'allianceCount', n: 5 },
  },
  {
    id: 'spy_master_general',
    nameKey: 'achievements.spy_master_general.name',
    descKey: 'achievements.spy_master_general.description',
    tier: 'gold',
    condition: { kind: 'spyOpsCompleted', n: 25 },
  },
  {
    id: 'long_haul',
    nameKey: 'achievements.long_haul.name',
    descKey: 'achievements.long_haul.description',
    tier: 'gold',
    condition: { kind: 'survivedTicks', n: 1000 },
  },
  {
    id: 'warlord',
    nameKey: 'achievements.warlord.name',
    descKey: 'achievements.warlord.description',
    tier: 'gold',
    condition: { kind: 'completeWar', wins: 5 },
  },

  // ---- Hidden secret achievement ----------------------------------------
  {
    id: 'mars_conqueror',
    nameKey: 'achievements.mars_conqueror.name',
    descKey: 'achievements.mars_conqueror.description',
    tier: 'gold',
    hidden: true,
    condition: {
      kind: 'or',
      conditions: [
        { kind: 'completeTech', techId: 'tech_mars_colony' },
        { kind: 'completeTech', techId: 'tech_mars_landing' },
      ],
    },
  },

  // ---- Phase 3 Wave 10 — nuclear MAD-tier hidden achievements -----------
  {
    id: 'scorched_earth',
    nameKey: 'achievements.scorched_earth.name',
    descKey: 'achievements.scorched_earth.description',
    tier: 'gold',
    hidden: true,
    // Any tactical or strategic nuclear strike launched this game.
    condition: { kind: 'launchedNuclear' },
  },
  {
    id: 'mutually_assured',
    nameKey: 'achievements.mutually_assured.name',
    descKey: 'achievements.mutually_assured.description',
    tier: 'gold',
    hidden: true,
    // Survived a MAD event: strategic strike fired against an armed target,
    // and the player still has their arsenal and has not lost.
    condition: { kind: 'survivedMad' },
  },
  {
    id: 'disarmer',
    nameKey: 'achievements.disarmer.name',
    descKey: 'achievements.disarmer.description',
    tier: 'gold',
    hidden: true,
    // Player previously had an arsenal, is now at 0 warheads, and a passed
    // non-proliferation UN resolution is in force.
    condition: { kind: 'dismantledUnderTreaty' },
  },
];

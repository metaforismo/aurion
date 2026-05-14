import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import {
  checkWinLoss,
  evaluateVictory,
  LOSS_LOW_POPULARITY_WEEKS,
  LOSS_NEGATIVE_TREASURY_WEEKS,
} from '../src/checkWinLoss.js';
import { makeScenario, sampleTechs } from './fixtures.js';
import type { GameState, VictoryRule } from '../src/index.js';

const scenario = makeScenario();

function freshState(): GameState {
  return createGame(scenario, {
    seed: 'wl',
    victory: 'economic',
    playerCountryId: 'aurion',
  });
}

describe('checkWinLoss — loss conditions', () => {
  it('triggers loss after 12 weeks of low popularity', () => {
    let s: GameState = {
      ...freshState(),
      countries: {
        ...freshState().countries,
        aurion: {
          ...freshState().countries.aurion!,
          politics: { ...freshState().countries.aurion!.politics, popularity: 5 },
        },
      },
    };
    for (let i = 0; i < LOSS_LOW_POPULARITY_WEEKS; i++) {
      s = checkWinLoss(s);
    }
    expect(s.winLoss).toBe('lost');
  });

  it('does not trigger if popularity recovers in time', () => {
    let s: GameState = {
      ...freshState(),
      countries: {
        ...freshState().countries,
        aurion: {
          ...freshState().countries.aurion!,
          politics: { ...freshState().countries.aurion!.politics, popularity: 5 },
        },
      },
    };
    for (let i = 0; i < 5; i++) s = checkWinLoss(s);
    // Pop recovers
    s = {
      ...s,
      countries: {
        ...s.countries,
        aurion: {
          ...s.countries.aurion!,
          politics: { ...s.countries.aurion!.politics, popularity: 60 },
        },
      },
    };
    for (let i = 0; i < 20; i++) s = checkWinLoss(s);
    expect(s.winLoss).toBe('playing');
  });

  it('triggers loss after 26 weeks of negative treasury', () => {
    let s: GameState = {
      ...freshState(),
      countries: {
        ...freshState().countries,
        aurion: {
          ...freshState().countries.aurion!,
          economy: { ...freshState().countries.aurion!.economy, treasury: -1 },
        },
      },
    };
    for (let i = 0; i < LOSS_NEGATIVE_TREASURY_WEEKS; i++) {
      s = checkWinLoss(s);
    }
    expect(s.winLoss).toBe('lost');
  });
});

describe('evaluateVictory', () => {
  it('completeTech rule', () => {
    const s = freshState();
    const withTech: GameState = {
      ...s,
      countries: {
        ...s.countries,
        aurion: {
          ...s.countries.aurion!,
          science: {
            ...s.countries.aurion!.science,
            completedTechs: ['tech_advanced_industry'],
          },
        },
      },
    };
    const rule: VictoryRule = {
      kind: 'completeTech',
      techId: 'tech_advanced_industry',
    };
    expect(evaluateVictory(s, rule)).toBe(false);
    expect(evaluateVictory(withTech, rule)).toBe(true);
  });

  it('gdpRank rule', () => {
    const s = freshState();
    const rule: VictoryRule = { kind: 'gdpRank', ofPlayer: true, rankAtMost: 1 };
    // All countries equal, player ties for rank 1.
    expect(evaluateVictory(s, rule)).toBe(true);
  });

  it('and / or composition', () => {
    const s = freshState();
    const t: VictoryRule = { kind: 'completeTech', techId: 'tech_industry_basics' };
    const f: VictoryRule = { kind: 'completeTech', techId: 'never' };
    expect(evaluateVictory(s, { kind: 'or', rules: [t, f] })).toBe(false);
    expect(evaluateVictory(s, { kind: 'and', rules: [f, f] })).toBe(false);
  });
});

describe('checkWinLoss — capital occupation', () => {
  it('does NOT count peaceful neighbours sharing a region as occupiers', () => {
    // Default fixture countries are not at war and have no deployments.
    let s = freshState();
    for (let i = 0; i < 30; i++) s = checkWinLoss(s);
    expect(s.winLoss).toBe('playing');
  });

  it('does NOT count enemy units as occupation while defenders outnumber them', () => {
    // Put khanate at war with aurion, with a small deployment in aurion's region.
    // Aurion's home garrison (1000) is much larger.
    const base = freshState();
    const aurion = base.countries.aurion!;
    const khanate = base.countries.khanate!;
    // Make sure both sit in the same region for the test.
    const sharedRegion = aurion.regionId;
    const s: GameState = {
      ...base,
      relations: {
        ...base.relations,
        'aurion::khanate': {
          ...base.relations['aurion::khanate']!,
          atWar: true,
        },
      },
      countries: {
        ...base.countries,
        khanate: {
          ...khanate,
          military: {
            ...khanate.military,
            deployedUnits: [
              {
                id: 'd1',
                regionId: sharedRegion,
                units: 50,
                hostCountryId: aurion.id,
                issuedAtTick: 0,
              },
            ],
          },
        },
      },
    };
    let next = s;
    for (let i = 0; i < 30; i++) next = checkWinLoss(next);
    expect(next.winLoss).toBe('playing');
  });

  it('triggers loss only when enemy units outnumber defenders for 26 weeks', () => {
    const base = freshState();
    const aurion = base.countries.aurion!;
    const khanate = base.countries.khanate!;
    const sharedRegion = aurion.regionId;
    // Empty Aurion's home garrison so defenders=0, then deploy 100 enemy units.
    let s: GameState = {
      ...base,
      relations: {
        ...base.relations,
        'aurion::khanate': {
          ...base.relations['aurion::khanate']!,
          atWar: true,
        },
      },
      countries: {
        ...base.countries,
        aurion: {
          ...aurion,
          military: { ...aurion.military, armySize: 0 },
        },
        khanate: {
          ...khanate,
          military: {
            ...khanate.military,
            deployedUnits: [
              {
                id: 'd1',
                regionId: sharedRegion,
                units: 100,
                hostCountryId: aurion.id,
                issuedAtTick: 0,
              },
            ],
          },
        },
      },
    };
    for (let i = 0; i < 26; i++) s = checkWinLoss(s);
    expect(s.winLoss).toBe('lost');
  });
});

// Reference sampleTechs to avoid unused import lint
void sampleTechs;

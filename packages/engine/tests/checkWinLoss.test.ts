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

// Reference sampleTechs to avoid unused import lint
void sampleTechs;

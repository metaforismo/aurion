import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import {
  DETHRONE_OUT_OF_TOP3_WEEKS,
  checkWinLoss,
} from '../src/checkWinLoss.js';
import { getDethroneStreaks } from '../src/internal.js';
import { tick } from '../src/tick.js';
import { makePhase3Scenario, makeScenario } from './fixtures.js';

describe('gameMode: classic (default)', () => {
  it('omits Phase 3 fields on legacy scenarios', () => {
    const s = createGame(makeScenario(), {
      seed: 'classic',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    expect(s.gameMode).toBeUndefined();
    expect(s.cumulativeStats).toBeUndefined();
    expect(s.unlockedVictories).toBeUndefined();
    expect(s.actionLog).toBeUndefined();
  });

  it('still wins normally when victory met (classic)', () => {
    const scenario = makeScenario();
    const s = createGame(scenario, {
      seed: 'classic-win',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    // Force aurion into top GDP rank.
    const huge = {
      ...s,
      countries: {
        ...s.countries,
        aurion: { ...s.countries.aurion!, economy: { ...s.countries.aurion!.economy, gdp: 9_999_999_999_999 } },
      },
    };
    const out = checkWinLoss(huge, scenario.victoryConditions[0]!.rule);
    expect(out.winLoss).toBe('won');
  });
});

describe('gameMode: eternal', () => {
  it('initializes cumulativeStats and unlockedVictories', () => {
    const scenario = makePhase3Scenario();
    const s = createGame(scenario, {
      seed: 'eternal',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    expect(s.gameMode).toBe('eternal');
    expect(s.cumulativeStats).toBeDefined();
    expect(s.unlockedVictories).toEqual([]);
    expect(s.actionLog).toEqual([]);
  });

  it('never wins when victory met in eternal', () => {
    const scenario = makePhase3Scenario();
    let s = createGame(scenario, {
      seed: 'eternal-win',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    s = {
      ...s,
      countries: {
        ...s.countries,
        aurion: { ...s.countries.aurion!, economy: { ...s.countries.aurion!.economy, gdp: 9_999_999_999_999 } },
      },
    };
    const out = checkWinLoss(s, scenario.victoryConditions[0]!.rule);
    expect(out.winLoss).toBe('playing');
  });

  it('still loses normally in eternal mode (loss conditions remain armed)', () => {
    const scenario = makePhase3Scenario();
    let s = createGame(scenario, {
      seed: 'eternal-loss',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    // Tank popularity to trigger loss after enough weeks.
    s = {
      ...s,
      countries: {
        ...s.countries,
        aurion: {
          ...s.countries.aurion!,
          politics: { ...s.countries.aurion!.politics, popularity: 0 },
        },
      },
    };
    // Run check enough times to exceed LOSS_LOW_POPULARITY_WEEKS (12).
    for (let i = 0; i < 20; i++) {
      s = checkWinLoss(s);
    }
    expect(s.winLoss).toBe('lost');
  });

  it('tracks unlockedVictories and never duplicates entries', () => {
    const scenario = makePhase3Scenario();
    let s = createGame(scenario, {
      seed: 'eternal-unlock',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    s = {
      ...s,
      countries: {
        ...s.countries,
        aurion: { ...s.countries.aurion!, economy: { ...s.countries.aurion!.economy, gdp: 9_999_999_999_999 } },
      },
    };
    s = tick(s, { scenario, techCatalog: scenario.techTree, eventPool: scenario.eventPool });
    expect(s.unlockedVictories).toContain('economic');
    s = tick(s, { scenario, techCatalog: scenario.techTree, eventPool: scenario.eventPool });
    s = tick(s, { scenario, techCatalog: scenario.techTree, eventPool: scenario.eventPool });
    // Still only once.
    const economicCount = s.unlockedVictories?.filter((v) => v === 'economic').length;
    expect(economicCount).toBe(1);
  });

  it('cumulativeStats updates over ticks', () => {
    const scenario = makePhase3Scenario();
    let s = createGame(scenario, {
      seed: 'eternal-cs',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal',
    });
    for (let i = 0; i < 5; i++) {
      s = tick(s, { scenario, techCatalog: scenario.techTree, eventPool: scenario.eventPool });
    }
    expect(s.cumulativeStats?.totalTicksPlayed).toBe(5);
    expect(s.cumulativeStats?.peakGdpRank).toBeLessThanOrEqual(999);
  });
});

describe('gameMode: dethrone', () => {
  it('counts outOfTop3Weeks streak', () => {
    const scenario = makePhase3Scenario();
    let s = createGame(scenario, {
      seed: 'dethrone',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'dethrone',
    });
    // Make aurion the LOWEST GDP so it's never in top 3.
    s = {
      ...s,
      countries: {
        ...s.countries,
        aurion: { ...s.countries.aurion!, economy: { ...s.countries.aurion!.economy, gdp: 1 } },
      },
    };
    s = checkWinLoss(s);
    s = checkWinLoss(s);
    s = checkWinLoss(s);
    const streaks = getDethroneStreaks(s);
    expect(streaks.outOfTop3Weeks).toBe(3);
  });

  it('triggers loss after DETHRONE_OUT_OF_TOP3_WEEKS streak', () => {
    const scenario = makePhase3Scenario();
    let s = createGame(scenario, {
      seed: 'dethrone-loss',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'dethrone',
    });
    s = {
      ...s,
      countries: {
        ...s.countries,
        aurion: { ...s.countries.aurion!, economy: { ...s.countries.aurion!.economy, gdp: 1 } },
      },
    };
    for (let i = 0; i < DETHRONE_OUT_OF_TOP3_WEEKS + 5; i++) {
      s = checkWinLoss(s);
      if (s.winLoss === 'lost') break;
    }
    expect(s.winLoss).toBe('lost');
  });

  it('resets streak when player re-enters top 3', () => {
    const scenario = makePhase3Scenario();
    let s = createGame(scenario, {
      seed: 'dethrone-reset',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'dethrone',
    });
    s = {
      ...s,
      countries: {
        ...s.countries,
        aurion: { ...s.countries.aurion!, economy: { ...s.countries.aurion!.economy, gdp: 1 } },
      },
    };
    s = checkWinLoss(s);
    s = checkWinLoss(s);
    expect(getDethroneStreaks(s).outOfTop3Weeks).toBe(2);
    // Boost to top.
    s = {
      ...s,
      countries: {
        ...s.countries,
        aurion: { ...s.countries.aurion!, economy: { ...s.countries.aurion!.economy, gdp: 9_999_999_999_999 } },
      },
    };
    s = checkWinLoss(s);
    expect(getDethroneStreaks(s).outOfTop3Weeks).toBe(0);
  });

  it('isolation streak only triggers loss when scenario flag is on', () => {
    const scenario = makePhase3Scenario();
    let s = createGame(scenario, {
      seed: 'dethrone-iso',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'dethrone',
    });
    // Force aurion to remain in top GDP, but isolated.
    s = {
      ...s,
      reputation: { western: -90, eastern: -90 } as typeof s.reputation,
    };
    // Run with isolationEnabled=false → no loss after streak.
    for (let i = 0; i < 270; i++) {
      s = checkWinLoss(s, undefined, undefined, false);
    }
    expect(s.winLoss).toBe('playing');

    // Now enable: it should lose.
    let s2 = createGame(scenario, {
      seed: 'dethrone-iso-2',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'dethrone',
    });
    s2 = {
      ...s2,
      reputation: { western: -90, eastern: -90 } as typeof s2.reputation,
    };
    for (let i = 0; i < 270; i++) {
      s2 = checkWinLoss(s2, undefined, undefined, true);
      if (s2.winLoss === 'lost') break;
    }
    expect(s2.winLoss).toBe('lost');
  });

  it('does not trigger dethrone loss when gameMode !== dethrone', () => {
    const scenario = makePhase3Scenario();
    let s = createGame(scenario, {
      seed: 'no-dethrone',
      victory: 'economic',
      playerCountryId: 'aurion',
      gameMode: 'eternal', // NOT dethrone
    });
    s = {
      ...s,
      countries: {
        ...s.countries,
        aurion: { ...s.countries.aurion!, economy: { ...s.countries.aurion!.economy, gdp: 1 } },
      },
    };
    for (let i = 0; i < DETHRONE_OUT_OF_TOP3_WEEKS + 5; i++) {
      s = checkWinLoss(s);
    }
    expect(s.winLoss).toBe('playing');
  });
});

describe('save migration: legacy state without gameMode', () => {
  it('treats missing gameMode as classic', () => {
    const scenario = makeScenario();
    const s = createGame(scenario, {
      seed: 'legacy',
      victory: 'economic',
      playerCountryId: 'aurion',
    });
    // Behaves like classic: tick advances normally, no Phase 3 fields populated.
    const next = tick(s, { techCatalog: scenario.techTree, eventPool: scenario.eventPool });
    expect(next.tick).toBe(s.tick + 1);
    expect(next.unlockedVictories).toBeUndefined();
    expect(next.cumulativeStats).toBeUndefined();
  });
});

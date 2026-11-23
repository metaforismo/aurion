import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/actions/index.js';
import { createGame } from '../src/createGame.js';
import { tick } from '../src/tick.js';
import type { GameState } from '../src/types.js';
import {
  WAR_CAPITULATION_SCORE,
  WAR_REPARATIONS_SCORE,
  WAR_TRUCE_TICKS,
  peaceTerms,
  recordBattle,
  warBetween,
  warKey,
  warScoreFor,
} from '../src/war/index.js';
import { makeScenario, sampleTechs } from './fixtures.js';

const scenario = makeScenario();
const base = createGame(scenario, { seed: 'war', victory: 'economic', playerCountryId: 'aurion' });
const key = warKey('aurion', 'borealis');

/** Aurion and Borealis at war, with the score set from Aurion's side. */
function atWar(score: number): GameState {
  const rel = base.relations[key as keyof typeof base.relations]!;
  const hostile: GameState = {
    ...base,
    relations: { ...base.relations, [key]: { ...rel, attitude: -60, treaties: [] } },
  };
  const declared = applyAction(hostile, { type: 'diplomacy', target: 'borealis', kind: 'declareWar' }, 'aurion');
  expect(declared.errors).toEqual([]);
  const war = warBetween(declared.state, 'aurion', 'borealis')!;
  return {
    ...declared.state,
    wars: { ...declared.state.wars, [key]: { ...war, score: war.a === 'aurion' ? score : -score } },
  };
}

const peace = (s: GameState, by: 'aurion' | 'borealis') =>
  applyAction(s, { type: 'diplomacy', target: by === 'aurion' ? 'borealis' : 'aurion', kind: 'sueForPeace' }, by);

describe('wars keep score', () => {
  it('declaring war opens a scored war', () => {
    const s = atWar(0);
    expect(warBetween(s, 'aurion', 'borealis')).toBeDefined();
    expect(warScoreFor(s, 'aurion', 'borealis')).toBe(0);
  });

  it('killing more than you lose moves the score your way', () => {
    const s = atWar(0);
    const wars = { ...s.wars! };
    recordBattle(wars, 'aurion', 'borealis', 10, 400);
    const after = { ...s, wars };
    expect(warScoreFor(after, 'aurion', 'borealis')).toBeGreaterThan(0);
    expect(warScoreFor(after, 'borealis', 'aurion')).toBeLessThan(0);
  });

  it('wears down both governments while it lasts', () => {
    const calm = tick(base, { techCatalog: sampleTechs });
    const fighting = tick(atWar(0), { techCatalog: sampleTechs });
    expect(fighting.countries.aurion!.politics.popularity).toBeLessThan(calm.countries.aurion!.politics.popularity);
  });
});

describe('peace terms follow the score', () => {
  it('a close war ends in a draw', () => {
    const s = atWar(WAR_REPARATIONS_SCORE - 1);
    expect(peaceTerms(s, 'aurion', 'borealis').tier).toBe('white');
    const after = peace(s, 'aurion').state;
    expect(after.countries.aurion!.economy.treasury).toBe(s.countries.aurion!.economy.treasury);
    expect(warBetween(after, 'aurion', 'borealis')).toBeUndefined();
    expect(after.relations[key as keyof typeof after.relations]!.atWar).toBe(false);
  });

  it('the side ahead collects reparations, whoever asks for peace', () => {
    const s = atWar(WAR_REPARATIONS_SCORE + 5);
    const terms = peaceTerms(s, 'borealis', 'aurion');
    expect(terms.tier).toBe('reparations');
    expect(terms.winner).toBe('aurion');
    expect(terms.reparations).toBeGreaterThan(0);
    const after = peace(s, 'borealis').state;
    expect(after.countries.aurion!.economy.treasury - s.countries.aurion!.economy.treasury).toBe(terms.reparations);
    expect(s.countries.borealis!.economy.treasury - after.countries.borealis!.economy.treasury).toBe(terms.reparations);
    expect(after.peaceLog!.at(-1)).toMatchObject({ tier: 'reparations', winner: 'aurion', proposedBy: 'borealis' });
  });

  it('capitulation costs the loser part of its economy', () => {
    const s = atWar(-WAR_CAPITULATION_SCORE);
    const terms = peaceTerms(s, 'aurion', 'borealis');
    expect(terms).toMatchObject({ tier: 'capitulation', winner: 'borealis', loser: 'aurion' });
    const after = peace(s, 'aurion').state;
    expect(after.countries.aurion!.economy.gdp).toBeLessThan(s.countries.aurion!.economy.gdp);
    expect(after.countries.borealis!.economy.gdp).toBeGreaterThan(s.countries.borealis!.economy.gdp);
    expect(after.countries.aurion!.politics.popularity).toBeLessThan(s.countries.aurion!.politics.popularity);
  });

  it('a truce follows: no new war until it runs out', () => {
    const after = peace(atWar(0), 'aurion').state;
    const again = applyAction(after, { type: 'diplomacy', target: 'borealis', kind: 'declareWar' }, 'aurion');
    expect(again.errors).toEqual(['errors.diplomacy.truce']);
    const later = applyAction(
      { ...after, tick: after.tick + WAR_TRUCE_TICKS },
      { type: 'diplomacy', target: 'borealis', kind: 'declareWar' },
      'aurion',
    );
    expect(later.errors).toEqual([]);
  });
});

describe('reparations', () => {
  it('never exceed what the loser has in the treasury', () => {
    const s = atWar(-WAR_CAPITULATION_SCORE);
    const me = s.countries.aurion!;
    const poor: GameState = {
      ...s,
      countries: { ...s.countries, aurion: { ...me, economy: { ...me.economy, treasury: 1_000 } } },
    };
    expect(peaceTerms(poor, 'aurion', 'borealis').reparations).toBe(1_000);
    expect(peace(poor, 'aurion').state.countries.aurion!.economy.treasury).toBe(0);
    const broke: GameState = {
      ...s,
      countries: { ...s.countries, aurion: { ...me, economy: { ...me.economy, treasury: -5_000 } } },
    };
    expect(peaceTerms(broke, 'aurion', 'borealis').reparations).toBe(0);
  });
});

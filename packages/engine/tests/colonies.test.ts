import { describe, expect, it } from 'vitest';
import {
  COLONY_FOCUS_COOLDOWN_TICKS,
  applyAction,
  colonyCapacity,
  colonyModifiers,
  colonyOutput,
  createGame,
  getColonyStatus,
  tickCosmos,
} from '../src/index.js';
import type { GameState } from '../src/index.js';
import { makeScenario } from './fixtures.js';

function settled(completed: string[]): GameState {
  const base = createGame(makeScenario(), { seed: 'colonies', victory: 'economic', playerCountryId: 'aurion' });
  const withCosmos = tickCosmos(base);
  return { ...withCosmos, cosmos: { ...withCosmos.cosmos!, completed } };
}

const grow = (s: GameState, weeks: number) => {
  let next = s;
  for (let i = 0; i < weeks; i += 1) next = tickCosmos({ ...next, tick: next.tick + 1 });
  return next;
};

describe('colonies', () => {
  it('nobody lives on a world without housing', () => {
    const s = grow(settled(['moon_survey']), 5);
    expect(getColonyStatus(s, 'moon')).toBeNull();
    expect(colonyModifiers(s)).toEqual({ research: 0, income: 0, projectSpeed: 0 });
  });

  it('a base founds a colony that grows toward its housing and never past it', () => {
    const founded = grow(settled(['moon_base']), 1);
    const start = getColonyStatus(founded, 'moon')!;
    expect(start.capacity).toBe(colonyCapacity(['moon_base'], 'moon'));
    expect(start.population).toBeGreaterThan(0);
    expect(start.population).toBeLessThan(start.capacity);
    const later = getColonyStatus(grow(founded, 600), 'moon')!;
    expect(later.population).toBeGreaterThan(start.population);
    expect(later.population).toBeLessThanOrEqual(later.capacity);
  });

  it('each mandate pays in its own currency', () => {
    expect(colonyOutput(10_000, 'science', 1e9).research).toBeGreaterThan(colonyOutput(10_000, 'balanced', 1e9).research);
    expect(colonyOutput(10_000, 'trade', 1e9).income).toBeGreaterThan(colonyOutput(10_000, 'balanced', 1e9).income);
    expect(colonyOutput(10_000, 'industry', 1e9).projectSpeed).toBeGreaterThan(
      colonyOutput(10_000, 'balanced', 1e9).projectSpeed,
    );
    expect(colonyOutput(10_000, 'science', 1e9).income).toBe(0);
    expect(colonyOutput(1_000_000, 'trade', 1e9).income).toBeGreaterThan(colonyOutput(1_000, 'trade', 1e9).income);
  });

  it('a trading colony pays into the treasury every week', () => {
    const founded = grow(settled(['moon_base', 'moon_city']), 1);
    const trading = applyAction(founded, { type: 'setColonyFocus', body: 'moon', focus: 'trade' }, 'aurion');
    expect(trading.errors).toEqual([]);
    const before = trading.state.countries.aurion!.economy.treasury;
    const after = grow(trading.state, 1).countries.aurion!.economy.treasury;
    expect(after).toBeGreaterThan(before);
  });

  it('a mandate holds for half a year', () => {
    const founded = grow(settled(['moon_base']), 1);
    const first = applyAction(founded, { type: 'setColonyFocus', body: 'moon', focus: 'science' }, 'aurion');
    expect(first.errors).toEqual([]);
    const tooSoon = applyAction(first.state, { type: 'setColonyFocus', body: 'moon', focus: 'trade' }, 'aurion');
    expect(tooSoon.errors).toEqual(['errors.colony.cooldown']);
    const later = applyAction(
      { ...first.state, tick: first.state.tick + COLONY_FOCUS_COOLDOWN_TICKS },
      { type: 'setColonyFocus', body: 'moon', focus: 'trade' },
      'aurion',
    );
    expect(later.errors).toEqual([]);
    expect(applyAction(founded, { type: 'setColonyFocus', body: 'mars', focus: 'trade' }, 'aurion').errors).toEqual([
      'errors.colony.none',
    ]);
  });
});

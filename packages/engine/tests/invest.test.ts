import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { applyInvest, investEfficiency } from '../src/actions/invest.js';
import { tick } from '../src/tick.js';
import { makeScenario } from './fixtures.js';

const scenario = makeScenario();
const baseState = createGame(scenario, {
  seed: 's',
  victory: 'economic',
  playerCountryId: 'aurion',
});

describe('applyInvest', () => {
  it('happy path: deducts treasury and boosts economy', () => {
    const before = baseState.countries.aurion;
    expect(before).toBeDefined();
    const initialTreasury = before!.economy.treasury;
    const initialGdp = before!.economy.gdp;
    const result = applyInvest(
      baseState,
      { type: 'invest', target: 'economy', amount: 100_000_000 },
      'aurion',
    );
    expect(result.errors).toEqual([]);
    const after = result.state.countries.aurion;
    expect(after?.economy.treasury).toBe(initialTreasury - 100_000_000);
    expect(after?.economy.gdp).toBeGreaterThan(initialGdp);
  });

  it('does not mutate the input state', () => {
    const snap = JSON.stringify(baseState);
    applyInvest(
      baseState,
      { type: 'invest', target: 'research', amount: 50_000_000 },
      'aurion',
    );
    expect(JSON.stringify(baseState)).toBe(snap);
  });

  it('rejects non-positive amount', () => {
    const result = applyInvest(
      baseState,
      { type: 'invest', target: 'economy', amount: 0 },
      'aurion',
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.state).toBe(baseState);
  });

  it('rejects when treasury is insufficient', () => {
    const result = applyInvest(
      baseState,
      { type: 'invest', target: 'economy', amount: 99_999_999_999 },
      'aurion',
    );
    expect(result.errors).toContain('errors.invest.insufficientTreasury');
  });

  it('intel investment increases spy count and counter-intel', () => {
    const before = baseState.countries.aurion!.intelligence;
    const result = applyInvest(
      baseState,
      { type: 'invest', target: 'intel', amount: 200_000_000 },
      'aurion',
    );
    const after = result.state.countries.aurion!.intelligence;
    expect(after.spyCount).toBeGreaterThan(before.spyCount);
    expect(after.counterIntelLevel).toBeGreaterThanOrEqual(before.counterIntelLevel);
  });

  it('military investment increases armySize', () => {
    const before = baseState.countries.aurion!.military.armySize;
    const result = applyInvest(
      baseState,
      { type: 'invest', target: 'military', amount: 500_000_000 },
      'aurion',
    );
    expect(result.state.countries.aurion!.military.armySize).toBeGreaterThan(before);
  });

  it('infra investment raises gdp and popularity', () => {
    const before = baseState.countries.aurion!;
    const result = applyInvest(
      baseState,
      { type: 'invest', target: 'infra', amount: 1_000_000_000 },
      'aurion',
    );
    const after = result.state.countries.aurion!;
    expect(after.economy.gdp).toBeGreaterThan(before.economy.gdp);
    expect(after.politics.popularity).toBeGreaterThanOrEqual(before.politics.popularity);
  });
});

describe('diminishing returns', () => {
  const invest = (s: typeof baseState, target: 'economy' | 'research', amount: number) =>
    applyInvest(s, { type: 'invest', target, amount }, 'aurion').state;
  const gdp = baseState.countries.aurion!.economy.gdp;
  const rich = {
    ...baseState,
    countries: {
      ...baseState.countries,
      aurion: {
        ...baseState.countries.aurion!,
        economy: { ...baseState.countries.aurion!.economy, treasury: gdp },
      },
    },
  };

  it('a second investment right after the first buys less', () => {
    const chunk = Math.round(gdp * 0.02);
    const once = invest(rich, 'economy', chunk);
    const twice = invest(once, 'economy', chunk);
    const firstGain = once.countries.aurion!.economy.gdp - gdp;
    const secondGain = twice.countries.aurion!.economy.gdp - once.countries.aurion!.economy.gdp;
    expect(firstGain).toBeGreaterThan(0);
    expect(secondGain).toBeLessThan(firstGain);
  });

  it('splitting a sum into payments changes nothing', () => {
    const sum = Math.round(gdp * 0.04);
    const whole = invest(rich, 'economy', sum).countries.aurion!.economy.gdp;
    const halves = invest(invest(rich, 'economy', sum / 2), 'economy', sum / 2).countries.aurion!.economy.gdp;
    // Each payment is priced against a slightly larger GDP: allow 1%.
    expect(Math.abs(halves - whole) / (whole - gdp)).toBeLessThan(0.01);
  });

  it('a small first investment keeps almost the full return', () => {
    const small = Math.round(gdp * 0.001);
    expect(investEfficiency(rich.countries.aurion!, 'economy', small)).toBeGreaterThan(0.95);
  });

  it('research cannot be multiplied with a few weeks of income', () => {
    const before = rich.countries.aurion!.science.researchOutput;
    const after = invest(rich, 'research', Math.round(gdp * 0.01)).countries.aurion!.science.researchOutput;
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThan(before * 2);
  });

  it('heat cools off, and the return comes back', () => {
    const hot = invest(rich, 'economy', Math.round(gdp * 0.05));
    const now = investEfficiency(hot.countries.aurion!, 'economy', gdp * 0.01);
    let later = hot;
    for (let i = 0; i < 104; i += 1) later = tick(later, {});
    expect(investEfficiency(later.countries.aurion!, 'economy', gdp * 0.01)).toBeGreaterThan(now);
  });
});

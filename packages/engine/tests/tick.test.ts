import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { tick } from '../src/tick.js';
import { applyStartResearch } from '../src/actions/startResearch.js';
import { makeScenario, sampleTechs, sampleEvents } from './fixtures.js';

const scenario = makeScenario();

function freshState() {
  return createGame(scenario, {
    seed: 'tick-seed',
    victory: 'economic',
    playerCountryId: 'aurion',
  });
}

describe('tick', () => {
  it('advances tick by 1', () => {
    const a = freshState();
    const b = tick(a, { techCatalog: sampleTechs, eventPool: sampleEvents });
    expect(b.tick).toBe(a.tick + 1);
  });

  it('treasury follows weeklyIncome', () => {
    const a = freshState();
    const b = tick(a, { techCatalog: sampleTechs });
    const before = a.countries.aurion!.economy.treasury;
    const income = b.countries.aurion!.economy.weeklyIncome;
    expect(b.countries.aurion!.economy.treasury).toBe(before + income);
  });

  it('completed research clears activeResearch and adds to completedTechs', () => {
    const start = applyStartResearch(
      freshState(),
      { type: 'startResearch', techId: 'tech_industry_basics' },
      'aurion',
      sampleTechs,
    );
    let s = start.state;
    // Run enough ticks for cost (50) at researchOutput. Should be a few ticks.
    for (let i = 0; i < 60 && s.countries.aurion?.science.activeResearch !== null; i++) {
      s = tick(s, { techCatalog: sampleTechs });
    }
    expect(s.countries.aurion!.science.activeResearch).toBeNull();
    expect(s.countries.aurion!.science.completedTechs).toContain('tech_industry_basics');
  });

  it('does not advance when winLoss is not playing', () => {
    const a = { ...freshState(), winLoss: 'won' as const };
    const b = tick(a);
    expect(b).toBe(a);
  });

  it('does not mutate input state', () => {
    const a = freshState();
    const snapshot = JSON.stringify(a);
    tick(a, { techCatalog: sampleTechs });
    expect(JSON.stringify(a)).toBe(snapshot);
  });
});

import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { FACTION_HOSTILE_AT, FACTION_LOYAL_AT, factionModifiers, factionStance } from '../src/politics/factions.js';
import { tick } from '../src/tick.js';
import type { FactionId, GameState } from '../src/types.js';
import { makeScenario, sampleTechs } from './fixtures.js';

const scenario = makeScenario();
const base = createGame(scenario, { seed: 'factions', victory: 'economic', playerCountryId: 'aurion' });

/** The game with every Aurion faction at 50, except the one under test. */
function withFaction(id: FactionId, satisfaction: number): GameState {
  const me = base.countries.aurion!;
  const factions = { ...me.politics.factions };
  for (const fid of Object.keys(factions) as FactionId[]) {
    factions[fid] = { ...factions[fid], satisfaction: fid === id ? satisfaction : 50 };
  }
  return { ...base, countries: { ...base.countries, aurion: { ...me, politics: { ...me.politics, factions } } } };
}

const step = (s: GameState) => tick(s, { techCatalog: sampleTechs }).countries.aurion!;

describe('faction leverage', () => {
  it('a faction counts only once it is loyal or hostile', () => {
    expect(factionStance(FACTION_LOYAL_AT)).toBe('loyal');
    expect(factionStance(FACTION_HOSTILE_AT)).toBe('hostile');
    expect(factionStance(50)).toBe('neutral');
    expect(factionModifiers(withFaction('business', 50).countries.aurion!).incomeMul).toBe(0);
  });

  it('business moves income', () => {
    const neutral = step(withFaction('business', 50)).economy.weeklyIncome;
    expect(step(withFaction('business', 90)).economy.weeklyIncome).toBeGreaterThan(neutral);
    expect(step(withFaction('business', 10)).economy.weeklyIncome).toBeLessThan(neutral);
  });

  it('populists move growth', () => {
    const neutral = step(withFaction('populist', 50)).economy.gdp;
    expect(step(withFaction('populist', 90)).economy.gdp).toBeGreaterThan(neutral);
    expect(step(withFaction('populist', 10)).economy.gdp).toBeLessThan(neutral);
  });

  it('the army moves combat power and the reformists research', () => {
    expect(factionModifiers(withFaction('army', 90).countries.aurion!).combatMul).toBeGreaterThan(0);
    expect(factionModifiers(withFaction('army', 10).countries.aurion!).combatMul).toBeLessThan(0);
    expect(factionModifiers(withFaction('reformist', 90).countries.aurion!).researchMul).toBeGreaterThan(0);
    expect(factionModifiers(withFaction('reformist', 10).countries.aurion!).researchMul).toBeLessThan(0);
  });
});

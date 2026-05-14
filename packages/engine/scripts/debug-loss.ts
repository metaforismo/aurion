import { readFileSync } from 'node:fs';
import { applyAction } from '../src/actions/index.js';
import { decideAiAction } from '../src/ai/index.js';
import { createGame } from '../src/createGame.js';
import { createRng } from '../src/rng.js';
import { tick } from '../src/tick.js';
import type { Scenario } from '../src/index.js';

const path = '/Users/francescogiannicola/Desktop/gioco/apps/web/content/scenarios/ascesa-aurion.json';
const scenario = JSON.parse(readFileSync(path, 'utf-8')) as Scenario;
let s = createGame(scenario, { seed: 'debug', victory: 'economic', playerCountryId: scenario.playableCountries[0]! });
const playerId = s.playerCountryId;
s = { ...s, countries: { ...s.countries, [playerId]: { ...s.countries[playerId]!, aiPersonality: { archetype: 'opportunist', aggressiveness: 0.5, expansionism: 0.5, paranoia: 0.5, pragmatism: 0.5 } } } };
const rng = createRng('debug::ai');

for (let i = 0; i < 15; i++) {
  const p = s.countries[playerId]!;
  const f = p.politics.factions;
  const tr = p.economy.treasury;
  console.log(`T${s.tick} treasury=${tr.toExponential(2)} pop=${p.politics.popularity.toFixed(1)} factions=[a:${f.army.satisfaction.toFixed(0)} b:${f.business.satisfaction.toFixed(0)} r:${f.religious.satisfaction.toFixed(0)} p:${f.populist.satisfaction.toFixed(0)} re:${f.reformist.satisfaction.toFixed(0)}] streaks=${JSON.stringify((s as any)._loseStreaks)} winLoss=${s.winLoss}`);
  if (s.winLoss !== 'playing') break;
  const action = decideAiAction(s, playerId, rng, scenario.techTree);
  if (action) {
    const r = applyAction(s, action, playerId, scenario.techTree);
    if (r.errors.length === 0) { s = r.state; }
    else console.log(`  action ${action.type} rejected: ${r.errors.join(',')}`);
  }
  s = tick(s, { techCatalog: scenario.techTree, eventPool: scenario.eventPool, victoryRule: scenario.victoryConditions[0]?.rule });
}

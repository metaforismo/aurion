// Balance probe for espionage pressure: a passive player, and a count of the
// covert operations rivals complete against them each year.
// Usage: tsx scripts/sim-spies.ts [scenarioId] [years]
import { readFileSync } from 'node:fs';
import { createGame, tick, type Scenario } from '../src/index.js';

const id = process.argv[2] ?? 'quick-start';
const years = Number(process.argv[3] ?? 20);
const scenario = JSON.parse(
  readFileSync(new URL(`../../../apps/web/content/scenarios/${id}.json`, import.meta.url), 'utf8'),
) as Scenario;
const player = scenario.playableCountries[0]!;
let state = createGame(scenario, { victory: 'economic', playerCountryId: player, seed: 'spy-sim', gameMode: 'eternal' });
const difficulty = scenario.difficulties.find((d) => d.id === state.difficultyId);
const ctx = { techCatalog: scenario.techTree, eventPool: [], scenario, difficulty };
const seen = new Set<string>();
let onPlayer = 0;
let onPlayerHit = 0;
let total = 0;
for (let i = 0; i < years * 52; i += 1) {
  state = tick(state, ctx);
  for (const op of state.spyOperations) {
    if (op.status === 'active' || seen.has(op.id)) continue;
    seen.add(op.id);
    total += 1;
    if (op.targetCountryId !== player) continue;
    onPlayer += 1;
    // Before results were recorded, an undetected success is the lower bound.
    if (op.result?.success ?? op.status === 'completed') onPlayerHit += 1;
  }
  if (state.winLoss !== 'playing') break;
}
const y = state.tick / 52;
const me = state.countries[player]!;
console.log(
  `${id}: ${y.toFixed(1)}y · rivals ${Object.keys(state.countries).length - 1} · ops/yr world ${(total / y).toFixed(1)} · on player ${(onPlayer / y).toFixed(1)}/yr (${(onPlayerHit / y).toFixed(1)} landed) · popularity ${me.politics.popularity.toFixed(0)} · army ${me.military.armySize} · ${state.winLoss}`,
);

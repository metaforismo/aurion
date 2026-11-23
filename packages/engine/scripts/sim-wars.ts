// Balance probe for wars: how many break out, how long they last and on
// what terms they end, with a passive player.
// Usage: tsx scripts/sim-wars.ts [scenarioId] [years]
import { readFileSync } from 'node:fs';
import { createGame, tick, type PeaceRecord, type Scenario } from '../src/index.js';

const id = process.argv[2] ?? 'quick-start';
const years = Number(process.argv[3] ?? 20);
const scenario = JSON.parse(
  readFileSync(new URL(`../../../apps/web/content/scenarios/${id}.json`, import.meta.url), 'utf8'),
) as Scenario;
const player = scenario.playableCountries[0]!;
let state = createGame(scenario, { victory: 'economic', playerCountryId: player, seed: 'war-sim', gameMode: 'eternal' });
const difficulty = scenario.difficulties.find((d) => d.id === state.difficultyId);
const ctx = { techCatalog: scenario.techTree, eventPool: [], scenario, difficulty };
const peaces = new Map<string, PeaceRecord>();
for (let i = 0; i < years * 52; i += 1) {
  state = tick(state, ctx);
  for (const p of state.peaceLog ?? []) peaces.set(`${p.a}:${p.b}:${p.endedAtTick}`, p);
  if (state.winLoss !== 'playing') break;
}
const all = [...peaces.values()];
const by = (tier: string) => all.filter((p) => p.tier === tier).length;
const avg = all.length ? all.reduce((s, p) => s + (p.endedAtTick - p.startedAtTick), 0) / all.length : 0;
const open = Object.values(state.wars ?? {});
console.log(
  `${id}: ${(state.tick / 52).toFixed(1)}y · peaces ${all.length} (draw ${by('white')}, reparations ${by('reparations')}, capitulation ${by('capitulation')}) · avg ${avg.toFixed(0)} wks · still at war ${open.length}${open.length ? ' oldest ' + Math.max(...open.map((w) => state.tick - w.startedAtTick)) + ' wks' : ''} · on player ${all.filter((p) => p.a === player || p.b === player).length} · ${state.winLoss}`,
);

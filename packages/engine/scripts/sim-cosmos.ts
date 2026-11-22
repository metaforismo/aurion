// Balance probe for the cosmos ladder: a greedy player that researches the
// space branch and buys every megaproject as soon as it is affordable.
// Usage: tsx scripts/sim-cosmos.ts [scenarioId] [maxTicks]
import { readFileSync } from 'node:fs';
import {
  COSMOS_PROJECTS,
  applyAction,
  createGame,
  getProjectStatus,
  tick,
  type Scenario,
} from '../src/index.js';

const id = process.argv[2] ?? 'quick-start';
const maxTicks = Number(process.argv[3] ?? 6000);
const scenario = JSON.parse(
  readFileSync(new URL(`../../../apps/web/content/scenarios/${id}.json`, import.meta.url), 'utf8'),
) as Scenario;
const player = scenario.playableCountries[0]!;
let state = createGame(scenario, { victory: 'economic', playerCountryId: player, seed: 'sim', gameMode: 'eternal' });
const difficulty = scenario.difficulties.find((d) => d.id === state.difficultyId);
const ctx = { techCatalog: scenario.techTree, eventPool: [], scenario, difficulty };
const start = state.tick;
let lastDone = 0;
for (let i = 0; i < maxTicks; i += 1) {
  const me = state.countries[player]!;
  if (me.science.activeResearch === null) {
    const next = scenario.techTree
      .filter((t) => !me.science.completedTechs.includes(t.id) && t.prereqs.every((p) => me.science.completedTechs.includes(p)))
      .sort((a, b) => (a.branch === 'space' ? 0 : 1) - (b.branch === 'space' ? 0 : 1) || a.cost - b.cost)[0];
    if (next) state = applyAction(state, { type: 'startResearch', techId: next.id }, player, scenario.techTree).state;
  }
  for (const def of [...COSMOS_PROJECTS].sort((a, b) => a.cost - b.cost)) {
    const st = getProjectStatus(state, def, scenario.techTree);
    if (st.status === 'available' && st.affordable && st.slotFree) {
      state = applyAction(state, { type: 'startProject', projectId: def.id }, player, scenario.techTree).state;
    }
  }
  state = tick(state, ctx);
  const done = state.cosmos!.completed.length;
  if (done !== lastDone) {
    lastDone = done;
    const rivalBest = Math.max(...Object.values(state.cosmos!.rivals).map((r) => r.completed.length));
    const firsts = Object.values(state.cosmos!.firsts).filter((c) => c === player).length;
    console.log(
      `y${((state.tick - start) / 52).toFixed(1).padStart(5)} ${state.cosmos!.completed.at(-1)!.padEnd(22)} K=${state.cosmos!.kardashev.toFixed(3)} done=${done} rivalBest=${rivalBest} myFirsts=${firsts}`,
    );
  }
  if (state.winLoss !== 'playing') { console.log('ended', state.winLoss, 'at', state.tick - start); break; }
  if (done === COSMOS_PROJECTS.length) break;
}
console.log('final K', state.cosmos!.kardashev.toFixed(3), 'ticks', state.tick - start);

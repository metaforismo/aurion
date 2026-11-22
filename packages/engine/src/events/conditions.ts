// Condition triggers for events — a tiny expression language scenario
// authors already use in their data:
//
//   popularity < 45
//   worldTension > 50
//   treasury < 5 and weeklyIncome < 0.1
//   factions.populist.satisfaction < 40
//   completedTechs contains tech_space_orbital_station
//
// Terms are joined by `and` / `or` (no parentheses; `and` binds tighter).
// Everything is read about the player. Two terms are normalised so one
// expression works for a micro-state and a superpower alike:
//   treasury      → weeks of income in the bank
//   weeklyIncome  → weekly income as a percentage of GDP
// An expression that cannot be parsed never triggers.

import type { Country, GameState } from '../types.js';

function readTerm(name: string, state: GameState, player: Country): number | undefined {
  switch (name) {
    case 'worldTension':
      return state.worldTension;
    case 'popularity':
      return player.politics.popularity;
    case 'treasury': {
      const income = player.economy.weeklyIncome;
      const week = income > 0 ? income : Math.max(1, player.economy.gdp * 0.005);
      return player.economy.treasury / week;
    }
    case 'weeklyIncome':
      return player.economy.gdp > 0 ? (player.economy.weeklyIncome / player.economy.gdp) * 100 : 0;
    case 'gdp':
      return player.economy.gdp;
    case 'taxRate':
      return player.economy.taxRate;
    case 'armySize':
      return player.military.armySize;
    case 'spyCount':
      return player.intelligence.spyCount;
    case 'kardashev':
      return state.cosmos?.kardashev;
    case 'megaprojects':
      return state.cosmos?.completed.length ?? 0;
    case 'techs':
      return player.science.completedTechs.length;
    default: {
      const faction = /^factions\.(\w+)\.(satisfaction|influence)$/.exec(name);
      if (faction) {
        const f = player.politics.factions[faction[1] as keyof typeof player.politics.factions];
        return f ? f[faction[2] as 'satisfaction' | 'influence'] : undefined;
      }
      return undefined;
    }
  }
}

function evalAtom(atom: string, state: GameState, player: Country): boolean {
  const contains = /^(\w+)\s+contains\s+([\w-]+)$/.exec(atom);
  if (contains) {
    if (contains[1] === 'completedTechs') return player.science.completedTechs.includes(contains[2]!);
    if (contains[1] === 'megaprojects') return state.cosmos?.completed.includes(contains[2]!) ?? false;
    return false;
  }
  const cmp = /^([\w.]+)\s*(<=|>=|<|>|==)\s*(-?\d+(?:\.\d+)?)$/.exec(atom);
  if (!cmp) return false;
  const left = readTerm(cmp[1]!, state, player);
  if (left === undefined) return false;
  const right = Number(cmp[3]);
  switch (cmp[2]) {
    case '<':
      return left < right;
    case '>':
      return left > right;
    case '<=':
      return left <= right;
    case '>=':
      return left >= right;
    default:
      return left === right;
  }
}

/** Evaluate a trigger expression against the player's situation. */
export function evaluateCondition(expression: string, state: GameState): boolean {
  const player = state.countries[state.playerCountryId];
  if (!player) return false;
  return expression
    .split(/\s+or\s+/i)
    .some((clause) =>
      clause
        .split(/\s+and\s+/i)
        .every((atom) => evalAtom(atom.trim(), state, player)),
    );
}

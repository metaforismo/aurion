// What signing peace would mean right now, in the player's terms: the engine
// sets the conditions from the war score, this picks the sentence.

import { peaceTerms, warBetween, warScoreFor, type Country, type PeaceTerms } from '@aurion/engine';

import { cash, type World } from './world';

export type PeaceOutlook = {
  terms: PeaceTerms;
  /** War score from the player's side, -100..+100. */
  score: number;
  /** 'draw', or who wins and how hard. */
  stance: 'white' | 'winReparations' | 'winCapitulation' | 'loseReparations' | 'loseCapitulation';
  weeks: number;
  lossesOwn: number;
  lossesTheirs: number;
  /** Values for the `panelDiplomacy.peace.<stance>` messages. */
  values: Record<string, string>;
};

export function peaceOutlook(w: World, enemy: Country): PeaceOutlook {
  const me = w.player.id;
  const terms = peaceTerms(w.state, me, enemy.id);
  const war = warBetween(w.state, me, enemy.id);
  const won = terms.winner === me;
  const stance: PeaceOutlook['stance'] =
    terms.tier === 'white'
      ? 'white'
      : terms.tier === 'reparations'
        ? won ? 'winReparations' : 'loseReparations'
        : won ? 'winCapitulation' : 'loseCapitulation';
  const mineIsA = war?.a === me;
  return {
    terms,
    score: warScoreFor(w.state, me, enemy.id),
    stance,
    weeks: war ? w.state.tick - war.startedAtTick : 0,
    lossesOwn: war ? (mineIsA ? war.lossesA : war.lossesB) : 0,
    lossesTheirs: war ? (mineIsA ? war.lossesB : war.lossesA) : 0,
    values: {
      name: w.nameOf(enemy.id),
      amount: cash(terms.reparations, w.locale),
      gdp: cash(terms.gdpTransfer, w.locale),
    },
  };
}

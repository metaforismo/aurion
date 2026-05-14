// Reducer for the 'diplomacy' action.

import type {
  Action,
  ApplyActionResult,
  CountryId,
  DiplomacyKind,
  GameState,
  Relation,
  TreatyKind,
} from '../types.js';
import { clamp, ensureRelation, withRelation } from './helpers.js';

export type DiplomacyAction = Extract<Action, { type: 'diplomacy' }>;

function withTreaty(treaties: TreatyKind[], add: TreatyKind): TreatyKind[] {
  return treaties.includes(add) ? treaties : [...treaties, add];
}
function withoutTreaty(treaties: TreatyKind[], remove: TreatyKind): TreatyKind[] {
  return treaties.filter((t) => t !== remove);
}

export function isDiplomacyAllowed(
  relation: Relation,
  kind: DiplomacyKind,
): { ok: true } | { ok: false; reason: string } {
  switch (kind) {
    case 'proposeAlliance':
      if (relation.atWar) return { ok: false, reason: 'errors.diplomacy.atWar' };
      if (relation.treaties.includes('alliance'))
        return { ok: false, reason: 'errors.diplomacy.alreadyAllied' };
      if (relation.attitude < 0)
        return { ok: false, reason: 'errors.diplomacy.attitudeTooLow' };
      return { ok: true };
    case 'breakAlliance':
      if (!relation.treaties.includes('alliance'))
        return { ok: false, reason: 'errors.diplomacy.noAlliance' };
      return { ok: true };
    case 'imposeSanction':
      if (relation.treaties.includes('sanctions'))
        return { ok: false, reason: 'errors.diplomacy.alreadySanctioned' };
      return { ok: true };
    case 'liftSanction':
      if (!relation.treaties.includes('sanctions'))
        return { ok: false, reason: 'errors.diplomacy.notSanctioned' };
      return { ok: true };
    case 'tradeDeal':
      if (relation.atWar) return { ok: false, reason: 'errors.diplomacy.atWar' };
      if (relation.treaties.includes('tradeDeal'))
        return { ok: false, reason: 'errors.diplomacy.alreadyTrading' };
      return { ok: true };
    case 'declareWar':
      if (relation.atWar) return { ok: false, reason: 'errors.diplomacy.alreadyAtWar' };
      return { ok: true };
    case 'sueForPeace':
      if (!relation.atWar) return { ok: false, reason: 'errors.diplomacy.notAtWar' };
      return { ok: true };
  }
}

export function applyDiplomacy(
  state: GameState,
  action: DiplomacyAction,
  countryId: CountryId,
): ApplyActionResult {
  const errors: string[] = [];
  if (action.target === countryId) {
    errors.push('errors.diplomacy.selfTarget');
    return { state, errors };
  }
  if (!state.countries[action.target]) {
    errors.push('errors.country.notFound');
    return { state, errors };
  }
  const ensured = ensureRelation(state, countryId, action.target);
  const stateWithRel = ensured.state;
  const relation = ensured.relation;
  const allowed = isDiplomacyAllowed(relation, action.kind);
  if (!allowed.ok) {
    return { state, errors: [allowed.reason] };
  }

  let next: Relation = relation;
  switch (action.kind) {
    case 'proposeAlliance':
      next = {
        ...relation,
        treaties: withTreaty(relation.treaties, 'alliance'),
        attitude: clamp(relation.attitude + 20, -100, 100),
      };
      break;
    case 'breakAlliance':
      next = {
        ...relation,
        treaties: withoutTreaty(relation.treaties, 'alliance'),
        attitude: clamp(relation.attitude - 30, -100, 100),
      };
      break;
    case 'imposeSanction':
      next = {
        ...relation,
        treaties: withTreaty(relation.treaties, 'sanctions'),
        attitude: clamp(relation.attitude - 25, -100, 100),
      };
      break;
    case 'liftSanction':
      next = {
        ...relation,
        treaties: withoutTreaty(relation.treaties, 'sanctions'),
        attitude: clamp(relation.attitude + 10, -100, 100),
      };
      break;
    case 'tradeDeal':
      next = {
        ...relation,
        treaties: withTreaty(relation.treaties, 'tradeDeal'),
        attitude: clamp(relation.attitude + 10, -100, 100),
      };
      break;
    case 'declareWar':
      next = {
        ...relation,
        atWar: true,
        treaties: withoutTreaty(
          withoutTreaty(relation.treaties, 'alliance'),
          'tradeDeal',
        ),
        attitude: clamp(relation.attitude - 50, -100, 100),
      };
      break;
    case 'sueForPeace':
      next = {
        ...relation,
        atWar: false,
        attitude: clamp(relation.attitude + 15, -100, 100),
      };
      break;
  }

  return { state: withRelation(stateWithRel, next), errors: [] };
}

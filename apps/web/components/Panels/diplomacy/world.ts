'use client';

// Shared read-model for the four "foreign affairs" panels (Diplomacy,
// Military, Intelligence, UN): who the player is, how every other country
// stands toward them, which country is the current target, and one way to
// commit an action and report its outcome.
//
// The target is the country selected on the globe, so a click on the map and
// a click in a panel always mean the same thing.

import { applyAction as engineApplyAction } from '@aurion/engine';
import type {
  Action,
  Country,
  CountryId,
  GameState,
  IntelLevel,
  RegionId,
  Relation,
  RelationKey,
  Scenario,
} from '@aurion/engine';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';

import { money } from '../../../lib/format';
import type { ScenarioId } from '../../../lib/scenarios';
import { selectPlayerCountry, useGameStore } from '../../../lib/store';
import { useSfx, type SfxId } from '../../Audio';
import type { Tone } from '../../ui';
import { useScenarioMessages } from '../shared/useScenarioMessages';

export function relationKey(a: CountryId, b: CountryId): RelationKey {
  return (a < b ? `${a}::${b}` : `${b}::${a}`) as RelationKey;
}

/** The relation between two countries; a neutral one when none is recorded yet. */
export function relationOf(state: GameState, a: CountryId, b: CountryId): Relation {
  return (
    state.relations[relationKey(a, b)] ?? {
      countryA: a < b ? a : b,
      countryB: a < b ? b : a,
      attitude: 0,
      treaties: [],
      atWar: false,
    }
  );
}

/** One-word summary of a relation, most consequential fact first. */
export type Stance = 'war' | 'ally' | 'sanctions' | 'trade' | 'pact' | 'neutral';

export function stanceOf(rel: Relation): Stance {
  if (rel.atWar) return 'war';
  if (rel.treaties.includes('alliance')) return 'ally';
  if (rel.treaties.includes('sanctions')) return 'sanctions';
  if (rel.treaties.includes('tradeDeal')) return 'trade';
  if (rel.treaties.includes('nonAggression')) return 'pact';
  return 'neutral';
}

export const STANCE_TONE: Record<Stance, Tone> = {
  war: 'danger',
  ally: 'success',
  sanctions: 'warning',
  trade: 'info',
  pact: 'neutral',
  neutral: 'neutral',
};

export function attitudeTone(attitude: number): Tone {
  if (attitude >= 25) return 'success';
  if (attitude <= -25) return 'danger';
  return 'neutral';
}

/** "+12" / "−40" / "0" — attitudes are whole numbers on a −100..100 scale. */
export function formatAttitude(attitude: number): string {
  const n = Math.round(attitude);
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}

/** Money that never breaks between the symbol and the figure. */
export function cash(value: number, locale: string, digits = 1): string {
  return money(value, locale, digits).replace(/ /g, '\u00a0');
}

/**
 * Fighting strength as the engine resolves battles: units × (1 + doctrine).
 * Counts the home garrison and everything deployed abroad.
 */
export function combatPower(country: Country): number {
  const deployed = country.military.deployedUnits.reduce((sum, d) => sum + d.units, 0);
  return (country.military.armySize + deployed) * (1 + country.military.doctrineLevel);
}

/**
 * The country that owns a region for access purposes. Mirrors the engine's
 * `findHostCountry` (first country declared in the region) so the panel can
 * name whose permission a deployment needs.
 */
export function regionHost(state: GameState, regionId: RegionId): Country | null {
  for (const c of Object.values(state.countries)) {
    if (c.regionId === regionId) return c;
  }
  return null;
}

/** What the player may see of a rival: figures open up from `partial` intel. */
export function knowsFigures(level: IntelLevel): boolean {
  return level === 'partial' || level === 'full';
}

export type World = {
  state: GameState;
  scenario: Scenario | null;
  player: Country;
  /** Every country except the player's. */
  others: Country[];
  locale: string;
  nameOf: (id: CountryId) => string;
  regionName: (id: RegionId) => string;
  /** Scenario copy (tech names, bloc names, resolution texts); echoes the key when missing. */
  tScenario: (key: string | null | undefined) => string;
  relation: (id: CountryId) => Relation;
  intelOn: (id: CountryId) => IntelLevel;
  /** The country selected on the globe, when it is not the player's own. */
  target: Country | null;
  selectTarget: (id: CountryId | null) => void;
  /** Runs an action on a copy of the game: what would happen, without committing. */
  preview: (action: Action) => { state: GameState; errors: string[] };
};

export function useWorld(): World | null {
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const player = useGameStore(selectPlayerCountry);
  const selectedCountryId = useGameStore((s) => s.selectedCountryId);
  const selectCountry = useGameStore((s) => s.selectCountry);
  const locale = useLocale();
  const t = useTranslations();
  const { t: tScenario } = useScenarioMessages((scenario?.id as ScenarioId | undefined) ?? null);

  return useMemo(() => {
    if (!state || !player) return null;
    const others = Object.values(state.countries).filter((c) => c.id !== player.id);
    const selected = selectedCountryId ? state.countries[selectedCountryId] : undefined;
    return {
      state,
      scenario,
      player,
      others,
      locale,
      nameOf: (id) => {
        const c = state.countries[id];
        if (!c) return id;
        const name = tScenario(c.nameKey);
        return name === c.nameKey ? id : name;
      },
      regionName: (id) => (t.has(`map.regions.${id}`) ? t(`map.regions.${id}`) : id),
      tScenario,
      relation: (id) => relationOf(state, player.id, id),
      intelOn: (id) => player.intelligence.knownIntel[id] ?? 'none',
      target: selected && selected.id !== player.id ? selected : null,
      selectTarget: selectCountry,
      preview: (action) => engineApplyAction(state, action, player.id, scenario?.techTree ?? []),
    };
    // `tScenario` changes identity when the scenario bundle finishes loading.
  }, [state, scenario, player, selectedCountryId, selectCountry, locale, t, tScenario]);
}

const ERROR_HOME: Record<string, string> = {
  diplomacy: 'panelDiplomacy.error',
  bloc: 'panelDiplomacy.error.bloc',
  deploy: 'panelMilitary.error.deploy',
  nuclear: 'panelMilitary.error.nuclear',
  invest: 'panelMilitary.error.invest',
  spy: 'panelSpies.error',
  un: 'panelUN.error',
};

/** Turns an engine error key (`errors.diplomacy.atWar`) into a sentence. */
export function useEngineError(): (key: string) => string {
  const t = useTranslations();
  return useCallback(
    (key: string) => {
      const [, group, name] = key.split('.');
      const home = group ? ERROR_HOME[group] : undefined;
      if (home && name && t.has(`${home}.${name}`)) return t(`${home}.${name}`);
      if (t.has(key)) return t(key);
      return t('errors.unknown');
    },
    [t],
  );
}

/**
 * Commit an action. Resolves to `true` when the engine accepted it; on a
 * rejection the translated reasons go to the panel's error banner.
 */
export function useCommit(
  onErrors?: (errors: string[]) => void,
): (action: Action, sound?: SfxId) => Promise<boolean> {
  const applyAction = useGameStore((s) => s.applyAction);
  const translate = useEngineError();
  const sfx = useSfx();
  return useCallback(
    async (action, sound = 'sfx.confirm') => {
      const errors = await applyAction(action);
      if (errors.length > 0) {
        sfx('sfx.error');
        onErrors?.(errors.map(translate));
        return false;
      }
      sfx(sound);
      return true;
    },
    [applyAction, onErrors, translate, sfx],
  );
}

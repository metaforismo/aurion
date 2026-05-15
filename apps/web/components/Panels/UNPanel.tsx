// United Nations system panel (Phase 3 — System 2).
//
// Three sections:
//   - Active resolutions: every resolution with status === 'voting'.
//   - History: last ~10 resolved resolutions (passed / failed / vetoed),
//     collapsed by default to keep the rail tidy.
//   - Propose form: rendered only when the player country sits on the
//     scenario's `unCouncilMembers` list.
//
// All visible strings go through `useTranslations`. Engine errors surface
// through the standard panel `onErrors` callback so the play-screen toast
// stack picks them up.

'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type {
  CountryId,
  RegionId,
  UNResolution,
  UNResolutionKind,
  UNVote,
} from '@aurion/engine';

import {
  selectPlayerCountry,
  useGameStore,
  type GameStoreState,
} from '../../lib/store';
import { ScenarioId } from '../../lib/scenarios';
import { EmptyState } from './shared/EmptyState';
import { Section } from './shared/Section';
import { useScenarioMessages } from './shared/useScenarioMessages';
import { UNProposeForm } from './UNProposeForm';
import { UNResolutionCard } from './UNResolutionCard';

const HISTORY_CAP = 10;

export function UNPanel({
  onErrors,
}: {
  onErrors?: (errors: string[]) => void;
}) {
  const t = useTranslations('panelUN');
  const tShared = useTranslations('panelShared');
  const tMap = useTranslations('map.regions');

  const state = useGameStore((s: GameStoreState) => s.state);
  const scenario = useGameStore((s: GameStoreState) => s.scenario);
  const player = useGameStore(selectPlayerCountry);
  const applyAction = useGameStore((s: GameStoreState) => s.applyAction);
  const confirm = useGameStore((s: GameStoreState) => s.confirm);

  const scenarioId = (scenario?.id ?? null) as ScenarioId | null;
  const { t: tScenario } = useScenarioMessages(scenarioId);

  // Council membership: empty array if the scenario doesn't enable ONU.
  const councilMembers = useMemo<readonly CountryId[]>(
    () => scenario?.unCouncilMembers ?? [],
    [scenario],
  );
  const onuAvailable = councilMembers.length > 0;
  const playerIsCouncil = !!player && councilMembers.includes(player.id);

  // Distinct regions across the scenario — used by the propose form for the
  // "peacekeeping" target dropdown. Cheap to recompute, but memoised so the
  // form's state doesn't flip just because the parent re-rendered.
  const regions = useMemo<readonly RegionId[]>(() => {
    if (!state) return [];
    const set = new Set<RegionId>();
    for (const c of Object.values(state.countries)) set.add(c.regionId);
    return Array.from(set);
  }, [state]);

  // Country options for "sanctions / condemnation / recognition" — every
  // country except the player. Sorted by translated name for readability.
  const countryOptions = useMemo(() => {
    if (!state || !player) return [];
    const out = Object.values(state.countries)
      .filter((c) => c.id !== player.id)
      .map((c) => ({ id: c.id, nameKey: c.nameKey }));
    out.sort((a, b) => tScenario(a.nameKey).localeCompare(tScenario(b.nameKey)));
    return out;
  }, [state, player, tScenario]);

  // Active vs historical buckets — defensive against missing field.
  const { active, history } = useMemo(() => {
    const all: UNResolution[] = state?.unResolutions ?? [];
    const a: UNResolution[] = [];
    const h: UNResolution[] = [];
    for (const r of all) {
      if (r.status === 'voting') a.push(r);
      else h.push(r);
    }
    // History: most recent first, cap at HISTORY_CAP.
    h.sort((x, y) => y.votingClosesAtTick - x.votingClosesAtTick);
    return { active: a, history: h.slice(0, HISTORY_CAP) };
  }, [state]);

  // ---------- early returns ----------

  if (!player || !state) {
    return (
      <div className="p-4">
        <EmptyState>{tShared('noPlayer')}</EmptyState>
      </div>
    );
  }

  // ---------- helpers ----------

  const countryName = (id: CountryId): string => {
    const c = state.countries[id];
    return c ? tScenario(c.nameKey) : id;
  };

  const regionName = (id: string): string => {
    // The map.regions bundle owns curated translations for the canonical region
    // ids — when one isn't found we fall back to the raw id rather than throw.
    try {
      return tMap(id);
    } catch {
      return id;
    }
  };

  const handleVote = async (
    resolutionId: string,
    vote: UNVote,
  ): Promise<string[]> => {
    return applyAction({ type: 'voteUN', resolutionId, vote });
  };

  const handleVeto = (resolutionId: string) => {
    confirm({
      titleKey: 'panelUN.confirm.veto.title',
      descriptionKey: 'panelUN.confirm.veto.description',
      confirmKey: 'panelUN.vote.veto',
      cancelKey: 'common.cancel',
      tone: 'danger',
      onConfirm: async () => {
        const errors = await applyAction({
          type: 'voteUN',
          resolutionId,
          vote: 'veto',
        });
        if (errors.length > 0) onErrors?.(errors);
      },
    });
  };

  const handlePropose = async (args: {
    kind: UNResolutionKind;
    targetCountryId?: CountryId;
    targetRegionId?: RegionId;
  }): Promise<string[]> => {
    return applyAction({ type: 'proposeUNResolution', ...args });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header strip */}
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-fg">
          {t('title')}
        </h2>
        <span
          className={
            playerIsCouncil
              ? 'rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-mono uppercase text-success'
              : 'rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-mono uppercase text-fg-faint'
          }
        >
          {playerIsCouncil ? t('councilMember') : t('notCouncilMember')}
        </span>
      </header>

      {/* Active resolutions */}
      <Section title={t('active')} trailing={`${active.length}`}>
        {!onuAvailable ? (
          <EmptyState>{t('unavailable')}</EmptyState>
        ) : active.length === 0 ? (
          <EmptyState>{t('empty')}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((r) => (
              <li key={r.id}>
                <UNResolutionCard
                  resolution={r}
                  currentTick={state.tick}
                  playerCountryId={player.id}
                  councilMemberIds={councilMembers}
                  countryName={countryName}
                  regionName={regionName}
                  onErrors={onErrors}
                  onVote={handleVote}
                  onVeto={playerIsCouncil ? handleVeto : undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* History */}
      <Section
        title={t('history')}
        trailing={`${history.length}`}
        defaultOpen={false}
      >
        {history.length === 0 ? (
          <EmptyState>{t('historyEmpty')}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((r) => (
              <li key={r.id}>
                <UNResolutionCard
                  resolution={r}
                  currentTick={state.tick}
                  playerCountryId={player.id}
                  councilMemberIds={councilMembers}
                  countryName={countryName}
                  regionName={regionName}
                  onErrors={onErrors}
                  onVote={handleVote}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Propose */}
      <Section title={t('propose.title')} defaultOpen={false}>
        {!onuAvailable ? (
          <EmptyState>{t('unavailable')}</EmptyState>
        ) : !playerIsCouncil ? (
          <EmptyState>{t('propose.notCouncil')}</EmptyState>
        ) : (
          <UNProposeForm
            countries={countryOptions}
            regions={regions}
            countryName={countryName}
            regionName={regionName}
            onSubmit={handlePropose}
            onErrors={onErrors}
          />
        )}
      </Section>
    </div>
  );
}

export default UNPanel;

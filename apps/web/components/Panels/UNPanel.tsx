// United Nations system panel (Phase 3 — System 2).
//
// Progressive-disclosure layout:
//   - PanelHero: active resolutions count + "Council member: Yes/No" pill,
//     proposed-count quick-stat when the player is on the council.
//   - Primary action: sticky "Propose resolution" footer (humanitarian, no
//     target needed) — disabled with a tooltip when the player isn't on
//     the council.
//   - Collapsed: full active list, history, and the rich propose form. All
//     live inside a single <Disclosure> so the rail isn't a wall of cards.
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
import { ActionButton } from './shared/ActionButton';
import { Disclosure } from './shared/Disclosure';
import { EmptyState } from './shared/EmptyState';
import { PanelHero } from './shared/PanelHero';
import { StickyFooter } from './shared/StickyFooter';
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
  const pushActionToast = useGameStore(
    (s: GameStoreState) => s.pushActionToast,
  );
  const tNotifications = useTranslations('notifications');

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
  const { active, history, proposedByMe } = useMemo(() => {
    const all: UNResolution[] = state?.unResolutions ?? [];
    const a: UNResolution[] = [];
    const h: UNResolution[] = [];
    let proposed = 0;
    for (const r of all) {
      if (r.status === 'voting') a.push(r);
      else h.push(r);
      if (player && r.proposerCountryId === player.id) proposed += 1;
    }
    // History: most recent first, cap at HISTORY_CAP.
    h.sort((x, y) => y.votingClosesAtTick - x.votingClosesAtTick);
    return { active: a, history: h.slice(0, HISTORY_CAP), proposedByMe: proposed };
  }, [state, player]);

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
    const errors = await applyAction({ type: 'proposeUNResolution', ...args });
    if (errors.length === 0) {
      pushActionToast({ message: tNotifications('un.proposeSuccess') });
    }
    return errors;
  };

  // Count of yes/no votes the player has cast in history (a rough "votes won"
  // proxy: passed resolutions the player voted yes on, plus failed ones the
  // player voted no on). We surface only the count, not the breakdown, to
  // keep the hero quick-stat minimal.
  const votesWon = history.reduce((acc, r) => {
    const myVote = r.votes?.[player.id];
    if (!myVote) return acc;
    if (r.status === 'passed' && myVote === 'yes') return acc + 1;
    if ((r.status === 'failed' || r.status === 'vetoed') && myVote === 'no') {
      return acc + 1;
    }
    return acc;
  }, 0);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Hero — active resolutions count + council membership pill. */}
      <PanelHero
        title={t('title')}
        value={active.length}
        valueTone={active.length > 0 ? 'info' : 'muted'}
        quickStats={[
          {
            label: t('councilMember'),
            value: playerIsCouncil ? t('councilYes') : t('councilNo'),
          },
          { label: t('heroVotesWon'), value: votesWon },
          { label: t('heroProposed'), value: proposedByMe },
        ]}
      />

      {/* Collapsed details — active list, history, propose form. */}
      <Disclosure summary={tShared('moreDetails')} trailing={t('details')}>
        {/* Active resolutions */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
              {t('active')}
            </div>
            <span className="text-[11px] font-mono text-fg-faint">
              {active.length}
            </span>
          </div>
          {!onuAvailable ? (
            <EmptyState>{t('unavailable')}</EmptyState>
          ) : active.length === 0 ? (
            <EmptyState>{t('empty')}</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {active.map((r) => (
                <li key={r.id}>
                  <UNResolutionCard
                    resolution={r}
                    currentTick={state.tick}
                    playerCountryId={player.id}
                    councilMemberIds={councilMembers}
                    countryName={countryName}
                    regionName={regionName}
                    tScenario={tScenario}
                    onErrors={onErrors}
                    onVote={handleVote}
                    onVeto={playerIsCouncil ? handleVeto : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* History (nested disclosure — even within "Più dettagli" the
            history is supplementary). */}
        <Disclosure
          summary={t('history')}
          trailing={`${history.length}`}
          className="border-t border-border"
        >
          {history.length === 0 ? (
            <EmptyState>{t('historyEmpty')}</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {history.map((r) => (
                <li key={r.id}>
                  <UNResolutionCard
                    resolution={r}
                    currentTick={state.tick}
                    playerCountryId={player.id}
                    councilMemberIds={councilMembers}
                    countryName={countryName}
                    regionName={regionName}
                    tScenario={tScenario}
                    onErrors={onErrors}
                    onVote={handleVote}
                  />
                </li>
              ))}
            </ul>
          )}
        </Disclosure>

        {/* Propose form (nested disclosure — closed by default; the sticky
            footer offers the one-tap humanitarian path). */}
        <Disclosure
          summary={t('propose.title')}
          className="border-t border-border"
        >
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
        </Disclosure>
      </Disclosure>

      {/* Sticky primary action — "Propose resolution" pinned at the bottom.
          Enabled only for council members (the spec scopes propose to the
          council); fires a humanitarian resolution (the only kind that
          requires no target), keeping the click a one-tap commitment. The
          dedicated propose form above remains the rich path. */}
      <StickyFooter
        hint={
          !onuAvailable
            ? tShared('stickyAction.unUnavailable')
            : !playerIsCouncil
              ? tShared('stickyAction.unNotCouncil')
              : null
        }
      >
        <ActionButton
          tone="primary"
          disabledReason={
            !onuAvailable
              ? t('unavailable')
              : !playerIsCouncil
                ? t('propose.notCouncil')
                : null
          }
          onClick={async () => handlePropose({ kind: 'humanitarian' })}
          onErrors={onErrors}
        >
          {t('propose.title')}
        </ActionButton>
      </StickyFooter>
    </div>
  );
}

export default UNPanel;

'use client';

// An unaligned country picked on the globe: whose it is, and — when it
// borders land the player holds — what making it a protectorate costs,
// takes and brings.

import {
  getTerritoryStatus,
  protectorateCost,
  protectorateDuration,
  protectorateGdpGain,
  type GameState,
  type Scenario,
} from '@aurion/engine';
import { Flag, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { money } from '../../lib/format';
import { territoryName } from '../../lib/geo/iso';
import { useGameStore } from '../../lib/store';
import { Button, IconButton, Stat } from '../ui';

export default function TerritoryCard({
  state,
  scenario,
  territoryId,
  nameOf,
  onClose,
}: {
  state: GameState;
  scenario: Scenario;
  territoryId: string;
  nameOf: (countryId: string) => string;
  onClose: () => void;
}) {
  const t = useTranslations('globe.territory');
  const locale = useLocale();
  const applyAction = useGameStore((s) => s.applyAction);
  const [busy, setBusy] = useState(false);

  const status = getTerritoryStatus(state, scenario, territoryId);
  if (!status) return null;
  const me = state.playerCountryId;
  const name = territoryName(territoryId, locale, status.def.name);
  const cost = protectorateCost(state, territoryId);
  const treasury = state.countries[me]?.economy.treasury ?? 0;
  const work = state.territoryWork ?? null;
  const blocked = work ? t('busy') : cost > treasury ? t('cannotAfford') : null;

  const claim = async () => {
    if (busy || blocked) return;
    setBusy(true);
    try {
      await applyAction({ type: 'claimTerritory', territoryId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={name}
      data-testid="territory-card"
      className="glass-panel pointer-events-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl p-3.5"
      style={{ animation: 'rise-in 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-fg">{name}</h3>
          <p className="text-[11px] text-fg-muted" data-testid="territory-card-status">
            {status.inProgress && work
              ? t('status.inProgress', { weeks: work.remainingTicks })
              : status.owner === me
                ? t('status.yours')
                : status.owner
                  ? t('status.rival', { name: nameOf(status.owner) })
                  : t('status.free')}
          </p>
        </div>
        <IconButton icon={X} label={t('close')} onClick={onClose} />
      </div>

      {status.owner === null && !status.inProgress ? (
        status.claimable ? (
          <>
            <dl className="mt-2.5 grid grid-cols-3 gap-3">
              <Stat size="sm" label={t('cost')} value={money(cost, locale)} />
              <Stat size="sm" label={t('time')} value={t('weeks', { n: protectorateDuration(territoryId) })} />
              <Stat size="sm" label={t('gain')} value={`+${money(protectorateGdpGain(state, territoryId), locale)}`} />
            </dl>
            <p className="mt-2 text-[11px] leading-snug text-fg-faint">{t('hint')}</p>
            <Button
              className="mt-2.5 w-full"
              variant="primary"
              icon={Flag}
              loading={busy}
              disabled={Boolean(blocked)}
              title={blocked ?? undefined}
              onClick={() => void claim()}
              data-testid="territory-card-claim"
            >
              {t('claim')}
            </Button>
            {blocked ? <p className="mt-1.5 text-[11px] leading-snug text-warning">{blocked}</p> : null}
          </>
        ) : (
          <p className="mt-2 text-[11px] leading-snug text-fg-faint">{t('notAdjacent')}</p>
        )
      ) : status.owner === me ? (
        <p className="mt-2 text-[11px] leading-snug text-fg-faint">{t('yoursHint')}</p>
      ) : status.owner ? (
        <p className="mt-2 text-[11px] leading-snug text-fg-faint">{t('rivalHint')}</p>
      ) : null}
    </section>
  );
}

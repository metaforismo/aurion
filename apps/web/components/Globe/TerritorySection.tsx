'use client';

// The land a colony holds: how much of the world is taken, the work under
// way, and what can be done with the sector the player has picked on the
// surface — claim it, or raise a structure on it.

import {
  HABITAT_HOUSING_SHARE,
  SECTOR_SLOTS,
  STRUCTURE_KINDS,
  STRUCTURE_YIELD,
  buildCost,
  buildDuration,
  claimCost,
  claimDuration,
  colonyCapacity,
  colonySize,
  getSectorStatus,
  territoryBusy,
  type ColonyBody,
  type GameState,
  type SectorStatus,
  type StructureKind,
} from '@aurion/engine';
import { Factory, FlaskConical, Flag, Hammer, Home, Pickaxe, type LucideIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { compactNumber, money } from '../../lib/format';
import { useGameStore } from '../../lib/store';
import { Button } from '../ui';

export const STRUCTURE_ICON: Record<StructureKind, LucideIcon> = {
  habitat: Home,
  lab: FlaskConical,
  mine: Pickaxe,
  foundry: Factory,
};

export default function TerritorySection({
  state,
  body,
  population,
  selected,
  nameOf,
}: {
  state: GameState;
  body: ColonyBody;
  population: number;
  /** The sector picked on the surface, if any. */
  selected: string | null;
  nameOf: (countryId: string) => string;
}) {
  const t = useTranslations('cosmos.territory');
  const locale = useLocale();
  const applyAction = useGameStore((s) => s.applyAction);
  const [busy, setBusy] = useState(false);

  const sectors = getSectorStatus(state, body);
  const me = state.playerCountryId;
  const mine = sectors.filter((s) => s.owner === me).length;
  const rivals = sectors.filter((s) => s.owner && s.owner !== me).length;
  const work = (state.cosmos?.works ?? []).find((w) => w.body === body) ?? null;
  const working = territoryBusy(state, body);
  const treasury = state.countries[me]?.economy.treasury ?? 0;
  const unit = state.cosmos?.unit ?? 0;
  const size = colonySize(population);
  const sector: SectorStatus | null = sectors.find((s) => s.def.id === selected) ?? null;

  const run = async (action: Parameters<typeof applyAction>[0]) => {
    if (busy) return;
    setBusy(true);
    try {
      await applyAction(action);
    } finally {
      setBusy(false);
    }
  };

  const number = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(n);
  /** What one more structure of a kind adds at today's population. */
  const gain = (kind: StructureKind): string => {
    switch (kind) {
      case 'habitat':
        return t('gain.habitat', {
          n: compactNumber(colonyCapacity(state.cosmos?.completed ?? [], body) * HABITAT_HOUSING_SHARE, locale),
        });
      case 'lab':
        return t('gain.lab', { v: number(size * STRUCTURE_YIELD.lab) });
      case 'mine':
        return t('gain.mine', { v: money(size * STRUCTURE_YIELD.mine * unit, locale) });
      case 'foundry':
        return t('gain.foundry', { v: number(size * STRUCTURE_YIELD.foundry * 100) });
    }
  };

  return (
    <div data-testid={`territory-${body}`} className="flex flex-col gap-2">
      <p className="numeric-tabular font-mono text-[11px] text-fg-muted">
        {t('summary', { mine, rivals, free: sectors.length - mine - rivals })}
      </p>

      {work ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-[#5cc8ff]/30 bg-[#5cc8ff]/10 px-2.5 py-1.5 text-[11px] text-fg">
          <Hammer aria-hidden className="h-3.5 w-3.5 shrink-0 text-[#8ad8ff]" />
          <span>
            {work.kind === 'claim'
              ? t('work.claim', {
                  sector: sectors.find((s) => s.def.id === work.sectorId)?.def.name ?? '',
                  weeks: work.remainingTicks,
                })
              : t('work.build', {
                  structure: t(`structure.${work.structure ?? 'habitat'}`),
                  sector: sectors.find((s) => s.def.id === work.sectorId)?.def.name ?? '',
                  weeks: work.remainingTicks,
                })}
          </span>
        </p>
      ) : null}

      {!sector ? (
        <p className="text-[11px] leading-snug text-fg-faint">{t('pick')}</p>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5" data-testid="territory-sector">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-[13px] font-semibold text-fg">{sector.def.name}</h4>
            <span className="text-[11px] text-fg-muted">
              {sector.owner === me
                ? t('owner.you')
                : sector.owner
                  ? t('owner.rival', { name: nameOf(sector.owner) })
                  : t('owner.free')}
            </span>
          </div>

          {sector.owner === me ? (
            <>
              <ul className="flex flex-wrap gap-1.5" aria-label={t('structures')}>
                {Array.from({ length: SECTOR_SLOTS }, (_, i) => {
                  const kind = sector.structures[i];
                  const Icon = kind ? STRUCTURE_ICON[kind] : null;
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-fg-muted"
                    >
                      {Icon ? <Icon aria-hidden className="h-3.5 w-3.5 text-accent" /> : null}
                      {kind ? t(`structure.${kind}`) : t('emptySlot')}
                    </li>
                  );
                })}
              </ul>
              {sector.structures.length < SECTOR_SLOTS ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {STRUCTURE_KINDS.map((kind) => {
                    const Icon = STRUCTURE_ICON[kind];
                    const cost = buildCost(state, body, kind);
                    const blocked = working || cost > treasury;
                    return (
                      <button
                        key={kind}
                        type="button"
                        disabled={blocked || busy}
                        data-testid={`territory-build-${kind}`}
                        title={working ? t('busy') : cost > treasury ? t('cannotAfford') : undefined}
                        onClick={() =>
                          void run({ type: 'buildStructure', body, sectorId: sector.def.id, structure: kind })
                        }
                        className="flex min-w-0 items-start gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-left transition-colors hover:border-white/25 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/[0.08] disabled:hover:bg-white/[0.03]"
                      >
                        <Icon aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-muted" />
                        <span className="min-w-0">
                          <span className="block text-[12px] font-medium text-fg">{t(`structure.${kind}`)}</span>
                          <span className="block text-[11px] leading-snug text-fg-muted">{gain(kind)}</span>
                          <span className="numeric-tabular block font-mono text-[11px] text-fg-faint">
                            {t('price', { cost: money(cost, locale), weeks: buildDuration(body) })}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] leading-snug text-fg-faint">{t('full')}</p>
              )}
            </>
          ) : sector.owner ? (
            <p className="text-[11px] leading-snug text-fg-faint">{t('taken')}</p>
          ) : sector.work ? null : sector.claimable ? (
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 text-[11px] leading-snug text-fg-muted">{t('claimHint')}</p>
              <Button
                size="sm"
                variant="primary"
                icon={Flag}
                loading={busy}
                disabled={working || claimCost(state, body) > treasury}
                title={working ? t('busy') : claimCost(state, body) > treasury ? t('cannotAfford') : undefined}
                onClick={() => void run({ type: 'claimSector', body, sectorId: sector.def.id })}
                data-testid="territory-claim"
              >
                {t('claim', { cost: money(claimCost(state, body), locale), weeks: claimDuration(body) })}
              </Button>
            </div>
          ) : (
            <p className="text-[11px] leading-snug text-fg-faint">{t('notAdjacent')}</p>
          )}
        </div>
      )}
    </div>
  );
}

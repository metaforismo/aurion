'use client';

// One card per war: who, how the two forces compare, where they are in
// contact, whether the capital is at risk, and the two ways forward — send
// troops or make peace.

import type { Country, RegionId } from '@aurion/engine';
import { AlertTriangle, HeartHandshake, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { compactNumber, percent } from '../../../lib/format';
import { useGameStore } from '../../../lib/store';
import { Button, Card } from '../../ui';
import { AttitudeValue, CountryDot } from '../diplomacy/parts';
import { combatPower, knowsFigures, useCommit, type World } from '../diplomacy/world';

import { approx, unitsIn } from './forces';

/** Weeks of occupied capital after which the game is lost (engine: LOSS_CAPITAL_OCCUPIED_WEEKS). */
const CAPITAL_LOSS_WEEKS = 26;

export function Fronts({
  w,
  enemies,
  onErrors,
  onDeployTo,
}: {
  w: World;
  enemies: Country[];
  onErrors?: (errors: string[]) => void;
  onDeployTo: (regionId: RegionId) => void;
}) {
  const t = useTranslations('panelMilitary.wars');
  const confirm = useGameStore((s) => s.confirm);
  const commit = useCommit(onErrors);

  const home = w.player.regionId;
  const defenders = w.player.military.armySize + unitsIn(w.player, home);
  const invaders = enemies.reduce((sum, c) => sum + unitsIn(c, home), 0);
  const occupiedWeeks = w.state._loseStreaks?.capitalOccupiedWeeks ?? 0;

  const peace = (enemy: Country) =>
    confirm({
      titleKey: 'panelDiplomacy.confirm.sueForPeace.title',
      descriptionKey: 'panelDiplomacy.confirm.sueForPeace.description',
      confirmKey: 'panelDiplomacy.action.sueForPeace',
      cancelKey: 'common.cancel',
      onConfirm: async () => {
        await commit({ type: 'diplomacy', target: enemy.id, kind: 'sueForPeace' }, 'sfx.treaty');
      },
    });

  return (
    <div className="flex flex-col gap-2">
      {invaders > 0 ? (
        <Card tone={invaders > defenders ? 'danger' : 'warning'} role="alert" className="flex items-start gap-2">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-[11px] leading-snug text-fg">
            {invaders > defenders
              ? t('capitalFallen', { weeks: occupiedWeeks, limit: CAPITAL_LOSS_WEEKS })
              : t('capitalThreat', {
                  enemy: compactNumber(invaders, w.locale),
                  own: compactNumber(defenders, w.locale),
                  limit: CAPITAL_LOSS_WEEKS,
                })}
          </p>
        </Card>
      ) : null}

      {enemies.map((enemy) => {
        const name = w.nameOf(enemy.id);
        const mine = combatPower(w.player);
        const theirs = combatPower(enemy);
        const exact = knowsFigures(w.intelOn(enemy.id));
        const share = mine + theirs > 0 ? mine / (mine + theirs) : 0.5;
        // Regions where both sides have troops fight every week.
        const contested = [...new Set(w.player.military.deployedUnits.map((d) => d.regionId))]
          .map((regionId) => ({ regionId, own: unitsIn(w.player, regionId), foe: unitsIn(enemy, regionId) }))
          .filter((c) => c.foe > 0);
        return (
          <Card key={enemy.id} tone="danger" data-testid={`military-front-${enemy.id}`} className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => w.selectTarget(enemy.id)}
                className="flex min-w-0 items-center gap-2 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <CountryDot color={enemy.color} />
                <span className="truncate text-[13px] font-semibold text-fg hover:underline">{name}</span>
              </button>
              <span className="text-[11px] text-fg-faint">
                {t('attitude')} <AttitudeValue attitude={w.relation(enemy.id).attitude} />
              </span>
            </div>

            <div>
              <div
                className="flex h-2 overflow-hidden rounded-full bg-white/10"
                role="img"
                aria-label={t('balanceLabel', { pct: percent(share, w.locale) })}
              >
                <span className="h-full bg-accent transition-[width] duration-500" style={{ width: `${share * 100}%` }} />
                <span className="h-full flex-1 bg-[#ff5d4d]/80" />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[11px]">
                <span className="text-accent">{t('you', { n: compactNumber(mine, w.locale) })}</span>
                <span className="text-[#ff8a7d]">
                  {t('them', { n: exact ? compactNumber(theirs, w.locale) : approx(theirs, w.locale) })}
                </span>
              </div>
            </div>

            {contested.length > 0 ? (
              <ul className="flex flex-col gap-1 border-t border-white/10 pt-2">
                {contested.map((c) => (
                  <li key={c.regionId} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1 text-fg-muted">
                      <MapPin aria-hidden className="h-3 w-3" />
                      {w.regionName(c.regionId)}
                    </span>
                    <span className="numeric-tabular font-mono text-fg">
                      {t('clash', { own: compactNumber(c.own, w.locale), foe: compactNumber(c.foe, w.locale) })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-white/10 pt-2 text-[11px] leading-snug text-fg-faint">{t('noContact')}</p>
            )}

            <div className="flex gap-2">
              <Button size="sm" icon={MapPin} className="flex-1" onClick={() => onDeployTo(enemy.regionId)}>
                {t('deployThere', { region: w.regionName(enemy.regionId) })}
              </Button>
              <Button size="sm" icon={HeartHandshake} onClick={() => peace(enemy)} data-testid={`military-peace-${enemy.id}`}>
                {t('peace')}
              </Button>
            </div>
          </Card>
        );
      })}
      <p className="text-[11px] leading-snug text-fg-faint">{t('howItEnds')}</p>
    </div>
  );
}

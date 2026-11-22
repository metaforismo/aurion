'use client';

// Military panel — what the player can put in the field, how that compares
// with everyone else, the wars under way, and the orders that move troops.
// The nuclear arsenal sits last, set apart, for scenarios that have one.

import { Shield, Swords } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { compactNumber, percent } from '../../lib/format';
import { useGameStore } from '../../lib/store';
import { Card, Chip, Meter, SectionTitle, Stat } from '../ui';

import { CountryPicker, type PickerItem } from './diplomacy/CountryPicker';
import { PanelLink, StanceChip, TargetHeader } from './diplomacy/parts';
import {
  cash,
  combatPower,
  knowsFigures,
  stanceOf,
  useWorld,
  type World,
} from './diplomacy/world';
import { DeployOrders, Deployments, Recruit } from './military/Deploy';
import { Fronts } from './military/Fronts';
import { NuclearArsenalSection } from './military/Nuclear';
import { approx, enemiesOf } from './military/forces';

export function MilitaryPanel({ onErrors }: { onErrors?: (errors: string[]) => void }) {
  const t = useTranslations('panelMilitary');
  const w = useWorld();
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  // A region chosen by hand wins over the one implied by the selected country,
  // but only until the selection changes.
  const [picked, setPicked] = useState<{ region: string; forTarget: string | null } | null>(null);

  const items = useMemo<PickerItem[]>(() => {
    if (!w) return [];
    const all = [w.player, ...w.others];
    const top = Math.max(1, ...all.map(combatPower));
    return all.map((c) => {
      const isPlayer = c.id === w.player.id;
      const power = combatPower(c);
      const exact = isPlayer || knowsFigures(w.intelOn(c.id));
      const stance = isPlayer ? null : stanceOf(w.relation(c.id));
      const name = isPlayer ? t('balance.you', { name: w.nameOf(c.id) }) : w.nameOf(c.id);
      return {
        id: c.id,
        name,
        color: isPlayer ? 'var(--color-accent)' : c.color,
        inert: isPlayer,
        subtitle: (
          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
            <span
              className={isPlayer ? 'block h-full rounded-full bg-accent' : stance === 'war' ? 'block h-full rounded-full bg-[#ff5d4d]' : 'block h-full rounded-full bg-white/50'}
              style={{ width: `${Math.max(2, (power / top) * 100)}%` }}
            />
          </span>
        ),
        trailing: (
          <span className="flex items-center gap-2">
            {stance === 'war' || stance === 'ally' ? <StanceChip stance={stance} /> : null}
            <span className="numeric-tabular w-14 text-right font-mono text-xs text-fg">
              {exact ? compactNumber(power, w.locale) : approx(power, w.locale)}
            </span>
          </span>
        ),
        sort: { power, name },
      };
    });
  }, [w, t]);

  if (!w) return null;

  const enemies = enemiesOf(w);
  const region =
    picked && picked.forTarget === (w.target?.id ?? null) ? picked.region : (w.target?.regionId ?? null);

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="military-panel">
      <Forces w={w} enemies={enemies.length} />

      <section aria-label={t('wars.title')} className="flex flex-col gap-2">
        <SectionTitle aside={enemies.length}>{t('wars.title')}</SectionTitle>
        {enemies.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 px-3 py-3 text-[11px] leading-relaxed text-fg-faint">
            <span className="font-medium text-fg-muted">{t('wars.emptyTitle')}.</span> {t('wars.empty')}{' '}
            <PanelLink onClick={() => setSelectedPanel('diplomacy')}>{t('wars.toDiplomacy')}</PanelLink>
          </p>
        ) : (
          <Fronts
            w={w}
            enemies={enemies}
            onErrors={onErrors}
            onDeployTo={(regionId) => {
              setPicked({ region: regionId, forTarget: w.target?.id ?? null });
              // The order form sits further down the drawer: bring it into view.
              const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              document
                .getElementById('military-deploy')
                ?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
            }}
          />
        )}
      </section>

      <section aria-label={t('balance.title')} className="flex flex-col gap-2">
        <SectionTitle aside={t('balance.aside')}>{t('balance.title')}</SectionTitle>
        {w.target ? <Matchup w={w} /> : null}
        <CountryPicker
          label={t('balance.title')}
          testIdPrefix="military-country"
          items={items}
          selectedId={w.target?.id ?? null}
          onPick={w.selectTarget}
          sorts={[
            { id: 'power', label: t('balance.sortPower') },
            { id: 'name', label: t('balance.sortName') },
          ]}
          limit={6}
        />
        <p className="text-[11px] leading-snug text-fg-faint">{t('balance.hint')}</p>
      </section>

      <DeployOrders
        w={w}
        region={region}
        onRegion={(regionId) => setPicked({ region: regionId, forTarget: w.target?.id ?? null })}
        onErrors={onErrors}
      />
      <Deployments w={w} />
      <Recruit w={w} onErrors={onErrors} />

      {w.player.nuclear ? <NuclearArsenalSection w={w} arsenal={w.player.nuclear} onErrors={onErrors} /> : null}
    </div>
  );
}

/** Hero: the garrison ready to move, then the rest of the armed forces. */
function Forces({ w, enemies }: { w: World; enemies: number }) {
  const t = useTranslations('panelMilitary');
  const m = w.player.military;
  const deployed = m.deployedUnits.reduce((sum, d) => sum + d.units, 0);
  const ranked = [w.player, ...w.others].sort((a, b) => combatPower(b) - combatPower(a));
  const rank = ranked.findIndex((c) => c.id === w.player.id) + 1;
  // The engine charges 50 per garrisoned unit, per war, every week.
  const upkeep = m.armySize * 50 * enemies;

  return (
    <section
      aria-label={t('hero.label')}
      className={
        enemies > 0
          ? 'rounded-xl border border-[#ff5d4d]/30 bg-gradient-to-br from-[#ff5d4d]/[0.10] via-transparent to-accent/[0.05] p-4'
          : 'rounded-xl border border-accent/25 bg-gradient-to-br from-accent/[0.09] via-transparent to-[#5cc8ff]/[0.05] p-4'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <Stat
          size="lg"
          label={t('hero.garrison')}
          value={compactNumber(m.armySize, w.locale)}
          hint={deployed > 0 ? t('hero.deployed', { n: compactNumber(deployed, w.locale) }) : t('hero.ready')}
        />
        {enemies > 0 ? (
          <Chip tone="danger" icon={Swords}>
            {t('hero.wars', { n: enemies })}
          </Chip>
        ) : (
          <Chip tone="success" icon={Shield}>
            {t('hero.atPeace')}
          </Chip>
        )}
      </div>

      <Meter
        className="mt-3"
        tone="info"
        value={m.doctrineLevel}
        label={t('hero.doctrine')}
        valueLabel={percent(m.doctrineLevel, w.locale)}
      />

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
        <Stat size="sm" label={t('hero.navy')} value={compactNumber(m.navy, w.locale)} />
        <Stat size="sm" label={t('hero.airforce')} value={compactNumber(m.airforce, w.locale)} />
        <Stat size="sm" label={t('hero.rank')} value={t('hero.rankValue', { rank, total: ranked.length })} tone="accent" />
      </dl>
      {upkeep > 0 ? (
        <p className="mt-2 text-[11px] leading-snug text-warning">
          {t('hero.upkeep', { cost: cash(upkeep, w.locale) })}
        </p>
      ) : null}
    </section>
  );
}

/** The selected country measured against the player. */
function Matchup({ w }: { w: World }) {
  const t = useTranslations('panelMilitary');
  const target = w.target;
  if (!target) return null;
  const mine = combatPower(w.player);
  const theirs = combatPower(target);
  const exact = knowsFigures(w.intelOn(target.id));
  const share = mine + theirs > 0 ? mine / (mine + theirs) : 0.5;
  const ratio = theirs > 0 ? mine / theirs : Infinity;
  const name = w.nameOf(target.id);
  const verdict =
    ratio >= 1.5 ? t('matchup.stronger', { name }) : ratio <= 0.67 ? t('matchup.weaker', { name }) : t('matchup.even', { name });

  return (
    <Card data-testid="military-matchup" className="flex flex-col gap-2.5">
      <TargetHeader
        name={name}
        color={target.color}
        aside={<StanceChip stance={stanceOf(w.relation(target.id))} />}
        caption={w.regionName(target.regionId)}
        onClear={() => w.selectTarget(null)}
      />
      <div>
        <div className="flex h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label={verdict}>
          <span className="h-full bg-accent transition-[width] duration-500" style={{ width: `${share * 100}%` }} />
          <span className="h-full flex-1 bg-white/40" />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[11px]">
          <span className="text-accent">{t('matchup.you', { n: compactNumber(mine, w.locale) })}</span>
          <span className="text-fg-muted">
            {t('matchup.them', { n: exact ? compactNumber(theirs, w.locale) : approx(theirs, w.locale) })}
          </span>
        </div>
      </div>
      <p className="text-[11px] leading-snug text-fg-muted">
        {verdict}
        {exact ? '' : ` ${t('matchup.estimate')}`}
      </p>
    </Card>
  );
}

export default MilitaryPanel;

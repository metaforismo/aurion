'use client';

// Orders that change the size or the position of the army: send units to a
// region, see where they stand, raise new ones.

import type { RegionId } from '@aurion/engine';
import { Coins, MapPin, Send, Swords } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { compactNumber, percent } from '../../../lib/format';
import { Button, Card, Chip, EmptyState, Row, SectionTitle, Segmented, Slider } from '../../ui';
import {
  cash,
  useCommit,
  type World,
} from '../diplomacy/world';

import { hostileUnitsIn, regionAccess, regionsOf, unitsIn } from './forces';

const SHARES = ['10', '25', '50', '100'] as const;
type Share = (typeof SHARES)[number];

export function DeployOrders({
  w,
  region,
  onRegion,
  onErrors,
}: {
  w: World;
  region: RegionId | null;
  onRegion: (regionId: RegionId) => void;
  onErrors?: (errors: string[]) => void;
}) {
  const t = useTranslations('panelMilitary.deploy');
  const commit = useCommit(onErrors);
  const [share, setShare] = useState<Share>('25');
  const [done, setDone] = useState('');

  const garrison = w.player.military.armySize;
  const units = Math.floor((garrison * Number(share)) / 100);
  const access = region ? regionAccess(w, region) : null;

  const blocked = !region
    ? t('pickRegion')
    : access && !access.ok
      ? t('noAccess', { name: w.nameOf(access.host.id) })
      : units < 1
        ? t('noUnits')
        : null;

  const send = async () => {
    if (!region || blocked) return;
    if (await commit({ type: 'deployArmy', target: region, units }, 'sfx.deploy')) {
      setDone(t('done', { n: compactNumber(units, w.locale), region: w.regionName(region) }));
    }
  };

  return (
    <section id="military-deploy" aria-label={t('title')} className="flex scroll-mt-4 flex-col gap-2">
      <SectionTitle>{t('title')}</SectionTitle>
      <p className="text-[11px] leading-snug text-fg-faint">{t('intro')}</p>

      <ul aria-label={t('regionLabel')} className="flex flex-col gap-1">
        {regionsOf(w).map((id) => {
          const a = regionAccess(w, id);
          const foes = hostileUnitsIn(w, id);
          const own = unitsIn(w.player, id);
          const how = a.ok
            ? a.via === 'home'
              ? t('access.home')
              : a.via === 'free'
                ? t('access.free')
                : t(`access.${a.via}`, { name: w.nameOf(a.host?.id ?? '') })
            : t('access.closed', { name: w.nameOf(a.host.id) });
          return (
            <li key={id}>
              <Row
                testId={`military-region-${id}`}
                leading={<MapPin aria-hidden className={a.ok ? 'h-4 w-4 text-fg-muted' : 'h-4 w-4 text-fg-faint'} />}
                title={w.regionName(id)}
                subtitle={how}
                selected={region === id}
                onClick={() => onRegion(id)}
                className={a.ok ? 'py-1.5' : 'py-1.5 opacity-70'}
                trailing={
                  <span className="flex items-center gap-1.5">
                    {id === w.player.regionId ? <Chip>{t('home')}</Chip> : null}
                    {own > 0 ? <Chip tone="accent">{compactNumber(own, w.locale)}</Chip> : null}
                    {foes > 0 ? (
                      <Chip tone="danger" icon={Swords}>
                        {compactNumber(foes, w.locale)}
                      </Chip>
                    ) : null}
                  </span>
                }
              />
            </li>
          );
        })}
      </ul>

      <Card className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-fg-muted">{t('howMany')}</span>
          <span className="numeric-tabular font-mono text-fg">
            {t('unitsOf', { n: compactNumber(units, w.locale), total: compactNumber(garrison, w.locale) })}
          </span>
        </div>
        <Segmented
          label={t('howMany')}
          value={share}
          onChange={setShare}
          options={SHARES.map((s) => ({ value: s, label: percent(Number(s) / 100, w.locale) }))}
          className="flex"
        />
        <Button
          variant="primary"
          block
          icon={Send}
          disabled={Boolean(blocked)}
          onClick={() => void send()}
          data-testid="military-deploy-submit"
        >
          {region && !blocked
            ? t('cta', { n: compactNumber(units, w.locale), region: w.regionName(region) })
            : t('ctaIdle')}
        </Button>
        {blocked ? <p className="text-[11px] leading-snug text-warning">{blocked}</p> : null}
        <p role="status" aria-live="polite" className="text-[11px] text-success empty:hidden">
          {done}
        </p>
      </Card>
    </section>
  );
}

export function Deployments({ w }: { w: World }) {
  const t = useTranslations('panelMilitary.deployed');
  const deployments = w.player.military.deployedUnits;
  return (
    <section aria-label={t('title')} className="flex flex-col gap-2">
      <SectionTitle aside={deployments.length}>{t('title')}</SectionTitle>
      {deployments.length === 0 ? (
        <EmptyState icon={MapPin}>{t('empty')}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-1">
          {deployments.map((d) => {
            const foes = hostileUnitsIn(w, d.regionId);
            return (
              <li key={d.id}>
                <Row
                  testId="military-deployment"
                  leading={<MapPin aria-hidden className="h-4 w-4 text-accent" />}
                  title={w.regionName(d.regionId)}
                  subtitle={
                    foes > 0
                      ? t('fighting', { foes: compactNumber(foes, w.locale) })
                      : t('age', { weeks: Math.max(0, w.state.tick - d.issuedAtTick) })
                  }
                  trailing={
                    <span className="numeric-tabular font-mono text-xs text-fg">
                      {t('units', { n: compactNumber(d.units, w.locale) })}
                    </span>
                  }
                  className={foes > 0 ? 'border-[#ff5d4d]/35 bg-[#ff5d4d]/[0.06] py-1.5' : 'py-1.5'}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** One unit per 100,000 spent (engine: `invest` → military). */
const COST_PER_UNIT = 100_000;

export function Recruit({ w, onErrors }: { w: World; onErrors?: (errors: string[]) => void }) {
  const t = useTranslations('panelMilitary.recruit');
  const commit = useCommit(onErrors);
  const [pct, setPct] = useState(10);
  const [done, setDone] = useState('');

  const treasury = Math.max(0, w.player.economy.treasury);
  const units = Math.floor((treasury * pct) / 100 / COST_PER_UNIT);
  const amount = units * COST_PER_UNIT;
  const blocked = treasury < COST_PER_UNIT ? t('noFunds') : units < 1 ? t('tooLittle') : null;

  const recruit = async () => {
    if (blocked) return;
    if (await commit({ type: 'invest', target: 'military', amount }, 'sfx.coin')) {
      setDone(t('done', { n: compactNumber(units, w.locale) }));
    }
  };

  return (
    <section aria-label={t('title')} className="flex flex-col gap-2">
      <SectionTitle aside={t('rate', { cost: cash(COST_PER_UNIT, w.locale, 0) })}>{t('title')}</SectionTitle>
      <Card className="flex flex-col gap-3">
        <Slider
          label={t('budget')}
          valueLabel={`${percent(pct / 100, w.locale)} · ${cash(amount, w.locale)}`}
          min={0}
          max={100}
          step={5}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          disabled={treasury < COST_PER_UNIT}
        />
        <Button icon={Coins} block disabled={Boolean(blocked)} onClick={() => void recruit()} data-testid="military-recruit-submit">
          {blocked ? t('ctaIdle') : t('cta', { n: compactNumber(units, w.locale), cost: cash(amount, w.locale) })}
        </Button>
        {blocked ? <p className="text-[11px] leading-snug text-warning">{blocked}</p> : null}
        <p role="status" aria-live="polite" className="text-[11px] text-success empty:hidden">
          {done}
        </p>
      </Card>
    </section>
  );
}

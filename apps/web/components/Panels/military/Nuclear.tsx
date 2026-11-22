'use client';

// Nuclear arsenal. Set apart from every other order and written to slow the
// player down: each strike lists what it destroys before a target can even
// be chosen, and the launch itself goes through the two-step confirmation.

import type { CountryId, NuclearArsenal, RegionId } from '@aurion/engine';
import { AlertTriangle, Minus, Plus, Radiation, Skull } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../../../lib/cn';
import { useGameStore } from '../../../lib/store';
import { NuclearLaunchConfirm, type NuclearLaunchConfirmRequest } from '../../Modals/NuclearLaunchConfirm';
import { Button, Chip, IconButton, Row } from '../../ui';
import { CountryDot, Fact } from '../diplomacy/parts';
import { knowsFigures, useCommit, type World } from '../diplomacy/world';

import { enemiesOf, enemyRegions } from './forces';

/** Engine constants (nuclear/index.ts), restated for the copy below. */
const MAX_WARHEADS = 10;
const PRODUCTION_INTERVAL = 50;
const REP_PER_WARHEAD_TREATY = 30;
const REP_PER_WARHEAD = 15;

type Pending =
  | { type: 'launchTactical'; targetRegionId: RegionId }
  | { type: 'launchStrategic'; targetCountryId: CountryId };

export function NuclearArsenalSection({
  w,
  arsenal,
  onErrors,
}: {
  w: World;
  arsenal: NuclearArsenal;
  onErrors?: (errors: string[]) => void;
}) {
  const t = useTranslations('panelMilitary.nuclear');
  const tToast = useTranslations('notifications.nuclear');
  const confirm = useGameStore((s) => s.confirm);
  const pushActionToast = useGameStore((s) => s.pushActionToast);
  const commit = useCommit(onErrors);

  const [regionPick, setRegionPick] = useState<RegionId | null>(null);
  const [dismantle, setDismantle] = useState(1);
  const [launch, setLaunch] = useState<{ request: NuclearLaunchConfirmRequest; action: Pending } | null>(null);

  const warheads = arsenal.warheadCount;
  const armed = warheads >= 1;
  const tracksReputation = w.state.reputation !== undefined;
  const treaty = (w.state.unResolutions ?? []).some((r) => r.kind === 'nonProliferation' && r.status === 'passed');
  const makesWarheads = w.player.science.completedTechs.some((id) => id.endsWith('_nuclear_arsenal_advanced'));
  const nextWarhead = PRODUCTION_INTERVAL - (w.state.tick % PRODUCTION_INTERVAL);

  const enemies = enemiesOf(w);
  const regions = enemyRegions(w);
  // The country selected on the globe is the strategic target when it is an
  // enemy; its home region is the suggested tactical one.
  const enemyTarget = w.target && enemies.some((e) => e.id === w.target?.id) ? w.target : null;
  const region = regionPick && regions.includes(regionPick) ? regionPick : (enemyTarget?.regionId ?? null);

  const count = Math.min(Math.max(1, dismantle), Math.max(1, warheads));
  const boost = count * (treaty ? REP_PER_WARHEAD_TREATY : REP_PER_WARHEAD);

  // The enemy's arsenal is only certain with enough intelligence; without
  // it the warning assumes the worst.
  const madFor = (id: CountryId): 'certain' | 'unknown' | 'none' => {
    const c = w.state.countries[id];
    if (!c) return 'none';
    if (!knowsFigures(w.intelOn(id))) return 'unknown';
    return (c.nuclear?.warheadCount ?? 0) >= 1 ? 'certain' : 'none';
  };

  const fire = async () => {
    if (!launch) return;
    const { action } = launch;
    setLaunch(null);
    if (await commit(action, 'sfx.nuke')) {
      pushActionToast({
        message: tToast(action.type === 'launchTactical' ? 'tacticalLaunched' : 'strategicLaunched'),
        tone: 'warning',
      });
    }
  };

  const askDismantle = () =>
    confirm({
      titleKey: 'panelMilitary.nuclear.confirm.title',
      descriptionKey: 'panelMilitary.nuclear.confirm.description',
      confirmKey: 'panelMilitary.nuclear.confirm.cta',
      cancelKey: 'common.cancel',
      tone: 'danger',
      onConfirm: async () => {
        await commit({ type: 'dismantleNuclear', count });
      },
    });

  return (
    <section
      aria-label={t('section.title')}
      data-testid="nuclear-arsenal"
      className="flex flex-col gap-3 rounded-xl border border-[#ff5d4d]/40 bg-[#ff5d4d]/[0.06] p-3"
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff8a7d]">
          <Radiation aria-hidden className="h-4 w-4" />
          {t('section.title')}
        </h3>
        <Chip tone={armed ? 'danger' : 'neutral'}>{armed ? t('deterrent.on') : t('deterrent.off')}</Chip>
      </header>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-fg-faint">{t('arsenal.count')}</div>
          <div className="numeric-tabular font-mono text-3xl font-semibold leading-tight text-fg" data-testid="nuclear-warheads">
            {warheads}
          </div>
        </div>
        <div className="flex gap-1 pb-2" aria-hidden>
          {Array.from({ length: MAX_WARHEADS }, (_, i) => (
            <span key={i} className={cn('h-4 w-1.5 rounded-full', i < warheads ? 'bg-[#ff5d4d]' : 'bg-white/10')} />
          ))}
        </div>
      </div>

      <dl className="flex flex-col gap-1">
        <Fact label={t('arsenal.deliveryLabel')} words>
          {t(`arsenal.deliverySystem.${arsenal.deliverySystemLevel}`)}
        </Fact>
        <Fact label={t('arsenal.production')} words>
          {!makesWarheads
            ? t('arsenal.productionNone')
            : warheads >= MAX_WARHEADS
              ? t('arsenal.productionFull', { max: MAX_WARHEADS })
              : t('arsenal.productionNext', { weeks: nextWarhead })}
        </Fact>
      </dl>
      <p className="text-[11px] leading-snug text-fg-muted">{armed ? t('deterrent.hint') : t('deterrent.hintOff')}</p>

      {/* ---- Tactical ---------------------------------------------------- */}
      <div className="flex flex-col gap-2 border-t border-[#ff5d4d]/25 pt-3">
        <h4 className="text-[13px] font-semibold text-fg">{t('tactical.title')}</h4>
        <ul className="flex list-disc flex-col gap-0.5 pl-4 text-[11px] leading-snug text-fg-muted">
          <li>{t('tactical.units')}</li>
          <li>{t('tactical.host')}</li>
          <li>{tracksReputation ? t('tactical.world') : t('tactical.worldNoBlocs')}</li>
        </ul>
        {regions.length === 0 ? (
          <p className="text-[11px] leading-snug text-warning">{t('tactical.noTargets')}</p>
        ) : (
          <ul aria-label={t('target.region')} className="flex flex-col gap-1">
            {regions.map((id) => (
              <li key={id}>
                <Row
                  testId={`nuclear-region-${id}`}
                  title={w.regionName(id)}
                  selected={region === id}
                  onClick={() => setRegionPick(id)}
                  className="py-1.5"
                />
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="danger"
          icon={Skull}
          block
          data-testid="nuclear-launch-tactical-button"
          disabled={!armed || !region}
          onClick={() => {
            if (!region) return;
            setLaunch({
              // A region strike never triggers mutual destruction.
              request: { kind: 'tactical', targetLabel: w.regionName(region), madRisk: false },
              action: { type: 'launchTactical', targetRegionId: region },
            });
          }}
        >
          {t('button.tactical')}
        </Button>
        {!armed ? (
          <p className="text-[11px] text-warning">{t('arsenal.noWarheads')}</p>
        ) : !region && regions.length > 0 ? (
          <p className="text-[11px] text-warning">{t('target.pickRegion')}</p>
        ) : null}
      </div>

      {/* ---- Strategic --------------------------------------------------- */}
      <div className="flex flex-col gap-2 border-t border-[#ff5d4d]/25 pt-3">
        <h4 className="text-[13px] font-semibold text-fg">{t('strategic.title')}</h4>
        <ul className="flex list-disc flex-col gap-0.5 pl-4 text-[11px] leading-snug text-fg-muted">
          <li>{t('strategic.target')}</li>
          <li>{t('strategic.mad')}</li>
          <li>{tracksReputation ? t('strategic.world') : t('strategic.worldNoBlocs')}</li>
        </ul>
        {enemies.length === 0 ? (
          <p className="text-[11px] leading-snug text-warning">{t('strategic.noTargets')}</p>
        ) : (
          <ul aria-label={t('target.country')} className="flex flex-col gap-1">
            {enemies.map((c) => {
              const mad = madFor(c.id);
              return (
                <li key={c.id}>
                  <Row
                    testId={`nuclear-country-${c.id}`}
                    leading={<CountryDot color={c.color} />}
                    title={w.nameOf(c.id)}
                    subtitle={t(`mad.${mad}`)}
                    selected={enemyTarget?.id === c.id}
                    onClick={() => w.selectTarget(c.id)}
                    trailing={mad !== 'none' ? <AlertTriangle aria-hidden className="h-4 w-4 text-warning" /> : null}
                    className="py-1.5"
                  />
                </li>
              );
            })}
          </ul>
        )}
        <Button
          variant="danger"
          icon={Skull}
          block
          data-testid="nuclear-launch-strategic-button"
          disabled={!armed || !enemyTarget}
          onClick={() => {
            if (!enemyTarget) return;
            setLaunch({
              request: {
                kind: 'strategic',
                targetLabel: w.nameOf(enemyTarget.id),
                madRisk: madFor(enemyTarget.id) !== 'none',
              },
              action: { type: 'launchStrategic', targetCountryId: enemyTarget.id },
            });
          }}
        >
          {t('button.strategic')}
        </Button>
        {!armed ? (
          <p className="text-[11px] text-warning">{t('arsenal.noWarheads')}</p>
        ) : !enemyTarget && enemies.length > 0 ? (
          <p className="text-[11px] text-warning">{t('target.pickCountry')}</p>
        ) : null}
      </div>

      {/* ---- Dismantle --------------------------------------------------- */}
      <div className="flex flex-col gap-2 border-t border-[#ff5d4d]/25 pt-3">
        <h4 className="text-[13px] font-semibold text-fg">{t('dismantle.title')}</h4>
        <p className="text-[11px] leading-snug text-fg-muted">
          {!tracksReputation
            ? t('dismantle.noBlocs')
            : treaty
              ? t('dismantle.boostFull', { perWarhead: REP_PER_WARHEAD_TREATY })
              : t('dismantle.boostHalved', { perWarhead: REP_PER_WARHEAD, full: REP_PER_WARHEAD_TREATY })}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-0.5">
            <IconButton icon={Minus} label={t('dismantle.fewer')} disabled={count <= 1} onClick={() => setDismantle(count - 1)} className="h-8 w-8" />
            <span className="numeric-tabular w-6 text-center font-mono text-sm text-fg" aria-live="polite">
              {armed ? count : 0}
            </span>
            <IconButton icon={Plus} label={t('dismantle.more')} disabled={count >= warheads} onClick={() => setDismantle(count + 1)} className="h-8 w-8" />
          </div>
          <Button className="flex-1" disabled={!armed} onClick={askDismantle} data-testid="nuclear-dismantle-button">
            {tracksReputation
              ? t('button.dismantle', { count, boost })
              : t('button.dismantlePlain', { count })}
          </Button>
        </div>
        {!armed ? <p className="text-[11px] text-warning">{t('arsenal.noWarheads')}</p> : null}
      </div>

      {/* Portalled to the page: inside the drawer the dialog would be clipped to it. */}
      {launch
        ? createPortal(
            <NuclearLaunchConfirm request={launch.request} onConfirm={() => void fire()} onCancel={() => setLaunch(null)} />,
            document.body,
          )
        : null}
    </section>
  );
}

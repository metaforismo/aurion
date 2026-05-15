// Military system panel.
// - Stats: armySize, navy, airforce, doctrineLevel
// - Deployments list with region + units + age
// - Train troops (invest in 'military')
// - Deploy army to a region (regions player has intel on or borders)
// - Wars list

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { CountryId, RegionId, RelationKey } from '@aurion/engine';

import { cn } from '../../lib/cn';
import {
  selectPlayerCountry,
  useGameStore,
  type GameStoreState,
} from '../../lib/store';
import { ScenarioId } from '../../lib/scenarios';
import { tone, type Tone } from '../../lib/theme';
import { ActionButton } from './shared/ActionButton';
import { EmptyState } from './shared/EmptyState';
import { Section } from './shared/Section';
import { StatBar } from './shared/StatBar';
import { useScenarioMessages } from './shared/useScenarioMessages';

/** Build a lex-sorted relation key matching the engine's `relationKey()`. */
function relationKey(a: CountryId, b: CountryId): RelationKey {
  return (a < b ? `${a}::${b}` : `${b}::${a}`) as RelationKey;
}

export function MilitaryPanel({
  onErrors,
}: {
  onErrors?: (errors: string[]) => void;
}) {
  const t = useTranslations('panelMilitary');
  const tShared = useTranslations('panelShared');
  const tMap = useTranslations('map.regions');
  const fmt = useFormatter();

  const player = useGameStore(selectPlayerCountry);
  const state = useGameStore((s: GameStoreState) => s.state);
  const scenario = useGameStore((s: GameStoreState) => s.scenario);
  const applyAction = useGameStore((s: GameStoreState) => s.applyAction);

  const scenarioId = (scenario?.id ?? null) as ScenarioId | null;
  const { t: tScenario } = useScenarioMessages(scenarioId);

  // Build the list of region candidates: regions where the player has at
  // least 'rumors' intel, or that border the player country (same / adjacent
  // — we approximate as "every distinct regionId in the world" for Phase 1
  // and let the engine reject impossible deployments).
  const regions = useMemo<RegionId[]>(() => {
    if (!state) return [];
    const set = new Set<RegionId>();
    for (const c of Object.values(state.countries)) {
      set.add(c.regionId);
    }
    return [...set].sort();
  }, [state]);

  const [trainAmount, setTrainAmount] = useState<string>('');
  const [deployUnits, setDeployUnits] = useState<string>('');
  const [deployRegion, setDeployRegion] = useState<RegionId>('');

  // Wars derived from relations. Computed unconditionally so we don't break
  // the rules of hooks when player/state are temporarily null.
  const wars = useMemo(() => {
    if (!player || !state) return [];
    const me = player.id;
    const out: { with: CountryId; name: string }[] = [];
    for (const c of Object.values(state.countries)) {
      if (c.id === me) continue;
      const rel = state.relations[relationKey(me, c.id)];
      if (rel?.atWar) {
        out.push({ with: c.id, name: tScenario(c.nameKey) });
      }
    }
    return out;
  }, [player, state, tScenario]);

  if (!player || !state) {
    return (
      <div className="p-4">
        <EmptyState>{tShared('noPlayer')}</EmptyState>
      </div>
    );
  }

  const military = player.military;
  const treasury = player.economy.treasury;

  const trainAmountNum = Number(trainAmount);
  const trainInvalid =
    trainAmount === '' ||
    !Number.isFinite(trainAmountNum) ||
    trainAmountNum <= 0;
  const trainTooHigh = trainAmountNum > treasury;

  const deployUnitsNum = Number(deployUnits);
  const deployInvalidUnits =
    deployUnits === '' ||
    !Number.isFinite(deployUnitsNum) ||
    deployUnitsNum <= 0;
  const deployTooMany = deployUnitsNum > military.armySize;
  const deployNoRegion = !deployRegion;

  const handleTrain = async () => {
    if (trainInvalid || trainTooHigh) return [];
    const errors = await applyAction({
      type: 'invest',
      target: 'military',
      amount: trainAmountNum,
    });
    if (errors.length === 0) setTrainAmount('');
    return errors;
  };

  const handleDeploy = async () => {
    if (deployInvalidUnits || deployTooMany || deployNoRegion) return [];
    const errors = await applyAction({
      type: 'deployArmy',
      target: deployRegion,
      units: deployUnitsNum,
    });
    if (errors.length === 0) {
      setDeployUnits('');
    }
    return errors;
  };

  const regionLabel = (id: RegionId): string => {
    // Try the curated map.regions.{id} bundle first; fall back to raw id.
    try {
      return tMap(id);
    } catch {
      return id;
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Stat headline */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t('armySize')} value={fmt.number(military.armySize)} t="neutral" />
        <Stat label={t('navy')} value={fmt.number(military.navy)} t="info" />
        <Stat label={t('airforce')} value={fmt.number(military.airforce)} t="info" />
        <Stat
          label={t('doctrineLevel')}
          value={fmt.number(military.doctrineLevel, {
            style: 'percent',
            maximumFractionDigits: 0,
          })}
          t="success"
        />
      </div>

      <StatBar
        label={t('doctrineLevel')}
        value={military.doctrineLevel * 100}
        max={100}
        valueLabel={fmt.number(military.doctrineLevel, {
          style: 'percent',
          maximumFractionDigits: 0,
        })}
        tone="info"
      />

      {/* Train */}
      <Section title={t('train.title')}>
        <div className="flex flex-col gap-2">
          <label htmlFor="military-train" className="text-xs text-fg">
            {t('train.amountLabel')}
          </label>
          <input
            id="military-train"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            value={trainAmount}
            onChange={(e) => setTrainAmount(e.target.value)}
            className={cn(
              'rounded-md border px-2 py-1 font-mono numeric-tabular text-xs text-fg',
              trainTooHigh
                ? 'border-danger bg-danger/15'
                : 'border-border-strong bg-surface-1',
            )}
            aria-invalid={trainTooHigh || undefined}
          />
          <ActionButton
            tone="primary"
            cost={trainAmount ? fmt.number(trainAmountNum) : null}
            disabledReason={
              trainInvalid
                ? tShared('enterAmount')
                : trainTooHigh
                  ? tShared('insufficientTreasury')
                  : null
            }
            onClick={handleTrain}
            onErrors={onErrors}
          >
            {t('train.cta')}
          </ActionButton>
          <p className="text-[11px] text-fg-faint">{t('train.hint')}</p>
        </div>
      </Section>

      {/* Deploy */}
      <Section title={t('deploy.title')}>
        <div className="flex flex-col gap-2">
          <label htmlFor="military-deploy-region" className="text-xs text-fg">
            {t('deploy.regionLabel')}
          </label>
          <select
            id="military-deploy-region"
            value={deployRegion}
            onChange={(e) => setDeployRegion(e.target.value)}
            className="rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-xs text-fg"
          >
            <option value="">{t('deploy.regionPlaceholder')}</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {regionLabel(r)}
              </option>
            ))}
          </select>
          <label htmlFor="military-deploy-units" className="text-xs text-fg">
            {t('deploy.unitsLabel')}
          </label>
          <input
            id="military-deploy-units"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            value={deployUnits}
            onChange={(e) => setDeployUnits(e.target.value)}
            className={cn(
              'rounded-md border px-2 py-1 font-mono numeric-tabular text-xs text-fg',
              deployTooMany
                ? 'border-danger bg-danger/15'
                : 'border-border-strong bg-surface-1',
            )}
            aria-invalid={deployTooMany || undefined}
          />
          <ActionButton
            tone="primary"
            disabledReason={
              deployNoRegion
                ? t('deploy.pickRegion')
                : deployInvalidUnits
                  ? tShared('enterAmount')
                  : deployTooMany
                    ? t('deploy.notEnough')
                    : null
            }
            onClick={handleDeploy}
            onErrors={onErrors}
          >
            {t('deploy.cta')}
          </ActionButton>
        </div>
      </Section>

      {/* Active deployments */}
      <Section
        title={t('deployed.title')}
        trailing={`${military.deployedUnits.length}`}
      >
        {military.deployedUnits.length === 0 ? (
          <EmptyState>{t('deployed.empty')}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {military.deployedUnits.map((dep) => {
              const age = Math.max(0, state.tick - dep.issuedAtTick);
              return (
                <li
                  key={dep.id}
                  className="rounded-md border border-border bg-surface/40 p-2"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-fg">
                      {regionLabel(dep.regionId)}
                    </span>
                    <span className="font-mono numeric-tabular text-[11px] text-fg-muted">
                      {fmt.number(dep.units)} {t('deployed.units')}
                    </span>
                  </div>
                  <div className="text-[11px] text-fg-faint">
                    {t('deployed.age', { weeks: age })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Wars */}
      <Section title={t('wars.title')} trailing={`${wars.length}`}>
        {wars.length === 0 ? (
          <EmptyState>{t('wars.empty')}</EmptyState>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {wars.map((w) => (
              <li
                key={w.with}
                className="rounded-full border border-danger bg-danger/15 px-2 py-0.5 text-[11px] text-danger"
              >
                {w.name}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Stat({
  label,
  value,
  t,
}: {
  label: string;
  value: string;
  t: Tone;
}) {
  return (
    <div className="rounded-md border border-border bg-surface/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-fg-faint">
        {label}
      </div>
      <div className={cn('font-mono text-sm numeric-tabular', tone(t))}>
        {value}
      </div>
    </div>
  );
}

export default MilitaryPanel;

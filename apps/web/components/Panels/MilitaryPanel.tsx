// Military system panel.
// - Stats: armySize, navy, airforce, doctrineLevel
// - Deployments list with region + units + age
// - Train troops (invest in 'military')
// - Deploy army to a region (regions player has intel on or borders)
// - Wars list

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { AlertTriangle, Radiation, Skull } from 'lucide-react';
import type {
  CountryId,
  NuclearArsenal,
  RegionId,
  RelationKey,
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import {
  selectPlayerCountry,
  useGameStore,
  type GameStoreState,
} from '../../lib/store';
import { ScenarioId } from '../../lib/scenarios';
import { tone, type Tone } from '../../lib/theme';
import {
  NuclearLaunchConfirm,
  type NuclearLaunchConfirmRequest,
} from '../Modals/NuclearLaunchConfirm';
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

  // Nuclear arsenal — Wave 10. The two pickers are local state so the player
  // can stage a strike target before opening the launch confirm modal.
  const [nukeRegion, setNukeRegion] = useState<RegionId>('');
  const [nukeCountry, setNukeCountry] = useState<CountryId>('');
  // The launch-confirm two-step modal is rendered inline (not via ModalRoot)
  // so it's owned by the panel that triggered it. `null` = closed.
  const [pendingLaunch, setPendingLaunch] =
    useState<NuclearLaunchConfirmRequest | null>(null);
  const [pendingLaunchAction, setPendingLaunchAction] = useState<
    | { type: 'launchTactical'; targetRegionId: RegionId }
    | { type: 'launchStrategic'; targetCountryId: CountryId }
    | null
  >(null);
  const confirm = useGameStore((s: GameStoreState) => s.confirm);

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

  // Nuclear arsenal (Wave 10) — declared BEFORE the early-return guard so the
  // rules of hooks are honoured. Returns empty / inert defaults when there is
  // no game loaded; the guarded JSX below only renders the section after the
  // (player, state) guard passes.
  const enemyCountries = useMemo<{ id: CountryId; name: string }[]>(() => {
    if (!state || !player) return [];
    if (player.nuclear === undefined) return [];
    return Object.values(state.countries)
      .filter((c) => c.id !== player.id)
      .map((c) => ({ id: c.id, name: tScenario(c.nameKey) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state, player, tScenario]);

  const treatyActive = useMemo<boolean>(() => {
    const list = state?.unResolutions ?? [];
    return list.some(
      (r) => r.kind === 'nonProliferation' && r.status === 'passed',
    );
  }, [state]);

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

  // ---- Nuclear arsenal (Wave 10) ----------------------------------------
  // Show the section ONLY when the player country has a nuclear field. We
  // intentionally don't render a "build first warhead" affordance here —
  // building the arsenal goes through the tech tree (`tech_*_nuclear_arsenal`).
  const nuclear: NuclearArsenal | undefined = player.nuclear;
  const hasArsenal = nuclear !== undefined;
  const warheadCount = nuclear?.warheadCount ?? 0;
  const noWarheads = warheadCount <= 0;
  const deliveryLevel = (nuclear?.deliverySystemLevel ?? 0) as 0 | 1 | 2;

  // The detected MAD risk for a strategic strike. We only consider the target
  // country's `nuclear.warheadCount > 0` — a refined intel gate would defer
  // to the engine when it ships; for now, the UI shows the worst case so the
  // confirm modal under-promises and over-delivers on the warning.
  const computeMadRisk = (targetCountryId: CountryId): boolean => {
    const target = state.countries[targetCountryId];
    if (!target) return false;
    return (target.nuclear?.warheadCount ?? 0) > 0;
  };

  const openTacticalConfirm = () => {
    if (!nukeRegion || noWarheads) return;
    setPendingLaunch({
      kind: 'tactical',
      targetLabel: regionLabel(nukeRegion),
      // Tactical strikes never trigger MAD (region target, not country).
      madRisk: false,
    });
    setPendingLaunchAction({
      type: 'launchTactical',
      targetRegionId: nukeRegion,
    });
  };

  const openStrategicConfirm = () => {
    if (!nukeCountry || noWarheads) return;
    const targetName = tScenario(
      state.countries[nukeCountry]?.nameKey ?? nukeCountry,
    );
    setPendingLaunch({
      kind: 'strategic',
      targetLabel: targetName,
      madRisk: computeMadRisk(nukeCountry),
    });
    setPendingLaunchAction({
      type: 'launchStrategic',
      targetCountryId: nukeCountry,
    });
  };

  const cancelLaunch = () => {
    setPendingLaunch(null);
    setPendingLaunchAction(null);
  };

  const confirmLaunch = async () => {
    if (!pendingLaunchAction) return;
    const errors = await applyAction(pendingLaunchAction);
    setPendingLaunch(null);
    setPendingLaunchAction(null);
    if (errors.length > 0 && onErrors) onErrors(errors);
  };

  // Total reputation boost the player would receive on confirm. With an
  // active non-proliferation treaty, the engine awards +30 per warhead; without
  // the treaty, the boost is halved to +15 per warhead. Computed defensively
  // so the banner remains stable even when the engine action stub returns an
  // error (the treasury / reputation aren't applied; the boost preview is a
  // pure-UI computation against current state).
  const dismantleFullBoost = warheadCount * 30;
  const dismantleHalvedBoost = warheadCount * 15;
  const dismantleBoost = treatyActive ? dismantleFullBoost : dismantleHalvedBoost;

  const handleDismantle = () => {
    if (!hasArsenal || noWarheads) return;
    confirm({
      titleKey: 'modals.confirm.nuclearDismantle.title',
      descriptionKey: treatyActive
        ? 'modals.confirm.nuclearDismantle.descriptionTreaty'
        : 'modals.confirm.nuclearDismantle.descriptionNoTreaty',
      confirmKey: 'modals.confirm.nuclearDismantle.confirm',
      cancelKey: 'common.cancel',
      tone: 'danger',
      onConfirm: async () => {
        const errors = await applyAction({
          type: 'dismantleNuclear',
          count: warheadCount,
        });
        if (errors.length > 0 && onErrors) onErrors(errors);
      },
    });
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

      {/*
        Nuclear arsenal — buried at the bottom on purpose. Render only when
        the player country has a nuclear field (i.e. has researched the
        arsenal tech). The whole section is wrapped in a danger-toned
        container with a permanent visual warning so the player never opens
        the panel by reflex and clicks the wrong button.
      */}
      {hasArsenal ? (
        <NuclearArsenalSection
          warheadCount={warheadCount}
          deliveryLevel={deliveryLevel}
          noWarheads={noWarheads}
          treatyActive={treatyActive}
          dismantleBoost={dismantleBoost}
          dismantleFullBoost={dismantleFullBoost}
          dismantleHalvedBoost={dismantleHalvedBoost}
          regions={regions}
          regionLabel={regionLabel}
          enemyCountries={enemyCountries}
          nukeRegion={nukeRegion}
          setNukeRegion={setNukeRegion}
          nukeCountry={nukeCountry}
          setNukeCountry={setNukeCountry}
          openTacticalConfirm={openTacticalConfirm}
          openStrategicConfirm={openStrategicConfirm}
          handleDismantle={handleDismantle}
          fmt={fmt}
        />
      ) : null}

      {/*
        Inline two-step launch confirm. Owned by the panel — it would be
        wrong to route this through the global ModalRoot priority chain
        because the request is local UI state (target picker → confirm),
        not a store-level event.
      */}
      {pendingLaunch ? (
        <NuclearLaunchConfirm
          request={pendingLaunch}
          onConfirm={confirmLaunch}
          onCancel={cancelLaunch}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nuclear arsenal section — extracted so the panel render stays readable.
// ---------------------------------------------------------------------------

const DELIVERY_LABEL_KEY = ['arsenal.deliverySystem.0', 'arsenal.deliverySystem.1', 'arsenal.deliverySystem.2'] as const;

function NuclearArsenalSection({
  warheadCount,
  deliveryLevel,
  noWarheads,
  treatyActive,
  dismantleBoost,
  dismantleFullBoost,
  dismantleHalvedBoost,
  regions,
  regionLabel,
  enemyCountries,
  nukeRegion,
  setNukeRegion,
  nukeCountry,
  setNukeCountry,
  openTacticalConfirm,
  openStrategicConfirm,
  handleDismantle,
  fmt,
}: {
  warheadCount: number;
  deliveryLevel: 0 | 1 | 2;
  noWarheads: boolean;
  treatyActive: boolean;
  dismantleBoost: number;
  dismantleFullBoost: number;
  dismantleHalvedBoost: number;
  regions: RegionId[];
  regionLabel: (id: RegionId) => string;
  enemyCountries: { id: CountryId; name: string }[];
  nukeRegion: RegionId;
  setNukeRegion: (id: RegionId) => void;
  nukeCountry: CountryId;
  setNukeCountry: (id: CountryId) => void;
  openTacticalConfirm: () => void;
  openStrategicConfirm: () => void;
  handleDismantle: () => void;
  fmt: ReturnType<typeof useFormatter>;
}) {
  const t = useTranslations('panelMilitary.nuclear');

  const noTacticalTarget = nukeRegion === '';
  const noStrategicTarget = nukeCountry === '';

  return (
    <section
      aria-label={t('section.title')}
      className="flex flex-col gap-3 rounded-lg border-2 border-danger/70 bg-danger/[0.04] p-3"
    >
      <header className="flex items-center gap-2">
        <Radiation aria-hidden className={cn('h-4 w-4', tone('danger'))} />
        <h3 className={cn('text-xs font-bold uppercase tracking-wider', tone('danger'))}>
          {t('section.title')}
        </h3>
      </header>

      {/* Permanent warning copy — keeps the moral weight visible at a glance. */}
      <p
        className={cn(
          'flex items-start gap-1.5 rounded-md border border-danger/60 bg-danger/10 px-2 py-1.5 text-[11px] leading-relaxed',
          tone('danger'),
        )}
      >
        <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{t('warningPermanent')}</span>
      </p>

      {/* Arsenal stats */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t('arsenal.count')} value={fmt.number(warheadCount)} t="danger" />
        <div className="rounded-md border border-border bg-surface/40 p-2">
          <div className="text-[10px] uppercase tracking-wider text-fg-faint">
            {t('arsenal.deliveryLabel')}
          </div>
          <div className={cn('font-mono text-sm numeric-tabular', tone('danger'))}>
            {t(DELIVERY_LABEL_KEY[deliveryLevel])}
          </div>
        </div>
      </div>

      {/* Tactical strike picker + button */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nuke-region" className="text-[11px] uppercase tracking-wider text-fg">
          {t('target.region')}
        </label>
        <select
          id="nuke-region"
          value={nukeRegion}
          onChange={(e) => setNukeRegion(e.target.value)}
          className="rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-xs text-fg"
        >
          <option value="">{t('target.regionPlaceholder')}</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {regionLabel(r)}
            </option>
          ))}
        </select>
        <ActionButton
          tone="danger"
          disabledReason={
            noWarheads
              ? t('arsenal.noWarheads')
              : noTacticalTarget
                ? t('target.pickRegion')
                : null
          }
          onClick={openTacticalConfirm}
        >
          <span className="flex items-center gap-1.5">
            <Skull aria-hidden className="h-3.5 w-3.5" />
            {t('button.tactical')}
          </span>
        </ActionButton>
      </div>

      {/* Strategic strike picker + button */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nuke-country" className="text-[11px] uppercase tracking-wider text-fg">
          {t('target.country')}
        </label>
        <select
          id="nuke-country"
          value={nukeCountry}
          onChange={(e) => setNukeCountry(e.target.value)}
          className="rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-xs text-fg"
        >
          <option value="">{t('target.countryPlaceholder')}</option>
          {enemyCountries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <ActionButton
          tone="danger"
          disabledReason={
            noWarheads
              ? t('arsenal.noWarheads')
              : noStrategicTarget
                ? t('target.pickCountry')
                : null
          }
          onClick={openStrategicConfirm}
        >
          <span className="flex items-center gap-1.5">
            <Skull aria-hidden className="h-3.5 w-3.5" />
            {t('button.strategic')}
          </span>
        </ActionButton>
      </div>

      {/* Dismantle — small, subtle, pro-disarmament path. */}
      <div className="mt-2 flex flex-col gap-1.5 border-t border-danger/40 pt-3">
        <p
          className={cn(
            'rounded-md border px-2 py-1.5 text-[11px] leading-relaxed',
            treatyActive
              ? 'border-success/50 bg-success/10 text-success'
              : 'border-warning/50 bg-warning/10 text-warning',
          )}
        >
          {treatyActive
            ? t('dismantle.boostFull', {
                perWarhead: 30,
                total: dismantleFullBoost,
              })
            : t('dismantle.boostHalved', {
                perWarhead: 15,
                total: dismantleHalvedBoost,
              })}
        </p>
        <button
          type="button"
          onClick={handleDismantle}
          disabled={noWarheads}
          aria-disabled={noWarheads}
          title={noWarheads ? t('arsenal.noWarheads') : undefined}
          className={cn(
            'self-start rounded-md border px-2.5 py-1 text-[11px] font-semibold transition',
            noWarheads
              ? 'cursor-not-allowed border-border bg-surface/40 text-fg-faint'
              : 'border-fg-faint bg-surface-1 text-fg-muted hover:border-fg-muted hover:text-fg',
          )}
        >
          {t('button.dismantle', { count: warheadCount, boost: dismantleBoost })}
        </button>
      </div>
    </section>
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

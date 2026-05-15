// Intelligence / Spies system panel.
// - Stats: spyCount, counterIntelLevel
// - Active operations with progress bars
// - "Launch operation" inline composer (no modal — Modals agent handles those)
// - Intel summary

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type {
  CountryId,
  EconomySectors,
  FactionId,
  IntelLevel,
  SpyOperation,
  SpyOperationType,
  SpyPayload,
  TechId,
} from '@aurion/engine';

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

// ---------------------------------------------------------------------------
// Probability helpers — mirror packages/engine/src/actions/deploySpy.ts so the
// composer can show a live preview without round-tripping the engine.
// ---------------------------------------------------------------------------

const INTEL_LEVEL_BONUS: Record<IntelLevel, number> = {
  none: 0,
  rumors: 0.05,
  partial: 0.15,
  full: 0.25,
};

const SPY_TYPE_BASE_SUCCESS: Record<SpyOperationType, number> = {
  steal_tech: 0.5,
  sabotage: 0.55,
  propaganda: 0.65,
  destabilize: 0.4,
  assassinate: 0.3,
};

const SPY_TYPE_BASE_DETECTION: Record<SpyOperationType, number> = {
  steal_tech: 0.25,
  sabotage: 0.35,
  propaganda: 0.2,
  destabilize: 0.4,
  assassinate: 0.55,
};

const SPY_TYPES: readonly SpyOperationType[] = [
  'steal_tech',
  'sabotage',
  'propaganda',
  'destabilize',
  'assassinate',
];

const SABOTAGE_TARGETS: readonly (keyof EconomySectors | 'military' | 'science')[] = [
  'agriculture',
  'industry',
  'services',
  'tech',
  'military',
  'science',
];

const FACTION_IDS: readonly FactionId[] = [
  'army',
  'business',
  'religious',
  'populist',
  'reformist',
];

const INTEL_ICON: Record<IntelLevel, string> = {
  none: '?',
  rumors: '~',
  partial: '*',
  full: '!',
};

const INTEL_TONE: Record<IntelLevel, string> = {
  none: 'text-fg-faint border-border',
  rumors: 'text-warning border-warning',
  partial: 'text-info border-info',
  full: 'text-success border-success',
};

function clampProb(p: number): number {
  if (!Number.isFinite(p)) return 0;
  if (p < 0.01) return 0.01;
  if (p > 0.99) return 0.99;
  return p;
}

function computeProbabilities(args: {
  intel: IntelLevel;
  counterIntel: number;
  type: SpyOperationType;
}): { success: number; detection: number } {
  const intelBonus = INTEL_LEVEL_BONUS[args.intel];
  const baseS = SPY_TYPE_BASE_SUCCESS[args.type];
  const baseD = SPY_TYPE_BASE_DETECTION[args.type];
  return {
    success: clampProb(baseS + intelBonus - args.counterIntel * 0.4),
    detection: clampProb(baseD + args.counterIntel * 0.4 - intelBonus),
  };
}

const DEFAULT_DURATION_TICKS: Record<SpyOperationType, number> = {
  steal_tech: 12,
  sabotage: 8,
  propaganda: 10,
  destabilize: 14,
  assassinate: 16,
};

// ---------------------------------------------------------------------------

export function SpiesPanel({
  onErrors,
}: {
  onErrors?: (errors: string[]) => void;
}) {
  const t = useTranslations('panelSpies');
  const tShared = useTranslations('panelShared');
  const fmt = useFormatter();

  const player = useGameStore(selectPlayerCountry);
  const state = useGameStore((s: GameStoreState) => s.state);
  const scenario = useGameStore((s: GameStoreState) => s.scenario);
  const applyAction = useGameStore((s: GameStoreState) => s.applyAction);

  const scenarioId = (scenario?.id ?? null) as ScenarioId | null;
  const { t: tScenario } = useScenarioMessages(scenarioId);

  const [composerOpen, setComposerOpen] = useState(false);

  if (!player || !state) {
    return (
      <div className="p-4">
        <EmptyState>{tShared('noPlayer')}</EmptyState>
      </div>
    );
  }

  const intel = player.intelligence;
  // Player's own active operations (engine stores all spy ops in one list).
  const activeOps = state.spyOperations.filter(
    (op) => op.ownerCountryId === player.id && op.status === 'active',
  );

  const otherCountries = Object.values(state.countries).filter(
    (c) => c.id !== player.id,
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t('spyCount')} value={fmt.number(intel.spyCount)} t="warning" />
        <Stat
          label={t('counterIntel')}
          value={fmt.number(intel.counterIntelLevel, {
            style: 'percent',
            maximumFractionDigits: 0,
          })}
          t="info"
        />
      </div>

      <StatBar
        label={t('counterIntel')}
        value={intel.counterIntelLevel * 100}
        max={100}
        valueLabel={fmt.number(intel.counterIntelLevel, {
          style: 'percent',
          maximumFractionDigits: 0,
        })}
        tone="info"
      />

      {/* Composer */}
      <Section title={t('composer.title')}>
        {composerOpen ? (
          <SpyComposer
            ownerId={player.id}
            counterIntelByCountry={Object.fromEntries(
              Object.values(state.countries).map((c) => [c.id, c.intelligence.counterIntelLevel]),
            )}
            knownIntel={intel.knownIntel}
            otherCountries={otherCountries.map((c) => ({
              id: c.id,
              name: tScenario(c.nameKey),
              completedTechs: c.science.completedTechs,
            }))}
            playerCompletedTechs={player.science.completedTechs}
            tScenario={tScenario}
            onSubmit={async (payload) => {
              const errors = await applyAction({ type: 'deploySpy', op: payload });
              if (errors.length === 0) setComposerOpen(false);
              return errors;
            }}
            onCancel={() => setComposerOpen(false)}
            onErrors={onErrors}
          />
        ) : (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="w-full rounded-md border border-accent bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:border-accent-strong hover:bg-accent/20"
          >
            {t('composer.open')}
          </button>
        )}
      </Section>

      {/* Active ops */}
      <Section
        title={t('active.title')}
        trailing={`${activeOps.length}`}
      >
        {activeOps.length === 0 ? (
          <EmptyState>{t('active.empty')}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeOps.map((op) => (
              <li key={op.id}>
                <SpyOpCard
                  op={op}
                  targetName={tScenario(state.countries[op.targetCountryId]?.nameKey ?? null)}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Intel summary */}
      <Section title={t('intelSummary.title')}>
        <ul className="grid grid-cols-1 gap-1 text-xs">
          {otherCountries.map((c) => {
            const lvl = (intel.knownIntel[c.id] ?? 'none') as IntelLevel;
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1"
              >
                <span className="text-fg">{tScenario(c.nameKey)}</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
                    INTEL_TONE[lvl],
                  )}
                  aria-label={t(`intel.${lvl}`)}
                  title={t(`intel.${lvl}`)}
                >
                  <span aria-hidden>{INTEL_ICON[lvl]}</span>
                  <span>{t(`intel.${lvl}`)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

function SpyComposer({
  ownerId,
  counterIntelByCountry,
  knownIntel,
  otherCountries,
  playerCompletedTechs,
  tScenario,
  onSubmit,
  onCancel,
  onErrors,
}: {
  ownerId: CountryId;
  counterIntelByCountry: Record<CountryId, number>;
  knownIntel: Record<CountryId, IntelLevel>;
  otherCountries: { id: CountryId; name: string; completedTechs: TechId[] }[];
  playerCompletedTechs: TechId[];
  tScenario: (key: string | null | undefined) => string;
  onSubmit: (op: Omit<SpyOperation, 'id' | 'status' | 'progressTicks' | 'startedAtTick'>) => Promise<string[]>;
  onCancel: () => void;
  onErrors?: (errors: string[]) => void;
}) {
  const t = useTranslations('panelSpies');
  const tShared = useTranslations('panelShared');
  const fmt = useFormatter();

  // Eligible targets: every other country with intel >= rumors.
  const eligibleTargets = useMemo(
    () =>
      otherCountries.filter((c) => {
        const lvl = knownIntel[c.id] ?? 'none';
        return lvl !== 'none';
      }),
    [otherCountries, knownIntel],
  );

  const [type, setType] = useState<SpyOperationType>('steal_tech');
  const [target, setTarget] = useState<CountryId>('');
  // Per-type payload sub-state.
  const [stealTechId, setStealTechId] = useState<TechId>('');
  const [sabotageTarget, setSabotageTarget] =
    useState<keyof EconomySectors | 'military' | 'science'>('industry');
  const [propagandaFaction, setPropagandaFaction] = useState<FactionId | ''>('');
  const [assassinateRoleKey, setAssassinateRoleKey] =
    useState<string>('role.head_of_state');

  const playerCompletedSet = useMemo(
    () => new Set(playerCompletedTechs),
    [playerCompletedTechs],
  );

  const targetCountry = otherCountries.find((c) => c.id === target);
  const stealableTechs = useMemo(
    () =>
      targetCountry
        ? targetCountry.completedTechs.filter((t) => !playerCompletedSet.has(t))
        : [],
    [targetCountry, playerCompletedSet],
  );

  // Prediction
  const intelLvl = (knownIntel[target] ?? 'none') as IntelLevel;
  const counterIntel =
    target && counterIntelByCountry[target] !== undefined
      ? counterIntelByCountry[target]
      : 0;

  const probs = useMemo(
    () => computeProbabilities({ intel: intelLvl, counterIntel, type }),
    [intelLvl, counterIntel, type],
  );

  const buildPayload = (): SpyPayload | null => {
    switch (type) {
      case 'steal_tech':
        if (!stealTechId) return null;
        return { kind: 'steal_tech', techId: stealTechId };
      case 'sabotage':
        return { kind: 'sabotage', targetSector: sabotageTarget };
      case 'propaganda':
        return {
          kind: 'propaganda',
          targetFaction: propagandaFaction === '' ? null : propagandaFaction,
        };
      case 'destabilize':
        return { kind: 'destabilize' };
      case 'assassinate':
        return { kind: 'assassinate', targetRoleKey: assassinateRoleKey };
    }
  };

  const payloadInvalid = type === 'steal_tech' && !stealTechId;
  const noTarget = !target;
  const disabledReason = noTarget
    ? t('composer.pickTarget')
    : payloadInvalid
      ? t('composer.pickPayload')
      : null;

  const handleSubmit = async () => {
    const payload = buildPayload();
    if (!payload || noTarget) return [];
    const op: Omit<SpyOperation, 'id' | 'status' | 'progressTicks' | 'startedAtTick'> = {
      type,
      ownerCountryId: ownerId,
      targetCountryId: target,
      payload,
      durationTicks: DEFAULT_DURATION_TICKS[type],
      successProbability: probs.success,
      detectionRisk: probs.detection,
    };
    return onSubmit(op);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-fg" htmlFor="spy-type">
        {t('composer.type')}
      </label>
      <select
        id="spy-type"
        value={type}
        onChange={(e) => setType(e.target.value as SpyOperationType)}
        className="rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-xs text-fg"
      >
        {SPY_TYPES.map((sType) => (
          <option key={sType} value={sType}>
            {t(`type.${sType}`)}
          </option>
        ))}
      </select>

      <label className="text-xs text-fg" htmlFor="spy-target">
        {t('composer.target')}
      </label>
      <select
        id="spy-target"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-xs text-fg"
      >
        <option value="">{t('composer.targetPlaceholder')}</option>
        {eligibleTargets.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {eligibleTargets.length === 0 ? (
        <p className="text-[11px] text-warning">{t('composer.noEligibleTargets')}</p>
      ) : null}

      {/* Payload sub-form */}
      {type === 'steal_tech' && target ? (
        <>
          <label className="text-xs text-fg" htmlFor="spy-tech">
            {t('composer.stealTech')}
          </label>
          <select
            id="spy-tech"
            value={stealTechId}
            onChange={(e) => setStealTechId(e.target.value)}
            className="rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-xs text-fg"
          >
            <option value="">{t('composer.stealTechPlaceholder')}</option>
            {stealableTechs.map((id) => (
              <option key={id} value={id}>
                {tScenario(`tech.${id.replace(/^tech_/, '').split('_').join('.')}`) || id}
              </option>
            ))}
          </select>
          {stealableTechs.length === 0 ? (
            <p className="text-[11px] text-fg-faint">{t('composer.noStealable')}</p>
          ) : null}
        </>
      ) : null}

      {type === 'sabotage' ? (
        <>
          <label className="text-xs text-fg" htmlFor="spy-sabotage">
            {t('composer.sabotageTarget')}
          </label>
          <select
            id="spy-sabotage"
            value={sabotageTarget}
            onChange={(e) =>
              setSabotageTarget(e.target.value as keyof EconomySectors | 'military' | 'science')
            }
            className="rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-xs text-fg"
          >
            {SABOTAGE_TARGETS.map((s) => (
              <option key={s} value={s}>
                {t(`sabotage.${s}`)}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {type === 'propaganda' ? (
        <>
          <label className="text-xs text-fg" htmlFor="spy-faction">
            {t('composer.propagandaFaction')}
          </label>
          <select
            id="spy-faction"
            value={propagandaFaction}
            onChange={(e) =>
              setPropagandaFaction((e.target.value || '') as FactionId | '')
            }
            className="rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-xs text-fg"
          >
            <option value="">{t('composer.propagandaAny')}</option>
            {FACTION_IDS.map((f) => (
              <option key={f} value={f}>
                {t(`faction.${f}`)}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {type === 'assassinate' ? (
        <>
          <label className="text-xs text-fg" htmlFor="spy-role">
            {t('composer.assassinateRole')}
          </label>
          <input
            id="spy-role"
            type="text"
            value={assassinateRoleKey}
            onChange={(e) => setAssassinateRoleKey(e.target.value)}
            className="rounded-md border border-border-strong bg-surface-1 px-2 py-1 font-mono text-xs text-fg"
          />
        </>
      ) : null}

      {/* Live prediction */}
      {target ? (
        <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface/40 p-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-fg-faint">
              {t('composer.successPreview')}
            </div>
            <div className="font-mono text-sm text-success numeric-tabular">
              {fmt.number(probs.success, { style: 'percent', maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-fg-faint">
              {t('composer.detectionPreview')}
            </div>
            <div className="font-mono text-sm text-danger numeric-tabular">
              {fmt.number(probs.detection, { style: 'percent', maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <ActionButton
          tone="primary"
          disabledReason={disabledReason}
          onClick={handleSubmit}
          onErrors={onErrors}
          className="flex-1"
        >
          {t('composer.submit')}
        </ActionButton>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-xs text-fg hover:border-border-strong"
        >
          {tShared('cancel')}
        </button>
      </div>
    </div>
  );
}

function SpyOpCard({
  op,
  targetName,
}: {
  op: SpyOperation;
  targetName: string;
}) {
  const t = useTranslations('panelSpies');
  const fmt = useFormatter();
  const ratio = op.durationTicks > 0 ? op.progressTicks / op.durationTicks : 0;
  const remaining = Math.max(0, op.durationTicks - op.progressTicks);

  return (
    <div className="rounded-md border border-border bg-surface/40 p-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-fg">
          {t(`type.${op.type}`)} → {targetName || op.targetCountryId}
        </span>
        <span className="font-mono numeric-tabular text-[11px] text-fg-faint">
          {t('active.eta', { ticks: remaining })}
        </span>
      </div>
      <StatBar
        label={t('active.progressLabel')}
        value={op.progressTicks}
        max={op.durationTicks}
        valueLabel={`${op.progressTicks} / ${op.durationTicks}`}
        tone="info"
        className="mt-1"
      />
      <div className="mt-1 flex justify-between text-[11px] text-fg-faint">
        <span>
          {t('active.success')}:{' '}
          <span className="text-success numeric-tabular">
            {fmt.number(op.successProbability, {
              style: 'percent',
              maximumFractionDigits: 0,
            })}
          </span>
        </span>
        <span>
          {t('active.detection')}:{' '}
          <span className="text-danger numeric-tabular">
            {fmt.number(op.detectionRisk, {
              style: 'percent',
              maximumFractionDigits: 0,
            })}
          </span>
        </span>
      </div>
      {/* unused-variable guard for `ratio` (kept for future visualizations). */}
      <span className="hidden" data-ratio={ratio.toFixed(2)} />
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

export default SpiesPanel;

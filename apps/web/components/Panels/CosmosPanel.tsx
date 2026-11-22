'use client';

// Cosmos panel — the long game. Shows where the player's civilisation sits
// on the Kardashev scale, what is under construction, and the full ladder
// of megaprojects from Earth to the stars, grouped by destination.

import {
  Check,
  ChevronDown,
  Lock,
  Rocket,
  Star,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  COSMOS_PROJECTS,
  cosmosColonists,
  cosmosSlots,
  getProjectStatus,
  kardashevToWatts,
  kardashevType,
  effectiveProjectCost,
  type CosmosProjectDef,
  type CosmosProjectStatus,
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import type { ScenarioId } from '../../lib/scenarios';
import { selectPlayerCountry, useGameStore, type MapView } from '../../lib/store';

import { useScenarioMessages } from './shared/useScenarioMessages';

const STAGES = [0, 1, 2, 3, 4, 5, 6] as const;

/** Stage → the stage view that shows it, when there is one. */
const STAGE_VIEW: Partial<Record<number, MapView>> = {
  0: 'earth',
  2: 'moon',
  3: 'mars',
  4: 'system',
  5: 'system',
  6: 'system',
};

function wattsLabel(watts: number): string {
  const exp = Math.floor(Math.log10(watts));
  const mantissa = watts / 10 ** exp;
  const sup = String(exp).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]!);
  return `${mantissa.toFixed(1)} × 10${sup} W`;
}

export function CosmosPanel({ onErrors }: { onErrors?: (errors: string[]) => void }) {
  const t = useTranslations('cosmos');
  const tErrors = useTranslations();
  const fmt = useFormatter();
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const player = useGameStore(selectPlayerCountry);
  const applyAction = useGameStore((s) => s.applyAction);
  const setMapView = useGameStore((s) => s.setMapView);
  const { t: tScenario } = useScenarioMessages((scenario?.id as ScenarioId | undefined) ?? null);

  const cosmos = state?.cosmos;
  const techCatalog = useMemo(() => scenario?.techTree ?? [], [scenario]);

  const statuses = useMemo(() => {
    const out = new Map<string, CosmosProjectStatus>();
    if (!state) return out;
    for (const def of COSMOS_PROJECTS) out.set(def.id, getProjectStatus(state, def, techCatalog));
    return out;
  }, [state, techCatalog]);

  // Open the first stage that still has something to do.
  const firstOpenStage = useMemo(() => {
    for (const stage of STAGES) {
      const pending = COSMOS_PROJECTS.some(
        (p) => p.stage === stage && statuses.get(p.id)?.status !== 'done',
      );
      if (pending) return stage;
    }
    return 6;
  }, [statuses]);
  const [openStage, setOpenStage] = useState<number | null>(null);
  const activeStage = openStage ?? firstOpenStage;

  if (!state || !cosmos || !player) return null;

  const money = (n: number) =>
    fmt.number(n, { notation: 'compact', maximumFractionDigits: 1 });
  const rating = cosmos.kardashev;
  const type = kardashevType(rating);
  const nextMilestone = type === 0 ? 1 : type === 1 ? 2 : 3;
  const prevMilestone = type === 0 ? 0.7 : type;
  const toNext = Math.max(0, Math.min(1, (rating - prevMilestone) / (nextMilestone - prevMilestone)));
  const slots = cosmosSlots(cosmos);
  const colonists = cosmosColonists(cosmos);

  const nameOfCountry = (id: string) => {
    const c = state.countries[id];
    if (!c) return id;
    const s = tScenario(c.nameKey);
    return s === c.nameKey ? id : s;
  };

  const start = async (def: CosmosProjectDef) => {
    const errors = await applyAction({ type: 'startProject', projectId: def.id });
    if (errors.length > 0) onErrors?.(errors.map((e) => (tErrors.has(e) ? tErrors(e) : e)));
  };
  const cancel = async (id: string) => {
    const errors = await applyAction({ type: 'cancelProject', projectId: id });
    if (errors.length > 0) onErrors?.(errors.map((e) => (tErrors.has(e) ? tErrors(e) : e)));
  };

  // Space race scoreboard: the player against the three most advanced rivals.
  const race = [
    { id: player.id, done: cosmos.completed.length, isPlayer: true },
    ...Object.entries(cosmos.rivals).map(([id, r]) => ({
      id,
      done: r.completed.length,
      isPlayer: false,
    })),
  ]
    .sort((a, b) => b.done - a.done)
    .slice(0, 4);
  const playerFirsts = Object.values(cosmos.firsts).filter((c) => c === player.id).length;

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="cosmos-panel">
      {/* ---- Kardashev gauge ------------------------------------------- */}
      <section
        aria-label={t('kardashev.title')}
        className="rounded-xl border border-accent/25 bg-gradient-to-br from-accent/[0.09] via-transparent to-[#5cc8ff]/[0.06] p-4"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
            {t('kardashev.title')}
          </h3>
          <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
            {t(`kardashev.type.${type}`)}
          </span>
        </div>
        <div className="mt-2 flex items-end gap-3">
          <span className="numeric-tabular font-mono text-4xl font-semibold leading-none text-fg">
            {rating.toFixed(2)}
          </span>
          <span className="pb-1 font-mono text-[11px] text-fg-faint">{wattsLabel(kardashevToWatts(rating))}</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(toNext * 100)}
          aria-label={t('kardashev.toNext', { type: nextMilestone })}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-[#ffd98a] transition-[width] duration-700"
            style={{ width: `${Math.max(3, toNext * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-fg-faint">
          {t('kardashev.toNext', { type: nextMilestone })} · {Math.round(toNext * 100)}%
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-fg-faint">{t('stats.projects')}</dt>
            <dd className="numeric-tabular font-mono text-sm text-fg">
              {cosmos.completed.length}/{COSMOS_PROJECTS.length}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-fg-faint">{t('stats.colonists')}</dt>
            <dd className="numeric-tabular font-mono text-sm text-fg">{money(colonists)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-fg-faint">{t('stats.firsts')}</dt>
            <dd className="numeric-tabular font-mono text-sm text-accent">{playerFirsts}</dd>
          </div>
        </dl>
      </section>

      {/* ---- Under construction ---------------------------------------- */}
      <section aria-label={t('building.title')}>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
            {t('building.title')}
          </h3>
          <span className="font-mono text-[11px] text-fg-faint">
            {t('building.slots', { used: cosmos.active.length, total: slots })}
          </span>
        </div>
        {cosmos.active.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/15 px-3 py-3 text-xs text-fg-faint">
            {t('building.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cosmos.active.map((a) => {
              const def = COSMOS_PROJECTS.find((p) => p.id === a.projectId);
              if (!def) return null;
              const progress = 1 - a.remainingTicks / def.durationTicks;
              return (
                <li key={a.projectId} className="rounded-lg border border-[#5cc8ff]/30 bg-[#5cc8ff]/[0.06] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-fg">{t(`projects.${def.id}.name`)}</span>
                    <button
                      type="button"
                      onClick={() => void cancel(def.id)}
                      title={t('building.cancelHint')}
                      aria-label={t('building.cancel', { name: t(`projects.${def.id}.name`) })}
                      className="rounded p-1 text-fg-faint transition-colors hover:bg-white/10 hover:text-danger focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
                    >
                      <X aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#5cc8ff] transition-[width] duration-500"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-fg-faint">
                    {t('building.remaining', { weeks: a.remainingTicks })}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- The ladder ------------------------------------------------- */}
      <section aria-label={t('ladder.title')} className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
          {t('ladder.title')}
        </h3>
        {STAGES.map((stage) => {
          const projects = COSMOS_PROJECTS.filter((p) => p.stage === stage);
          const done = projects.filter((p) => statuses.get(p.id)?.status === 'done').length;
          const open = stage === activeStage;
          const view = STAGE_VIEW[stage];
          return (
            <div key={stage} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.02]">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenStage(open ? -1 : stage)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
              >
                <span
                  className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold',
                    done === projects.length
                      ? 'bg-success/20 text-success'
                      : done > 0
                        ? 'bg-accent/20 text-accent'
                        : 'bg-white/10 text-fg-faint',
                  )}
                >
                  {done === projects.length ? <Check aria-hidden className="h-3.5 w-3.5" /> : stage + 1}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-fg">{t(`stages.${stage}.name`)}</span>
                  <span className="block text-[11px] text-fg-faint">{t(`stages.${stage}.hint`)}</span>
                </span>
                <span className="font-mono text-[11px] text-fg-faint">
                  {done}/{projects.length}
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn('h-4 w-4 text-fg-faint transition-transform', open && 'rotate-180')}
                />
              </button>
              {open ? (
                <ul className="flex flex-col gap-2 border-t border-white/10 p-2">
                  {view ? (
                    <li>
                      <button
                        type="button"
                        onClick={() => setMapView(view)}
                        className="w-full rounded-md border border-white/10 px-2 py-1.5 text-[11px] font-medium text-fg-muted transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
                      >
                        {t(`viewCta.${view}`)}
                      </button>
                    </li>
                  ) : null}
                  {projects.map((def) => (
                    <ProjectCard
                      key={def.id}
                      def={def}
                      status={statuses.get(def.id)!}
                      price={money(effectiveProjectCost(state, def))}
                      firstBy={cosmos.firsts[def.id]}
                      playerId={player.id}
                      nameOfCountry={nameOfCountry}
                      onStart={() => void start(def)}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </section>

      {/* ---- Space race -------------------------------------------------- */}
      <section aria-label={t('race.title')}>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
          {t('race.title')}
        </h3>
        <ol className="flex flex-col gap-1">
          {race.map((r, i) => (
            <li
              key={r.id}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
                r.isPlayer ? 'bg-accent/10 text-fg' : 'text-fg-muted',
              )}
            >
              <span className="w-4 font-mono text-fg-faint">{i + 1}</span>
              {i === 0 ? <Trophy aria-hidden className="h-3.5 w-3.5 text-accent" /> : <span className="w-3.5" />}
              <span className="flex-1 truncate">{nameOfCountry(r.id)}</span>
              <span className="numeric-tabular font-mono">{t('race.count', { n: r.done })}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function ProjectCard({
  def,
  status,
  price,
  firstBy,
  playerId,
  nameOfCountry,
  onStart,
}: {
  def: CosmosProjectDef;
  status: CosmosProjectStatus;
  price: string;
  firstBy: string | undefined;
  playerId: string;
  nameOfCountry: (id: string) => string;
  onStart: () => void;
}) {
  const t = useTranslations('cosmos');
  const fx = def.effects;
  const chips: string[] = [];
  if (fx.kardashevFloor !== undefined) chips.push(t('fx.type', { type: fx.kardashevFloor }));
  if (fx.kardashev) chips.push(t('fx.kardashev', { v: fx.kardashev.toFixed(fx.kardashev < 0.01 ? 3 : 2) }));
  if (fx.gdpMul) chips.push(t('fx.gdp', { v: Math.round((fx.gdpMul - 1) * 100) }));
  if (fx.research) chips.push(t('fx.research', { v: fx.research }));
  if (fx.popularity) chips.push(t('fx.popularity', { v: fx.popularity }));
  if (fx.slots) chips.push(t('fx.slots', { v: fx.slots }));
  if (fx.prestige) chips.push(t('fx.prestige', { v: fx.prestige }));

  const done = status.status === 'done';
  const building = status.status === 'building';
  const locked = status.status === 'locked';
  const available = status.status === 'available';

  let lockReason: string | null = null;
  if (status.status === 'locked') {
    lockReason =
      status.missingProjects.length > 0
        ? t('lock.requires', {
            list: status.missingProjects.map((id) => t(`projects.${id}.name`)).join(', '),
          })
        : t('lock.spaceTech', { pct: Math.round(status.missingTechShare * 100) });
  } else if (status.status === 'available' && !status.slotFree) {
    lockReason = t('lock.noSlot');
  } else if (status.status === 'available' && !status.affordable) {
    lockReason = t('lock.funds');
  }

  return (
    <li
      data-testid={`cosmos-project-${def.id}`}
      data-status={status.status}
      className={cn(
        'rounded-md border p-2.5',
        done
          ? 'border-success/25 bg-success/[0.05]'
          : building
            ? 'border-[#5cc8ff]/30 bg-[#5cc8ff]/[0.05]'
            : locked
              ? 'border-white/5 opacity-60'
              : 'border-white/10 bg-white/[0.03]',
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-fg-faint">
          {done ? (
            <Check aria-hidden className="h-4 w-4 text-success" />
          ) : locked ? (
            <Lock aria-hidden className="h-4 w-4" />
          ) : building ? (
            <Zap aria-hidden className="h-4 w-4 text-[#5cc8ff]" />
          ) : (
            <Rocket aria-hidden className="h-4 w-4 text-accent" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-[13px] font-semibold leading-tight text-fg">{t(`projects.${def.id}.name`)}</h4>
            {!done ? <span className="numeric-tabular shrink-0 font-mono text-[11px] text-fg-muted">{price}</span> : null}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-fg-faint">{t(`projects.${def.id}.desc`)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {chips.map((c) => (
              <span key={c} className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
                {c}
              </span>
            ))}
            {!done ? (
              <span className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10px] text-fg-faint">
                {t('fx.duration', { weeks: def.durationTicks })}
              </span>
            ) : null}
          </div>
          {firstBy ? (
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-fg-faint">
              <Star aria-hidden className={cn('h-3 w-3', firstBy === playerId ? 'text-accent' : 'text-fg-faint')} />
              {firstBy === playerId ? t('first.you') : t('first.rival', { name: nameOfCountry(firstBy) })}
            </p>
          ) : null}
          {lockReason ? <p className="mt-1.5 text-[11px] text-warning">{lockReason}</p> : null}
          {available ? (
            <button
              type="button"
              onClick={onStart}
              disabled={!status.affordable || !status.slotFree}
              className="mt-2 w-full rounded-md bg-accent px-2 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-fg-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t('start')}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default CosmosPanel;

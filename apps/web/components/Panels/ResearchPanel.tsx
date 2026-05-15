// Research system panel.
// - Shows the player's active research with a progress bar.
// - Lists all techs grouped by branch as cards (cost, prereqs, effects, status).
// - Lets the player start research on an available tech.
//
// Phase 3 Wave 10: hosts a sub-tab control ("Tech tree" | "Corsa allo Spazio").
// The space race tab is rendered by `SpaceRacePanel`, which reads
// `state.spaceMilestones` populated by the engine when scenario techs declare
// `prestigeFirst` / `prestigeFollow`.

'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type {
  TechBranch,
  TechDefinition,
  TechEffect,
  TechId,
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import {
  selectPlayerCountry,
  useGameStore,
  type GameStoreState,
} from '../../lib/store';
import { ScenarioId } from '../../lib/scenarios';
import { toneChip } from '../../lib/theme';
import { ActionButton } from './shared/ActionButton';
import { EmptyState } from './shared/EmptyState';
import { Section } from './shared/Section';
import { StatBar } from './shared/StatBar';
import { useScenarioMessages } from './shared/useScenarioMessages';
import { SpaceRacePanel } from './SpaceRacePanel';

type BranchFilter = 'all' | TechBranch;
type ResearchTab = 'techTree' | 'spaceRace';

const RESEARCH_TABS: readonly ResearchTab[] = ['techTree', 'spaceRace'];

const BRANCH_ORDER: readonly TechBranch[] = [
  'civil',
  'military',
  'intelligence',
  'space',
];

export function ResearchPanel({
  onErrors,
}: {
  onErrors?: (errors: string[]) => void;
}) {
  const t = useTranslations('panelResearch');
  const tShared = useTranslations('panelShared');

  const player = useGameStore(selectPlayerCountry);
  const scenario = useGameStore((s: GameStoreState) => s.scenario);
  const stateTechProgress = useGameStore(
    (s: GameStoreState) =>
      s.state && player ? s.state.techTreeProgress[player.id] : undefined,
  );
  const applyAction = useGameStore((s: GameStoreState) => s.applyAction);

  const techTree = useMemo(() => scenario?.techTree ?? [], [scenario]);
  const scenarioId = (scenario?.id ?? null) as ScenarioId | null;
  const { t: tScenario } = useScenarioMessages(scenarioId);

  // Sub-tab inside the research panel — Tech tree (default) | Space race.
  const [activeTab, setActiveTab] = useState<ResearchTab>('techTree');
  const [filter, setFilter] = useState<BranchFilter>('all');

  const filteredTree = useMemo(() => {
    if (filter === 'all') return techTree;
    return techTree.filter((tech) => tech.branch === filter);
  }, [techTree, filter]);

  const grouped = useMemo(() => {
    const map = new Map<TechBranch, TechDefinition[]>();
    for (const branch of BRANCH_ORDER) map.set(branch, []);
    for (const tech of filteredTree) {
      const arr = map.get(tech.branch);
      if (arr) arr.push(tech);
    }
    return map;
  }, [filteredTree]);

  if (!player || !scenario) {
    return (
      <div className="p-4">
        <EmptyState>{tShared('noPlayer')}</EmptyState>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Sub-tabs: tech tree | space race */}
      <div
        className="flex flex-wrap gap-1"
        role="tablist"
        aria-label={t('tab.label')}
      >
        {RESEARCH_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            id={`research-tab-${tab}`}
            aria-controls={`research-tabpanel-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-medium transition',
              activeTab === tab
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border-strong bg-surface-1 text-fg-muted hover:border-border-strong hover:text-fg',
            )}
          >
            {t(`tab.${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === 'spaceRace' ? (
        <div
          role="tabpanel"
          id="research-tabpanel-spaceRace"
          aria-labelledby="research-tab-spaceRace"
        >
          <SpaceRacePanel />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="research-tabpanel-techTree"
          aria-labelledby="research-tab-techTree"
          className="flex flex-col gap-4"
        >
          <TechTreeView
            t={t}
            tScenario={tScenario}
            techTree={techTree}
            filter={filter}
            setFilter={setFilter}
            grouped={grouped}
            stateTechProgress={stateTechProgress}
            player={player}
            applyAction={applyAction}
            onErrors={onErrors}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tech-tree subview — extracted so the tabs can swap content cleanly while
// the parent component still owns the player/scenario lookups.
// ---------------------------------------------------------------------------

function TechTreeView({
  t,
  tScenario,
  techTree,
  filter,
  setFilter,
  grouped,
  stateTechProgress,
  player,
  applyAction,
  onErrors,
}: {
  t: ReturnType<typeof useTranslations>;
  tScenario: (key: string | undefined | null) => string;
  techTree: TechDefinition[];
  filter: BranchFilter;
  setFilter: (f: BranchFilter) => void;
  grouped: Map<TechBranch, TechDefinition[]>;
  stateTechProgress: { accumulatedPoints: number } | undefined;
  player: NonNullable<ReturnType<typeof selectPlayerCountry>>;
  applyAction: GameStoreState['applyAction'];
  onErrors?: (errors: string[]) => void;
}) {
  const completedSet = new Set(player.science.completedTechs);
  const activeTechId = player.science.activeResearch;
  const activeTech = activeTechId
    ? techTree.find((tech) => tech.id === activeTechId) ?? null
    : null;
  const accumulated = stateTechProgress?.accumulatedPoints ?? 0;
  const researchOutput = player.science.researchOutput;

  const handleStart = (techId: TechId) => async () => {
    return applyAction({ type: 'startResearch', techId });
  };

  return (
    <>
      {/* Active research */}
      <Section
        title={t('active.title')}
        trailing={
          <span className="font-mono text-[11px]">
            {t('active.outputPerTick', {
              n: researchOutput.toFixed(1),
            })}
          </span>
        }
      >
        {activeTech ? (
          <ActiveResearchView
            tech={activeTech}
            accumulated={accumulated}
            output={researchOutput}
            techName={tScenario(activeTech.nameKey)}
          />
        ) : (
          <EmptyState>{t('active.empty')}</EmptyState>
        )}
      </Section>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label={t('filter.label')}>
        {(['all', ...BRANCH_ORDER] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            role="tab"
            aria-selected={filter === f}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
              filter === f
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border-strong bg-surface-1 text-fg-muted hover:border-border-strong',
            )}
          >
            {t(`filter.${f}`)}
          </button>
        ))}
      </div>

      {/* Branches */}
      {BRANCH_ORDER.filter((b) => (filter === 'all' || filter === b)).map((branch) => {
        const techs = grouped.get(branch) ?? [];
        if (techs.length === 0 && filter !== 'all') {
          return (
            <Section key={branch} title={t(`branch.${branch}`)}>
              <EmptyState>{t('emptyBranch')}</EmptyState>
            </Section>
          );
        }
        if (techs.length === 0) return null;
        return (
          <Section
            key={branch}
            title={t(`branch.${branch}`)}
            trailing={`${techs.length}`}
          >
            <ul className="flex flex-col gap-2">
              {techs.map((tech) => (
                <li key={tech.id}>
                  <TechCard
                    tech={tech}
                    completedSet={completedSet}
                    activeTechId={activeTechId}
                    techName={tScenario(tech.nameKey)}
                    techDescription={tScenario(tech.descriptionKey)}
                    onStart={handleStart(tech.id)}
                    onErrors={onErrors}
                  />
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActiveResearchView({
  tech,
  accumulated,
  output,
  techName,
}: {
  tech: TechDefinition;
  accumulated: number;
  output: number;
  techName: string;
}) {
  const t = useTranslations('panelResearch');
  const ratio = tech.cost > 0 ? Math.min(1, accumulated / tech.cost) : 0;
  const remaining = Math.max(0, tech.cost - accumulated);
  const eta = output > 0 ? Math.ceil(remaining / output) : Infinity;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-fg">{techName}</span>
        <span className="text-[11px] text-fg-faint">
          {Number.isFinite(eta)
            ? t('active.eta', { ticks: eta })
            : t('active.etaUnknown')}
        </span>
      </div>
      <StatBar
        label={t('active.progressLabel')}
        value={accumulated}
        max={tech.cost}
        valueLabel={`${Math.round(accumulated)} / ${tech.cost}`}
        tone="info"
      />
      <p className="text-[11px] text-fg-faint">
        {t('active.progressPct', { pct: Math.round(ratio * 100) })}
      </p>
    </div>
  );
}

function TechCard({
  tech,
  completedSet,
  activeTechId,
  techName,
  techDescription,
  onStart,
  onErrors,
}: {
  tech: TechDefinition;
  completedSet: Set<TechId>;
  activeTechId: TechId | null;
  techName: string;
  techDescription: string;
  onStart: () => Promise<string[]>;
  onErrors?: (errors: string[]) => void;
}) {
  const t = useTranslations('panelResearch');
  const tShared = useTranslations('panelShared');

  const completed = completedSet.has(tech.id);
  const inProgress = activeTechId === tech.id;
  const missingPrereqs = tech.prereqs.filter((p) => !completedSet.has(p));
  const prereqsMet = missingPrereqs.length === 0;
  const otherActive = activeTechId !== null && activeTechId !== tech.id;

  let status: 'completed' | 'inProgress' | 'available' | 'locked';
  if (completed) status = 'completed';
  else if (inProgress) status = 'inProgress';
  else if (!prereqsMet) status = 'locked';
  else status = 'available';

  const statusTone: Record<typeof status, string> = {
    completed: 'border-success bg-success/15 text-success',
    inProgress: 'border-accent bg-accent/15 text-accent',
    available: 'border-border-strong bg-surface/40 text-fg',
    locked: 'border-border bg-bg/40 text-fg-faint',
  };

  const disabledReason = completed
    ? t('status.completed')
    : inProgress
      ? t('status.inProgress')
      : !prereqsMet
        ? tShared('prereqsMissing')
        : otherActive
          ? t('disabled.otherActive')
          : null;

  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-md border p-3 transition',
        statusTone[status],
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <h4 className="text-sm font-semibold leading-tight">{techName}</h4>
          <p className="text-[11px] leading-snug text-fg-muted">
            {techDescription}
          </p>
        </div>
        <span className="rounded-full border border-current px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider opacity-80">
          {t(`status.${status}`)}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded bg-surface-2/60 px-2 py-0.5 font-mono numeric-tabular">
          {t('cost', { n: tech.cost })}
        </span>
        {tech.prereqs.length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {tech.prereqs.map((p) => (
              <li
                key={p}
                className={cn(
                  'rounded-full px-2 py-0.5 font-mono text-[10px]',
                  completedSet.has(p)
                    ? toneChip('success')
                    : 'border border-border-strong bg-surface-1 text-fg-faint',
                )}
                title={p}
              >
                {p}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-[11px] italic text-fg-faint">
            {t('noPrereqs')}
          </span>
        )}
      </div>

      {tech.effects.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-[11px] text-fg">
          {tech.effects.map((eff, i) => (
            <li key={i} className="font-mono">
              {summariseEffect(eff)}
            </li>
          ))}
        </ul>
      ) : null}

      {!completed && !inProgress ? (
        <ActionButton
          tone="primary"
          disabledReason={disabledReason}
          onClick={onStart}
          onErrors={onErrors}
        >
          {t('start')}
        </ActionButton>
      ) : null}
    </article>
  );
}

function summariseEffect(eff: TechEffect): string {
  if (eff.type === 'modifyStat') {
    const mult =
      typeof eff.multiplier === 'number' && eff.multiplier !== 1
        ? `×${eff.multiplier}`
        : '';
    const delta =
      eff.delta !== 0
        ? eff.delta > 0
          ? `+${eff.delta}`
          : `${eff.delta}`
        : '';
    const parts = [delta, mult].filter(Boolean).join(' ');
    return `${eff.stat} ${parts}`.trim();
  }
  if (eff.type === 'unlockAction') {
    return `unlock action: ${eff.action}`;
  }
  if (eff.type === 'unlockSpyType') {
    return `unlock spy: ${eff.spyType}`;
  }
  return '';
}

export default ResearchPanel;

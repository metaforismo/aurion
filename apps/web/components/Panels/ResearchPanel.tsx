// Research system panel.
// - Hero shows the current active research (or "no research" + count of
//   available techs) with a thin progress bar.
// - Quick stats: pt/sett + total completed.
// - The full tech tree (branches + cards) lives inside a <Disclosure> that
//   defaults to collapsed — and each branch inside that disclosure is itself
//   a <Disclosure> ("Civile (11) →", …) so the player drills in by interest
//   rather than being shown every tech up-front.
// - The space race sub-tab stays as-is (delegated to SpaceRacePanel).
//
// Phase 3 Wave 10: hosts a sub-tab control ("Tech tree" | "Corsa allo Spazio").

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
import { Disclosure } from './shared/Disclosure';
import { EmptyState } from './shared/EmptyState';
import { PanelHero } from './shared/PanelHero';
import { StatBar } from './shared/StatBar';
import { StickyFooter } from './shared/StickyFooter';
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

  // Pre-compute the first available tech so the sticky footer can offer it
  // as the primary action ("Avvia ricerca") even when the user is deep in
  // the panel. We share the computation with TechTreeView via prop drilling
  // rather than recomputing inside the footer to avoid drift.
  const completedSet = new Set(player.science.completedTechs);
  const activeTechId = player.science.activeResearch;
  const activeTech = activeTechId
    ? techTree.find((tech) => tech.id === activeTechId) ?? null
    : null;
  const firstAvailableTech =
    activeTechId === null
      ? techTree.find(
          (tech) =>
            !completedSet.has(tech.id) &&
            tech.prereqs.every((p) => completedSet.has(p)),
        ) ?? null
      : null;

  // Hero summary — either the active research with progress, or an idle
  // state showing how many techs are available right now.
  const availableCount = techTree.filter(
    (tech) =>
      !completedSet.has(tech.id) &&
      tech.prereqs.every((p) => completedSet.has(p)),
  ).length;

  const accumulatedPoints = stateTechProgress?.accumulatedPoints ?? 0;
  const researchOutput = player.science.researchOutput;
  const heroValue = activeTech
    ? tScenario(activeTech.nameKey)
    : t('heroIdle');
  const heroDeltaLabel = activeTech
    ? `${Math.round(accumulatedPoints)} / ${activeTech.cost}`
    : t('heroAvailable', { n: availableCount });

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Sub-tabs: tech tree | space race */}
      <div
        className="flex flex-wrap gap-4 border-b border-border"
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
              '-mb-px border-b-2 px-0.5 pb-2 text-xs font-medium uppercase tracking-wider transition focus-visible:outline-none',
              activeTab === tab
                ? 'border-accent text-fg'
                : 'border-transparent text-fg-muted hover:text-fg',
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
          {/* Hero — active research with progress, or idle + availability. */}
          <PanelHero
            title={t('title')}
            value={
              <span className="text-base font-semibold text-fg">
                {heroValue}
              </span>
            }
            valueTone={activeTech ? 'accent' : 'muted'}
            quickStats={[
              {
                label: t('pointsPerWeekLabel'),
                value: researchOutput.toFixed(1),
              },
              {
                label: t('completed'),
                value: player.science.completedTechs.length,
              },
            ]}
          />

          {activeTech ? (
            <ActiveResearchProgress
              tech={activeTech}
              accumulated={accumulatedPoints}
              output={researchOutput}
              progressLabel={heroDeltaLabel}
            />
          ) : null}

          {/* Filter chips — kept above the disclosure so a player who knows
              which branch they want can scope before drilling in. */}
          <div className="flex flex-wrap gap-3" role="tablist" aria-label={t('filter.label')}>
            {(['all', ...BRANCH_ORDER] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                role="tab"
                aria-selected={filter === f}
                className={cn(
                  'border-b-2 px-0.5 py-0.5 text-[11px] font-medium uppercase tracking-wider transition focus-visible:outline-none',
                  filter === f
                    ? 'border-accent text-fg'
                    : 'border-transparent text-fg-muted hover:text-fg',
                )}
              >
                {t(`filter.${f}`)}
              </button>
            ))}
          </div>

          {/* Full tech tree — collapsed by default. Each branch is itself a
              nested Disclosure so the user can drill into one branch at a
              time rather than render all 32 techs at once. */}
          <Disclosure summary={tShared('moreDetails')} trailing={t('details')}>
            <TechTreeView
              t={t}
              tScenario={tScenario}
              filter={filter}
              grouped={grouped}
              player={player}
              applyAction={applyAction}
              onErrors={onErrors}
            />
          </Disclosure>
        </div>
      )}

      {/* Sticky primary action — only meaningful when the user is on the
          tech tree tab (the space race tab has no actionable primary), so
          we hide the footer otherwise. Disabled with a helper hint when no
          tech is selected / available. */}
      {activeTab === 'techTree' ? (
        <StickyFooter
          hint={
            activeTechId !== null
              ? tShared('stickyAction.researchInProgress')
              : firstAvailableTech === null
                ? tShared('stickyAction.researchHint')
                : null
          }
        >
          <ActionButton
            tone="primary"
            disabledReason={
              activeTechId !== null
                ? t('disabled.otherActive')
                : firstAvailableTech === null
                  ? tShared('stickyAction.selectFirst')
                  : null
            }
            onClick={async () =>
              firstAvailableTech
                ? applyAction({
                    type: 'startResearch',
                    techId: firstAvailableTech.id,
                  })
                : []
            }
            onErrors={onErrors}
          >
            {firstAvailableTech
              ? `${t('start')}: ${tScenario(firstAvailableTech.nameKey)}`
              : t('start')}
          </ActionButton>
        </StickyFooter>
      ) : null}
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
  filter,
  grouped,
  player,
  applyAction,
  onErrors,
}: {
  t: ReturnType<typeof useTranslations>;
  tScenario: (key: string | undefined | null) => string;
  filter: BranchFilter;
  grouped: Map<TechBranch, TechDefinition[]>;
  player: NonNullable<ReturnType<typeof selectPlayerCountry>>;
  applyAction: GameStoreState['applyAction'];
  onErrors?: (errors: string[]) => void;
}) {
  const completedSet = new Set(player.science.completedTechs);
  const activeTechId = player.science.activeResearch;

  const handleStart = (techId: TechId) => async () => {
    return applyAction({ type: 'startResearch', techId });
  };

  return (
    <div className="flex flex-col">
      {/* Branches — each is itself a nested Disclosure so the player drills
          into one branch at a time. Hidden when filter excludes them. */}
      {BRANCH_ORDER.filter((b) => filter === 'all' || filter === b).map((branch) => {
        const techs = grouped.get(branch) ?? [];
        if (techs.length === 0 && filter !== 'all') {
          return (
            <Disclosure
              key={branch}
              summary={t(`branch.${branch}`)}
              trailing="0"
            >
              <EmptyState>{t('emptyBranch')}</EmptyState>
            </Disclosure>
          );
        }
        if (techs.length === 0) return null;
        return (
          <Disclosure
            key={branch}
            summary={t(`branch.${branch}`)}
            trailing={`${techs.length}`}
          >
            <ul className="flex flex-col divide-y divide-border">
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
          </Disclosure>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActiveResearchProgress({
  tech,
  accumulated,
  output,
  progressLabel,
}: {
  tech: TechDefinition;
  accumulated: number;
  output: number;
  progressLabel: string;
}) {
  const t = useTranslations('panelResearch');
  const ratio = tech.cost > 0 ? Math.min(1, accumulated / tech.cost) : 0;
  const remaining = Math.max(0, tech.cost - accumulated);
  const eta = output > 0 ? Math.ceil(remaining / output) : Infinity;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-[11px] text-fg-faint">
        <span>{t('active.progressPct', { pct: Math.round(ratio * 100) })}</span>
        <span>
          {Number.isFinite(eta)
            ? t('active.eta', { ticks: eta })
            : t('active.etaUnknown')}
        </span>
      </div>
      <StatBar
        label={t('active.progressLabel')}
        value={accumulated}
        max={tech.cost}
        valueLabel={progressLabel}
        tone="info"
      />
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

  // Editorial pass: cards lose their tinted fill — status is communicated by
  // a thin left rule + the inline status chip in the header. Body type colour
  // stays neutral (text-fg) so headlines don't compete.
  const statusTone: Record<typeof status, string> = {
    completed: 'border-l-2 border-success',
    inProgress: 'border-l-2 border-accent',
    available: 'border-l-2 border-border',
    locked: 'border-l-2 border-border opacity-60',
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

  const statusColor =
    status === 'completed'
      ? 'text-success'
      : status === 'inProgress'
        ? 'text-accent'
        : status === 'locked'
          ? 'text-fg-faint'
          : 'text-fg-muted';

  return (
    <article
      className={cn('flex flex-col gap-2 py-3 pl-3 transition', statusTone[status])}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <h4 className="text-sm font-semibold leading-tight text-fg">{techName}</h4>
          <p className="text-[11px] leading-snug text-fg-muted">
            {techDescription}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 font-mono text-[10px] uppercase tracking-[0.14em]',
            statusColor,
          )}
        >
          {t(`status.${status}`)}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="font-mono numeric-tabular text-fg-muted">
          {t('cost', { n: tech.cost })}
        </span>
        {tech.prereqs.length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {tech.prereqs.map((p) => (
              <li
                key={p}
                className={cn(
                  'rounded-sm border px-2 py-0.5 font-mono text-[10px]',
                  completedSet.has(p)
                    ? toneChip('success')
                    : 'border-border text-fg-faint',
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

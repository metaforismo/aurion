'use client';

// Research panel. Leads with the one thing the labs are doing (or the one
// thing they should do next), then lets the player walk the tree one branch
// at a time. The engine researches a single technology at a time and keeps
// no queue, so the panel says so and always names a sensible next pick.

import { ArrowRight, FlaskConical, Sparkles, Trophy } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { policyModifiers, type TechBranch, type TechId } from '@aurion/engine';

import type { ScenarioId } from '../../lib/scenarios';
import { selectPlayerCountry, useGameStore } from '../../lib/store';
import { Button, Card, Chip, EmptyState, Meter, SectionTitle, Segmented } from '../ui';

import { useEngineAction } from './economy/useEngineAction';
import { SpaceBrief } from './research/SpaceBrief';
import { TechRow } from './research/TechRow';
import { BRANCHES, buildTree, recommendNext, spaceGates, weeksFor, type TechNode } from './research/model';
import { useScenarioMessages } from './shared/useScenarioMessages';

export function ResearchPanel({ onErrors }: { onErrors?: (errors: string[]) => void }) {
  const t = useTranslations('panelResearch');
  const fmt = useFormatter();
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const player = useGameStore(selectPlayerCountry);
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  const { t: tScenario } = useScenarioMessages((scenario?.id as ScenarioId | undefined) ?? null);
  const run = useEngineAction('panelResearch', onErrors);

  const techTree = useMemo(() => scenario?.techTree ?? [], [scenario]);
  const completed = player?.science.completedTechs;
  const activeId = player?.science.activeResearch ?? null;
  const nodes = useMemo(() => buildTree(techTree, completed ?? [], activeId), [techTree, completed, activeId]);
  const recommended = useMemo(() => recommendNext(nodes), [nodes]);

  const [pickedBranch, setPickedBranch] = useState<TechBranch | null>(null);
  // `undefined` = follow the default (the tech in progress or the suggestion).
  const [pickedTech, setPickedTech] = useState<TechId | null | undefined>(undefined);
  const [starting, setStarting] = useState<TechId | null>(null);
  const [announcement, setAnnouncement] = useState('');

  if (!state || !player || !scenario) return null;

  const active = activeId ? (nodes.get(activeId) ?? null) : null;
  const focus = active ?? recommended;
  const branch = pickedBranch ?? focus?.tech.branch ?? 'civil';
  const openTech = pickedTech === undefined ? (focus?.tech.id ?? null) : pickedTech;

  // Research grants and the like add points on top of the base output.
  const output = player.science.researchOutput * (1 + (state.policies ? policyModifiers(state).researchMul : 0));
  const accumulated = state.techTreeProgress[player.id]?.accumulatedPoints ?? 0;
  const activeWeeks = active ? weeksFor(active.tech.cost - accumulated, output) : null;
  const doneCount = player.science.completedTechs.length;

  const nameOf = (id: TechId) => {
    const tech = nodes.get(id)?.tech;
    return tech ? tScenario(tech.nameKey) : id;
  };
  const countryName = (id: string) => {
    const country = state.countries[id];
    return country ? tScenario(country.nameKey) : id;
  };

  const jumpTo = (id: TechId) => {
    const node = nodes.get(id);
    if (!node) return;
    setPickedBranch(node.tech.branch);
    setPickedTech(id);
    // The row may be in a branch that is not rendered yet: wait for it.
    requestAnimationFrame(() => document.getElementById(`tech-${id}`)?.scrollIntoView({ block: 'nearest' }));
  };

  const start = async (node: TechNode) => {
    setStarting(node.tech.id);
    const ok = await run({ type: 'startResearch', techId: node.tech.id }, 'sfx.research-start');
    setStarting(null);
    if (ok) {
      setAnnouncement(t('started', { name: tScenario(node.tech.nameKey) }));
      setPickedTech(undefined);
      setPickedBranch(node.tech.branch);
    }
  };

  const inBranch = [...nodes.values()].filter((n) => n.tech.branch === branch);
  const branchDone = inBranch.filter((n) => n.status === 'done').length;
  const tiers = [...new Set(inBranch.map((n) => n.tier))].sort((a, b) => a - b);

  const spaceNodes = [...nodes.values()].filter((n) => n.tech.branch === 'space');
  const spaceDone = spaceNodes.filter((n) => n.status === 'done').length;
  const milestoneTechs = state.spaceMilestones
    ? techTree.filter((tech) => tech.prestigeFirst !== undefined || tech.prestigeFollow !== undefined)
    : [];
  const isMilestone = (id: TechId) => milestoneTechs.some((tech) => tech.id === id);

  const reasonFor = (node: TechNode): string => {
    const weeks = weeksFor(node.tech.cost, output);
    const opens = node.unlocks.filter((id) => nodes.get(id)?.status !== 'done').length;
    if (weeks === null) return t('recommended.reasonNoOutput', { opens });
    return t('recommended.reason', { weeks, opens });
  };

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="research-panel">
      {/* ---- What the labs are doing ------------------------------------- */}
      {active ? (
        <section
          aria-label={t('hero.active')}
          data-testid="research-active"
          className="rounded-xl border border-[#5cc8ff]/30 bg-gradient-to-br from-[#5cc8ff]/[0.10] via-transparent to-transparent p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
              {t('hero.active')}
            </h3>
            <Chip tone="info">{t(`branch.${active.tech.branch}`)}</Chip>
          </div>
          <p className="mt-2 text-lg font-semibold leading-tight text-fg">{tScenario(active.tech.nameKey)}</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="numeric-tabular font-mono text-4xl font-semibold leading-none text-fg">
              {activeWeeks ?? '∞'}
            </span>
            <span className="pb-0.5 text-[12px] text-fg-muted">
              {activeWeeks === null ? t('hero.neverUnit') : t('hero.weeksUnit', { weeks: activeWeeks })}
            </span>
          </div>
          <Meter
            className="mt-3"
            thick
            tone="info"
            value={active.tech.cost > 0 ? accumulated / active.tech.cost : 0}
            label={t('detail.progress')}
            valueLabel={t('points', { done: Math.floor(accumulated), total: active.tech.cost })}
          />
          {recommended ? (
            <button
              type="button"
              onClick={() => jumpTo(recommended.tech.id)}
              className="mt-3 flex w-full items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-left text-[11px] text-fg-muted transition-colors hover:border-white/25 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-fg-faint" />
              <span className="min-w-0 flex-1 truncate">
                {t('hero.thenTry', { name: tScenario(recommended.tech.nameKey) })}
              </span>
            </button>
          ) : null}
        </section>
      ) : recommended ? (
        <section
          aria-label={t('hero.idle')}
          data-testid="research-idle"
          className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/[0.10] via-transparent to-transparent p-4"
        >
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">{t('hero.idle')}</h3>
          <p className="mt-1 text-[12px] leading-snug text-fg-muted">{t('hero.idleHint')}</p>
          <div className="mt-3 flex items-start gap-2">
            <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-fg-faint">
                {t('recommended.label')} · {t(`branch.${recommended.tech.branch}`)}
              </p>
              <p className="text-lg font-semibold leading-tight text-fg">{tScenario(recommended.tech.nameKey)}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{reasonFor(recommended)}</p>
            </div>
          </div>
          <Button
            className="mt-3"
            variant="primary"
            block
            icon={FlaskConical}
            loading={starting === recommended.tech.id}
            onClick={() => void start(recommended)}
            data-testid="research-start-recommended"
          >
            {t('startNamed', { points: recommended.tech.cost })}
          </Button>
        </section>
      ) : (
        <Card tone="success" className="flex items-start gap-2.5" data-testid="research-complete">
          <Trophy aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <div>
            <p className="text-sm font-medium text-fg">{t('hero.allDone')}</p>
            <p className="text-xs leading-relaxed text-fg-muted">{t('hero.allDoneHint')}</p>
          </div>
        </Card>
      )}

      <dl className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-white/[0.05] px-2 py-1.5">
          <dt className="text-[10px] uppercase tracking-wider text-fg-faint">{t('stats.output')}</dt>
          <dd className="numeric-tabular font-mono text-sm text-fg" data-testid="research-output">
            {t('stats.outputValue', { n: fmt.number(output, { maximumFractionDigits: 1 }) })}
          </dd>
        </div>
        <div className="rounded-lg bg-white/[0.05] px-2 py-1.5">
          <dt className="text-[10px] uppercase tracking-wider text-fg-faint">{t('stats.done')}</dt>
          <dd className="numeric-tabular font-mono text-sm text-fg">
            {doneCount}/{techTree.length}
          </dd>
        </div>
      </dl>
      <p className="-mt-2 text-[11px] leading-snug text-fg-faint">
        {output > 0 ? t('rules') : t('rulesNoOutput')}
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* ---- The tree, one branch at a time ------------------------------ */}
      <section aria-label={t('tree.title')} className="flex flex-col gap-3">
        <SectionTitle aside={t('tree.count', { done: branchDone, total: inBranch.length })}>
          {t('tree.title')}
        </SectionTitle>
        <Segmented<TechBranch>
          label={t('tree.branchLabel')}
          size="sm"
          className="flex w-full"
          value={branch}
          onChange={(value) => {
            setPickedBranch(value);
            setPickedTech(null);
          }}
          options={BRANCHES.map((b) => ({ value: b, label: t(`branch.${b}`) }))}
        />
        <p className="-mt-1 text-[11px] leading-snug text-fg-faint">{t(`branchHint.${branch}`)}</p>

        {branch === 'space' && spaceNodes.length > 0 ? (
          <SpaceBrief
            done={spaceDone}
            total={spaceNodes.length}
            gates={state.cosmos ? spaceGates(spaceNodes.length, spaceDone) : []}
            milestoneTechs={milestoneTechs}
            milestones={state.spaceMilestones}
            playerId={player.id}
            nameOf={nameOf}
            countryName={countryName}
            onJump={jumpTo}
            onOpenCosmos={() => setSelectedPanel('cosmos')}
          />
        ) : null}

        {inBranch.length === 0 ? (
          <EmptyState icon={FlaskConical}>{t('tree.empty')}</EmptyState>
        ) : (
          tiers.map((tier) => (
            <div key={tier} className="flex flex-col gap-1.5">
              <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-fg-faint">
                {t('tree.tier', { n: tier })}
                <span aria-hidden className="h-px flex-1 bg-white/10" />
              </p>
              <ul className="flex flex-col gap-1.5">
                {inBranch
                  .filter((n) => n.tier === tier)
                  .map((node) => (
                    <TechRow
                      key={node.tech.id}
                      node={node}
                      name={tScenario(node.tech.nameKey)}
                      description={tScenario(node.tech.descriptionKey)}
                      open={openTech === node.tech.id}
                      onToggle={() => setPickedTech(openTech === node.tech.id ? null : node.tech.id)}
                      recommended={recommended?.tech.id === node.tech.id}
                      output={output}
                      accumulated={node.status === 'researching' ? accumulated : 0}
                      busyWith={
                        active && active.tech.id !== node.tech.id
                          ? { name: tScenario(active.tech.nameKey), weeksLeft: activeWeeks }
                          : null
                      }
                      nameOf={nameOf}
                      isDone={(id) => nodes.get(id)?.status === 'done'}
                      onJump={jumpTo}
                      onStart={() => void start(node)}
                      starting={starting === node.tech.id}
                      milestone={
                        isMilestone(node.tech.id)
                          ? { entry: state.spaceMilestones?.[node.tech.id], playerId: player.id, countryName }
                          : null
                      }
                    />
                  ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export default ResearchPanel;

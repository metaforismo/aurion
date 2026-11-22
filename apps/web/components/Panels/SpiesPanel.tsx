'use client';

// Intelligence panel — the agents on hand, what is known about the country
// selected on the globe, the operations that can be run against it, and the
// record of those already in the field or concluded.

import type { IntelLevel, SpyOperation } from '@aurion/engine';
import { Check, Eye, ShieldAlert, UserSearch, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { cn } from '../../lib/cn';
import { percent } from '../../lib/format';
import { useGameStore } from '../../lib/store';
import { Card, Chip, EmptyState, Meter, Row, SectionTitle, Stat, type Tone } from '../ui';

import { CountryPicker, type PickerItem } from './diplomacy/CountryPicker';
import { Fact, PanelLink, StanceChip, TargetHeader } from './diplomacy/parts';
import {
  cash,
  knowsFigures,
  stanceOf,
  useWorld,
  type World,
} from './diplomacy/world';
import { Composer, OP_ICON } from './spies/Composer';
import { INTEL_EDGE, INTEL_LEVELS } from './spies/ops';

/** Price of one agent (engine: `invest` → intel, COST_PER_SPY). */
const AGENT_COST = 50_000_000;

const INTEL_TONE: Record<IntelLevel, Tone> = {
  none: 'neutral',
  rumors: 'warning',
  partial: 'info',
  full: 'success',
};

export function SpiesPanel({ onErrors }: { onErrors?: (errors: string[]) => void }) {
  const t = useTranslations('panelSpies');
  const w = useWorld();

  const items = useMemo<PickerItem[]>(() => {
    if (!w) return [];
    return w.others.map((c) => {
      const level = w.intelOn(c.id);
      const running = w.state.spyOperations.filter(
        (op) => op.ownerCountryId === w.player.id && op.targetCountryId === c.id && op.status === 'active',
      ).length;
      const name = w.nameOf(c.id);
      return {
        id: c.id,
        name,
        color: c.color,
        subtitle: running > 0 ? t('list.running', { n: running }) : w.regionName(c.regionId),
        trailing: <Chip tone={INTEL_TONE[level]}>{t(`intelChip.${level}`)}</Chip>,
        sort: { intel: INTEL_LEVELS.indexOf(level), name },
      };
    });
  }, [w, t]);

  if (!w) return null;

  const mine = w.state.spyOperations.filter((op) => op.ownerCountryId === w.player.id);
  const active = mine.filter((op) => op.status === 'active');
  // Concluded operations, plus foreign ones caught on the player's soil.
  const reports = w.state.spyOperations
    .filter(
      (op) =>
        op.status !== 'active' &&
        (op.ownerCountryId === w.player.id || (op.targetCountryId === w.player.id && op.status === 'detected')),
    )
    .sort((a, b) => b.startedAtTick + b.durationTicks - (a.startedAtTick + a.durationTicks));

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="spies-panel">
      <Network w={w} inField={active.length} />

      {w.target ? (
        <section aria-label={t('dossier.label', { name: w.nameOf(w.target.id) })} className="flex flex-col gap-2" data-testid="spy-dossier">
          <Dossier w={w} />
          <SectionTitle>{t('composer.title')}</SectionTitle>
          <Composer key={w.target.id} w={w} target={w.target} onErrors={onErrors} />
        </section>
      ) : (
        <EmptyState icon={UserSearch} title={t('pick.title')}>
          {t('pick.body')}
        </EmptyState>
      )}

      <section aria-label={t('active.title')} className="flex flex-col gap-2">
        <SectionTitle aside={active.length}>{t('active.title')}</SectionTitle>
        {active.length === 0 ? (
          <EmptyState>{t('active.empty')}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((op) => (
              <ActiveOp key={op.id} w={w} op={op} />
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t('reports.title')} className="flex flex-col gap-2">
        <SectionTitle aside={reports.length}>{t('reports.title')}</SectionTitle>
        {reports.length === 0 ? (
          <EmptyState>{t('reports.empty')}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-1" aria-live="polite">
            {reports.slice(0, 8).map((op) => (
              <Report key={op.id} w={w} op={op} />
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t('list.title')} className="flex flex-col gap-2">
        <SectionTitle aside={w.others.length}>{t('list.title')}</SectionTitle>
        <CountryPicker
          label={t('list.title')}
          testIdPrefix="spy-country"
          items={items}
          selectedId={w.target?.id ?? null}
          onPick={w.selectTarget}
          sorts={[
            { id: 'intel', label: t('list.sortIntel') },
            { id: 'name', label: t('list.sortName') },
          ]}
          limit={6}
        />
      </section>
    </div>
  );
}

/** Hero: agents on hand, agents in the field, and the home defences. */
function Network({ w, inField }: { w: World; inField: number }) {
  const t = useTranslations('panelSpies');
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  const intel = w.player.intelligence;
  // The engine shifts 0.4 of the defender's counter-intelligence onto the odds.
  const shield = Math.round(intel.counterIntelLevel * 40);

  return (
    <section
      aria-label={t('network.label')}
      className="rounded-xl border border-[#5cc8ff]/30 bg-gradient-to-br from-[#5cc8ff]/[0.10] via-transparent to-accent/[0.04] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <Stat
          size="lg"
          tone={intel.spyCount > 0 ? 'neutral' : 'warning'}
          label={t('network.agents')}
          value={intel.spyCount}
          hint={t('network.agentsHint')}
        />
        <Chip tone={inField > 0 ? 'info' : 'neutral'} icon={Eye}>
          {t('network.inField', { n: inField })}
        </Chip>
      </div>
      <Meter
        className="mt-3"
        tone="info"
        value={intel.counterIntelLevel}
        label={t('network.counterIntel')}
        valueLabel={percent(intel.counterIntelLevel, w.locale)}
      />
      <p className="mt-2 text-[11px] leading-snug text-fg-faint">{t('network.counterIntelHint', { points: shield })}</p>
      <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-snug text-fg-muted">
        {t('network.recruit', { cost: cash(AGENT_COST, w.locale, 0) })}{' '}
        <PanelLink onClick={() => setSelectedPanel('economy')}>{t('network.toEconomy')}</PanelLink>
      </p>
    </section>
  );
}

/** What is known about the selected country, and what that knowledge is worth. */
function Dossier({ w }: { w: World }) {
  const t = useTranslations('panelSpies');
  const target = w.target;
  if (!target) return null;
  const level = w.intelOn(target.id);
  const step = INTEL_LEVELS.indexOf(level);
  const known = knowsFigures(level);

  return (
    <Card className="flex flex-col gap-3">
      <TargetHeader
        name={w.nameOf(target.id)}
        color={target.color}
        aside={<StanceChip stance={stanceOf(w.relation(target.id))} />}
        caption={`${w.tScenario(target.capitalKey)} · ${w.regionName(target.regionId)}`}
        onClear={() => w.selectTarget(null)}
      />
      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-[11px]">
          <span className="text-fg-muted">{t('dossier.intel')}</span>
          <span className="font-semibold text-fg">{t(`intel.${level}`)}</span>
        </div>
        <ol className="grid grid-cols-4 gap-1" aria-label={t('dossier.intelScale')}>
          {INTEL_LEVELS.map((l, i) => (
            <li
              key={l}
              aria-current={l === level ? 'step' : undefined}
              className={cn(
                'rounded-md px-1 py-1 text-center text-[10px] font-medium',
                i <= step && step > 0 ? 'bg-[#5cc8ff]/20 text-[#8ad8ff]' : i === 0 && step === 0 ? 'bg-white/10 text-fg-muted' : 'bg-white/[0.04] text-fg-faint',
              )}
            >
              {t(`intel.${l}`)}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[11px] leading-snug text-fg-muted">{t(`intelDetail.${level}`)}</p>
      </div>
      <dl className="flex flex-col gap-1 border-t border-white/10 pt-2.5">
        <Fact label={t('dossier.edge')} tone="info" words={INTEL_EDGE[level] === 0}>
          {t('dossier.edgeValue', { points: INTEL_EDGE[level] })}
        </Fact>
        <Fact label={t('dossier.defences')} words={!known}>
          {known ? percent(target.intelligence.counterIntelLevel, w.locale) : t('dossier.unknown')}
        </Fact>
        <Fact label={t('dossier.techs')} words={!known}>
          {known ? target.science.completedTechs.length : t('dossier.unknown')}
        </Fact>
      </dl>
    </Card>
  );
}

function ActiveOp({ w, op }: { w: World; op: SpyOperation }) {
  const t = useTranslations('panelSpies');
  const Icon = OP_ICON[op.type];
  const left = Math.max(0, op.durationTicks - op.progressTicks);
  return (
    <li>
      <Card tone="info" data-testid="spy-active-op" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-fg">
            <Icon aria-hidden className="h-4 w-4 shrink-0 text-[#8ad8ff]" />
            <span className="truncate">{t('active.line', { op: t(`type.${op.type}`), name: w.nameOf(op.targetCountryId) })}</span>
          </span>
          <button
            type="button"
            onClick={() => w.selectTarget(op.targetCountryId)}
            className="shrink-0 rounded text-[11px] text-fg-faint underline-offset-2 hover:text-fg hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t('active.show')}
          </button>
        </div>
        <Meter
          tone="info"
          value={op.durationTicks > 0 ? op.progressTicks / op.durationTicks : 0}
          label={t('active.eta', { weeks: left })}
          valueLabel={`${op.progressTicks}/${op.durationTicks}`}
        />
        <p className="flex gap-3 font-mono text-[11px]">
          <span className="text-success">
            {t('composer.successShort')} {percent(op.successProbability, w.locale)}
          </span>
          <span className="text-[#ff8a7d]">
            {t('composer.detectionShort')} {percent(op.detectionRisk, w.locale)}
          </span>
        </p>
      </Card>
    </li>
  );
}

function Report({ w, op }: { w: World; op: SpyOperation }) {
  const t = useTranslations('panelSpies');
  const foreign = op.ownerCountryId !== w.player.id;
  const weeksAgo = Math.max(0, w.state.tick - (op.startedAtTick + op.durationTicks));
  // An exposed operation may still have worked; only a stolen technology
  // leaves proof the player can check.
  const gotTech =
    op.payload.kind === 'steal_tech' && w.player.science.completedTechs.includes(op.payload.techId);
  const verdict = foreign
    ? t('reports.caught', { name: w.nameOf(op.ownerCountryId), op: t(`type.${op.type}`) })
    : op.status === 'completed'
      ? t('reports.completed', { op: t(`type.${op.type}`), name: w.nameOf(op.targetCountryId) })
      : op.status === 'failed'
        ? t('reports.failed', { op: t(`type.${op.type}`), name: w.nameOf(op.targetCountryId) })
        : gotTech
          ? t('reports.detectedButDone', { op: t(`type.${op.type}`), name: w.nameOf(op.targetCountryId) })
          : t('reports.detected', { op: t(`type.${op.type}`), name: w.nameOf(op.targetCountryId) });
  const Icon = foreign ? ShieldAlert : op.status === 'completed' ? Check : op.status === 'failed' ? X : Eye;
  const tone = foreign ? 'text-[#8ad8ff]' : op.status === 'completed' ? 'text-success' : op.status === 'failed' ? 'text-fg-faint' : 'text-[#ff8a7d]';
  return (
    <li>
      <Row
        testId="spy-report"
        leading={<Icon aria-hidden className={cn('h-4 w-4', tone)} />}
        title={<span className="whitespace-normal text-[12px] leading-snug">{verdict}</span>}
        subtitle={t('reports.when', { weeks: weeksAgo })}
        className="py-1.5"
      />
    </li>
  );
}

export default SpiesPanel;

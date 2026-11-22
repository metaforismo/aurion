'use client';

// Diplomacy panel — where every other nation stands toward the player, what
// can be done about the one selected on the globe, and the blocs that group
// them. Opens on the figure a diplomat counts first: allies.

import type { VictoryRule } from '@aurion/engine';
import { Flag, Handshake } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { percent } from '../../lib/format';
import { Chip, EmptyState, Meter, SectionTitle, Stat } from '../ui';

import { Blocs } from './diplomacy/Blocs';
import { CountryPicker, type PickerItem } from './diplomacy/CountryPicker';
import { Dossier } from './diplomacy/Dossier';
import { AttitudeValue, StanceChip } from './diplomacy/parts';
import { stanceOf, useWorld, type World } from './diplomacy/world';

/** The alliance-based goal inside a victory rule, if it has one. */
function allianceGoal(rule: VictoryRule | undefined, rivals: number): { need: number; kind: 'coverage' | 'control'; value: number } | null {
  if (!rule) return null;
  switch (rule.kind) {
    case 'allianceCoverage':
      return { kind: 'coverage', value: rule.minPercent, need: Math.ceil((rule.minPercent / 100) * rivals) };
    case 'controlNCountries':
      // The engine counts the player plus every ally.
      return { kind: 'control', value: rule.n, need: rule.n - 1 };
    case 'and':
    case 'or': {
      for (const r of rule.rules) {
        const found = allianceGoal(r, rivals);
        if (found) return found;
      }
      return null;
    }
    default:
      return null;
  }
}

export function DiplomacyPanel({ onErrors }: { onErrors?: (errors: string[]) => void }) {
  const t = useTranslations('panelDiplomacy');
  const w = useWorld();

  const items = useMemo<PickerItem[]>(() => {
    if (!w) return [];
    return w.others.map((c) => {
      const rel = w.relation(c.id);
      const stance = stanceOf(rel);
      const tags: string[] = [];
      if (stance === 'ally') tags.push('allies');
      if (rel.atWar || rel.treaties.includes('sanctions') || rel.attitude <= -25) tags.push('hostile');
      if (!rel.atWar && !rel.treaties.includes('alliance') && rel.attitude >= 0) tags.push('open');
      const name = w.nameOf(c.id);
      return {
        id: c.id,
        name,
        color: c.color,
        subtitle:
          rel.treaties.length > 0
            ? rel.treaties.map((k) => t(`treaty.${k}`)).join(' · ')
            : t('noTreaties'),
        trailing: (
          <span className="flex items-center gap-2">
            {stance === 'war' || stance === 'ally' ? <StanceChip stance={stance} /> : null}
            <AttitudeValue attitude={rel.attitude} className="w-8 text-right text-xs" />
          </span>
        ),
        sort: { attitude: rel.attitude, name },
        tags,
      };
    });
  }, [w, t]);

  if (!w) return null;

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="diplomacy-panel">
      <Standing w={w} />

      {w.target ? (
        <Dossier w={w} target={w.target} onErrors={onErrors} />
      ) : (
        <EmptyState icon={Flag} title={t('pick.title')}>
          {t('pick.body')}
        </EmptyState>
      )}

      <section aria-label={t('countries.title')} className="flex flex-col gap-2">
        <SectionTitle aside={w.others.length}>{t('countries.title')}</SectionTitle>
        <CountryPicker
          label={t('countries.title')}
          testIdPrefix="diplomacy-country"
          items={items}
          selectedId={w.target?.id ?? null}
          onPick={w.selectTarget}
          sorts={[
            { id: 'attitude', label: t('sort.attitude') },
            { id: 'name', label: t('sort.alpha') },
          ]}
          filters={[
            { id: 'allies', label: t('filter.allies') },
            { id: 'open', label: t('filter.open') },
            { id: 'hostile', label: t('filter.hostile') },
          ]}
          limit={8}
        />
      </section>

      {w.state.blocs ? <Blocs w={w} onErrors={onErrors} /> : null}
    </div>
  );
}

/** Hero: allies first, then the temperature of the world and the win track. */
function Standing({ w }: { w: World }) {
  const t = useTranslations('panelDiplomacy');
  const rels = w.others.map((c) => w.relation(c.id));
  const allies = rels.filter((r) => r.treaties.includes('alliance')).length;
  const wars = rels.filter((r) => r.atWar).length;
  const sanctions = rels.filter((r) => r.treaties.includes('sanctions')).length;
  const trade = rels.filter((r) => r.treaties.includes('tradeDeal')).length;
  const tension = w.state.worldTension;

  const rule = w.scenario?.victoryConditions.find((v) => v.id === w.state.selectedVictoryCondition)?.rule;
  const goal = allianceGoal(rule, w.others.length);

  return (
    <section
      aria-label={t('hero.label')}
      className="rounded-xl border border-accent/25 bg-gradient-to-br from-accent/[0.09] via-transparent to-success/[0.05] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <Stat
          size="lg"
          label={t('hero.allies')}
          value={
            <>
              {allies}
              <span className="ml-1.5 text-sm font-normal text-fg-faint">{t('hero.ofNations', { n: w.others.length })}</span>
            </>
          }
        />
        {wars > 0 ? (
          <Chip tone="danger">{t('hero.wars', { n: wars })}</Chip>
        ) : (
          <Chip tone="success" icon={Handshake}>
            {t('hero.atPeace')}
          </Chip>
        )}
      </div>

      {goal ? (
        <Meter
          className="mt-3"
          tone="accent"
          value={goal.need > 0 ? allies / goal.need : 1}
          label={
            goal.kind === 'coverage'
              ? t('hero.goalCoverage', { pct: percent(goal.value / 100, w.locale) })
              : t('hero.goalControl', { n: goal.value })
          }
          valueLabel={`${allies}/${goal.need}`}
        />
      ) : null}

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
        <Stat size="sm" label={t('hero.trade')} value={trade} tone={trade > 0 ? 'info' : 'neutral'} />
        <Stat size="sm" label={t('hero.sanctions')} value={sanctions} tone={sanctions > 0 ? 'warning' : 'neutral'} />
        <Stat size="sm" label={t('hero.tension')} value={`${Math.round(tension)}/100`} tone={tension >= 75 ? 'danger' : tension >= 50 ? 'warning' : 'neutral'} />
      </dl>
      <p className="mt-2 text-[11px] leading-snug text-fg-faint">{t('hero.tensionHint')}</p>
    </section>
  );
}

export default DiplomacyPanel;

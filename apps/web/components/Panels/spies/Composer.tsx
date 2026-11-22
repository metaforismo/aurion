'use client';

// Planning a covert operation against the selected country: choose the kind,
// set its one parameter, read odds, length, price and consequences — then
// commit an agent.

import type { Country, SpyOperationType } from '@aurion/engine';
import { Crosshair, Cpu, Flame, Lock, Megaphone, Users, UserSearch, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { cn } from '../../../lib/cn';
import { percent } from '../../../lib/format';
import { useGameStore } from '../../../lib/store';
import { Button, Card, Meter, Segmented, Stat } from '../../ui';
import { PanelLink } from '../diplomacy/parts';
import { useCommit, type World } from '../diplomacy/world';

import {
  DURATION_WEEKS,
  FACTIONS,
  ROLES,
  SABOTAGE_TARGETS,
  SPY_TYPES,
  isUnlocked,
  oddsFor,
  payloadOf,
  stealable,
  unlockingTechs,
  type Draft,
} from './ops';

export const OP_ICON: Record<SpyOperationType, LucideIcon> = {
  steal_tech: Cpu,
  sabotage: Flame,
  propaganda: Megaphone,
  destabilize: Users,
  assassinate: Crosshair,
};

const CHOICE =
  'rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function Composer({
  w,
  target,
  onErrors,
}: {
  w: World;
  target: Country;
  onErrors?: (errors: string[]) => void;
}) {
  const t = useTranslations('panelSpies');
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  const commit = useCommit(onErrors);

  const open = useMemo(
    () => SPY_TYPES.filter((type) => isUnlocked(w.scenario, w.player, type)),
    [w.scenario, w.player],
  );
  const [draft, setDraft] = useState<Draft>({
    type: 'steal_tech',
    techId: null,
    sector: 'industry',
    faction: 'any',
    role: 'head_of_state',
  });
  const [done, setDone] = useState<{ id: string; text: string } | null>(null);

  const techs = stealable(w, target);
  // A theft needs something to take; operations that cannot run against
  // this country stay listed, with the reason, but are never the default.
  const usable = open.filter((k) => k !== 'steal_tech' || techs.length > 0);
  const type = usable.includes(draft.type) ? draft.type : (usable[0] ?? draft.type);
  const techId = draft.techId && techs.includes(draft.techId) ? draft.techId : null;
  const odds = useMemo(
    () => Object.fromEntries(SPY_TYPES.map((k) => [k, oddsFor(w, target, k)])) as Record<SpyOperationType, ReturnType<typeof oddsFor>>,
    [w, target],
  );

  const name = w.nameOf(target.id);
  const agents = w.player.intelligence.spyCount;
  const payload = payloadOf({ ...draft, type, techId });
  const blocked =
    usable.length === 0
      ? t('composer.allLocked')
      : agents < 1
        ? t('composer.noAgents')
        : !payload
          ? t('composer.pickTech')
          : null;

  const effect =
    type === 'sabotage'
      ? t(`outcome.sabotage.${draft.sector === 'military' || draft.sector === 'science' ? draft.sector : 'economy'}`)
      : t(`outcome.${type}`);

  const launch = async () => {
    if (blocked || !payload) return;
    const ok = await commit({
      type: 'deploySpy',
      op: {
        type,
        ownerCountryId: w.player.id,
        targetCountryId: target.id,
        payload,
        durationTicks: DURATION_WEEKS[type],
        // The engine recomputes both; sent only to satisfy the action shape.
        successProbability: odds[type].success,
        detectionRisk: odds[type].detection,
      },
    });
    if (ok) setDone({ id: target.id, text: t('composer.done', { op: t(`type.${type}`), name, weeks: DURATION_WEEKS[type] }) });
  };

  return (
    <div className="flex flex-col gap-2" data-testid="spy-composer">
      <ul role="radiogroup" aria-label={t('composer.type')} className="flex flex-col gap-1">
        {SPY_TYPES.map((k) => {
          const Icon = OP_ICON[k];
          const techLocked = !open.includes(k);
          const locked = !usable.includes(k);
          const active = !locked && k === type;
          const unlock = unlockingTechs(w.scenario, k).map((tech) => w.tScenario(tech.nameKey));
          return (
            <li key={k} role="presentation">
              <button
                type="button"
                role="radio"
                aria-checked={active}
                aria-disabled={locked}
                data-testid={`spy-op-${k}`}
                onClick={() => {
                  if (!locked) setDraft((d) => ({ ...d, type: k }));
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  active
                    ? 'border-[#5cc8ff]/50 bg-[#5cc8ff]/10'
                    : locked
                      ? 'cursor-not-allowed border-white/[0.06] bg-transparent'
                      : 'border-white/[0.08] bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.07]',
                )}
              >
                {techLocked ? (
                  <Lock aria-hidden className="h-4 w-4 shrink-0 text-fg-faint" />
                ) : locked ? (
                  <Icon aria-hidden className="h-4 w-4 shrink-0 text-fg-faint" />
                ) : (
                  <Icon aria-hidden className={cn('h-4 w-4 shrink-0', active ? 'text-[#8ad8ff]' : 'text-fg-muted')} />
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[13px] font-medium', locked ? 'text-fg-muted' : 'text-fg')}>
                    {t(`type.${k}`)}
                  </span>
                  <span className={cn('block text-[11px] leading-snug', locked ? 'text-warning' : 'text-fg-faint')}>
                    {techLocked
                      ? t('composer.lockedBy', { techs: unlock.join(t('composer.or')) })
                      : locked
                        ? t('composer.noStealable', { name })
                        : t(`pitch.${k}`)}
                  </span>
                </span>
                {locked ? null : (
                  <span className="numeric-tabular shrink-0 text-right font-mono text-[11px] leading-tight">
                    <span className="block text-success">{percent(odds[k].success, w.locale)}</span>
                    <span className="block text-[#ff8a7d]">{percent(odds[k].detection, w.locale)}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="flex justify-end gap-3 font-mono text-[10px] text-fg-faint">
        <span className="text-success">■ {t('composer.successShort')}</span>
        <span className="text-[#ff8a7d]">■ {t('composer.detectionShort')}</span>
      </p>

      {usable.length > 0 ? (
        <Card tone="info" className="flex flex-col gap-3">
          {type === 'steal_tech' ? (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-[11px] text-fg-muted">{t('composer.stealTech')}</legend>
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
                {techs.map((id) => {
                  const def = w.scenario?.techTree.find((tech) => tech.id === id);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={techId === id}
                      onClick={() => setDraft((d) => ({ ...d, techId: id }))}
                      className={cn(
                        CHOICE,
                        techId === id
                          ? 'border-[#5cc8ff]/60 bg-[#5cc8ff]/15 text-fg'
                          : 'border-white/10 text-fg-muted hover:border-white/30 hover:text-fg',
                      )}
                    >
                      {def ? w.tScenario(def.nameKey) : id}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {type === 'sabotage' ? (
            <fieldset>
              <legend className="mb-1.5 text-[11px] text-fg-muted">{t('composer.sabotageTarget')}</legend>
              <div className="grid grid-cols-3 gap-1">
                {SABOTAGE_TARGETS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={draft.sector === s}
                    onClick={() => setDraft((d) => ({ ...d, sector: s }))}
                    className={cn(
                      CHOICE,
                      'text-center',
                      draft.sector === s
                        ? 'border-[#5cc8ff]/60 bg-[#5cc8ff]/15 text-fg'
                        : 'border-white/10 text-fg-muted hover:border-white/30 hover:text-fg',
                    )}
                  >
                    {t(`sabotage.${s}`)}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          {type === 'propaganda' ? (
            <fieldset>
              <legend className="mb-1.5 text-[11px] text-fg-muted">{t('composer.propagandaFaction')}</legend>
              <div className="grid grid-cols-3 gap-1">
                {(['any', ...FACTIONS] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={draft.faction === f}
                    onClick={() => setDraft((d) => ({ ...d, faction: f }))}
                    className={cn(
                      CHOICE,
                      'text-center',
                      draft.faction === f
                        ? 'border-[#5cc8ff]/60 bg-[#5cc8ff]/15 text-fg'
                        : 'border-white/10 text-fg-muted hover:border-white/30 hover:text-fg',
                    )}
                  >
                    {t(`faction.${f}`)}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          {type === 'assassinate' ? (
            <Segmented
              size="sm"
              label={t('composer.assassinateRole')}
              value={draft.role}
              onChange={(role) => setDraft((d) => ({ ...d, role }))}
              options={ROLES.map((r) => ({ value: r, label: t(`role.${r}`) }))}
              className="flex"
            />
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Meter tone="success" value={odds[type].success} label={t('composer.success')} valueLabel={percent(odds[type].success, w.locale)} />
            <Meter tone="danger" value={odds[type].detection} label={t('composer.detection')} valueLabel={percent(odds[type].detection, w.locale)} />
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <Stat size="sm" label={t('composer.duration')} value={t('composer.weeks', { n: DURATION_WEEKS[type] })} />
            <Stat size="sm" label={t('composer.cost')} value={t('composer.oneAgent')} hint={t('composer.agentsLeft', { n: agents })} />
          </dl>
          <ul className="flex flex-col gap-1 border-t border-white/10 pt-2.5 text-[11px] leading-snug text-fg-muted">
            <li>
              <span className="font-semibold text-success">{t('composer.ifSuccess')}</span> {effect}
            </li>
            <li>
              <span className="font-semibold text-[#ff8a7d]">{t('composer.ifDetected')}</span> {t('composer.detectedEffect')}
            </li>
            <li className="text-fg-faint">{t('composer.agentLost')}</li>
          </ul>

          <Button
            variant="primary"
            block
            icon={UserSearch}
            disabled={Boolean(blocked)}
            onClick={() => void launch()}
            data-testid="spy-launch"
          >
            {t('composer.submit')}
          </Button>
          {blocked ? (
            <p className="text-[11px] leading-snug text-warning">
              {blocked}{' '}
              {agents < 1 ? (
                <PanelLink onClick={() => setSelectedPanel('economy')}>{t('network.toEconomy')}</PanelLink>
              ) : null}
            </p>
          ) : null}
        </Card>
      ) : (
        <p className="text-[11px] leading-snug text-warning">{t('composer.allLocked')}</p>
      )}
      <p role="status" aria-live="polite" className="text-[11px] text-success empty:hidden">
        {done && done.id === target.id ? done.text : ''}
      </p>
    </div>
  );
}

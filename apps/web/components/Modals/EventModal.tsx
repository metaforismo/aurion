'use client';

// Decision dialog. Time is stopped while it is open, so it has to answer
// everything a player needs to choose well: what happened, what each option
// does (spelled out, not hidden), and which system it touches.

import {
  AlertTriangle,
  Coins,
  Flag,
  Landmark,
  Newspaper,
  Orbit,
  Shield,
  Sparkles,
  UserSearch,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
import {
  describeEventEffect,
  type EventEffect,
  type EventTag,
  type GameEvent,
  type GameState,
  type Scenario,
} from '@aurion/engine';

import { signed } from '../../lib/format';
import type { ScenarioId } from '../../lib/scenarios';
import { useGameStore } from '../../lib/store';
import { useSfx } from '../Audio';
import { useScenarioMessages } from '../Panels/shared/useScenarioMessages';
import { Button, Chip, Kbd, type Tone } from '../ui';

import { Modal } from './Modal';

export type EventModalProps = {
  /** The unresolved event the modal is showing. */
  event: GameEvent;
  /** The active scenario (provides the event definitions). */
  scenario: Scenario;
};

const TAG_META: Record<EventTag, { icon: LucideIcon; tone: Tone }> = {
  politics: { icon: Landmark, tone: 'neutral' },
  faction: { icon: Users, tone: 'neutral' },
  economy: { icon: Coins, tone: 'accent' },
  military: { icon: Shield, tone: 'danger' },
  diplomacy: { icon: Flag, tone: 'info' },
  intelligence: { icon: UserSearch, tone: 'info' },
  space: { icon: Orbit, tone: 'info' },
  social: { icon: Users, tone: 'neutral' },
  crisis: { icon: AlertTriangle, tone: 'warning' },
  opportunity: { icon: Sparkles, tone: 'success' },
  narrative: { icon: Newspaper, tone: 'neutral' },
};

/** Stats where a higher number is bad news for the player. */
const INVERTED_STATS = new Set(['worldTension']);
type EffectChip = { label: string; tone: Tone };

export function EventModal({ event, scenario }: EventModalProps) {
  const t = useTranslations();
  const tFx = useTranslations('eventFx');
  const locale = useLocale();
  const { t: tScenario } = useScenarioMessages(scenario.id as ScenarioId);
  const state = useGameStore((s) => s.state);
  const resolveCurrentEvent = useGameStore((s) => s.resolveCurrentEvent);
  const sfx = useSfx();

  const definition = useMemo(
    () => scenario.eventPool.find((e) => e.id === event.definitionId),
    [scenario.eventPool, event.definitionId],
  );

  const choiceCount = definition?.choices.length ?? 0;
  const pick = (idx: number) => {
    sfx('sfx.confirm');
    resolveCurrentEvent(idx);
  };

  // Number keys pick an option — the dialog is the only thing on screen.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // A milestone moment covers this dialog: its keys belong to it.
      if (document.querySelector('[data-testid="milestone-overlay"]')) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > choiceCount) return;
      e.preventDefault();
      e.stopPropagation();
      sfx('sfx.confirm');
      resolveCurrentEvent(n - 1);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [choiceCount, resolveCurrentEvent, sfx]);

  if (!definition) {
    return (
      <Modal
        title={event.definitionId}
        dismissable={false}
        size="md"
        footer={
          <Button variant="primary" onClick={() => resolveCurrentEvent(0)}>
            {t('common.confirm')}
          </Button>
        }
      >
        <p className="text-fg-muted">{t('modals.event.unknownDefinition', { id: event.definitionId })}</p>
      </Modal>
    );
  }

  const tag = definition.tags?.[0];
  const meta = tag ? TAG_META[tag] : undefined;

  return (
    <Modal
      title={
        <span className="flex flex-col gap-2">
          <Chip tone={meta?.tone ?? 'neutral'} icon={meta?.icon ?? Newspaper} className="self-start">
            {tFx(`tag.${tag ?? 'default'}`)}
          </Chip>
          <span>{tScenario(definition.nameKey)}</span>
        </span>
      }
      dismissable={false}
      size="md"
      descriptionId={`event-${event.definitionId}-desc`}
    >
      <p id={`event-${event.definitionId}-desc`} className="text-[15px] leading-relaxed text-fg-muted">
        {tScenario(definition.descriptionKey)}
      </p>

      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-faint">{tFx('choose')}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {definition.choices.map((choice, idx) => {
          const chips = state
            ? choice.effects
                .map((fx) => describeEffect(fx, state, scenario, tFx, tScenario, locale))
                .filter((c): c is EffectChip => c !== null)
            : [];
          return (
            <li key={`${choice.labelKey}-${idx}`}>
              <button
                type="button"
                onClick={() => pick(idx)}
                aria-label={`${tFx('option', { n: idx + 1 })}: ${tScenario(choice.labelKey)}`}
                className="group w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:border-accent/70 hover:bg-accent/10 focus-visible:border-accent focus-visible:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="flex items-start gap-3">
                  <span className="mt-0.5">
                    <Kbd>{idx + 1}</Kbd>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg">{tScenario(choice.labelKey)}</span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      {chips.length === 0 ? (
                        <Chip>{tFx('none')}</Chip>
                      ) : (
                        chips.map((c, i) => (
                          <Chip key={`${c.label}-${i}`} tone={c.tone}>
                            {c.label}
                          </Chip>
                        ))
                      )}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

function describeEffect(
  fx: EventEffect,
  state: GameState,
  scenario: Scenario,
  tFx: ReturnType<typeof useTranslations<'eventFx'>>,
  tScenario: (key: string) => string,
  locale: string,
): EffectChip | null {
  const nameOf = (id: string) => {
    const c = state.countries[id];
    return c ? tScenario(c.nameKey) : id;
  };
  // The engine tells us what the effect will actually do; we only word it.
  const summary = describeEventEffect(state, fx);
  switch (summary.kind) {
    case 'stat': {
      if (Math.abs(summary.amount) < 1e-9) return null;
      const key = `stat.${summary.stat}`;
      const statLabel = tFx.has(key) ? tFx(key) : summary.stat;
      const sign = summary.amount > 0 ? '+' : '−';
      const abs = Math.abs(summary.amount);
      const amount =
        summary.unit === 'percent'
          ? `${sign}${abs < 10 ? abs.toFixed(1).replace(/\.0$/, '') : Math.round(abs)}%`
          : summary.unit === 'points'
            ? `${sign}${Math.round(abs * 10) / 10}`
            : signed(summary.amount, locale);
      const good = INVERTED_STATS.has(summary.stat) ? summary.amount < 0 : summary.amount > 0;
      const label = `${amount} ${statLabel}`;
      const mine = summary.countryId === null || summary.countryId === state.playerCountryId;
      return mine
        ? { label, tone: good ? 'success' : 'danger' }
        : { label: tFx('other', { name: nameOf(summary.countryId!), label }), tone: 'neutral' };
    }
    case 'attitude':
      return {
        label: `${summary.amount > 0 ? '+' : '−'}${Math.abs(summary.amount)} ${tFx('attitude', { name: nameOf(summary.countryId) })}`,
        tone: summary.amount > 0 ? 'success' : 'danger',
      };
    case 'research': {
      const tech = scenario.techTree.find((x) => x.id === summary.techId);
      return { label: tFx('research', { name: tech ? tScenario(tech.nameKey) : summary.techId }), tone: 'info' };
    }
    case 'none':
      return null;
  }
}

export default EventModal;

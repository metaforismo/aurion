'use client';

// Briefing rail — the right-hand side of the play screen. Two questions,
// always answered: "what should I do next?" (a guided path from the first
// research to the first colony under another sun) and "what just happened?"
// (decisions, the space race, UN votes), newest first.

import {
  AlertTriangle,
  Ban,
  Check,
  ChevronRight,
  Handshake,
  HeartHandshake,
  Landmark,
  Newspaper,
  PanelRightClose,
  PanelRightOpen,
  Rocket,
  ShoppingBag,
  Star,
  Swords,
  Unlink,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { GameState } from '@aurion/engine';

import { cn } from '../../lib/cn';
import type { ScenarioId } from '../../lib/scenarios';
import { useGameStore, type PanelId } from '../../lib/store';
import { useWorldNews, type WorldNewsKind } from '../../lib/world-news';
import { useScenarioMessages } from '../Panels/shared/useScenarioMessages';
import { IconButton, SectionTitle, type Tone } from '../ui';

const COLLAPSED_KEY = 'aurion.briefing.collapsed';
const FEED_LIMIT = 24;
const STEPS_SHOWN = 4;

type Chapter = 'basics' | 'power' | 'space' | 'stars';

type Step = {
  id: string;
  chapter: Chapter;
  panel: PanelId;
  done: (s: GameState) => boolean;
  /** Only offered when this holds (e.g. the scenario has blocs). */
  when?: (s: GameState) => boolean;
};

const me = (s: GameState) => s.countries[s.playerCountryId];
const hasProject = (id: string) => (s: GameState) => s.cosmos?.completed.includes(id) ?? false;
const playerRelations = (s: GameState) =>
  Object.values(s.relations).filter((r) => r.countryA === s.playerCountryId || r.countryB === s.playerCountryId);

/** The guided path, in order. Each step opens the panel where it is done. */
const STEPS: readonly Step[] = [
  { id: 'research', chapter: 'basics', panel: 'research', done: (s) => (me(s)?.science.activeResearch ?? null) !== null || (me(s)?.science.completedTechs.length ?? 0) > 0 },
  { id: 'policy', chapter: 'basics', panel: 'politics', done: (s) => (s.policies?.active.length ?? 0) > 0 },
  { id: 'intel', chapter: 'basics', panel: 'spies', done: (s) => Object.values(me(s)?.intelligence.knownIntel ?? {}).some((l) => l !== 'none') },
  { id: 'treaty', chapter: 'basics', panel: 'diplomacy', done: (s) => playerRelations(s).some((r) => r.treaties.length > 0) },
  { id: 'project', chapter: 'basics', panel: 'cosmos', done: (s) => (s.cosmos?.completed.length ?? 0) + (s.cosmos?.active.length ?? 0) > 0 },
  { id: 'popularity', chapter: 'power', panel: 'politics', done: (s) => (me(s)?.politics.popularity ?? 0) >= 60 },
  { id: 'alliance', chapter: 'power', panel: 'diplomacy', done: (s) => playerRelations(s).some((r) => r.treaties.includes('alliance')) },
  { id: 'techs', chapter: 'power', panel: 'research', done: (s) => (me(s)?.science.completedTechs.length ?? 0) >= 3 },
  { id: 'bloc', chapter: 'power', panel: 'diplomacy', done: (s) => me(s)?.blocId !== undefined, when: (s) => s.blocs !== undefined },
  { id: 'fusion', chapter: 'power', panel: 'cosmos', done: hasProject('earth_fusion') },
  { id: 'spaceport', chapter: 'space', panel: 'cosmos', done: hasProject('earth_spaceport') },
  { id: 'station', chapter: 'space', panel: 'cosmos', done: hasProject('orbit_station') },
  { id: 'moon', chapter: 'space', panel: 'cosmos', done: hasProject('moon_base') },
  { id: 'mars', chapter: 'space', panel: 'cosmos', done: hasProject('mars_mission') },
  { id: 'typeOne', chapter: 'space', panel: 'cosmos', done: (s) => (s.cosmos?.kardashev ?? 0) >= 1 },
  { id: 'swarm', chapter: 'stars', panel: 'cosmos', done: hasProject('sun_swarm_1') },
  { id: 'typeTwo', chapter: 'stars', panel: 'cosmos', done: (s) => (s.cosmos?.kardashev ?? 0) >= 2 },
  { id: 'proxima', chapter: 'stars', panel: 'cosmos', done: hasProject('star_proxima') },
];

type FeedItem = {
  key: string;
  tick: number;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  detail?: string;
  panel?: PanelId;
  pending?: boolean;
};

const NEWS_STYLE: Record<WorldNewsKind, { icon: LucideIcon; tone: Tone }> = {
  warStart: { icon: Swords, tone: 'danger' },
  peace: { icon: HeartHandshake, tone: 'success' },
  alliance: { icon: Handshake, tone: 'success' },
  allianceBroken: { icon: Unlink, tone: 'warning' },
  sanctions: { icon: Ban, tone: 'warning' },
  trade: { icon: ShoppingBag, tone: 'neutral' },
};

const TONE_ICON: Record<Tone, string> = {
  neutral: 'bg-white/10 text-fg-muted',
  accent: 'bg-accent/20 text-accent',
  info: 'bg-[#5cc8ff]/15 text-[#8ad8ff]',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-[#ff5d4d]/15 text-[#ff8a7d]',
};

export function Briefing() {
  const t = useTranslations('briefing');
  const tCosmos = useTranslations('cosmos');
  const tGlobe = useTranslations('globe');
  const worldNews = useWorldNews((s) => s.items);
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const saveId = useGameStore((s) => s.saveId);
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  const { t: tScenario } = useScenarioMessages((scenario?.id as ScenarioId | undefined) ?? null);

  // Read once on mount. The rail only renders after the save has loaded
  // client-side, so the lazy initialiser cannot cause a hydration mismatch.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      if (typeof window === 'undefined') return false;
      const stored = window.localStorage.getItem(COLLAPSED_KEY);
      // No preference yet: open on a desktop, tucked away on a phone.
      return stored === null ? window.matchMedia('(max-width: 1023px)').matches : stored === 'true';
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setCollapsed((prev) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, String(!prev));
      } catch {
        // Preference just won't persist.
      }
      return !prev;
    });
  };

  // A step stays ticked once achieved in this save, even if the underlying
  // number later dips (popularity can fall back under 60).
  const [latched, setLatched] = useState<{ saveId: string | null; ids: ReadonlySet<string> }>({
    saveId: null,
    ids: new Set(),
  });
  const applicable = useMemo(
    () => (state ? STEPS.filter((s) => !s.when || s.when(state)) : []),
    [state],
  );
  // Derived-state update during render (no effect): add newly achieved steps
  // to the latch, or start a fresh one when the save changes.
  if (state) {
    const same = latched.saveId === (saveId ?? null);
    const fresh = applicable.filter((step) => !(same && latched.ids.has(step.id)) && step.done(state));
    if (!same || fresh.length > 0) {
      const ids = new Set(same ? latched.ids : []);
      for (const step of fresh) ids.add(step.id);
      setLatched({ saveId: saveId ?? null, ids });
    }
  }

  const feed = useMemo<FeedItem[]>(() => {
    if (!state) return [];
    const out: FeedItem[] = [];
    const nameOf = (id: string) => {
      const c = state.countries[id];
      return c ? tScenario(c.nameKey) : id;
    };
    state.events.forEach((ev, i) => {
      const def = scenario?.eventPool.find((e) => e.id === ev.definitionId);
      if (!def) return;
      const choice = ev.resolvedChoiceIndex !== null ? def.choices[ev.resolvedChoiceIndex] : undefined;
      out.push({
        key: `event:${i}:${ev.firedAtTick}`,
        tick: ev.firedAtTick,
        icon: ev.resolvedChoiceIndex === null ? AlertTriangle : Newspaper,
        tone: ev.resolvedChoiceIndex === null ? 'warning' : 'neutral',
        title: tScenario(def.nameKey),
        detail: choice ? t('feed.chose', { label: tScenario(choice.labelKey) }) : t('feed.pending'),
        pending: ev.resolvedChoiceIndex === null,
      });
    });
    for (const entry of state.cosmos?.log ?? []) {
      const mine = entry.countryId === state.playerCountryId;
      const project = tCosmos(`projects.${entry.projectId}.name`);
      out.push({
        key: `cosmos:${entry.countryId}:${entry.projectId}`,
        tick: entry.tick,
        icon: entry.first ? Star : Rocket,
        tone: mine ? 'accent' : 'info',
        title: mine
          ? t('feed.cosmosYou', { project })
          : t('feed.cosmosRival', { name: nameOf(entry.countryId), project }),
        detail: entry.first ? t('feed.first') : undefined,
        panel: 'cosmos',
      });
    }
    for (const item of worldNews) {
      const style = NEWS_STYLE[item.kind];
      out.push({
        key: `world:${item.id}`,
        tick: item.tick,
        icon: style.icon,
        tone: style.tone,
        title: tGlobe(`news.${item.kind}`, { a: nameOf(item.a), b: nameOf(item.b) }),
        panel: 'diplomacy',
      });
    }
    for (const res of state.unResolutions ?? []) {
      out.push({
        key: `un:${res.id}`,
        tick: res.proposedAtTick,
        icon: Landmark,
        tone: res.status === 'voting' ? 'warning' : 'neutral',
        title: t(`feed.un.${res.status}`),
        detail: res.targetCountryId ? nameOf(res.targetCountryId) : undefined,
        panel: 'un',
        pending: res.status === 'voting' && res.votes[state.playerCountryId] === undefined,
      });
    }
    return out.sort((a, b) => b.tick - a.tick).slice(0, FEED_LIMIT);
  }, [state, scenario, worldNews, t, tCosmos, tGlobe, tScenario]);

  if (!state) return null;

  const isDone = (step: Step) => latched.ids.has(step.id) || step.done(state);
  const doneCount = applicable.filter(isDone).length;
  const pending = applicable.filter((s) => !isDone(s));
  const shown = pending.slice(0, STEPS_SHOWN);
  const chapter = shown[0]?.chapter;
  const tick = state.tick;
  const age = (since: number) => {
    const weeks = Math.max(0, tick - since);
    if (weeks === 0) return t('age.now');
    return weeks >= 52 ? t('age.years', { n: Math.floor(weeks / 52) }) : t('age.weeks', { n: weeks });
  };
  const attention = feed.filter((f) => f.pending).length;

  if (collapsed) {
    return (
      <aside aria-label={t('title')} data-testid="briefing" data-collapsed="true" data-stage-inset="right" className="pointer-events-auto self-start">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={false}
          aria-label={t('expand')}
          title={t('expand')}
          className="glass-panel flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <PanelRightOpen aria-hidden className="h-4 w-4" />
          {t('title')}
          {attention > 0 ? (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-warning px-1 font-mono text-[10px] font-bold text-black">
              {attention}
            </span>
          ) : null}
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label={t('title')}
      data-testid="briefing"
      data-stage-inset="right"
      className="glass-panel pointer-events-auto flex max-h-full min-h-0 w-full shrink-0 flex-col self-start overflow-hidden rounded-2xl lg:w-[19.5rem]"
    >
      <header className="flex items-center justify-between border-b border-white/10 py-2 pl-4 pr-2">
        <h2 className="text-[15px] font-semibold text-fg">{t('title')}</h2>
        <IconButton icon={PanelRightClose} label={t('collapse')} onClick={toggle} aria-expanded />
      </header>

      <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <section aria-label={t('next.title')} data-testid="objectives-card">
          <SectionTitle aside={t('next.progress', { done: doneCount, total: applicable.length })}>
            {chapter ? t(`next.chapter.${chapter}`) : t('next.title')}
          </SectionTitle>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={applicable.length}
            aria-valuenow={doneCount}
            aria-label={t('next.title')}
            className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"
          >
            <div
              className="h-full rounded-full bg-success transition-[width] duration-500"
              style={{ width: `${(doneCount / Math.max(1, applicable.length)) * 100}%` }}
            />
          </div>
          {shown.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-fg-muted">
              <Check aria-hidden className="h-4 w-4 text-success" />
              {t('next.allDone')}
            </p>
          ) : (
            <ol className="mt-2.5 flex flex-col gap-1">
              {shown.map((step, i) => (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedPanel(step.panel)}
                    data-testid={`step-${step.id}`}
                    className={cn(
                      'group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                      i === 0 ? 'text-fg' : 'text-fg-muted',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'grid h-4 w-4 shrink-0 place-items-center rounded-full border',
                        i === 0 ? 'border-accent' : 'border-white/25',
                      )}
                    >
                      {i === 0 ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">{t(`step.${step.id}`)}</span>
                    <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-fg-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-label={t('feed.title')} className="min-h-0">
          <SectionTitle>{t('feed.title')}</SectionTitle>
          {feed.length === 0 ? (
            <p className="mt-2 text-xs leading-relaxed text-fg-faint">{t('feed.empty')}</p>
          ) : (
            <ol className="mt-2 flex flex-col" aria-live="polite">
              {feed.map((item) => {
                const body = (
                  <>
                    <span className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full', TONE_ICON[item.tone])}>
                      <item.icon aria-hidden className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn('truncate text-[13px] font-medium', item.pending ? 'text-fg' : 'text-fg-muted')}>
                          {item.title}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-fg-faint">{age(item.tick)}</span>
                      </span>
                      {item.detail ? (
                        <span className={cn('block truncate text-[11px]', item.pending ? 'text-warning' : 'text-fg-faint')}>
                          {item.detail}
                        </span>
                      ) : null}
                    </span>
                  </>
                );
                return (
                  <li key={item.key} className="border-b border-white/[0.06] last:border-b-0">
                    {item.panel ? (
                      <button
                        type="button"
                        onClick={() => setSelectedPanel(item.panel!)}
                        className="flex w-full items-start gap-2.5 rounded-lg px-1 py-2 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="flex items-start gap-2.5 px-1 py-2">{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </aside>
  );
}

export default Briefing;

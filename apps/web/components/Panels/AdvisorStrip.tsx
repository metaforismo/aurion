// Advisor strip — the "what should I do now?" answer, pinned above the panel
// content in the left rail.
//
// Reads the same game-state signals as the tab badges (idle research, unvoted
// UN resolution, low popularity, war without deployment) plus two
// onboarding-flavoured ones (no foreign intel yet, no treaties yet) and
// surfaces the top THREE as one-line suggestions. Clicking a suggestion
// switches to the panel where the action lives. When nothing needs attention
// the strip renders nothing — silence reads as "you're on top of things".
//
// The priority order is deliberate: existential threats first (war), then
// time-boxed decisions (UN vote), then growth (research), then stability
// (politics), then expansion (spies / diplomacy).

'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight, Lightbulb } from 'lucide-react';
import { useMemo } from 'react';

import { cn } from '../../lib/cn';
import {
  selectPlayerCountry,
  useGameStore,
  type GameStoreState,
  type PanelId,
} from '../../lib/store';

type Suggestion = {
  /** Panel the suggestion navigates to (also the i18n key under advisor.*). */
  panel: PanelId;
  tone: 'danger' | 'warning' | 'info';
};

const TONE_DOT: Record<Suggestion['tone'], string> = {
  danger: 'var(--color-danger)',
  warning: 'var(--color-warning)',
  info: 'var(--color-info)',
};

const MAX_SUGGESTIONS = 3;

export function AdvisorStrip({
  onNavigate,
}: {
  onNavigate: (panel: PanelId) => void;
}) {
  const t = useTranslations('advisor');
  const state = useGameStore((s: GameStoreState) => s.state);
  const player = useGameStore(selectPlayerCountry);
  const scenario = useGameStore((s: GameStoreState) => s.scenario);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!state || !player) return [];
    const out: Suggestion[] = [];
    const me = player.id;

    // 1 — at war with nothing deployed (existential).
    let atWar = false;
    for (const rel of Object.values(state.relations)) {
      if (rel.atWar && (rel.countryA === me || rel.countryB === me)) {
        atWar = true;
        break;
      }
    }
    if (atWar && player.military.deployedUnits.length === 0) {
      out.push({ panel: 'military', tone: 'danger' });
    }

    // 2 — a UN resolution is waiting on the player's vote (time-boxed).
    const unvoted = (state.unResolutions ?? []).some(
      (r) => r.status === 'voting' && r.votes[me] === undefined,
    );
    if (unvoted) {
      out.push({ panel: 'un', tone: 'danger' });
    }

    // 3 — labs idle while researchable tech exists (growth).
    const completed = new Set(player.science.completedTechs);
    const hasAvailableTech = (scenario?.techTree ?? []).some(
      (tech) =>
        !completed.has(tech.id) && tech.prereqs.every((p) => completed.has(p)),
    );
    if (player.science.activeResearch === null && hasAvailableTech) {
      out.push({ panel: 'research', tone: 'warning' });
    }

    // 4 — popularity in the danger band (stability).
    if (player.politics.popularity < 30) {
      out.push({ panel: 'politics', tone: 'warning' });
    }

    // 5 — zero intel on every rival (expansion / onboarding).
    const blind = Object.values(player.intelligence.knownIntel).every(
      (level) => level === 'none',
    );
    if (blind) {
      out.push({ panel: 'spies', tone: 'info' });
    }

    // 6 — no treaties signed anywhere (expansion / onboarding).
    const hasTreaty = Object.values(state.relations).some(
      (rel) =>
        (rel.countryA === me || rel.countryB === me) && rel.treaties.length > 0,
    );
    if (!hasTreaty) {
      out.push({ panel: 'diplomacy', tone: 'info' });
    }

    return out.slice(0, MAX_SUGGESTIONS);
  }, [state, player, scenario]);

  if (suggestions.length === 0) return null;

  return (
    <section
      aria-label={t('title')}
      className="shrink-0 border-b border-border bg-surface px-3 py-2"
      data-testid="advisor-strip"
    >
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
        <Lightbulb aria-hidden className="h-3 w-3 text-accent" />
        {t('title')}
      </h3>
      <ul className="flex flex-col gap-1">
        {suggestions.map((s) => (
          <li key={s.panel}>
            <button
              type="button"
              onClick={() => onNavigate(s.panel)}
              className={cn(
                'group flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-[11px] leading-snug',
                'text-fg-muted transition-colors hover:bg-surface-1 hover:text-fg',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
              )}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: TONE_DOT[s.tone] }}
              />
              <span className="flex-1">{t(s.panel)}</span>
              <ChevronRight
                aria-hidden
                className="h-3 w-3 shrink-0 text-fg-faint opacity-0 transition-opacity group-hover:opacity-100"
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default AdvisorStrip;

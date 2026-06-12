// First-objectives tracker — a starter checklist rendered at the top of the
// notifications rail. Gives a brand-new run an immediate set of goals
// ("start a research", "sign a treaty", …) so the opening minutes have
// direction instead of an empty news feed.
//
// Every objective is DERIVED live from GameState — no extra persistence, no
// engine changes. Completed items stay visible (checked) so progress reads
// as accumulation; once ALL are complete the card unmounts for good in that
// session, because at that point the player has clearly internalised the
// systems and the rail belongs to the news stream.

'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '../../lib/cn';
import {
  selectPlayerCountry,
  useGameStore,
  type GameStoreState,
} from '../../lib/store';

type ObjectiveId = 'research' | 'intel' | 'treaty' | 'popularity' | 'bloc';

type Objective = {
  id: ObjectiveId;
  done: boolean;
};

export function ObjectivesCard() {
  const t = useTranslations('objectives');
  const state = useGameStore((s: GameStoreState) => s.state);
  const player = useGameStore(selectPlayerCountry);
  const saveId = useGameStore((s: GameStoreState) => s.saveId);

  const rawObjectives = useMemo<Objective[]>(() => {
    if (!state || !player) return [];
    const me = player.id;

    const research =
      player.science.activeResearch !== null ||
      player.science.completedTechs.length > 0;
    const intel = Object.values(player.intelligence.knownIntel).some(
      (level) => level !== 'none',
    );
    const treaty = Object.values(state.relations).some(
      (rel) =>
        (rel.countryA === me || rel.countryB === me) && rel.treaties.length > 0,
    );
    const popularity = player.politics.popularity >= 60;

    const out: Objective[] = [
      { id: 'research', done: research },
      { id: 'intel', done: intel },
      { id: 'treaty', done: treaty },
      { id: 'popularity', done: popularity },
    ];
    // Bloc objective only exists in scenarios that ship the bloc system.
    if (state.blocs !== undefined) {
      out.push({ id: 'bloc', done: player.blocId !== undefined });
    }
    return out;
  }, [state, player]);

  // Latch completion: an objective ticked once stays ticked even if the
  // underlying signal regresses (popularity dipping back below 60% must not
  // resurrect the checklist with an un-checked item). The latch is
  // per-session state, keyed by saveId so loading a different game resets it.
  const [latched, setLatched] = useState<{
    saveId: typeof saveId;
    ids: ReadonlySet<ObjectiveId>;
  }>({ saveId, ids: new Set() });
  useEffect(() => {
    // Derived-state sync (game state → latch). The `return prev` fast path
    // keeps this loop-free; same exception pattern as the localStorage
    // hydrations elsewhere in the codebase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLatched((prev) => {
      const sameSave = prev.saveId === saveId;
      const base = sameSave ? prev.ids : new Set<ObjectiveId>();
      let changed = !sameSave;
      const next = new Set(base);
      for (const o of rawObjectives) {
        if (o.done && !next.has(o.id)) {
          next.add(o.id);
          changed = true;
        }
      }
      return changed ? { saveId, ids: next } : prev;
    });
  }, [rawObjectives, saveId]);

  const objectives = rawObjectives.map((o) =>
    o.done || (latched.saveId === saveId && latched.ids.has(o.id))
      ? { ...o, done: true }
      : o,
  );

  const doneCount = objectives.filter((o) => o.done).length;

  // All done (or no game loaded) — the checklist has served its purpose.
  if (objectives.length === 0 || doneCount === objectives.length) return null;

  return (
    <section
      aria-label={t('title')}
      data-testid="objectives-card"
      className="shrink-0 border-b border-border pb-2"
    >
      <header className="flex items-baseline justify-between gap-2 pb-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {t('title')}
        </h3>
        <span className="numeric-tabular font-mono text-[10px] text-fg-faint">
          {t('progress', { done: doneCount, total: objectives.length })}
        </span>
      </header>
      {/* Progress hairline — same visual language as the trophies bar. */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={objectives.length}
        aria-valuenow={doneCount}
        className="mb-2 h-0.5 w-full overflow-hidden rounded-full bg-surface-1"
      >
        <div
          className="h-full rounded-full bg-success transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${(doneCount / objectives.length) * 100}%` }}
        />
      </div>
      <ul className="flex flex-col gap-1">
        {objectives.map((o) => (
          <li
            key={o.id}
            className={cn(
              'flex items-start gap-2 text-[11px] leading-snug transition-colors',
              o.done ? 'text-fg-faint' : 'text-fg-muted',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-px inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
                o.done
                  ? 'border-success/60 bg-success/15 text-success'
                  : 'border-border text-transparent',
              )}
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            <span className={cn(o.done && 'line-through decoration-fg-faint/60')}>
              {t(o.id)}
            </span>
            <span className="sr-only">{o.done ? '✓' : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default ObjectivesCard;

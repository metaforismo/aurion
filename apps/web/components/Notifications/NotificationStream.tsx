// Right-rail event stream. Renders the most recent N entries from
// `state.events` (the engine already caps the ring buffer). Auto-scrolls to
// the top when a new event arrives. Clicking an unresolved entry opens the
// matching event modal — which we surface simply by triggering the same
// auto-pause path the engine uses (the EventModal will be on screen because
// `selectHasOpenEvent` is true).

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef } from 'react';
import type { GameEvent } from '@aurion/engine';

import { useGameStore } from '../../lib/store';
import type { ScenarioId } from '../../lib/scenarios';

import { NotificationItem } from './NotificationItem';

const MAX_VISIBLE = 15;

export function NotificationStream() {
  const events = useGameStore((s) => s.state?.events ?? EMPTY_EVENTS);
  const tick = useGameStore((s) => s.state?.tick ?? 0);
  const scenario = useGameStore((s) => s.scenario);
  const t = useTranslations('notifications');

  const listRef = useRef<HTMLOListElement | null>(null);

  // Newest-first slice for display.
  const visible = useMemo(() => {
    if (events.length === 0) return events;
    const start = Math.max(0, events.length - MAX_VISIBLE);
    return events.slice(start).reverse();
  }, [events]);

  // Auto-scroll to top on new event arrival. We key off the firedAtTick of
  // the most recent entry so resolving an event doesn't trigger a scroll.
  const lastFired = events.length > 0 ? events[events.length - 1]?.firedAtTick ?? null : null;
  useEffect(() => {
    if (lastFired === null) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [lastFired]);

  return (
    <aside
      className="flex h-full min-h-0 flex-col gap-2 border border-border bg-bg p-3"
      aria-label={t('title')}
    >
      <header className="flex items-baseline justify-between border-b border-border pb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {t('title')}
        </h2>
        <span className="numeric-tabular font-mono text-[10px] text-fg-faint">
          {visible.length}/{events.length}
        </span>
      </header>
      {visible.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-1 py-4 text-center text-xs italic text-fg-faint">
          {t('empty')}
        </div>
      ) : (
        <ol
          ref={listRef}
          className="flex flex-1 min-h-0 flex-col divide-y divide-border overflow-y-auto pr-1"
        >
          {visible.map((event, idx) => {
            const definition =
              scenario?.eventPool.find((e) => e.id === event.definitionId) ??
              null;
            // Only the latest unresolved event is "actionable" — older
            // unresolved events shouldn't normally exist (engine clears them
            // on resolve), but be defensive.
            const isActionable =
              event.resolvedChoiceIndex === null && idx === 0;
            const scenarioId = (scenario?.id ?? null) as ScenarioId | null;
            return (
              <li key={`${event.definitionId}-${event.firedAtTick}-${idx}`}>
                <NotificationItem
                  event={event}
                  definition={definition}
                  scenarioId={scenarioId}
                  currentTick={tick}
                  // Selecting just sets isAutoPaused via the existing
                  // `selectHasOpenEvent` path; the EventModal is already
                  // mounted by ModalRoot. We pass a no-op handler so the
                  // entry stays focusable for keyboard users.
                  {...(isActionable ? { onSelect: () => undefined } : {})}
                />
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}

// Stable empty array reference so subscribers don't see a "new" value every
// render when no game state is loaded.
const EMPTY_EVENTS: readonly GameEvent[] = Object.freeze([]);

export default NotificationStream;

// Right-rail event stream. Renders the most recent N entries from
// `state.events` (the engine already caps the ring buffer). Auto-scrolls to
// the top when a new event arrives. Clicking an unresolved entry opens the
// matching event modal — which we surface simply by triggering the same
// auto-pause path the engine uses (the EventModal will be on screen because
// `selectHasOpenEvent` is true).
//
// Width behaviour (no friction — the rail never hides itself unprompted):
//   - Default (zero events): MEDIUM rail (~14rem) showing title + empty line.
//   - Notifications arrive   : auto-expands to FULL (~20rem), animated 200ms.
//   - User clicks "Riduci"   : collapses to a slim 4rem rail with the
//                              stacked count badge (the only collapsed state,
//                              entered only via explicit user action).
//   - Persistence            : the "I prefer collapsed" choice is stored in
//                              localStorage under `aurion.notificationsRail.collapsed`
//                              so it survives reloads, but a new notification
//                              still forces the slim rail to surface its count
//                              without flipping the preference.
//
// The parent (play page) drives the column width via the `--rail-w` CSS
// variable on the grid container. We compute the desired width here and
// publish it through the `onWidthChange` callback so the page stays a dumb
// host.

'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameEvent } from '@aurion/engine';

import { cn } from '../../lib/cn';
import { useGameStore } from '../../lib/store';
import type { ScenarioId } from '../../lib/scenarios';

import { NotificationItem } from './NotificationItem';

const MAX_VISIBLE = 15;

/** localStorage key for the user's "I prefer the slim rail" preference. */
const COLLAPSED_PREF_KEY = 'aurion.notificationsRail.collapsed';

/** Tailwind widths — kept in sync with the CSS var values published below. */
const RAIL_W = {
  collapsed: '4rem',
  medium: '14rem',
  full: '20rem',
} as const;

export type NotificationStreamProps = {
  /** Receives the desired column width (e.g. "20rem") whenever the rail
   * decides to grow or shrink. The parent forwards it into the grid's
   * `--rail-w` CSS variable. */
  onWidthChange?: (width: string) => void;
};

export function NotificationStream({ onWidthChange }: NotificationStreamProps = {}) {
  const events = useGameStore((s) => s.state?.events ?? EMPTY_EVENTS);
  const tick = useGameStore((s) => s.state?.tick ?? 0);
  const scenario = useGameStore((s) => s.scenario);
  const t = useTranslations('notifications');

  const listRef = useRef<HTMLOListElement | null>(null);

  // User preference — only meaningful for the slim collapsed state. Hydrated
  // from localStorage on mount; null until then so the first paint matches
  // the server output (no flash). Defaults to `false` (rail visible).
  const [collapsedPref, setCollapsedPref] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSED_PREF_KEY);
      // External system synchronisation (localStorage → React state) — the
      // codebase uses this same exception in `lib/ticker.ts` and
      // `components/Tutorial/TutorialOverlay.tsx`.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsedPref(stored === 'true');
    } catch {
      // localStorage unavailable (private mode, quota, etc.) — fall back to
      // the visible default.
      setCollapsedPref(false);
    }
  }, []);

  const persistCollapsed = useCallback((value: boolean) => {
    try {
      window.localStorage.setItem(COLLAPSED_PREF_KEY, value ? 'true' : 'false');
    } catch {
      // Best-effort — silently degrade.
    }
  }, []);

  const collapse = useCallback(() => {
    setCollapsedPref(true);
    persistCollapsed(true);
  }, [persistCollapsed]);

  const expand = useCallback(() => {
    setCollapsedPref(false);
    persistCollapsed(false);
  }, [persistCollapsed]);

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

  // Resolve the rail's mode. Three states:
  //   collapsed → user opted in (and the queue starts empty). New events
  //               surface the count but DO NOT flip the preference.
  //   medium    → queue empty, user hasn't collapsed.
  //   full      → queue non-empty AND user hasn't collapsed.
  const isCollapsed = collapsedPref === true;
  const mode: 'collapsed' | 'medium' | 'full' = isCollapsed
    ? 'collapsed'
    : events.length === 0
      ? 'medium'
      : 'full';

  // Publish the column width to the parent. Skipped while we're still
  // hydrating the preference (collapsedPref === null) so the parent keeps
  // its initial default.
  useEffect(() => {
    if (collapsedPref === null) return;
    onWidthChange?.(RAIL_W[mode]);
  }, [mode, collapsedPref, onWidthChange]);

  if (mode === 'collapsed') {
    // Slim rail. Stacks "N NOT" vertically and exposes an expand affordance.
    // The label switches to the i18n-friendly abbreviation; we keep "NOT" in
    // both locales because it's a short, language-neutral cap.
    const count = events.length;
    return (
      <aside
        className="flex h-full min-h-0 w-16 flex-col items-center justify-start gap-2 border border-border bg-bg py-3 transition-[width] duration-200 ease-out"
        aria-label={t('title')}
        data-rail-mode="collapsed"
      >
        <button
          type="button"
          onClick={expand}
          aria-expanded={false}
          aria-label={t('expand')}
          title={t('expand')}
          className="flex w-full flex-col items-center gap-1 px-1 text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <span className="numeric-tabular font-mono text-sm leading-none">
            {count}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] leading-none text-fg-faint">
            {t('countAbbr')}
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 w-full flex-col gap-2 border border-border bg-bg p-3 transition-[width] duration-200 ease-out',
      )}
      aria-label={t('title')}
      data-rail-mode={mode}
    >
      <header className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {t('title')}
        </h2>
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'numeric-tabular font-mono text-[10px] text-fg-faint',
              events.length === 0 && 'sr-only',
            )}
          >
            {visible.length}/{events.length}
          </span>
          <button
            type="button"
            onClick={collapse}
            aria-label={t('collapse')}
            title={t('collapse')}
            className="rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-fg-faint transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            {t('collapseShort')}
          </button>
        </div>
      </header>
      {visible.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-2 py-4 text-center text-xs italic leading-relaxed text-fg-faint">
          {t('emptyDetailed')}
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
            // Slide-down animation only on the freshest entry. We compare
            // firedAtTick to the most-recent fired event so resolving an
            // existing entry (which mutates resolvedChoiceIndex without
            // adding a new event) does NOT re-trigger the drop-in.
            const isNew = idx === 0 && event.firedAtTick === lastFired;
            const scenarioId = (scenario?.id ?? null) as ScenarioId | null;
            return (
              <li key={`${event.definitionId}-${event.firedAtTick}-${idx}`}>
                <NotificationItem
                  event={event}
                  definition={definition}
                  scenarioId={scenarioId}
                  currentTick={tick}
                  isNew={isNew}
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

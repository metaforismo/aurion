// Eternal-mode victory counter. A small inline counter showing how many of
// the scenario's victory conditions the player has already unlocked, rendered
// as a 🏆 symbol + `N/M` value — no chip background, no border. Visible ONLY
// when `state.gameMode === 'eternal'` — Classic / Dethrone / Era-paced modes
// hide it because their notion of "the game ends" makes a running counter
// misleading.
//
// Click → small popover listing the conditions and which ones are
// unlocked. We don't have per-condition unlock timestamps in Phase 3 yet
// (the engine state only carries the id list), so the popover degrades
// gracefully to "name + check / lock" without timestamps. Once the engine
// publishes timestamps, this component can be extended without changing
// callers.
//
// Edge cases handled here so callers don't have to guard:
//   - `state` null                → render nothing
//   - `gameMode !== 'eternal'`    → render nothing
//   - `unlockedVictories === undefined` → treat as []
//   - scenario without victories  → render "0/0" but disable the popover
//
// Strict TS: every selector returns a narrowly-typed slice and the popover
// only mounts when there's at least one condition to display.

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import type { VictoryConditionDef, VictoryConditionId } from '@aurion/engine';

import { cn } from '../../lib/cn';
import type { ScenarioId } from '../../lib/scenarios';
import { useGameStore } from '../../lib/store';
import { useScenarioMessages } from '../Panels/shared/useScenarioMessages';
// Note: a `selectVictoryProgress` selector is exported from the store for
// callers (and tests) that want both numbers as one object. We deliberately
// don't subscribe through it here because it would allocate a fresh object
// on every render, defeating zustand's referential-equality bail-out and
// causing redundant re-renders. Instead we read the underlying slices.

export function VictoryCounter() {
  const t = useTranslations('hud.victory');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  // Slice selectors — kept narrow so the chip only re-renders when the user
  // actually progresses through victories or switches mode mid-game.
  const gameMode = useGameStore((s) => s.state?.gameMode);
  const unlocked = useGameStore((s) => s.state?.unlockedVictories);
  const conditions = useGameStore((s) => s.scenario?.victoryConditions);
  // Scenario-defined victory nameKeys (e.g. `victory.qs.economic.name`) live
  // in the scenario side-car bundle, not in the global UI messages. We load
  // the side-car here so the popover can resolve them; the hook returns the
  // raw key on miss, which we degrade further to a sensible fallback below.
  const scenarioId = useGameStore(
    (s) => (s.scenario?.id ?? null) as ScenarioId | null,
  );
  const { t: tScenario } = useScenarioMessages(scenarioId);

  // Close on outside click while open.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const node = containerRef.current;
      if (!node) return;
      if (e.target instanceof Node && !node.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on ESC.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (gameMode !== 'eternal') return null;

  const unlockedList: readonly VictoryConditionId[] = unlocked ?? [];
  const conditionList: readonly VictoryConditionDef[] = conditions ?? [];
  const count = unlockedList.length;
  const total = conditionList.length;
  const accent = count > 0;
  const popoverDisabled = total === 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="victory-counter"
        onClick={() => {
          if (popoverDisabled) return;
          setOpen((v) => !v);
        }}
        aria-haspopup={popoverDisabled ? undefined : 'dialog'}
        aria-expanded={popoverDisabled ? undefined : open}
        aria-label={t('counter', { unlocked: count, total })}
        title={t('counter', { unlocked: count, total })}
        disabled={popoverDisabled}
        className={cn(
          'flex items-baseline gap-1.5 text-sm transition-colors',
          popoverDisabled
            ? 'cursor-default text-fg-muted opacity-70'
            : open
              ? 'text-accent'
              : accent
                ? 'text-accent hover:text-accent'
                : 'text-fg-muted hover:text-accent',
        )}
      >
        <span aria-hidden="true">🏆</span>
        <span className="numeric-tabular font-mono">
          {count}/{total}
        </span>
      </button>
      {open && !popoverDisabled ? (
        <VictoryPopover
          conditions={conditionList}
          unlocked={unlockedList}
          tScenario={tScenario}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Popover body
// ---------------------------------------------------------------------------

type VictoryPopoverProps = {
  conditions: readonly VictoryConditionDef[];
  unlocked: readonly VictoryConditionId[];
  /** Scenario message getter — resolves `victory.<scope>.<id>.name` keys that
   * live in the side-car bundle. Returns the raw key on miss. */
  tScenario: (key: string | undefined | null) => string;
};

function VictoryPopover({
  conditions,
  unlocked,
  tScenario,
}: VictoryPopoverProps) {
  const t = useTranslations('hud.victory');
  // We also keep the root translator as a fallback — generic victory keys
  // (`victory.economic.name`) are shipped in the global UI bundle and only
  // scenario-scoped variants (`victory.qs.economic.name`,
  // `victory.gf.economic.name`, …) live in the side-car file.
  const tRoot = useTranslations();
  const titleId = useId();
  const unlockedSet = new Set<VictoryConditionId>(unlocked);

  return (
    <div
      role="dialog"
      aria-modal={false}
      aria-labelledby={titleId}
      className="glass-surface absolute right-0 z-30 mt-2 w-64 rounded-lg border border-border-strong bg-surface-1/95 p-3 shadow-2xl backdrop-blur"
    >
      <h3
        id={titleId}
        className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted"
      >
        {t('popoverTitle')}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {conditions.map((c) => {
          const isUnlocked = unlockedSet.has(c.id);
          // Resolution order:
          //   1. Scenario side-car (`victory.qs.economic.name`, …).
          //   2. Global UI bundle (generic `victory.economic.name`).
          //   3. The raw key as a last-resort fallback.
          const label = resolveVictoryLabel(tScenario, tRoot, c.nameKey);
          return (
            <li
              key={c.id}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs',
                isUnlocked
                  ? 'border-accent/40 bg-accent/10 text-fg'
                  : 'border-border bg-surface/40 text-fg-muted',
              )}
            >
              <span className="truncate">{label}</span>
              <span aria-hidden="true" className="text-base leading-none">
                {isUnlocked ? '🏆' : '·'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Try the scenario side-car bundle first (where scenario-scoped victory
 * conditions like `victory.qs.economic.name` live), then fall back to the
 * global UI bundle (which carries the generic `victory.economic.name`), and
 * finally to the raw key. Never throws — so the HUD keeps rendering even
 * when a scenario adds a new victory whose label isn't shipped yet.
 */
function resolveVictoryLabel(
  tScenario: (key: string | undefined | null) => string,
  tRoot: ReturnType<typeof useTranslations>,
  key: string,
): string {
  const scenarioValue = tScenario(key);
  if (scenarioValue && scenarioValue !== key) return scenarioValue;
  try {
    const rootValue = tRoot(key);
    if (rootValue && rootValue !== key) return rootValue;
  } catch {
    // fall through
  }
  return key;
}

export default VictoryCounter;

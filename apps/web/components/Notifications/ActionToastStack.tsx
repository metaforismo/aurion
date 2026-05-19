// Bottom-centre success-toast stack for player actions (UN propose, nuclear
// launch, bloc join/leave). Reads from `useGameStore.actionToasts` and
// auto-dismisses each entry after a fixed window. Engine errors continue to
// flow through the existing inline-banner path in PanelTabs — this component
// is for SUCCESS confirmations only.
//
// Single source of toast UI behaviour: AchievementToast and VictoryToast
// have their own dedicated visuals; we keep this stack visually quieter so
// the (more semantically heavy) achievement / victory toasts can stand out.

'use client';

import { useEffect } from 'react';

import { cn } from '../../lib/cn';
import { useGameStore } from '../../lib/store';

const AUTO_DISMISS_MS = 3_500;

// Editorial toast: solid bg, single deep shadow, ink hierarchy via the
// per-tone left rule + text colour. No tinted fill.
const TONE_CLASS = {
  success: 'border-l-2 border-success text-success',
  info: 'border-l-2 border-info text-info',
  warning: 'border-l-2 border-warning text-warning',
} as const;

export function ActionToastStack() {
  const toasts = useGameStore((s) => s.actionToasts);
  const dismiss = useGameStore((s) => s.dismissActionToast);

  // One timer per toast id. We register each timer once (keyed by id) and
  // rely on React's effect cleanup to clear orphans when the toast is
  // manually dismissed before the deadline.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => dismiss(t.id), AUTO_DISMISS_MS),
    );
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'pointer-events-none fixed bottom-4 left-1/2 z-40 flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4',
      )}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{ boxShadow: 'var(--shadow-lg)' }}
          className={cn(
            'pointer-events-auto rounded-sm border border-border bg-bg px-3 py-2 text-xs font-medium',
            'animate-in fade-in slide-in-from-bottom-2 duration-200',
            TONE_CLASS[t.tone ?? 'success'],
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default ActionToastStack;

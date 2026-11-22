'use client';

// How much of the stage the dock/drawer (left) and the briefing (right)
// cover, measured from the DOM because both can be opened, closed or
// collapsed. Also published as CSS variables so floating controls can centre
// themselves in the space that is actually free:
//   left: var(--stage-center)

import { useEffect, useState, useSyncExternalStore } from 'react';

export type StageInsets = { left: number; right: number };

const WIDE_QUERY = '(min-width: 1024px)';

function subscribeWide(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** True on layouts where the panels sit beside the planet rather than over it. */
export function useWideStage(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

export function useStageInsets(): StageInsets | undefined {
  const wide = useWideStage();
  const [insets, setInsets] = useState<StageInsets | undefined>(undefined);

  useEffect(() => {
    const root = document.documentElement;
    if (!wide) {
      root.style.setProperty('--stage-center', '50%');
      return;
    }
    const measure = () => {
      const dock = document.querySelector('[data-stage-inset="left"]')?.getBoundingClientRect();
      const rail = document.querySelector('[data-stage-inset="right"]')?.getBoundingClientRect();
      const next = {
        left: Math.round((dock?.right ?? 0) + 8),
        right: Math.round(rail ? window.innerWidth - rail.left + 8 : 8),
      };
      root.style.setProperty('--stage-center', `${(next.left + window.innerWidth - next.right) / 2}px`);
      setInsets((prev) => (prev && prev.left === next.left && prev.right === next.right ? prev : next));
    };
    measure();
    const id = window.setInterval(measure, 300);
    return () => {
      window.clearInterval(id);
      root.style.removeProperty('--stage-center');
    };
  }, [wide]);

  return wide ? insets : undefined;
}

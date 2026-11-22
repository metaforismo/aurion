'use client';

// The big moments deserve a beat of their own. When the player sets foot on
// a new world or crosses a Kardashev type, the screen dims and says so. It
// sits above any decision the milestone triggers, so the celebration comes
// first; a click anywhere (or a few seconds) moves on.

import { Orbit, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { getCosmosProject, kardashevType, type CosmosBodyId } from '@aurion/engine';

import { useGameStore } from '../../lib/store';
import { Button } from '../ui';

type Milestone = { key: string; kind: 'body'; body: CosmosBodyId } | { key: string; kind: 'type'; type: 1 | 2 };

const AUTO_DISMISS_MS = 9000;

export function MilestoneOverlay() {
  const t = useTranslations('milestone');
  const cosmos = useGameStore((s) => s.state?.cosmos);
  const saveId = useGameStore((s) => s.saveId);
  const setMapView = useGameStore((s) => s.setMapView);
  const [queue, setQueue] = useState<Milestone[]>([]);
  // What had already been reached the last time we looked. Compared during
  // render (derived state) so a new milestone is queued exactly once.
  const [seen, setSeen] = useState<{ saveId: string | null; bodies: string; type: number } | null>(null);

  if (cosmos) {
    const bodies = new Set<CosmosBodyId>();
    for (const id of cosmos.completed) {
      const def = getCosmosProject(id);
      if (def) bodies.add(def.body);
    }
    const type = kardashevType(cosmos.kardashev);
    const signature = Array.from(bodies).sort().join(',');
    const sameSave = seen !== null && seen.saveId === (saveId ?? null);
    if (!sameSave || seen.bodies !== signature || seen.type !== type) {
      setSeen({ saveId: saveId ?? null, bodies: signature, type });
      // First look at a save: whatever is already built is history.
      if (sameSave) {
        const before = new Set(seen.bodies.split(','));
        const fresh: Milestone[] = [];
        for (const body of bodies) {
          if (body !== 'earth' && !before.has(body)) fresh.push({ key: `body:${body}`, kind: 'body', body });
        }
        if (type > seen.type && (type === 1 || type === 2)) fresh.push({ key: `type:${type}`, kind: 'type', type });
        if (fresh.length > 0) setQueue((q) => [...q, ...fresh]);
      }
    }
  }

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const id = window.setTimeout(() => setQueue((q) => q.slice(1)), AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [current]);

  if (!current) return null;
  const dismiss = () => setQueue((q) => q.slice(1));
  const isType = current.kind === 'type';
  const base = isType ? `type.${current.type}` : `body.${current.body}`;
  const visit = !isType && (current.body === 'moon' || current.body === 'mars') ? current.body : null;
  const tone = isType ? '#E8B45A' : '#5cc8ff';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="milestone-overlay"
      className="fixed inset-0 z-[60] flex cursor-pointer items-center justify-center p-4"
      onClick={dismiss}
      style={{
        background: `radial-gradient(ellipse 70% 55% at 50% 45%, ${tone}22 0%, transparent 65%), color-mix(in oklch, var(--color-bg) 78%, transparent)`,
        backdropFilter: 'blur(4px)',
        animation: 'modal-backdrop-enter 700ms cubic-bezier(0, 0, 0.2, 1) both',
      }}
    >
      <div
        key={current.key}
        className="flex max-w-xl cursor-default flex-col items-center text-center"
        style={{ animation: 'rise-in 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 120ms both' }}
      >
        <span
          className="grid h-14 w-14 place-items-center rounded-full border"
          style={{ borderColor: `${tone}80`, backgroundColor: `${tone}1f`, color: tone }}
        >
          {isType ? <Sparkles aria-hidden className="h-6 w-6" /> : <Orbit aria-hidden className="h-6 w-6" />}
        </span>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: tone }}>
          {t(isType ? 'kicker.type' : 'kicker.body')}
        </p>
        <h2 className="mt-1 text-4xl font-semibold tracking-tight text-fg drop-shadow-[0_2px_18px_rgba(0,0,0,0.8)] sm:text-6xl">
          {t(`${base}.title`)}
        </h2>
        <p className="mt-3 max-w-md text-base leading-relaxed text-fg-muted drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)]">
          {t(`${base}.text`)}
        </p>
        <div className="mt-6 flex gap-2">
          {visit ? (
            <Button
              variant="secondary"
              onClick={() => {
                setMapView(visit);
                dismiss();
              }}
            >
              {t(`visit.${visit}`)}
            </Button>
          ) : null}
          <Button variant="primary" onClick={dismiss} autoFocus>
            {t('dismiss')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MilestoneOverlay;

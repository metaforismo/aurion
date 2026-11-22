'use client';

// Solar-system stage: a stylised orrery. Each world is a button; selecting
// one lists the megaprojects that live there and lets the player jump to the
// worlds that have a surface view. Planets advance with game time.

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  COSMOS_PROJECTS,
  getProjectStatus,
  type CosmosBodyId,
  type CosmosProjectStatus,
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import { useGameStore, type MapView } from '../../lib/store';

type OrreryBody = {
  id: string;
  /** Megaproject bodies shown under this world. */
  bodies: CosmosBodyId[];
  /** Orbit radius, % of the half-size of the stage. */
  orbit: number;
  /** Disc diameter in px. */
  size: number;
  /** Orbital period in game weeks (0 = fixed). */
  period: number;
  /** Starting angle, degrees. */
  phase: number;
  texture?: string;
  view?: MapView;
};

const BODIES: readonly OrreryBody[] = [
  { id: 'sun', bodies: ['sun'], orbit: 0, size: 86, period: 0, phase: 0, texture: '/textures/sun.jpg' },
  { id: 'mercury', bodies: [], orbit: 17, size: 14, period: 12.5, phase: 40, texture: '/textures/mercury.jpg' },
  { id: 'venus', bodies: [], orbit: 25, size: 20, period: 32, phase: 200, texture: '/textures/venus.jpg' },
  { id: 'earth', bodies: ['earth', 'orbit'], orbit: 35, size: 26, period: 52, phase: 310, texture: '/textures/earth_day.jpg', view: 'earth' },
  { id: 'mars', bodies: ['mars'], orbit: 46, size: 20, period: 98, phase: 130, texture: '/textures/mars.jpg', view: 'mars' },
  { id: 'belt', bodies: ['belt'], orbit: 57, size: 16, period: 240, phase: 250 },
  { id: 'jupiter', bodies: ['jupiter'], orbit: 70, size: 46, period: 617, phase: 20, texture: '/textures/jupiter.jpg' },
  { id: 'saturn', bodies: ['saturn'], orbit: 86, size: 38, period: 1532, phase: 165, texture: '/textures/saturn.jpg' },
];

type BodySummary = { done: number; building: number; total: number };

export default function SystemView() {
  const t = useTranslations('globe');
  const tCosmos = useTranslations('cosmos');
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const setMapView = useGameStore((s) => s.setMapView);
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  const [selected, setSelected] = useState<string>('earth');

  const techCatalog = useMemo(() => scenario?.techTree ?? [], [scenario]);
  const statusById = useMemo(() => {
    const out = new Map<string, CosmosProjectStatus>();
    if (!state) return out;
    for (const def of COSMOS_PROJECTS) out.set(def.id, getProjectStatus(state, def, techCatalog));
    return out;
  }, [state, techCatalog]);

  const summaryFor = (bodies: readonly CosmosBodyId[]): BodySummary => {
    const list = COSMOS_PROJECTS.filter((p) => bodies.includes(p.body));
    return {
      total: list.length,
      done: list.filter((p) => statusById.get(p.id)?.status === 'done').length,
      building: list.filter((p) => statusById.get(p.id)?.status === 'building').length,
    };
  };

  if (!state) return null;
  const tick = state.tick;

  const all = [
    ...BODIES,
    // The Moon rides with Earth; Proxima sits outside the orrery.
    { id: 'moon', bodies: ['moon'] as CosmosBodyId[], orbit: 0, size: 12, period: 0, phase: 0, texture: '/textures/moon.jpg', view: 'moon' as MapView },
    { id: 'centauri', bodies: ['centauri'] as CosmosBodyId[], orbit: 0, size: 14, period: 0, phase: 0 },
  ];
  const selectedBody = all.find((b) => b.id === selected) ?? all[0]!;
  const selectedProjects = COSMOS_PROJECTS.filter((p) => selectedBody.bodies.includes(p.body));
  const selectedSummary = summaryFor(selectedBody.bodies);

  const angleOf = (b: OrreryBody) => (b.period > 0 ? b.phase + (tick / b.period) * 360 : b.phase);
  const posOf = (b: OrreryBody) => {
    const a = (angleOf(b) * Math.PI) / 180;
    return { left: 50 + (b.orbit / 2) * Math.cos(a), top: 50 + (b.orbit / 2) * Math.sin(a) };
  };
  const earth = BODIES.find((b) => b.id === 'earth')!;
  const earthPos = posOf(earth);

  const ring = (s: BodySummary) =>
    s.done > 0
      ? 'ring-2 ring-success/80'
      : s.building > 0
        ? 'ring-2 ring-[#5cc8ff]/80'
        : 'ring-1 ring-white/15';

  const disc = (b: OrreryBody, s: BodySummary) => (
    <span
      className={cn(
        'block rounded-full transition-shadow',
        ring(s),
        selected === b.id && 'shadow-[0_0_0_3px_rgba(232,180,90,0.9)]',
      )}
      style={{
        width: b.size,
        height: b.size,
        backgroundImage: b.texture
          ? `radial-gradient(circle at 32% 30%, rgba(255,255,255,0.28), rgba(0,0,0,0) 45%, rgba(0,0,0,0.72) 100%), url(${b.texture})`
          : 'radial-gradient(circle at 35% 30%, #cfc6b8, #6d655c 60%, #2a2622)',
        backgroundSize: b.texture ? '100% 100%, 200% 100%' : undefined,
        backgroundPosition: 'center',
        boxShadow: b.id === 'sun' ? '0 0 60px 18px rgba(255,170,60,0.45)' : undefined,
      }}
    />
  );

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_50%_50%,#0a1226_0%,#02040a_70%)]"
      data-testid="system-view"
    >
      <div className="absolute inset-x-4 bottom-72 top-36 grid place-items-center lg:bottom-56 lg:left-[30rem] lg:right-[21.5rem] lg:top-28">
      <div className="relative aspect-square h-full max-h-full max-w-full">
        {/* Orbits */}
        {BODIES.filter((b) => b.orbit > 0).map((b) => (
          <span
            key={`orbit-${b.id}`}
            aria-hidden
            className={cn(
              'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border',
              b.id === 'belt' ? 'border-dashed border-white/25' : 'border-white/10',
            )}
            style={{ width: `${b.orbit}%`, height: `${b.orbit}%` }}
          />
        ))}

        {BODIES.map((b) => {
          const s = summaryFor(b.bodies);
          const pos = posOf(b);
          const name = tCosmos(`bodies.${b.id}`);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelected(b.id)}
              aria-pressed={selected === b.id}
              aria-label={name}
              data-testid={`system-body-${b.id}`}
              className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-full transition-[left,top] duration-1000 ease-linear focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none"
              style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            >
              <span className="relative">
                {disc(b, s)}
                {b.id === 'saturn' ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[30%] w-[190%] -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-[50%] border-2 border-[#d8c79a]/60"
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  'absolute top-full z-10 mt-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide',
                  selected === b.id ? 'bg-accent text-black' : 'bg-black/50 text-white/75 group-hover:text-white',
                )}
              >
                {name}
              </span>
            </button>
          );
        })}

        {/* The Moon, parked just off Earth. */}
        <button
          type="button"
          onClick={() => setSelected('moon')}
          aria-pressed={selected === 'moon'}
          aria-label={tCosmos('bodies.moon')}
          data-testid="system-body-moon"
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left,top] duration-1000 ease-linear focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none"
          style={{ left: `${earthPos.left + 3.4}%`, top: `${earthPos.top - 3.4}%` }}
        >
          {disc(all.find((b) => b.id === 'moon')!, summaryFor(['moon']))}
        </button>
      </div>
      </div>

      {/* Proxima — the destination beyond the frame. */}
      <button
        type="button"
        onClick={() => setSelected('centauri')}
        aria-pressed={selected === 'centauri'}
        data-testid="system-body-centauri"
        className={cn(
          'absolute right-6 top-24 flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium backdrop-blur-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent lg:right-[22rem]',
          selected === 'centauri'
            ? 'border-accent bg-accent/15 text-accent'
            : 'border-white/15 bg-black/40 text-white/75 hover:text-white',
        )}
      >
        <span className="h-2 w-2 rounded-full bg-[#ffb48a] shadow-[0_0_10px_3px_rgba(255,150,100,0.7)]" />
        {tCosmos('bodies.centauri')} · 4,2 al
      </button>

      {/* Selected world card */}
      <section
        aria-live="polite"
        className="glass-panel absolute bottom-28 z-10 w-[min(30rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl p-4 lg:bottom-4"
        style={{ left: 'var(--stage-center, 50%)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-faint">{t('system.title')}</p>
            <h3 className="text-base font-semibold text-fg">{tCosmos(`bodies.${selectedBody.id}`)}</h3>
            <p className="text-[11px] text-fg-muted">
              {selectedSummary.total === 0
                ? tCosmos('bodyStatus.noProjects')
                : selectedSummary.done === 0 && selectedSummary.building === 0
                  ? tCosmos('bodyStatus.untouched')
                  : tCosmos('bodyStatus.settled', { done: selectedSummary.done, total: selectedSummary.total })}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {selectedBody.view ? (
              <button
                type="button"
                onClick={() => setMapView(selectedBody.view!)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:border-accent/60 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {t('system.open')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSelectedPanel('cosmos')}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t('system.projects')}
            </button>
          </div>
        </div>
        {selectedProjects.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {selectedProjects.map((p) => {
              const st = statusById.get(p.id)?.status ?? 'locked';
              return (
                <li
                  key={p.id}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px]',
                    st === 'done' && 'border-success/40 bg-success/10 text-success',
                    st === 'building' && 'border-[#5cc8ff]/40 bg-[#5cc8ff]/10 text-[#8ad8ff]',
                    st === 'available' && 'border-accent/40 text-accent',
                    st === 'locked' && 'border-white/10 text-fg-faint',
                  )}
                >
                  {tCosmos(`projects.${p.id}.name`)}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-fg-faint">{t('system.hint')}</p>
        )}
      </section>
    </div>
  );
}

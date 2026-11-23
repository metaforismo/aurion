'use client';

// Moon / Mars stage: the same planet renderer, dressed with the player's
// project sites. Until the player has a presence there it explains the next
// step instead of showing an empty rock.

import { Check, Hammer, MapPin, Orbit } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { COSMOS_PROJECTS, getProjectStatus } from '@aurion/engine';

import { PROJECT_SITES, type SurfaceBody } from '../../lib/globe/sites';
import { useGameStore } from '../../lib/store';

import ColonyCard from './ColonyCard';
import { NewsPill, type MarkerTone } from './markers';
import PlanetView, { type PlanetMarker, type PlanetViewHandle } from './PlanetView';

const START: Record<SurfaceBody, { lon: number; lat: number }> = {
  moon: { lon: 10, lat: 8 },
  mars: { lon: -95, lat: 6 },
};

export default function OffworldView({ body }: { body: SurfaceBody }) {
  const t = useTranslations('globe');
  const tCosmos = useTranslations('cosmos');
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  const viewRef = useRef<PlanetViewHandle | null>(null);
  const [ready, setReady] = useState(false);

  const projects = useMemo(() => COSMOS_PROJECTS.filter((p) => p.body === body), [body]);
  const techCatalog = useMemo(() => scenario?.techTree ?? [], [scenario]);

  const sites = useMemo(() => {
    if (!state) return [];
    return projects.map((def) => ({ def, status: getProjectStatus(state, def, techCatalog) }));
  }, [state, projects, techCatalog]);

  const hasPresence = sites.some((s) => s.status.status === 'done' || s.status.status === 'building');
  const nextStep = sites.find((s) => s.status.status !== 'done');

  useEffect(() => {
    if (!ready) return;
    // Keep the visited hemisphere in daylight.
    viewRef.current?.setSun(START[body].lon + 38, 10);
    viewRef.current?.setSunSpeed(0.15);
  }, [ready, body]);

  const markers = useMemo<PlanetMarker[]>(() => {
    const out: PlanetMarker[] = [];
    for (const { def, status } of sites) {
      const site = PROJECT_SITES[def.id];
      if (!site) continue;
      const name = tCosmos(`projects.${def.id}.name`);
      let tone: MarkerTone = 'neutral';
      let icon = MapPin;
      let age = t('offworld.site.planned');
      let priority = 10;
      if (status.status === 'done') {
        tone = 'success';
        icon = Check;
        age = t('offworld.site.done');
        priority = 100;
      } else if (status.status === 'building') {
        tone = 'info';
        icon = Hammer;
        age = t('offworld.site.building', { weeks: status.remainingTicks });
        priority = 200;
      } else if (status.status === 'available') {
        tone = 'accent';
        priority = 50;
      }
      out.push({
        id: `site:${def.id}`,
        lon: site.lon,
        lat: site.lat,
        kind: 'label',
        priority,
        width: (name.length + age.length) * 6.4 + 70,
        node: (
          <NewsPill
            icon={icon}
            tone={tone}
            title={name}
            age={age}
            onClick={() => setSelectedPanel('cosmos')}
          />
        ),
      });
    }
    return out;
  }, [sites, t, tCosmos, setSelectedPanel]);

  if (!state) return null;
  const bodyName = tCosmos(`bodies.${body}`);

  return (
    <div className="absolute inset-0" data-testid={`offworld-${body}`}>
      <PlanetView
        key={body}
        ref={viewRef}
        body={body}
        ariaLabel={bodyName}
        markers={markers}
        initialLon={START[body].lon}
        initialLat={START[body].lat}
        initialDistance={3}
        sunSpeed={0.15}
        onReady={() => setReady(true)}
      />
      <ColonyCard body={body} />
      {!hasPresence && nextStep ? (
        <div
          className="glass-panel absolute bottom-28 z-10 w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl p-4 text-center lg:bottom-20"
          style={{ left: 'var(--stage-center, 50%)', animation: 'rise-in 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both' }}
        >
          <Orbit aria-hidden className="mx-auto mb-2 h-5 w-5 text-[#8ad8ff]" />
          <h3 className="text-sm font-semibold text-fg">{t('offworld.locked.title', { body: bodyName })}</h3>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            {t('offworld.locked.body', { project: tCosmos(`projects.${nextStep.def.id}.name`) })}
          </p>
          <button
            type="button"
            onClick={() => setSelectedPanel('cosmos')}
            className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t('offworld.locked.cta')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

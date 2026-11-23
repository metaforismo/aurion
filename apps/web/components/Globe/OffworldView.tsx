'use client';

// Moon / Mars stage: the same planet renderer, dressed with the player's
// project sites. Until the player has a presence there it explains the next
// step instead of showing an empty rock.

import { Check, Hammer, MapPin, Orbit } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COSMOS_PROJECTS, SECTOR_SLOTS, getProjectStatus, getSectorStatus, sectorAt, sectorCentre } from '@aurion/engine';

import { PROJECT_SITES, type SurfaceBody } from '../../lib/globe/sites';
import type { ScenarioId } from '../../lib/scenarios';
import { useGameStore } from '../../lib/store';

import BaseView from './BaseView';
import ColonyCard from './ColonyCard';
import { NewsPill, type MarkerTone } from './markers';
import { STRUCTURE_ICON } from './TerritorySection';
import { useScenarioMessages } from '../Panels/shared/useScenarioMessages';
import PlanetView, { type PlanetMarker, type PlanetViewHandle } from './PlanetView';

const START: Record<SurfaceBody, { lon: number; lat: number }> = {
  moon: { lon: 10, lat: 8 },
  mars: { lon: -95, lat: 6 },
};

export default function OffworldView({ body }: { body: SurfaceBody }) {
  const t = useTranslations('globe');
  const tCosmos = useTranslations('cosmos');
  const tTerritory = useTranslations('cosmos.territory');
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  const viewRef = useRef<PlanetViewHandle | null>(null);
  const [ready, setReady] = useState(false);

  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  // Down on the surface, looking at the base itself.
  const [onSurface, setOnSurface] = useState(false);
  const { t: tScenario } = useScenarioMessages((scenario?.id as ScenarioId | undefined) ?? null);
  const nameOf = useCallback(
    (id: string) => {
      const c = state?.countries[id];
      return c ? tScenario(c.nameKey) : id;
    },
    [state?.countries, tScenario],
  );

  // Land: who holds what, what stands on it, what is being staked out.
  const sectors = useMemo(() => (state ? getSectorStatus(state, body) : []), [state, body]);
  const hasColony = Boolean(state?.cosmos?.colonies?.[body]);
  const playerId = state?.playerCountryId;
  const colorOf = useCallback((id: string) => state?.countries[id]?.color ?? '#9aa7b5', [state?.countries]);
  const sectorSignature = useMemo(
    () =>
      JSON.stringify([
        hasColony,
        selectedSector,
        sectors.map((s) => [s.owner, s.structures.length, s.work?.kind ?? null, s.claimable]),
      ]),
    [hasColony, selectedSector, sectors],
  );

  useEffect(() => {
    if (!ready) return;
    viewRef.current?.drawOverlay((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      if (!hasColony) return;
      const x = (lon: number) => ((lon + 180) / 360) * w;
      const y = (lat: number) => ((90 - lat) / 180) * h;
      const cell = (s: (typeof sectors)[number]) =>
        [x(s.def.lon0), y(s.def.lat1), x(s.def.lon1) - x(s.def.lon0), y(s.def.lat0) - y(s.def.lat1)] as const;
      // The grid, faintly: the surface stays the hero.
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      for (const s of sectors) ctx.strokeRect(...cell(s));
      for (const s of sectors) {
        const [cx, cy, cw, ch] = cell(s);
        if (s.owner) {
          const mine = s.owner === playerId;
          const color = mine ? '#f5b450' : colorOf(s.owner);
          ctx.globalAlpha = mine ? 0.16 : 0.14;
          ctx.fillStyle = color;
          ctx.fillRect(cx, cy, cw, ch);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = color;
          ctx.lineWidth = mine ? 5 : 3;
          ctx.strokeRect(cx + 3, cy + 3, cw - 6, ch - 6);
        } else if (s.work || s.claimable) {
          ctx.setLineDash(s.work ? [18, 10] : [8, 14]);
          ctx.strokeStyle = s.work ? 'rgba(245,180,80,0.95)' : 'rgba(140,215,255,0.7)';
          ctx.lineWidth = s.work ? 5 : 3;
          ctx.strokeRect(cx + 4, cy + 4, cw - 8, ch - 8);
          ctx.setLineDash([]);
        }
      }
      const picked = sectors.find((s) => s.def.id === selectedSector);
      if (picked) {
        const [cx, cy, cw, ch] = cell(picked);
        ctx.shadowColor = 'rgba(255,255,255,0.9)';
        ctx.shadowBlur = 16;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 5;
        ctx.strokeRect(cx + 2, cy + 2, cw - 4, ch - 4);
        ctx.shadowBlur = 0;
      }
    });
    // The signature captures every input of the draw closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sectorSignature]);

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
    // Structures stand where they were built, two to a sector.
    for (const sector of sectors) {
      if (sector.owner !== playerId) continue;
      const centre = sectorCentre(sector.def);
      sector.structures.forEach((kind, i) => {
        const Icon = STRUCTURE_ICON[kind];
        const spread = (i - (SECTOR_SLOTS - 1) / 2) * 14;
        out.push({
          id: `structure:${sector.def.id}:${i}`,
          lon: centre.lon + spread,
          lat: centre.lat - 9,
          kind: 'dot',
          priority: 300,
          width: 0,
          node: (
            <span
              title={`${tTerritory(`structure.${kind}`)} · ${sector.def.name}`}
              className="-ml-3 grid h-6 w-6 place-items-center rounded-md border border-[#f5b450]/60 bg-black/70 text-[#f5b450] shadow-[0_0_10px_rgba(245,180,80,0.45)]"
            >
              <Icon aria-hidden className="h-3.5 w-3.5" />
              <span className="sr-only">{tTerritory(`structure.${kind}`)}</span>
            </span>
          ),
        });
      });
    }
    return out;
  }, [sites, sectors, playerId, t, tCosmos, tTerritory, setSelectedPanel]);

  if (!state) return null;
  const bodyName = tCosmos(`bodies.${body}`);

  if (onSurface && hasColony) {
    return <BaseView body={body} onLeave={() => setOnSurface(false)} />;
  }

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
        onPick={(lon, lat) => {
          if (!hasColony) return;
          const id = sectorAt(body, lon, lat).id;
          setSelectedSector((current) => (current === id ? null : id));
        }}
        onReady={() => setReady(true)}
      />
      <ColonyCard
        body={body}
        selectedSector={selectedSector}
        nameOf={nameOf}
        onVisit={() => setOnSurface(true)}
      />
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

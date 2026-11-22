'use client';

// Central stage of the play screen: the world the player is looking at
// (Earth, Moon, Mars or the whole system) plus the view switcher and the
// selected-country card that float over it.

import { Earth, Moon, Orbit, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { settledBodies } from '@aurion/engine';

import { cn } from '../../lib/cn';
import { useGameStore, type MapView } from '../../lib/store';

import CountryCard from './CountryCard';
import GlobeMap from './GlobeMap';
import OffworldView from './OffworldView';
import SystemView from './SystemView';

/** A small filled disc reads as "a planet" better than any stock icon. */
function MarsGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <circle cx="14.5" cy="14.5" r="2.2" fill="currentColor" />
    </svg>
  );
}

const VIEWS: readonly { id: MapView; icon: LucideIcon | typeof MarsGlyph }[] = [
  { id: 'earth', icon: Earth },
  { id: 'moon', icon: Moon },
  { id: 'mars', icon: MarsGlyph },
  { id: 'system', icon: Orbit },
];

export default function MapStage() {
  const t = useTranslations('globe');
  const view = useGameStore((s) => s.mapView);
  const setMapView = useGameStore((s) => s.setMapView);
  const cosmos = useGameStore((s) => s.state?.cosmos);
  const settled = cosmos ? settledBodies(cosmos) : ['earth'];

  return (
    <div className="absolute inset-0">
      {view === 'earth' ? <GlobeMap /> : null}
      {view === 'moon' || view === 'mars' ? <OffworldView body={view} /> : null}
      {view === 'system' ? <SystemView /> : null}

      {/* View switcher — where am I looking? */}
      <div
        role="radiogroup"
        aria-label={t('views.label')}
        data-testid="view-switch"
        className="glass-panel absolute bottom-14 left-1/2 z-10 flex -translate-x-1/2 gap-0.5 rounded-full p-1 lg:bottom-auto lg:top-[4.5rem]"
      >
        {VIEWS.map(({ id, icon: Icon }) => {
          const active = view === id;
          const present = id !== 'system' && id !== 'earth' && settled.includes(id);
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={`view-${id}`}
              onClick={() => setMapView(id)}
              className={cn(
                'relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                active ? 'bg-accent text-black' : 'text-fg-muted hover:bg-white/10 hover:text-fg',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span>{t(`views.${id}`)}</span>
              {present ? (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
              ) : null}
            </button>
          );
        })}
      </div>

      {view === 'earth' ? (
        <div className="pointer-events-none absolute bottom-[6.75rem] left-1/2 z-10 -translate-x-1/2 lg:bottom-[4.75rem]">
          <CountryCard />
        </div>
      ) : null}
    </div>
  );
}

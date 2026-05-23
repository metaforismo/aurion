'use client';

// Real-world Atlas renderer for Aurion. Replaces the hand-coded SVG polygons
// with actual country borders from Natural Earth (1:110m, via the
// `world-atlas` npm package). One component covers all three real-world
// scenarios — `mondo-contemporaneo`, `guerra-fredda`, and the fictional
// `ascesa-aurion` which re-labels a Mediterranean / Middle-East / Sahel
// crop with Aurion names so the map finally looks like a real map.
//
// The renderer is structured as:
//   - A single <svg> with a configured projection (geoEqualEarth for world
//     scenarios, geoEquirectangular fit to the regional crop for Aurion).
//   - One <path> per country, fill resolved from the scenario's per-ISO
//     bucket (continent / bloc / region tint).
//   - One <circle> + <text> per FEATURED country (those listed in the
//     scenario): the capital dot + label, with the player country wearing
//     the brand accent + "YOU" marker.
//   - Reused overlay primitives from `MapOverlay` (alliances, tension, intel,
//     blocs) re-projected to pixel coordinates so they sit on top of the
//     real geometry instead of the fictional layout.
//
// All store interactions (selectCountry, hover state, scenario messages,
// player country resolution) mirror the legacy `WorldMap`. The intent is
// drop-in replacement: a parent `<WorldMap />` simply delegates here when
// the active scenario is one of the three real-world ones.

import { useTranslations } from 'next-intl';
import {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { geoCentroid, geoPath, type GeoProjection } from 'd3-geo';
import type { Feature, Geometry } from 'geojson';
import type {
  Country,
  CountryId,
  GameState,
  IntelLevel,
  Scenario,
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import { loadScenarioMessages } from '../../lib/scenarios';
import { useGameStore } from '../../lib/store';
import {
  loadWorld,
  type CountryFeature,
  type WorldCollection,
} from '../../lib/geo/world';
import {
  regionProjection,
  worldProjection,
  type Extent,
} from '../../lib/geo/projections';
import {
  ASCESA_COUNTRY_BY_ISO,
  ASCESA_REGION_BY_COUNTRY,
  ASCESA_REGION_TINT,
  GF_COUNTRY_BY_ISO,
  MC_COUNTRY_BY_ISO,
  QUICK_START_COUNTRY_BY_ISO,
  blocByIso,
  continentByIso,
  type GfBloc,
  type McRegion,
} from '../../lib/geo/scenario-mapping';

import MapLegend from './MapLegend';
import MapTooltip from './MapTooltip';
import {
  BLOC_COLOR,
  computeAllianceEdges,
  computeBlocOverlay,
  computeIntelMask,
  computeRegionTension,
  intelToVisuals,
  tensionToColor,
  type BlocColorKey,
  type OverlayMode,
} from './MapOverlay';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** SVG viewBox the projection fits into. 16:9 keeps parity with the legacy map. */
const VIEW = { x: 0, y: 0, w: 1600, h: 900 } as const;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
const DRAG_THRESHOLD_PX = 4;
const FOCUS_TRANSITION_MS = 300;

type ViewBox = { x: number; y: number; w: number; h: number };

type SupportedLocale = 'it' | 'en';
function isSupportedLocale(s: string | undefined): s is SupportedLocale {
  return s === 'it' || s === 'en';
}

// ---------------------------------------------------------------------------
// Per-scenario palettes
// ---------------------------------------------------------------------------

const CONTINENT_FILL: Readonly<Record<McRegion, string>> = {
  'mc-americas': 'var(--color-region-auriana)',
  'mc-europe': 'var(--color-region-borealis)',
  'mc-africa': 'var(--color-region-sahel)',
  'mc-middle-east': 'var(--color-region-meridia)',
  'mc-asia-pacific': 'var(--color-region-oriana)',
  'mc-oceania': 'var(--color-region-meridia)',
};

const BLOC_FILL: Readonly<Record<GfBloc, string>> = {
  'gf-north-atlantic': 'var(--color-info)',
  'gf-warsaw-pact': 'var(--color-danger)',
  'gf-non-aligned': 'var(--color-fg-muted)',
  'gf-asian-tigers': 'var(--color-region-oriana)',
  'gf-global-south': 'var(--color-region-sahel)',
};

// Neutral fill used for any country that does not carry an explicit scenario
// bucket (e.g. landlocked country in MC that isn't featured; small Atlantic
// island in GF).
const NEUTRAL_FILL = 'var(--color-surface-1)';

// ---------------------------------------------------------------------------
// Helpers — pure
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clientToSvg(
  client: { x: number; y: number },
  rect: DOMRect,
  vb: ViewBox,
): { x: number; y: number } {
  const px = (client.x - rect.left) / rect.width;
  const py = (client.y - rect.top) / rect.height;
  return { x: vb.x + px * vb.w, y: vb.y + py * vb.h };
}

function clampViewBoxX(x: number, w: number): number {
  const min = VIEW.x - w * 0.15;
  const max = VIEW.x + VIEW.w - w * 0.85;
  return clamp(x, min, max);
}

function clampViewBoxY(y: number, h: number): number {
  const min = VIEW.y - h * 0.15;
  const max = VIEW.y + VIEW.h - h * 0.85;
  return clamp(y, min, max);
}

function getIso(feature: CountryFeature): string {
  // world-atlas exposes the M49 numeric code as `id`, padded to 3 chars in
  // most entries but occasionally not — normalise to a left-padded 3-char
  // string so the lookup tables match consistently.
  const raw = feature.id != null ? String(feature.id) : '';
  return raw.padStart(3, '0');
}

function formatBig(n: number): string {
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function localiseName(c: Country, msgs: Record<string, string>): string {
  return msgs[c.nameKey] ?? c.id;
}

function localiseCapital(c: Country, msgs: Record<string, string>): string {
  return msgs[c.capitalKey] ?? c.capitalKey;
}

function relKey(a: CountryId, b: CountryId) {
  return a < b ? (`${a}::${b}` as const) : (`${b}::${a}` as const);
}

function getAttitude(
  state: GameState,
  a: CountryId,
  b: CountryId,
): number | null {
  const r = state.relations[relKey(a, b)];
  return r ? r.attitude : null;
}

// ---------------------------------------------------------------------------
// Scenario resolution
// ---------------------------------------------------------------------------

type ScenarioMode = 'mondo' | 'fredda' | 'aurion' | 'quick';

function modeFor(scenarioId: string | undefined): ScenarioMode | null {
  if (scenarioId === 'mondo-contemporaneo') return 'mondo';
  if (scenarioId === 'guerra-fredda') return 'fredda';
  if (scenarioId === 'ascesa-aurion') return 'aurion';
  if (scenarioId === 'quick-start') return 'quick';
  return null;
}

function isoToCountryIdFor(
  mode: ScenarioMode,
): Readonly<Record<string, string>> {
  switch (mode) {
    case 'mondo':
      return MC_COUNTRY_BY_ISO;
    case 'fredda':
      return GF_COUNTRY_BY_ISO;
    case 'aurion':
      return ASCESA_COUNTRY_BY_ISO;
    case 'quick':
      return QUICK_START_COUNTRY_BY_ISO;
  }
}

/**
 * Per-mode fill resolution. Returns the colour string to paint on a feature
 * given its ISO code. Returns the neutral fill when the country is not
 * meaningfully part of the scenario (e.g. Greenland in GF) so the world is
 * still visible but only featured polygons stand out.
 */
function fillForCountry(
  mode: ScenarioMode,
  iso: string,
): string {
  switch (mode) {
    case 'mondo': {
      const cont = continentByIso(iso);
      return cont ? CONTINENT_FILL[cont] : NEUTRAL_FILL;
    }
    case 'fredda': {
      const bloc = blocByIso(iso);
      return bloc ? BLOC_FILL[bloc] : NEUTRAL_FILL;
    }
    case 'aurion': {
      const fictionalId = ASCESA_COUNTRY_BY_ISO[iso];
      if (!fictionalId) return NEUTRAL_FILL;
      const regionId = ASCESA_REGION_BY_COUNTRY[fictionalId];
      return regionId ? ASCESA_REGION_TINT[regionId] ?? NEUTRAL_FILL : NEUTRAL_FILL;
    }
    case 'quick': {
      // Quick Start: tint featured countries with the auriana accent; the
      // rest stay neutral. Keeps the editorial calm: 6 spotlights.
      return QUICK_START_COUNTRY_BY_ISO[iso]
        ? 'var(--color-region-auriana)'
        : NEUTRAL_FILL;
    }
  }
}

// Filter the world FeatureCollection down to the subset shown by the active
// scenario. World scenarios get the full collection; the regional scenarios
// crop to only the features they actually re-label, with one wider buffer
// of geographic context (a real map of "the Aurion region" needs more than
// just the 25 game countries to read as a continent).
function filterForMode(
  world: WorldCollection,
  mode: ScenarioMode,
): WorldCollection {
  if (mode === 'mondo' || mode === 'fredda') return world;
  if (mode === 'aurion') {
    // Mediterranean + Middle East + Sahel + North Europe rim.
    const allowed = new Set<string>([
      // Featured Aurion countries
      ...Object.keys(ASCESA_COUNTRY_BY_ISO),
      // Geographic context (greyed out — gives the region a sense of place
      // without overwhelming the featured nations).
      '004', '008', '031', '040', '044', '048', '050', '051', '056', '070',
      '100', '112', '120', '140', '148', '178', '191', '196', '203',
      '208', '218', '226', '231', '232', '233', '246', '262', '266', '268',
      '270', '275', '288', '320', '324', '348', '352', '368', '372', '376',
      '384', '414', '417', '428', '430', '440', '442', '450', '454', '478',
      '498', '499', '512', '524', '528', '566', '578', '588', '600', '620',
      '624', '634', '642', '643', '646', '684', '688', '694', '703', '705',
      '706', '707', '716', '728', '732', '748', '752', '756', '768', '784',
      '795', '800', '807', '826', '834', '854', '887', '894',
    ]);
    return {
      ...world,
      features: world.features.filter((f: CountryFeature) => allowed.has(getIso(f))),
    };
  }
  // Quick Start: 6 featured countries + a single ring of European context.
  const allowed = new Set<string>([
    ...Object.keys(QUICK_START_COUNTRY_BY_ISO),
    '040', '056', '100', '191', '203', '208', '246', '250', '276', '300',
    '348', '352', '372', '380', '442', '498', '499', '528', '578', '616',
    '620', '642', '688', '703', '705', '724', '752', '756', '792', '804',
    '807', '818', '826', '012', '434', '504', '788',
  ]);
  return {
    ...world,
    features: world.features.filter((f: CountryFeature) => allowed.has(getIso(f))),
  };
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export default function RealWorldMap() {
  const t = useTranslations('map');
  const tRegions = useTranslations('map.regions');
  const tIntel = useTranslations('map.intel');
  const tOverlay = useTranslations('map.overlay');
  const tTooltip = useTranslations('map.tooltip');
  const tNation = useTranslations('map.nation');

  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const selectedCountryId = useGameStore((s) => s.selectedCountryId);
  const selectCountry = useGameStore((s) => s.selectCountry);

  const mode = useMemo(() => modeFor(scenario?.id), [scenario?.id]);

  // Locale resolution mirrors the legacy WorldMap to keep messages aligned.
  const locale: SupportedLocale = useMemo(() => {
    if (typeof document !== 'undefined') {
      const lang = document.documentElement.lang;
      if (isSupportedLocale(lang)) return lang;
    }
    return 'it';
  }, []);

  const [scenarioMessages, setScenarioMessages] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!scenario) return;
    let cancelled = false;
    void loadScenarioMessages(
      scenario.id as Parameters<typeof loadScenarioMessages>[0],
      locale,
    ).then((m) => {
      if (!cancelled) setScenarioMessages(m);
    });
    return () => {
      cancelled = true;
    };
  }, [scenario, locale]);

  // World data is loaded lazily — first render shows a loading frame, then
  // re-renders once the FeatureCollection resolves.
  const [world, setWorld] = useState<WorldCollection | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadWorld().then((w) => {
      if (!cancelled) setWorld(w);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered features for the active mode (full world for MC/GF, regional
  // crop for Aurion / Quick Start).
  const filteredWorld = useMemo(() => {
    if (!world || !mode) return null;
    return filterForMode(world, mode);
  }, [world, mode]);

  // Projection + pathBuilder. Recomputed when the filtered world or mode
  // changes — both are stable across normal play (scenario doesn't change
  // mid-game), so this is a one-shot cost.
  const projection = useMemo<GeoProjection | null>(() => {
    if (!filteredWorld || !mode) return null;
    const extent: Extent = [
      [VIEW.x, VIEW.y],
      [VIEW.x + VIEW.w, VIEW.y + VIEW.h],
    ];
    if (mode === 'mondo' || mode === 'fredda') {
      return worldProjection(filteredWorld, extent);
    }
    return regionProjection(filteredWorld, extent);
  }, [filteredWorld, mode]);

  const pathBuilder = useMemo(() => {
    if (!projection) return null;
    return geoPath(projection);
  }, [projection]);

  // Per-feature path string + centroid (precomputed; pure derived data).
  type RenderedFeature = {
    iso: string;
    feature: CountryFeature;
    d: string;
    cx: number;
    cy: number;
    countryId: string | null;
    fill: string;
  };

  const rendered: RenderedFeature[] = useMemo(() => {
    if (!filteredWorld || !pathBuilder || !projection || !mode) return [];
    const isoTable = isoToCountryIdFor(mode);
    const out: RenderedFeature[] = [];
    for (const feature of filteredWorld.features) {
      const iso = getIso(feature);
      const d = pathBuilder(feature as unknown as Feature<Geometry>);
      if (!d) continue;
      const centroid = projection(geoCentroid(feature as unknown as Feature<Geometry>));
      const cx = centroid?.[0] ?? 0;
      const cy = centroid?.[1] ?? 0;
      out.push({
        iso,
        feature,
        d,
        cx,
        cy,
        countryId: isoTable[iso] ?? null,
        fill: fillForCountry(mode, iso),
      });
    }
    return out;
  }, [filteredWorld, pathBuilder, projection, mode]);

  // Country → projected centroid lookup (used for tension/intel/blocs/
  // alliance overlays which previously assumed pixel positions on the
  // hand-coded layout).
  const centroidByCountry: Map<string, { x: number; y: number }> = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const r of rendered) {
      if (r.countryId) m.set(r.countryId, { x: r.cx, y: r.cy });
    }
    return m;
  }, [rendered]);

  // ----- UI state ----------------------------------------------------------
  const [overlay, setOverlay] = useState<OverlayMode>('none');
  const [hoveredId, setHoveredId] = useState<CountryId | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  // ----- Derived overlay data ---------------------------------------------
  const intelMask = useMemo(() => {
    if (!state) return new Map<CountryId, IntelLevel>();
    return computeIntelMask(state);
  }, [state]);

  const allianceEdges = useMemo(() => {
    if (!state) return [];
    // The shared helper precomputes endpoint coordinates from the fictional
    // NATION_POSITIONS table; for the real-world renderer we re-project to
    // our centroid table after the fact. We only need the from/to pairs and
    // colour assignments, so rebuild from the same helper output and replace
    // x/y.
    const edges = computeAllianceEdges(state);
    return edges
      .map((e) => {
        const a = centroidByCountry.get(e.from);
        const b = centroidByCountry.get(e.to);
        if (!a || !b) return null;
        return { ...e, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [state, centroidByCountry]);

  // Country list backing the bloc overlay (mirrors WorldMap).
  const countryEntries: ReadonlyArray<Country> = useMemo(() => {
    if (!state || !scenario) return [];
    return scenario.countries
      .map((init) => state.countries[init.id])
      .filter((c): c is Country => Boolean(c));
  }, [state, scenario]);

  const blocsAvailable = state?.blocs !== undefined;
  const { byCountry: blocByCountry } = useMemo(
    () => computeBlocOverlay(overlay === 'blocs', countryEntries),
    [overlay, countryEntries],
  );

  // Tension: aggregate per featured country (we don't have per-region
  // boundaries on the real world). We approximate by inheriting the
  // per-region tension computed by the shared overlay helper.
  const tensionByCountry = useMemo(() => {
    const out = new Map<string, number>();
    if (!state) return out;
    const byRegion = computeRegionTension(state);
    for (const c of Object.values(state.countries)) {
      const t = byRegion.get(c.regionId);
      if (t !== undefined) out.set(c.id, t);
    }
    return out;
  }, [state]);

  // ----- View box (pan + zoom) --------------------------------------------
  const [viewBox, setViewBox] = useState<ViewBox>({
    x: VIEW.x,
    y: VIEW.y,
    w: VIEW.w,
    h: VIEW.h,
  });
  const [transitioning, setTransitioning] = useState(false);
  const transitionTimer = useRef<number | null>(null);

  // Smooth focus when an external selection happens.
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (s.selectedCountryId === prev.selectedCountryId) return;
      const id = s.selectedCountryId;
      if (!id) return;
      const pos = centroidByCountry.get(id);
      if (!pos) return;
      setViewBox((current) => {
        const w = current.w;
        const h = current.h;
        const x = clampViewBoxX(pos.x - w / 2, w);
        const y = clampViewBoxY(pos.y - h / 2, h);
        return { x, y, w, h };
      });
      setTransitioning(true);
      if (transitionTimer.current !== null) {
        window.clearTimeout(transitionTimer.current);
      }
      transitionTimer.current = window.setTimeout(() => {
        setTransitioning(false);
        transitionTimer.current = null;
      }, FOCUS_TRANSITION_MS + 50);
    });
    return () => {
      unsubscribe();
      if (transitionTimer.current !== null) {
        window.clearTimeout(transitionTimer.current);
        transitionTimer.current = null;
      }
    };
  }, [centroidByCountry]);

  // Pointer-driven panning + pinch zoom.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragStateRef = useRef<{
    startVB: ViewBox;
    startClient: { x: number; y: number };
  } | null>(null);
  const pinchStateRef = useRef<{
    startVB: ViewBox;
    startDistance: number;
    centerClient: { x: number; y: number };
  } | null>(null);

  const handleSvgPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const ptrs = pointersRef.current;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size >= 2) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      if (transitionTimer.current !== null) {
        window.clearTimeout(transitionTimer.current);
        transitionTimer.current = null;
      }
      setTransitioning(false);
      if (ptrs.size === 1) {
        dragStateRef.current = {
          startVB: viewBox,
          startClient: { x: e.clientX, y: e.clientY },
        };
        pinchStateRef.current = null;
      } else if (ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values());
        if (a && b) {
          pinchStateRef.current = {
            startVB: viewBox,
            startDistance: distance(a, b),
            centerClient: midpoint(a, b),
          };
        }
        dragStateRef.current = null;
      }
    },
    [viewBox],
  );

  const handleSvgPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const ptrs = pointersRef.current;
      if (ptrs.has(e.pointerId)) {
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      setPointer({ x: e.clientX, y: e.clientY });

      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();

      if (ptrs.size === 2 && pinchStateRef.current) {
        const [a, b] = Array.from(ptrs.values());
        if (!a || !b) return;
        const newDist = distance(a, b);
        const ratio = pinchStateRef.current.startDistance / Math.max(newDist, 1);
        const start = pinchStateRef.current.startVB;
        const newW = clamp(start.w * ratio, VIEW.w / MAX_ZOOM, VIEW.w / MIN_ZOOM);
        const newH = (newW / VIEW.w) * VIEW.h;
        const centerSvg = clientToSvg(
          pinchStateRef.current.centerClient,
          rect,
          start,
        );
        const x = clampViewBoxX(centerSvg.x - newW / 2, newW);
        const y = clampViewBoxY(centerSvg.y - newH / 2, newH);
        setViewBox({ x, y, w: newW, h: newH });
        return;
      }

      if (ptrs.size === 1 && dragStateRef.current) {
        const totalDx = e.clientX - dragStateRef.current.startClient.x;
        const totalDy = e.clientY - dragStateRef.current.startClient.y;
        if (Math.hypot(totalDx, totalDy) < DRAG_THRESHOLD_PX) return;
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        const dx = (totalDx / rect.width) * dragStateRef.current.startVB.w;
        const dy = (totalDy / rect.height) * dragStateRef.current.startVB.h;
        const start = dragStateRef.current.startVB;
        setViewBox({
          x: clampViewBoxX(start.x - dx, start.w),
          y: clampViewBoxY(start.y - dy, start.h),
          w: start.w,
          h: start.h,
        });
      }
    },
    [],
  );

  const handleSvgPointerUp = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const ptrs = pointersRef.current;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinchStateRef.current = null;
      if (ptrs.size === 0) dragStateRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // capture may already be released.
      }
    },
    [],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = svg.getBoundingClientRect();
      setViewBox((prev) => {
        const factor = Math.exp(ev.deltaY * 0.001);
        const newW = clamp(prev.w * factor, VIEW.w / MAX_ZOOM, VIEW.w / MIN_ZOOM);
        const newH = (newW / VIEW.w) * VIEW.h;
        const centerSvg = clientToSvg(
          { x: ev.clientX, y: ev.clientY },
          rect,
          prev,
        );
        const x = clampViewBoxX(centerSvg.x - newW / 2, newW);
        const y = clampViewBoxY(centerSvg.y - newH / 2, newH);
        return { x, y, w: newW, h: newH };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const handleBackgroundClick = useCallback(
    (e: ReactPointerEvent<SVGRectElement>) => {
      const drag = dragStateRef.current;
      if (drag) {
        const dx = Math.abs(e.clientX - drag.startClient.x);
        const dy = Math.abs(e.clientY - drag.startClient.y);
        if (dx > 4 || dy > 4) return;
      }
      selectCountry(null);
    },
    [selectCountry],
  );

  // ----- Render guards ----------------------------------------------------
  if (!state || !scenario) {
    return (
      <div
        className={cn(
          'flex min-h-[60vh] items-center justify-center rounded-xl border border-dashed border-border bg-surface/30 text-xs text-fg-faint',
        )}
        aria-label={t('label')}
      >
        {t('loading')}
      </div>
    );
  }
  if (!filteredWorld || !pathBuilder) {
    return (
      <div
        className={cn(
          'flex min-h-[60vh] items-center justify-center rounded-xl border border-dashed border-border bg-surface/30 text-xs text-fg-faint',
        )}
        aria-label={t('label')}
      >
        {t('loading')}
      </div>
    );
  }

  // ----- Render -----------------------------------------------------------
  const playerCountryId = state.playerCountryId;
  const selectedId = selectedCountryId;

  const overlayLabels: Record<OverlayMode, string> = {
    none: tOverlay('none'),
    tension: tOverlay('tension'),
    alliances: tOverlay('alliances'),
    intel: tOverlay('intel'),
    blocs: tOverlay('blocs'),
  };
  const overlayDisabled: Partial<Record<OverlayMode, { tooltip?: string }>> =
    blocsAvailable ? {} : { blocs: { tooltip: tOverlay('blocsUnavailable') } };
  const blocLegendLabels: Record<BlocColorKey, string> = {
    western: t('legend.bloc.western'),
    eastern: t('legend.bloc.eastern'),
    'non-aligned': t('legend.bloc.non-aligned'),
    unaligned: t('legend.bloc.unaligned'),
  };

  const selectedCountry =
    selectedId !== null ? state.countries[selectedId] : undefined;
  const hoveredCountry =
    hoveredId !== null ? state.countries[hoveredId] : undefined;
  const tooltipCountry = hoveredCountry ?? selectedCountry;
  const tooltipId = tooltipCountry?.id ?? null;

  return (
    <div
      className={cn('relative h-full min-h-[60vh] w-full overflow-hidden bg-bg')}
      role="region"
      aria-label={t('label')}
    >
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
          'h-full w-full touch-none select-none',
          transitioning ? 'transition-[viewBox] duration-300 ease-out' : '',
        )}
        style={{
          transitionProperty: transitioning ? 'all' : 'none',
          transitionDuration: `${FOCUS_TRANSITION_MS}ms`,
        }}
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onPointerCancel={handleSvgPointerUp}
        onPointerLeave={(e) => {
          handleSvgPointerUp(e);
          setHoveredId(null);
        }}
      >
        <defs>
          <linearGradient id="rw-sea-depth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.15 0.04 240)" stopOpacity={1} />
            <stop offset="100%" stopColor="oklch(0.09 0.04 240)" stopOpacity={1} />
          </linearGradient>
          <linearGradient id="rw-sea-wash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-fg)" stopOpacity={0.02} />
            <stop offset="100%" stopColor="var(--color-fg)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Solid page bg + sea gradient + click-clear capture. */}
        <rect
          x={VIEW.x - 200}
          y={VIEW.y - 200}
          width={VIEW.w + 400}
          height={VIEW.h + 400}
          fill="var(--color-bg)"
        />
        <rect
          x={VIEW.x}
          y={VIEW.y}
          width={VIEW.w}
          height={VIEW.h}
          fill="url(#rw-sea-depth)"
          fillOpacity={0.55}
          pointerEvents="none"
        />
        <rect
          x={VIEW.x}
          y={VIEW.y}
          width={VIEW.w}
          height={VIEW.h}
          fill="url(#rw-sea-wash)"
          pointerEvents="none"
        />
        <rect
          x={VIEW.x - 200}
          y={VIEW.y - 200}
          width={VIEW.w + 400}
          height={VIEW.h + 400}
          fill="transparent"
          onClick={handleBackgroundClick}
        />

        {/* Country polygons */}
        <g aria-hidden>
          {rendered.map((r) => {
            const isPlayer = r.countryId === playerCountryId;
            const isSelected = r.countryId === selectedId;
            const isHovered = r.countryId === hoveredId;
            const isFeatured = r.countryId !== null;

            // Per-feature overlay-driven fill mutation.
            let fill = r.fill;
            let fillOpacity = isFeatured ? 0.82 : 0.45;
            if (overlay === 'tension' && r.countryId) {
              const t = tensionByCountry.get(r.countryId);
              if (t !== undefined) {
                fill = tensionToColor(t);
                fillOpacity = 0.7;
              }
            } else if (overlay === 'blocs' && blocsAvailable && r.countryId) {
              const k = blocByCountry.get(r.countryId);
              if (k) {
                fill = BLOC_COLOR[k];
                fillOpacity = 0.6;
              }
            } else if (overlay === 'intel' && r.countryId && !isPlayer) {
              const intel = intelMask.get(r.countryId) ?? 'none';
              const { opacity, greyscale } = intelToVisuals(intel);
              if (greyscale > 0) fillOpacity = fillOpacity * (1 - greyscale * 0.5);
              fillOpacity = fillOpacity * opacity;
            }

            const stroke = isPlayer
              ? 'var(--color-accent)'
              : isSelected
                ? 'var(--color-fg)'
                : isHovered
                  ? 'var(--color-accent)'
                  : 'var(--color-bg)';
            const strokeWidth = isPlayer
              ? 1.5
              : isSelected
                ? 1.2
                : isHovered
                  ? 0.9
                  : 0.5;

            return (
              <path
                key={`f-${r.iso}-${r.countryId ?? 'na'}`}
                d={r.d}
                fill={fill}
                fillOpacity={fillOpacity}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                strokeOpacity={isPlayer ? 1 : 0.7}
                style={{
                  cursor: isFeatured ? 'pointer' : 'default',
                  transition: 'fill-opacity 200ms',
                }}
                onPointerEnter={() => {
                  if (r.countryId) setHoveredId(r.countryId);
                }}
                onPointerLeave={() => {
                  if (r.countryId === hoveredId) setHoveredId(null);
                }}
                onClick={(e) => {
                  if (!r.countryId) return;
                  e.stopPropagation();
                  selectCountry(r.countryId === selectedId ? null : r.countryId);
                }}
                onKeyDown={(e: ReactKeyboardEvent<SVGPathElement>) => {
                  if (!r.countryId) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectCountry(r.countryId === selectedId ? null : r.countryId);
                  }
                }}
                tabIndex={isFeatured ? 0 : -1}
                role={isFeatured ? 'button' : undefined}
                data-country={r.countryId ?? undefined}
                data-iso={r.iso}
                data-testid={r.countryId ? `map-country-${r.countryId}` : undefined}
                aria-label={
                  r.countryId
                    ? buildAriaLabel(
                        state,
                        r.countryId,
                        scenarioMessages,
                        scenario,
                        tNation,
                        tRegions,
                      )
                    : undefined
                }
              />
            );
          })}
        </g>

        {/* Alliance edges */}
        {overlay === 'alliances' && allianceEdges.length > 0 ? (
          <g aria-hidden pointerEvents="none" data-overlay="alliances">
            {allianceEdges.map((e, i) => (
              <line
                key={`a-${e.from}-${e.to}-${i}`}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke={e.color}
                strokeOpacity={0.7}
                strokeWidth={1}
                strokeLinecap="round"
              />
            ))}
          </g>
        ) : null}

        {/* Capital dots + labels for featured countries */}
        <g>
          {rendered
            .filter((r) => r.countryId !== null)
            .map((r) => {
              const id = r.countryId as CountryId;
              const isPlayer = id === playerCountryId;
              const isSelected = id === selectedId;
              const isHovered = id === hoveredId;
              const country = state.countries[id];
              if (!country) return null;

              const intel = intelMask.get(id) ?? 'none';
              const intelKnown =
                isPlayer || intel === 'partial' || intel === 'full';
              const showLabel = overlay !== 'intel' || intelKnown;

              const dotR = isPlayer ? 5 : 4;
              return (
                <g
                  key={`cap-${id}`}
                  style={{ cursor: 'pointer', pointerEvents: 'all' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectCountry(id === selectedId ? null : id);
                  }}
                  onKeyDown={(e: ReactKeyboardEvent<SVGGElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectCountry(id === selectedId ? null : id);
                    }
                  }}
                  onPointerEnter={(e) => {
                    setHoveredId(id);
                    setPointer({ x: e.clientX, y: e.clientY });
                  }}
                  onPointerMove={(e) => setPointer({ x: e.clientX, y: e.clientY })}
                  onPointerLeave={() =>
                    setHoveredId((prev) => (prev === id ? null : prev))
                  }
                  role="button"
                  tabIndex={0}
                  aria-label={buildAriaLabel(
                    state,
                    id,
                    scenarioMessages,
                    scenario,
                    tNation,
                    tRegions,
                  )}
                  data-country={id}
                  data-player={isPlayer ? 'true' : undefined}
                >
                  {/* Player anchor disc */}
                  {isPlayer ? (
                    <circle
                      cx={r.cx}
                      cy={r.cy}
                      r={dotR + 5}
                      fill="var(--color-accent)"
                      fillOpacity={0.16}
                      pointerEvents="none"
                    />
                  ) : null}

                  {/* Hover hairline */}
                  {isHovered && !isSelected ? (
                    <circle
                      cx={r.cx}
                      cy={r.cy}
                      r={dotR + 3.5}
                      fill="none"
                      stroke="var(--color-accent)"
                      strokeWidth={1.5}
                      pointerEvents="none"
                    />
                  ) : null}

                  {/* Selected dashed ring (kept dasharray="4 3" for e2e parity) */}
                  {isSelected ? (
                    <circle
                      cx={r.cx}
                      cy={r.cy}
                      r={dotR + 3.5}
                      fill="none"
                      stroke="var(--color-fg)"
                      strokeOpacity={0.85}
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      pointerEvents="none"
                      style={{
                        animation: 'map-dash-march 2s linear infinite',
                      }}
                    />
                  ) : null}

                  {/* Contrast halo + dot */}
                  <circle
                    cx={r.cx}
                    cy={r.cy}
                    r={dotR + 2}
                    fill="var(--color-bg)"
                    fillOpacity={0.7}
                    pointerEvents="none"
                  />
                  <circle
                    cx={r.cx}
                    cy={r.cy}
                    r={dotR}
                    fill={isPlayer ? 'var(--color-accent)' : 'var(--color-fg)'}
                    stroke={isPlayer ? 'var(--color-accent)' : 'var(--color-bg)'}
                    strokeWidth={isPlayer ? 1.5 : 0.5}
                    strokeOpacity={isPlayer ? 1 : 0.6}
                    pointerEvents="none"
                    style={{
                      transformBox: 'fill-box',
                      transformOrigin: 'center',
                      animation: isPlayer
                        ? 'map-capital-pulse 1.6s ease-in-out infinite'
                        : undefined,
                    }}
                  />

                  {/* Bloc ring */}
                  {overlay === 'blocs' && blocsAvailable ? (
                    <circle
                      cx={r.cx}
                      cy={r.cy}
                      r={dotR + 5}
                      fill="none"
                      stroke={BLOC_COLOR[blocByCountry.get(id) ?? 'unaligned']}
                      strokeWidth={1}
                      strokeOpacity={
                        (blocByCountry.get(id) ?? 'unaligned') === 'unaligned'
                          ? 0.5
                          : 0.85
                      }
                      pointerEvents="none"
                    />
                  ) : null}

                  {/* Label */}
                  {showLabel ? (
                    <text
                      x={r.cx}
                      y={r.cy + dotR + 14}
                      textAnchor="middle"
                      fill={isPlayer ? 'var(--color-fg)' : 'var(--color-fg-muted)'}
                      fillOpacity={isPlayer ? 1 : 0.88}
                      fontSize={11}
                      fontWeight={isPlayer ? 600 : 500}
                      letterSpacing={1.2}
                      style={{
                        textTransform: 'uppercase',
                        fontFamily: 'var(--font-mono)',
                        userSelect: 'none',
                        paintOrder: 'stroke',
                        stroke: 'var(--color-bg)',
                        strokeWidth: 3,
                        strokeOpacity: 0.85,
                        strokeLinejoin: 'round',
                        pointerEvents: 'none',
                      }}
                    >
                      {localiseName(country, scenarioMessages)}
                    </text>
                  ) : null}

                  {/* Player marker */}
                  {isPlayer && showLabel ? (
                    <text
                      x={r.cx}
                      y={r.cy - dotR - 6}
                      textAnchor="middle"
                      fill="var(--color-accent)"
                      fontSize={9}
                      fontWeight={600}
                      letterSpacing={1.4}
                      style={{
                        textTransform: 'uppercase',
                        fontFamily: 'var(--font-mono)',
                        userSelect: 'none',
                        paintOrder: 'stroke',
                        stroke: 'var(--color-bg)',
                        strokeWidth: 3,
                        strokeOpacity: 0.85,
                        strokeLinejoin: 'round',
                        pointerEvents: 'none',
                      }}
                    >
                      {tNation('youMarker')}
                    </text>
                  ) : null}
                </g>
              );
            })}
        </g>
      </svg>

      <MapLegend
        mode={overlay}
        onChange={setOverlay}
        groupLabel={tOverlay('label')}
        labels={overlayLabels}
        disabled={overlayDisabled}
        blocLabels={blocLegendLabels}
      />

      {tooltipId && tooltipCountry ? (
        <MapTooltip
          x={pointer.x}
          y={pointer.y}
          country={tooltipCountry}
          name={localiseName(tooltipCountry, scenarioMessages)}
          capital={localiseCapital(tooltipCountry, scenarioMessages)}
          regionLabel={safeTranslate(tRegions, tooltipCountry.regionId)}
          intelLevel={
            tooltipCountry.id === playerCountryId
              ? 'full'
              : intelMask.get(tooltipCountry.id) ?? 'none'
          }
          isPlayer={tooltipCountry.id === playerCountryId}
          attitudeTowardPlayer={
            tooltipCountry.id === playerCountryId
              ? null
              : getAttitude(state, playerCountryId, tooltipCountry.id)
          }
          isSelected={tooltipCountry.id === selectedId}
          labels={{
            capital: tTooltip('capital'),
            gdp: tTooltip('gdp'),
            army: tTooltip('army'),
            attitude: tTooltip('attitude'),
            intel: tTooltip('intel'),
            intelHidden: tTooltip('intelHidden'),
            player: tTooltip('player'),
            selected: tTooltip('selected'),
            region: tTooltip('region'),
            intelByLevel: {
              none: tIntel('none'),
              rumors: tIntel('rumors'),
              partial: tIntel('partial'),
              full: tIntel('full'),
            },
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aria label builder
// ---------------------------------------------------------------------------

function buildAriaLabel(
  state: GameState,
  id: CountryId,
  messages: Record<string, string>,
  _scenario: Scenario,
  tNation: ReturnType<typeof useTranslations>,
  tRegions: ReturnType<typeof useTranslations>,
): string {
  const country = state.countries[id];
  if (!country) return id;
  const name = messages[country.nameKey] ?? country.id;
  return tNation('aria', {
    name,
    region: safeTranslate(tRegions, country.regionId),
    gdp: formatBig(country.economy.gdp),
    army: formatBig(country.military.armySize),
  });
}

/**
 * Translate a region key but fall back to the raw id when the namespace
 * doesn't carry an entry for it. `next-intl`'s `tRegions(key)` throws on
 * missing keys; we don't want a missing scenario region (e.g. a Quick Start
 * regionId not yet localised) to crash the tooltip.
 */
function safeTranslate(
  tr: ReturnType<typeof useTranslations>,
  key: string,
): string {
  try {
    return tr(key);
  } catch {
    return key;
  }
}

// Re-export so the scenario detector can live alongside the component.
export function isRealWorldScenario(scenarioId: string | undefined): boolean {
  return modeFor(scenarioId) !== null;
}

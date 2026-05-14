'use client';

// Aurion's stylised world map. This is the centrepiece of the play screen.
// It reads everything it needs from the Zustand store via selectors so the
// component only re-renders when relevant slices change (state, scenario,
// selectedCountryId).
//
// Visuals:
//   - 5 hand-authored macro regions (regions.ts).
//   - ~25 nations rendered as circles, sized by GDP, coloured by their
//     scenario-defined hue.
//   - Player country wears a golden halo; selected country wears a white
//     dashed ring.
//   - Toggleable overlays: tension (region heatmap), alliances (network
//     graph between allied countries), intel (mask unknown countries).
//
// Interactions:
//   - Click → selectCountry(id) (toggles off if same id).
//   - Hover → MapTooltip with localised name, capital, GDP, military.
//   - Pinch / wheel zoom + drag pan implemented via viewBox manipulation.
//   - Keyboard activate (Enter / Space) on focused nation.
//
// The component takes no props: the parent <PlayPage> just mounts it.

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
import type {
  Country,
  CountryId,
  GameState,
  IntelLevel,
  Relation,
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import { loadScenarioMessages } from '../../lib/scenarios';
import { useGameStore } from '../../lib/store';

import MapNation from './MapNation';
import MapTooltip from './MapTooltip';
import {
  AllianceEdges,
  OverlayToggle,
  type AllianceEdge,
  type OverlayMode,
} from './MapOverlay';
import {
  MAP_VIEWBOX,
  NATION_POSITIONS,
  REGIONS,
  REGION_ORDER,
  validateGeometry,
  type RegionDef,
} from './regions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
/** Pixel distance past which a single-pointer interaction becomes a drag (instead of a tap). */
const DRAG_THRESHOLD_PX = 4;
const FOCUS_TRANSITION_MS = 300;

/** Locale code for scenario messages. We accept either; default to it. */
type SupportedLocale = 'it' | 'en';
function isSupportedLocale(s: string | undefined): s is SupportedLocale {
  return s === 'it' || s === 'en';
}

const ALLIANCE_GROUP_COLORS = [
  '#60a5fa', // blue-400
  '#f472b6', // pink-400
  '#34d399', // emerald-400
  '#fb923c', // orange-400
  '#a78bfa', // violet-400
  '#facc15', // yellow-400
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorldMap() {
  const t = useTranslations('map');
  const tRegions = useTranslations('map.regions');
  const tIntel = useTranslations('map.intel');
  const tOverlay = useTranslations('map.overlay');
  const tTooltip = useTranslations('map.tooltip');

  // -- Store subscriptions (narrow selectors, no whole-state) --------------
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const selectedCountryId = useGameStore((s) => s.selectedCountryId);
  const selectCountry = useGameStore((s) => s.selectCountry);

  // -- Local UI state -------------------------------------------------------
  const [overlay, setOverlay] = useState<OverlayMode>('none');
  const [hoveredId, setHoveredId] = useState<CountryId | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [scenarioMessages, setScenarioMessages] = useState<
    Record<string, string>
  >({});
  const svgRef = useRef<SVGSVGElement | null>(null);

  // -- Locale resolution. We avoid useLocale() to keep the component self-
  //    sufficient and tolerant of the scenarioMessages absence. --------------
  const locale: SupportedLocale = useMemo(() => {
    if (typeof document !== 'undefined') {
      const lang = document.documentElement.lang;
      if (isSupportedLocale(lang)) return lang;
    }
    return 'it';
  }, []);

  // Load localised scenario messages (country & capital names) once per
  // scenario+locale pair. The effect's only job is to subscribe to the
  // async loader and forward the result — we never call setState
  // synchronously inside the effect body.
  useEffect(() => {
    if (!scenario) return;
    const scenarioId = scenario.id;
    if (scenarioId !== 'ascesa-aurion') return;
    let cancelled = false;
    void loadScenarioMessages(scenarioId, locale).then((m) => {
      if (!cancelled) setScenarioMessages(m);
    });
    return () => {
      cancelled = true;
    };
  }, [scenario, locale]);

  // -- Geometry sanity check (dev only) -------------------------------------
  useEffect(() => {
    if (!scenario) return;
    if (process.env.NODE_ENV === 'production') return;
    const warnings = validateGeometry(
      scenario.countries.map((c) => ({ id: c.id, regionId: c.regionId })),
    );
    for (const w of warnings) {
      console.warn(w);
    }
  }, [scenario]);

  // -- Derived: alliance graph and edges -----------------------------------
  const allianceData = useMemo(() => {
    if (!state) return { edges: [] as AllianceEdge[] };
    const edges = computeAllianceEdges(state);
    return { edges };
  }, [state]);

  // -- Derived: region tension (heatmap fill) ------------------------------
  const regionTension = useMemo(() => {
    if (!state) return new Map<string, number>();
    return computeRegionTension(state);
  }, [state]);

  // -- Derived: intel mask per country -------------------------------------
  const intelMask = useMemo(() => {
    if (!state) return new Map<CountryId, IntelLevel>();
    return computeIntelMask(state);
  }, [state]);

  // -- ViewBox state (zoom + pan + smooth focus) ---------------------------
  const [viewBox, setViewBox] = useState<ViewBox>({
    x: MAP_VIEWBOX.x,
    y: MAP_VIEWBOX.y,
    w: MAP_VIEWBOX.width,
    h: MAP_VIEWBOX.height,
  });
  const [transitioning, setTransitioning] = useState(false);
  const transitionTimer = useRef<number | null>(null);

  // Smooth focus when an external selection happens (e.g. from a panel).
  // We subscribe to the store directly so the state mutation happens in
  // response to an external event rather than during render — this satisfies
  // react-hooks/set-state-in-effect.
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (s.selectedCountryId === prev.selectedCountryId) return;
      const id = s.selectedCountryId;
      if (!id) return;
      const pos = NATION_POSITIONS[id];
      if (!pos) return;
      setViewBox((current) => {
        const w = current.w;
        const h = current.h;
        const x = clamp(
          pos.x - w / 2,
          MAP_VIEWBOX.x - w * 0.1,
          MAP_VIEWBOX.x + MAP_VIEWBOX.width - w * 0.9,
        );
        const y = clamp(
          pos.y - h / 2,
          MAP_VIEWBOX.y - h * 0.1,
          MAP_VIEWBOX.y + MAP_VIEWBOX.height - h * 0.9,
        );
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
  }, []);

  // -- Pointer-driven panning + pinch-zoom ---------------------------------
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

      // Pinch needs immediate capture (two pointers = clearly a gesture, not
      // a tap). For single-pointer interactions we DO NOT capture yet — that
      // would swallow click events on inner nation buttons. The capture is
      // promoted to the SVG element only once the pointer has moved past the
      // click-vs-drag threshold (see handleSvgPointerMove).
      if (ptrs.size >= 2) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }

      // Reset any in-progress focus transition the moment the user grabs.
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
      // Track pointer for tooltip placement.
      setPointer({ x: e.clientX, y: e.clientY });

      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();

      // Pinch (2 pointers)
      if (ptrs.size === 2 && pinchStateRef.current) {
        const [a, b] = Array.from(ptrs.values());
        if (!a || !b) return;
        const newDist = distance(a, b);
        const ratio = pinchStateRef.current.startDistance / Math.max(newDist, 1);
        const start = pinchStateRef.current.startVB;
        const newW = clamp(
          start.w * ratio,
          MAP_VIEWBOX.width / MAX_ZOOM,
          MAP_VIEWBOX.width / MIN_ZOOM,
        );
        const newH = (newW / MAP_VIEWBOX.width) * MAP_VIEWBOX.height;
        // Anchor to the pinch centre.
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

      // Pan (1 pointer drag) — but only after the pointer has moved enough
      // that we're sure the user is dragging, not tapping a nation.
      if (ptrs.size === 1 && dragStateRef.current) {
        const totalDx = e.clientX - dragStateRef.current.startClient.x;
        const totalDy = e.clientY - dragStateRef.current.startClient.y;
        if (Math.hypot(totalDx, totalDy) < DRAG_THRESHOLD_PX) return;

        // Cross the threshold → take pointer capture so the rest of the drag
        // doesn't get hijacked by underlying elements. Safe to call repeatedly.
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
      if (ptrs.size < 2) {
        pinchStateRef.current = null;
      }
      if (ptrs.size === 0) {
        dragStateRef.current = null;
      }
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Some browsers throw when capture has already been released.
      }
    },
    [],
  );

  // Wheel zoom (desktop trackpad / mouse wheel).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (ev: WheelEvent) => {
      // Only zoom when the cursor is over the map and the gesture is intent
      // (delta not too tiny) to avoid hijacking page scroll inadvertently.
      ev.preventDefault();
      const rect = svg.getBoundingClientRect();
      setViewBox((prev) => {
        const factor = Math.exp(ev.deltaY * 0.001);
        const newW = clamp(
          prev.w * factor,
          MAP_VIEWBOX.width / MAX_ZOOM,
          MAP_VIEWBOX.width / MIN_ZOOM,
        );
        const newH = (newW / MAP_VIEWBOX.width) * MAP_VIEWBOX.height;
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

  // -- Click on empty SVG background clears selection ----------------------
  const handleBackgroundClick = useCallback(
    (e: ReactPointerEvent<SVGRectElement>) => {
      // Only treat as a true background click if the user did not drag.
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

  // -- Render --------------------------------------------------------------
  if (!state || !scenario) {
    return (
      <div
        className={cn(
          'flex min-h-[60vh] items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-xs text-slate-500',
        )}
        aria-label={t('label')}
      >
        {t('loading')}
      </div>
    );
  }

  // Pre-compute per-country render entries so we can paint regions first,
  // then alliance edges, then nations on top.
  const countryEntries: ReadonlyArray<Country> = scenario.countries.map(
    (init) => state.countries[init.id],
  ).filter((c): c is Country => Boolean(c));

  const playerCountryId = state.playerCountryId;
  const selectedId = selectedCountryId;
  const overlayLabels: Record<OverlayMode, string> = {
    none: tOverlay('none'),
    tension: tOverlay('tension'),
    alliances: tOverlay('alliances'),
    intel: tOverlay('intel'),
  };

  const selectedCountry =
    selectedId !== null ? state.countries[selectedId] : undefined;
  const hoveredCountry =
    hoveredId !== null ? state.countries[hoveredId] : undefined;
  const tooltipCountry = hoveredCountry ?? selectedCountry;
  const tooltipId = tooltipCountry?.id ?? null;

  return (
    <div
      className={cn(
        'relative h-full min-h-[60vh] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950',
      )}
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
          // Fallback transition for browsers that don't animate the viewBox
          // attribute (most don't); we approximate via opacity hint and let
          // React's batched updates land in a single paint.
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
        {/* Background — captures clicks to clear selection. */}
        <rect
          x={MAP_VIEWBOX.x - 200}
          y={MAP_VIEWBOX.y - 200}
          width={MAP_VIEWBOX.width + 400}
          height={MAP_VIEWBOX.height + 400}
          fill="#020617"
          onClick={handleBackgroundClick}
        />

        {/* Decorative grid for orientation — extremely faint. */}
        <Grid />

        {/* Region silhouettes */}
        <g aria-hidden>
          {REGION_ORDER.map((id) => {
            const r = REGIONS[id];
            if (!r) return null;
            const tension = overlay === 'tension' ? regionTension.get(id) ?? 0 : 0;
            const fill =
              overlay === 'tension'
                ? tensionToColor(tension)
                : r.fill;
            return (
              <g key={id}>
                <path
                  d={r.pathD}
                  fill={fill}
                  stroke={r.stroke}
                  strokeWidth={2}
                  fillOpacity={0.85}
                />
                <RegionLabel region={r} label={tRegions(r.nameKey)} />
              </g>
            );
          })}
        </g>

        {/* Alliance edges (only when selected overlay) */}
        {overlay === 'alliances' ? (
          <AllianceEdges edges={allianceData.edges} />
        ) : null}

        {/* Nations */}
        <g>
          {countryEntries.map((c) => {
            const pos = NATION_POSITIONS[c.id];
            if (!pos) return null;
            const radius = computeNationRadius(c, pos.sizeHint);
            const isPlayer = c.id === playerCountryId;
            const isSelected = c.id === selectedId;
            const isHovered = c.id === hoveredId;
            const intel = intelMask.get(c.id) ?? 'none';
            const { opacity, greyscale } =
              overlay === 'intel'
                ? intelToVisuals(isPlayer ? 'full' : intel)
                : { opacity: 1, greyscale: 0 };
            const ariaLabel = t('nation.aria', {
              name: localiseName(c, scenarioMessages),
              region: tRegions(c.regionId),
              gdp: formatBig(c.economy.gdp),
              army: formatBig(c.military.armySize),
            });
            return (
              <MapNation
                key={c.id}
                countryId={c.id}
                cx={pos.x}
                cy={pos.y}
                radius={radius}
                color={c.color}
                ariaLabel={ariaLabel}
                isPlayer={isPlayer}
                isSelected={isSelected}
                isHovered={isHovered}
                opacity={opacity}
                greyscale={greyscale}
                onPointerEnter={(e) => {
                  setHoveredId(c.id);
                  setPointer({ x: e.clientX, y: e.clientY });
                }}
                onPointerMove={(e) => {
                  setPointer({ x: e.clientX, y: e.clientY });
                }}
                onPointerLeave={() => {
                  setHoveredId((prev) => (prev === c.id ? null : prev));
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  selectCountry(c.id === selectedId ? null : c.id);
                }}
                onKeyDown={(e: ReactKeyboardEvent<SVGGElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectCountry(c.id === selectedId ? null : c.id);
                  }
                }}
              />
            );
          })}
        </g>
      </svg>

      {/* Overlay toggle UI (HTML, anchored absolute) */}
      <OverlayToggle
        mode={overlay}
        onChange={setOverlay}
        groupLabel={tOverlay('label')}
        labels={overlayLabels}
      />

      {/* Tooltip */}
      {tooltipId && tooltipCountry ? (
        <MapTooltip
          x={pointer.x}
          y={pointer.y}
          country={tooltipCountry}
          name={localiseName(tooltipCountry, scenarioMessages)}
          capital={localiseCapital(tooltipCountry, scenarioMessages)}
          regionLabel={tRegions(tooltipCountry.regionId)}
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

// ===========================================================================
// Helpers
// ===========================================================================

type ViewBox = { x: number; y: number; w: number; h: number };

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function clampViewBoxX(x: number, w: number): number {
  const min = MAP_VIEWBOX.x - w * 0.15;
  const max = MAP_VIEWBOX.x + MAP_VIEWBOX.width - w * 0.85;
  return clamp(x, min, max);
}

function clampViewBoxY(y: number, h: number): number {
  const min = MAP_VIEWBOX.y - h * 0.15;
  const max = MAP_VIEWBOX.y + MAP_VIEWBOX.height - h * 0.85;
  return clamp(y, min, max);
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

/** Sized by GDP with a sizeHint floor. */
function computeNationRadius(c: Country, hint: 1 | 2 | 3 | undefined): number {
  // GDP in the scenario ranges from ~65 (Tolmek) to ~9800 (Borealis).
  // Use a log curve so the spread is comfortable visually.
  const gdp = Math.max(c.economy.gdp, 1);
  const fromGdp = 6 + Math.log10(gdp) * 4.2; // ~7..23 px
  const fromHint =
    hint === 3 ? 20 : hint === 2 ? 13 : hint === 1 ? 9 : 11;
  return Math.min(28, Math.max(fromHint, fromGdp));
}

function formatBig(n: number): string {
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function localiseName(c: Country, msgs: Record<string, string>): string {
  const v = msgs[c.nameKey];
  return v ?? c.id;
}

function localiseCapital(c: Country, msgs: Record<string, string>): string {
  const v = msgs[c.capitalKey];
  return v ?? c.capitalKey;
}

function getAttitude(
  state: GameState,
  a: CountryId,
  b: CountryId,
): number | null {
  const k = relKey(a, b);
  const r = state.relations[k];
  return r ? r.attitude : null;
}

function relKey(a: CountryId, b: CountryId) {
  return a < b ? (`${a}::${b}` as const) : (`${b}::${a}` as const);
}

// ---------------------------------------------------------------------------
// Tension overlay
// ---------------------------------------------------------------------------

/** Returns a 0..1 tension value per region. */
function computeRegionTension(state: GameState): Map<string, number> {
  const base = state.worldTension / 100;
  const out = new Map<string, number>();
  for (const id of REGION_ORDER) out.set(id, base);

  // Add a contribution from wars / sanctions touching each region.
  const relations = Object.values(state.relations);
  for (const r of relations) {
    const a = state.countries[r.countryA];
    const b = state.countries[r.countryB];
    if (!a || !b) continue;
    const contribution =
      (r.atWar ? 0.4 : 0) + (r.treaties.includes('sanctions') ? 0.15 : 0);
    if (contribution === 0) continue;
    out.set(a.regionId, Math.min(1, (out.get(a.regionId) ?? 0) + contribution));
    out.set(b.regionId, Math.min(1, (out.get(b.regionId) ?? 0) + contribution));
  }
  return out;
}

/** Map a 0..1 tension to a cool->hot fill colour. */
function tensionToColor(t: number): string {
  // 0 = cool slate-blue, 1 = hot rose. Smooth via two-stop blend.
  const cool: [number, number, number] = [37, 56, 96]; // ~ #253860
  const mid: [number, number, number] = [120, 90, 60]; // brownish
  const hot: [number, number, number] = [180, 50, 60]; // rose-700-ish
  const c = clamp(t, 0, 1);
  let r: number, g: number, b: number;
  if (c < 0.5) {
    const k = c / 0.5;
    r = cool[0] * (1 - k) + mid[0] * k;
    g = cool[1] * (1 - k) + mid[1] * k;
    b = cool[2] * (1 - k) + mid[2] * k;
  } else {
    const k = (c - 0.5) / 0.5;
    r = mid[0] * (1 - k) + hot[0] * k;
    g = mid[1] * (1 - k) + hot[1] * k;
    b = mid[2] * (1 - k) + hot[2] * k;
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// ---------------------------------------------------------------------------
// Alliance overlay (union-find)
// ---------------------------------------------------------------------------

function computeAllianceEdges(state: GameState): AllianceEdge[] {
  const ids: CountryId[] = Object.keys(state.countries);
  const parent = new Map<CountryId, CountryId>();
  for (const id of ids) parent.set(id, id);
  const find = (x: CountryId): CountryId => {
    let cur = x;
    while (parent.get(cur) !== cur) {
      const p = parent.get(cur);
      if (!p) break;
      const gp = parent.get(p) ?? p;
      parent.set(cur, gp);
      cur = gp;
    }
    return cur;
  };
  const union = (a: CountryId, b: CountryId) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  type EdgePair = { a: CountryId; b: CountryId };
  const allianceRels: Relation[] = [];
  for (const r of Object.values(state.relations)) {
    if (r.treaties.includes('alliance')) {
      allianceRels.push(r);
      union(r.countryA, r.countryB);
    }
  }

  // Assign deterministic colour per group root.
  const groupColors = new Map<CountryId, string>();
  for (const id of ids) {
    const root = find(id);
    if (!groupColors.has(root)) {
      const colorIdx = groupColors.size % ALLIANCE_GROUP_COLORS.length;
      const color =
        ALLIANCE_GROUP_COLORS[colorIdx] ?? '#cbd5e1';
      groupColors.set(root, color);
    }
  }

  const edges: AllianceEdge[] = [];
  for (const r of allianceRels) {
    const pa = NATION_POSITIONS[r.countryA];
    const pb = NATION_POSITIONS[r.countryB];
    if (!pa || !pb) continue;
    const root = find(r.countryA);
    const color = groupColors.get(root) ?? '#cbd5e1';
    edges.push({
      from: r.countryA,
      to: r.countryB,
      color,
      x1: pa.x,
      y1: pa.y,
      x2: pb.x,
      y2: pb.y,
    });
  }
  // Suppress lint warning: EdgePair is exported via JSDoc-like comment for
  // future readers; keep the type local but referenced.
  void (null as unknown as EdgePair | null);
  return edges;
}

// ---------------------------------------------------------------------------
// Intel overlay
// ---------------------------------------------------------------------------

function computeIntelMask(state: GameState): Map<CountryId, IntelLevel> {
  const out = new Map<CountryId, IntelLevel>();
  const player = state.countries[state.playerCountryId];
  if (!player) return out;
  for (const id of Object.keys(state.countries)) {
    if (id === player.id) {
      out.set(id, 'full');
      continue;
    }
    const lvl = player.intelligence.knownIntel[id] ?? 'none';
    out.set(id, lvl);
  }
  return out;
}

function intelToVisuals(level: IntelLevel): {
  opacity: number;
  greyscale: number;
} {
  switch (level) {
    case 'full':
      return { opacity: 1, greyscale: 0 };
    case 'partial':
      return { opacity: 0.85, greyscale: 0.2 };
    case 'rumors':
      return { opacity: 0.6, greyscale: 0.55 };
    case 'none':
    default:
      return { opacity: 0.35, greyscale: 0.85 };
  }
}

// ---------------------------------------------------------------------------
// Decorative pieces
// ---------------------------------------------------------------------------

function Grid() {
  return (
    <g aria-hidden pointerEvents="none" opacity={0.04}>
      <defs>
        <pattern
          id="aurion-grid"
          width={80}
          height={80}
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 80 0 L 0 0 0 80"
            fill="none"
            stroke="#94a3b8"
            strokeWidth={0.6}
          />
        </pattern>
      </defs>
      <rect
        x={MAP_VIEWBOX.x}
        y={MAP_VIEWBOX.y}
        width={MAP_VIEWBOX.width}
        height={MAP_VIEWBOX.height}
        fill="url(#aurion-grid)"
      />
    </g>
  );
}

function RegionLabel({ region, label }: { region: RegionDef; label: string }) {
  const cx = region.bounds.x + region.bounds.w / 2;
  const cy = region.bounds.y + region.bounds.h / 2;
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="middle"
      fill="#cbd5e1"
      fillOpacity={0.18}
      fontSize={64}
      fontWeight={700}
      letterSpacing={6}
      style={{
        textTransform: 'uppercase',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {label}
    </text>
  );
}

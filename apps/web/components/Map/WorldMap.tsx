'use client';

// Aurion's editorial-style ("Atlas") world map. Centrepiece of the play screen.
// It reads everything it needs from the Zustand store via selectors so the
// component only re-renders when relevant slices change (state, scenario,
// selectedCountryId).
//
// Visuals (NYT / FT / Bloomberg-style):
//   - 5 hand-authored macro regions painted as flat single-colour polygons
//     with hairline borders. No gradients, no glow.
//   - Nations rendered as small filled capital-dots with a small uppercase
//     tracked label below. The player nation marker is the brand accent.
//   - Toggleable overlays: tension (region heatmap), alliances (hairline
//     network graph), intel (opacity / greyscale mask), blocs (region tint
//     + nation ring).
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
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import { loadScenarioMessages } from '../../lib/scenarios';
import { useGameStore } from '../../lib/store';

import MapLegend from './MapLegend';
import MapNation from './MapNation';
import MapTooltip from './MapTooltip';
import {
  AllianceEdges,
  BLOC_COLOR,
  computeAllianceEdges,
  computeBlocOverlay,
  computeIntelMask,
  computeRegionTension,
  intelToVisuals,
  tensionToColor,
  type AllianceEdge,
  type BlocColorKey,
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
  // Surfaced as console.error so the bench's CI / dev console treats them
  // as loud signals (the warn channel is too noisy with autoplay rejections
  // to be useful for layout drift). Stale-entry detection is intentionally
  // not exercised here — see `validateGeometry`'s `allKnownCountryIds`
  // contract — because positions are shared across scenarios and a per-
  // scenario stale loop would flag every non-active scenario's entries.
  useEffect(() => {
    if (!scenario) return;
    if (process.env.NODE_ENV === 'production') return;
    const warnings = validateGeometry(
      scenario.countries.map((c) => ({ id: c.id, regionId: c.regionId })),
    );
    for (const w of warnings) {
      console.error(w);
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
          'flex min-h-[60vh] items-center justify-center rounded-xl border border-dashed border-border bg-surface/30 text-xs text-fg-faint',
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
    blocs: tOverlay('blocs'),
  };

  // Phase 3: scenarios that don't opt into the bloc system carry no
  // `state.blocs` record. The overlay button stays visible (so the player
  // can see the feature exists) but is disabled with an explanatory tooltip.
  const blocsAvailable = state.blocs !== undefined;
  const overlayDisabled: Partial<Record<OverlayMode, { tooltip?: string }>> =
    blocsAvailable
      ? {}
      : { blocs: { tooltip: tOverlay('blocsUnavailable') } };

  // Per-country bloc lookup + per-region dominant-bloc tint, both only
  // populated when the 'blocs' overlay is active.
  const { byCountry: blocByCountry, regionTint: regionBlocTint } =
    computeBlocOverlay(overlay === 'blocs', countryEntries);

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
      className={cn(
        'relative h-full min-h-[60vh] w-full overflow-hidden bg-bg',
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
        {/* Background — captures clicks to clear selection. Solid page bg,
            no gradient or grid; the map reads ink-on-paper. */}
        <rect
          x={MAP_VIEWBOX.x - 200}
          y={MAP_VIEWBOX.y - 200}
          width={MAP_VIEWBOX.width + 400}
          height={MAP_VIEWBOX.height + 400}
          fill="var(--color-bg)"
          onClick={handleBackgroundClick}
        />

        {/* Region silhouettes — flat single-colour fills, hairline borders.
            Overlays mutate the fill (tension heat, bloc tint); they don't
            add extra glow layers. */}
        <Regions
          overlay={overlay}
          regionTension={regionTension}
          regionBlocTint={regionBlocTint}
          translate={tRegions}
        />

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
            const intelKnown =
              isPlayer || intel === 'partial' || intel === 'full';
            return (
              <MapNation
                key={c.id}
                countryId={c.id}
                cx={pos.x}
                cy={pos.y}
                radius={radius}
                color={c.color}
                label={
                  // Intel-mask: hide labels for nations the player has no
                  // intel on, so the map reads like a redacted briefing.
                  overlay === 'intel' && !intelKnown
                    ? undefined
                    : localiseName(c, scenarioMessages)
                }
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

        {/* Bloc rings — a single hairline ring per nation, only when the
            'blocs' overlay is active and the scenario carries a bloc roster. */}
        {overlay === 'blocs' && blocsAvailable ? (
          <BlocRings countries={countryEntries} blocByCountry={blocByCountry} />
        ) : null}
      </svg>

      {/* Bottom legend rail — overlay segmented toggle plus, when the blocs
          overlay is active, the bloc colour key. */}
      <MapLegend
        mode={overlay}
        onChange={setOverlay}
        groupLabel={tOverlay('label')}
        labels={overlayLabels}
        disabled={overlayDisabled}
        blocLabels={blocLegendLabels}
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
// Region pass — flat polygons with hairline borders. The fill is overridden
// by the active overlay (tension heat or bloc tint); otherwise the biome
// fill flows through.
// ---------------------------------------------------------------------------

type RegionsProps = {
  overlay: OverlayMode;
  regionTension: Map<string, number>;
  regionBlocTint: Map<string, BlocColorKey>;
  translate: (key: string) => string;
};

function Regions({
  overlay,
  regionTension,
  regionBlocTint,
  translate,
}: RegionsProps) {
  return (
    <g aria-hidden>
      {REGION_ORDER.map((id) => {
        const r = REGIONS[id];
        if (!r) return null;
        const tension = overlay === 'tension' ? regionTension.get(id) ?? 0 : 0;
        const blocTintKey = overlay === 'blocs' ? regionBlocTint.get(id) : undefined;
        const fill =
          overlay === 'tension'
            ? tensionToColor(tension)
            : blocTintKey
              ? BLOC_COLOR[blocTintKey]
              : r.fill;
        const fillOpacity =
          overlay === 'tension'
            ? 0.55
            : overlay === 'blocs' && blocTintKey
              ? 0.4
              : 0.55;
        return (
          <g key={id}>
            <path
              d={r.pathD}
              fill={fill}
              stroke="var(--color-fg)"
              strokeOpacity={0.22}
              strokeWidth={1}
              fillOpacity={fillOpacity}
            />
            <RegionLabel region={r} label={translate(r.nameKey)} />
          </g>
        );
      })}
    </g>
  );
}

function RegionLabel({ region, label }: { region: RegionDef; label: string }) {
  return (
    <text
      x={region.bounds.x + 8}
      y={region.bounds.y + 18}
      textAnchor="start"
      dominantBaseline="hanging"
      fill="var(--color-fg-muted)"
      fontSize={11}
      fontWeight={500}
      letterSpacing={2}
      style={{
        textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {label}
    </text>
  );
}

// ---------------------------------------------------------------------------
// Bloc rings — thin coloured ring around each nation when the 'blocs' overlay
// is active. Rendered separately from the nation dot so the bloc assignment
// reads as a border, not a glow, and so the dot itself stays uniform.
// ---------------------------------------------------------------------------

function BlocRings({
  countries,
  blocByCountry,
}: {
  countries: ReadonlyArray<Country>;
  blocByCountry: Map<CountryId, BlocColorKey>;
}) {
  return (
    <g aria-hidden pointerEvents="none" data-overlay="blocs">
      {countries.map((c) => {
        const pos = NATION_POSITIONS[c.id];
        if (!pos) return null;
        const blocKey = blocByCountry.get(c.id) ?? 'unaligned';
        return (
          <circle
            key={`bloc-${c.id}`}
            cx={pos.x}
            cy={pos.y}
            r={6}
            fill="none"
            stroke={BLOC_COLOR[blocKey]}
            strokeWidth={1}
            strokeOpacity={blocKey === 'unaligned' ? 0.5 : 0.85}
          />
        );
      })}
    </g>
  );
}

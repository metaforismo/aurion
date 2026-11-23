'use client';

// The playable Earth: a satellite globe with the political layer, capitals
// and a "live map" of what is happening in the world right now. Replaces
// the old SVG atlas on the play screen.

import { geoEquirectangular, geoPath } from 'd3-geo';
import {
  AlertTriangle,
  Ban,
  Eye,
  Handshake,
  HeartHandshake,
  Landmark,
  LocateFixed,
  Minus,
  Plus,
  Rocket,
  ShoppingBag,
  ShieldAlert,
  Swords,
  Unlink,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Country, CountryId, GameState, IntelLevel } from '@aurion/engine';

import { buildGeoCountries, countryAt, greatCircle, midpoint, type GeoCountry } from '../../lib/globe/geo';
import { loadWorld, type WorldCollection } from '../../lib/geo/world';
import type { ScenarioId } from '../../lib/scenarios';
import { selectOpenEvent, useGameStore } from '../../lib/store';
import { useWorldNews, type WorldNewsKind } from '../../lib/world-news';
import { useScenarioMessages } from '../Panels/shared/useScenarioMessages';
import { IconButton } from '../ui';

import { CapitalMarker, NewsPill, type MarkerTone } from './markers';
import { BLOC_HEX, OverlaySwitch, computeIntelMask, type BlocColorKey, type OverlayMode } from './overlay';
import { useWideStage, type StageInsets } from './useStageInsets';
import PlanetView, { type PlanetMarker, type PlanetViewHandle } from './PlanetView';

const GOLD = '#E8B45A';

/** How long a diplomatic headline stays pinned to the globe, in weeks. */
const NEWS_WEEKS = 20;
/** How long the outcome of a covert operation stays pinned on the globe. */
const SPY_NEWS_WEEKS = 8;
const NEWS_STYLE: Record<WorldNewsKind, { icon: LucideIcon; tone: MarkerTone }> = {
  warStart: { icon: Swords, tone: 'danger' },
  peace: { icon: HeartHandshake, tone: 'success' },
  alliance: { icon: Handshake, tone: 'success' },
  allianceBroken: { icon: Unlink, tone: 'warning' },
  sanctions: { icon: Ban, tone: 'warning' },
  trade: { icon: ShoppingBag, tone: 'neutral' },
};

function relKey(a: CountryId, b: CountryId): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function relationOf(state: GameState, a: CountryId, b: CountryId) {
  return state.relations[relKey(a, b) as keyof typeof state.relations];
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

type CountryPaint = { fill: string | null; stroke: string; width: number; glow?: string };

/** Resolve how a featured country is painted for the active overlay. */
function paintFor(
  state: GameState,
  country: Country,
  overlay: OverlayMode,
  selectedId: CountryId | null,
  intel: Map<CountryId, string>,
): CountryPaint {
  const isPlayer = country.id === state.playerCountryId;
  const rel = isPlayer ? undefined : relationOf(state, state.playerCountryId, country.id);
  let fill: string | null = hexToRgba(country.color, 0.2);
  let stroke = 'rgba(255,255,255,0.6)';
  let width = 2.6;
  let glow: string | undefined;

  if (overlay === 'alliances' || overlay === 'none') {
    if (rel?.atWar) {
      fill = 'rgba(255,70,55,0.42)';
      stroke = 'rgba(255,110,95,0.95)';
      glow = 'rgba(255,70,55,0.9)';
      width = 3.4;
    } else if (rel?.treaties.includes('alliance')) {
      fill = overlay === 'alliances' ? 'rgba(95,224,160,0.4)' : 'rgba(95,224,160,0.24)';
      stroke = 'rgba(130,240,185,0.9)';
    } else if (rel?.treaties.includes('sanctions') && overlay === 'alliances') {
      fill = 'rgba(255,171,64,0.36)';
      stroke = 'rgba(255,190,110,0.9)';
    } else if (overlay === 'alliances') {
      fill = 'rgba(255,255,255,0.06)';
    }
  }
  if (overlay === 'tension') {
    const att = rel?.attitude ?? 0;
    // Hostile → red, friendly → teal.
    const t = Math.max(-1, Math.min(1, att / 100));
    fill = t < 0 ? `rgba(255,80,60,${0.15 + -t * 0.45})` : `rgba(90,210,190,${0.1 + t * 0.35})`;
  }
  if (overlay === 'intel') {
    const level = isPlayer ? 'full' : (intel.get(country.id) ?? 'none');
    const a = level === 'full' ? 0.46 : level === 'partial' ? 0.32 : level === 'rumors' ? 0.18 : 0.04;
    fill = `rgba(92,200,255,${a})`;
    stroke = 'rgba(140,215,255,0.8)';
  }
  if (overlay === 'blocs') {
    const key: BlocColorKey = country.blocId ?? 'unaligned';
    fill = hexToRgba(BLOC_HEX[key], 0.38);
    stroke = hexToRgba(BLOC_HEX[key], 0.95);
  }
  if (isPlayer) {
    stroke = GOLD;
    width = 5;
    glow = 'rgba(232,180,90,0.95)';
    if (overlay === 'none' || overlay === 'alliances') fill = 'rgba(232,180,90,0.26)';
  }
  if (country.id === selectedId && !isPlayer) {
    stroke = 'rgba(255,255,255,0.98)';
    width = 4.5;
    glow = 'rgba(255,255,255,0.8)';
  }
  return { fill, stroke, width, glow };
}

export default function GlobeMap({ insets }: { insets: StageInsets | undefined }) {
  const t = useTranslations('map');
  const tGlobe = useTranslations('globe');
  const tCosmos = useTranslations('cosmos');
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const speed = useGameStore((s) => s.speed);
  const selectedCountryId = useGameStore((s) => s.selectedCountryId);
  const selectCountry = useGameStore((s) => s.selectCountry);
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  const openEvent = useGameStore(selectOpenEvent);
  const panelOpen = useGameStore((s) => s.panelOpen);
  const worldNews = useWorldNews((s) => s.items);
  const { t: tScenario } = useScenarioMessages((scenario?.id as ScenarioId | undefined) ?? null);

  const viewRef = useRef<PlanetViewHandle | null>(null);
  const [world, setWorld] = useState<WorldCollection | null>(null);
  const [ready, setReady] = useState(false);
  const [overlay, setOverlay] = useState<OverlayMode>('none');
  const [hover, setHover] = useState<{ id: CountryId; x: number; y: number } | null>(null);
  const [zoomDistance, setZoomDistance] = useState(2.6);

  useEffect(() => {
    let cancelled = false;
    void loadWorld()
      .then((w) => {
        if (!cancelled) setWorld(w);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const geo = useMemo<GeoCountry[]>(
    () => (world ? buildGeoCountries(world, scenario?.id) : []),
    [world, scenario?.id],
  );

  /** In-game country id → geographic entry (largest feature wins). */
  const geoById = useMemo(() => {
    const out = new Map<CountryId, GeoCountry>();
    for (const g of geo) {
      if (!g.countryId) continue;
      const prev = out.get(g.countryId);
      if (!prev || g.area > prev.area) out.set(g.countryId, g);
    }
    return out;
  }, [geo]);

  const playerId = state?.playerCountryId ?? null;
  const intelMask = useMemo(
    () => (state ? computeIntelMask(state) : new Map<CountryId, IntelLevel>()),
    [state],
  );

  // ---- Political overlay --------------------------------------------------
  // A compact signature of everything the overlay depends on, so the 8-MP
  // canvas is only repainted when the picture actually changes.
  const paints = useMemo(() => {
    if (!state) return new Map<CountryId, CountryPaint>();
    const out = new Map<CountryId, CountryPaint>();
    for (const c of Object.values(state.countries)) {
      out.set(c.id, paintFor(state, c, overlay, selectedCountryId, intelMask));
    }
    return out;
  }, [state, overlay, selectedCountryId, intelMask]);

  const wars = useMemo(() => {
    if (!state) return [] as { a: CountryId; b: CountryId }[];
    return Object.values(state.relations)
      .filter((r) => r.atWar)
      .map((r) => ({ a: r.countryA, b: r.countryB }));
  }, [state]);

  const alliances = useMemo(() => {
    if (!state || overlay !== 'alliances') return [] as { a: CountryId; b: CountryId }[];
    return Object.values(state.relations)
      .filter((r) => r.treaties.includes('alliance'))
      .map((r) => ({ a: r.countryA, b: r.countryB }));
  }, [state, overlay]);

  // Covert traffic the player knows about: their own agents in the field,
  // and foreign ones caught on their soil in the last few weeks.
  const spyArcs = useMemo(() => {
    if (!state) return [] as { a: CountryId; b: CountryId; hostile: boolean }[];
    const me = state.playerCountryId;
    const out: { a: CountryId; b: CountryId; hostile: boolean }[] = [];
    for (const op of state.spyOperations) {
      if (op.ownerCountryId === me && op.status === 'active') {
        out.push({ a: me, b: op.targetCountryId, hostile: false });
      } else if (
        op.targetCountryId === me &&
        op.status === 'detected' &&
        state.tick - (op.startedAtTick + op.durationTicks) <= SPY_NEWS_WEEKS
      ) {
        out.push({ a: op.ownerCountryId, b: me, hostile: true });
      }
    }
    return out;
  }, [state]);

  const overlaySignature = useMemo(
    () =>
      JSON.stringify([
        Array.from(paints.entries()),
        wars,
        alliances,
        spyArcs,
        geo.length,
      ]),
    [paints, wars, alliances, spyArcs, geo.length],
  );

  useEffect(() => {
    if (!ready || geo.length === 0) return;
    viewRef.current?.drawOverlay((ctx, w, h) => {
      const projection = geoEquirectangular()
        .scale(w / (2 * Math.PI))
        .translate([w / 2, h / 2]);
      const path = geoPath(projection, ctx);
      ctx.lineJoin = 'round';

      // Every border, faintly — the satellite image stays the hero.
      ctx.beginPath();
      for (const g of geo) if (!g.countryId) path(g.feature);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Featured countries: tint + crisp border. Player last so its glow wins.
      const featured = geo
        .filter((g) => g.countryId && paints.has(g.countryId))
        .sort((a, b) => Number(a.countryId === playerId) - Number(b.countryId === playerId));
      for (const g of featured) {
        const paint = paints.get(g.countryId!)!;
        ctx.beginPath();
        path(g.feature);
        if (paint.fill) {
          ctx.fillStyle = paint.fill;
          ctx.fill();
        }
        ctx.shadowColor = paint.glow ?? 'transparent';
        ctx.shadowBlur = paint.glow ? 14 : 0;
        ctx.strokeStyle = paint.stroke;
        ctx.lineWidth = paint.width;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      const arc = (a: CountryId, b: CountryId, color: string, glow: string, dash: number[], width = 3.2) => {
        const ga = geoById.get(a);
        const gb = geoById.get(b);
        if (!ga || !gb) return;
        ctx.beginPath();
        path({ type: 'LineString', coordinates: greatCircle(ga.anchor, gb.anchor) });
        ctx.setLineDash(dash);
        ctx.shadowColor = glow;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
      };
      for (const al of alliances) arc(al.a, al.b, 'rgba(130,240,185,0.75)', 'rgba(95,224,160,0.8)', []);
      for (const sp of spyArcs) {
        if (sp.hostile) arc(sp.a, sp.b, 'rgba(255,160,130,1)', 'rgba(255,90,70,1)', [6, 9], 3);
        else arc(sp.a, sp.b, 'rgba(150,225,255,1)', 'rgba(92,200,255,1)', [6, 9], 3);
      }
      for (const war of wars) arc(war.a, war.b, 'rgba(255,110,95,0.95)', 'rgba(255,70,55,1)', [14, 10]);
    });
    // The signature captures every input of the draw closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, overlaySignature]);

  // ---- Camera -------------------------------------------------------------
  const playerAnchor = playerId ? geoById.get(playerId)?.anchor : undefined;
  const didInitialFocus = useRef(false);
  useEffect(() => {
    if (!ready || !playerAnchor || didInitialFocus.current) return;
    didInitialFocus.current = true;
    // Open in daylight over the player's country.
    viewRef.current?.setSun(playerAnchor.lon + 28, 14);
    viewRef.current?.flyTo(playerAnchor.lon, Math.max(-55, Math.min(60, playerAnchor.lat)), 2.35);
  }, [ready, playerAnchor]);

  useEffect(() => {
    // The sun only travels while the world does.
    viewRef.current?.setSunSpeed(speed === 0 ? 0 : 0.35 + speed * 0.2);
  }, [speed, ready]);

  // Screen bands taken by the dock/drawer and the briefing on wide layouts.
  const wide = useWideStage();
  useEffect(() => {
    // Keep the planet centred in the free space between drawer and briefing.
    viewRef.current?.setOffsetX(wide && panelOpen ? 0.045 : 0);
  }, [panelOpen, ready, wide]);

  const goHome = useCallback(() => {
    if (playerAnchor) {
      viewRef.current?.flyTo(playerAnchor.lon, Math.max(-55, Math.min(60, playerAnchor.lat)), 2.35);
    }
  }, [playerAnchor]);

  const prevSelected = useRef<CountryId | null>(null);
  useEffect(() => {
    if (selectedCountryId && selectedCountryId !== prevSelected.current) {
      const g = geoById.get(selectedCountryId);
      if (g) viewRef.current?.flyTo(g.anchor.lon, Math.max(-60, Math.min(65, g.anchor.lat)));
    }
    prevSelected.current = selectedCountryId;
  }, [selectedCountryId, geoById]);

  // ---- Pointer ------------------------------------------------------------
  const handlePick = useCallback(
    (lon: number, lat: number) => {
      const hit = countryAt(geo, lon, lat);
      selectCountry(hit?.countryId ?? null);
    },
    [geo, selectCountry],
  );

  const lastHoverId = useRef<CountryId | null>(null);
  const handleHover = useCallback(
    (coords: { lon: number; lat: number } | null, x: number, y: number) => {
      const id = coords ? (countryAt(geo, coords.lon, coords.lat)?.countryId ?? null) : null;
      if (!id) {
        if (lastHoverId.current !== null) {
          lastHoverId.current = null;
          setHover(null);
        }
        return;
      }
      lastHoverId.current = id;
      setHover({ id, x, y });
    },
    [geo],
  );

  // ---- Markers ------------------------------------------------------------
  const nameOf = useCallback(
    (id: CountryId): string => {
      const c = state?.countries[id];
      if (!c) return id;
      const s = tScenario(c.nameKey);
      return s === c.nameKey ? id : s;
    },
    [state, tScenario],
  );

  const tick = state?.tick ?? 0;
  const ageLabel = useCallback(
    (since: number) => {
      const weeks = Math.max(0, tick - since);
      if (weeks === 0) return tGlobe('age.now');
      if (weeks >= 52) return tGlobe('age.years', { n: Math.floor(weeks / 52) });
      return tGlobe('age.weeks', { n: weeks });
    },
    [tick, tGlobe],
  );

  const markers = useMemo<PlanetMarker[]>(() => {
    if (!state) return [];
    const out: PlanetMarker[] = [];
    const maxGdp = Math.max(...Object.values(state.countries).map((c) => c.economy.gdp), 1);

    for (const c of Object.values(state.countries)) {
      const g = geoById.get(c.id);
      if (!g) continue;
      const isPlayer = c.id === state.playerCountryId;
      const rel = isPlayer ? undefined : relationOf(state, state.playerCountryId, c.id);
      const tone: MarkerTone = isPlayer
        ? 'accent'
        : rel?.atWar
          ? 'danger'
          : rel?.treaties.includes('alliance')
            ? 'success'
            : 'neutral';
      const name = nameOf(c.id);
      out.push({
        id: `capital:${c.id}`,
        lon: g.anchor.lon,
        lat: g.anchor.lat,
        kind: 'label',
        priority: (isPlayer ? 1000 : 0) + (c.id === selectedCountryId ? 900 : 0) + (c.economy.gdp / maxGdp) * 100,
        width: name.length * 6.6 + (isPlayer ? 62 : 34),
        node: (
          <CapitalMarker
            name={name}
            tone={tone}
            badge={isPlayer ? t('nation.youMarker') : undefined}
            selected={c.id === selectedCountryId}
            testId={`map-country-${c.id}`}
            onClick={() => selectCountry(c.id === selectedCountryId ? null : c.id)}
          />
        ),
      });
    }

    const pill = (
      id: string,
      at: { lon: number; lat: number },
      priority: number,
      title: string,
      props: Omit<Parameters<typeof NewsPill>[0], 'title'>,
    ) => {
      out.push({
        id,
        lon: at.lon,
        lat: at.lat,
        kind: 'label',
        priority,
        width: title.length * 6.4 + 78,
        node: <NewsPill title={title} {...props} />,
      });
    };

    // Decision waiting on the player.
    const playerGeo = geoById.get(state.playerCountryId);
    if (openEvent && playerGeo) {
      const def = scenario?.eventPool.find((e) => e.id === openEvent.definitionId);
      const title = def ? tScenario(def.nameKey) : tGlobe('news.decision');
      pill('news:event', playerGeo.anchor, 5000, title, {
        icon: AlertTriangle,
        tone: 'warning',
        age: ageLabel(openEvent.firedAtTick),
      });
    }

    // Wars.
    for (const r of Object.values(state.relations)) {
      if (!r.atWar) continue;
      const ga = geoById.get(r.countryA);
      const gb = geoById.get(r.countryB);
      if (!ga || !gb) continue;
      const involvesPlayer = r.countryA === state.playerCountryId || r.countryB === state.playerCountryId;
      pill(
        `news:war:${r.countryA}:${r.countryB}`,
        midpoint(ga.anchor, gb.anchor),
        involvesPlayer ? 4000 : 2500,
        tGlobe('news.war', { a: nameOf(r.countryA), b: nameOf(r.countryB) }),
        {
          icon: Swords,
          tone: 'danger',
          onClick: () => {
            selectCountry(r.countryA === state.playerCountryId ? r.countryB : r.countryA);
            setSelectedPanel('military');
          },
        },
      );
    }

    // Covert operations: the player's own while they run and for a few
    // weeks after they end; foreign ones once they have hit or been caught.
    for (const op of state.spyOperations) {
      const mine = op.ownerCountryId === state.playerCountryId;
      const onMe = op.targetCountryId === state.playerCountryId;
      if (!mine && !onMe) continue;
      const openSpies = () => setSelectedPanel('spies');
      if (op.status === 'active') {
        if (!mine) continue;
        const g = geoById.get(op.targetCountryId);
        if (!g) continue;
        pill(`news:spy:${op.id}`, g.anchor, 3000, tGlobe(`news.spy.${op.type}`), {
          icon: Eye,
          tone: 'info',
          age: ageLabel(op.startedAtTick),
          onClick: openSpies,
        });
        continue;
      }
      const endedAt = op.startedAtTick + op.durationTicks;
      if (state.tick - endedAt > SPY_NEWS_WEEKS) continue;
      if (mine) {
        const g = geoById.get(op.targetCountryId);
        if (!g) continue;
        const outcome = op.status === 'completed' ? 'completed' : op.status === 'failed' ? 'failed' : 'detected';
        pill(`news:spy:${op.id}`, g.anchor, 3100, tGlobe(`news.spyDone.${outcome}`), {
          icon: outcome === 'detected' ? ShieldAlert : Eye,
          tone: outcome === 'completed' ? 'success' : outcome === 'failed' ? 'neutral' : 'danger',
          age: ageLabel(endedAt),
          onClick: openSpies,
        });
      } else if (op.status === 'detected') {
        const g = geoById.get(op.ownerCountryId);
        if (!g) continue;
        pill(`news:spy:${op.id}`, g.anchor, 3600, tGlobe('news.spyCaught', { name: nameOf(op.ownerCountryId) }), {
          icon: ShieldAlert,
          tone: 'danger',
          age: ageLabel(endedAt),
          onClick: openSpies,
        });
      } else if (op.result?.success && playerGeo) {
        // It worked and nobody was caught: the damage shows, the hand does not.
        pill(`news:spy:${op.id}`, playerGeo.anchor, 3600, tGlobe(`news.spyHit.${op.type}`), {
          icon: ShieldAlert,
          tone: 'warning',
          age: ageLabel(endedAt),
          onClick: openSpies,
        });
      }
    }

    // UN votes in progress that target a country.
    for (const res of state.unResolutions ?? []) {
      if (res.status !== 'voting' || !res.targetCountryId) continue;
      const g = geoById.get(res.targetCountryId);
      if (!g) continue;
      pill(`news:un:${res.id}`, g.anchor, 2800, tGlobe('news.unVote'), {
        icon: Landmark,
        tone: 'neutral',
        age: ageLabel(res.proposedAtTick),
        onClick: () => setSelectedPanel('un'),
      });
    }

    // Diplomatic headlines from every corner of the world. An ongoing war
    // already has its own pin, so the declaration is not repeated here.
    for (const item of worldNews) {
      if (item.kind === 'warStart' || state.tick - item.tick > NEWS_WEEKS) continue;
      const ga = geoById.get(item.a);
      const gb = geoById.get(item.b);
      if (!ga || !gb) continue;
      const mine = item.a === state.playerCountryId || item.b === state.playerCountryId;
      pill(
        `news:world:${item.id}`,
        midpoint(ga.anchor, gb.anchor),
        (mine ? 3200 : 1500) + item.tick / 1000,
        tGlobe(`news.${item.kind}`, { a: nameOf(item.a), b: nameOf(item.b) }),
        {
          ...NEWS_STYLE[item.kind],
          age: ageLabel(item.tick),
          onClick: () => {
            selectCountry(item.a === state.playerCountryId ? item.b : item.a);
            setSelectedPanel('diplomacy');
          },
        },
      );
    }

    // The space race: recent megaproject completions around the world.
    const recent = (state.cosmos?.log ?? []).filter((e) => state.tick - e.tick <= 26).slice(-6);
    for (const entry of recent) {
      const g = geoById.get(entry.countryId);
      if (!g) continue;
      pill(
        `news:cosmos:${entry.countryId}:${entry.projectId}`,
        g.anchor,
        entry.countryId === state.playerCountryId ? 3500 : 2000 + entry.tick / 1000,
        tCosmos(`projects.${entry.projectId}.name`),
        {
          icon: Rocket,
          tone: entry.countryId === state.playerCountryId ? 'accent' : 'info',
          age: ageLabel(entry.tick),
          onClick: () => setSelectedPanel('cosmos'),
        },
      );
    }
    return out;
  }, [
    state,
    scenario,
    geoById,
    selectedCountryId,
    openEvent,
    worldNews,
    nameOf,
    ageLabel,
    selectCountry,
    setSelectedPanel,
    t,
    tGlobe,
    tCosmos,
    tScenario,
  ]);

  // ---- Tooltip ------------------------------------------------------------
  const tooltipCountry = hover && state ? state.countries[hover.id] : undefined;
  const tooltipRel =
    tooltipCountry && state && tooltipCountry.id !== state.playerCountryId
      ? relationOf(state, state.playerCountryId, tooltipCountry.id)
      : undefined;

  const hasBlocs = Boolean(state?.blocs);
  const overlayLabels = useMemo(
    () => ({
      none: t('overlay.none'),
      tension: t('overlay.tension'),
      alliances: t('overlay.alliances'),
      intel: t('overlay.intel'),
      blocs: t('overlay.blocs'),
    }),
    [t],
  );

  if (!state) return null;

  return (
    <div
      className="absolute inset-0"
      role="region"
      data-testid="world-map"
      tabIndex={0}
      aria-label={t('label')}
      onKeyDown={(e) => {
        const step = 8 * Math.max(0.3, zoomDistance - 1);
        if (e.key === 'ArrowLeft') viewRef.current?.nudge(-step, 0);
        else if (e.key === 'ArrowRight') viewRef.current?.nudge(step, 0);
        else if (e.key === 'ArrowUp') viewRef.current?.nudge(0, step);
        else if (e.key === 'ArrowDown') viewRef.current?.nudge(0, -step);
        else if (e.key === '+' || e.key === '=') viewRef.current?.zoomBy(0.8);
        else if (e.key === '-') viewRef.current?.zoomBy(1.25);
        else if (e.key === 'Escape') selectCountry(null);
        else return;
        e.preventDefault();
      }}
    >
      <PlanetView
        ref={viewRef}
        body="earth"
        ariaLabel={t('label')}
        markers={markers}
        initialDistance={2.9}
        insets={insets}
        onPick={handlePick}
        onHover={handleHover}
        onZoom={setZoomDistance}
        onReady={() => setReady(true)}
      />

      <div className="pointer-events-none absolute bottom-3 z-10 -translate-x-1/2" style={{ left: 'var(--stage-center, 50%)' }}>
        <div className="pointer-events-auto">
          <OverlaySwitch
            mode={overlay}
            onChange={setOverlay}
            label={t('overlay.label')}
            labels={overlayLabels}
            blocsDisabledReason={hasBlocs ? undefined : t('overlay.blocsUnavailable')}
            blocLabels={{
              western: t('legend.bloc.western'),
              eastern: t('legend.bloc.eastern'),
              'non-aligned': t('legend.bloc.non-aligned'),
              unaligned: t('legend.bloc.unaligned'),
            }}
            blocGroupLabel={t('legend.blocGroup')}
          />
        </div>
      </div>

      <div
        className="glass-panel pointer-events-auto absolute bottom-[7.25rem] z-10 flex flex-col rounded-xl p-0.5 lg:bottom-3"
        style={{ right: wide && insets ? insets.right + 4 : 12 }}
      >
        <IconButton icon={Plus} label={tGlobe('zoomIn')} onClick={() => viewRef.current?.zoomBy(0.78)} disabled={zoomDistance <= 1.3} />
        <IconButton icon={Minus} label={tGlobe('zoomOut')} onClick={() => viewRef.current?.zoomBy(1.28)} disabled={zoomDistance >= 4.15} />
        <IconButton icon={LocateFixed} label={tGlobe('home')} onClick={goHome} />
      </div>

      {hover && tooltipCountry && tooltipCountry.id !== selectedCountryId ? (
        <div
          role="tooltip"
          className="glass-panel pointer-events-none absolute z-20 rounded-xl px-3 py-2 text-xs"
          style={{ left: Math.min(hover.x + 16, 9999), top: hover.y + 16 }}
        >
          <p className="font-semibold text-fg">{nameOf(tooltipCountry.id)}</p>
          <p className="mt-0.5 text-[11px] text-fg-faint">
            {tooltipCountry.id === state.playerCountryId
              ? t('tooltip.player')
              : tooltipRel?.atWar
                ? t('tooltip.atWar')
                : tooltipRel?.treaties.includes('alliance')
                  ? t('tooltip.alliance')
                  : `${t('tooltip.attitude')} ${tooltipRel ? Math.round(tooltipRel.attitude) : 0}`}
            {' · '}
            {t('tooltip.intel')}: {t(`intel.${tooltipCountry.id === state.playerCountryId ? 'full' : (intelMask.get(tooltipCountry.id) ?? 'none')}`)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// Geographic helpers for the satellite globe: scenario ↔ real-country
// mapping, capital anchors and point-in-country picking.

import { geoArea, geoBounds, geoCentroid, geoContains } from 'd3-geo';
import type { Feature, MultiPolygon, Polygon } from 'geojson';

import {
  ASCESA_COUNTRY_BY_ISO,
  GF_COUNTRY_BY_ISO,
  MC_COUNTRY_BY_ISO,
  QUICK_START_COUNTRY_BY_ISO,
} from '../geo/scenario-mapping';
import type { CountryFeature, WorldCollection } from '../geo/world';

/** ISO numeric → in-game country id for the given scenario. */
export function isoMapForScenario(scenarioId: string | undefined): Readonly<Record<string, string>> {
  switch (scenarioId) {
    case 'mondo-contemporaneo':
      return MC_COUNTRY_BY_ISO;
    case 'guerra-fredda':
      return GF_COUNTRY_BY_ISO;
    case 'ascesa-aurion':
      return ASCESA_COUNTRY_BY_ISO;
    case 'quick-start':
      return QUICK_START_COUNTRY_BY_ISO;
    default:
      return {};
  }
}

export function isoOf(feature: CountryFeature): string {
  const raw = feature.id;
  if (raw === undefined || raw === null) return '';
  return String(raw).padStart(3, '0');
}

export type GeoCountry = {
  iso: string;
  feature: CountryFeature;
  /** In-game country id, when the scenario features this country. */
  countryId: string | null;
  /** Label / capital anchor: centroid of the largest landmass. */
  anchor: { lon: number; lat: number };
  bounds: [[number, number], [number, number]];
  /** Angular area (steradians) — used to rank label priority. */
  area: number;
};

/** Centroid of a feature's largest polygon (ignores overseas territories). */
function mainlandCentroid(feature: CountryFeature): { lon: number; lat: number } {
  const geom = feature.geometry;
  let target: Feature<Polygon | MultiPolygon> | CountryFeature = feature;
  if (geom.type === 'MultiPolygon') {
    let best: Polygon | null = null;
    let bestArea = -1;
    for (const coords of geom.coordinates) {
      const poly: Polygon = { type: 'Polygon', coordinates: coords };
      const a = geoArea(poly);
      if (a > bestArea) {
        bestArea = a;
        best = poly;
      }
    }
    if (best) target = { type: 'Feature', properties: {}, geometry: best };
  }
  const [lon, lat] = geoCentroid(target as Feature);
  return { lon, lat };
}

export function buildGeoCountries(
  world: WorldCollection,
  scenarioId: string | undefined,
): GeoCountry[] {
  const map = isoMapForScenario(scenarioId);
  return world.features.map((feature) => {
    const iso = isoOf(feature);
    return {
      iso,
      feature,
      countryId: map[iso] ?? null,
      anchor: mainlandCentroid(feature),
      bounds: geoBounds(feature),
      area: geoArea(feature),
    };
  });
}

/** Country under a geographic point, if any. */
export function countryAt(
  countries: readonly GeoCountry[],
  lon: number,
  lat: number,
): GeoCountry | null {
  for (const c of countries) {
    const [[w, s], [e, n]] = c.bounds;
    if (lat < s || lat > n) continue;
    // Bounds that cross the antimeridian come back with west > east.
    const inLon = w <= e ? lon >= w && lon <= e : lon >= w || lon <= e;
    if (!inLon) continue;
    if (geoContains(c.feature, [lon, lat])) return c;
  }
  return null;
}

/** Great-circle midpoint, for placing a label between two capitals. */
export function midpoint(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
): { lon: number; lat: number } {
  const rad = Math.PI / 180;
  const toVec = (p: { lon: number; lat: number }) => [
    Math.cos(p.lat * rad) * Math.cos(p.lon * rad),
    Math.cos(p.lat * rad) * Math.sin(p.lon * rad),
    Math.sin(p.lat * rad),
  ];
  const va = toVec(a);
  const vb = toVec(b);
  const m = [va[0]! + vb[0]!, va[1]! + vb[1]!, va[2]! + vb[2]!];
  const len = Math.hypot(m[0]!, m[1]!, m[2]!) || 1;
  return {
    lon: Math.atan2(m[1]!, m[0]!) / rad,
    lat: Math.asin(m[2]! / len) / rad,
  };
}

/** Points along the great circle from a to b (inclusive), for arc drawing. */
export function greatCircle(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
  steps = 48,
): [number, number][] {
  const rad = Math.PI / 180;
  const v = (p: { lon: number; lat: number }): [number, number, number] => [
    Math.cos(p.lat * rad) * Math.cos(p.lon * rad),
    Math.cos(p.lat * rad) * Math.sin(p.lon * rad),
    Math.sin(p.lat * rad),
  ];
  const va = v(a);
  const vb = v(b);
  const dotp = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dotp);
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const s = Math.sin(omega) || 1;
    const k1 = omega < 1e-6 ? 1 - t : Math.sin((1 - t) * omega) / s;
    const k2 = omega < 1e-6 ? t : Math.sin(t * omega) / s;
    const x = va[0] * k1 + vb[0] * k2;
    const y = va[1] * k1 + vb[1] * k2;
    const z = va[2] * k1 + vb[2] * k2;
    out.push([Math.atan2(y, x) / rad, Math.asin(Math.max(-1, Math.min(1, z))) / rad]);
  }
  return out;
}

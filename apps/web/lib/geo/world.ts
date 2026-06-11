// Real-world geometry loader for the Atlas map. Wraps the Natural Earth
// 1:110m countries TopoJSON shipped via the `world-atlas` npm package and
// decodes it into a plain GeoJSON FeatureCollection on first use. The decoded
// payload is cached at module scope so the second call is instantaneous.
//
// The TopoJSON ships as ~108 KB and decodes to ~250 KB in memory — well
// within budget for a single-page game UI. We dynamic-import it so the
// chunk only lands in the bundle when a real-world scenario actually
// requests the data.

import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature as topoFeature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';

// Country feature properties as exposed by `world-atlas`'s
// `countries-110m.json`. The `id` field carries the ISO 3166-1 numeric code
// (e.g. "840" for the United States). The `properties.name` is the English
// short name (e.g. "United States of America").
export type CountryProperties = {
  name: string;
};

export type CountryFeature = Feature<Geometry, CountryProperties> & {
  id?: string | number;
};

export type WorldCollection = FeatureCollection<Geometry, CountryProperties> & {
  features: CountryFeature[];
};

let cached: WorldCollection | null = null;
let pending: Promise<WorldCollection> | null = null;

/**
 * Load the world country geometry. Returns the same FeatureCollection on
 * every call (cached). Safe to call from many components in parallel — the
 * first call kicks off the dynamic import; subsequent calls await the same
 * promise.
 */
export async function loadWorld(): Promise<WorldCollection> {
  if (cached) return cached;
  if (pending) return pending;
  pending = (async () => {
    // The JSON is typed by `resolveJsonModule` as the literal shape inferred
    // from the file (tuples narrowed to `number[]`), which doesn't satisfy
    // `Topology`'s tuple constraints. We deliberately funnel through
    // `unknown` — the runtime shape is a valid TopoJSON Topology.
    const mod = (await import('world-atlas/countries-110m.json')) as unknown as
      | { default: Topology }
      | Topology;
    const topology = ('default' in mod ? mod.default : mod) as Topology;
    const countriesObj = topology.objects.countries as GeometryCollection;
    const collection = topoFeature(topology, countriesObj) as unknown as WorldCollection;
    cached = collection;
    return collection;
  })();
  // If the dynamic import fails (offline, stale chunk after a deploy), drop
  // the in-flight promise so the next call can retry instead of replaying the
  // same rejection forever.
  pending.catch(() => {
    pending = null;
  });
  return pending;
}

/** Cheap synchronous lookup — returns null if `loadWorld` hasn't resolved yet. */
export function getCachedWorld(): WorldCollection | null {
  return cached;
}

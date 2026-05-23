// Projection helpers for the real-world Atlas renderer.
//
// We use `geoEqualEarth` as the default world projection — an equal-area
// pseudocylindrical projection well-suited to political world maps. It's
// less Eurocentric than Mercator and preserves area accurately so a
// "biggest country" reading is faithful to reality.
//
// For the regional Aurion crop (Mediterranean + Middle East + Sahel) we
// pick a `geoEquirectangular` rotated to centre on roughly 25°E, 25°N. The
// crop is small enough that distortion is negligible and the simpler
// projection keeps the geometry predictable when we render a tight
// extent-fit.

import {
  geoEqualEarth,
  geoEquirectangular,
  type GeoPermissibleObjects,
  type GeoProjection,
} from 'd3-geo';

export type Extent = readonly [readonly [number, number], readonly [number, number]];

/**
 * Configure an equal-earth projection that fits `fitObject` into the given
 * SVG viewBox extent (in viewBox units). Returns the configured projection
 * ready for `geoPath().projection(...)`.
 */
export function worldProjection(
  fitObject: GeoPermissibleObjects,
  extent: Extent,
): GeoProjection {
  const proj = geoEqualEarth();
  // Pull the projection slightly away from the edges so labels at the rim
  // don't get clipped by the viewBox.
  proj.fitExtent(
    [
      [extent[0][0] + 8, extent[0][1] + 8],
      [extent[1][0] - 8, extent[1][1] - 8],
    ],
    fitObject,
  );
  return proj;
}

/**
 * Regional projection for Aurion's fictional world. Centred on the
 * Mediterranean / Middle East / Sahel rectangle (`fitObject` should be the
 * filtered FeatureCollection covering the chosen sub-region) and rendered
 * with a simple equirectangular projection.
 */
export function regionProjection(
  fitObject: GeoPermissibleObjects,
  extent: Extent,
): GeoProjection {
  const proj = geoEquirectangular();
  proj.fitExtent(
    [
      [extent[0][0] + 8, extent[0][1] + 8],
      [extent[1][0] - 8, extent[1][1] - 8],
    ],
    fitObject,
  );
  return proj;
}

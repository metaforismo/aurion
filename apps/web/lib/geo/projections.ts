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
  geoOrthographic,
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

/**
 * Fit-by-size variants. Identical to the `*Projection` helpers above but
 * driven by a (width, height) pair instead of an extent rectangle. Useful for
 * renderers that drive the SVG viewBox off a ResizeObserver: the projection
 * adapts to whatever aspect ratio the container currently has, so
 * `preserveAspectRatio="xMidYMid meet"` never letterboxes the canvas.
 *
 * A small symmetric inset is applied so coastal labels at the projection rim
 * don't get clipped by the viewBox.
 */
export function worldProjectionFit(
  fitObject: GeoPermissibleObjects,
  width: number,
  height: number,
): GeoProjection {
  const proj = geoEqualEarth();
  proj.fitSize([Math.max(1, width - 16), Math.max(1, height - 16)], fitObject);
  // Re-centre the inset around the canvas — fitSize anchors at (0,0).
  proj.translate([
    proj.translate()[0] + 8,
    proj.translate()[1] + 8,
  ]);
  return proj;
}

export function regionProjectionFit(
  fitObject: GeoPermissibleObjects,
  width: number,
  height: number,
): GeoProjection {
  const proj = geoEquirectangular();
  proj.fitSize([Math.max(1, width - 16), Math.max(1, height - 16)], fitObject);
  proj.translate([
    proj.translate()[0] + 8,
    proj.translate()[1] + 8,
  ]);
  return proj;
}

/**
 * Orthographic "globe" projection for the world scenarios. The sphere is
 * centred on the canvas; `rotation` is the [lambda, phi] pair fed straight to
 * `projection.rotate` (so to look at lon/lat L,P pass [-L, -P]); `zoom`
 * scales the sphere radius around a fit-to-canvas baseline (1 = the disc
 * fits with a small margin). `clipAngle(90)` makes `geoPath` drop the far
 * hemisphere, which is what keeps the rest of the renderer agnostic — far
 * side features simply produce no path data.
 */
export function globeProjectionFit(
  width: number,
  height: number,
  rotation: readonly [number, number],
  zoom: number,
): GeoProjection {
  const radius = Math.max(1, (Math.min(width, height) / 2 - 12) * zoom);
  return geoOrthographic()
    .scale(radius)
    .translate([width / 2, height / 2])
    .rotate([rotation[0], rotation[1]])
    .clipAngle(90);
}

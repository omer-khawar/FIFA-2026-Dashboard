/**
 * projection.ts — single source of truth that maps geographic coordinates
 * (lon, lat) onto the flat scene plane shared by the country slabs and the
 * stadium beacons.
 *
 * We use d3-geo's geoMercator().fitExtent over the clipped hosts GeoJSON so the
 * three host countries fill a fixed pixel box, then linearly remap that box into
 * a centered world plane of width PLANE_WIDTH (in world units). The world plane
 * lives in XZ (the map lies flat, viewed from a raised camera), so:
 *   - d3 screen x  →  world x   (east is +x)
 *   - d3 screen y  →  world z   FLIPPED (north is -z, i.e. "up/away" from camera)
 *
 * Flipping y is essential: d3 screen-space y grows downward, but we want north
 * (Canada/Vancouver) to sit at smaller z (further from a camera looking down the
 * +z axis) and south (Mexico City) at larger z. A sanity check in the dev test
 * verifies Mexico ends up south of Canada.
 */

import { geoMercator } from 'd3-geo';
import type { GeoProjection } from 'd3-geo';
import type { FeatureCollection } from 'geojson';

/** Width of the scene plane in world units. Clean round number. */
export const PLANE_WIDTH = 10;

/** Padding (world units) kept between the country bounds and the plane edges. */
const PLANE_PADDING = 0.4;

export interface Projection {
  /** Project geographic (lon, lat) → world [x, z] on the flat map plane. */
  project(lon: number, lat: number): [number, number];
  /** Plane extents in world units (centered on origin). */
  width: number;
  height: number;
  /** half-extents, handy for camera framing. */
  halfWidth: number;
  halfHeight: number;
}

/**
 * Build the projection for a given hosts FeatureCollection. Derived once and
 * memoized by the caller — never per frame.
 */
export function buildProjection(hostGeo: FeatureCollection): Projection {
  // Fit the geography into an abstract pixel box; the box's aspect ratio is
  // determined by the geography itself via fitSize on a tall canvas, then we
  // read back the realized bounds to compute the true aspect.
  const FIT_W = 1000;
  const FIT_H = 1000;

  const proj: GeoProjection = geoMercator().fitExtent(
    [
      [0, 0],
      [FIT_W, FIT_H],
    ],
    hostGeo,
  );

  // Realized pixel bounds of the geography under this projection.
  const bounds = geoBounds(hostGeo, proj);
  const [[minX, minY], [maxX, maxY]] = bounds;
  const pxW = maxX - minX || 1;
  const pxH = maxY - minY || 1;

  // World plane: width fixed; height follows the geography's aspect ratio.
  const innerW = PLANE_WIDTH - PLANE_PADDING * 2;
  const innerH = innerW * (pxH / pxW);
  const width = PLANE_WIDTH;
  const height = innerH + PLANE_PADDING * 2;

  const scale = innerW / pxW; // world units per pixel (uniform, aspect preserved)

  function project(lon: number, lat: number): [number, number] {
    const p = proj([lon, lat]);
    if (!p) return [0, 0];
    const [px, py] = p;
    // Center the realized bounds, scale to world units.
    const x = (px - (minX + maxX) / 2) * scale;
    // Map d3 screen-y → world z. d3 north = small py (top of screen). We want
    // north FURTHER from the camera (negative z) and south NEARER (positive z),
    // so north must map to negative z: z = (py - cy). For a far-north city like
    // Vancouver, py is small ⇒ z negative; for Mexico City, py large ⇒ z positive.
    const z = (py - (minY + maxY) / 2) * scale;
    return [x, z];
  }

  return {
    project,
    width,
    height,
    halfWidth: width / 2,
    halfHeight: height / 2,
  };
}

/**
 * Compute the realized pixel bounding box of a FeatureCollection under a
 * projection by walking every coordinate (the geometries here are small).
 */
function geoBounds(
  fc: FeatureCollection,
  proj: GeoProjection,
): [[number, number], [number, number]] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const visit = (lon: number, lat: number) => {
    const p = proj([lon, lat]);
    if (!p) return;
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  };

  for (const f of fc.features) {
    const g = f.geometry;
    if (g.type === 'Polygon') {
      for (const ring of g.coordinates)
        for (const [lon, lat] of ring) visit(lon, lat);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates)
        for (const ring of poly)
          for (const [lon, lat] of ring) visit(lon, lat);
    }
  }

  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

/**
 * projection.ts — the SINGLE source of truth that maps geographic (lon, lat)
 * onto the flat scene ground plane (XZ, +Y up) shared by the country slabs and
 * the stadium beacons.
 *
 * Projection (blueprint §2.2): Lambert Conformal Conic, the cartographic
 * standard for a mid-latitude continent. Mercator was the wrong tool — it
 * stretches Canada ~60% taller per degree than Mexico, so once the camera tilts
 * the distortion reads as "wrong" rather than stylized. Between its two standard
 * parallels (17.5°N / 49.5°N — bracketing all 16 host cities) LCC distortion is
 * <≈2.5% across our extent: shapes and bearings read true and Canada's northern
 * border curves naturally.
 *
 *   geoConicConformal()
 *     .parallels([17.5, 49.5])   // bracket all 16 cities
 *     .rotate([96, 0])           // central meridian 96°W — the continent spine
 *     .fitExtent(box, stadiumExtentFeature)
 *
 * We FIT THE CITIES, not the country polygons (blueprint §2.2): the fit feature
 * is the bbox of the 16 stadium coordinates padded ~7%. Geography is the
 * backdrop and may legitimately overflow the fitted box (Canada's far north,
 * Mexico's south) — that overflow is faded out in the scene, never clipped here.
 *
 * Scene mapping (blueprint §2.3 — ONE transform chain):
 *   d3 pixel (px, py)  →  scene  x = (px − cx) · s,  z = (py − cy) · s
 * where (cx, cy) is the CENTER of the fitted stadium extent box and s scales the
 * fit-box width to SCENE_WIDTH world units. d3 screen-y grows downward (south),
 * which we keep: north → smaller z (further from a downward-looking camera),
 * south (Mexico City) → larger z. No y-flip, no second fitExtent anywhere.
 *
 * `projectToScene(lon, lat) → [x, z]` is the ONE helper used by EVERYTHING
 * (country meshes, beacons, camera). `buildProjection(hostGeo, stadiums)` returns
 * it plus the scene-space bounds of the stadium extent for the camera rig.
 */

import { geoConicConformal } from 'd3-geo';
import type { GeoProjection } from 'd3-geo';
import type { FeatureCollection, Feature, Polygon } from 'geojson';

/** Width of the fitted stadium extent in scene/world units. The cities span
 *  ~SCENE_WIDTH across the central stage; geography overflows beyond. */
export const SCENE_WIDTH = 10;

/** Fraction the stadium bbox is padded by before fitting (blueprint §2.2: 6–8%). */
const STADIUM_PAD = 0.07;

/** Abstract pixel box the stadium extent is fitted into. Square; the projection
 *  preserves aspect, so the realized box just determines pixels-per-degree. */
const FIT_PX = 1000;

export interface StadiumLike {
  lon: number;
  lat: number;
}

export interface Projection {
  /** The ONE helper: geographic (lon, lat) → scene [x, z] on the XZ plane. */
  projectToScene(lon: number, lat: number): [number, number];
  /** @deprecated alias kept for existing callers; identical to projectToScene. */
  project(lon: number, lat: number): [number, number];
  /** Scene-space half-extents of the fitted STADIUM bbox (camera framing). */
  stadiumBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    width: number;
    depth: number;
    centerX: number;
    centerZ: number;
  };
  /** Width of the stadium extent in scene units (== SCENE_WIDTH). */
  width: number;
  /** Depth (N–S) of the stadium extent in scene units. */
  height: number;
  halfWidth: number;
  halfHeight: number;
}

/** Build the padded bounding-box Feature of the 16 stadium coordinates. This —
 *  not the country polygons — is what the projection is fitted to. */
export function buildStadiumExtentFeature(stadiums: StadiumLike[]): Feature<Polygon> {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const s of stadiums) {
    if (s.lon < minLon) minLon = s.lon;
    if (s.lon > maxLon) maxLon = s.lon;
    if (s.lat < minLat) minLat = s.lat;
    if (s.lat > maxLat) maxLat = s.lat;
  }
  const padLon = (maxLon - minLon) * STADIUM_PAD;
  const padLat = (maxLat - minLat) * STADIUM_PAD;
  minLon -= padLon;
  maxLon += padLon;
  minLat -= padLat;
  maxLat += padLat;
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [minLon, minLat],
          [maxLon, minLat],
          [maxLon, maxLat],
          [minLon, maxLat],
          [minLon, minLat],
        ],
      ],
    },
  };
}

/**
 * Build the projection. `hostGeo` is accepted for signature stability (the fit
 * is driven entirely by the stadiums), so callers can keep passing it.
 */
export function buildProjection(
  _hostGeo: FeatureCollection | null,
  stadiums: StadiumLike[],
): Projection {
  const extentFeature = buildStadiumExtentFeature(stadiums);

  const proj: GeoProjection = geoConicConformal()
    .parallels([17.5, 49.5])
    .rotate([96, 0])
    .fitExtent(
      [
        [0, 0],
        [FIT_PX, FIT_PX],
      ],
      extentFeature,
    );

  // Realized pixel bbox of the (padded) stadium extent under this projection.
  // fitExtent guarantees the extent touches the box; we read the true corners so
  // the scene center is the extent center and the scale maps its width to SCENE_WIDTH.
  const ring = extentFeature.geometry.coordinates[0];
  let pMinX = Infinity;
  let pMaxX = -Infinity;
  let pMinY = Infinity;
  let pMaxY = -Infinity;
  for (const [lon, lat] of ring) {
    const p = proj([lon, lat]);
    if (!p) continue;
    if (p[0] < pMinX) pMinX = p[0];
    if (p[0] > pMaxX) pMaxX = p[0];
    if (p[1] < pMinY) pMinY = p[1];
    if (p[1] > pMaxY) pMaxY = p[1];
  }
  const pxW = pMaxX - pMinX || 1;
  const pxH = pMaxY - pMinY || 1;
  const cx = (pMinX + pMaxX) / 2;
  const cy = (pMinY + pMaxY) / 2;

  // Uniform scale: stadium-extent width → SCENE_WIDTH world units.
  const scale = SCENE_WIDTH / pxW;
  const sceneDepth = pxH * scale;

  function projectToScene(lon: number, lat: number): [number, number] {
    const p = proj([lon, lat]);
    if (!p) return [0, 0];
    const x = (p[0] - cx) * scale;
    const z = (p[1] - cy) * scale; // d3 south = larger y → larger z. No flip.
    return [x, z];
  }

  const halfW = SCENE_WIDTH / 2;
  const halfD = sceneDepth / 2;

  return {
    projectToScene,
    project: projectToScene,
    stadiumBounds: {
      minX: -halfW,
      maxX: halfW,
      minZ: -halfD,
      maxZ: halfD,
      width: SCENE_WIDTH,
      depth: sceneDepth,
      centerX: 0,
      centerZ: 0,
    },
    width: SCENE_WIDTH,
    height: sceneDepth,
    halfWidth: halfW,
    halfHeight: halfD,
  };
}

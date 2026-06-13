/**
 * framing.ts — PURE camera-framing math for the host-map overview (blueprint §2.4),
 * factored out of CameraRig so it can be unit-tested headlessly. framing.test.ts
 * projects every beacon through this framing + a THREE camera and asserts each one
 * clears the floating rails — the camera-side analogue of the projection anchor
 * test (offshore-beacon discipline applied to on-screen occlusion, not just
 * geography). No THREE / React imports here: numbers only.
 */
import type { Projection } from './projection';

export const DEG = Math.PI / 180;

/** Horizontal over-fit: the stadium extent is fit into 1/RAIL_MARGIN of the stage
 *  width so the coastal beacons (Vancouver NW / Boston NE) clear the slim idle
 *  rails (336px left + 308px right ≈ 48% clear band at the 1280px floor). Tuned
 *  against framing.test.ts; a rail's hover-expansion is an overlay and does NOT
 *  reframe the camera, so only the IDLE rail widths matter here. */
export const RAIL_MARGIN = 2.0;
/** Polar angle from vertical for the overview (≤ 40° — never lie about geography). */
export const OVERVIEW_POLAR = 38 * DEG;
/** Viewing azimuth. 0 ⇒ the camera sits SOUTH of the target (world +z) looking
 *  north (−z) with +Y up, which renders north-up / east-right — matching a real
 *  map. (π put the camera on the north side looking south, which mirrored east↔west.)
 *  Overview and city-focus share it so focusing eases a straight dolly-in. */
export const VIEW_AZIMUTH = 0;
/** Target nudged north by this fraction of extent depth (visual mass balance). */
export const NORTH_NUDGE = 0.04;
/** The left rail is wider than the right, so the clear-band centre sits slightly
 *  RIGHT of the stage centre. Shift the look-point west by this fraction of extent
 *  width so the cluster centres in the band (world −x renders LEFT, so a negative
 *  target.x moves the continent RIGHT). */
export const CONTENT_SHIFT_X = -0.07;
/** Fallback vertical FOV (deg) before the live camera reports one. */
export const DEFAULT_FOV = 24;

export type Vec3 = [number, number, number];

/** Camera position on the polar/azimuth shell at `dist` around target `t`.
 *  Camera sits SOUTH of and above the target, looking north, so smaller z (north —
 *  Canada/Vancouver) renders toward the TOP of the frame. */
export function camPosFor(dist: number, polar: number, azimuth: number, t: Vec3): Vec3 {
  const sinP = Math.sin(polar);
  return [
    t[0] + dist * sinP * Math.sin(azimuth),
    t[1] + dist * Math.cos(polar),
    t[2] + dist * sinP * Math.cos(azimuth),
  ];
}

export interface Overview {
  position: Vec3;
  target: Vec3;
  overviewDist: number;
}

/**
 * Overview camera placement that frames the stadium extent between the rails.
 * Vertical fit uses the extent DEPTH (foreshortened by the polar tilt); the
 * horizontal fit uses WIDTH·RAIL_MARGIN against the horizontal FOV. The larger
 * required distance wins so neither axis overflows the central clear band.
 */
export function overviewFraming(
  bounds: Projection['stadiumBounds'],
  aspect: number,
  fovDeg: number = DEFAULT_FOV,
): Overview {
  const vFov = fovDeg * DEG;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

  const fitDepth = bounds.depth * Math.cos(OVERVIEW_POLAR) * 1.08;
  const distForDepth = fitDepth / 2 / Math.tan(vFov / 2);
  const distForWidth = (bounds.width * RAIL_MARGIN) / 2 / Math.tan(hFov / 2);
  const overviewDist = Math.max(distForDepth, distForWidth);

  const target: Vec3 = [
    bounds.centerX + bounds.width * CONTENT_SHIFT_X,
    0,
    bounds.centerZ - bounds.depth * NORTH_NUDGE,
  ];
  const position = camPosFor(overviewDist, OVERVIEW_POLAR, VIEW_AZIMUTH, target);
  return { position, target, overviewDist };
}

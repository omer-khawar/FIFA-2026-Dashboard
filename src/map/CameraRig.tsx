/**
 * CameraRig.tsx — drei CameraControls driving the cinematic framing (§2.4).
 *
 *   - Long lens (FOV 22–26, set on the Canvas camera), polar angle ≤ 40° from
 *     vertical → N–S compression cos38° ≈ 0.79: a cinematic tilt that no longer
 *     lies about geography.
 *   - Default target: the stadium-extent centroid nudged ~4% north (visual mass
 *     balance), framed so the full extent fits BETWEEN the floating rails — i.e.
 *     in the stage's central ~55% width. We over-fit horizontally (extra margin)
 *     so no beacon hides under the 416px / 360px rails.
 *   - Idle drift: ±4° azimuth sine, 30s period (skipped under reduced motion).
 *   - Focus (focusVenueId set by a beacon click OR another panel): setLookAt ease
 *     ~1.2s dolly to ~12% extent width centered on the stadium; clear → ease back.
 *   - User zoom/rotate clamped to [city, overview].
 */

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Projection } from './projection';

const DEG = Math.PI / 180;

/** Horizontal over-fit so the stadium extent lands in the central clear band
 *  between the 416px + 360px floating rails (~44% of a 1440px stage). We fit the
 *  extent into ~1/0.44 ≈ 2.3 of the width so no beacon hides under a rail. */
const RAIL_MARGIN = 2.3;
/** Polar angle from vertical for the overview (≤ 40°). */
const OVERVIEW_POLAR = 38 * DEG;
/** Viewing azimuth. With this orientation the scene renders north-up / east-right
 *  ("the map in your head"); verified empirically against the Baja peninsula and
 *  the curved Canadian north. Overview and city-focus share it so focusing eases
 *  a straight dolly-in (no 180° swing). */
const VIEW_AZIMUTH = Math.PI;
/** Target nudged north by this fraction of extent depth (visual mass balance). */
const NORTH_NUDGE = 0.04;
/** The left rail (416px) is wider than the right (360px), so the clear-band
 *  centre sits slightly RIGHT of the stage centre. Shift the look-point west by
 *  this fraction of extent width so the city cluster centres in the clear band
 *  (world −x renders LEFT, so a negative target.x moves the continent RIGHT). */
const CONTENT_SHIFT_X = -0.07;

export default function CameraRig({
  projection,
  focusTarget,
  reducedMotion,
}: {
  projection: Projection;
  focusTarget: [number, number] | null;
  reducedMotion: boolean;
}) {
  const controlsRef = useRef<CameraControls>(null);
  const { camera, size } = useThree();

  const b = projection.stadiumBounds;
  const aspect = size.width / Math.max(1, size.height);

  // Camera distance to fit the extent. Vertical fit uses the extent DEPTH; the
  // horizontal fit uses WIDTH·RAIL_MARGIN against the horizontal FOV. Take the
  // larger required distance so neither axis overflows the central band.
  const persp = camera as THREE.PerspectiveCamera;
  const vFov = (persp.fov ?? 24) * DEG;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

  // The plane is tilted away from the camera; depth projects to roughly
  // depth·cos(polar) on screen. Use a small inflation for safety.
  const fitDepth = b.depth * Math.cos(OVERVIEW_POLAR) * 1.08;
  const distForDepth = fitDepth / 2 / Math.tan(vFov / 2);
  const distForWidth = (b.width * RAIL_MARGIN) / 2 / Math.tan(hFov / 2);
  const overviewDist = Math.max(distForDepth, distForWidth);

  // Target: extent centroid, nudged north (mass balance) and panned so the city
  // cluster centres in the clear band between the asymmetric rails.
  const tgt: [number, number, number] = [
    b.centerX + b.width * CONTENT_SHIFT_X,
    0,
    b.centerZ - b.depth * NORTH_NUDGE,
  ];

  // Camera placed along the polar/azimuth direction at overviewDist. Azimuth 0
  // (straight south of the target) keeps the continent square to the viewer.
  // Camera sits SOUTH of the target (larger z) and above it, looking north so
  // that smaller z (north — Canada/Vancouver) renders toward the TOP of the
  // frame: "the map in your head". The z-offset is +sinP·cos(azimuth).
  function camPosFor(
    dist: number,
    polar: number,
    azimuth: number,
    t: readonly [number, number, number],
  ): [number, number, number] {
    const sinP = Math.sin(polar);
    return [
      t[0] + dist * sinP * Math.sin(azimuth),
      t[1] + dist * Math.cos(polar),
      t[2] + dist * sinP * Math.cos(azimuth),
    ];
  }

  const overviewPos = camPosFor(overviewDist, OVERVIEW_POLAR, VIEW_AZIMUTH, tgt);

  // One-time setup: clamps + initial framing.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.minDistance = overviewDist * 0.32; // city close-up
    c.maxDistance = overviewDist * 1.25; // overview ceiling
    c.minPolarAngle = 0.0001; // allow near top-down
    c.maxPolarAngle = OVERVIEW_POLAR + 4 * DEG; // never lie about geography
    c.dollySpeed = 0.5;
    c.truckSpeed = 0.8;
    c.azimuthRotateSpeed = 0.45;
    c.polarRotateSpeed = 0.4;
    c.smoothTime = 0.45;
    c.draggingSmoothTime = 0.12;
    void c.setLookAt(...overviewPos, ...tgt, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewDist]);

  // Focus changes (beacon click or external panel).
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    if (focusTarget) {
      const [fx, fz] = focusTarget;
      const ftgt: [number, number, number] = [fx, 0, fz];
      // Dolly to ~12% extent width across the frame.
      const cityDist = ((b.width * 0.12) / 2 / Math.tan(vFov / 2)) * 2.2;
      const pos = camPosFor(cityDist, OVERVIEW_POLAR - 6 * DEG, VIEW_AZIMUTH, ftgt);
      void c.setLookAt(...pos, ...ftgt, true); // eased ~1.2s via smoothTime
    } else {
      void c.setLookAt(...overviewPos, ...tgt, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget?.[0], focusTarget?.[1], focusTarget == null]);

  // Idle azimuth drift: ±4°, 30s period. Skipped under reduced motion / focus.
  const elapsed = useRef(0);
  const lastDrift = useRef(0);
  useFrame((_, delta) => {
    const c = controlsRef.current;
    if (!c) return;
    c.update(delta);
    if (focusTarget || reducedMotion) return;
    if (c.active) {
      elapsed.current += delta; // advance phase but don't fight the user
      return;
    }
    elapsed.current += delta;
    // azimuth(t) = 4° · sin(2π t / 30); rotate by the per-frame delta of that.
    const amp = 4 * DEG;
    const w = (2 * Math.PI) / 30;
    const target = amp * Math.sin(w * elapsed.current);
    const d = target - lastDrift.current;
    lastDrift.current = target;
    c.rotate(d, 0, false);
  });

  return (
    <CameraControls
      ref={controlsRef}
      camera={camera as THREE.PerspectiveCamera}
      makeDefault
    />
  );
}

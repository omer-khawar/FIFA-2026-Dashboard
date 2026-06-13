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
import {
  DEG,
  OVERVIEW_POLAR,
  VIEW_AZIMUTH,
  DEFAULT_FOV,
  camPosFor,
  overviewFraming,
} from './framing';

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
  const persp = camera as THREE.PerspectiveCamera;
  const vFov = (persp.fov ?? DEFAULT_FOV) * DEG; // still used by the city-focus dolly

  // Overview placement comes from the pure helper in framing.ts, which is unit-
  // tested by framing.test.ts (projects every beacon and asserts rail clearance).
  const { position: overviewPos, target: tgt, overviewDist } = overviewFraming(
    b,
    aspect,
    persp.fov ?? DEFAULT_FOV,
  );

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

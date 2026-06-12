/**
 * CameraRig.tsx — drei CameraControls driving the cinematic framing.
 *
 *   - Default: an elevated overview framing the whole map at a ~40° tilt.
 *   - Idle (nothing focused): gentle azimuth oscillation (slow drift).
 *   - focusVenueId set (by this panel OR another): smooth setLookAt dolly-in to
 *     that city, eased (~1.2s via CameraControls' built-in smoothing).
 *   - Cleared: ease back to the overview.
 *
 * User zoom is clamped to a sane min/max distance; rotate/pan stay light.
 */

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import type * as THREE from 'three';
import type { Projection } from './projection';

export default function CameraRig({
  projection,
  focusTarget,
}: {
  projection: Projection;
  /** [worldX, worldZ] of the focused stadium, or null for overview. */
  focusTarget: [number, number] | null;
}) {
  const controlsRef = useRef<CameraControls>(null);
  const { camera } = useThree();

  const half = Math.max(projection.halfWidth, projection.halfHeight);
  // Overview camera placement: raised & pulled south so we look down the map
  // at a cinematic tilt (~40°). Target sits slightly north of center so the
  // visually heavier USA/CAN landmass is well composed.
  const overview = {
    pos: [0.2, half * 1.55, projection.halfHeight + half * 1.05] as const,
    tgt: [0, 0, -projection.halfHeight * 0.08] as const,
  };

  // One-time setup: distance clamps, gentle controls, initial framing.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.minDistance = half * 0.9;
    c.maxDistance = half * 3.2;
    c.minPolarAngle = 0.15;
    c.maxPolarAngle = Math.PI / 2 - 0.12; // never below the horizon
    c.dollySpeed = 0.5;
    c.truckSpeed = 0.8;
    c.azimuthRotateSpeed = 0.5;
    c.polarRotateSpeed = 0.5;
    c.smoothTime = 0.5;
    void c.setLookAt(...overview.pos, ...overview.tgt, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [half]);

  // React to focus changes (from this panel or external panels).
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    if (focusTarget) {
      const [fx, fz] = focusTarget;
      // Dolly in: camera offset to the south-east & raised, looking at the city.
      const d = half * 0.85;
      void c.setLookAt(
        fx + d * 0.35,
        d * 0.95,
        fz + d * 0.9,
        fx,
        0,
        fz,
        true, // animate (eased)
      );
    } else {
      void c.setLookAt(...overview.pos, ...overview.tgt, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget?.[0], focusTarget?.[1], focusTarget == null]);

  // Slow idle azimuth drift when not focused & user isn't interacting.
  const drift = useRef(0);
  useFrame((_, delta) => {
    const c = controlsRef.current;
    if (!c) return;
    c.update(delta);
    if (focusTarget) return;
    // Gentle oscillation; only nudge when the user isn't actively dragging.
    drift.current += delta;
    if (!c.active) {
      const speed = 0.05;
      c.rotate(Math.sin(drift.current * 0.18) * speed * delta, 0, false);
    }
  });

  return (
    <CameraControls ref={controlsRef} camera={camera as THREE.PerspectiveCamera} makeDefault />
  );
}

/**
 * Scene.tsx — the r3f Canvas hosting the whole 3D map (blueprint §2.6 / §2.7).
 *
 *   - ACES tone mapping; dpr [1,2]; no shadows; no real point lights (beacons are
 *     emissive + bloom only; a dim ambient just lifts the matte slabs).
 *   - ONE <group name="mapRoot"> is the only spatial transform; CountryMesh ×3 and
 *     StadiumBeacon ×16 are its children, positioned purely via projectToScene.
 *   - EffectComposer: Bloom { mipmapBlur, intensity 0.7, threshold 1.0,
 *     smoothing 0.2 } + Vignette { offset 0.3, darkness 0.85 }. With threshold
 *     1.0 ONLY emissive>1 surfaces glow (tips, coastlines, live pulses).
 *
 * Beacon state derived here from store data: LIVE (venue has an 'in' match),
 * else TODAY (a venue match falls on the user's local date), else idle.
 */

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useWorldCup } from '../data/store';
import { buildProjection } from './projection';
import CountryMesh from './CountryMesh';
import StadiumBeacon, { type BeaconState } from './StadiumBeacon';
import CameraRig from './CameraRig';

/** Top face of the slabs (matches SLAB_DEPTH in CountryMesh). Beacons sit here. */
const SLAB_TOP = 0.05;

/** Local-date key (YYYY-MM-DD) for "today" comparison in the user's tz. */
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function usePrefersReducedMotion(): boolean {
  return useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
}

export default function Scene() {
  const hostGeo = useWorldCup((s) => s.hostGeo);
  const stadiums = useWorldCup((s) => s.stadiums);
  const matches = useWorldCup((s) => s.matches);
  const focusVenueId = useWorldCup((s) => s.focusVenueId);
  const setFocusVenue = useWorldCup((s) => s.setFocusVenue);
  const reducedMotion = usePrefersReducedMotion();

  const projection = useMemo(
    () => (stadiums.length ? buildProjection(hostGeo, stadiums) : null),
    [hostGeo, stadiums],
  );

  // Projected beacon positions, memoized off stadiums + projection.
  const beacons = useMemo(() => {
    if (!projection) return [];
    return stadiums.map((s) => ({
      stadium: s,
      pos: projection.projectToScene(s.lon, s.lat) as [number, number],
    }));
  }, [stadiums, projection]);

  // Venue → state. Live from matches (state==='in'); today via local date.
  const venueState = useMemo(() => {
    const liveVenues = new Set(
      matches.filter((m) => m.state === 'in').map((m) => m.venueId),
    );
    const todayKey = localDateKey(new Date());
    const todayVenues = new Set(
      matches
        .filter((m) => localDateKey(new Date(m.date)) === todayKey)
        .map((m) => m.venueId),
    );
    const map: Record<string, BeaconState> = {};
    for (const s of stadiums) {
      map[s.venueId] = liveVenues.has(s.venueId)
        ? 'live'
        : todayVenues.has(s.venueId)
          ? 'today'
          : 'idle';
    }
    return map;
  }, [matches, stadiums]);

  const focusTarget = useMemo<[number, number] | null>(() => {
    if (!focusVenueId || !projection) return null;
    const st = stadiums.find((s) => s.venueId === focusVenueId);
    if (!st) return null;
    return projection.projectToScene(st.lon, st.lat) as [number, number];
  }, [focusVenueId, stadiums, projection]);

  return (
    <Canvas
      dpr={[1, 2]}
      shadows={false}
      gl={{
        antialias: true,
        alpha: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
      camera={{ fov: 24, near: 0.1, far: 400, position: [0, 12, 12] }}
      style={{ position: 'absolute', inset: 0, background: 'transparent' }}
    >
      {/* Dim, even fill for the matte slabs — NO real point lights. */}
      <ambientLight intensity={0.55} color="#8fa6cc" />
      <hemisphereLight args={['#3a567f', '#05060a', 0.4]} />

      {projection && hostGeo && (
        <group name="mapRoot">
          {hostGeo.features.map((f, i) => (
            <CountryMesh
              key={(f.properties?.iso as string) ?? i}
              feature={f}
              projection={projection}
            />
          ))}

          {beacons.map(({ stadium, pos }) => (
            <StadiumBeacon
              key={stadium.venueId}
              stadium={stadium}
              position={pos}
              baseY={SLAB_TOP}
              state={venueState[stadium.venueId] ?? 'idle'}
              focused={focusVenueId === stadium.venueId}
              reducedMotion={reducedMotion}
              onFocus={setFocusVenue}
            />
          ))}
        </group>
      )}

      {projection && (
        <CameraRig
          projection={projection}
          focusTarget={focusTarget}
          reducedMotion={reducedMotion}
        />
      )}

      <EffectComposer>
        <Bloom
          mipmapBlur
          intensity={0.7}
          luminanceThreshold={1.0}
          luminanceSmoothing={0.2}
        />
        <Vignette eskil={false} offset={0.3} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}

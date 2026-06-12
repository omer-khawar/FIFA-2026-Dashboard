/**
 * Scene.tsx — the r3f Canvas hosting the whole 3D map.
 *
 *   - dpr [1,2], no shadows, transparent background (CSS radial gradient behind).
 *   - faint drei <Stars> backdrop.
 *   - ambient + one directional light for the slabs (beacons use emissive+bloom,
 *     no real per-beacon lights).
 *   - EffectComposer: Bloom (luminanceThreshold tuned so only beacons/edges
 *     bloom) + subtle Vignette.
 *
 * Beacon state is derived here from store data: LIVE (venue in selectLive),
 * else TODAY (a venue match falls on the user's local date), else idle.
 */

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useWorldCup } from '../data/store';
import { buildProjection } from './projection';
import CountryMesh from './CountryMesh';
import StadiumBeacon, { type BeaconState } from './StadiumBeacon';
import CameraRig from './CameraRig';

/** Local-date key (YYYY-MM-DD) for "today" comparison in the user's tz. */
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Scene() {
  const hostGeo = useWorldCup((s) => s.hostGeo);
  const stadiums = useWorldCup((s) => s.stadiums);
  const matches = useWorldCup((s) => s.matches);
  const focusVenueId = useWorldCup((s) => s.focusVenueId);
  const setFocusVenue = useWorldCup((s) => s.setFocusVenue);

  const projection = useMemo(
    () => (hostGeo ? buildProjection(hostGeo) : null),
    [hostGeo],
  );

  // Projected beacon positions, memoized off stadiums + projection.
  const beacons = useMemo(() => {
    if (!projection) return [];
    return stadiums.map((s) => ({
      stadium: s,
      pos: projection.project(s.lon, s.lat) as [number, number],
    }));
  }, [stadiums, projection]);

  // Venue → state. Live venues from matches (state==='in'); today via local date.
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
    return projection.project(st.lon, st.lat) as [number, number];
  }, [focusVenueId, stadiums, projection]);

  return (
    <Canvas
      dpr={[1, 2]}
      shadows={false}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      camera={{ fov: 38, near: 0.1, far: 200, position: [0, 12, 12] }}
      style={{ position: 'absolute', inset: 0, background: 'transparent' }}
    >
      <color attach="background" args={['#060a12']} />
      <fog attach="fog" args={['#060a12', 16, 42]} />

      {/* Lights for the slabs only (beacons are emissive). */}
      <ambientLight intensity={0.35} color="#7fa8d8" />
      <directionalLight position={[6, 14, 8]} intensity={0.85} color="#bcd2ff" />
      <directionalLight position={[-8, 6, -6]} intensity={0.25} color="#3b6fd4" />

      {/* faint starfield */}
      <Stars radius={80} depth={40} count={900} factor={3} saturation={0} fade speed={0.4} />

      {projection && hostGeo && (
        <group>
          {hostGeo.features.map((f, i) => (
            <CountryMesh key={(f.properties?.iso as string) ?? i} feature={f} projection={projection} />
          ))}

          {beacons.map(({ stadium, pos }) => (
            <StadiumBeacon
              key={stadium.venueId}
              stadium={stadium}
              position={pos}
              state={venueState[stadium.venueId] ?? 'idle'}
              focused={focusVenueId === stadium.venueId}
              onFocus={setFocusVenue}
            />
          ))}
        </group>
      )}

      {projection && <CameraRig projection={projection} focusTarget={focusTarget} />}

      <EffectComposer>
        <Bloom
          intensity={1.15}
          luminanceThreshold={0.32}
          luminanceSmoothing={0.85}
          mipmapBlur
          radius={0.7}
        />
        <Vignette eskil={false} offset={0.25} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}

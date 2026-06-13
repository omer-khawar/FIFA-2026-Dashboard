/**
 * StadiumBeacon.tsx — one beacon "instrument" per host stadium (blueprint §2.6).
 *
 * From blobs to instruments. The stack, all children of mapRoot (no billboarding,
 * no real lights — emissive + bloom only), sizes relative to map width M=SCENE_WIDTH:
 *   (a) anchor ring   — flat annulus on the slab top, outer r ≈ 0.008·M, radar
 *                       ripple shader (period 2.4s).
 *   (b) needle pillar — thin vertical cylinder, height ≈ 0.05·M, additive, alpha
 *                       = pow(1−uv.y, 2.2). Y-up in mapRoot local space, NEVER
 *                       billboarded (this is what killed the diagonal streak).
 *   (c) tip core      — icosahedron, the ONLY high-emissive element (2–6 HDR) —
 *                       the only thing the threshold-1.0 bloom should bite.
 *   (d) hover         — drei Html micro-label (STADIUM · CITY), ring brightens,
 *                       cursor pointer. Click → setFocusVenue(venueId).
 *
 * State machine (blueprint §2.6 table):
 *   idle  #00E5FF e1.6  ripple ×1
 *   today #FF7A1A e2.4  ripple ×1.5
 *   LIVE  #FF4655 e=3+2·sin(4t)  ripple ×2  + pillar height pulse ±15%
 *
 * Beacon base y = slabDepth (sits ON the slab top face), passed in as `baseY`.
 */

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Stadium } from '../lib/types';
import { SCENE_WIDTH } from './projection';
import { createRingMaterial, createPillarMaterial } from './beaconMaterials';

export type BeaconState = 'idle' | 'today' | 'live';

const M = SCENE_WIDTH;
const RING_OUTER = 0.008 * M; // ≈0.08
const RING_INNER = RING_OUTER * 0.35;
const PILLAR_H = 0.05 * M; // ≈0.5
const PILLAR_R = 0.0016 * M; // thin needle
const TIP_R = 0.011 * M;

interface StateCfg {
  color: string;
  emissive: number; // base (live adds sine)
  ripple: number; // ripple speed multiplier
}
const STATES: Record<BeaconState, StateCfg> = {
  idle: { color: '#00E5FF', emissive: 1.6, ripple: 1 },
  today: { color: '#FF7A1A', emissive: 2.4, ripple: 1.5 },
  live: { color: '#FF4655', emissive: 3, ripple: 2 },
};

export default function StadiumBeacon({
  stadium,
  position,
  baseY,
  state,
  focused,
  reducedMotion,
  onFocus,
}: {
  stadium: Stadium;
  position: [number, number]; // [sceneX, sceneZ]
  baseY: number; // slab top face (extrude depth)
  state: BeaconState;
  focused: boolean;
  reducedMotion: boolean;
  onFocus: (venueId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [x, z] = position;
  const cfg = STATES[state];

  // Own ShaderMaterial instances (shared program; per-instance uniforms).
  const ringMat = useMemo(createRingMaterial, []);
  const pillarMat = useMemo(createPillarMaterial, []);
  const color = useMemo(() => new THREE.Color(cfg.color), [cfg.color]);

  const tipMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const pillarRef = useRef<THREE.Mesh>(null);

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const active = hovered || focused;

    // Ring uniforms
    ringMat.uniforms.uTime.value = reducedMotion ? 0 : t;
    ringMat.uniforms.uSpeed.value = cfg.ripple;
    ringMat.uniforms.uBright.value = active ? 1.6 : 1.0;
    (ringMat.uniforms.uColor.value as THREE.Color).copy(color);

    // Pillar uniforms + live height pulse (±15%)
    (pillarMat.uniforms.uColor.value as THREE.Color).copy(color);
    pillarMat.uniforms.uBright.value = active ? 1.15 : 0.9;
    if (pillarRef.current) {
      let sy = 1;
      if (state === 'live' && !reducedMotion) {
        sy = 1 + 0.15 * Math.sin(t * 4);
      }
      pillarRef.current.scale.y = sy;
    }

    // Tip emissive — the only HDR element
    if (tipMatRef.current) {
      let e = cfg.emissive;
      if (state === 'live' && !reducedMotion) e = 3 + 2 * Math.sin(t * 4);
      if (active) e *= 1.25;
      tipMatRef.current.emissiveIntensity = e;
    }
  });

  return (
    <group
      position={[x, baseY, z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        onFocus(stadium.venueId);
      }}
    >
      {/* (a) anchor ring — flat annulus on the slab top */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} material={ringMat}>
        <ringGeometry args={[RING_INNER, RING_OUTER, 48]} />
      </mesh>

      {/* invisible larger hit target so the tiny beacon is easy to click/hover */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} visible={false}>
        <circleGeometry args={[RING_OUTER * 2.2, 16]} />
      </mesh>

      {/* (b) needle pillar — Y-up in local space, never billboarded */}
      <mesh ref={pillarRef} position={[0, PILLAR_H / 2, 0]} material={pillarMat}>
        <cylinderGeometry args={[PILLAR_R, PILLAR_R * 1.4, PILLAR_H, 8, 1, true]} />
      </mesh>

      {/* (c) tip core — the only high-emissive element */}
      <mesh position={[0, PILLAR_H, 0]}>
        <icosahedronGeometry args={[TIP_R, 0]} />
        <meshStandardMaterial
          ref={tipMatRef}
          color={cfg.color}
          emissive={cfg.color}
          emissiveIntensity={cfg.emissive}
          roughness={0.3}
          metalness={0}
          toneMapped={false}
        />
      </mesh>

      {/* (d) hover label */}
      {(hovered || focused) && (
        <Html
          position={[0, PILLAR_H + TIP_R * 2.2, 0]}
          center
          distanceFactor={6}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          zIndexRange={[40, 0]}
        >
          <div
            className="font-display"
            style={{
              whiteSpace: 'nowrap',
              transform: 'translateY(-50%)',
              padding: '5px 10px',
              borderRadius: 6,
              background: 'rgb(13 16 24 / 0.78)',
              border: '1px solid rgb(255 255 255 / 0.08)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow: '0 6px 24px rgb(0 0 0 / 0.5)',
              textAlign: 'center',
              lineHeight: 1.25,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: '#EAF2FF',
              }}
            >
              {stadium.name}
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color:
                  state === 'live'
                    ? '#FF4655'
                    : state === 'today'
                      ? '#FF7A1A'
                      : '#7E8AA3',
              }}
            >
              {stadium.city}
              {state === 'live' && ' · LIVE'}
              {state === 'today' && ' · TODAY'}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

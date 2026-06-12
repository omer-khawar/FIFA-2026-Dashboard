/**
 * StadiumBeacon.tsx — emissive marker at a projected stadium position.
 *
 * Visual parts (no real lights — emissive + bloom only):
 *   - a small emissive base disc on the slab top
 *   - a thin vertical light pillar (cylinder, additive, transparent)
 *   - a billboarded radial-gradient glow sprite
 *
 * States (driven by store data, passed in as props):
 *   - idle        cool cyan, subtle
 *   - today       warm amber, brighter (a match is played here today, local date)
 *   - live        red-hot, pulsing scale + intensity via useFrame sine
 *
 * Hover → pointer cursor + drei <Html> label (stadium + city).
 * Click → setFocusVenue(venueId).
 */

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Stadium } from '../lib/types';

export type BeaconState = 'idle' | 'today' | 'live';

const PALETTE: Record<BeaconState, { core: string; glow: string; intensity: number; pillarH: number }> = {
  idle: { core: '#38e2ff', glow: '#22d3ee', intensity: 1.4, pillarH: 0.55 },
  today: { core: '#ffce5c', glow: '#fbbf24', intensity: 2.4, pillarH: 0.85 },
  live: { core: '#ff5a6e', glow: '#f43f5e', intensity: 3.6, pillarH: 1.15 },
};

/** Reusable radial-gradient sprite texture for the soft glow. */
function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function StadiumBeacon({
  stadium,
  position,
  state,
  focused,
  onFocus,
}: {
  stadium: Stadium;
  position: [number, number]; // [worldX, worldZ]
  state: BeaconState;
  focused: boolean;
  onFocus: (venueId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const pillarRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Sprite>(null);

  const glowTex = useMemo(makeGlowTexture, []);
  const cfg = PALETTE[state];
  const [x, z] = position;

  // Pulse only for live; today/idle hold steady (a subtle breathe on hover).
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    let scale = 1;
    let glowScale = 1;
    if (state === 'live') {
      const s = (Math.sin(t * 4) + 1) / 2; // 0..1
      scale = 1 + s * 0.5;
      glowScale = 1 + s * 0.6;
    } else if (hovered || focused) {
      const s = (Math.sin(t * 3) + 1) / 2;
      glowScale = 1 + s * 0.18;
    }
    if (pillarRef.current) {
      pillarRef.current.scale.y = scale;
      // keep base on the slab as it grows upward
      pillarRef.current.position.y = (cfg.pillarH * scale) / 2;
    }
    if (glowRef.current) {
      const base = (hovered || focused ? 1.5 : 1.2) * glowScale;
      glowRef.current.scale.setScalar(base);
    }
  });

  const pillarRadius = 0.012;
  const discRadius = focused || hovered ? 0.085 : 0.065;

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
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
      {/* base disc on the slab */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[discRadius, 32]} />
        <meshBasicMaterial color={cfg.core} toneMapped={false} transparent opacity={0.95} />
      </mesh>

      {/* faint outer ring on the slab */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[discRadius * 1.3, discRadius * 1.9, 40]} />
        <meshBasicMaterial color={cfg.glow} toneMapped={false} transparent opacity={0.35} />
      </mesh>

      {/* vertical light pillar */}
      <mesh ref={pillarRef} position={[0, cfg.pillarH / 2, 0]}>
        <cylinderGeometry args={[pillarRadius, pillarRadius * 1.6, cfg.pillarH, 12, 1, true]} />
        <meshBasicMaterial
          color={cfg.core}
          toneMapped={false}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* billboarded glow sprite */}
      <sprite ref={glowRef} position={[0, 0.04, 0]} scale={1.2}>
        <spriteMaterial
          map={glowTex}
          color={cfg.glow}
          transparent
          opacity={Math.min(0.9, 0.35 + cfg.intensity * 0.12)}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>

      {/* hover label */}
      {(hovered || focused) && (
        <Billboard position={[0, cfg.pillarH + 0.18, 0]}>
          <Html center distanceFactor={8} style={{ pointerEvents: 'none' }} zIndexRange={[50, 0]}>
            <div
              style={{
                whiteSpace: 'nowrap',
                transform: 'translateY(-50%)',
                padding: '4px 9px',
                borderRadius: 8,
                background: 'rgba(8, 12, 22, 0.85)',
                border: '1px solid var(--line, rgba(255,255,255,0.12))',
                color: '#e8eefc',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 11,
                fontWeight: 600,
                lineHeight: 1.25,
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <div>{stadium.name}</div>
              <div style={{ fontSize: 9.5, fontWeight: 500, color: '#8b97b0' }}>
                {stadium.city}
                {state === 'live' && <span style={{ color: '#f43f5e' }}> · LIVE</span>}
                {state === 'today' && <span style={{ color: '#fbbf24' }}> · TODAY</span>}
              </div>
            </div>
          </Html>
        </Billboard>
      )}
    </group>
  );
}

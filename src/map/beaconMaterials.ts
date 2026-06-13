/**
 * beaconMaterials.ts — shared ShaderMaterial factories for the beacon stack
 * (blueprint §2.6 / §2.7). The shader SOURCE is authored once here; each beacon
 * clones a base material so the 16 instances share the same compiled program but
 * carry their own per-instance uniforms (color, time, ripple/pulse speed). This
 * is the performance contract: one program, cheap per-instance uniform updates.
 *
 * Parts:
 *   - ring   : flat annulus, radar-ripple expanding outward (period 2.4s).
 *              alpha = smoothstep(.15,.0,|w−.5|)·(1−d), w = fract(d − t·speed·0.4).
 *   - pillar : vertical needle, additive, alpha = pow(1 − uv.y, 2.2) (dissolves up).
 *
 * Colors are passed unmanaged (toneMapped:false equivalent) so the emissive tips
 * and live pulses can exceed 1.0 and be the only things bloom bites.
 */

import * as THREE from 'three';

/* ── Ring (radar ripple) ─────────────────────────────────────────────────────── */

const RING_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uSpeed;     // ripple speed multiplier (1 idle, 1.5 today, 2 live)
  uniform float uBright;    // overall ring brightness (hover/state)
  void main() {
    // radar pulse expanding outward from the ring center (blueprint §2.6 formula)
    float d = distance(vUv, vec2(0.5)) * 2.0;       // 0 center → 1 edge
    if (d > 1.0) discard;
    float w = fract(d - uTime * uSpeed * 0.4);
    float ripple = smoothstep(0.15, 0.0, abs(w - 0.5)) * (1.0 - d);
    // faint static rim so the anchor reads even between pulses
    float rim = smoothstep(0.04, 0.0, abs(d - 0.92)) * 0.5;
    float a = (ripple + rim) * uBright;
    if (a <= 0.001) discard;
    gl_FragColor = vec4(uColor * (1.0 + ripple * 0.6), a);
  }
`;

export function createRingMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#00E5FF') },
      uTime: { value: 0 },
      uSpeed: { value: 1 },
      uBright: { value: 1 },
    },
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/* ── Pillar (needle) ─────────────────────────────────────────────────────────── */

const PILLAR_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PILLAR_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3  uColor;
  uniform float uBright;
  void main() {
    // dissolves upward; uv.y 0 at base → 1 at tip
    float a = pow(1.0 - vUv.y, 2.2) * uBright;
    if (a <= 0.001) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export function createPillarMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#00E5FF') },
      uBright: { value: 0.9 },
    },
    vertexShader: PILLAR_VERT,
    fragmentShader: PILLAR_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

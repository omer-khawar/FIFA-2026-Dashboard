/**
 * framing.test.ts — camera-side anchor gate (blueprint §2.4).
 *
 * projection.test.ts proves beacons sit on the right GEOGRAPHY. This proves they
 * sit in the right PLACE ON SCREEN: every beacon, projected through the overview
 * framing + a THREE camera at the 1280×800 floor, must land in the central clear
 * band between the floating rails — never occluded behind one. This is the gate
 * that lets RAIL_MARGIN be tuned for a bigger map without silently shoving the
 * coastal beacons (Vancouver / Boston) under the glass.
 *
 * Pure math: THREE's camera/vector projection needs no WebGL context.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as THREE from 'three';
import type { FeatureCollection } from 'geojson';
import type { Stadium } from '../../lib/types';
import { buildProjection } from '../projection';
import { overviewFraming, DEFAULT_FOV } from '../framing';

const dataDir = join(process.cwd(), 'public', 'data');
const loadJson = <T>(name: string): T =>
  JSON.parse(readFileSync(join(dataDir, name), 'utf-8')) as T;

const hostGeo = loadJson<FeatureCollection>('hosts.geo.json');
const stadiums = loadJson<{ stadiums: Stadium[] }>('stadiums.json').stadiums;

// ── The 1280×800 zero-scroll floor (the tight case) ─────────────────────────────
const VIEWPORT_W = 1280;
const VIEWPORT_H = 800;
const TOPBAR_H = 52; // App.tsx grid-rows-[52px_1fr_118px]
const TICKER_H = 118;
const STAGE_W = VIEWPORT_W; // map canvas is full-bleed (absolute inset-0)
const STAGE_H = VIEWPORT_H - TOPBAR_H - TICKER_H; // 630

// Idle rail geometry (App.tsx): left-3 + w-[336px]; right-3 + w-[308px].
const INSET = 12;
const LEFT_RAIL_W = 336;
const RIGHT_RAIL_W = 308;
const CLEAR_MIN = INSET + LEFT_RAIL_W; // 348 — left edge of the clear band
const CLEAR_MAX = VIEWPORT_W - INSET - RIGHT_RAIL_W; // 960 — right edge
const EDGE_MARGIN = 10; // a beacon must clear a rail by at least this many px

const SLAB_TOP = 0.05; // Scene.tsx — beacons anchor on the slab top face

/** Project a scene (x,z) ground point to canvas/viewport screen-x at the floor. */
function screenXOf(camera: THREE.PerspectiveCamera, x: number, z: number): number {
  const ndc = new THREE.Vector3(x, SLAB_TOP, z).project(camera);
  return (ndc.x * 0.5 + 0.5) * STAGE_W; // canvas left == viewport x == 0
}

function buildOverviewCamera(): { camera: THREE.PerspectiveCamera; proj: ReturnType<typeof buildProjection> } {
  const proj = buildProjection(hostGeo, stadiums);
  const aspect = STAGE_W / STAGE_H;
  const { position, target } = overviewFraming(proj.stadiumBounds, aspect, DEFAULT_FOV);

  const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, aspect, 0.1, 400);
  camera.position.set(...position);
  camera.updateProjectionMatrix();
  camera.lookAt(target[0], target[1], target[2]); // up defaults to +Y, as CameraControls
  camera.updateMatrixWorld(true); // THREE.Camera also refreshes matrixWorldInverse here
  return { camera, proj };
}

describe('overview framing — beacon rail clearance @ 1280×800', () => {
  const { camera, proj } = buildOverviewCamera();
  const screen = stadiums
    .map((s) => ({ name: s.name, x: screenXOf(camera, ...proj.projectToScene(s.lon, s.lat)) }))
    .sort((a, b) => a.x - b.x);

  it('keeps every beacon inside the clear band (not under a rail)', () => {
    const offenders = screen.filter(
      (s) => s.x < CLEAR_MIN + EDGE_MARGIN || s.x > CLEAR_MAX - EDGE_MARGIN,
    );
    expect(
      offenders,
      `clear band is [${CLEAR_MIN}, ${CLEAR_MAX}]px; offenders: ` +
        offenders.map((o) => `${o.name} @ ${o.x.toFixed(0)}px`).join(', '),
    ).toEqual([]);
  });

  it('keeps the whole cluster on-stage horizontally', () => {
    for (const s of screen) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(STAGE_W);
    }
  });
});

describe('country & beacon share ONE scene→world transform (anti-regression)', () => {
  // The bug this guards: CountryMesh used rotateX(-π/2) (world z = -scene z) while
  // StadiumBeacon places [x, baseY, z] (world z = +scene z), so beacons rendered
  // N–S flipped vs the landmass. Both paths must land on the same world point.
  //   CountryMesh: shape built in (x, z) → rotateX(+π/2) → translate(0, SLAB_DEPTH, 0)
  //   Beacon:      <group position={[x, baseY, z]}>, baseY === SLAB_TOP
  const SLAB_DEPTH = 0.05; // CountryMesh.tsx
  const SLAB_TOP = 0.05; // Scene.tsx (beacon baseY)
  const proj = buildProjection(hostGeo, stadiums);
  const countryXform = new THREE.Matrix4()
    .makeTranslation(0, SLAB_DEPTH, 0)
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

  it('maps every stadium to the same world point via the country and beacon paths', () => {
    for (const s of stadiums) {
      const [sx, sz] = proj.projectToScene(s.lon, s.lat);
      const viaCountry = new THREE.Vector3(sx, sz, 0).applyMatrix4(countryXform); // top-cap vertex
      const viaBeacon = new THREE.Vector3(sx, SLAB_TOP, sz);
      expect(viaCountry.x).toBeCloseTo(viaBeacon.x, 6);
      expect(viaCountry.y).toBeCloseTo(viaBeacon.y, 6);
      expect(viaCountry.z).toBeCloseTo(viaBeacon.z, 6); // the N–S axis that was flipped
    }
  });
});

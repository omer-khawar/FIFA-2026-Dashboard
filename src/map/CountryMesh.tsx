/**
 * CountryMesh.tsx — one extruded slab per host country (blueprint §2.5 / §3.2).
 *
 * GeoJSON Polygon/MultiPolygon rings → THREE.Shape → ExtrudeGeometry, built in
 * scene (x, z) via the shared projectToScene, then rotateX(-90°) to lie flat in
 * the XZ plane and lifted so the TOP face sits at y = SLAB_DEPTH (beacons sit on
 * it). NO per-component world positioning — this mesh is a child of mapRoot and
 * inherits the single transform.
 *
 * Styling:
 *   - matte near-black country tints (blueprint §3.2): USA #0E1C3A, MEX #0E2A1C,
 *     CAN #2A0F14 — hue identity kept, saturation killed so the fill stays matte
 *     and only the edge line glows.
 *   - EdgesGeometry coastline in the country accent at emissive ~1.3 (toneMapped
 *     false, >1) so threshold-1.0 bloom traces the coast as thin neon line-art.
 *   - radial ground-fade: a fragment smoothstep on world distance from the
 *     stadium-extent centroid (scene origin). Both the fill and the coastline
 *     dissolve toward the far north so Canada melts into the void — no hard
 *     geometry edge is ever visible (blueprint §2.5).
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { Projection } from './projection';
import { SCENE_WIDTH } from './projection';

const SLAB_DEPTH = 0.05; // world units; beacons sit at y = SLAB_DEPTH

/** Ground-fade radii in scene units, measured from the extent centroid (origin).
 *  Inside FADE_IN everything is solid; past FADE_OUT it's fully gone. The stadium
 *  extent half-width is SCENE_WIDTH/2 = 5, so geography stays solid across the
 *  cities and dissolves only well beyond them (the far north / far south). */
const FADE_IN = SCENE_WIDTH * 0.62; // ≈6.2
const FADE_OUT = SCENE_WIDTH * 1.15; // ≈11.5

/** Per-country: matte near-black fill (§3.2) + accent edge that catches bloom. */
const COUNTRY: Record<string, { fill: string; edge: string }> = {
  USA: { fill: '#0E1C3A', edge: '#2C6BE0' },
  MEX: { fill: '#0E2A1C', edge: '#1FB466' },
  CAN: { fill: '#2A0F14', edge: '#FF4655' },
};
const FALLBACK = { fill: '#10141f', edge: '#3a4a66' };

/** GLSL injected into both materials to fade alpha by world-XZ distance. */
const FADE_PARS = /* glsl */ `
  varying vec3 vWorldXZ;
`;
const FADE_VERT = /* glsl */ `
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vWorldXZ = wp.xyz;
`;
function fadeFrag(fadeIn: number, fadeOut: number): string {
  return /* glsl */ `
    float distXZ = length(vWorldXZ.xz);
    float fade = 1.0 - smoothstep(${fadeIn.toFixed(3)}, ${fadeOut.toFixed(3)}, distXZ);
    if (fade <= 0.001) discard;
  `;
}

function ringsToShape(
  rings: number[][][],
  project: (lon: number, lat: number) => [number, number],
): THREE.Shape | null {
  if (!rings.length) return null;
  const shape = new THREE.Shape();
  const [outer, ...holes] = rings;
  outer.forEach(([lon, lat], i) => {
    const [x, z] = project(lon, lat);
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  });
  for (const hole of holes) {
    const path = new THREE.Path();
    hole.forEach(([lon, lat], i) => {
      const [x, z] = project(lon, lat);
      if (i === 0) path.moveTo(x, z);
      else path.lineTo(x, z);
    });
    shape.holes.push(path);
  }
  return shape;
}

function featureToShapes(
  feature: Feature,
  project: (lon: number, lat: number) => [number, number],
): THREE.Shape[] {
  const shapes: THREE.Shape[] = [];
  const g = feature.geometry;
  if (g.type === 'Polygon') {
    const s = ringsToShape((g as Polygon).coordinates, project);
    if (s) shapes.push(s);
  } else if (g.type === 'MultiPolygon') {
    for (const poly of (g as MultiPolygon).coordinates) {
      const s = ringsToShape(poly, project);
      if (s) shapes.push(s);
    }
  }
  return shapes;
}

export default function CountryMesh({
  feature,
  projection,
}: {
  feature: Feature;
  projection: Projection;
}) {
  const iso = (feature.properties?.iso as string) ?? '';
  const colors = COUNTRY[iso] ?? FALLBACK;

  const { geometry, edges, fillMat, edgeMat } = useMemo(() => {
    const shapes = featureToShapes(feature, projection.projectToScene);
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: SLAB_DEPTH,
      bevelEnabled: false,
      steps: 1,
    });
    // +π/2 (NOT −π/2) so the shape's Y (= scene z) maps to world +z, identical to
    // the beacon transform `[x, baseY, z]`. The old −π/2 negated z, so beacons and
    // countries lived in opposite N–S worlds (beacons rendered flipped). A rotation
    // (not a shape-Y negation) preserves winding, so normals stay correct.
    geo.rotateX(Math.PI / 2);
    geo.translate(0, SLAB_DEPTH, 0);
    geo.computeVertexNormals();

    const edgeGeo = new THREE.EdgesGeometry(geo, 18);

    // Matte fill with the radial ground-fade injected.
    const fill = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.fill),
      emissive: new THREE.Color(colors.fill),
      emissiveIntensity: 0.25,
      roughness: 0.95,
      metalness: 0,
      // OPAQUE on purpose: a transparent slab + depthWrite is an anti-pattern
      // (re-sorted every frame, unreliable self-occlusion). NOTE: the black
      // *flashing* was the EffectComposer on a transparent canvas — fixed in
      // Scene.tsx (alpha:false + opaque background), not here. This just keeps the
      // slab correct; the fade below blends colour → void instead of fading alpha.
      transparent: false,
      depthWrite: true,
    });
    fill.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${FADE_PARS}`)
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>\n${FADE_VERT}`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${FADE_PARS}`)
        .replace(
          '#include <dithering_fragment>',
          // Opaque fade: blend the lit colour toward the void (#050608) by the
          // same distance falloff; `fadeFrag` still discards past the far edge so
          // there's no hard opaque disc. No alpha → no transparent re-sort flicker.
          `${fadeFrag(FADE_IN, FADE_OUT)}\n  gl_FragColor.rgb = mix(vec3(0.0196, 0.0235, 0.0314), gl_FragColor.rgb, fade);\n#include <dithering_fragment>`,
        );
    };

    // Coastline edge — emissive >1 so bloom traces it; faded the same way.
    const edge = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(colors.edge) },
        uIntensity: { value: 1.3 },
        uFadeIn: { value: FADE_IN },
        uFadeOut: { value: FADE_OUT },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldXZ;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldXZ = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vWorldXZ;
        uniform vec3  uColor;
        uniform float uIntensity;
        uniform float uFadeIn;
        uniform float uFadeOut;
        void main() {
          float distXZ = length(vWorldXZ.xz);
          float fade = 1.0 - smoothstep(uFadeIn, uFadeOut, distXZ);
          if (fade <= 0.001) discard;
          gl_FragColor = vec4(uColor * uIntensity, fade);
        }
      `,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });

    return { geometry: geo, edges: edgeGeo, fillMat: fill, edgeMat: edge };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature, projection, colors.fill, colors.edge]);

  return (
    <group>
      <mesh geometry={geometry} material={fillMat} renderOrder={1} />
      <lineSegments
        geometry={edges}
        material={edgeMat}
        position={[0, 0.002, 0]}
        renderOrder={2}
      />
    </group>
  );
}

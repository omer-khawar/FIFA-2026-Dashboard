/**
 * CountryMesh.tsx — one extruded slab per host country.
 *
 * GeoJSON Polygon/MultiPolygon rings → THREE.Shape (outer ring + holes) →
 * ExtrudeGeometry. We build the shape directly in (worldX, worldZ) using the
 * shared projection, then rotateX(-90°) so the slab lies flat in the XZ plane.
 *
 * Coordinate bookkeeping for the rotation:
 *   A shape point (sx, sy) with extrude depth along +Z becomes, after
 *   rotateX(-PI/2), world (sx, -depthZ, sy). So shape-X → world X and
 *   shape-Y → world Z — exactly the projection's [x, z] output. The extrude
 *   pushes the slab downward (-Y); we translate it up by `depth` so the TOP
 *   face sits at y = 0 and beacons sit on it.
 *
 * Dark desaturated fills sit on the near-black scene; a slightly larger, dimmer
 * underlay plus an EdgesGeometry line give the brighter rim that bloom kisses.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { Projection } from './projection';

const SLAB_DEPTH = 0.05; // world units (~0.5% of plane width)

/** Per-country tint, darkened/desaturated to read on near-black. The fills are
 *  deliberately muted slate-tints (a whisper of the country hue), so the bright
 *  edge line — not the fill — carries the color identity and catches bloom. */
const COUNTRY_COLORS: Record<string, { fill: string; edge: string; emissive: string }> = {
  USA: { fill: '#12192e', edge: '#3f74d8', emissive: '#0c1530' },
  MEX: { fill: '#13211a', edge: '#33a866', emissive: '#0c1c14' },
  CAN: { fill: '#231620', edge: '#d2515c', emissive: '#1c1016' },
};

const FALLBACK = { fill: '#141a28', edge: '#3a4a66', emissive: '#0e1422' };

/** Build a THREE.Shape from a GeoJSON polygon (outer ring + holes). */
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
  const colors = COUNTRY_COLORS[iso] ?? FALLBACK;

  const { geometry, edges } = useMemo(() => {
    const shapes = featureToShapes(feature, projection.project);
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: SLAB_DEPTH,
      bevelEnabled: false,
      steps: 1,
    });
    // Lay flat (XY shape → XZ world) and lift so the top face is at y = 0.
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, SLAB_DEPTH, 0);
    geo.computeVertexNormals();

    // Edge outline on the top face for the bright rim.
    const edgeGeo = new THREE.EdgesGeometry(geo, 25);
    return { geometry: geo, edges: edgeGeo };
  }, [feature, projection]);

  return (
    <group>
      <mesh geometry={geometry} renderOrder={1}>
        <meshStandardMaterial
          color={colors.fill}
          emissive={colors.emissive}
          emissiveIntensity={0.55}
          roughness={0.92}
          metalness={0.0}
          flatShading={false}
        />
      </mesh>
      <lineSegments geometry={edges} position={[0, 0.001, 0]} renderOrder={2}>
        <lineBasicMaterial
          color={colors.edge}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  );
}

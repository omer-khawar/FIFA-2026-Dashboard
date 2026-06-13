/**
 * scripts/build-geo.mjs
 *
 * Builds public/data/hosts.geo.json from the committed Natural Earth 110m source
 * (scripts/ne_110m_raw.geojson). Keeps USA / Canada / Mexico.
 *
 * GEOMETRY HYGIENE (blueprint §2.5, defect #5):
 *   The old version ring-clipped every polygon to a lat/lon bbox. Clipping rings
 *   mutilates geometry — it manufactures the artificial straight line across
 *   Canada's north and shears the coastlines. We do NOT clip rings any more.
 *
 *   Instead we drop only WHOLE non-contiguous polygons by centroid, leaving every
 *   kept polygon's real coastline untouched (curved northern Canada included):
 *     - Alaska:        centroid lon < -141  OR  lat > 60
 *     - Hawaii:        centroid lon < -150  AND lat < 25
 *     - arctic islands: centroid lat > 60
 *   A polygon is dropped if it matches ANY of those. The contiguous mainlands
 *   (USA lower-48, Canada's mainland whose centroid is ~56°N, and Mexico) all
 *   survive, as do the BC coast islands near Vancouver (Vancouver Island, Haida
 *   Gwaii), Newfoundland, and the eastern Gulf islands — useful backdrop near our
 *   host cities. The high-arctic archipelago (24 islands, all centroid >60°N) is
 *   gone, but Canada's REAL northern coastline (the mainland polygon) is kept.
 *
 * Output schema is preserved exactly:
 *   { type: "FeatureCollection", source: "<provenance>", features: [
 *       { type: "Feature", properties: { name, iso }, geometry: <Polygon|MultiPolygon> } ] }
 *
 * Run with: node scripts/build-geo.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// Target countries: Natural Earth NAME_EN → our ISO.
const TARGETS = {
  'United States of America': 'USA',
  Canada: 'CAN',
  Mexico: 'MEX',
};

/** Mean-vertex centroid of an outer ring. Cheap and stable enough to classify
 *  a polygon as contiguous-mainland vs. a far island for the drop filter. */
function ringCentroid(ring) {
  let x = 0;
  let y = 0;
  for (const [lon, lat] of ring) {
    x += lon;
    y += lat;
  }
  return [x / ring.length, y / ring.length];
}

/** Should this polygon (classified by its outer-ring centroid) be dropped? */
function shouldDrop(centroidLon, centroidLat) {
  const isAlaska = centroidLon < -141 || centroidLat > 60;
  const isHawaii = centroidLon < -150 && centroidLat < 25;
  const isArctic = centroidLat > 60;
  return isAlaska || isHawaii || isArctic;
}

/** Filter the polygons of a (Multi)Polygon geometry, dropping non-contiguous
 *  pieces by centroid. Rings themselves are never clipped. Returns a geometry of
 *  the same kind, or null if everything was dropped. */
function filterGeometry(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;

  const kept = polys.filter((poly) => {
    const [cx, cy] = ringCentroid(poly[0]);
    return !shouldDrop(cx, cy);
  });

  if (kept.length === 0) return null;
  if (kept.length === 1) {
    return { type: 'Polygon', coordinates: kept[0] };
  }
  return { type: 'MultiPolygon', coordinates: kept };
}

// ── Load raw source ────────────────────────────────────────────────────────────
const rawPath = join(__dirname, 'ne_110m_raw.geojson');
const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));

const features = [];

for (const feature of raw.features) {
  const props = feature.properties;
  const name = props.NAME_EN ?? props.NAME ?? props.ADMIN ?? '';
  const iso = TARGETS[name];
  if (!iso) continue;

  const geom = feature.geometry;
  if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') {
    console.warn(`Unexpected geometry ${geom.type} for ${name} — skipping`);
    continue;
  }

  const newGeom = filterGeometry(geom);
  if (!newGeom) {
    console.warn(`All polygons dropped for ${name} — skipping`);
    continue;
  }

  features.push({
    type: 'Feature',
    properties: { name, iso },
    geometry: newGeom,
  });
}

if (features.length !== 3) {
  console.error(`Expected 3 features (USA, CAN, MEX), got ${features.length}`);
  process.exit(1);
}

const output = {
  type: 'FeatureCollection',
  source:
    'Natural Earth 110m Admin 0 Countries (https://www.naturalearthdata.com/downloads/110m-cultural-vectors/) — ' +
    'USA/CAN/MEX kept; whole non-contiguous polygons dropped by outer-ring centroid ' +
    '(Alaska lon<-141 OR lat>60; Hawaii lon<-150 AND lat<25; arctic lat>60). ' +
    'Rings are NOT clipped, so every kept coastline is the real curve.',
  features,
};

// ── Sanity report ────────────────────────────────────────────────────────────
for (const f of output.features) {
  const geom = f.geometry;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const poly of polys)
    for (const [lon, lat] of poly[0]) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  console.log(
    `${f.properties.iso}: ${polys.length} polygon(s) | extent lon[${minLon.toFixed(1)}..${maxLon.toFixed(1)}] lat[${minLat.toFixed(1)}..${maxLat.toFixed(1)}]`,
  );
  if (polys.length < 1) {
    console.error(`ERROR: ${f.properties.iso} has no polygons!`);
    process.exit(1);
  }
}

const outPath = join(repoRoot, 'public', 'data', 'hosts.geo.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nWrote ${outPath}`);
console.log('Done!');

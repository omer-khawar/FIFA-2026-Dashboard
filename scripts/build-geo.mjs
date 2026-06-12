/**
 * scripts/build-geo.mjs
 * Filters Natural Earth 110m admin-0 countries to USA, Canada, Mexico,
 * clips polygon rings to lon [-130,-60], lat [14,53] (dropping AK/HI/arctic),
 * writes public/data/hosts.geo.json.
 *
 * Run with: node scripts/build-geo.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// Clip bounds
const LON_MIN = -130, LON_MAX = -60;
const LAT_MIN = 14,   LAT_MAX = 53;

function inBounds(lon, lat) {
  return lon >= LON_MIN && lon <= LON_MAX && lat >= LAT_MIN && lat <= LAT_MAX;
}

/** Clip a ring: drop the ring entirely if no point is within bounds,
 *  otherwise filter points to those within bounds (coarse clipping). */
function clipRing(ring) {
  const filtered = ring.filter(([lon, lat]) => inBounds(lon, lat));
  // Need at least 3 points to form a polygon
  if (filtered.length < 3) return null;
  // Close the ring if needed
  const first = filtered[0];
  const last  = filtered[filtered.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    filtered.push([...first]);
  }
  return filtered;
}

function clipPolygon(coords) {
  const clipped = coords.map(clipRing).filter(Boolean);
  return clipped.length > 0 ? clipped : null;
}

function clipMultiPolygon(coords) {
  const clipped = coords.map(clipPolygon).filter(Boolean);
  return clipped.length > 0 ? clipped : null;
}

// Target countries: Natural Earth NAME_EN → our ISO
const TARGETS = {
  'United States of America': 'USA',
  'Canada':  'CAN',
  'Mexico':  'MEX',
};

// Load the raw GeoJSON
const rawPath = join(__dirname, 'ne_110m_raw.geojson');
const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));

const features = [];

for (const feature of raw.features) {
  const props = feature.properties;
  // NE uses NAME_EN or NAME
  const name = props.NAME_EN ?? props.NAME ?? props.ADMIN ?? '';
  const iso = TARGETS[name];
  if (!iso) continue;

  const geom = feature.geometry;
  let newGeom = null;

  if (geom.type === 'Polygon') {
    const clipped = clipPolygon(geom.coordinates);
    if (clipped) {
      newGeom = { type: 'Polygon', coordinates: clipped };
    }
  } else if (geom.type === 'MultiPolygon') {
    const clipped = clipMultiPolygon(geom.coordinates);
    if (clipped) {
      newGeom = { type: 'MultiPolygon', coordinates: clipped };
    }
  }

  if (!newGeom) {
    console.warn(`No clipped geometry for ${name} — skipping`);
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
  source: 'Natural Earth 110m Admin 0 Countries — https://www.naturalearthdata.com/downloads/110m-cultural-vectors/',
  features,
};

// Sanity check: each country has ≥1 ring
for (const f of output.features) {
  const geom = f.geometry;
  let ringCount = 0;
  if (geom.type === 'Polygon') ringCount = geom.coordinates.length;
  else if (geom.type === 'MultiPolygon') ringCount = geom.coordinates.reduce((s, p) => s + p.length, 0);
  console.log(`${f.properties.iso}: ${ringCount} ring(s) in geometry ${geom.type}`);
  if (ringCount < 1) {
    console.error(`ERROR: ${f.properties.iso} has no rings!`);
    process.exit(1);
  }
}

const outPath = join(repoRoot, 'public', 'data', 'hosts.geo.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nWrote ${outPath}`);
console.log('Done!');

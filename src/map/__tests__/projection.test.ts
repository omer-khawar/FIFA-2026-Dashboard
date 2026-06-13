/**
 * projection.test.ts — anchoring contract for the WebGL map (blueprint §2.3).
 *
 * Loads the committed public/data/hosts.geo.json + public/data/stadiums.json from
 * disk (same fixture pattern as src/engine/__tests__) and asserts:
 *   1. geoContains: all 16 stadiums fall inside their own country's feature.
 *   2. Scene-space anchor relationships from the §2.3 table:
 *        - BC Place is NW of Lumen Field (x smaller AND z smaller).
 *        - Gillette is the easternmost beacon (max x).
 *        - Levi's is strictly NW of SoFi (x smaller AND z smaller).
 *        - Mexico City z > Vancouver z (south = larger z).
 *
 * Projected coordinates are TESTED, not eyeballed — the CAD discipline that
 * kills the offshore-beacon class of bug.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { geoContains } from 'd3-geo';
import type { FeatureCollection, Feature } from 'geojson';
import type { Stadium } from '../../lib/types';
import { buildProjection } from '../projection';

const dataDir = join(process.cwd(), 'public', 'data');

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(dataDir, name), 'utf-8')) as T;
}

const hostGeo = loadJson<FeatureCollection>('hosts.geo.json');
const stadiums = loadJson<{ stadiums: Stadium[] }>('stadiums.json').stadiums;

const byIso: Record<string, Feature> = {};
for (const f of hostGeo.features) {
  byIso[(f.properties?.iso as string) ?? ''] = f;
}

const projection = buildProjection(hostGeo, stadiums);
const scene: Record<string, [number, number]> = {};
for (const s of stadiums) {
  scene[s.venueId] = projection.projectToScene(s.lon, s.lat);
}

/** Stadium scene-space [x, z] by name (unique enough for our 16). */
function byName(name: string): [number, number] {
  const s = stadiums.find((st) => st.name === name);
  if (!s) throw new Error(`no stadium named ${name}`);
  return scene[s.venueId];
}

describe('hosts.geo.json geometry', () => {
  it('has exactly 3 country features', () => {
    expect(hostGeo.features).toHaveLength(3);
  });

  it('exposes CAN, USA, MEX with name + iso properties', () => {
    const isos = hostGeo.features.map((f) => f.properties?.iso).sort();
    expect(isos).toEqual(['CAN', 'MEX', 'USA']);
    for (const f of hostGeo.features) {
      expect(typeof f.properties?.name).toBe('string');
      expect((f.properties?.name as string).length).toBeGreaterThan(0);
    }
  });
});

describe('stadium anchoring (geoContains)', () => {
  it('all 16 stadiums fall inside their own country feature', () => {
    expect(stadiums).toHaveLength(16);
    const outside: string[] = [];
    for (const s of stadiums) {
      const f = byIso[s.country];
      expect(f, `feature for ${s.country}`).toBeDefined();
      if (!geoContains(f, [s.lon, s.lat])) outside.push(`${s.name} (${s.country})`);
    }
    expect(outside).toEqual([]);
  });
});

describe('scene-space anchor relationships (§2.3)', () => {
  // Scene axes: +x = east, +z = south (north is smaller z). "NW" ⇒ x smaller AND z smaller.

  it('BC Place is NW of Lumen Field (x smaller AND z smaller)', () => {
    const [bx, bz] = byName('BC Place');
    const [lx, lz] = byName('Lumen Field');
    expect(bx).toBeLessThan(lx);
    expect(bz).toBeLessThan(lz);
  });

  it('Gillette is the easternmost beacon (max x)', () => {
    const [gx] = byName('Gillette Stadium');
    for (const s of stadiums) {
      if (s.name === 'Gillette Stadium') continue;
      expect(scene[s.venueId][0]).toBeLessThan(gx);
    }
  });

  it("Levi's is strictly NW of SoFi (x smaller AND z smaller)", () => {
    const [lvx, lvz] = byName("Levi's Stadium");
    const [sx, sz] = byName('SoFi Stadium');
    expect(lvx).toBeLessThan(sx);
    expect(lvz).toBeLessThan(sz);
  });

  it('Mexico City z > Vancouver z (south is larger z)', () => {
    const [, mzCity] = byName('Estadio Banorte'); // Mexico City
    const [, vz] = byName('BC Place'); // Vancouver
    expect(mzCity).toBeGreaterThan(vz);
  });
});

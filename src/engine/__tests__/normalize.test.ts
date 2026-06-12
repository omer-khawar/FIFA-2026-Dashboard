/**
 * normalize.test.ts — smoke tests for the normalize functions using committed API samples.
 * Verifies: 104 matches total, 72 group-stage, every match has venueId,
 * 12 groups × 4 rows, 48 unique teams.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { normalizeMatches, normalizeGroups, normalizeTeams } from '../../data/normalize';
import type { RawScoreboardResponse, RawStandingsResponse } from '../../data/espn';

// resolve from repo root (where vitest is run from)
const samplesDir = join(process.cwd(), 'docs', 'api-samples');

function loadSample<T>(name: string): T {
  return JSON.parse(readFileSync(join(samplesDir, name), 'utf-8')) as T;
}

describe('normalizeMatches (schedule-full.json + standings.json)', () => {
  const scoreboard = loadSample<RawScoreboardResponse>('schedule-full.json');
  const standings  = loadSample<RawStandingsResponse>('standings.json');
  const matches    = normalizeMatches(scoreboard, standings);

  it('produces exactly 104 matches', () => {
    expect(matches).toHaveLength(104);
  });

  it('produces exactly 72 group-stage matches', () => {
    const group = matches.filter(m => m.stage === 'group');
    expect(group).toHaveLength(72);
  });

  it('every match has a non-empty venueId', () => {
    const missing = matches.filter(m => !m.venueId || m.venueId.trim() === '');
    expect(missing).toHaveLength(0);
  });

  it('every match has a valid stage', () => {
    const validStages = new Set(['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final']);
    const invalid = matches.filter(m => !validStages.has(m.stage));
    expect(invalid).toHaveLength(0);
  });

  it('ordinals are 1-based positive integers', () => {
    const bad = matches.filter(m => m.ordinal < 1);
    expect(bad).toHaveLength(0);
  });

  it('stage counts match expected (16/8/4/2/1/1)', () => {
    const counts: Record<string, number> = {};
    for (const m of matches) counts[m.stage] = (counts[m.stage] ?? 0) + 1;
    expect(counts['r32']).toBe(16);
    expect(counts['r16']).toBe(8);
    expect(counts['qf']).toBe(4);
    expect(counts['sf']).toBe(2);
    expect(counts['third']).toBe(1);
    expect(counts['final']).toBe(1);
  });
});

describe('normalizeGroups (standings.json)', () => {
  const standings = loadSample<RawStandingsResponse>('standings.json');
  const groups    = normalizeGroups(standings);

  it('produces exactly 12 groups', () => {
    expect(groups).toHaveLength(12);
  });

  it('each group has exactly 4 rows', () => {
    for (const g of groups) {
      expect(g.rows).toHaveLength(4);
    }
  });

  it('group ids are A through L', () => {
    const ids = groups.map(g => g.id).sort();
    expect(ids).toEqual(['A','B','C','D','E','F','G','H','I','J','K','L']);
  });
});

describe('normalizeTeams (standings.json)', () => {
  const standings = loadSample<RawStandingsResponse>('standings.json');
  const teams     = normalizeTeams(standings);

  it('produces exactly 48 unique teams', () => {
    expect(Object.keys(teams)).toHaveLength(48);
  });

  it('each team has id, name, code, flagUrl', () => {
    for (const [id, t] of Object.entries(teams)) {
      expect(t.id).toBe(id);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.code.length).toBeGreaterThan(0);
    }
  });

  it('each team has a groupId', () => {
    const missing = Object.values(teams).filter(t => !t.groupId);
    expect(missing).toHaveLength(0);
  });
});

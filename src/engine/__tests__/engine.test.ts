/**
 * engine.test.ts — engine acceptance tests.
 *
 * Uses the committed API fixtures (docs/api-samples/schedule-full.json + standings.json)
 * through the real normalize functions, plus the committed public/data seeds, to exercise
 * the Elo replay, Poisson probabilities, bracket parser, thirds matcher, and full MC.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { normalizeMatches, normalizeTeams } from '../../data/normalize';
import type { RawScoreboardResponse, RawStandingsResponse } from '../../data/espn';
import type { Match, Team, Stadium, TeamId } from '../../lib/types';

import { matchProbs, winExpectancy, lambdaFromWe } from '../poisson';
import { replayElo, goalDiffMultiplier } from '../elo';
import { parseSlotLabel, buildBracket, matchThirds, assignThirds } from '../bracket';
import { simulate } from '../simulate';

// ─── Fixture loading ─────────────────────────────────────────────────────────────

const repoRoot = process.cwd();
const samplesDir = join(repoRoot, 'docs', 'api-samples');
const dataDir = join(repoRoot, 'public', 'data');

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

const scoreboard = loadJson<RawScoreboardResponse>(join(samplesDir, 'schedule-full.json'));
const standings = loadJson<RawStandingsResponse>(join(samplesDir, 'standings.json'));
const eloSeedFile = loadJson<{ ratings: Record<TeamId, number> }>(join(dataDir, 'elo-seed.json'));
const stadiumsFile = loadJson<{ stadiums: Stadium[] }>(join(dataDir, 'stadiums.json'));

const matches: Match[] = normalizeMatches(scoreboard, standings);
const teams: Record<TeamId, Team> = normalizeTeams(standings);
const eloSeed = eloSeedFile.ratings;
const stadiums = stadiumsFile.stadiums;

const SPAIN = '164';
const ARGENTINA = '202';
const QATAR = '4398';
const CURACAO = '11678';

// ─── Poisson / MatchProbs ─────────────────────────────────────────────────────────

describe('poisson matchProbs', () => {
  it('pHome+pDraw+pAway ≈ 1 for many random pairings', () => {
    for (let i = 0; i < 50; i++) {
      const a = 1400 + Math.random() * 800;
      const b = 1400 + Math.random() * 800;
      const bonus = Math.random() < 0.5 ? 100 : 0;
      const p = matchProbs(a, b, bonus);
      const sum = p.pHome + p.pDraw + p.pAway;
      expect(sum).toBeGreaterThan(0.999);
      expect(sum).toBeLessThan(1.001);
    }
  });

  it('grid sums to ≈ 1', () => {
    const p = matchProbs(2000, 1700, 0);
    const total = p.grid.reduce((s, x) => s + x, 0);
    expect(total).toBeGreaterThan(0.999);
    expect(total).toBeLessThan(1.001);
  });

  it('stronger team is favored', () => {
    const p = matchProbs(2150, 1450, 0);
    expect(p.pHome).toBeGreaterThan(p.pAway);
    expect(p.pHome).toBeGreaterThan(0.5);
  });

  it('home bonus shifts probability toward the home team', () => {
    const noBonus = matchProbs(1800, 1800, 0);
    const withBonus = matchProbs(1800, 1800, 100);
    expect(withBonus.pHome).toBeGreaterThan(noBonus.pHome);
  });

  it('knockout pHomeAdvance is between pHome and pHome+pDraw', () => {
    const p = matchProbs(1900, 1750, 0, true);
    expect(p.pHomeAdvance).toBeDefined();
    expect(p.pHomeAdvance!).toBeGreaterThan(p.pHome);
    expect(p.pHomeAdvance!).toBeLessThanOrEqual(p.pHome + p.pDraw + 1e-9);
  });

  it('λ mapping: equal teams give base λ, clamped to [0.25,4]', () => {
    expect(winExpectancy(0)).toBeCloseTo(0.5, 6);
    expect(lambdaFromWe(0.5)).toBeCloseTo(1.35, 6);
    expect(lambdaFromWe(0.999)).toBeLessThanOrEqual(4);
    expect(lambdaFromWe(0.001)).toBeGreaterThanOrEqual(0.25);
  });
});

// ─── Elo replay ────────────────────────────────────────────────────────────────────

describe('elo replay', () => {
  it('goal-diff multiplier matches spec', () => {
    expect(goalDiffMultiplier(0)).toBe(1);
    expect(goalDiffMultiplier(1)).toBe(1);
    expect(goalDiffMultiplier(2)).toBe(1.5);
    expect(goalDiffMultiplier(3)).toBeCloseTo(14 / 8, 6);
    expect(goalDiffMultiplier(5)).toBeCloseTo(16 / 8, 6);
  });

  it('a win moves winner up and loser down vs. seed', () => {
    const after = replayElo(eloSeed, matches, teams, stadiums);
    // Fixture has Mexico 2-0 South Africa (post). Mexico is a host playing at home.
    // Find the two teams in that completed match programmatically.
    const post = matches.filter(
      (m) =>
        m.state === 'post' &&
        m.home.kind === 'team' &&
        m.away.kind === 'team' &&
        m.homeScore !== undefined &&
        m.awayScore !== undefined,
    );
    expect(post.length).toBeGreaterThan(0);
    for (const m of post) {
      const homeId = (m.home as { teamId: TeamId }).teamId;
      const awayId = (m.away as { teamId: TeamId }).teamId;
      const winnerId = m.homeScore! > m.awayScore! ? homeId : awayId;
      const loserId = m.homeScore! > m.awayScore! ? awayId : homeId;
      if (m.homeScore === m.awayScore) continue; // skip draws
      const seedW = eloSeed[winnerId] ?? 1450;
      const seedL = eloSeed[loserId] ?? 1450;
      expect(after[winnerId]).toBeGreaterThan(seedW);
      expect(after[loserId]).toBeLessThan(seedL);
    }
  });

  it('unplayed teams keep their seed rating', () => {
    const after = replayElo(eloSeed, matches, teams, stadiums);
    // Argentina has no completed match in the fixture → rating unchanged.
    expect(after[ARGENTINA]).toBeCloseTo(eloSeed[ARGENTINA], 6);
  });
});

// ─── Bracket parsing ─────────────────────────────────────────────────────────────

describe('bracket parser', () => {
  it('parses each label form', () => {
    expect(parseSlotLabel('Group A Winner')).toEqual({ kind: 'group-winner', group: 'A' });
    expect(parseSlotLabel('Group L 2nd Place')).toEqual({ kind: 'group-runner', group: 'L' });
    expect(parseSlotLabel('Third Place Group A/B/C/D/F')).toEqual({
      kind: 'third-place',
      allowed: ['A', 'B', 'C', 'D', 'F'],
    });
    expect(parseSlotLabel('Round of 32 9 Winner')).toEqual({
      kind: 'match-winner',
      stage: 'r32',
      ordinal: 9,
    });
    expect(parseSlotLabel('Quarterfinal 2 Winner')).toEqual({
      kind: 'match-winner',
      stage: 'qf',
      ordinal: 2,
    });
    expect(parseSlotLabel('Semifinal 1 Winner')).toEqual({
      kind: 'match-winner',
      stage: 'sf',
      ordinal: 1,
    });
    expect(parseSlotLabel('Semifinal 2 Loser')).toEqual({
      kind: 'match-loser',
      stage: 'sf',
      ordinal: 2,
    });
    expect(parseSlotLabel('Spain')).toBeNull();
  });

  it('resolves all 32 R32 slot sources: 12 winners + 12 runners + 8 thirds', () => {
    const bracket = buildBracket(matches);
    const r32 = bracket.matches.filter((m) => m.stage === 'r32');
    expect(r32).toHaveLength(16);

    let winners = 0;
    let runners = 0;
    let thirds = 0;
    const thirdSets: string[][] = [];

    for (const bm of r32) {
      for (const side of ['home', 'away'] as const) {
        const slot = bm[side];
        expect('source' in slot).toBe(true); // all R32 slots are placeholders in the fixture
        if (!('source' in slot)) continue;
        const src = slot.source;
        if (src.kind === 'group-winner') winners++;
        else if (src.kind === 'group-runner') runners++;
        else if (src.kind === 'third-place') {
          thirds++;
          thirdSets.push(src.allowed);
        }
      }
    }

    expect(winners).toBe(12);
    expect(runners).toBe(12);
    expect(thirds).toBe(8);
    // every third-place slot has a non-empty allowed-group set
    for (const set of thirdSets) expect(set.length).toBeGreaterThan(0);
    // 8 distinct allowed-group sets (the FIFA allocation table)
    const distinct = new Set(thirdSets.map((s) => s.join('/')));
    expect(distinct.size).toBe(8);
  });
});

// ─── Thirds matcher ──────────────────────────────────────────────────────────────

describe('thirds bipartite matcher', () => {
  it('solves a known-feasible 8-of-12 case', () => {
    // The 8 R32 third-place allowed sets from the fixture.
    const bracket = buildBracket(matches);
    const slotAllowed: string[][] = [];
    for (const bm of bracket.matches.filter((m) => m.stage === 'r32')) {
      for (const side of ['home', 'away'] as const) {
        const slot = bm[side];
        if ('source' in slot && slot.source.kind === 'third-place') {
          slotAllowed.push(slot.source.allowed);
        }
      }
    }
    expect(slotAllowed).toHaveLength(8);

    // A feasible set of 8 qualifying third-placed groups (a plausible real allocation).
    const available = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const solution = matchThirds(slotAllowed, available);
    expect(solution).not.toBeNull();
    // every assignment respects its slot's allowed set, and is a permutation
    expect(new Set(solution!).size).toBe(8);
    solution!.forEach((g, i) => expect(slotAllowed[i]).toContain(g));
  });

  it('assignThirds always returns a full assignment (rank-order fallback)', () => {
    // Infeasible constraints: every slot only allows group A, but only A & B available.
    const slotAllowed = [['A'], ['A'], ['A']];
    const ranked = ['A', 'B', 'C'];
    const out = assignThirds(slotAllowed, ranked);
    expect(out).toHaveLength(3);
    out.forEach((g) => expect(g).toBeDefined());
  });

  it('matchThirds returns null when infeasible', () => {
    const slotAllowed = [['A'], ['A']];
    const available = ['A', 'B'];
    expect(matchThirds(slotAllowed, available)).toBeNull();
  });
});

// ─── Full Monte Carlo ────────────────────────────────────────────────────────────

describe('full 10k Monte Carlo simulate()', () => {
  const ITER = 10000;
  const t0 = Date.now();
  const predictions = simulate({
    teams,
    matches,
    eloSeed,
    stadiums,
    iterations: ITER,
    asOf: new Date().toISOString(),
  });
  const elapsedMs = Date.now() - t0;
  // eslint-disable-next-line no-console
  console.log(`[engine.test] 10k-iteration simulate() took ${elapsedMs}ms`);

  it('finishes in under 15 seconds', () => {
    expect(elapsedMs).toBeLessThan(15000);
  });

  it('reports iterations and an asOf timestamp', () => {
    expect(predictions.iterations).toBe(ITER);
    expect(typeof predictions.asOf).toBe('string');
    expect(predictions.asOf.length).toBeGreaterThan(0);
  });

  it('every team has pChampion ≥ 0 and an outlook', () => {
    const ids = Object.keys(teams);
    expect(Object.keys(predictions.outlooks).length).toBe(ids.length);
    for (const id of ids) {
      const o = predictions.outlooks[id];
      expect(o.pChampion).toBeGreaterThanOrEqual(0);
      expect(o.pR32).toBeGreaterThanOrEqual(0);
      expect(o.pR32).toBeLessThanOrEqual(1);
    }
  });

  it('sum of all pChampion ≈ 1', () => {
    const total = Object.values(predictions.outlooks).reduce((s, o) => s + o.pChampion, 0);
    expect(total).toBeGreaterThan(0.97);
    expect(total).toBeLessThan(1.03);
  });

  it("each group's 4 teams sum pR32 between 2 and 3 (top-2 + sometimes a third)", () => {
    const byGroup = new Map<string, number>();
    for (const id of Object.keys(teams)) {
      const g = teams[id].groupId!;
      byGroup.set(g, (byGroup.get(g) ?? 0) + predictions.outlooks[id].pR32);
    }
    expect(byGroup.size).toBe(12);
    for (const [g, sum] of byGroup) {
      expect(sum, `group ${g} pR32 sum`).toBeGreaterThan(1.95);
      expect(sum, `group ${g} pR32 sum`).toBeLessThan(3.05);
    }
  });

  it('a top-Elo team has a higher pChampion than a bottom-Elo team', () => {
    expect(predictions.outlooks[SPAIN].pChampion).toBeGreaterThan(
      predictions.outlooks[QATAR].pChampion,
    );
    expect(predictions.outlooks[ARGENTINA].pChampion).toBeGreaterThan(
      predictions.outlooks[CURACAO].pChampion,
    );
  });

  it('analytic matchProbs exist for forward-looking decided-team matches and sum to ~1', () => {
    // group-stage pre matches with both teams known should all have probs
    const decidedPre = matches.filter(
      (m) =>
        m.state !== 'post' &&
        m.home.kind === 'team' &&
        m.away.kind === 'team',
    );
    expect(decidedPre.length).toBeGreaterThan(0);
    for (const m of decidedPre) {
      const mp = predictions.matchProbs[m.id];
      expect(mp, `probs for match ${m.id}`).toBeDefined();
      const sum = mp.pHome + mp.pDraw + mp.pAway;
      expect(sum).toBeGreaterThan(0.999);
      expect(sum).toBeLessThan(1.001);
    }
  });

  it('elo in predictions reflects the post-replay ratings', () => {
    // Argentina unplayed → equals seed; a played team differs.
    expect(predictions.elo[ARGENTINA]).toBeCloseTo(eloSeed[ARGENTINA], 6);
  });
});

/**
 * simulate.ts — 10,000-iteration Monte Carlo tournament simulation.
 *
 * Per SPEC.md "Engine" §4:
 *  - Real results stand; unplayed (and in-progress) group matches sampled from the
 *    Poisson score grid.
 *  - Group tables tiebreak: points → GD → GF → head-to-head points among tied → random.
 *  - Thirds ranked points → GD → GF → random; top 8 advance.
 *  - Fill R32 via bracket.ts (group winners/runners direct; thirds via constrained
 *    bipartite assignment with rank-order fallback).
 *  - Knockout winners sampled by pHomeAdvance (= pHome + pDraw·We_home_noBonus).
 *  - Elo static within an iteration.
 *  - Track deepest stage per team → outlook probabilities.
 *  - Also compute analytic MatchProbs for every 'pre'/'in' match whose both slots are
 *    decided teams (group AND knockout; knockout gets pHomeAdvance).
 *  - 'in' (live) matches are treated as unplayed and sampled fresh (ignore live score).
 *
 * Performance: grid CDFs are cached lazily keyed by (eloHome|eloAway|bonus) rounded to
 * integer Elo; the hot loop uses flat typed arrays and avoids allocation.
 */

import type { Match, Team, Stadium, TeamId, Stage } from '../lib/types';
import type { MatchProbs, TeamOutlook, Predictions } from '../lib/types';
import { replayElo, buildVenueCountry } from './elo';
import { applyAdjustments } from './adjustments';
import {
  matchProbs as computeMatchProbs,
  gridCdf,
  sampleGridIndex,
  decodeHome,
  decodeAway,
} from './poisson';
import {
  buildBracket,
  assignThirds,
  stageOrdinalKey,
} from './bracket';
import type { BracketMatch, SlotSource } from './bracket';

const HOST_CODES = new Set(['USA', 'MEX', 'CAN']);
const HOME_BONUS = 100;

// Knockout stages we actually simulate, in order (third-place game handled separately).
const KO_ROUNDS: Stage[] = ['r32', 'r16', 'qf', 'sf', 'final'];

export interface SimulateInput {
  teams: Record<TeamId, Team>;
  matches: Match[];
  eloSeed: Record<TeamId, number>;
  stadiums: Stadium[];
  iterations: number;
  asOf: string;
}

// ─── Grid CDF cache ─────────────────────────────────────────────────────────────

/**
 * Lazily computes + caches a grid CDF (and the home-advance probability) for a
 * pairing keyed by rounded Elo. Keeps the hot loop allocation-free for repeats.
 */
class CdfCache {
  private cache = new Map<number, { cdf: number[]; pHomeAdvance: number }>();

  get(eloHome: number, eloAway: number, bonus: number): { cdf: number[]; pHomeAdvance: number } {
    const rh = Math.round(eloHome);
    const ra = Math.round(eloAway);
    const rb = bonus ? 1 : 0;
    // pack into a single number key: rh,ra in [0,4095]-ish range, bonus bit
    const key = ((rh & 0x3fff) << 15) | ((ra & 0x3fff) << 1) | rb;
    let hit = this.cache.get(key);
    if (hit) return hit;
    const probs = computeMatchProbs(rh, ra, bonus, true);
    hit = { cdf: gridCdf(probs.grid), pHomeAdvance: probs.pHomeAdvance ?? probs.pHome };
    this.cache.set(key, hit);
    return hit;
  }
}

// ─── Group structures ────────────────────────────────────────────────────────────

interface GroupMatchPlan {
  homeId: TeamId;
  awayId: TeamId;
  venueId: string;
  /** if the real match is already played: fixed scores, else null → sample */
  fixed: { hs: number; as: number } | null;
  /** +Elo applied to the home side's diff (host bonus); 0 otherwise */
  homeBonus: number;
}

interface GroupPlan {
  letter: string;
  teamIds: TeamId[];
  matches: GroupMatchPlan[];
}

/** Per-iteration mutable group standing accumulator (flat arrays indexed by team slot). */
interface GroupAccum {
  letter: string;
  teamIds: TeamId[];
  pts: number[];
  gd: number[];
  gf: number[];
  // head-to-head points: h2h[i][j] = points team i took off team j in this iteration
  h2h: number[][];
  rnd: number[]; // random tiebreak seed per team
}

// ─── Build a static simulation plan from inputs ──────────────────────────────────

function buildGroupPlans(
  teams: Record<TeamId, Team>,
  matches: Match[],
  stadiums: Stadium[],
): GroupPlan[] {
  const venueCountry = buildVenueCountry(stadiums);
  const byLetter = new Map<string, GroupPlan>();

  // collect team ids per group from team.groupId
  for (const t of Object.values(teams)) {
    if (!t.groupId) continue;
    let gp = byLetter.get(t.groupId);
    if (!gp) {
      gp = { letter: t.groupId, teamIds: [], matches: [] };
      byLetter.set(t.groupId, gp);
    }
    gp.teamIds.push(t.id);
  }

  for (const m of matches) {
    if (m.stage !== 'group') continue;
    if (m.home.kind !== 'team' || m.away.kind !== 'team') continue;
    const homeId = m.home.teamId;
    const awayId = m.away.teamId;
    const letter = m.group ?? teams[homeId]?.groupId ?? teams[awayId]?.groupId;
    if (!letter) continue;
    const gp = byLetter.get(letter);
    if (!gp) continue;

    const homeCode = teams[homeId]?.code;
    const vc = venueCountry.get(m.venueId);
    let homeBonus = 0;
    // Home-perspective host bonus only (the away side is the nominal "home" team here).
    if (vc && homeCode && HOST_CODES.has(homeCode) && homeCode === vc) homeBonus = HOME_BONUS;

    // Real results stand only for completed matches; 'in' treated as unplayed.
    const fixed =
      m.state === 'post' && m.homeScore !== undefined && m.awayScore !== undefined
        ? { hs: m.homeScore, as: m.awayScore }
        : null;

    gp.matches.push({ homeId, awayId, venueId: m.venueId, fixed, homeBonus });
  }

  // ensure deterministic group ordering A..L
  return [...byLetter.values()].sort((a, b) => a.letter.localeCompare(b.letter));
}

// ─── Tiebreak comparison for a group ─────────────────────────────────────────────

/**
 * Returns ranked team-slot indices (best first) for a group accumulator.
 * Order: points → GD → GF → head-to-head points among the tied set → random.
 */
function rankGroup(acc: GroupAccum): number[] {
  const n = acc.teamIds.length;
  const idx = Array.from({ length: n }, (_, i) => i);

  // primary sort by pts, gd, gf, then random
  idx.sort((a, b) => {
    if (acc.pts[b] !== acc.pts[a]) return acc.pts[b] - acc.pts[a];
    if (acc.gd[b] !== acc.gd[a]) return acc.gd[b] - acc.gd[a];
    if (acc.gf[b] !== acc.gf[a]) return acc.gf[b] - acc.gf[a];
    // head-to-head and random resolved below for tied clusters
    return 0;
  });

  // Resolve clusters that are tied on pts/gd/gf using head-to-head, then random.
  const out: number[] = [];
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (
      j < n &&
      acc.pts[idx[j]] === acc.pts[idx[i]] &&
      acc.gd[idx[j]] === acc.gd[idx[i]] &&
      acc.gf[idx[j]] === acc.gf[idx[i]]
    ) {
      j++;
    }
    if (j - i === 1) {
      out.push(idx[i]);
    } else {
      // tied cluster idx[i..j) — order by mini-table head-to-head points, then random
      const cluster = idx.slice(i, j);
      cluster.sort((a, b) => {
        let ha = 0;
        let hb = 0;
        // head-to-head points within the tied cluster only
        for (const o of cluster) {
          if (o !== a) ha += acc.h2h[a][o];
          if (o !== b) hb += acc.h2h[b][o];
        }
        if (hb !== ha) return hb - ha;
        return acc.rnd[b] - acc.rnd[a];
      });
      for (const c of cluster) out.push(c);
    }
    i = j;
  }
  return out;
}

// ─── Main simulate ───────────────────────────────────────────────────────────────

export function simulate(input: SimulateInput): Predictions {
  const { teams, matches, eloSeed, stadiums, iterations, asOf } = input;

  // 1. Elo replay from seed over completed matches, then identity adjustment seam.
  const replayed = replayElo(eloSeed, matches, teams, stadiums);
  const elo = applyAdjustments(replayed);
  const eloOf = (id: TeamId): number => (elo[id] === undefined ? 1450 : elo[id]);

  const cache = new CdfCache();

  // 2. Build the static group plan and the knockout bracket.
  const groupPlans = buildGroupPlans(teams, matches, stadiums);
  const bracket = buildBracket(matches);

  // Order knockout matches per round for sampling (each round depends on the prior).
  const koByRound = new Map<Stage, BracketMatch[]>();
  for (const stage of [...KO_ROUNDS, 'third' as Stage]) koByRound.set(stage, []);
  for (const bm of bracket.matches) {
    const arr = koByRound.get(bm.stage);
    if (arr) arr.push(bm);
  }
  for (const arr of koByRound.values()) arr.sort((a, b) => a.ordinal - b.ordinal);

  // 3. Outlook counters: per team, count of iterations reaching each stage.
  const reachR32: Record<TeamId, number> = {};
  const reachR16: Record<TeamId, number> = {};
  const reachQF: Record<TeamId, number> = {};
  const reachSF: Record<TeamId, number> = {};
  const reachFinal: Record<TeamId, number> = {};
  const champion: Record<TeamId, number> = {};
  for (const id of Object.keys(teams)) {
    reachR32[id] = 0;
    reachR16[id] = 0;
    reachQF[id] = 0;
    reachSF[id] = 0;
    reachFinal[id] = 0;
    champion[id] = 0;
  }

  // Precompute third-place R32 slots' allowed groups (constant across iterations).
  // Walk the R32 bracket matches; collect each third-place slot's allowed set + the
  // (matchId, side) it fills.
  interface ThirdSlotRef {
    matchId: string;
    side: 'home' | 'away';
    allowed: string[];
  }
  const thirdSlots: ThirdSlotRef[] = [];
  for (const bm of koByRound.get('r32') ?? []) {
    for (const side of ['home', 'away'] as const) {
      const slot = bm[side];
      if ('source' in slot && slot.source.kind === 'third-place') {
        thirdSlots.push({ matchId: bm.matchId, side, allowed: slot.source.allowed });
      }
    }
  }
  const thirdSlotAllowed = thirdSlots.map((t) => t.allowed);

  // Reusable per-iteration buffers
  const accums: GroupAccum[] = groupPlans.map((gp) => ({
    letter: gp.letter,
    teamIds: gp.teamIds,
    pts: new Array(gp.teamIds.length).fill(0),
    gd: new Array(gp.teamIds.length).fill(0),
    gf: new Array(gp.teamIds.length).fill(0),
    h2h: gp.teamIds.map(() => new Array(gp.teamIds.length).fill(0)),
    rnd: new Array(gp.teamIds.length).fill(0),
  }));

  // slot-index lookup within each group plan
  const slotIndex: Map<string, number>[] = groupPlans.map((gp) => {
    const m = new Map<string, number>();
    gp.teamIds.forEach((id, i) => m.set(id, i));
    return m;
  });

  // winner of each knockout match this iteration: key `${stage}#${ordinal}` → teamId
  const koWinner = new Map<string, TeamId>();
  const koLoser = new Map<string, TeamId>();
  // resolved team for each knockout slot reference (recomputed per iter)
  // we resolve lazily as rounds progress.

  // 4. Iterations
  for (let iter = 0; iter < iterations; iter++) {
    // reset accumulators
    for (const acc of accums) {
      const n = acc.teamIds.length;
      for (let i = 0; i < n; i++) {
        acc.pts[i] = 0;
        acc.gd[i] = 0;
        acc.gf[i] = 0;
        acc.rnd[i] = Math.random();
        for (let j = 0; j < n; j++) acc.h2h[i][j] = 0;
      }
    }

    // 4a. group matches
    groupPlans.forEach((gp, gi) => {
      const acc = accums[gi];
      const si = slotIndex[gi];
      for (const gm of gp.matches) {
        const hIdx = si.get(gm.homeId);
        const aIdx = si.get(gm.awayId);
        if (hIdx === undefined || aIdx === undefined) continue;

        let hs: number;
        let as: number;
        if (gm.fixed) {
          hs = gm.fixed.hs;
          as = gm.fixed.as;
        } else {
          const { cdf } = cache.get(eloOf(gm.homeId), eloOf(gm.awayId), gm.homeBonus);
          const k = sampleGridIndex(cdf, Math.random());
          hs = decodeHome(k);
          as = decodeAway(k);
        }

        acc.gf[hIdx] += hs;
        acc.gf[aIdx] += as;
        acc.gd[hIdx] += hs - as;
        acc.gd[aIdx] += as - hs;
        if (hs > as) {
          acc.pts[hIdx] += 3;
          acc.h2h[hIdx][aIdx] += 3;
        } else if (hs < as) {
          acc.pts[aIdx] += 3;
          acc.h2h[aIdx][hIdx] += 3;
        } else {
          acc.pts[hIdx] += 1;
          acc.pts[aIdx] += 1;
          acc.h2h[hIdx][aIdx] += 1;
          acc.h2h[aIdx][hIdx] += 1;
        }
      }
    });

    // 4b. rank each group → winner, runner-up, third
    // groupWinner/Runner keyed by letter; thirds collected for cross-group ranking
    const winnerByGroup = new Map<string, TeamId>();
    const runnerByGroup = new Map<string, TeamId>();
    const thirds: Array<{ group: string; teamId: TeamId; pts: number; gd: number; gf: number; rnd: number }> = [];

    groupPlans.forEach((gp, gi) => {
      const acc = accums[gi];
      const ranked = rankGroup(acc);
      const w = gp.teamIds[ranked[0]];
      const r = gp.teamIds[ranked[1]];
      winnerByGroup.set(gp.letter, w);
      runnerByGroup.set(gp.letter, r);
      const t3 = ranked[2];
      thirds.push({
        group: gp.letter,
        teamId: gp.teamIds[t3],
        pts: acc.pts[t3],
        gd: acc.gd[t3],
        gf: acc.gf[t3],
        rnd: acc.rnd[t3],
      });
    });

    // 4c. mark all group winners + runners as having reached R32 (survived group)
    for (const id of winnerByGroup.values()) reachR32[id]++;
    for (const id of runnerByGroup.values()) reachR32[id]++;

    // 4d. rank thirds across groups; top 8 advance
    thirds.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return b.rnd - a.rnd;
    });
    const qualifyingThirds = thirds.slice(0, 8);
    for (const t of qualifyingThirds) reachR32[t.teamId]++;

    // 4e. assign the 8 qualifying thirds to the 8 constrained R32 slots
    // rankedGroups: best-first group letters of qualifying thirds
    const rankedThirdGroups = qualifyingThirds.map((t) => t.group);
    const thirdGroupToTeam = new Map<string, TeamId>();
    for (const t of qualifyingThirds) thirdGroupToTeam.set(t.group, t.teamId);
    const assignedGroups = assignThirds(thirdSlotAllowed, rankedThirdGroups);

    // resolved team per R32 third slot (matchId|side → teamId)
    const thirdSlotTeam = new Map<string, TeamId>();
    thirdSlots.forEach((ts, i) => {
      const g = assignedGroups[i];
      const tid = thirdGroupToTeam.get(g);
      if (tid !== undefined) thirdSlotTeam.set(`${ts.matchId}|${ts.side}`, tid);
    });

    // 4f. resolve a knockout slot to a teamId given current iteration state
    koWinner.clear();
    koLoser.clear();

    const resolveSlot = (
      bm: BracketMatch,
      side: 'home' | 'away',
    ): TeamId | undefined => {
      const slot = bm[side];
      if ('teamId' in slot) return slot.teamId; // pre-decided real team
      const src: SlotSource = slot.source;
      switch (src.kind) {
        case 'group-winner':
          return winnerByGroup.get(src.group);
        case 'group-runner':
          return runnerByGroup.get(src.group);
        case 'third-place':
          return thirdSlotTeam.get(`${bm.matchId}|${side}`);
        case 'match-winner':
          return koWinner.get(stageOrdinalKey(src.stage, src.ordinal));
        case 'match-loser':
          return koLoser.get(stageOrdinalKey(src.stage, src.ordinal));
      }
    };

    // 4g. simulate knockout rounds in order
    for (const stage of KO_ROUNDS) {
      const bms = koByRound.get(stage) ?? [];
      for (const bm of bms) {
        const homeId = resolveSlot(bm, 'home');
        const awayId = resolveSlot(bm, 'away');
        if (homeId === undefined || awayId === undefined) continue;

        const { pHomeAdvance } = cache.get(eloOf(homeId), eloOf(awayId), 0);
        const homeWins = Math.random() < pHomeAdvance;
        const winner = homeWins ? homeId : awayId;
        const loser = homeWins ? awayId : homeId;
        koWinner.set(stageOrdinalKey(stage, bm.ordinal), winner);
        koLoser.set(stageOrdinalKey(stage, bm.ordinal), loser);

        // depth tracking: both teams reached `stage`; winner advances past it.
        // We count "reached the NEXT round" when a team wins this match.
        if (stage === 'r32') {
          // both already counted in reachR32; winner reaches r16
          reachR16[winner]++;
        } else if (stage === 'r16') {
          reachQF[winner]++;
        } else if (stage === 'qf') {
          reachSF[winner]++;
        } else if (stage === 'sf') {
          reachFinal[winner]++;
        } else if (stage === 'final') {
          champion[winner]++;
        }
      }
    }
  }

  // 5. Build outlooks (probabilities from counts)
  const outlooks: Record<TeamId, TeamOutlook> = {};
  const invIter = 1 / iterations;
  for (const id of Object.keys(teams)) {
    outlooks[id] = {
      teamId: id,
      pR32: reachR32[id] * invIter,
      pR16: reachR16[id] * invIter,
      pQF: reachQF[id] * invIter,
      pSF: reachSF[id] * invIter,
      pFinal: reachFinal[id] * invIter,
      pChampion: champion[id] * invIter,
    };
  }

  // 6. Analytic MatchProbs for every 'pre'/'in' match with both slots decided teams.
  const matchProbsOut: Record<string, MatchProbs> = {};
  const venueCountry = buildVenueCountry(stadiums);
  for (const m of matches) {
    if (m.state === 'post') continue; // only forward-looking
    if (m.home.kind !== 'team' || m.away.kind !== 'team') continue;
    const homeId = m.home.teamId;
    const awayId = m.away.teamId;

    const isKnockout = m.stage !== 'group';
    let homeBonus = 0;
    if (!isKnockout) {
      const vc = venueCountry.get(m.venueId);
      const homeCode = teams[homeId]?.code;
      if (vc && homeCode && HOST_CODES.has(homeCode) && homeCode === vc) homeBonus = HOME_BONUS;
    }

    const probs = computeMatchProbs(eloOf(homeId), eloOf(awayId), homeBonus, isKnockout);
    const mp: MatchProbs = {
      matchId: m.id,
      pHome: probs.pHome,
      pDraw: probs.pDraw,
      pAway: probs.pAway,
    };
    if (isKnockout && probs.pHomeAdvance !== undefined) {
      mp.pHomeAdvance = probs.pHomeAdvance;
    }
    matchProbsOut[m.id] = mp;
  }

  return {
    asOf,
    iterations,
    elo,
    matchProbs: matchProbsOut,
    outlooks,
  };
}

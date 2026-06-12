/**
 * bracket.ts — parse ESPN Slot placeholder labels into a resolvable tournament
 * structure, and resolve the eight constrained third-place R32 slots via
 * bipartite matching with backtracking (rank-order fallback).
 *
 * Label grammar (exactly as it appears in the live feed, see SPEC.md §3):
 *   "Group X Winner"                         → winner of group X
 *   "Group X 2nd Place"                      → runner-up of group X
 *   "Third Place Group A/B/C/D/F"            → a best-third from one of {A,B,C,D,F}
 *   "Round of 32 9 Winner"                   → winner of the R32 match with ordinal 9
 *   "Quarterfinal 2 Winner" / "Semifinal 1 Winner" / "Round of 16 N Winner"
 *   "Semifinal 1 Loser"                      → loser of SF match ordinal 1 (3rd-place game)
 *
 * "<Round> N Winner/Loser" resolves to the Match in that stage whose `ordinal === N`
 * (normalize.ts already computes ordinals by date-then-id, matching the feed numbering).
 */

import type { Match, Stage, TeamId } from '../lib/types';

// ─── Parsed slot source kinds ──────────────────────────────────────────────────

export type SlotSource =
  | { kind: 'group-winner'; group: string }
  | { kind: 'group-runner'; group: string }
  | { kind: 'third-place'; allowed: string[] } // one of these groups' best thirds
  | { kind: 'match-winner'; stage: Stage; ordinal: number }
  | { kind: 'match-loser'; stage: Stage; ordinal: number };

const ROUND_LABEL_TO_STAGE: Record<string, Stage> = {
  'Round of 32': 'r32',
  'Round of 16': 'r16',
  Quarterfinal: 'qf',
  Semifinal: 'sf',
};

/**
 * Parse a single placeholder label into a structured source, or null if the label
 * is not a recognized placeholder (i.e. it is a real team name).
 */
export function parseSlotLabel(label: string): SlotSource | null {
  const s = label.trim();

  // Group A Winner
  let m = /^Group ([A-L]) Winner$/i.exec(s);
  if (m) return { kind: 'group-winner', group: m[1].toUpperCase() };

  // Group A 2nd Place
  m = /^Group ([A-L]) 2nd Place$/i.exec(s);
  if (m) return { kind: 'group-runner', group: m[1].toUpperCase() };

  // Third Place Group A/B/C/D/F
  m = /^Third Place Group ([A-L](?:\/[A-L])*)$/i.exec(s);
  if (m) {
    const allowed = m[1].split('/').map((g) => g.toUpperCase());
    return { kind: 'third-place', allowed };
  }

  // <Round> N Winner | <Round> N Loser
  m = /^(Round of 32|Round of 16|Quarterfinal|Semifinal) (\d+) (Winner|Loser)$/i.exec(s);
  if (m) {
    const stage = ROUND_LABEL_TO_STAGE[normalizeRoundLabel(m[1])];
    const ordinal = parseInt(m[2], 10);
    const isWinner = /winner/i.test(m[3]);
    return stage
      ? { kind: isWinner ? 'match-winner' : 'match-loser', stage, ordinal }
      : null;
  }

  return null;
}

function normalizeRoundLabel(raw: string): string {
  const lc = raw.toLowerCase();
  if (lc === 'round of 32') return 'Round of 32';
  if (lc === 'round of 16') return 'Round of 16';
  if (lc === 'quarterfinal') return 'Quarterfinal';
  if (lc === 'semifinal') return 'Semifinal';
  return raw;
}

// ─── Bracket structure ──────────────────────────────────────────────────────────

export interface BracketSlot {
  /** which competitor slot of the match: 'home' | 'away' */
  side: 'home' | 'away';
  source: SlotSource;
}

export interface BracketMatch {
  matchId: string;
  stage: Stage;
  ordinal: number;
  home: BracketSlot | { side: 'home'; teamId: TeamId }; // decided or sourced
  away: BracketSlot | { side: 'away'; teamId: TeamId };
}

export interface Bracket {
  /** all knockout matches keyed by `${stage}#${ordinal}` for fast winner lookup */
  byStageOrdinal: Map<string, Match>;
  /** the parsed knockout matches in DAG order r32→final */
  matches: BracketMatch[];
}

export function stageOrdinalKey(stage: Stage, ordinal: number): string {
  return `${stage}#${ordinal}`;
}

const KNOCKOUT_STAGES: Stage[] = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];

/**
 * Build a parsed bracket from the full match list. Group-stage matches are ignored
 * here (handled by the group-table logic in simulate.ts). Each knockout slot is
 * either already a decided team or a parsed SlotSource.
 */
export function buildBracket(matches: Match[]): Bracket {
  const byStageOrdinal = new Map<string, Match>();
  const knockout = matches.filter((m) => KNOCKOUT_STAGES.includes(m.stage));
  for (const m of knockout) byStageOrdinal.set(stageOrdinalKey(m.stage, m.ordinal), m);

  const parsed: BracketMatch[] = [];
  for (const m of knockout) {
    parsed.push({
      matchId: m.id,
      stage: m.stage,
      ordinal: m.ordinal,
      home:
        m.home.kind === 'team'
          ? { side: 'home', teamId: m.home.teamId }
          : { side: 'home', source: parseSlotLabel(m.home.label) ?? unknownSource(m.home.label) },
      away:
        m.away.kind === 'team'
          ? { side: 'away', teamId: m.away.teamId }
          : { side: 'away', source: parseSlotLabel(m.away.label) ?? unknownSource(m.away.label) },
    });
  }

  return { byStageOrdinal, matches: parsed };
}

/** A label we could not parse — keep it from crashing; treated as unresolved. */
function unknownSource(label: string): SlotSource {
  // Encode as an impossible third-place with no allowed groups so resolution yields null.
  void label;
  return { kind: 'third-place', allowed: [] };
}

// ─── Third-place bipartite matching ─────────────────────────────────────────────

/**
 * Feasibility check: is there a complete matching of every constrained third-place
 * slot to a distinct available group, honoring allowed-group sets? Returns the
 * per-slot assignment if a complete matching exists, else null. (Kuhn's augmenting
 * paths = backtracking over the bipartite graph.)
 *
 * @param slotAllowed     allowed-group set per slot (index = slot)
 * @param availableGroups groups whose third-placed team qualified
 */
export function matchThirds(
  slotAllowed: string[][],
  availableGroups: string[],
): string[] | null {
  const groups = [...availableGroups];
  const groupIndex = new Map<string, number>();
  groups.forEach((g, i) => groupIndex.set(g, i));

  const adj: number[][] = slotAllowed.map((allowed) =>
    allowed.map((g) => groupIndex.get(g)).filter((i): i is number => i !== undefined),
  );

  const slotToGroup = new Array<number>(slotAllowed.length).fill(-1);
  const groupToSlot = new Array<number>(groups.length).fill(-1);

  function tryAssign(slot: number, seen: boolean[]): boolean {
    for (const g of adj[slot]) {
      if (seen[g]) continue;
      seen[g] = true;
      if (groupToSlot[g] === -1 || tryAssign(groupToSlot[g], seen)) {
        slotToGroup[slot] = g;
        groupToSlot[g] = slot;
        return true;
      }
    }
    return false;
  }

  let matched = 0;
  for (let slot = 0; slot < slotAllowed.length; slot++) {
    const seen = new Array<boolean>(groups.length).fill(false);
    if (tryAssign(slot, seen)) matched++;
  }

  if (matched === slotAllowed.length) {
    return slotToGroup.map((gi) => groups[gi]);
  }
  return null;
}

/**
 * Array-returning third-place matcher with rank-order fallback.
 *
 * @param slotAllowed     allowed-group set per slot (order matters; index = slot)
 * @param rankedGroups    groups of the qualifying thirds, BEST-FIRST (already ranked)
 * @returns per-slot assigned group letter; always fully populated:
 *          if the constrained matching is infeasible, falls back to assigning the
 *          ranked groups to slots in order (ignoring constraints).
 */
export function assignThirds(
  slotAllowed: string[][],
  rankedGroups: string[],
): string[] {
  const groups = [...rankedGroups];
  const groupIndex = new Map<string, number>();
  groups.forEach((g, i) => groupIndex.set(g, i));

  const adj: number[][] = slotAllowed.map((allowed) =>
    allowed.map((g) => groupIndex.get(g)).filter((i): i is number => i !== undefined),
  );

  const slotToGroup = new Array<number>(slotAllowed.length).fill(-1);
  const groupToSlot = new Array<number>(groups.length).fill(-1);

  function tryAssign(slot: number, seen: boolean[]): boolean {
    for (const g of adj[slot]) {
      if (seen[g]) continue;
      seen[g] = true;
      if (groupToSlot[g] === -1 || tryAssign(groupToSlot[g], seen)) {
        slotToGroup[slot] = g;
        groupToSlot[g] = slot;
        return true;
      }
    }
    return false;
  }

  let matched = 0;
  for (let slot = 0; slot < slotAllowed.length; slot++) {
    const seen = new Array<boolean>(groups.length).fill(false);
    if (tryAssign(slot, seen)) matched++;
  }

  if (matched === slotAllowed.length) {
    return slotToGroup.map((gi) => groups[gi]);
  }

  // Fallback: rank-order assignment ignoring constraints.
  return slotAllowed.map((_, i) => groups[i] ?? groups[groups.length - 1]);
}

/**
 * normalize.ts — converts raw ESPN payloads into the frozen domain model.
 *
 * Stat names found in standings.json entries[].stats[].name:
 *   gamesPlayed, losses, pointDifferential, points, pointsAgainst,
 *   pointsFor, ties, wins, advanced, deductions, ppg, rank, rankChange, overall
 *
 * Stage slug mapping from scoreboard season.slug:
 *   group-stage      → 'group'
 *   round-of-32      → 'r32'
 *   round-of-16      → 'r16'
 *   quarterfinals    → 'qf'
 *   semifinals       → 'sf'
 *   3rd-place-match  → 'third'
 *   final            → 'final'
 */

import type {
  Match, Group, GroupRow, Team, NewsItem,
  Stage, MatchState, Slot, TeamId,
} from '../lib/types';
import type {
  RawScoreboardResponse, RawStandingsResponse, RawNewsResponse,
  RawEvent, RawStandingsEntry,
} from './espn';

// ─── Stage slug mapping ───────────────────────────────────────────────────────

const SLUG_TO_STAGE: Record<string, Stage> = {
  'group-stage':     'group',
  'round-of-32':     'r32',
  'round-of-16':     'r16',
  'quarterfinals':   'qf',
  'semifinals':      'sf',
  '3rd-place-match': 'third',
  'final':           'final',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStat(entry: RawStandingsEntry, name: string): number {
  const s = entry.stats.find(st => st.name === name);
  return s ? s.value : 0;
}

function toNumber(v: string | number | undefined): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? undefined : n;
}

// ─── Teams from standings ─────────────────────────────────────────────────────

export function normalizeTeams(raw: RawStandingsResponse): Record<TeamId, Team> {
  const teams: Record<TeamId, Team> = {};
  for (const group of raw.children) {
    // group.name = "Group A", extract letter
    const groupLetter = group.name.replace('Group ', '').trim();
    for (const entry of group.standings.entries) {
      const t = entry.team;
      teams[t.id] = {
        id: t.id,
        name: t.displayName,
        code: t.abbreviation,
        flagUrl: t.logos?.[0]?.href ?? '',
        groupId: groupLetter,
      };
    }
  }
  return teams;
}

// ─── Groups from standings ────────────────────────────────────────────────────

export function normalizeGroups(raw: RawStandingsResponse): Group[] {
  return raw.children.map(group => {
    const id = group.name.replace('Group ', '').trim();
    const rows: GroupRow[] = group.standings.entries.map(entry => ({
      teamId: entry.team.id,
      played:    getStat(entry, 'gamesPlayed'),
      won:       getStat(entry, 'wins'),
      drawn:     getStat(entry, 'ties'),
      lost:      getStat(entry, 'losses'),
      gf:        getStat(entry, 'pointsFor'),
      ga:        getStat(entry, 'pointsAgainst'),
      gd:        getStat(entry, 'pointDifferential'),
      points:    getStat(entry, 'points'),
      rank:      getStat(entry, 'rank'),
      noteColor: entry.note?.color,
      noteDesc:  entry.note?.description,
    }));
    return { id, rows };
  });
}

// ─── Build team→group lookup from standings ───────────────────────────────────

function buildGroupLookup(raw: RawStandingsResponse): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of raw.children) {
    const letter = group.name.replace('Group ', '').trim();
    for (const entry of group.standings.entries) {
      map.set(entry.team.id, letter);
    }
  }
  return map;
}

// ─── Matches from scoreboard ──────────────────────────────────────────────────

export function normalizeMatches(
  raw: RawScoreboardResponse,
  standings: RawStandingsResponse,
): Match[] {
  const groupLookup = buildGroupLookup(standings);

  // First pass: collect all events with their stage, sort per-stage by date then id
  const events = raw.events;

  // Group events by stage
  const byStage = new Map<Stage, RawEvent[]>();
  for (const ev of events) {
    const stage = SLUG_TO_STAGE[ev.season.slug] ?? 'group';
    if (!byStage.has(stage)) byStage.set(stage, []);
    byStage.get(stage)!.push(ev);
  }

  // Sort each stage's events by date then id; assign ordinals
  const ordinalMap = new Map<string, number>();
  for (const [, stageEvents] of byStage) {
    stageEvents.sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc !== 0 ? dc : a.id.localeCompare(b.id);
    });
    stageEvents.forEach((ev, i) => ordinalMap.set(ev.id, i + 1));
  }

  return events.map(ev => {
    const comp = ev.competitions[0];
    const stage = SLUG_TO_STAGE[ev.season.slug] ?? 'group';
    const status = comp.status;
    const state: MatchState = status.type.state;

    // Build slots
    const homeComp = comp.competitors.find(c => c.homeAway === 'home') ?? comp.competitors[0];
    const awayComp = comp.competitors.find(c => c.homeAway === 'away') ?? comp.competitors[1];

    function toSlot(c: typeof homeComp): Slot {
      // Placeholder if team id is not in our group lookup AND it's a named placeholder
      const isPlaceholder =
        !groupLookup.has(c.team.id) ||
        /^(Group|Third Place|Round of|Quarterfinal|Semifinal)/i.test(c.team.displayName);
      if (isPlaceholder) {
        return { kind: 'placeholder', label: c.team.displayName };
      }
      return { kind: 'team', teamId: c.team.id };
    }

    // Derive group letter for group-stage matches
    let group: string | undefined;
    if (stage === 'group') {
      const homeId = homeComp.team.id;
      const awayId = awayComp.team.id;
      group = groupLookup.get(homeId) ?? groupLookup.get(awayId);
    }

    // Winner
    let winnerTeamId: TeamId | undefined;
    if (state === 'post') {
      const winner = comp.competitors.find(c => c.winner === true);
      if (winner && groupLookup.has(winner.team.id)) {
        winnerTeamId = winner.team.id;
      }
    }

    // Scores
    const homeScore = toNumber(homeComp.score);
    const awayScore = toNumber(awayComp.score);
    const homeShootout = toNumber(homeComp.shootoutScore);
    const awayShootout = toNumber(awayComp.shootoutScore);

    return {
      id: ev.id,
      date: ev.date,
      stage,
      group,
      ordinal: ordinalMap.get(ev.id) ?? 1,
      home: toSlot(homeComp),
      away: toSlot(awayComp),
      homeScore: homeScore !== undefined && !isNaN(homeScore) ? homeScore : undefined,
      awayScore: awayScore !== undefined && !isNaN(awayScore) ? awayScore : undefined,
      homeShootout: homeShootout !== undefined && !isNaN(homeShootout) ? homeShootout : undefined,
      awayShootout: awayShootout !== undefined && !isNaN(awayShootout) ? awayShootout : undefined,
      winnerTeamId,
      state,
      statusDetail: status.type.shortDetail,
      clock: status.displayClock,
      venueId: comp.venue.id,
      venueName: comp.venue.fullName,
      city: comp.venue.address.city,
    };
  });
}

// ─── News from articles ───────────────────────────────────────────────────────

export function normalizeNews(raw: RawNewsResponse): NewsItem[] {
  return raw.articles.map(article => {
    const img = article.images?.find(i => i.type === 'header') ?? article.images?.[0];
    return {
      id: String(article.id),
      headline: article.headline,
      description: article.description ?? '',
      published: article.published,
      imageUrl: img?.url,
      link: article.links.web?.href ?? '',
    };
  });
}

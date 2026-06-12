/**
 * espn.ts — typed raw fetchers for ESPN soccer API endpoints.
 * Raw types match the actual payload shape; see docs/api-samples/ for reference.
 */

// ─── Raw types ────────────────────────────────────────────────────────────────

export interface RawTeam {
  id: string;
  displayName: string;
  abbreviation: string;
  logos?: Array<{ href: string }>;
}

export interface RawCompetitor {
  id: string;
  homeAway: 'home' | 'away';
  score: string | number;
  winner?: boolean;
  shootoutScore?: string | number;
  team: RawTeam;
}

export interface RawStatusType {
  state: 'pre' | 'in' | 'post';
  completed: boolean;
  detail: string;
  shortDetail: string;
}

export interface RawStatus {
  clock?: number;
  displayClock?: string;
  type: RawStatusType;
}

export interface RawVenue {
  id: string;
  fullName: string;
  address: { city: string; country?: string };
}

export interface RawCompetition {
  id: string;
  date: string;
  status: RawStatus;
  venue: RawVenue;
  competitors: RawCompetitor[];
}

export interface RawSeason {
  year: number;
  slug: string;
}

export interface RawEvent {
  id: string;
  date: string;
  season: RawSeason;
  competitions: RawCompetition[];
}

export interface RawScoreboardResponse {
  events: RawEvent[];
}

// Standings raw types
export interface RawStat {
  name: string;
  value: number;
  displayValue: string;
}

export interface RawNote {
  color?: string;
  description?: string;
  rank?: number;
}

export interface RawStandingsEntry {
  team: RawTeam;
  note?: RawNote;
  stats: RawStat[];
}

export interface RawStandingsGroup {
  id: string;
  name: string;
  standings: {
    entries: RawStandingsEntry[];
  };
}

export interface RawStandingsResponse {
  children: RawStandingsGroup[];
}

// News raw types
export interface RawArticleImage {
  url: string;
  type?: string;
}

export interface RawArticleLinks {
  web?: { href: string };
}

export interface RawArticle {
  id: number;
  headline: string;
  description?: string;
  published: string;
  images?: RawArticleImage[];
  links: RawArticleLinks;
}

export interface RawNewsResponse {
  articles: RawArticle[];
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const ESPN_V2 = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world';

export async function fetchScoreboard(): Promise<RawScoreboardResponse> {
  const url = `${ESPN_BASE}/scoreboard?dates=20260611-20260719&limit=400`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Scoreboard fetch failed: ${res.status}`);
  return res.json() as Promise<RawScoreboardResponse>;
}

export async function fetchStandings(): Promise<RawStandingsResponse> {
  const url = `${ESPN_V2}/standings?season=2026`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Standings fetch failed: ${res.status}`);
  return res.json() as Promise<RawStandingsResponse>;
}

export async function fetchNews(): Promise<RawNewsResponse> {
  const url = `${ESPN_BASE}/news`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`News fetch failed: ${res.status}`);
  return res.json() as Promise<RawNewsResponse>;
}

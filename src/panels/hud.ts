/**
 * hud.ts — shared presentation helpers for the HUD panels (blueprint §3 / §1.4).
 *
 * Pure functions only (no React). Centralises placeholder-label shortening,
 * stage chip labels, score formatting, percentage formatting, and the §1.4
 * contextual-news relevance scorer so the panel components stay lean.
 */
import type { Match, NewsItem, Stage, Team } from '../lib/types';

// ── Stage labels ───────────────────────────────────────────────────────────────

/** Short stage chip, e.g. "GRP A", "R32", "FINAL". */
export function stageChip(m: Match): string {
  switch (m.stage) {
    case 'group': return `GRP ${m.group ?? ''}`.trim();
    case 'r32':   return 'R32';
    case 'r16':   return 'R16';
    case 'qf':    return 'QF';
    case 'sf':    return 'SF';
    case 'third': return '3RD';
    case 'final': return 'FINAL';
    default:      return String(m.stage).toUpperCase();
  }
}

/** Full stage name for headings. */
export function stageName(s: Stage | string): string {
  switch (s) {
    case 'group': return 'Group Stage';
    case 'r32':   return 'Round of 32';
    case 'r16':   return 'Round of 16';
    case 'qf':    return 'Quarterfinals';
    case 'sf':    return 'Semifinals';
    case 'final': return 'Final';
    case 'third': return '3rd Place';
    default:      return String(s).toUpperCase();
  }
}

// ── Placeholder shortening ─────────────────────────────────────────────────────

/**
 * Compress a raw ESPN placeholder displayName into a short chip:
 *   "Group A Winner"        → "A1"
 *   "Group A 2nd Place"     → "A2"
 *   "Third Place Group …"   → "3rd A–F"
 *   "Round of 32 9 Winner"  → "W·R32-9"
 */
export function shortenLabel(label: string): string {
  let m = label.match(/^Group ([A-L]) Winner$/i);
  if (m) return `${m[1]}1`;

  m = label.match(/^Group ([A-L]) 2nd Place$/i);
  if (m) return `${m[1]}2`;

  m = label.match(/^Third Place Group (.+)$/i);
  if (m) {
    const parts = m[1].split('/');
    if (parts.length > 3) return `3rd ${parts[0]}–${parts[parts.length - 1]}`;
    return `3rd ${m[1]}`;
  }

  m = label.match(/^Round of 32 (\d+) Winner$/i);
  if (m) return `W·R32-${m[1]}`;

  m = label.match(/^Round of 16 (\d+) Winner$/i);
  if (m) return `W·R16-${m[1]}`;

  m = label.match(/^Quarterfinal (\d+) Winner$/i);
  if (m) return `W·QF-${m[1]}`;

  m = label.match(/^Semifinal (\d+) Winner$/i);
  if (m) return `W·SF-${m[1]}`;

  return label.slice(0, 10);
}

// ── Numbers ────────────────────────────────────────────────────────────────────

/** Signed goal difference, e.g. "+3", "0", "-2". */
export function signedGD(gd: number): string {
  return gd > 0 ? `+${gd}` : String(gd);
}

/**
 * Probability → percent string (defect 8): 1 decimal below 10%, integer at/above.
 *   0.034 → "3.4%"   0.21 → "21%"
 */
export function formatPct(p: number): string {
  const v = p * 100;
  if (v < 10) return `${v.toFixed(1)}%`;
  return `${Math.round(v)}%`;
}

// ── Match helpers ──────────────────────────────────────────────────────────────

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

/** Same calendar day key (local), e.g. "2026-06-12", for day grouping. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export interface SlotView {
  code: string;
  flagUrl?: string;
  isPlaceholder: boolean;
}

/** Resolve a match slot to a display code + flag (team) or a shortened placeholder. */
export function slotView(slot: Match['home'], teams: Record<string, Team>): SlotView {
  if (slot.kind === 'team') {
    const team = teams[slot.teamId];
    return { code: team?.code ?? '?', flagUrl: team?.flagUrl, isPlaceholder: false };
  }
  return { code: shortenLabel(slot.label), isPlaceholder: true };
}

// ── Contextual news scoring (blueprint §1.4) ────────────────────────────────────

export interface NewsContext {
  /** Team names to look for in headline/description (the focused team, or all
   *  teams playing the focused venue). */
  teamNames: string[];
  /** City + stadium names (only for a venue focus). */
  placeNames: string[];
}

/**
 * Score one article against a context, EXACTLY per §1.4:
 *   3·(team name in headline) + 1·(team name in description)
 *   + 2·(city/stadium name in headline ∨ description)   (case-insensitive)
 */
export function scoreArticle(article: NewsItem, ctx: NewsContext): number {
  const head = article.headline.toLowerCase();
  const desc = (article.description ?? '').toLowerCase();
  let score = 0;
  for (const raw of ctx.teamNames) {
    const name = raw.toLowerCase().trim();
    if (!name) continue;
    if (head.includes(name)) score += 3;
    if (desc.includes(name)) score += 1;
  }
  for (const raw of ctx.placeNames) {
    const place = raw.toLowerCase().trim();
    if (!place) continue;
    if (head.includes(place) || desc.includes(place)) score += 2;
  }
  return score;
}

/**
 * Rank news for a context: score desc, take 4; if every score is 0, fall back to
 * the 4 most recent (news is already sorted newest-first by the store).
 */
export function contextualNews(news: NewsItem[], ctx: NewsContext, take = 4): NewsItem[] {
  const scored = news.map((a) => ({ a, s: scoreArticle(a, ctx) }));
  const anyHit = scored.some((x) => x.s > 0);
  if (!anyHit) return news.slice(0, take);
  return scored
    .map((x, i) => ({ ...x, i }))
    // stable: higher score first, then original (recency) order
    .sort((p, q) => (q.s - p.s) || (p.i - q.i))
    .slice(0, take)
    .map((x) => x.a);
}

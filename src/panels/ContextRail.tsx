/**
 * ContextRail.tsx — Right Rail "CONTEXT" (blueprint §1.4, defect 7).
 *
 * Three always-rendered, clearly-labeled stacked sections (each led by
 * <SectionHeading>), whose content adapts to the current focus
 * (store.focusVenueId wins, then useHud.focusTeamId, else a quiet default):
 *
 *   VENUE        — the focused stadium's identity (name / city / capacity), or a
 *                  quiet default (next upcoming match's venue + a hint).
 *   LIVE MATCHES — live matches first (live dot in the heading when any are live),
 *                  then the next upcoming, as equal-height MatchLine cards.
 *   RELATED NEWS — prominent image-led NewsRow cards, scored to the focus context
 *                  via contextualNews (scoring lives in hud.ts — frozen).
 *
 * The RailShell wrapper, auto-recede opacity, and data-active corner brackets are
 * preserved. Export name frozen: default `ContextRail`.
 */
import { useMemo } from 'react';
import { useWorldCup } from '../data/store';
import { useHud } from './uiStore';
import { FLOATING_PANEL } from './DataDeck';
import RailShell, { type RailIcon } from './RailShell';
import NewsRow from './NewsRow';
import { TriBar, Flag, SectionHeading, StatTag } from './bits';
import { contextualNews, slotView, stageChip, formatPct } from './hud';
import type { NewsContext } from './hud';
import type { Match, NewsItem, Stadium, Team } from '../lib/types';
import { kickoffTime } from '../lib/format';

// ── Shared match line ───────────────────────────────────────────────────────────

function MatchLine({ match }: { match: Match }) {
  const teams = useWorldCup((s) => s.teams);
  const predictions = useWorldCup((s) => s.predictions);
  const setFocusVenue = useWorldCup((s) => s.setFocusVenue);

  const isLive = match.state === 'in';
  const isPost = match.state === 'post';
  const showScore = isLive || isPost;

  const home = slotView(match.home, teams);
  const away = slotView(match.away, teams);
  const homeWin = isPost && match.winnerTeamId !== undefined
    && match.home.kind === 'team' && match.winnerTeamId === match.home.teamId;
  const awayWin = isPost && match.winnerTeamId !== undefined
    && match.away.kind === 'team' && match.winnerTeamId === match.away.teamId;

  const probs = predictions?.matchProbs?.[match.id];
  const showProbs = probs !== undefined && match.state !== 'post';

  const teamLine = (
    v: ReturnType<typeof slotView>,
    score: number | undefined,
    win: boolean,
  ) => (
    <div className="flex h-7 items-center gap-2">
      <Flag url={v.flagUrl} className="h-[12px] w-[18px]" />
      <span className={`min-w-0 flex-1 truncate font-display text-[12px] ${
        v.isPlaceholder ? 'italic text-dust/70' : win ? 'font-bold text-chalk' : 'text-chalk/85'
      }`}>
        {v.code}
      </span>
      <span className={`font-display text-[13px] font-bold tabular-nums ${win ? 'text-chalk' : 'text-dust'}`}>
        {showScore && score !== undefined ? score : '–'}
      </span>
    </div>
  );

  return (
    <button
      onClick={() => setFocusVenue(match.venueId)}
      className={`flex w-full flex-col gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04] ${
        isLive ? 'border-live/40 bg-live/[0.05]' : 'border-hairline'
      }`}
    >
      <div className="flex h-5 items-center gap-2">
        <span className="rounded-[3px] bg-white/[0.06] px-1.5 py-0.5 font-display text-[9px] font-semibold uppercase tracking-[0.14em] text-dust">
          {stageChip(match)}
        </span>
        {isLive ? (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-live">
            <span className="live-dot" aria-hidden="true" />
            {match.clock || match.statusDetail || 'LIVE'}
          </span>
        ) : isPost ? (
          <span className="ml-auto text-[10px] font-semibold uppercase text-dust">FT</span>
        ) : (
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.1em] text-dust">
            {kickoffTime(match.date)}
          </span>
        )}
      </div>
      {teamLine(home, match.homeScore, homeWin)}
      {teamLine(away, match.awayScore, awayWin)}
      {showProbs && <TriBar probs={probs} />}
    </button>
  );
}

// ── Section: VENUE ───────────────────────────────────────────────────────────────

/** Stadium identity block: name (~16px sub-title) → city → capacity. */
function StadiumIdentity({ stadium }: { stadium: Stadium }) {
  return (
    <div className="rounded-lg border border-hairline bg-white/[0.02] p-3">
      <div className="font-display text-[9px] font-semibold uppercase tracking-[0.18em] text-neon">
        {stadium.country} · Host Venue
      </div>
      <div className="mt-1 font-display text-[16px] font-bold leading-tight text-chalk">
        {stadium.name}
      </div>
      <div className="mt-0.5 text-[12px] text-dust">
        {stadium.city} · <span className="tabular-nums">{stadium.capacity.toLocaleString()}</span> cap
      </div>
    </div>
  );
}

/** Team identity block (shown in the VENUE slot when a team — not a venue — is focused). */
function TeamIdentity({ team, elo, pChampion }: {
  team: Team;
  elo?: number;
  pChampion?: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-hairline bg-white/[0.02] p-3">
      <Flag url={team.flagUrl} className="h-[26px] w-[38px]" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[16px] font-bold leading-tight text-chalk">
          {team.name}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-dust">
          {elo !== undefined && (
            <span>
              Elo <span className="font-display font-bold tabular-nums text-chalk/90">{Math.round(elo)}</span>
            </span>
          )}
          {pChampion !== undefined && (
            <span>
              Champ <span className="font-display font-bold tabular-nums text-gold">{formatPct(pChampion)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────────

function ClearFooter({ onClear, label }: { onClear: () => void; label: string }) {
  return (
    <button
      onClick={onClear}
      className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-hairline py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-dust transition-colors hover:border-neon/40 hover:text-neon"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      Clear {label}
    </button>
  );
}

// ── Resolved context (the single adaptive body) ──────────────────────────────────

interface RailContext {
  /** What to render in the VENUE section. */
  venue: React.ReactNode;
  /** Match cards for LIVE MATCHES (live first, then next upcoming). */
  matches: Match[];
  /** Whether any of those matches is live (drives the heading live dot). */
  anyLive: boolean;
  /** Pre-scored news for RELATED NEWS. */
  news: NewsItem[];
  /** Optional clear-focus footer. */
  footer?: React.ReactNode;
}

/** Live matches first, then the single next upcoming kickoff. */
function liveThenNext(matches: Match[]): { list: Match[]; anyLive: boolean } {
  const live = matches.filter((m) => m.state === 'in');
  const next = matches
    .filter((m) => m.state === 'pre')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, live.length > 0 ? 1 : 3);
  return { list: [...live, ...next], anyLive: live.length > 0 };
}

function useRailContext(
  focusVenueId: string | null,
  focusTeamId: string | null,
): RailContext {
  const stadiums = useWorldCup((s) => s.stadiums);
  const matches = useWorldCup((s) => s.matches);
  const teams = useWorldCup((s) => s.teams);
  const news = useWorldCup((s) => s.news);
  const predictions = useWorldCup((s) => s.predictions);
  const setFocusVenue = useWorldCup((s) => s.setFocusVenue);
  const setFocusTeam = useHud((s) => s.setFocusTeam);

  return useMemo<RailContext>(() => {
    // ── Venue focus wins ──────────────────────────────────────────────────────
    if (focusVenueId) {
      const stadium = stadiums.find((s) => s.venueId === focusVenueId);
      const venueMatches = matches
        .filter((m) => m.venueId === focusVenueId)
        .sort((a, b) => a.date.localeCompare(b.date));
      const { list, anyLive } = liveThenNext(venueMatches);

      let scoredNews: NewsItem[];
      if (!stadium) {
        scoredNews = news.slice(0, 4);
      } else {
        const teamNames = new Set<string>();
        for (const m of venueMatches) {
          if (m.home.kind === 'team') teamNames.add(teams[m.home.teamId]?.name ?? '');
          if (m.away.kind === 'team') teamNames.add(teams[m.away.teamId]?.name ?? '');
        }
        const ctx: NewsContext = {
          teamNames: [...teamNames].filter(Boolean),
          placeNames: [stadium.city, stadium.name].filter(Boolean),
        };
        scoredNews = contextualNews(news, ctx);
      }

      return {
        venue: stadium ? (
          <StadiumIdentity stadium={stadium} />
        ) : (
          <div className="rounded-lg border border-hairline bg-white/[0.02] p-3 text-[12px] text-dust">
            Venue not found.
          </div>
        ),
        // Venue matches can be a wider window than live+next; show all of them.
        matches: list.length > 0 ? list : venueMatches,
        anyLive,
        news: scoredNews,
        footer: <ClearFooter onClear={() => setFocusVenue(null)} label="venue" />,
      };
    }

    // ── Team focus (no venue) ─────────────────────────────────────────────────
    if (focusTeamId) {
      const team = teams[focusTeamId];
      const teamMatches = matches
        .filter(
          (m) =>
            (m.home.kind === 'team' && m.home.teamId === focusTeamId) ||
            (m.away.kind === 'team' && m.away.teamId === focusTeamId),
        )
        .sort((a, b) => a.date.localeCompare(b.date));
      const { list, anyLive } = liveThenNext(teamMatches);
      // Fall back to upcoming/remaining fixtures if nothing live or pending soon.
      const upcoming = teamMatches.filter((m) => m.state !== 'post');

      const scoredNews = team
        ? contextualNews(news, { teamNames: [team.name], placeNames: [] })
        : news.slice(0, 4);

      return {
        venue: team ? (
          <TeamIdentity
            team={team}
            elo={predictions?.elo?.[focusTeamId]}
            pChampion={predictions?.outlooks?.[focusTeamId]?.pChampion}
          />
        ) : (
          <div className="rounded-lg border border-hairline bg-white/[0.02] p-3 text-[12px] text-dust">
            Team not found.
          </div>
        ),
        matches: list.length > 0 ? list : upcoming.slice(0, 3),
        anyLive,
        news: scoredNews,
        footer: <ClearFooter onClear={() => setFocusTeam(null)} label="team" />,
      };
    }

    // ── Quiet default (nothing focused) ───────────────────────────────────────
    const { list, anyLive } = liveThenNext(matches);
    // Surface the next upcoming match's venue as a gentle default identity.
    const nextUpcoming = matches
      .filter((m) => m.state === 'pre')
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const defaultStadium = nextUpcoming
      ? stadiums.find((s) => s.venueId === nextUpcoming.venueId)
      : undefined;

    return {
      venue: defaultStadium ? (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dust">
            Select a venue on the map
          </div>
          <StadiumIdentity stadium={defaultStadium} />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-hairline bg-white/[0.02] p-4 text-center text-[12px] text-dust">
          Select a venue on the map to see its details.
        </div>
      ),
      matches: list,
      anyLive,
      news: news.slice(0, 4),
    };
  }, [
    focusVenueId,
    focusTeamId,
    stadiums,
    matches,
    teams,
    news,
    predictions,
    setFocusVenue,
    setFocusTeam,
  ]);
}

// ── Shell ─────────────────────────────────────────────────────────────────────

const CONTEXT_ICONS: RailIcon[] = [
  {
    key: 'context',
    label: 'Context',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="8" cy="8" r="1.6" fill="currentColor" />
      </svg>
    ),
  },
];

function ContextPanel() {
  const focusVenueId = useWorldCup((s) => s.focusVenueId);
  const focusTeamId = useHud((s) => s.focusTeamId);

  const ctx = useRailContext(focusVenueId, focusTeamId);

  // Venue focus wins if both are set.
  const heading = focusVenueId ? 'VENUE' : focusTeamId ? 'TEAM' : 'NOW & NEXT';

  // Auto-recede: when nothing is focused the rail dims so the map leads; a focus
  // (venue/team) makes its content the active context, so it asserts fully. Hover
  // / keyboard focus always assert.
  const asserted = Boolean(focusVenueId || focusTeamId);
  const swapKey = focusVenueId ?? focusTeamId ?? 'now';

  return (
    <section
      className={`hud-corners relative flex h-full flex-col overflow-hidden transition-opacity duration-300 ease-[var(--ease-hud)] hover:opacity-100 focus-within:opacity-100 ${asserted ? 'opacity-100' : 'opacity-[0.72]'} ${FLOATING_PANEL}`}
      aria-label="Context"
      data-active={asserted ? 'true' : undefined}
    >
      <div className="shrink-0 border-b border-hairline px-4 py-3 font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-dust">
        {heading}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div key={swapKey} className="hud-swap flex flex-col gap-5 p-3.5">
          {/* VENUE */}
          <section>
            <SectionHeading>Venue</SectionHeading>
            {ctx.venue}
          </section>

          {/* LIVE MATCHES */}
          <section>
            <SectionHeading
              action={ctx.anyLive ? <StatTag tone="live">Live</StatTag> : undefined}
            >
              Live Matches
            </SectionHeading>
            <div className="flex flex-col gap-2">
              {ctx.matches.length > 0 ? (
                ctx.matches.map((m) => <MatchLine key={m.id} match={m} />)
              ) : (
                <div className="rounded-lg border border-hairline bg-white/[0.02] px-3 py-4 text-center text-[11px] text-dust">
                  No live or upcoming matches.
                </div>
              )}
            </div>
          </section>

          {/* RELATED NEWS — prominent, image-led */}
          <section>
            <SectionHeading>Related News</SectionHeading>
            <NewsRow items={ctx.news} />
          </section>

          {ctx.footer}
        </div>
      </div>
    </section>
  );
}

export default function ContextRail() {
  return (
    <RailShell side="right" icons={CONTEXT_ICONS}>
      <ContextPanel />
    </RailShell>
  );
}

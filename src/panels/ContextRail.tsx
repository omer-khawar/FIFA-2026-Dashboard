/**
 * ContextRail.tsx — Right Rail "CONTEXT" (blueprint §1.4, defect 7).
 *
 * A single stateful panel driven by store.focusVenueId + useHud.focusTeamId
 * (venue focus wins if both; ✕ clears via setFocusVenue(null)/setFocusTeam(null)):
 *   Default "NOW & NEXT" — live matches w/ tri-bars, next 3 kickoffs, 3 headlines.
 *   Venue focus       — stadium identity block, that venue's matches, contextual news.
 *   Team focus        — team header (flag, name, Elo, pChampion), remaining fixtures,
 *                       contextual news.
 * Contextual news scoring is §1.4 exactly (see hud.ts). The old bottom news band
 * is gone. Export name frozen: default `ContextRail`.
 */
import { useMemo } from 'react';
import { useWorldCup } from '../data/store';
import { useHud } from './uiStore';
import { FLOATING_PANEL } from './DataDeck';
import RailShell, { type RailIcon } from './RailShell';
import NewsRow from './NewsRow';
import { TriBar, Flag, SectionLabel } from './bits';
import { contextualNews, slotView, stageChip, formatPct } from './hud';
import type { NewsContext } from './hud';
import type { Match } from '../lib/types';
import { kickoffTime, dateLabel } from '../lib/format';

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
    <div className="flex items-center gap-2">
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
      className={`flex w-full flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04] ${
        isLive ? 'border-live/40 bg-live/[0.05]' : 'border-hairline'
      }`}
    >
      <div className="flex items-center gap-2">
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

// ── State: NOW & NEXT (default) ──────────────────────────────────────────────────

function NowAndNext() {
  const matches = useWorldCup((s) => s.matches);
  const news = useWorldCup((s) => s.news);

  const { live, next3 } = useMemo(() => {
    const live = matches.filter((m) => m.state === 'in');
    const next3 = matches
      .filter((m) => m.state === 'pre')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
    return { live, next3 };
  }, [matches]);

  const headlines = news.slice(0, 3);

  return (
    <div className="flex flex-col gap-1 p-2">
      {live.length > 0 && (
        <>
          <SectionLabel>Live Now</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {live.map((m) => <MatchLine key={m.id} match={m} />)}
          </div>
        </>
      )}

      <SectionLabel>Next Up</SectionLabel>
      <div className="flex flex-col gap-1.5">
        {next3.length > 0 ? (
          next3.map((m) => <MatchLine key={m.id} match={m} />)
        ) : (
          <div className="px-1 text-[11px] text-dust">No upcoming fixtures.</div>
        )}
      </div>

      <SectionLabel>Headlines</SectionLabel>
      <NewsRow items={headlines} />
    </div>
  );
}

// ── State: Venue focus ───────────────────────────────────────────────────────────

function VenueFocus({ venueId }: { venueId: string }) {
  const stadiums = useWorldCup((s) => s.stadiums);
  const matches = useWorldCup((s) => s.matches);
  const teams = useWorldCup((s) => s.teams);
  const news = useWorldCup((s) => s.news);
  const setFocusVenue = useWorldCup((s) => s.setFocusVenue);

  const stadium = stadiums.find((s) => s.venueId === venueId);

  const venueMatches = useMemo(
    () =>
      matches
        .filter((m) => m.venueId === venueId)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [matches, venueId],
  );

  const relevantNews = useMemo(() => {
    if (!stadium) return news.slice(0, 4);
    // Relevant team names = all teams playing at this venue.
    const teamNames = new Set<string>();
    for (const m of venueMatches) {
      if (m.home.kind === 'team') teamNames.add(teams[m.home.teamId]?.name ?? '');
      if (m.away.kind === 'team') teamNames.add(teams[m.away.teamId]?.name ?? '');
    }
    const ctx: NewsContext = {
      teamNames: [...teamNames].filter(Boolean),
      placeNames: [stadium.city, stadium.name].filter(Boolean),
    };
    return contextualNews(news, ctx);
  }, [news, stadium, venueMatches, teams]);

  if (!stadium) {
    return (
      <div className="p-3 text-[11px] text-dust">Venue not found.</div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {/* Stadium identity block */}
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

      <SectionLabel>
        {venueMatches.length} {venueMatches.length === 1 ? 'Match' : 'Matches'}
      </SectionLabel>
      <div className="flex flex-col gap-1.5">
        {venueMatches.length > 0 ? (
          venueMatches.map((m) => <MatchLine key={m.id} match={m} />)
        ) : (
          <div className="px-1 text-[11px] text-dust">No matches scheduled yet.</div>
        )}
      </div>

      <SectionLabel>Related News</SectionLabel>
      <NewsRow items={relevantNews} />

      <ClearFooter onClear={() => setFocusVenue(null)} label="venue" />
    </div>
  );
}

// ── State: Team focus ────────────────────────────────────────────────────────────

function TeamFocus({ teamId }: { teamId: string }) {
  const team = useWorldCup((s) => s.teams[teamId]);
  const matches = useWorldCup((s) => s.matches);
  const predictions = useWorldCup((s) => s.predictions);
  const news = useWorldCup((s) => s.news);
  const setFocusTeam = useHud((s) => s.setFocusTeam);

  const remaining = useMemo(
    () =>
      matches
        .filter(
          (m) =>
            m.state !== 'post' &&
            ((m.home.kind === 'team' && m.home.teamId === teamId) ||
              (m.away.kind === 'team' && m.away.teamId === teamId)),
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [matches, teamId],
  );

  const relevantNews = useMemo(() => {
    if (!team) return news.slice(0, 4);
    const ctx: NewsContext = { teamNames: [team.name], placeNames: [] };
    return contextualNews(news, ctx);
  }, [news, team]);

  if (!team) {
    return <div className="p-3 text-[11px] text-dust">Team not found.</div>;
  }

  const elo = predictions?.elo?.[teamId];
  const pChampion = predictions?.outlooks?.[teamId]?.pChampion;

  return (
    <div className="flex flex-col gap-1 p-2">
      {/* Team header */}
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

      <SectionLabel>Remaining Fixtures</SectionLabel>
      <div className="flex flex-col gap-1.5">
        {remaining.length > 0 ? (
          remaining.slice(0, 6).map((m) => <FixtureLine key={m.id} match={m} teamId={teamId} />)
        ) : (
          <div className="px-1 text-[11px] text-dust">No remaining fixtures.</div>
        )}
      </div>

      <SectionLabel>Related News</SectionLabel>
      <NewsRow items={relevantNews} />

      <ClearFooter onClear={() => setFocusTeam(null)} label="team" />
    </div>
  );
}

/** Compact fixture row for the team view (opponent + date + venue). */
function FixtureLine({ match, teamId }: { match: Match; teamId: string }) {
  const teams = useWorldCup((s) => s.teams);
  const setFocusVenue = useWorldCup((s) => s.setFocusVenue);

  const isHome = match.home.kind === 'team' && match.home.teamId === teamId;
  const oppSlot = isHome ? match.away : match.home;
  const opp = slotView(oppSlot, teams);

  return (
    <button
      onClick={() => setFocusVenue(match.venueId)}
      className="flex w-full items-center gap-2 rounded-lg border border-hairline px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
    >
      <span className="rounded-[3px] bg-white/[0.06] px-1.5 py-0.5 font-display text-[9px] font-semibold uppercase tracking-[0.14em] text-dust">
        {stageChip(match)}
      </span>
      <span className="text-[10px] text-dust">{isHome ? 'vs' : '@'}</span>
      <Flag url={opp.flagUrl} className="h-[11px] w-[16px]" />
      <span className={`min-w-0 flex-1 truncate font-display text-[12px] ${opp.isPlaceholder ? 'italic text-dust/70' : 'text-chalk/85'}`}>
        {opp.code}
      </span>
      <span className="text-[10px] tabular-nums text-dust">{dateLabel(match.date)}</span>
    </button>
  );
}

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

  // Venue focus wins if both are set.
  const mode: 'venue' | 'team' | 'now' = focusVenueId
    ? 'venue'
    : focusTeamId
      ? 'team'
      : 'now';

  const heading = mode === 'venue' ? 'VENUE' : mode === 'team' ? 'TEAM' : 'NOW & NEXT';

  // Auto-recede: when nothing is focused the rail dims so the map leads; a focus
  // (venue/team) makes its content the active context, so it asserts fully. Hover
  // / keyboard focus always assert.
  const asserted = mode !== 'now';

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
        <div key={mode + (focusVenueId ?? focusTeamId ?? '')} className="hud-swap">
          {mode === 'venue' && <VenueFocus venueId={focusVenueId!} />}
          {mode === 'team' && <TeamFocus teamId={focusTeamId!} />}
          {mode === 'now' && <NowAndNext />}
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

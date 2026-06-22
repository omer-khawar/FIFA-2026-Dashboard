/**
 * TickerDock.tsx — bottom Ticker Dock (blueprint §1.5, defect 2).
 *
 * Horizontal scroll strip, order LIVE → today → upcoming (then recent finished if
 * thin). Auto-scrolls to the first live card on mount. Each card (212px,
 * snap-align start): chip row (stage/group + city), two team rows (24px flag,
 * code in display face, score for in|post, "–" for pre — DEFECT 2), tri-bar
 * footer when probs exist; live cards get border-live/40 + a pulse-live ring.
 * Click → setFocusVenue(match.venueId) (the map flies there).
 *
 * PLUS the snap-sheet: a chevron handle expands the dock to a 58vh z-20 overlay
 * (height transition 280ms) listing ALL 104 matches grouped by day with a
 * 2-column layout: LEFT = scrollable match list, RIGHT = Calendar side panel.
 * Chevron / Esc collapses. Wired via useHud dockOpen.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorldCup } from '../data/store';
import { useHud } from './uiStore';
import { TriBar, Flag } from './bits';
import { slotView, stageChip, dayKey } from './hud';
import { kickoffTime, dateLabel } from '../lib/format';
import type { Match } from '../lib/types';
import Calendar from './Calendar';

// Collapsed dock geometry — a fixed 3-card window (no scroll); arrows page by 3.
const CARD_W = 212; // px, one match card
const CARD_GAP = 12; // px, gap between cards (gap-3)
const VISIBLE = 3; // cards shown at once
const STEP = CARD_W + CARD_GAP; // translate distance per card
const TRACK_W = VISIBLE * CARD_W + (VISIBLE - 1) * CARD_GAP; // exact 3-card viewport

// ── Collapsed strip card — symmetric, grid-aligned (home | center | away) ─────

/** Circular flag: the rectangular source cropped into a disc, like the reference. */
function CircleFlag({ url }: { url?: string }) {
  return url ? (
    <img
      src={url}
      alt=""
      loading="lazy"
      className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/15"
    />
  ) : (
    <span className="h-9 w-9 shrink-0 rounded-full bg-white/[0.07] ring-1 ring-white/15" />
  );
}

function TickerCard({ match, prominent = false }: { match: Match; prominent?: boolean }) {
  const teams = useWorldCup((s) => s.teams);
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

  // Real score only for live/finished — never fabricate one for upcoming matches.
  const score = showScore && match.homeScore !== undefined && match.awayScore !== undefined
    ? `${match.homeScore} - ${match.awayScore}`
    : null;

  const code = (v: ReturnType<typeof slotView>, win: boolean) => (
    <span className={`max-w-full truncate font-display text-[13px] font-semibold tracking-wide ${
      v.isPlaceholder ? 'italic text-dust/70' : win ? 'text-chalk' : 'text-chalk/85'
    }`}>
      {v.code}
    </span>
  );

  return (
    <button
      data-live={isLive || undefined}
      onClick={() => setFocusVenue(match.venueId)}
      title={`${match.venueName} · ${match.city}`}
      style={{ width: CARD_W }}
      className={`grid h-[112px] shrink-0 origin-center grid-cols-[1fr_auto_1fr] grid-rows-[auto_1fr_auto] items-center justify-items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2.5 text-left transition-[transform,background-color,border-color,box-shadow] duration-[280ms] ease-[var(--ease-hud)] hover:bg-white/[0.06] ${
        prominent
          ? 'z-10 scale-[1.05] border-live/60 bg-live/[0.06] shadow-[0_0_26px_-6px_rgb(255_70_85/0.65)]'
          : isLive
            ? 'border-live/40 bg-white/[0.03]'
            : 'border-hairline bg-white/[0.03]'
      }`}
    >
      {/* Row 1 — status, centered across all three columns */}
      <div className="col-span-3 flex items-center justify-center gap-1.5 leading-none">
        {isLive ? (
          <>
            <span className="live-dot" aria-hidden="true" />
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-live">
              {match.clock || 'Live'}
            </span>
          </>
        ) : (
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-dust">
            {isPost ? 'Full Time' : 'Upcoming'}
          </span>
        )}
      </div>

      {/* Row 2 — home flag · kickoff time · away flag (all on one line) */}
      <CircleFlag url={home.flagUrl} />
      <span className="font-display text-[18px] font-bold leading-none tabular-nums text-chalk">
        {kickoffTime(match.date)}
      </span>
      <CircleFlag url={away.flagUrl} />

      {/* Row 3 — home code · score pill (or “vs”) · away code, aligned under row 2 */}
      {code(home, homeWin)}
      {score ? (
        <span className="rounded-full bg-white/[0.08] px-2.5 py-[3px] font-display text-[12px] font-bold leading-none tabular-nums text-chalk ring-1 ring-white/10">
          {score}
        </span>
      ) : (
        <span className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-dust/55">vs</span>
      )}
      {code(away, awayWin)}
    </button>
  );
}

// ── Expanded sheet card (large) ───────────────────────────────────────────────

function SheetCard({ match }: { match: Match }) {
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

  const row = (
    v: ReturnType<typeof slotView>,
    score: number | undefined,
    win: boolean,
  ) => (
    <div className="flex items-center gap-2">
      <Flag url={v.flagUrl} className="h-5 w-7 shrink-0" />
      <span className={`min-w-0 flex-1 truncate font-display text-[14px] ${
        v.isPlaceholder ? 'italic text-dust/70' : win ? 'font-bold text-chalk' : 'text-chalk/85'
      }`}>
        {v.code}
      </span>
      <span className={`font-display text-[15px] font-bold tabular-nums shrink-0 ${win ? 'text-chalk' : 'text-dust'}`}>
        {showScore && score !== undefined ? score : '–'}
      </span>
    </div>
  );

  return (
    <button
      data-live={isLive || undefined}
      onClick={() => setFocusVenue(match.venueId)}
      title={`${match.venueName} · ${match.city}`}
      className={`flex w-full flex-col justify-between rounded-lg border bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05] ${
        isLive
          ? 'border-live/40 animate-[pulse-live_1.6s_ease-in-out_infinite]'
          : 'border-hairline'
      }`}
    >
      {/* chip row */}
      <div className="mb-2 flex items-center gap-1.5 overflow-hidden">
        <span className="shrink-0 whitespace-nowrap rounded-[3px] bg-white/[0.06] px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-dust">
          {stageChip(match)}
        </span>
        <span className="min-w-0 truncate text-[10px] uppercase tracking-[0.1em] text-dust/80">
          {match.city}
        </span>
        {isLive ? (
          <span className="ml-auto shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-live">
            <span className="live-dot" aria-hidden="true" />
            {match.clock || 'LIVE'}
          </span>
        ) : isPost ? (
          <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase text-dust">FT</span>
        ) : (
          <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-dust">
            {kickoffTime(match.date)}
          </span>
        )}
      </div>

      {/* two team rows */}
      <div className="flex flex-col gap-1">
        {row(home, match.homeScore, homeWin)}
        {row(away, match.awayScore, awayWin)}
      </div>

      {/* tri-bar + win% numbers */}
      {showProbs && probs ? (
        <div className="mt-2.5">
          <TriBar probs={probs} />
          <div className="mt-1 flex justify-between text-[10px] tabular-nums">
            <span className="text-neon">{Math.round(probs.pHome * 100)}%</span>
            <span className="text-chalk/60">{Math.round(probs.pDraw * 100)}%</span>
            <span className="text-ember">{Math.round(probs.pAway * 100)}%</span>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 h-1" />
      )}
    </button>
  );
}

// ── Ordering — chronological window with a live game centred ──────────────────

function useOrderedMatches(): { ordered: Match[]; anchorStart: number } {
  const matches = useWorldCup((s) => s.matches);
  return useMemo(() => {
    const byDate = (a: Match, b: Match) => a.date.localeCompare(b.date);
    const finished = matches.filter((m) => m.state === 'post').sort(byDate);
    const live = matches.filter((m) => m.state === 'in').sort(byDate);
    const upcoming = matches.filter((m) => m.state === 'pre').sort(byDate);
    // A few most-recent finished sit to the LEFT so a live game can be centred with
    // the latest result on its left and the next kickoff on its right.
    const recentFinished = finished.slice(-6);
    const ordered = [...recentFinished, ...live, ...upcoming];

    const maxStart = Math.max(0, ordered.length - VISIBLE);
    const liveIndex = ordered.findIndex((m) => m.state === 'in');
    let anchorStart: number;
    if (liveIndex >= 0) {
      // Centre the (first) live game in the 3-card window.
      anchorStart = Math.min(Math.max(liveIndex - 1, 0), maxStart);
    } else {
      // No live game → start at the next upcoming, in chronological order.
      const firstPre = ordered.findIndex((m) => m.state === 'pre');
      anchorStart = Math.min(Math.max(firstPre >= 0 ? firstPre : 0, 0), maxStart);
    }
    return { ordered, anchorStart };
  }, [matches]);
}

// ── Snap-sheet (all 104, grouped by day) — 2-column layout ──────────────────

function FullSchedule() {
  const matches = useWorldCup((s) => s.matches);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const days = useMemo(() => {
    const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));
    const map = new Map<string, Match[]>();
    for (const m of sorted) {
      const k = dayKey(m.date);
      const arr = map.get(k);
      if (arr) arr.push(m);
      else map.set(k, [m]);
    }
    return [...map.entries()].map(([key, ms]) => ({ key, label: dateLabel(ms[0].date), matches: ms }));
  }, [matches]);

  const jump = (key: string) => {
    setSelectedKey(key);
    document.getElementById(`day-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* LEFT — day-grouped match listings */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
      >
        {days.map((d) => (
          <div key={d.key} id={`day-${d.key}`} className="mb-4 scroll-mt-2">
            <div className="sticky top-0 z-10 mb-2 bg-glass/80 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-chalk/80 backdrop-blur-sm">
              {d.label}
              <span className="ml-2 text-[10px] tabular-nums text-dust">{d.matches.length}</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
              {d.matches.map((m) => (
                <SheetCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* RIGHT — Calendar side panel */}
      <div className="w-[340px] shrink-0 overflow-y-auto overscroll-contain border-l border-hairline py-2">
        <Calendar matches={matches} selectedKey={selectedKey} onSelect={jump} />
      </div>
    </div>
  );
}

// ── Strip nav arrow ───────────────────────────────────────────────────────────

/** Prev/next arrow flanking the collapsed window; pages the cards by 3. Its height
 *  matches the match cards so it reads as part of the row. */
function StripArrow({ dir, disabled, onClick }: { dir: -1 | 1; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir < 0 ? 'Previous matches' : 'Next matches'}
      className="grid h-[112px] w-9 shrink-0 place-items-center self-center rounded-xl border border-hairline bg-white/[0.03] text-dust transition-colors hover:border-neon/40 hover:text-neon disabled:cursor-default disabled:opacity-25 disabled:hover:border-hairline disabled:hover:text-dust"
    >
      <svg width="15" height="15" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d={dir < 0 ? 'M7.5 2.5 4 6l3.5 3.5' : 'M4.5 2.5 8 6l-3.5 3.5'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// ── Dock shell ────────────────────────────────────────────────────────────────

export default function TickerDock() {
  const { ordered, anchorStart } = useOrderedMatches();
  const dockOpen = useHud((s) => s.dockOpen);
  const setDockOpen = useHud((s) => s.setDockOpen);
  // Until the user pages, the window follows the anchor (auto-centres a live game);
  // after paging we honour their position (clamped to range).
  const [windowStart, setWindowStart] = useState<number | null>(null);

  const maxStart = Math.max(0, ordered.length - VISIBLE);
  const start = Math.min(Math.max(windowStart ?? anchorStart, 0), maxStart);
  const canLeft = start > 0;
  const canRight = start < maxStart;
  const page = (dir: number) =>
    setWindowStart(Math.min(Math.max(start + dir * VISIBLE, 0), maxStart));

  // Esc collapses the sheet.
  useEffect(() => {
    if (!dockOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDockOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dockOpen, setDockOpen]);

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      {/* Backdrop when the sheet is open */}
      {dockOpen && (
        <div
          className="pointer-events-auto fixed inset-0 z-10 bg-void/50 backdrop-blur-sm"
          onClick={() => setDockOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* The dock surface — a centered pill floating over the map's bottom edge when
          collapsed, a wide sheet when expanded. The wrapper is pointer-events-none so
          the map shows/clicks through around it; the surface itself re-enables them. */}
      <div
        className={`pointer-events-auto absolute bottom-6 z-20 flex flex-col overflow-hidden rounded-2xl border border-hairline bg-glass backdrop-blur-xl shadow-[0_8px_40px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.04)] transition-[height] duration-[280ms] ease-[var(--ease-hud)] ${
          dockOpen
            ? 'left-[68px] right-3 h-[58vh]'
            : 'left-1/2 -translate-x-1/2 w-fit max-w-[calc(100%-88px)] h-[156px]'
        }`}
      >
        {/* Handle / header — the title only shows in the enlarged menu; the collapsed
            bar is self-explanatory, so it carries just the grab-handle + chevron. */}
        <button
          onClick={() => setDockOpen(!dockOpen)}
          aria-label={dockOpen ? 'Collapse schedule' : 'Expand schedule'}
          aria-expanded={dockOpen}
          className={`group flex shrink-0 items-center gap-2 px-3 pb-1 pt-1.5 ${dockOpen ? '' : 'justify-center'}`}
        >
          {dockOpen && (
            <span className="font-display text-[13px] font-bold uppercase tracking-[0.16em] text-chalk/85">
              All Matches
            </span>
          )}
          <span className={`h-1 w-10 rounded-full bg-white/10 transition-colors group-hover:bg-white/20 ${dockOpen ? 'mx-auto' : ''}`} aria-hidden="true" />
          <span className={`text-dust transition-transform duration-200 ${dockOpen ? '' : 'rotate-180'}`} aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 7.5L6 4.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        {dockOpen ? (
          <FullSchedule />
        ) : (
          <div className="flex min-h-0 flex-1 items-center gap-2 px-3 pb-3">
            <StripArrow dir={-1} disabled={!canLeft} onClick={() => page(-1)} />
            {/* Fixed 3-card viewport — overflow-x:clip means NO scrollbar; the row
                translates to page, and the centred live card may scale past the top
                (overflow-y stays visible). */}
            <div className="relative shrink-0 [overflow-x:clip]" style={{ width: TRACK_W }}>
              {ordered.length === 0 ? (
                <div className="flex h-[112px] items-center justify-center text-[12px] text-dust">
                  No matches to display
                </div>
              ) : (
                <div
                  className="flex gap-3 transition-transform duration-[320ms] ease-[var(--ease-hud)]"
                  style={{ transform: `translateX(-${start * STEP}px)` }}
                >
                  {ordered.map((m, idx) => (
                    <TickerCard key={m.id} match={m} prominent={m.state === 'in' && idx === start + 1} />
                  ))}
                </div>
              )}
            </div>
            <StripArrow dir={1} disabled={!canRight} onClick={() => page(1)} />
          </div>
        )}
      </div>
    </div>
  );
}

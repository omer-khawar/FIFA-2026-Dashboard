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
import { slotView, stageChip, isToday, dayKey } from './hud';
import { kickoffTime, dateLabel } from '../lib/format';
import type { Match } from '../lib/types';
import Calendar from './Calendar';

// ── Collapsed strip card (small) ─────────────────────────────────────────────

function TickerCard({ match }: { match: Match }) {
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
    <div className="flex items-center gap-1.5">
      <Flag url={v.flagUrl} className="h-4 w-6 shrink-0" />
      <span className={`min-w-0 flex-1 truncate font-display text-[13px] ${
        v.isPlaceholder ? 'italic text-dust/70' : win ? 'font-bold text-chalk' : 'text-chalk/85'
      }`}>
        {v.code}
      </span>
      <span className={`font-display text-[14px] font-bold tabular-nums shrink-0 ${win ? 'text-chalk' : 'text-dust'}`}>
        {showScore && score !== undefined ? score : '–'}
      </span>
    </div>
  );

  return (
    <button
      data-live={isLive || undefined}
      onClick={() => setFocusVenue(match.venueId)}
      title={`${match.venueName} · ${match.city}`}
      className={`flex h-[100px] w-[212px] shrink-0 flex-col justify-between rounded-lg border bg-white/[0.02] px-2.5 py-2 text-left transition-colors [scroll-snap-align:start] hover:bg-white/[0.05] ${
        isLive
          ? 'border-live/40 animate-[pulse-live_1.6s_ease-in-out_infinite]'
          : 'border-hairline'
      }`}
    >
      {/* chip row */}
      <div className="flex items-center gap-1.5 overflow-hidden">
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
      <div className="flex flex-col gap-0.5">
        {row(home, match.homeScore, homeWin)}
        {row(away, match.awayScore, awayWin)}
      </div>

      {/* tri-bar footer */}
      {showProbs ? (
        <div className="pt-0.5">
          <TriBar probs={probs} />
        </div>
      ) : (
        <div className="h-1" />
      )}
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

// ── Ordering ────────────────────────────────────────────────────────────────

function useTickerOrder(): Match[] {
  const matches = useWorldCup((s) => s.matches);
  return useMemo(() => {
    const live = matches.filter((m) => m.state === 'in');
    const liveIds = new Set(live.map((m) => m.id));
    const todayPre = matches
      .filter((m) => m.state === 'pre' && isToday(m.date))
      .sort((a, b) => a.date.localeCompare(b.date));
    const futurePre = matches
      .filter((m) => m.state === 'pre' && !isToday(m.date))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 20);
    const recentPost = matches
      .filter((m) => m.state === 'post')
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6)
      .reverse();

    const ordered = [...live, ...todayPre, ...futurePre];
    // recent finished only if the strip is thin
    if (ordered.length < 8) ordered.push(...recentPost.filter((m) => !liveIds.has(m.id)));

    const seen = new Set<string>();
    return ordered.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
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

// ── Dock shell ────────────────────────────────────────────────────────────────

export default function TickerDock() {
  const strip = useTickerOrder();
  const dockOpen = useHud((s) => s.dockOpen);
  const setDockOpen = useHud((s) => s.setDockOpen);
  const stripRef = useRef<HTMLDivElement>(null);
  const didAutoScroll = useRef(false);

  // Auto-scroll to first live card on mount (once data is present).
  useEffect(() => {
    if (didAutoScroll.current || strip.length === 0) return;
    const firstLive = strip.find((m) => m.state === 'in');
    if (!firstLive) {
      didAutoScroll.current = true;
      return;
    }
    const el = stripRef.current?.querySelector('[data-live]') as HTMLElement | null;
    if (el) {
      // Align the live card to the track start; scroll-pl-4 on the container keeps the
      // 16px breathing room so it isn't snapped flush against the edge.
      el.scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'auto' });
      didAutoScroll.current = true;
    }
  }, [strip]);

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
            : 'left-1/2 -translate-x-1/2 w-[min(880px,calc(100%-100px))] h-[140px]'
        }`}
      >
        {/* Handle / header */}
        <button
          onClick={() => setDockOpen(!dockOpen)}
          aria-label={dockOpen ? 'Collapse schedule' : 'Expand schedule'}
          aria-expanded={dockOpen}
          className="group flex shrink-0 items-center gap-2 px-3 pb-1 pt-1.5"
        >
          <span className="font-display text-[13px] font-bold uppercase tracking-[0.16em] text-chalk/85">
            {dockOpen ? 'All Matches' : 'Matches'}
          </span>
          <span className="mx-auto h-1 w-10 rounded-full bg-white/10 transition-colors group-hover:bg-white/20" aria-hidden="true" />
          <span className={`text-dust transition-transform duration-200 ${dockOpen ? '' : 'rotate-180'}`} aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 7.5L6 4.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        {dockOpen ? (
          <FullSchedule />
        ) : (
          <div
            ref={stripRef}
            className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden scroll-pl-4 pb-2 [scroll-snap-type:x_proximity]"
          >
            {strip.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[11px] text-dust">No matches to display</div>
            ) : (
              // w-max + mx-auto centers the row when the cards don't fill the dock;
              // px-4 lives on the INNER track (not the scroll container) so the first
              // and last cards keep equal, scroll-safe breathing room from the edges.
              <div className="mx-auto flex w-max gap-2 px-4">
                {strip.map((m) => <TickerCard key={m.id} match={m} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

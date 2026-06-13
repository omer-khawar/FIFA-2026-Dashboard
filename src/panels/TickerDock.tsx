/**
 * TickerDock.tsx — bottom Ticker Dock (blueprint §1.5, defect 2).
 *
 * Horizontal scroll strip, order LIVE → today → upcoming (then recent finished if
 * thin). Auto-scrolls to the first live card on mount. Each card (188px,
 * snap-align start): chip row (stage/group + city), two team rows (24px flag,
 * code in display face, score for in|post, "–" for pre — DEFECT 2), tri-bar
 * footer when probs exist; live cards get border-live/40 + a pulse-live ring.
 * Click → setFocusVenue(match.venueId) (the map flies there).
 *
 * PLUS the snap-sheet: a chevron handle expands the dock to a 58vh z-20 overlay
 * (height transition 280ms) listing ALL 104 matches grouped by day with a
 * horizontal date jump-strip. Chevron / Esc collapses. Wired via useHud dockOpen.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useWorldCup } from '../data/store';
import { useHud } from './uiStore';
import { TriBar, Flag } from './bits';
import { slotView, stageChip, isToday, dayKey } from './hud';
import { kickoffTime, dateLabel } from '../lib/format';
import type { Match } from '../lib/types';

// ── Ticker card ──────────────────────────────────────────────────────────────

function TickerCard({ match }: { match: Match }) {
  const teams = useWorldCup((s) => s.teams);
  const predictions = useWorldCup((s) => s.predictions);
  const setFocusVenue = useWorldCup((s) => s.setFocusVenue);

  const isLive = match.state === 'in';
  const isPost = match.state === 'post';
  const showScore = isLive || isPost; // DEFECT 2 — "–" for pre

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
      <Flag url={v.flagUrl} className="h-4 w-6" />
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
      data-live={isLive || undefined}
      onClick={() => setFocusVenue(match.venueId)}
      title={`${match.venueName} · ${match.city}`}
      className={`flex h-full w-[188px] shrink-0 flex-col gap-1 rounded-lg border bg-white/[0.02] px-2.5 py-2 text-left transition-colors [scroll-snap-align:start] hover:bg-white/[0.05] ${
        isLive
          ? 'border-live/40 animate-[pulse-live_1.6s_ease-in-out_infinite]'
          : 'border-hairline'
      }`}
    >
      {/* chip row */}
      <div className="flex items-center gap-1.5">
        <span className="rounded-[3px] bg-white/[0.06] px-1.5 py-0.5 font-display text-[9px] font-semibold uppercase tracking-[0.14em] text-dust">
          {stageChip(match)}
        </span>
        <span className="min-w-0 truncate text-[9px] uppercase tracking-[0.1em] text-dust/80">
          {match.city}
        </span>
        {isLive ? (
          <span className="ml-auto flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-live">
            <span className="live-dot" aria-hidden="true" />
            {match.clock || 'LIVE'}
          </span>
        ) : isPost ? (
          <span className="ml-auto text-[9px] font-semibold uppercase text-dust">FT</span>
        ) : (
          <span className="ml-auto text-[9px] font-semibold uppercase tracking-[0.06em] text-dust">
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
        <div className="mt-auto pt-0.5">
          <TriBar probs={probs} />
        </div>
      ) : (
        <div className="mt-auto" />
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

// ── Snap-sheet (all 104, grouped by day) ──────────────────────────────────────

function FullSchedule() {
  const matches = useWorldCup((s) => s.matches);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    document.getElementById(`day-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* date jump-strip */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-hairline px-3 py-2 [scrollbar-width:none]">
        {days.map((d) => (
          <button
            key={d.key}
            onClick={() => jump(d.key)}
            className="shrink-0 rounded-[4px] border border-hairline px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-dust transition-colors hover:border-neon/40 hover:text-neon"
          >
            {d.label}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
        {days.map((d) => (
          <div key={d.key} id={`day-${d.key}`} className="mb-4 scroll-mt-2">
            <div className="sticky top-0 z-10 mb-2 bg-glass/80 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-chalk/80 backdrop-blur-sm">
              {d.label}
              <span className="ml-2 text-[10px] tabular-nums text-dust">{d.matches.length}</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(188px,1fr))] gap-2">
              {d.matches.map((m) => (
                <div key={m.id} className="h-[88px]">
                  <TickerCard match={m} />
                </div>
              ))}
            </div>
          </div>
        ))}
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
    if (el && stripRef.current) {
      stripRef.current.scrollLeft = Math.max(0, el.offsetLeft - 12);
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
    <div className="relative z-20 h-full w-full px-3 pb-3">
      {/* Backdrop when the sheet is open */}
      {dockOpen && (
        <div
          className="fixed inset-0 z-10 bg-void/50 backdrop-blur-sm"
          onClick={() => setDockOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* The dock surface — animates height into a 58vh sheet when open */}
      <div
        className={`absolute bottom-3 left-3 right-3 z-20 flex flex-col overflow-hidden rounded-2xl border border-hairline bg-glass backdrop-blur-xl shadow-[0_8px_40px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.04)] transition-[height] duration-[280ms] ease-[var(--ease-hud)] ${
          dockOpen ? 'h-[58vh]' : 'h-[94px]'
        }`}
      >
        {/* Handle / header */}
        <button
          onClick={() => setDockOpen(!dockOpen)}
          aria-label={dockOpen ? 'Collapse schedule' : 'Expand schedule'}
          aria-expanded={dockOpen}
          className="group flex shrink-0 items-center gap-2 px-3 pb-1 pt-1.5"
        >
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-dust">
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
            className="flex min-h-0 flex-1 gap-2 overflow-x-auto overflow-y-hidden px-3 pb-2 [scroll-snap-type:x_proximity]"
          >
            {strip.length === 0 ? (
              <div className="flex items-center text-[11px] text-dust">No matches to display</div>
            ) : (
              strip.map((m) => <TickerCard key={m.id} match={m} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

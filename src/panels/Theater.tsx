/**
 * Theater.tsx — modal Theater overlay (blueprint §1.3 / §3.4, defect 3).
 *
 * z-50 fixed overlay, 92vw×84vh glass panel, backdrop blur+dim, Esc/✕/click-out
 * to close (all → setTheater(null)). One component, three views:
 *   'bracket' — the full SVG bracket tree with wheel zoom + drag pan, driven
 *               purely by scroll offsets + a resizing box (NO css transform, so
 *               the foreignObject nodes never blank out mid-drag in Blink).
 *   'groups'  — all 12 group cards in a grid.
 *   'odds'    — the full odds table, large.
 * Export name frozen: default `Theater`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHud } from './uiStore';
import { FLOATING_PANEL } from './DataDeck';
import Bracket, { BRACKET_BASE_W, BRACKET_BASE_H } from './Bracket';
import { useWorldCup } from '../data/store';
import { signedGD, formatPct } from './hud';
import { Flag } from './bits';
import type { Group } from '../lib/types';

// ── Bracket view: TRANSFORM-FREE wheel zoom + drag pan ───────────────────────────
//
// foreignObject (HTML-in-SVG) blanks out under a continuously-changing CSS
// transform in Blink, so we never transform any ancestor of the <svg>. Instead:
//   • A scroll container (overflow-auto) owns position.
//   • An inner box is sized base*zoom; the <svg> (width/height 100% + viewBox)
//     rescales cleanly to fill it — no transform involved.
//   • PAN = adjust scrollLeft/scrollTop by the negative pointer delta.
//   • ZOOM = wheel changes `zoom`; we re-anchor scroll so the point under the
//     cursor stays put. The box resizes and the svg rescales via its viewBox.

const FIT_PAD = 40; // px breathing room kept around the bracket on every side
const ZOOM_RANGE = 4; // max zoom-in = the fit (initial) scale × this

function BracketStage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Intrinsic bracket aspect: prefer the live viewBox, fall back to nominal base.
  const [base, setBase] = useState({ w: BRACKET_BASE_W, h: BRACKET_BASE_H });
  // Live scroll-container size — needed to center the bracket + cap the pan range.
  const [cont, setCont] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  // The fit-to-width scale the bracket opens at. It is ALSO the minimum zoom, so
  // the user can never zoom out past the initial framing (defect 3 — zoom limit).
  const [fitZoom, setFitZoom] = useState(0.4);
  const fitted = useRef(false);
  const drag = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);

  const innerW = base.w * zoom;
  const innerH = base.h * zoom;
  // The scrollable content is never smaller than the container; when the bracket
  // (plus its breathing room) is larger it grows so the user can pan — but it never
  // tightens past FIT_PAD around the tree, so panning stops at the last game with
  // its margin intact (defect 3 — pan limit). The box is then centered inside it,
  // giving equal breathing room on all sides (defect 2 — margins + centering).
  const contentW = Math.max(innerW + FIT_PAD * 2, cont.w);
  const contentH = Math.max(innerH + FIT_PAD * 2, cont.h);

  // Measure the container + the bracket's intrinsic size, then fit-to-width once.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const svg = wrap.querySelector('svg');
      let bw = BRACKET_BASE_W;
      let bh = BRACKET_BASE_H;
      const vb = svg?.getAttribute('viewBox');
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          bw = parts[2];
          bh = parts[3];
        }
      }
      const cw = wrap.clientWidth;
      const ch = wrap.clientHeight;
      if (!cw || !ch) return;
      setBase({ w: bw, h: bh });
      setCont({ w: cw, h: ch });
      // Fit to WIDTH (minus breathing room) so columns stay readable; the tall
      // tree then scrolls vertically. This fit is the minimum zoom.
      const fit = Math.max(0.05, (cw - FIT_PAD * 2) / bw);
      setFitZoom(fit);
      if (!fitted.current) {
        setZoom(fit);
        fitted.current = true;
      }
    };
    const id = window.setTimeout(measure, 30);
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => {
      window.clearTimeout(id);
      ro.disconnect();
    };
  }, []);

  // On a fresh fit: center horizontally and anchor at the top, so the round labels
  // show with breathing room above them rather than jammed against the modal edge.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.scrollLeft = Math.max(0, (contentW - wrap.clientWidth) / 2);
    wrap.scrollTop = 0;
    // Only re-anchor on a fresh fit (base / fit changes), not on every zoom nudge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base.w, base.h, fitZoom]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setZoom((prev) => {
        const next = Math.min(
          fitZoom * ZOOM_RANGE,
          Math.max(fitZoom, prev * Math.exp(-e.deltaY * 0.0015)),
        );
        if (next === prev) return prev;
        // The box is centered inside the padded content; account for that offset so
        // the point under the cursor stays put across the zoom.
        const prevBoxLeft = (Math.max(prev * base.w + FIT_PAD * 2, cont.w) - prev * base.w) / 2;
        const prevBoxTop = (Math.max(prev * base.h + FIT_PAD * 2, cont.h) - prev * base.h) / 2;
        const nextBoxLeft = (Math.max(next * base.w + FIT_PAD * 2, cont.w) - next * base.w) / 2;
        const nextBoxTop = (Math.max(next * base.h + FIT_PAD * 2, cont.h) - next * base.h) / 2;
        const bx = (wrap.scrollLeft + cx - prevBoxLeft) / prev; // cursor → bracket coords
        const by = (wrap.scrollTop + cy - prevBoxTop) / prev;
        const newScrollLeft = bx * next + nextBoxLeft - cx;
        const newScrollTop = by * next + nextBoxTop - cy;
        requestAnimationFrame(() => {
          const w = wrapRef.current;
          if (!w) return;
          w.scrollLeft = newScrollLeft;
          w.scrollTop = newScrollTop;
        });
        return next;
      });
    },
    [fitZoom, base.w, base.h, cont.w, cont.h],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const wrap = wrapRef.current;
    if (!drag.current || !wrap) return;
    wrap.scrollLeft = drag.current.sl - (e.clientX - drag.current.x);
    wrap.scrollTop = drag.current.st - (e.clientY - drag.current.y);
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <div className="relative h-full w-full">
      <div
        ref={wrapRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        className="h-full w-full cursor-grab overflow-auto overscroll-contain active:cursor-grabbing [scrollbar-width:none] [touch-action:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Padded, centered stage: the bracket box is centered within content that
            is never smaller than the viewport, so there is equal breathing room on
            every side and the pan range is capped to the tree + its margin. */}
        <div className="flex items-center justify-center" style={{ width: contentW, height: contentH }}>
          <div style={{ width: innerW, height: innerH, flexShrink: 0 }}>
            <Bracket />
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-4 text-[10px] uppercase tracking-[0.16em] text-dust/70">
        scroll to zoom · drag to pan
      </div>
    </div>
  );
}

// ── Groups view: all 12 cards ─────────────────────────────────────────────────────

function TheaterGroupCard({ group }: { group: Group }) {
  const teams = useWorldCup((s) => s.teams);
  const predictions = useWorldCup((s) => s.predictions);
  const setFocusTeam = useHud((s) => s.setFocusTeam);
  const setTheater = useHud((s) => s.setTheater);

  const rows = useMemo(() => [...group.rows].sort((a, b) => a.rank - b.rank), [group.rows]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-hairline bg-white/[0.02] p-3.5">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 -top-3 select-none font-display text-[72px] font-bold leading-none text-white/[0.04]"
      >
        {group.id}
      </span>
      <div className="relative mb-2.5 font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-dust">
        Group {group.id}
      </div>
      <div className="relative flex flex-col gap-0.5">
        {rows.map((row) => {
          const team = teams[row.teamId];
          const pR32 = predictions?.outlooks?.[row.teamId]?.pR32;
          return (
            <button
              key={row.teamId}
              onClick={() => {
                setFocusTeam(row.teamId);
                setTheater(null);
              }}
              className="relative flex items-center gap-2 rounded-[4px] py-1 pl-2.5 pr-1 text-left transition-colors hover:bg-white/[0.05]"
            >
              {row.noteColor && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full"
                  style={{ background: row.noteColor }}
                />
              )}
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/[0.06] font-display text-[10px] font-semibold tabular-nums text-dust">
                {row.rank}
              </span>
              <Flag url={team?.flagUrl} className="h-[14px] w-[21px]" />
              <span className="min-w-0 flex-1 truncate font-display text-[13px] font-semibold text-chalk/90">
                {team?.name ?? row.teamId}
              </span>
              <span className="w-5 text-right font-display text-[14px] font-bold tabular-nums text-chalk">{row.points}</span>
              <span className="w-6 text-right text-[11px] tabular-nums text-dust">{signedGD(row.gd)}</span>
              <span className="h-[4px] w-8 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
                {pR32 !== undefined && (
                  <span
                    className="block h-full rounded-full bg-neon/80 transition-[width] duration-700"
                    style={{ width: `${Math.round(pR32 * 100)}%` }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GroupsStage() {
  const groups = useWorldCup((s) => s.groups);
  return (
    <div className="h-full overflow-y-auto overscroll-contain p-5">
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-4">
        {groups.map((g) => (
          <TheaterGroupCard key={g.id} group={g} />
        ))}
      </div>
    </div>
  );
}

// ── Odds view: full table, large ──────────────────────────────────────────────────

function OddsStage() {
  const predictions = useWorldCup((s) => s.predictions);
  const teams = useWorldCup((s) => s.teams);
  const setFocusTeam = useHud((s) => s.setFocusTeam);
  const setTheater = useHud((s) => s.setTheater);

  const ranked = useMemo(() => {
    if (!predictions) return null;
    return Object.entries(predictions.outlooks)
      .map(([teamId, o]) => ({ teamId, o }))
      .sort((a, b) => b.o.pChampion - a.o.pChampion);
  }, [predictions]);

  if (!ranked) {
    return <div className="grid h-full place-items-center text-[12px] text-dust">Computing odds…</div>;
  }

  const maxP = ranked[0]?.o.pChampion ?? 1;

  return (
    <div className="h-full overflow-y-auto overscroll-contain p-5">
      <div className="mx-auto max-w-4xl">
        {/* header row */}
        <div className="mb-2 grid grid-cols-[36px_170px_1fr_72px_72px_72px_76px] items-center gap-2 border-b border-hairline px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-dust">
          <span className="text-right">#</span>
          <span>Team</span>
          <span>{/* bar column — no label */}</span>
          <span className="text-right">R16</span>
          <span className="text-right">QF</span>
          <span className="text-right">SF</span>
          <span className="text-right">Champ</span>
        </div>
        <div className="flex flex-col">
          {ranked.map(({ teamId, o }, i) => {
            const team = teams[teamId];
            const isLeader = i === 0;
            const barPct = maxP > 0 ? (o.pChampion / maxP) * 100 : 0;
            return (
              <button
                key={teamId}
                onClick={() => {
                  setFocusTeam(teamId);
                  setTheater(null);
                }}
                className="grid grid-cols-[36px_170px_1fr_72px_72px_72px_76px] items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05]"
              >
                {/* # */}
                <span className={`text-right font-display text-[14px] font-bold tabular-nums ${isLeader ? 'text-gold' : 'text-dust'}`}>
                  {i + 1}
                </span>
                {/* team — fixed 170px: flag + truncated name */}
                <span className="flex min-w-0 items-center gap-2.5">
                  <Flag url={team?.flagUrl} className="h-[14px] w-[21px] shrink-0" />
                  <span className="truncate font-display text-[14px] font-semibold text-chalk/90">{team?.name ?? teamId}</span>
                </span>
                {/* bar — own 1fr column, aligned across all rows */}
                <span className="flex h-[6px] overflow-hidden rounded-full bg-white/5">
                  <span
                    className={`block h-full rounded-full ${isLeader ? 'bg-gradient-to-r from-neon to-gold' : 'bg-gradient-to-r from-neon to-gold/70'} transition-[width] duration-700`}
                    style={{ width: `${barPct}%` }}
                  />
                </span>
                {/* stage columns */}
                <span className="text-right text-[12px] tabular-nums text-dust">{formatPct(o.pR16)}</span>
                <span className="text-right text-[12px] tabular-nums text-dust">{formatPct(o.pQF)}</span>
                <span className="text-right text-[12px] tabular-nums text-dust">{formatPct(o.pSF)}</span>
                <span className={`text-right font-display text-[13px] font-bold tabular-nums ${isLeader ? 'text-gold' : 'text-chalk/90'}`}>
                  {formatPct(o.pChampion)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────────

const TITLES: Record<string, string> = {
  bracket: 'Full Bracket',
  groups: 'All Groups',
  odds: 'Championship Odds',
};

export default function Theater() {
  const theater = useHud((s) => s.theater);
  const setTheater = useHud((s) => s.setTheater);

  useEffect(() => {
    if (theater === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTheater(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [theater, setTheater]);

  if (theater === null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-8 backdrop-blur-md"
      onClick={() => setTheater(null)}
      role="dialog"
      aria-modal="true"
      aria-label={`${theater} theater`}
    >
      <div
        className={`relative flex h-[82vh] w-[min(980px,92vw)] flex-col overflow-hidden ${FLOATING_PANEL}`}
        // Opaque dark surface overrides the glass translucency so nothing bleeds
        // through during interaction (esp. the bracket pan/zoom) while keeping the
        // hairline border + shadow + rounded corners from FLOATING_PANEL.
        style={{ backgroundColor: 'var(--color-pitch)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-5 py-3.5">
          <span className="font-display text-[12px] font-semibold uppercase tracking-[0.2em] text-chalk/80">
            {TITLES[theater] ?? theater}
          </span>
          <button
            onClick={() => setTheater(null)}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md border border-hairline text-dust transition-colors hover:border-neon/40 hover:text-neon"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path d="M2 2l7 7M9 2l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1">
          {theater === 'bracket' && <BracketStage />}
          {theater === 'groups' && <GroupsStage />}
          {theater === 'odds' && <OddsStage />}
        </div>
      </div>
    </div>
  );
}

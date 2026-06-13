/**
 * Theater.tsx — modal Theater overlay (blueprint §1.3 / §3.4, defect 3).
 *
 * z-50 fixed overlay, 92vw×84vh glass panel, backdrop blur+dim, Esc/✕/click-out
 * to close (all → setTheater(null)). One component, three views:
 *   'bracket' — the full SVG bracket tree with wheel zoom + drag pan
 *               (transform on an inner <g>, touch-action: none).
 *   'groups'  — all 12 group cards in a grid.
 *   'odds'    — the full odds table, large.
 * Export name frozen: default `Theater`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHud } from './uiStore';
import { FLOATING_PANEL } from './DataDeck';
import Bracket from './Bracket';
import { useWorldCup } from '../data/store';
import { signedGD, formatPct } from './hud';
import { Flag } from './bits';
import type { Group } from '../lib/types';

// ── Bracket view: wheel zoom + drag pan ──────────────────────────────────────────

function BracketStage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Fit-to-view once the tree has measured.
  useEffect(() => {
    const fit = () => {
      const wrap = wrapRef.current;
      const inner = innerRef.current;
      if (!wrap || !inner) return;
      const svg = inner.querySelector('svg');
      if (!svg) return;
      const cw = wrap.clientWidth;
      const ch = wrap.clientHeight;
      const iw = svg.clientWidth || parseFloat(svg.getAttribute('width') || '0');
      const ih = svg.clientHeight || parseFloat(svg.getAttribute('height') || '0');
      if (!iw || !ih) return;
      const k = Math.min((cw - 48) / iw, (ch - 48) / ih, 1.4);
      setT({ x: (cw - iw * k) / 2, y: (ch - ih * k) / 2, k });
    };
    const id = window.setTimeout(fit, 30);
    window.addEventListener('resize', fit);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', fit);
    };
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setT((prev) => {
      const factor = Math.exp(-e.deltaY * 0.0015);
      const k = Math.min(3, Math.max(0.3, prev.k * factor));
      const ratio = k / prev.k;
      // zoom toward cursor
      return {
        k,
        x: mx - (mx - prev.x) * ratio,
        y: my - (my - prev.y) * ratio,
      };
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: t.x, oy: t.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setT((prev) => ({
      ...prev,
      x: drag.current!.ox + (e.clientX - drag.current!.x),
      y: drag.current!.oy + (e.clientY - drag.current!.y),
    }));
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <div
      ref={wrapRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      className="relative h-full w-full cursor-grab overflow-hidden active:cursor-grabbing [touch-action:none]"
    >
      <div
        ref={innerRef}
        style={{
          transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`,
          transformOrigin: '0 0',
          width: 'max-content',
        }}
      >
        <Bracket />
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
    <div className="relative overflow-hidden rounded-xl border border-hairline bg-white/[0.02] p-3">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 -top-3 select-none font-display text-[72px] font-bold leading-none text-white/[0.04]"
      >
        {group.id}
      </span>
      <div className="relative mb-2 font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-dust">
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
    <div className="h-full overflow-y-auto overscroll-contain p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
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
    <div className="h-full overflow-y-auto overscroll-contain p-4">
      <div className="mx-auto max-w-4xl">
        {/* header row */}
        <div className="mb-2 grid grid-cols-[40px_1fr_90px_90px_90px_90px] items-center gap-2 border-b border-hairline px-2 pb-1.5 font-display text-[9px] font-semibold uppercase tracking-[0.16em] text-dust">
          <span className="text-right">#</span>
          <span>Team</span>
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
                className="grid grid-cols-[40px_1fr_90px_90px_90px_90px] items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05]"
              >
                <span className={`text-right font-display text-[14px] font-bold tabular-nums ${isLeader ? 'text-gold' : 'text-dust'}`}>
                  {i + 1}
                </span>
                <span className="flex min-w-0 items-center gap-2.5">
                  <Flag url={team?.flagUrl} className="h-[14px] w-[21px]" />
                  <span className="truncate font-display text-[14px] font-semibold text-chalk/90">{team?.name ?? teamId}</span>
                  <span className="ml-2 hidden h-[6px] flex-1 overflow-hidden rounded-full bg-white/5 sm:block">
                    <span
                      className={`block h-full rounded-full ${isLeader ? 'bg-gradient-to-r from-neon to-gold' : 'bg-gradient-to-r from-neon to-gold/70'} transition-[width] duration-700`}
                      style={{ width: `${barPct}%` }}
                    />
                  </span>
                </span>
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
        className={`relative flex h-[84vh] w-[92vw] flex-col overflow-hidden ${FLOATING_PANEL}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-5 py-3">
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

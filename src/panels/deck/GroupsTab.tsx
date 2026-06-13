/**
 * GroupsTab.tsx — GROUPS view of the Data Deck (blueprint §1.3 / §3.5).
 *
 * Vertical scroll-snap carousel: pages of 4 group micro-cards (2×2), with an A–L
 * letter jump-rail pinned to the panel edge (click = scrollIntoView). Each
 * micro-card: oversized group-letter watermark behind 4 rows — rank-dot, 20px
 * flag, code, Pts (bold), GD (signed), advance-prob micro-bar (pR32). Rows are
 * SORTED BY row.rank (defect 1). noteColor renders as a 2px inner-left bar.
 * Clicking a team row → setFocusTeam(teamId).
 */
import { useMemo, useRef } from 'react';
import { useWorldCup } from '../../data/store';
import { useHud } from '../uiStore';
import type { Group } from '../../lib/types';
import { signedGD } from '../hud';

function GroupCard({ group }: { group: Group }) {
  const teams = useWorldCup((s) => s.teams);
  const predictions = useWorldCup((s) => s.predictions);
  const matches = useWorldCup((s) => s.matches);
  const setFocusTeam = useHud((s) => s.setFocusTeam);

  // teamIds currently in a live match (for the live dot).
  const liveTeamIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of matches) {
      if (m.state !== 'in') continue;
      if (m.home.kind === 'team') ids.add(m.home.teamId);
      if (m.away.kind === 'team') ids.add(m.away.teamId);
    }
    return ids;
  }, [matches]);

  // Defect 1 — sort by rank before render.
  const rows = useMemo(
    () => [...group.rows].sort((a, b) => a.rank - b.rank),
    [group.rows],
  );

  return (
    <div
      id={`group-card-${group.id}`}
      className="relative flex flex-col overflow-hidden rounded-lg border border-hairline bg-white/[0.02] px-2.5 pb-2 pt-1.5"
    >
      {/* Oversized group-letter watermark */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-1 -top-2 select-none font-display text-[52px] font-bold leading-none text-white/[0.04]"
      >
        {group.id}
      </span>

      <div className="relative mb-1 font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-dust">
        Group {group.id}
      </div>

      <div className="relative flex flex-col">
        {rows.map((row) => {
          const team = teams[row.teamId];
          const isLive = liveTeamIds.has(row.teamId);
          const pR32 = predictions?.outlooks?.[row.teamId]?.pR32;
          return (
            <button
              key={row.teamId}
              onClick={() => setFocusTeam(row.teamId)}
              className="group/row relative flex items-center gap-1.5 rounded-[3px] py-[3px] pl-2 pr-0.5 text-left transition-colors hover:bg-white/[0.05]"
            >
              {/* noteColor 2px inner-left bar */}
              {row.noteColor && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 h-[14px] w-[2px] -translate-y-1/2 rounded-full"
                  style={{ background: row.noteColor }}
                  title={row.noteDesc ?? ''}
                />
              )}

              {/* rank dot */}
              <span className="grid h-[14px] w-[14px] shrink-0 place-items-center rounded-full bg-white/[0.06] font-display text-[9px] font-semibold tabular-nums text-dust">
                {row.rank}
              </span>

              {/* flag (20px) */}
              <span className="relative flex shrink-0 items-center">
                {team?.flagUrl ? (
                  <img
                    src={team.flagUrl}
                    alt=""
                    loading="lazy"
                    className="h-[13px] w-[20px] rounded-[1px] object-cover"
                  />
                ) : (
                  <span className="h-[13px] w-[20px] rounded-[1px] bg-white/[0.06]" />
                )}
                {isLive && (
                  <span
                    aria-label="Live"
                    className="absolute -bottom-px -right-1 h-[5px] w-[5px] rounded-full bg-live ring-1 ring-void"
                    style={{ animation: 'wc-group-dot-pulse 1.2s ease-in-out infinite' }}
                  />
                )}
              </span>

              <span className="min-w-0 flex-1 truncate font-display text-[11px] font-semibold text-chalk/90">
                {team?.code ?? row.teamId}
              </span>

              <span className="w-4 shrink-0 text-right font-display text-[12px] font-bold tabular-nums text-chalk">
                {row.points}
              </span>

              <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-dust">
                {signedGD(row.gd)}
              </span>

              {/* advance-prob micro-bar */}
              <span className="h-[3px] w-5 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
                {pR32 !== undefined && (
                  <span
                    className="block h-full rounded-full bg-neon/80 transition-[width] duration-700 ease-[var(--ease-hud)]"
                    style={{ width: `${Math.round(pR32 * 100)}%` }}
                    title={`${Math.round(pR32 * 100)}% advance`}
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

export default function GroupsTab() {
  const groups = useWorldCup((s) => s.groups);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Letters A–L for the jump rail (only ones present render as live links).
  const present = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);
  const letters = 'ABCDEFGHIJKL'.split('');

  const jump = (id: string) => {
    const el = document.getElementById(`group-card-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (groups.length === 0) {
    return <div className="p-3 text-[11px] text-dust">Groups loading…</div>;
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* Scroll-snap carousel: 2-col grid, snap by row */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pr-1 [scroll-snap-type:y_mandatory]"
      >
        <div className="grid grid-cols-2 gap-2">
          {groups.map((g) => (
            <div key={g.id} className="[scroll-snap-align:start]">
              <GroupCard group={g} />
            </div>
          ))}
        </div>
      </div>

      {/* A–L jump rail pinned to the panel edge */}
      <div className="flex w-5 shrink-0 flex-col items-center justify-center gap-0.5 border-l border-hairline py-2">
        {letters.map((l) => {
          const active = present.has(l);
          return (
            <button
              key={l}
              disabled={!active}
              onClick={() => jump(l)}
              aria-label={`Jump to group ${l}`}
              className="font-display text-[9px] font-semibold leading-none text-dust transition-colors enabled:hover:text-neon disabled:opacity-30"
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

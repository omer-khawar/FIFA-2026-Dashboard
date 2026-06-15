/**
 * GroupsTab.tsx — GROUPS section of the stacked Data Deck.
 *
 * A compact single-group standings view. A horizontal A–L pill selector sits
 * above the table (pills only for groups that exist; the selected one in neon).
 * Default selection follows the focused team's group (teams[focusTeamId].groupId)
 * and falls back to "A". Below it: a sub-label column-header row, then the group
 * rows at h-7 each — rank dot, flag, code, compact P/W/D/L, signed GD, Pts as a
 * numeric hero, and a thin neon advance-prob bar (pR32). Rows are SORTED BY
 * row.rank and carry the noteColor accent + live dot. Clicking a row →
 * setFocusTeam(teamId).
 */
import { useEffect, useMemo, useState } from 'react';
import { useWorldCup } from '../../data/store';
import { useHud } from '../uiStore';
import type { Group } from '../../lib/types';
import { Flag } from '../bits';
import { signedGD } from '../hud';

const ALL_LETTERS = 'ABCDEFGHIJKL'.split('');

export default function GroupsTab() {
  const groups = useWorldCup((s) => s.groups);
  const teams = useWorldCup((s) => s.teams);
  const predictions = useWorldCup((s) => s.predictions);
  const matches = useWorldCup((s) => s.matches);
  const focusTeamId = useHud((s) => s.focusTeamId);
  const setFocusTeam = useHud((s) => s.setFocusTeam);

  // Groups that actually exist, in alphabetical order.
  const present = useMemo(() => {
    const ids = new Set(groups.map((g) => g.id));
    return ALL_LETTERS.filter((l) => ids.has(l));
  }, [groups]);

  // Default-selected group: the focused team's group, else first present, else "A".
  const focusGroup = focusTeamId ? teams[focusTeamId]?.groupId : undefined;
  const [selected, setSelected] = useState<string>(() => focusGroup ?? present[0] ?? 'A');

  // Follow the focus team into its group, and keep the selection valid as data loads.
  useEffect(() => {
    if (focusGroup && present.includes(focusGroup)) {
      setSelected(focusGroup);
    } else if (present.length > 0 && !present.includes(selected)) {
      setSelected(present[0]);
    }
    // selected intentionally omitted — we only want to react to focus/data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusGroup, present]);

  const group: Group | undefined = useMemo(
    () => groups.find((g) => g.id === selected),
    [groups, selected],
  );

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
    () => (group ? [...group.rows].sort((a, b) => a.rank - b.rank) : []),
    [group],
  );

  if (groups.length === 0) {
    return <div className="px-1 py-2 text-[12px] text-dust">Groups loading…</div>;
  }

  return (
    <div className="flex flex-col">
      {/* A–L group selector pills */}
      <div className="mb-2 flex flex-wrap gap-1">
        {present.map((l) => {
          const active = l === selected;
          return (
            <button
              key={l}
              onClick={() => setSelected(l)}
              aria-pressed={active}
              className={`grid h-6 w-6 place-items-center rounded-md border font-display text-[11px] font-bold tabular-nums transition-colors ${
                active
                  ? 'border-neon/60 bg-neon/10 text-neon'
                  : 'border-hairline text-dust hover:border-neon/30 hover:text-chalk'
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>

      {/* Column header row (sub-labels). "Team" sits flush-left; the flex-1 spacer
          absorbs the slack so the right-hand P/W/D/L…R32 columns still line up with
          the data rows below. */}
      <div className="flex h-5 items-center gap-1.5 px-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-dust">
        <span className="min-w-0 flex-1">Team</span>
        <span className="w-[58px] shrink-0 text-right tracking-[0.08em]">P W D L</span>
        <span className="w-6 shrink-0 text-right">GD</span>
        <span className="w-5 shrink-0 text-right">Pts</span>
        <span className="w-7 shrink-0 text-right">R32</span>
      </div>

      {/* Standings rows — equal h-7 each */}
      <div className="flex flex-col">
        {rows.map((row) => {
          const team = teams[row.teamId];
          const isLive = liveTeamIds.has(row.teamId);
          const pR32 = predictions?.outlooks?.[row.teamId]?.pR32;
          return (
            <button
              key={row.teamId}
              onClick={() => setFocusTeam(row.teamId)}
              className="group/row relative flex h-7 items-center gap-1.5 rounded-[4px] px-1.5 text-left transition-colors hover:bg-white/[0.05]"
            >
              {/* noteColor 2px inner-left bar */}
              {row.noteColor && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 h-[16px] w-[2px] -translate-y-1/2 rounded-full"
                  style={{ background: row.noteColor }}
                  title={row.noteDesc ?? ''}
                />
              )}

              {/* rank dot */}
              <span className="grid h-[14px] w-[14px] shrink-0 place-items-center rounded-full bg-white/[0.06] font-display text-[9px] font-semibold tabular-nums text-dust">
                {row.rank}
              </span>

              {/* flag + live dot */}
              <span className="relative flex shrink-0 items-center">
                <Flag url={team?.flagUrl} className="h-[13px] w-5" />
                {isLive && (
                  <span
                    aria-label="Live"
                    className="absolute -bottom-px -right-1 h-[5px] w-[5px] rounded-full bg-live ring-1 ring-void"
                    style={{ animation: 'wc-group-dot-pulse 1.2s ease-in-out infinite' }}
                  />
                )}
              </span>

              {/* code */}
              <span className="min-w-0 flex-1 truncate font-display text-[12px] font-semibold text-chalk/85">
                {team?.code ?? row.teamId}
              </span>

              {/* compact P/W/D/L */}
              <span className="w-[58px] shrink-0 text-right text-[10px] tabular-nums text-dust">
                {row.played} {row.won} {row.drawn} {row.lost}
              </span>

              {/* signed GD */}
              <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-dust">
                {signedGD(row.gd)}
              </span>

              {/* Pts — numeric hero */}
              <span className="w-5 shrink-0 text-right font-display text-[13px] font-bold tabular-nums text-chalk">
                {row.points}
              </span>

              {/* thin neon advance-prob bar (pR32) */}
              <span className="h-[3px] w-7 shrink-0 self-center overflow-hidden rounded-full bg-white/[0.06]">
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

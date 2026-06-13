/**
 * BracketSpine.tsx — BRACKET view of the Data Deck (blueprint §1.3 / §3.5).
 *
 * In-rail vertical "knockout spine": rounds R32→Final as collapsible sections
 * (R32 collapsed by default, later rounds open). Each match is one line —
 * flags+codes+score for decided ties, dim italic shortened placeholder chips
 * otherwise; live nodes glow. A "⤢ FULL BRACKET" button opens the Theater tree.
 */
import { useMemo, useState } from 'react';
import { useWorldCup } from '../../data/store';
import { useHud } from '../uiStore';
import type { Match, Stage } from '../../lib/types';
import { slotView, stageName } from '../hud';

const BRACKET_STAGE_ORDER: Stage[] = ['r32', 'r16', 'qf', 'sf', 'final'];

function SpineNode({ match }: { match: Match }) {
  const teams = useWorldCup((s) => s.teams);
  const setFocusVenue = useWorldCup((s) => s.setFocusVenue);
  const isLive = match.state === 'in';
  const isPost = match.state === 'post';

  const home = slotView(match.home, teams);
  const away = slotView(match.away, teams);

  const homeWin = isPost && match.winnerTeamId !== undefined
    && match.home.kind === 'team' && match.winnerTeamId === match.home.teamId;
  const awayWin = isPost && match.winnerTeamId !== undefined
    && match.away.kind === 'team' && match.winnerTeamId === match.away.teamId;

  const side = (
    v: ReturnType<typeof slotView>,
    score: number | undefined,
    win: boolean,
  ) => (
    <div className="flex items-center gap-1.5">
      {/* neon winner tick */}
      <span
        className={`h-2.5 w-[2px] shrink-0 rounded-full ${win ? 'bg-neon' : 'bg-transparent'}`}
        aria-hidden="true"
      />
      {v.isPlaceholder ? (
        <span className="truncate text-[10px] italic text-dust/60">{v.code}</span>
      ) : (
        <>
          {v.flagUrl ? (
            <img src={v.flagUrl} alt="" loading="lazy" className="h-[10px] w-[15px] rounded-[1px] object-cover" />
          ) : (
            <span className="h-[10px] w-[15px] rounded-[1px] bg-white/[0.06]" />
          )}
          <span className={`truncate font-display text-[11px] ${win ? 'font-bold text-chalk' : 'text-chalk/80'}`}>
            {v.code}
          </span>
        </>
      )}
      <span className="flex-1" />
      {(isLive || isPost) && score !== undefined && (
        <span className={`font-display text-[11px] font-bold tabular-nums ${win ? 'text-chalk' : 'text-dust'}`}>
          {score}
        </span>
      )}
    </div>
  );

  return (
    <button
      onClick={() => setFocusVenue(match.venueId)}
      title={`${match.venueName} · ${match.city}`}
      className={`flex w-full flex-col gap-0.5 rounded-md border px-2 py-1 text-left transition-colors hover:bg-white/[0.04] ${
        isLive
          ? 'border-live/50 bg-live/[0.06] shadow-[0_0_10px_-2px_rgb(255_70_85/0.5)]'
          : 'border-hairline'
      }`}
    >
      {side(home, match.homeScore, homeWin)}
      {side(away, match.awayScore, awayWin)}
    </button>
  );
}

function RoundSection({
  stage,
  matches,
  defaultOpen,
}: {
  stage: Stage;
  matches: Match[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const liveCount = matches.filter((m) => m.state === 'in').length;

  return (
    <div className="flex flex-col">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 py-1.5 text-left"
      >
        <span
          className={`text-dust transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M2 1l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-chalk/80">
          {stageName(stage)}
        </span>
        <span className="text-[9px] tabular-nums text-dust">{matches.length}</span>
        {liveCount > 0 && (
          <span className="ml-auto rounded-[3px] bg-live/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-live">
            {liveCount} live
          </span>
        )}
      </button>
      {open && (
        <div className="flex flex-col gap-1 pb-2 pl-3">
          {matches.map((m) => (
            <SpineNode key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BracketSpine() {
  const setTheater = useHud((s) => s.setTheater);
  const matches = useWorldCup((s) => s.matches);

  // Derive rounds in a memo (selectBracketRounds returns a fresh array each call,
  // which would break zustand's snapshot caching if used as a hook selector).
  const rounds = useMemo(() => {
    const byStage = new Map<Stage, Match[]>();
    for (const m of matches) {
      const arr = byStage.get(m.stage);
      if (arr) arr.push(m);
      else byStage.set(m.stage, [m]);
    }
    const result: Array<{ stage: Stage; matches: Match[] }> = [];
    for (const stage of BRACKET_STAGE_ORDER) {
      const ms = byStage.get(stage);
      if (ms && ms.length > 0) {
        result.push({ stage, matches: [...ms].sort((a, b) => a.ordinal - b.ordinal) });
      }
    }
    return result;
  }, [matches]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Full-bracket trigger */}
      <div className="shrink-0 px-2 pt-2">
        <button
          onClick={() => setTheater('bracket')}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-hairline py-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-dust transition-colors hover:border-neon/40 hover:text-neon"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M7 1h4v4M11 1L7 5M5 11H1V7M1 11l4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Full Bracket
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1">
        {rounds.length === 0 ? (
          <div className="p-2 text-[11px] text-dust">Bracket loading…</div>
        ) : (
          rounds.map((r) => (
            <RoundSection
              key={r.stage}
              stage={r.stage}
              matches={r.matches}
              defaultOpen={r.stage !== 'r32'}
            />
          ))
        )}
      </div>
    </div>
  );
}

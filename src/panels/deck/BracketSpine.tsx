/**
 * BracketSpine.tsx — BRACKET section of the stacked Data Deck (compact teaser).
 *
 * A small (~140px) knockout spine that shows only the current/next round: the
 * round that currently has a live match, else the earliest round that still has
 * an undecided tie, else the latest available round. Each match is one node —
 * flags + codes + score for decided ties, dim italic placeholder chips
 * otherwise; live nodes glow. The "Full bracket" action (in the SectionHeading)
 * opens the Theater tree.
 */
import { useMemo } from 'react';
import { useWorldCup } from '../../data/store';
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
    <div className="flex h-[15px] items-center gap-1.5">
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

export default function BracketSpine() {
  const matches = useWorldCup((s) => s.matches);

  // Pick the single "current/next" round to tease.
  const round = useMemo<{ stage: Stage; matches: Match[] } | null>(() => {
    const byStage = new Map<Stage, Match[]>();
    for (const m of matches) {
      const arr = byStage.get(m.stage);
      if (arr) arr.push(m);
      else byStage.set(m.stage, [m]);
    }
    const rounds = BRACKET_STAGE_ORDER
      .map((stage) => byStage.get(stage))
      .filter((ms): ms is Match[] => !!ms && ms.length > 0)
      .map((ms) => [...ms].sort((a, b) => a.ordinal - b.ordinal));

    if (rounds.length === 0) return null;

    // 1) Any round with a live match wins.
    const live = rounds.find((ms) => ms.some((m) => m.state === 'in'));
    if (live) return { stage: live[0].stage, matches: live };

    // 2) Earliest round that still has an undecided tie (the "next" round).
    const next = rounds.find((ms) => ms.some((m) => m.state !== 'post'));
    if (next) return { stage: next[0].stage, matches: next };

    // 3) Everything decided — show the latest available round.
    const last = rounds[rounds.length - 1];
    return { stage: last[0].stage, matches: last };
  }, [matches]);

  if (!round) {
    return <div className="px-1 py-2 text-[12px] text-dust">Bracket loading…</div>;
  }

  const liveCount = round.matches.filter((m) => m.state === 'in').length;

  return (
    <div className="flex flex-col">
      {/* Round caption */}
      <div className="mb-1.5 flex items-center gap-2 px-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dust">
          {stageName(round.stage)}
        </span>
        <span className="text-[10px] tabular-nums text-dust/70">{round.matches.length}</span>
        {liveCount > 0 && (
          <span className="ml-auto rounded-[3px] bg-live/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-live">
            {liveCount} live
          </span>
        )}
      </div>

      {/* Compact spine — cap height, scroll internally if the round is large. */}
      <div className="flex max-h-[140px] flex-col gap-1 overflow-y-auto overscroll-contain pr-0.5">
        {round.matches.map((m) => (
          <SpineNode key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}

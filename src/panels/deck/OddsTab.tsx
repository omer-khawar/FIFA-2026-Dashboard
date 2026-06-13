/**
 * OddsTab.tsx — ODDS view of the Data Deck (blueprint §1.3 / §3.4, defect 8).
 *
 * Full 48-team champion list, sorted by pChampion: top 12 emphasized, the rest
 * after an internal divider. Each row: rank numeral (display face), flag, code,
 * odds-bar (normalized to leader, gradient neon→gold, leader gets gold emphasis),
 * and the % printed beside EVERY bar (1 decimal <10%, integer ≥10). Bars animate
 * width on refresh. Skeleton shimmer rows while predictions are null. Row click →
 * setFocusTeam.
 */
import { useMemo } from 'react';
import { useWorldCup } from '../../data/store';
import { useHud } from '../uiStore';
import { formatPct } from '../hud';

const SKELETON_ROWS = 14;

interface Row {
  teamId: string;
  pChampion: number;
}

function OddsRow({
  row,
  rank,
  maxP,
  isLeader,
}: {
  row: Row;
  rank: number;
  maxP: number;
  isLeader: boolean;
}) {
  const team = useWorldCup((s) => s.teams[row.teamId]);
  const setFocusTeam = useHud((s) => s.setFocusTeam);
  const barPct = maxP > 0 ? (row.pChampion / maxP) * 100 : 0;

  return (
    <button
      onClick={() => setFocusTeam(row.teamId)}
      className="flex w-full items-center gap-2.5 rounded-[4px] px-1.5 py-1 text-left transition-colors hover:bg-white/[0.05]"
    >
      <span
        className={`w-5 shrink-0 text-right font-display text-[12px] font-bold tabular-nums ${
          isLeader ? 'text-gold' : 'text-dust'
        }`}
      >
        {rank}
      </span>
      {team?.flagUrl ? (
        <img src={team.flagUrl} alt="" loading="lazy" className="h-[12px] w-[18px] shrink-0 rounded-[1px] object-cover" />
      ) : (
        <span className="h-[12px] w-[18px] shrink-0 rounded-[1px] bg-white/[0.06]" />
      )}
      <span className="w-8 shrink-0 font-display text-[11px] font-semibold text-chalk/90">
        {team?.code ?? row.teamId}
      </span>
      <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/5">
        <span
          className={`block h-full rounded-full transition-[width] duration-700 ease-[var(--ease-hud)] ${
            isLeader
              ? 'bg-gradient-to-r from-neon to-gold shadow-[0_0_10px_rgb(255_197_61/0.4)]'
              : 'bg-gradient-to-r from-neon to-gold/70 shadow-[0_0_10px_rgb(0_229_255/0.25)]'
          }`}
          style={{ width: `${barPct}%` }}
        />
      </span>
      <span
        className={`w-10 shrink-0 text-right font-display text-[11px] tabular-nums ${
          isLeader ? 'font-bold text-gold' : 'text-dust'
        }`}
      >
        {formatPct(row.pChampion)}
      </span>
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="flex h-[26px] items-center gap-2.5 px-1.5">
      <span className="h-2.5 w-4 shrink-0 rounded-[2px]" style={shimmer} />
      <span className="h-3 w-[18px] shrink-0 rounded-[2px]" style={shimmer} />
      <span className="h-2.5 w-7 shrink-0 rounded-[2px]" style={shimmer} />
      <span className="h-[5px] flex-1 rounded-full" style={shimmer} />
      <span className="h-2.5 w-9 shrink-0 rounded-[2px]" style={shimmer} />
    </div>
  );
}

const shimmer: React.CSSProperties = {
  background:
    'linear-gradient(90deg, rgb(255 255 255 / 0.04) 25%, rgb(255 255 255 / 0.08) 50%, rgb(255 255 255 / 0.04) 75%)',
  backgroundSize: '200% 100%',
  animation: 'wc-shimmer 1.5s ease-in-out infinite',
};

export default function OddsTab() {
  const predictions = useWorldCup((s) => s.predictions);

  const ranked = useMemo<Row[] | null>(() => {
    if (!predictions) return null;
    return Object.entries(predictions.outlooks)
      .map(([teamId, o]) => ({ teamId, pChampion: o.pChampion }))
      .sort((a, b) => b.pChampion - a.pChampion);
  }, [predictions]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-3 pb-1.5 pt-2 font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-dust">
        Who Lifts It
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-2">
        {ranked === null ? (
          <div className="flex flex-col gap-1">
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {(() => {
              const maxP = ranked[0]?.pChampion ?? 1;
              return ranked.map((row, i) => (
                <div key={row.teamId}>
                  {i === 12 && (
                    <div className="my-1.5 flex items-center gap-2 px-1.5">
                      <span className="h-px flex-1 bg-hairline" />
                      <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-dust/70">
                        Outsiders
                      </span>
                      <span className="h-px flex-1 bg-hairline" />
                    </div>
                  )}
                  <OddsRow row={row} rank={i + 1} maxP={maxP} isLeader={i === 0} />
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * OddsTab.tsx — WHO LIFTS IT section of the stacked Data Deck (defect 8).
 *
 * The top 8 teams by pChampion as equal h-7 rows: rank numeral (display face),
 * flag, code, a gradient bar (from-neon to-gold) normalized to the leader, and
 * the % printed at the right (formatPct). Bars animate width on refresh. When
 * predictions are null, render skeleton shimmer rows. Row click → setFocusTeam.
 */
import { useMemo } from 'react';
import { useWorldCup } from '../../data/store';
import { useHud } from '../uiStore';
import { Flag } from '../bits';
import { formatPct } from '../hud';

const TOP_N = 8;

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
      className="flex h-7 w-full items-center gap-2.5 rounded-[4px] px-1.5 text-left transition-colors hover:bg-white/[0.05]"
    >
      <span
        className={`w-4 shrink-0 text-right font-display text-[12px] font-bold tabular-nums ${
          isLeader ? 'text-gold' : 'text-dust'
        }`}
      >
        {rank}
      </span>
      <Flag url={team?.flagUrl} className="h-[12px] w-[18px]" />
      <span className="w-8 shrink-0 font-display text-[12px] font-semibold text-chalk/85">
        {team?.code ?? row.teamId}
      </span>
      <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/5">
        <span
          className={`block h-full rounded-full bg-gradient-to-r from-neon to-gold transition-[width] duration-700 ease-[var(--ease-hud)] ${
            isLeader
              ? 'shadow-[0_0_10px_rgb(255_197_61/0.4)]'
              : 'shadow-[0_0_10px_rgb(0_229_255/0.25)]'
          }`}
          style={{ width: `${barPct}%` }}
        />
      </span>
      <span
        className={`w-10 shrink-0 text-right font-display text-[12px] tabular-nums ${
          isLeader ? 'font-bold text-gold' : 'font-semibold text-dust'
        }`}
      >
        {formatPct(row.pChampion)}
      </span>
    </button>
  );
}

const shimmer: React.CSSProperties = {
  background:
    'linear-gradient(90deg, rgb(255 255 255 / 0.04) 25%, rgb(255 255 255 / 0.08) 50%, rgb(255 255 255 / 0.04) 75%)',
  backgroundSize: '200% 100%',
  animation: 'wc-shimmer 1.5s ease-in-out infinite',
};

function SkeletonRow() {
  return (
    <div className="flex h-7 items-center gap-2.5 px-1.5">
      <span className="h-2.5 w-3 shrink-0 rounded-[2px]" style={shimmer} />
      <span className="h-3 w-[18px] shrink-0 rounded-[2px]" style={shimmer} />
      <span className="h-2.5 w-7 shrink-0 rounded-[2px]" style={shimmer} />
      <span className="h-[5px] flex-1 rounded-full" style={shimmer} />
      <span className="h-2.5 w-9 shrink-0 rounded-[2px]" style={shimmer} />
    </div>
  );
}

export default function OddsTab() {
  const predictions = useWorldCup((s) => s.predictions);

  const ranked = useMemo<Row[] | null>(() => {
    if (!predictions) return null;
    return Object.entries(predictions.outlooks)
      .map(([teamId, o]) => ({ teamId, pChampion: o.pChampion }))
      .sort((a, b) => b.pChampion - a.pChampion)
      .slice(0, TOP_N);
  }, [predictions]);

  if (ranked === null) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: TOP_N }, (_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  const maxP = ranked[0]?.pChampion ?? 1;

  return (
    <div className="flex flex-col">
      {ranked.map((row, i) => (
        <OddsRow key={row.teamId} row={row} rank={i + 1} maxP={maxP} isLeader={i === 0} />
      ))}
    </div>
  );
}

/**
 * OddsPanel.tsx — "WHO LIFTS IT 🏆" top 12 by pChampion.
 * Animated bars (CSS width transition 600ms). Skeleton shimmer when null.
 */
import { useWorldCup } from '../data/store';

function formatPct(p: number): string {
  const pct = p * 100;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

const SKELETON_ROWS = 12;

export default function OddsPanel() {
  const { predictions, teams } = useWorldCup();

  const ranked = predictions
    ? Object.entries(predictions.outlooks)
        .map(([teamId, o]) => ({ teamId, pChampion: o.pChampion }))
        .filter(x => x.pChampion > 0)
        .sort((a, b) => b.pChampion - a.pChampion)
        .slice(0, 12)
    : null;

  // Max probability for scaling bars relatively
  const maxP = ranked ? (ranked[0]?.pChampion ?? 1) : 1;

  return (
    <div className="card area-odds">
      <div className="wc-odds__header">
        <span>🏆</span> WHO LIFTS IT
      </div>

      {ranked === null ? (
        /* Skeleton shimmer while predictions not available */
        <div className="wc-odds-list">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <div key={i} className="wc-skeleton-row">
              <div className="wc-skeleton-block" style={{ width: 14, height: 10, flexShrink: 0 }} />
              <div className="wc-skeleton-block" style={{ width: 18, height: 12, flexShrink: 0, borderRadius: 2 }} />
              <div className="wc-skeleton-block" style={{ width: 32, height: 10, flexShrink: 0 }} />
              <div className="wc-skeleton-block" style={{ flex: 1, height: 5 }} />
              <div className="wc-skeleton-block" style={{ width: 32, height: 10, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="wc-odds-list">
          {ranked.map(({ teamId, pChampion }, i) => {
            const team = teams[teamId];
            const barPct = maxP > 0 ? (pChampion / maxP) * 100 : 0;
            const isTop = i === 0;

            return (
              <div key={teamId} className="wc-odds-row">
                <span className="wc-odds-row__rank">{i + 1}</span>

                {team?.flagUrl
                  ? <img src={team.flagUrl} className="flag flag-sm" alt={team.code} loading="lazy" />
                  : <span style={{ width: 18, flexShrink: 0, display: 'inline-block' }} />
                }

                <span className="wc-odds-row__code">{team?.code ?? teamId}</span>

                <div className="wc-odds-row__bar-track" title={`${formatPct(pChampion)} chance to win`}>
                  <div
                    className={`wc-odds-row__bar-fill${isTop ? ' wc-odds-row__bar-fill--gold' : ' wc-odds-row__bar-fill--accent'}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>

                <span className="wc-odds-row__pct">{formatPct(pChampion)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

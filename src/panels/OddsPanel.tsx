/**
 * OddsPanel.tsx — stub. Panels agent replaces internals.
 * "WHO LIFTS IT" — top 12 teams by pChampion probability.
 */
import { useWorldCup } from '../data/store';
import { pct } from '../lib/format';

export default function OddsPanel() {
  const { predictions, teams } = useWorldCup();

  const ranked = predictions
    ? Object.entries(predictions.outlooks)
        .map(([teamId, o]) => ({ teamId, pChampion: o.pChampion }))
        .sort((a, b) => b.pChampion - a.pChampion)
        .slice(0, 12)
    : [];

  return (
    <div className="card area-odds">
      <div className="card-label">Who Lifts It</div>
      {ranked.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>Predictions loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ranked.map(({ teamId, pChampion }, i) => {
            const team = teams[teamId];
            return (
              <div key={teamId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', width: 14, textAlign: 'right' }}>{i + 1}</span>
                {team?.flagUrl && <img src={team.flagUrl} className="flag flag-sm" alt={team.code} />}
                <span style={{ fontSize: 11, fontWeight: 500, width: 32 }}>{team?.code ?? teamId}</span>
                <div style={{ flex: 1, height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${pChampion * 100}%`,
                    background: i === 0 ? 'var(--gold)' : 'var(--accent)',
                    borderRadius: 2,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <span className="tabular" style={{ fontSize: 10, color: 'var(--muted)', width: 32, textAlign: 'right' }}>
                  {pct(pChampion)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Bracket.tsx — stub. Panels agent replaces internals.
 * SVG knockout bracket from R32→Final.
 */
import { useWorldCup, selectBracketRounds } from '../data/store';

export default function Bracket() {
  const rounds = useWorldCup(selectBracketRounds);
  const { teams } = useWorldCup();

  return (
    <div className="card area-bracket" style={{ overflowX: 'auto' }}>
      <div className="card-label">Bracket</div>
      {rounds.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>Bracket loading…</div>
      ) : (
        <div style={{ display: 'flex', gap: 16, minWidth: 'max-content' }}>
          {rounds.map(({ stage, matches }) => (
            <div key={stage} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {stage === 'r32' ? 'R32' : stage === 'r16' ? 'R16' : stage === 'qf' ? 'QF' : stage === 'sf' ? 'SF' : stage === 'final' ? 'Final' : stage}
              </div>
              {matches.map(m => {
                const homeTeam = m.home.kind === 'team' ? teams[m.home.teamId] : null;
                const awayTeam = m.away.kind === 'team' ? teams[m.away.teamId] : null;
                const homeLabel = homeTeam?.code ?? (m.home.kind === 'placeholder' ? m.home.label.slice(0, 6) : '---');
                const awayLabel = awayTeam?.code ?? (m.away.kind === 'placeholder' ? m.away.label.slice(0, 6) : '---');

                return (
                  <div key={m.id} style={{
                    width: 100,
                    padding: '6px 8px',
                    background: 'var(--bg1)',
                    border: `1px solid ${m.state === 'in' ? 'var(--live)' : 'var(--line)'}`,
                    borderRadius: 6,
                    fontSize: 10,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: (m.home.kind === 'team' && m.winnerTeamId === m.home.teamId) ? 600 : 400 }}>
                      <span>{homeLabel}</span>
                      {m.homeScore !== undefined && <span className="tabular">{m.homeScore}</span>}
                    </div>
                    <div style={{ borderTop: '1px solid var(--line)', margin: '3px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: (m.away.kind === 'team' && m.winnerTeamId === m.away.teamId) ? 600 : 400 }}>
                      <span>{awayLabel}</span>
                      {m.awayScore !== undefined && <span className="tabular">{m.awayScore}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

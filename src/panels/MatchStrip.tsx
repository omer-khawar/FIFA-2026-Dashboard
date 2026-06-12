/**
 * MatchStrip.tsx — stub. Panels agent replaces internals.
 * Horizontal scroll strip showing live → today → next matches.
 */
import { useWorldCup, selectLive } from '../data/store';
import { kickoffTime } from '../lib/format';

export default function MatchStrip() {
  const { matches, teams, setFocusVenue } = useWorldCup();
  const live = useWorldCup(selectLive);

  // Show: live, then pre sorted by date
  const strip = [
    ...live,
    ...matches
      .filter(m => m.state === 'pre')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 12),
  ].slice(0, 20);

  return (
    <div className="card area-strip" style={{ padding: '12px 16px' }}>
      <div className="card-label">Matches</div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {strip.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>No matches to display</div>
        )}
        {strip.map(m => {
          const homeTeam = m.home.kind === 'team' ? teams[m.home.teamId] : null;
          const awayTeam = m.away.kind === 'team' ? teams[m.away.teamId] : null;
          const isLive = m.state === 'in';

          return (
            <div
              key={m.id}
              onClick={() => setFocusVenue(m.venueId)}
              style={{
                flexShrink: 0,
                width: 140,
                padding: '10px 12px',
                background: 'var(--bg1)',
                border: `1px solid ${isLive ? 'var(--live)' : 'var(--line)'}`,
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: isLive ? 'var(--live)' : 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                {isLive ? <><span className="live-dot" style={{ marginRight: 4 }} />{m.clock ?? 'LIVE'}</> : kickoffTime(m.date)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {homeTeam?.flagUrl && <img src={homeTeam.flagUrl} className="flag flag-sm" alt={homeTeam.code} />}
                  <span style={{ fontWeight: 500 }}>{homeTeam?.code ?? (m.home.kind === 'placeholder' ? m.home.label.slice(0,8) : '?')}</span>
                  {m.homeScore !== undefined && <span className="tabular" style={{ marginLeft: 'auto' }}>{m.homeScore}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {awayTeam?.flagUrl && <img src={awayTeam.flagUrl} className="flag flag-sm" alt={awayTeam.code} />}
                  <span style={{ fontWeight: 500 }}>{awayTeam?.code ?? (m.away.kind === 'placeholder' ? m.away.label.slice(0,8) : '?')}</span>
                  {m.awayScore !== undefined && <span className="tabular" style={{ marginLeft: 'auto' }}>{m.awayScore}</span>}
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 9, color: 'var(--muted)' }}>{m.city}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

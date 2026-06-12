/**
 * GroupsGrid.tsx — stub. Panels agent replaces internals.
 * Shows 12 group cards (A–L), each listing teams with basic standings.
 */
import { useWorldCup } from '../data/store';

export default function GroupsGrid() {
  const { groups, teams, predictions } = useWorldCup();

  return (
    <div className="card area-groups">
      <div className="card-label">Groups</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
      }}>
        {groups.map(group => (
          <div key={group.id} style={{
            background: 'var(--bg1)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '8px 10px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 6, letterSpacing: '0.05em' }}>
              GROUP {group.id}
            </div>
            {group.rows.map(row => {
              const team = teams[row.teamId];
              const pR32 = predictions?.outlooks?.[row.teamId]?.pR32;
              return (
                <div key={row.teamId} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 0',
                  borderLeft: row.noteColor ? `2px solid ${row.noteColor}` : '2px solid transparent',
                  paddingLeft: 4,
                }}>
                  {team?.flagUrl && (
                    <img src={team.flagUrl} className="flag flag-sm" alt={team.code} />
                  )}
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {team?.code ?? row.teamId}
                  </span>
                  <span className="tabular" style={{ fontSize: 11, color: 'var(--muted)', minWidth: 14, textAlign: 'right' }}>
                    {row.points}
                  </span>
                  {pR32 !== undefined && (
                    <div style={{ width: 24, height: 3, background: 'var(--line)', borderRadius: 1.5, overflow: 'hidden', marginLeft: 2 }}>
                      <div style={{ height: '100%', width: `${pR32 * 100}%`, background: 'var(--accent)', borderRadius: 1.5 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

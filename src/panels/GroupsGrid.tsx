/**
 * GroupsGrid.tsx — 12 group cards A–L in a 4-col grid.
 * Each card: rank, flag, code, Pts (bold), GD (signed), ESPN noteColor stripe,
 * advance-prob bar (pR32), live-match pulse dot.
 */
import { useMemo } from 'react';
import { useWorldCup } from '../data/store';

function signedGD(gd: number): string {
  if (gd > 0) return `+${gd}`;
  return String(gd);
}

export default function GroupsGrid() {
  const { groups, teams, predictions, matches } = useWorldCup();
  const live = useMemo(() => matches.filter(m => m.state === 'in'), [matches]);

  // Set of teamIds currently in a live match
  const liveTeamIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of live) {
      if (m.home.kind === 'team') ids.add(m.home.teamId);
      if (m.away.kind === 'team') ids.add(m.away.teamId);
    }
    return ids;
  }, [live]);

  // Max pR32 across all teams (for scaling the bar relative to 100%)
  // pR32 is already a probability 0..1 so we use it directly.

  return (
    <div className="card area-groups">
      <div className="card-label">Groups</div>
      <div className="wc-groups-grid">
        {groups.map(group => (
          <div key={group.id} className="wc-group-card">
            <div className="wc-group-card__header">GROUP {group.id}</div>

            {group.rows.map(row => {
              const team = teams[row.teamId];
              const isLiveNow = liveTeamIds.has(row.teamId);
              const pR32 = predictions?.outlooks?.[row.teamId]?.pR32;

              return (
                <div key={row.teamId} className="wc-group-row">
                  {/* Qualification stripe */}
                  {row.noteColor && (
                    <div
                      className="wc-group-row__stripe"
                      style={{ background: row.noteColor }}
                      title={row.noteDesc ?? ''}
                    />
                  )}

                  <span className="wc-group-row__rank">{row.rank}</span>

                  <div className="wc-group-row__flag-wrap">
                    {team?.flagUrl && (
                      <img
                        src={team.flagUrl}
                        className="flag flag-sm"
                        alt={team?.code ?? row.teamId}
                        loading="lazy"
                      />
                    )}
                    {isLiveNow && <span className="wc-group-row__live-dot" aria-label="Live match" />}
                  </div>

                  <span className="wc-group-row__code">
                    {team?.code ?? row.teamId}
                  </span>

                  <span className="wc-group-row__pts">{row.points}</span>

                  <span className="wc-group-row__gd">{signedGD(row.gd)}</span>

                  {/* Advance-probability bar */}
                  <div className="wc-group-row__pbar-wrap">
                    {pR32 !== undefined && (
                      <div
                        className="wc-group-row__pbar-fill"
                        style={{ width: `${Math.round(pR32 * 100)}%` }}
                        title={`${Math.round(pR32 * 100)}% advance`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * MatchStrip.tsx — horizontal scroll strip: LIVE → today upcoming → next ~15 → recent post.
 * Each card 180px. Click → setFocusVenue. W/D/L tri-bar from predictions when available.
 */
import { useMemo } from 'react';
import { useWorldCup } from '../data/store';
import { kickoffTime } from '../lib/format';
import type { Match } from '../lib/types';

/** Shorten a placeholder label per spec */
function shortenLabel(label: string): string {
  // "Group A Winner" → "A1"
  let m = label.match(/^Group ([A-L]) Winner$/i);
  if (m) return `${m[1]}1`;

  // "Group A 2nd Place" → "A2"
  m = label.match(/^Group ([A-L]) 2nd Place$/i);
  if (m) return `${m[1]}2`;

  // "Third Place Group A/B/C/D/F" → "3rd A–F" style
  m = label.match(/^Third Place Group (.+)$/i);
  if (m) {
    const groups = m[1].replace(/\//g, '/');
    // Shorten long group lists
    const parts = groups.split('/');
    if (parts.length > 3) return `3rd ${parts[0]}…${parts[parts.length - 1]}`;
    return `3rd ${groups}`;
  }

  // "Round of 32 9 Winner" → "W·R32-9"
  m = label.match(/^Round of 32 (\d+) Winner$/i);
  if (m) return `W·R32-${m[1]}`;

  // "Round of 16 N Winner" → "W·R16-N"
  m = label.match(/^Round of 16 (\d+) Winner$/i);
  if (m) return `W·R16-${m[1]}`;

  // "Quarterfinal N Winner" → "W·QF-N"
  m = label.match(/^Quarterfinal (\d+) Winner$/i);
  if (m) return `W·QF-${m[1]}`;

  // "Semifinal N Winner" → "W·SF-N"
  m = label.match(/^Semifinal (\d+) Winner$/i);
  if (m) return `W·SF-${m[1]}`;

  // Fallback: first 8 chars
  return label.slice(0, 8);
}

/** Stage → short chip label */
function stageChip(m: Match): string {
  if (m.stage === 'group') return `GRP ${m.group ?? ''}`;
  if (m.stage === 'r32')   return 'R32';
  if (m.stage === 'r16')   return 'R16';
  if (m.stage === 'qf')    return 'QF';
  if (m.stage === 'sf')    return 'SF';
  if (m.stage === 'third') return '3RD';
  if (m.stage === 'final') return 'FINAL';
  return (m.stage as string).toUpperCase();
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

export default function MatchStrip() {
  const { matches, teams, predictions, setFocusVenue } = useWorldCup();

  const strip: Match[] = useMemo(() => {
    const live = matches.filter(m => m.state === 'in');
    const liveIds = new Set(live.map(m => m.id));

    const todayPre = matches
      .filter(m => m.state === 'pre' && isToday(m.date))
      .sort((a, b) => a.date.localeCompare(b.date));

    const futurePre = matches
      .filter(m => m.state === 'pre' && !isToday(m.date))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 15);

    const recentPost = matches
      .filter(m => m.state === 'post')
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .reverse();

    // Live first, then today pre, then next up to 15, then recents
    const all = [
      ...live,
      ...todayPre,
      ...futurePre,
      ...recentPost.filter(m => !liveIds.has(m.id)),
    ];
    // Deduplicate by id
    const seen = new Set<string>();
    return all.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
  }, [matches]);

  return (
    <div className="card area-strip" style={{ padding: '12px 16px' }}>
      <div className="card-label">Matches</div>
      <div className="wc-strip">
        {strip.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 12, padding: '4px 0' }}>
            No matches to display
          </div>
        )}
        {strip.map(m => {
          const isLive = m.state === 'in';
          const isPost = m.state === 'post';

          const homeTeam = m.home.kind === 'team' ? teams[m.home.teamId] : null;
          const awayTeam = m.away.kind === 'team' ? teams[m.away.teamId] : null;

          const homeWinner = isPost && m.winnerTeamId !== undefined
            && m.home.kind === 'team' && m.winnerTeamId === m.home.teamId;
          const awayWinner = isPost && m.winnerTeamId !== undefined
            && m.away.kind === 'team' && m.winnerTeamId === m.away.teamId;

          // Probability tri-bar
          const probs = predictions?.matchProbs?.[m.id];
          const showProbs = probs !== undefined && m.state !== 'post';

          const homeLabel = m.home.kind === 'team'
            ? (homeTeam?.code ?? '?')
            : shortenLabel(m.home.label);
          const awayLabel = m.away.kind === 'team'
            ? (awayTeam?.code ?? '?')
            : shortenLabel(m.away.label);
          const homeIsPlaceholder = m.home.kind === 'placeholder';
          const awayIsPlaceholder = m.away.kind === 'placeholder';

          return (
            <div
              key={m.id}
              className={`wc-match-card${isLive ? ' wc-match-card--live' : ''}`}
              onClick={() => setFocusVenue(m.venueId)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setFocusVenue(m.venueId); }}
              aria-label={`${homeLabel} vs ${awayLabel}`}
            >
              {/* Header row: chip + live clock / kickoff time */}
              <div className="wc-match-card__head">
                <span className={`wc-match-card__chip${isLive ? ' wc-match-card__chip--live' : ''}`}>
                  {stageChip(m)}
                </span>
                {isLive
                  ? (
                    <span className="wc-match-card__clock">
                      <span className="live-dot" aria-hidden="true" />
                      {m.clock ?? m.statusDetail ?? 'LIVE'}
                    </span>
                  )
                  : isPost
                    ? <span className="wc-match-card__time">FT</span>
                    : <span className="wc-match-card__time">{kickoffTime(m.date)}</span>
                }
              </div>

              {/* Teams */}
              <div className="wc-match-card__teams">
                {/* Home */}
                <div className={`wc-match-card__team-row${homeWinner ? ' wc-match-card__team-row--winner' : ''}`}>
                  {homeTeam?.flagUrl
                    ? <img src={homeTeam.flagUrl} className="flag flag-sm" alt={homeTeam.code} loading="lazy" />
                    : !homeIsPlaceholder && <span style={{ width: 18, flexShrink: 0 }} />
                  }
                  {homeIsPlaceholder
                    ? <span className="wc-match-card__placeholder" title={m.home.kind === 'placeholder' ? m.home.label : undefined}>{homeLabel}</span>
                    : <span className="wc-match-card__code">{homeLabel}</span>
                  }
                  {m.homeScore !== undefined
                    ? <span className="wc-match-card__score">{m.homeScore}</span>
                    : <span className="wc-match-card__score wc-match-card__score--dash">–</span>
                  }
                </div>

                <div className="wc-match-card__divider" />

                {/* Away */}
                <div className={`wc-match-card__team-row${awayWinner ? ' wc-match-card__team-row--winner' : ''}`}>
                  {awayTeam?.flagUrl
                    ? <img src={awayTeam.flagUrl} className="flag flag-sm" alt={awayTeam.code} loading="lazy" />
                    : !awayIsPlaceholder && <span style={{ width: 18, flexShrink: 0 }} />
                  }
                  {awayIsPlaceholder
                    ? <span className="wc-match-card__placeholder" title={m.away.kind === 'placeholder' ? m.away.label : undefined}>{awayLabel}</span>
                    : <span className="wc-match-card__code">{awayLabel}</span>
                  }
                  {m.awayScore !== undefined
                    ? <span className="wc-match-card__score">{m.awayScore}</span>
                    : <span className="wc-match-card__score wc-match-card__score--dash">–</span>
                  }
                </div>
              </div>

              {/* W/D/L probability bar */}
              {showProbs && (
                <div className="wc-match-card__probs" title={`Home ${Math.round(probs.pHome*100)}% · Draw ${Math.round(probs.pDraw*100)}% · Away ${Math.round(probs.pAway*100)}%`}>
                  <div className="wc-match-card__prob-home" style={{ flex: probs.pHome }} />
                  <div className="wc-match-card__prob-draw" style={{ flex: probs.pDraw }} />
                  <div className="wc-match-card__prob-away" style={{ flex: probs.pAway }} />
                </div>
              )}

              {/* Footer: city */}
              <div className="wc-match-card__footer">{m.city}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

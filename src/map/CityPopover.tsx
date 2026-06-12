/**
 * CityPopover.tsx — DOM overlay (absolute, right side of the map card).
 *
 * When focusVenueId is set, shows the focused stadium's name, city, capacity and
 * its matches (from selectByVenue): stage chip, flags + codes (via teams), score
 * if played/live (live red pulse) or kickoff local time otherwise. Placeholder
 * slots render their label dimmed. Close button → setFocusVenue(null).
 *
 * Glass style matches the shared card (--panel / --line tokens).
 */

import { useWorldCup } from '../data/store';
import type { Match, Slot, Stadium, Team } from '../lib/types';
import { kickoffTime, dateLabel } from '../lib/format';

const STAGE_LABEL: Record<string, string> = {
  group: 'GROUP',
  r32: 'R32',
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  third: '3RD',
  final: 'FINAL',
};

function SlotRow({
  slot,
  team,
  score,
  winner,
  live,
}: {
  slot: Slot;
  team?: Team;
  score?: number;
  winner: boolean;
  live: boolean;
}) {
  if (slot.kind === 'placeholder') {
    return (
      <div style={rowStyle}>
        <span style={{ ...placeholderStyle }}>{slot.label}</span>
        <span style={{ width: 22 }} />
      </div>
    );
  }
  return (
    <div style={rowStyle}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {team?.flagUrl ? (
          <img src={team.flagUrl} alt="" className="flag-sm" style={{ borderRadius: 2 }} />
        ) : (
          <span className="flag-sm" style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 2 }} />
        )}
        <span
          style={{
            fontSize: 12,
            fontWeight: winner ? 700 : 500,
            color: winner ? '#e8eefc' : '#c3cce0',
          }}
        >
          {team?.code ?? '—'}
        </span>
      </span>
      <span
        className="tabular"
        style={{
          fontSize: 13,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: live ? '#f43f5e' : winner ? '#e8eefc' : '#8b97b0',
        }}
      >
        {score ?? '–'}
      </span>
    </div>
  );
}

function MatchCard({ match, teams }: { match: Match; teams: Record<string, Team> }) {
  const live = match.state === 'in';
  const played = match.state === 'post';
  const showScore = live || played;

  const homeTeam = match.home.kind === 'team' ? teams[match.home.teamId] : undefined;
  const awayTeam = match.away.kind === 'team' ? teams[match.away.teamId] : undefined;
  const homeWin = played && match.winnerTeamId != null && match.home.kind === 'team' && match.winnerTeamId === match.home.teamId;
  const awayWin = played && match.winnerTeamId != null && match.away.kind === 'team' && match.winnerTeamId === match.away.teamId;

  const stage = match.stage === 'group' && match.group ? `GROUP ${match.group}` : STAGE_LABEL[match.stage] ?? match.stage.toUpperCase();

  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 10,
        padding: '9px 11px',
        background: live ? 'rgba(244,63,94,0.07)' : 'rgba(255,255,255,0.02)',
        borderColor: live ? 'rgba(244,63,94,0.4)' : 'var(--line)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#8b97b0',
            background: 'rgba(255,255,255,0.05)',
            padding: '2px 6px',
            borderRadius: 5,
          }}
        >
          {stage}
        </span>
        {live ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#f43f5e' }}>
            <span className="live-dot" />
            {match.clock || match.statusDetail || 'LIVE'}
          </span>
        ) : played ? (
          <span style={{ fontSize: 10, color: '#8b97b0', fontWeight: 600 }}>FT</span>
        ) : (
          <span style={{ fontSize: 10, color: '#8b97b0', fontWeight: 600 }}>
            {dateLabel(match.date)} · {kickoffTime(match.date)}
          </span>
        )}
      </div>
      <SlotRow slot={match.home} team={homeTeam} score={showScore ? match.homeScore : undefined} winner={homeWin} live={live} />
      <SlotRow slot={match.away} team={awayTeam} score={showScore ? match.awayScore : undefined} winner={awayWin} live={live} />
    </div>
  );
}

export default function CityPopover() {
  const focusVenueId = useWorldCup((s) => s.focusVenueId);
  const stadiums = useWorldCup((s) => s.stadiums);
  const teams = useWorldCup((s) => s.teams);
  const setFocusVenue = useWorldCup((s) => s.setFocusVenue);
  const matches = useWorldCup((s) => s.matches);

  if (!focusVenueId) return null;
  const stadium: Stadium | undefined = stadiums.find((s) => s.venueId === focusVenueId);
  if (!stadium) return null;

  const venueMatches = matches
    .filter((m) => m.venueId === focusVenueId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        bottom: 16,
        width: 'min(300px, 42%)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(10, 15, 26, 0.78)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.55)',
        overflow: 'hidden',
        animation: 'mapPopIn 0.28s ease',
      }}
    >
      <style>{`@keyframes mapPopIn { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }`}</style>

      {/* header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--line)', position: 'relative' }}>
        <button
          onClick={() => setFocusVenue(null)}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 24,
            height: 24,
            borderRadius: 7,
            border: '1px solid var(--line)',
            background: 'rgba(255,255,255,0.04)',
            color: '#8b97b0',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#22d3ee', marginBottom: 4 }}>
          {stadium.country} · HOST VENUE
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e8eefc', paddingRight: 28, lineHeight: 1.2 }}>
          {stadium.name}
        </div>
        <div style={{ fontSize: 12, color: '#8b97b0', marginTop: 2 }}>
          {stadium.city} ·{' '}
          <span className="tabular" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {stadium.capacity.toLocaleString()}
          </span>{' '}
          cap
        </div>
      </div>

      {/* matches */}
      <div style={{ padding: '12px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#8b97b0', textTransform: 'uppercase' }}>
          {venueMatches.length} {venueMatches.length === 1 ? 'Match' : 'Matches'}
        </div>
        {venueMatches.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8b97b0', opacity: 0.7, padding: '8px 0' }}>
            No matches scheduled yet.
          </div>
        ) : (
          venueMatches.map((m) => <MatchCard key={m.id} match={m} teams={teams} />)
        )}
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '2px 0',
};

const placeholderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: '#6b7790',
  fontStyle: 'italic',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/**
 * Header.tsx — stub. Panels agent replaces internals.
 * Shows title, tournament progress, lastUpdated, and working Refresh button.
 */
import { useWorldCup } from '../data/store';
import { kickoffTime } from '../lib/format';

export default function Header() {
  const { status, lastUpdated, matches, refresh } = useWorldCup();
  const played = matches.filter(m => m.state === 'post').length;
  const isLoading = status === 'loading';

  return (
    <header className="card area-header" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--accent)' }}>WC26</span>
          <span style={{ color: 'var(--muted)', margin: '0 8px' }}>·</span>
          <span>LIVE TRACKER</span>
        </h1>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
          FIFA World Cup 2026 · Jun 11 – Jul 19
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Tournament progress bar */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
            {played}/104 matches played
          </div>
          <div style={{ width: 160, height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${(played / 104) * 100}%`,
                background: 'var(--accent)',
                borderRadius: 2,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        {/* Last updated */}
        {lastUpdated && (
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Updated {kickoffTime(lastUpdated)}
          </div>
        )}

        {/* Refresh button */}
        <button
          onClick={() => void refresh()}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            color: isLoading ? 'var(--muted)' : 'var(--accent)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--font)',
            transition: 'all 0.2s',
          }}
        >
          {isLoading ? <span className="spinner" /> : null}
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </header>
  );
}

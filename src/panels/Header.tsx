/**
 * Header.tsx — WC26 lockup, progress bar, last-updated, spinning refresh.
 * panels.css is imported here (once for the whole panels module).
 */
import { useState } from 'react';
import { useWorldCup } from '../data/store';
import { kickoffTime } from '../lib/format';
import './panels.css';

export default function Header() {
  const { status, lastUpdated, matches, refresh } = useWorldCup();
  const [spinning, setSpinning] = useState(false);

  const played = matches.filter(m => m.state === 'post').length;
  const pct = matches.length > 0 ? (played / 104) * 100 : 0;

  const handleRefresh = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      await refresh();
    } finally {
      setSpinning(false);
    }
  };

  const isSpinning = spinning || status === 'loading';

  return (
    <header className="card area-header wc-header">
      {/* Lockup */}
      <div className="wc-header__lockup">
        <div className="wc-header__title">
          <span style={{ color: 'var(--accent)' }}>WC26</span>
          <span style={{ color: 'var(--muted)', margin: '0 8px' }}>·</span>
          <span>LIVE TRACKER</span>
        </div>
        <div className="wc-header__subtitle">FIFA World Cup 2026 · Jun 11 – Jul 19</div>
      </div>

      {/* Controls row */}
      <div className="wc-header__controls">
        {/* Progress */}
        <div>
          <div className="wc-header__progress-label">
            {played} / 104 matches played
          </div>
          <div className="wc-header__progress-track">
            <div
              className="wc-header__progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Last updated */}
        {lastUpdated && (
          <div className="wc-header__updated">
            Updated {kickoffTime(lastUpdated)}
          </div>
        )}

        {/* Refresh button */}
        <button
          className="wc-btn-refresh"
          onClick={() => void handleRefresh()}
          disabled={isSpinning}
          aria-label="Refresh data"
        >
          {isSpinning
            ? <span className="spinner" aria-hidden="true" />
            : (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path
                  d="M11 6.5A4.5 4.5 0 1 1 6.5 2a4.47 4.47 0 0 1 3.18 1.32L8.5 4.5H12V1l-1.32 1.32A6 6 0 1 0 12.5 6.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )
          }
          {isSpinning ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </header>
  );
}

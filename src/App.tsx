/**
 * App.tsx — layout shell. Only Integration agent may edit after Foundation.
 * Mounts data loading + predictions hook; renders the 5-row CSS grid.
 */
import { useEffect } from 'react';
import { useWorldCup } from './data/store';
import { usePredictions } from './engine/usePredictions';

// Panel components (stubs; replaced by Panels agent)
import Header from './panels/Header';
import MatchStrip from './panels/MatchStrip';
import GroupsGrid from './panels/GroupsGrid';
import Bracket from './panels/Bracket';
import OddsPanel from './panels/OddsPanel';
import NewsRow from './panels/NewsRow';

// Map component (stub; replaced by Map agent)
import MapPanel from './map/MapPanel';

export default function App() {
  const { load, status } = useWorldCup();

  // Load data once on mount
  useEffect(() => {
    void load();
  }, [load]);

  // Mount predictions hook (no-op stub; Engine agent replaces)
  usePredictions();

  return (
    <div className="app-grid">
      <Header />
      <MapPanel />
      <Bracket />
      <MatchStrip />
      <GroupsGrid />
      <OddsPanel />
      <NewsRow />

      {/* Loading overlay for initial load */}
      {status === 'loading' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(7, 11, 20, 0.8)',
          backdropFilter: 'blur(4px)',
          flexDirection: 'column',
          gap: 12,
          pointerEvents: 'none',
        }}>
          <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Loading World Cup data…</span>
        </div>
      )}

      {/* Error banner */}
      {status === 'error' && (
        <div style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 200,
          padding: '10px 20px',
          background: 'rgba(244, 63, 94, 0.15)',
          border: '1px solid var(--live)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--live)',
        }}>
          Data load error — check connection and refresh
        </div>
      )}
    </div>
  );
}

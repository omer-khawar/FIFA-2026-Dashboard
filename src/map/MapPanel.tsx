/**
 * MapPanel.tsx — card wrapper for the 3D host-cities map (the visual hero).
 *
 * Holds the r3f <Scene> Canvas over a CSS radial gradient, the <CityPopover>
 * DOM overlay, and a tiny legend. Renders a skeleton until hostGeo + stadiums
 * arrive (store may briefly be 'loading'). Export shape preserved from the stub:
 * a default function rendering `.card area-map`.
 */

import { Suspense } from 'react';
import { useWorldCup } from '../data/store';
import Scene from './Scene';
import CityPopover from './CityPopover';

function Legend() {
  const dot = (color: string): React.CSSProperties => ({
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: color,
    boxShadow: `0 0 7px ${color}`,
    flexShrink: 0,
  });
  const item: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
    fontWeight: 600,
    color: '#8b97b0',
    letterSpacing: '0.03em',
  };
  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        zIndex: 10,
        display: 'flex',
        gap: 14,
        padding: '8px 12px',
        borderRadius: 10,
        background: 'rgba(10, 15, 26, 0.6)',
        border: '1px solid var(--line)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        pointerEvents: 'none',
      }}
    >
      <span style={item}>
        <span style={dot('#f43f5e')} />
        LIVE
      </span>
      <span style={item}>
        <span style={dot('#fbbf24')} />
        TODAY
      </span>
      <span style={item}>
        <span style={dot('#22d3ee')} />
        VENUE
      </span>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        color: 'var(--muted)',
      }}
    >
      <span className="spinner" style={{ width: 22, height: 22, borderWidth: 3 }} />
      <span style={{ fontSize: 12 }}>Rendering host map…</span>
    </div>
  );
}

export default function MapPanel() {
  const ready = useWorldCup((s) => s.hostGeo != null && s.stadiums.length > 0);

  return (
    <div
      className="card area-map"
      style={{
        position: 'relative',
        minHeight: 420,
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {/* card title overlay */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 16,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <div className="card-label" style={{ margin: 0 }}>
          HOST CITIES
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.7 }}>
          USA · Canada · Mexico
        </div>
      </div>

      {/* CSS radial gradient backdrop behind the transparent canvas */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 90% 75% at 50% 38%, #0e1830 0%, #0a1020 45%, #060a12 100%)',
        }}
      />

      {ready ? (
        <Suspense fallback={<MapSkeleton />}>
          <Scene />
          <CityPopover />
          <Legend />
        </Suspense>
      ) : (
        <MapSkeleton />
      )}
    </div>
  );
}

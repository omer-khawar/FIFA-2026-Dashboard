/**
 * MapPanel.tsx — stub. Map agent replaces internals.
 * Placeholder card while 3D map loads.
 */
export default function MapPanel() {
  return (
    <div className="card area-map" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 420,
      color: 'var(--muted)',
      fontSize: 14,
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ fontSize: 32 }}>🗺️</div>
      <div>3D map loading…</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.6 }}>
        USA · Canada · Mexico host venues
      </div>
    </div>
  );
}

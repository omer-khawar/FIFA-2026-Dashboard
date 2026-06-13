/**
 * MapPanel.tsx — the full-bleed STAGE root (blueprint §2 / §9).
 *
 * No more `.card` chrome: the map is the stage behind the floating HUD rails.
 * MapPanel is just `h-full w-full relative` and holds the r3f <Scene> over a
 * radial backdrop plus a minimal legend (bottom-left glass pill of LIVE / TODAY /
 * VENUE micro-label chips in the three state colors). City details now live in
 * the Context Rail (a parallel agent), driven by store.focusVenueId which the
 * beacons set on click — CityPopover is deleted. Hover labels stay in-canvas.
 *
 * Renders a skeleton until hostGeo + stadiums arrive. Export name preserved.
 */

import { Suspense } from 'react';
import { useWorldCup } from '../data/store';
import Scene from './Scene';

const LEGEND: Array<{ label: string; color: string }> = [
  { label: 'LIVE', color: '#FF4655' },
  { label: 'TODAY', color: '#FF7A1A' },
  { label: 'VENUE', color: '#00E5FF' },
];

function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex items-center gap-3 rounded-full border border-hairline bg-glass px-3.5 py-1.5 backdrop-blur-xl">
      {LEGEND.map(({ label, color }) => (
        <span
          key={label}
          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-dust"
        >
          <span
            className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
            style={{ background: color, boxShadow: `0 0 7px ${color}` }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-dust">
      <span className="spinner" style={{ width: 22, height: 22, borderWidth: 3 }} />
      <span className="text-[12px]">Rendering host map…</span>
    </div>
  );
}

export default function MapPanel() {
  const ready = useWorldCup((s) => s.hostGeo != null && s.stadiums.length > 0);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Radial floodlight backdrop behind the transparent canvas. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 50% 42%, #0c1424 0%, #080d18 48%, #050608 100%)',
        }}
      />

      {ready ? (
        <Suspense fallback={<MapSkeleton />}>
          <Scene />
          <Legend />
        </Suspense>
      ) : (
        <MapSkeleton />
      )}
    </div>
  );
}

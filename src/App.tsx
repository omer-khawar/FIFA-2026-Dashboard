/**
 * App.tsx — HUD shell (blueprint §1.1 / §1.2). Phase-1 SHELL agent owns this file.
 *
 * The 3D map is no longer "a card in row 2"; it is the full-bleed STAGE behind
 * floating HUD rails. Layout contract:
 *
 *   h-dvh overflow-hidden grid, rows [52px 1fr 118px]
 *   ├─ Row 1  TopBar        (z40)
 *   ├─ Row 2  Stage         (relative)
 *   │         ├─ MapPanel    absolute inset-0  (z0, full-bleed)
 *   │         ├─ DataDeck    absolute left-3 top-3 bottom-3 w-[416px]  (z10)
 *   │         └─ ContextRail absolute right-3 top-3 bottom-3 w-[360px] (z10)
 *   ├─ Row 3  TickerDock     (z20)
 *   └─ Theater (z50, fixed, mounted last)
 *
 * No page scrollbar ever exists (html/body/#root overflow hidden in global.css).
 * Data wiring (load() bootstrap + usePredictions StrictMode logic) is preserved
 * verbatim from the prior shell.
 */
import { useEffect } from 'react';
import { useWorldCup } from './data/store';
import { usePredictions } from './engine/usePredictions';

// HUD shell layers (Phase-1 stubs wrapping existing components).
import TopBar from './panels/TopBar';
import DataDeck from './panels/DataDeck';
import ContextRail from './panels/ContextRail';
import TickerDock from './panels/TickerDock';
import Theater from './panels/Theater';

// Map component (stub; replaced by Map agent). Wrapped to fill the stage.
import MapPanel from './map/MapPanel';

export default function App() {
  const { load, status } = useWorldCup();

  // Load data once on mount.
  useEffect(() => {
    void load();
  }, [load]);

  // Mount predictions hook (StrictMode-safe; see usePredictions.ts).
  usePredictions();

  return (
    <div className="grid h-dvh grid-rows-[52px_1fr_118px] overflow-hidden">
      {/* Row 1 — TopBar */}
      <TopBar />

      {/* Row 2 — Stage: full-bleed map behind two floating rails */}
      <div className="relative min-h-0">
        {/* Stage: MapPanel fills inset-0 regardless of its own chrome. The map
            agent will strip MapPanel's `.card` wrapper; until then we force the
            wrapper to fill via descendant overrides so the map is full-bleed. */}
        <div className="absolute inset-0 z-0 [&>.card]:!h-full [&>.card]:!min-h-0 [&>.card]:!rounded-none [&>.card]:!border-0">
          <MapPanel />
        </div>

        {/* Left Rail — DATA DECK */}
        <div className="absolute left-3 top-3 bottom-3 z-10 w-[416px] max-[1439px]:w-[360px]">
          <DataDeck />
        </div>

        {/* Right Rail — CONTEXT */}
        <div className="absolute right-3 top-3 bottom-3 z-10 w-[360px] max-[1439px]:w-[320px]">
          <ContextRail />
        </div>
      </div>

      {/* Row 3 — Ticker Dock */}
      <TickerDock />

      {/* Theater overlay (mounted last; z50, fixed) */}
      <Theater />

      {/* Loading overlay for initial load */}
      {status === 'loading' && (
        <div
          className="pointer-events-none fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-void/80 backdrop-blur-sm"
        >
          <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
          <span className="text-[13px] text-dust">Loading World Cup data…</span>
        </div>
      )}

      {/* Error banner */}
      {status === 'error' && (
        <div className="fixed bottom-4 left-1/2 z-[200] -translate-x-1/2 rounded-lg border border-live bg-live/15 px-5 py-2.5 text-[12px] text-live">
          Data load error — check connection and refresh
        </div>
      )}
    </div>
  );
}

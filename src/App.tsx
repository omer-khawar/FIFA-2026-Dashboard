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
import IconRail from './panels/IconRail';
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
    <div className="relative h-dvh overflow-hidden">
      {/* FULL-BLEED MAP STAGE — the <Scene> canvas spans the ENTIRE viewport (100vh),
          all the way to the bottom edge. It is NOT confined to a grid row, so there
          is no leftover track beneath it and therefore no canvas↔body seam: the
          ticker dock is a floating pill ON the map. Camera framing is unchanged and
          stays clear of the rails / floating header / floating dock (verified). */}
      <div className="absolute inset-0 z-0">
        <MapPanel />
      </div>

      {/* TRANSPARENT HUD scaffold over the stage — TWO rows now: the 96px banner and
          a 1fr track that fills the ENTIRE rest of the viewport. The ticker no longer
          owns a grid track (it floats independently), so the 1fr row stretches all the
          way to the bottom and the side rails fill it. pointer-events-none lets clicks
          fall through to the map (beacons) except on the interactive HUD surfaces. */}
      <div className="pointer-events-none relative z-10 grid h-full grid-rows-[96px_1fr]">
        {/* Row 1 — TopBar banner (floats over the top of the map) */}
        <div className="pointer-events-auto">
          <TopBar />
        </div>

        {/* Row 2 — floating rails. Now stretch to the bottom of the screen (bottom-6
            keeps a comfortable margin off the raw edge); they flank the floating dock. */}
        <div className="relative min-h-0">
          {/* Left Rail — DATA DECK. Slim idle width frees map; hover / keyboard
              focus expands it as an overlay (camera is framed for the idle width,
              so expansion never reframes the map). */}
          <div className="pointer-events-auto absolute left-[68px] top-3 bottom-6 z-10 w-[280px] transition-[width] duration-300 ease-[var(--ease-hud)] hover:w-[360px] focus-within:w-[360px]">
            <DataDeck />
          </div>

          {/* Right Rail — CONTEXT. Right-anchored, so hover/focus expansion grows
              leftward over the map as an overlay (camera unaffected). */}
          <div className="pointer-events-auto absolute right-3 top-3 bottom-6 z-10 w-[308px] transition-[width] duration-300 ease-[var(--ease-hud)] hover:w-[372px] focus-within:w-[372px]">
            <ContextRail />
          </div>
        </div>
      </div>

      {/* Icon Rail — fixed full-height left strip above the map (z40), below
          Theater (z50). Sits over the floating rails (z10). */}
      <div className="fixed left-0 top-0 bottom-0 z-40 w-14">
        <IconRail />
      </div>

      {/* Ticker Dock — fully decoupled from the grid: a centered pill floating over
          the map's bottom edge (z30), flanked by the side rails. */}
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

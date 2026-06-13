/**
 * TickerDock.tsx — SHELL STUB (Phase 1) for the bottom Ticker Dock (§1.5).
 *
 * Bottom dock wrapper rendering the EXISTING <MatchStrip/>. The panels agent adds
 * the snap-sheet expand behaviour (useHud.dockOpen). Export name is frozen:
 * default `TickerDock`.
 */
import MatchStrip from './MatchStrip';

export default function TickerDock() {
  return (
    <div className="relative z-20 h-full w-full overflow-hidden px-3 pb-3 [&_.card]:!h-full [&_.card]:flex [&_.card]:flex-col [&_.card]:justify-center">
      <MatchStrip />
    </div>
  );
}

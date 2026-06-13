/**
 * Theater.tsx — SHELL STUB (Phase 1) for the modal Theater overlay (§1.3 / z30).
 *
 * Reads useHud.theater; renders null when closed. When set, shows a z-50 fixed
 * inset-0 overlay (backdrop blur + dim) closeable via click-outside, Esc, or the
 * ✕ button (all call setTheater(null)). For now the body is the EXISTING
 * <Bracket/> regardless of which view value is set — the panels agent swaps in
 * the per-view full bracket / groups / odds content. Export name is frozen:
 * default `Theater`.
 */
import { useEffect } from 'react';
import { useHud } from './uiStore';
import { FLOATING_PANEL } from './DataDeck';
import Bracket from './Bracket';

export default function Theater() {
  const theater = useHud((s) => s.theater);
  const setTheater = useHud((s) => s.setTheater);

  // Esc to close — only while open.
  useEffect(() => {
    if (theater === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTheater(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [theater, setTheater]);

  if (theater === null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-8 backdrop-blur-md"
      onClick={() => setTheater(null)}
      role="dialog"
      aria-modal="true"
      aria-label={`${theater} theater`}
    >
      <div
        className={`relative flex h-[84vh] w-[92vw] flex-col overflow-hidden ${FLOATING_PANEL}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-dust font-display">
            {theater}
          </span>
          <button
            onClick={() => setTheater(null)}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md border border-hairline text-dust transition-colors hover:border-neon/40 hover:text-neon"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-3 [&_.card]:!border-0 [&_.card]:!bg-transparent [&_.card]:!p-0 [&_.card]:!backdrop-blur-none">
          <Bracket />
        </div>
      </div>
    </div>
  );
}

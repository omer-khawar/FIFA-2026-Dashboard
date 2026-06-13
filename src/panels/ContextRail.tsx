/**
 * ContextRail.tsx — SHELL STUB (Phase 1) for the Right Rail "CONTEXT" (§1.4).
 *
 * Floating glass panel (§3.4 recipe). For now: a "CONTEXT" heading + the EXISTING
 * <NewsRow/> crammed in with internal scroll. The panels agent rewrites this into
 * the selection-aware NOW & NEXT / city / team panel with contextual news.
 * Export name is frozen: default `ContextRail`.
 */
import NewsRow from './NewsRow';
import { FLOATING_PANEL } from './DataDeck';

export default function ContextRail() {
  return (
    <section
      className={`flex h-full flex-col overflow-hidden ${FLOATING_PANEL}`}
      aria-label="Context"
    >
      <div className="shrink-0 border-b border-hairline px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-dust font-display">
        CONTEXT
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 [&_.card]:!border-0 [&_.card]:!bg-transparent [&_.card]:!p-0 [&_.card]:!backdrop-blur-none">
        <NewsRow />
      </div>
    </section>
  );
}

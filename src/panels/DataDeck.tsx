/**
 * DataDeck.tsx — SHELL STUB (Phase 1) for the Left Rail "DATA DECK" (§1.3).
 *
 * Floating glass panel (§3.4 recipe) with a 3-tab segmented header
 * (GROUPS | BRACKET | ODDS) wired to useHud.tab. Each tab body renders the
 * EXISTING component inside an internal scroll area (overflow-y auto,
 * overscroll-contain). Ugly but functional — the panels agent rewrites the
 * internals. Export name is frozen: default `DataDeck`.
 */
import { useHud, type DeckTab } from './uiStore';
import GroupsGrid from './GroupsGrid';
import Bracket from './Bracket';
import OddsPanel from './OddsPanel';

const TABS: { id: DeckTab; label: string }[] = [
  { id: 'groups', label: 'GROUPS' },
  { id: 'bracket', label: 'BRACKET' },
  { id: 'odds', label: 'ODDS' },
];

/** Shared floating-panel recipe (blueprint §3.4). */
export const FLOATING_PANEL =
  'rounded-2xl border border-hairline bg-glass backdrop-blur-xl ' +
  'shadow-[0_8px_40px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.04)]';

export default function DataDeck() {
  const tab = useHud((s) => s.tab);
  const setTab = useHud((s) => s.setTab);

  return (
    <section
      className={`flex h-full flex-col overflow-hidden ${FLOATING_PANEL}`}
      aria-label="Data deck"
    >
      {/* Segmented tab header */}
      <div className="flex shrink-0 gap-0.5 border-b border-hairline p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            data-active={tab === t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 rounded-md py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-dust transition-colors data-[active=true]:bg-neon/10 data-[active=true]:text-neon data-[active=true]:shadow-[inset_0_-2px_0_var(--color-neon)]"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab body — internal scroll area */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 [&_.card]:!border-0 [&_.card]:!bg-transparent [&_.card]:!p-0 [&_.card]:!backdrop-blur-none">
        {tab === 'groups' && <GroupsGrid />}
        {tab === 'bracket' && <Bracket />}
        {tab === 'odds' && <OddsPanel />}
      </div>
    </section>
  );
}

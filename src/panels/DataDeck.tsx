/**
 * DataDeck.tsx — Left Rail "DATA DECK" (blueprint §1.3 / §3.4).
 *
 * Floating glass panel with a 3-tab segmented header (GROUPS | BRACKET | ODDS),
 * keyboard ←/→ to switch, and a 200ms slide+fade body swap. Three tab bodies:
 *   GROUPS  — vertical scroll-snap carousel of 2×2 group micro-cards + A–L rail.
 *   BRACKET — in-rail vertical knockout spine (collapsible rounds) + theater button.
 *   ODDS    — full 48-team champion list, normalized bars, % beside every bar.
 * Export name frozen: default `DataDeck`. FLOATING_PANEL recipe re-exported.
 */
import { useCallback } from 'react';
import { useHud, type DeckTab } from './uiStore';
import GroupsTab from './deck/GroupsTab';
import BracketSpine from './deck/BracketSpine';
import OddsTab from './deck/OddsTab';
import RailShell, { type RailIcon } from './RailShell';
import './panels.css';

const TABS: { id: DeckTab; label: string }[] = [
  { id: 'groups', label: 'GROUPS' },
  { id: 'bracket', label: 'BRACKET' },
  { id: 'odds', label: 'ODDS' },
];

/** Shared floating-panel recipe (blueprint §3.4). */
export const FLOATING_PANEL =
  'rounded-2xl border border-hairline bg-glass backdrop-blur-xl ' +
  'shadow-[0_8px_40px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.04)]';

/** Minimal inline icons for the collapsed rail pill (no emoji — §1.7). */
const DECK_ICONS: RailIcon[] = [
  {
    key: 'groups',
    label: 'Groups',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    key: 'bracket',
    label: 'Bracket',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 3h3v4h3M2 13h3V7M11 5h3M8 8h3v-3M8 8h3v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'odds',
    label: 'Odds',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 13V9M6 13V5M10 13V7M14 13V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

function DeckPanel() {
  const tab = useHud((s) => s.tab);
  const setTab = useHud((s) => s.setTab);

  // Keyboard ←/→ cycles tabs (only when the deck has focus within it).
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const idx = TABS.findIndex((t) => t.id === tab);
      const next = e.key === 'ArrowRight'
        ? (idx + 1) % TABS.length
        : (idx - 1 + TABS.length) % TABS.length;
      setTab(TABS[next].id);
    },
    [tab, setTab],
  );

  return (
    <section
      className={`group/deck hud-corners relative flex h-full flex-col overflow-hidden opacity-[0.72] transition-opacity duration-300 ease-[var(--ease-hud)] hover:opacity-100 focus-within:opacity-100 ${FLOATING_PANEL}`}
      aria-label="Data deck"
      onKeyDown={onKeyDown}
    >
      {/* Segmented tab header */}
      <div
        className="flex shrink-0 gap-0.5 border-b border-hairline p-1"
        role="tablist"
        aria-label="Data views"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            data-active={tab === t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 rounded-md py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-dust transition-colors hover:text-chalk data-[active=true]:bg-neon/10 data-[active=true]:text-neon data-[active=true]:shadow-[inset_0_-2px_0_var(--color-neon)]"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab body — each tab keyed so the 200ms slide+fade replays on swap */}
      <div className="relative min-h-0 flex-1">
        <div key={tab} className="hud-swap absolute inset-0 flex flex-col">
          {tab === 'groups' && <GroupsTab />}
          {tab === 'bracket' && <BracketSpine />}
          {tab === 'odds' && <OddsTab />}
        </div>
      </div>
    </section>
  );
}

export default function DataDeck() {
  return (
    <RailShell side="left" icons={DECK_ICONS}>
      <DeckPanel />
    </RailShell>
  );
}

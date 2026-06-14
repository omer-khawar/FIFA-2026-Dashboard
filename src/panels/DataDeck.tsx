/**
 * DataDeck.tsx — Left Rail "DATA DECK" (blueprint §1.3 / §3.4).
 *
 * A single floating glass panel (hud-corners) holding a vertical STACK of three
 * sections, top → bottom:
 *   GROUPS      — compact single-group standings + A–L pill selector.
 *   BRACKET     — compact teaser of the current/next knockout round.
 *   WHO LIFTS IT — top-8 champion odds with normalized neon→gold bars.
 * Each section is led by <SectionHeading> with a right-aligned action that opens
 * the matching Theater view. The whole stack scrolls if it overflows.
 *
 * Export name frozen: default `DataDeck`. FLOATING_PANEL recipe re-exported.
 */
import { useHud } from './uiStore';
import { SectionHeading } from './bits';
import GroupsTab from './deck/GroupsTab';
import BracketSpine from './deck/BracketSpine';
import OddsTab from './deck/OddsTab';
import RailShell, { type RailIcon } from './RailShell';
import './panels.css';

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

/** Small right-aligned "view all" action used in each SectionHeading. */
function HeadingAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-dust transition-colors hover:text-neon"
    >
      {label}
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
        <path d="M2 1.5L5.5 4.5L2 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function DeckPanel() {
  const setTheater = useHud((s) => s.setTheater);

  return (
    <section
      className={`group/deck hud-corners relative flex h-full flex-col overflow-hidden opacity-[0.72] transition-opacity duration-300 ease-[var(--ease-hud)] hover:opacity-100 focus-within:opacity-100 ${FLOATING_PANEL}`}
      aria-label="Data deck"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-3.5">
        {/* SECTION 1 — GROUPS */}
        <section aria-label="Groups">
          <SectionHeading
            action={<HeadingAction label="View all" onClick={() => setTheater('groups')} />}
          >
            Groups
          </SectionHeading>
          <GroupsTab />
        </section>

        {/* SECTION 2 — BRACKET */}
        <section aria-label="Bracket">
          <SectionHeading
            action={<HeadingAction label="Full bracket" onClick={() => setTheater('bracket')} />}
          >
            Bracket
          </SectionHeading>
          <BracketSpine />
        </section>

        {/* SECTION 3 — WHO LIFTS IT */}
        <section aria-label="Who lifts it">
          <SectionHeading
            action={<HeadingAction label="View all" onClick={() => setTheater('odds')} />}
          >
            Who Lifts It
          </SectionHeading>
          <OddsTab />
        </section>
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

/**
 * IconRail.tsx — slim vertical nav rail (56px) pinned to the far-left edge.
 *
 * A presentation-only strip: a trophy brand mark at top, then four icon buttons
 * wired ONLY to existing store actions (no profile/settings/login/search/notify).
 *   Home    → clears venue + team focus and closes the Theater overlay.
 *   Groups  → opens the GROUPS theater.
 *   Bracket → opens the BRACKET theater.
 *   Odds    → opens the ODDS theater.
 * Dark terminal theme; inline SVG icons (no emoji). Default export frozen.
 */
import { useWorldCup } from '../data/store';
import { useHud } from './uiStore';

/** Clear all selection and dismiss any open theater. */
function goHome() {
  useWorldCup.getState().setFocusVenue(null);
  useHud.getState().setFocusTeam(null);
  useHud.getState().setTheater(null);
}

/** A single rail button: 40×40 hit target, centered icon, neon hover. */
function RailButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-lg text-dust transition-colors hover:bg-white/[0.06] hover:text-neon"
    >
      {children}
    </button>
  );
}

export default function IconRail() {
  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-14 flex-col items-center gap-2 border-r border-hairline bg-glass py-3 backdrop-blur-xl"
    >
      {/* Brand mark — trophy (~20px), neon. */}
      <div className="mb-2 grid h-10 w-10 place-items-center text-neon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M5 3h10v3a5 5 0 0 1-10 0V3Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M5 4H3v1.5A2.5 2.5 0 0 0 5 8M15 4h2v1.5A2.5 2.5 0 0 1 15 8"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 11v3M7 17h6M8 17l.5-3M12 17l-.5-3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Home — house. */}
      <RailButton title="Home" onClick={goHome}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M3 8.5 9 3l6 5.5M4.5 7.5V15h9V7.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M7.5 15v-3.5h3V15" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </RailButton>

      {/* Groups — 2×2 grid. */}
      <RailButton title="Groups" onClick={() => useHud.getState().setTheater('groups')}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
          <rect x="10" y="2.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
          <rect x="2.5" y="10" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
          <rect x="10" y="10" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </RailButton>

      {/* Bracket — tournament tree. */}
      <RailButton title="Bracket" onClick={() => useHud.getState().setTheater('bracket')}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M2 3.5h3v3h3M2 14.5h3v-8M11 9h3M8 9h3V3.5M8 9h3v5.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </RailButton>

      {/* Odds — bar chart. */}
      <RailButton title="Odds" onClick={() => useHud.getState().setTheater('odds')}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M2.5 15V10M7 15V4.5M11.5 15V8M16 15V2.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </RailButton>
    </nav>
  );
}

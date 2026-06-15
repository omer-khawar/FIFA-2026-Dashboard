/**
 * TopBar.tsx — HUD top bar (blueprint §1.6, defect 6).
 *
 * 52px, no card chrome — floats on the stage gradient. Left: "World Cup 2026"
 * page title (cleared past the 56px floating icon rail via pl-[60px]).
 * Right-aligned controls: stage progress (n/104 completed, a LEGIBLE 2px neon bar
 * on a hairline track), "Updated HH:MM", and an icon-only Refresh button whose
 * glyph spins while refresh() is in flight (no layout shift). Export name frozen.
 */
import { useState } from 'react';
import { useWorldCup } from '../data/store';
import { kickoffTime } from '../lib/format';

export default function TopBar() {
  const status = useWorldCup((s) => s.status);
  const lastUpdated = useWorldCup((s) => s.lastUpdated);
  const matches = useWorldCup((s) => s.matches);
  const refresh = useWorldCup((s) => s.refresh);
  const [spinning, setSpinning] = useState(false);

  const played = matches.filter((m) => m.state === 'post').length;
  const pct = Math.max(0, Math.min(100, (played / 104) * 100));
  const isSpinning = spinning || status === 'loading';

  const handleRefresh = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      await refresh();
    } finally {
      setSpinning(false);
    }
  };

  return (
    <header className="relative z-40 flex h-full w-full items-center gap-4 border-b border-hairline bg-gradient-to-b from-pitch/85 via-pitch/40 to-transparent pl-[60px] pr-5">
      {/* Page title — clears the 56px floating icon rail via pl-[60px]. Stacked
          title + tagline fills the taller banner. */}
      <h1 className="flex min-w-0 flex-col justify-center gap-1.5">
        <span className="font-display text-[30px] font-bold leading-none tracking-[0.02em] text-chalk">
          World Cup <span className="text-neon">2026</span>
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-dust">
          Live Tracker
        </span>
      </h1>

      <div className="flex-1" />

      {/* Right-aligned controls */}
      <div className="flex items-center gap-5">
        {/* Stage progress — n/104 + 2px neon bar on hairline track */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1 font-display tabular-nums leading-none">
            <span className="text-[15px] font-bold text-chalk">{played}</span>
            <span className="text-[11px] text-dust">/ 104</span>
          </div>
          <div
            className="hidden h-[2px] w-[140px] overflow-hidden rounded-full bg-hairline md:block"
            role="progressbar"
            aria-valuenow={played}
            aria-valuemin={0}
            aria-valuemax={104}
            aria-label="Matches completed"
          >
            <div
              className="h-full rounded-full bg-neon shadow-[0_0_8px_rgb(0_229_255/0.7)] transition-[width] duration-700 ease-[var(--ease-hud)]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Last updated */}
        {lastUpdated && (
          <div className="hidden whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-dust lg:block">
            Updated {kickoffTime(lastUpdated)}
          </div>
        )}

        {/* Refresh — icon-only; glyph itself rotates while in flight (no layout shift) */}
        <button
          onClick={() => void handleRefresh()}
          disabled={isSpinning}
          aria-label="Refresh data"
          title="Refresh"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-hairline text-dust transition-colors hover:border-neon/40 hover:text-neon disabled:cursor-not-allowed disabled:opacity-70"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 13 13"
            fill="none"
            aria-hidden="true"
            className={isSpinning ? 'origin-center animate-[spin_0.7s_linear_infinite]' : ''}
          >
            <path
              d="M11 6.5A4.5 4.5 0 1 1 6.5 2a4.47 4.47 0 0 1 3.18 1.32L8.5 4.5H12V1l-1.32 1.32A6 6 0 1 0 12.5 6.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

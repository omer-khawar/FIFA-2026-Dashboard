/**
 * bits.tsx — tiny shared HUD presentational atoms used across the rails/dock.
 */
import type { MatchProbs } from '../lib/types';

/** W/D/L tri-bar (blueprint §3.4): neon (home) / white (draw) / ember (away). */
export function TriBar({ probs }: { probs: MatchProbs }) {
  return (
    <div
      className="flex h-1 overflow-hidden rounded-full bg-white/5"
      title={`Home ${Math.round(probs.pHome * 100)}% · Draw ${Math.round(probs.pDraw * 100)}% · Away ${Math.round(probs.pAway * 100)}%`}
    >
      <span
        className="h-full bg-neon transition-[width] duration-700 ease-[var(--ease-hud)]"
        style={{ width: `${probs.pHome * 100}%` }}
      />
      <span
        className="h-full bg-white/15 transition-[width] duration-700 ease-[var(--ease-hud)]"
        style={{ width: `${probs.pDraw * 100}%` }}
      />
      <span
        className="h-full bg-ember transition-[width] duration-700 ease-[var(--ease-hud)]"
        style={{ width: `${probs.pAway * 100}%` }}
      />
    </div>
  );
}

/** Small flag image with a graceful empty block fallback. */
export function Flag({
  url,
  className = 'h-[14px] w-[20px]',
}: {
  url?: string;
  className?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        className={`shrink-0 rounded-[1px] object-cover ${className}`}
      />
    );
  }
  return <span className={`shrink-0 rounded-[1px] bg-white/[0.06] ${className}`} />;
}

/** Section micro-label (uppercase, tracked, dust). */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-1 pb-1.5 pt-1 font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-dust">
      {children}
    </div>
  );
}

/** Prominent section header with an optional right-aligned action slot. */
export function SectionHeading({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 pb-2 pt-1">
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.18em] text-dust">
        {children}
      </h2>
      {action}
    </div>
  );
}

/** Tiny uppercase status chip (live / today / neutral tones). */
export function StatTag({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'live' | 'today' | 'neutral';
}) {
  const toneClass =
    tone === 'live'
      ? 'text-live bg-live/15'
      : tone === 'today'
        ? 'text-ember bg-ember/15'
        : 'text-dust bg-white/[0.06]';
  return (
    <span
      className={`inline-flex items-center rounded-[3px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${toneClass}`}
    >
      {children}
    </span>
  );
}

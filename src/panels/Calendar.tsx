/**
 * Calendar.tsx — compact tournament month calendar for the expanded Ticker sheet.
 *
 * Renders JUNE 2026 and JULY 2026 as a vertical stack (June above July) so it
 * fits the ~340px right side-panel column. Day cells that HAVE matches get a
 * subtle neon highlight + dot and are clickable; today (derived at runtime) gets
 * a neon ring; dates outside the tournament window (Jun 11 – Jul 19 2026) are
 * dimmed and non-interactive.
 *
 * Replaces the old horizontal date-tab jump-strip — clicking a day with matches
 * calls onSelect(dayKey) and the parent scrolls that day's anchor into view.
 */
import { useMemo } from 'react';
import { dayKey } from './hud';
import type { Match } from '../lib/types';

// Tournament window (local calendar dates).
const WINDOW_START = '2026-06-11';
const WINDOW_END = '2026-07-19';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

interface MonthSpec {
  label: string;
  year: number;
  month: number; // 0-based (5 = June, 6 = July)
}

const MONTHS: MonthSpec[] = [
  { label: 'June 2026', year: 2026, month: 5 },
  { label: 'July 2026', year: 2026, month: 6 },
];

/** Build a YYYY-MM-DD key from calendar parts (matches dayKey()'s local format). */
function cellKey(year: number, month: number, day: number): string {
  const mo = String(month + 1).padStart(2, '0');
  const da = String(day).padStart(2, '0');
  return `${year}-${mo}-${da}`;
}

interface Cell {
  key: string;
  day: number;
  inWindow: boolean;
  hasMatches: boolean;
  matchCount: number;
}

function MonthGrid({
  spec,
  matchDays,
  todayKey,
  selectedKey,
  onSelect,
}: {
  spec: MonthSpec;
  matchDays: Map<string, number>;
  todayKey: string;
  selectedKey: string | null;
  onSelect: (dayKey: string) => void;
}) {
  const cells = useMemo<(Cell | null)[]>(() => {
    const first = new Date(spec.year, spec.month, 1);
    const leading = first.getDay(); // 0 = Sunday
    const daysInMonth = new Date(spec.year, spec.month + 1, 0).getDate();
    const out: (Cell | null)[] = [];
    for (let i = 0; i < leading; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const key = cellKey(spec.year, spec.month, day);
      const inWindow = key >= WINDOW_START && key <= WINDOW_END;
      const matchCount = matchDays.get(key) ?? 0;
      out.push({ key, day, inWindow, hasMatches: matchCount > 0, matchCount });
    }
    return out;
  }, [spec, matchDays]);

  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-center font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-dust">
        {spec.label}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w, i) => (
          <div
            key={`wd-${i}`}
            className="text-center text-[9px] font-semibold uppercase tracking-[0.06em] text-dust/60"
          >
            {w}
          </div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <span key={`pad-${i}`} className="h-7" aria-hidden="true" />;

          const isToday = c.key === todayKey;
          const isSelected = c.key === selectedKey;

          if (!c.inWindow) {
            return (
              <span
                key={c.key}
                className="flex h-7 items-center justify-center text-[11px] tabular-nums text-dust/25"
              >
                {c.day}
              </span>
            );
          }

          if (!c.hasMatches) {
            return (
              <span
                key={c.key}
                className={`flex h-7 items-center justify-center rounded-[4px] text-[11px] tabular-nums text-dust/70 ${
                  isToday ? 'ring-1 ring-inset ring-neon/70' : ''
                }`}
              >
                {c.day}
              </span>
            );
          }

          return (
            <button
              key={c.key}
              onClick={() => onSelect(c.key)}
              title={`${c.matchCount} ${c.matchCount === 1 ? 'match' : 'matches'}`}
              className={`relative flex h-7 items-center justify-center rounded-[4px] text-[11px] font-semibold tabular-nums transition-colors ${
                isSelected
                  ? 'bg-neon/20 text-neon'
                  : 'bg-white/[0.05] text-chalk/90 hover:bg-neon/15 hover:text-neon'
              } ${isToday ? 'ring-1 ring-inset ring-neon/70' : ''}`}
            >
              {c.day}
              <span
                className={`absolute bottom-[3px] left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full ${
                  isSelected ? 'bg-neon' : 'bg-neon/70'
                }`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Calendar({
  matches,
  selectedKey,
  onSelect,
}: {
  matches: Match[];
  selectedKey: string | null;
  onSelect: (dayKey: string) => void;
}) {
  // Map of dayKey → match count, derived from the store's matches.
  const matchDays = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matches) {
      const k = dayKey(m.date);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [matches]);

  // Today, derived at runtime in the user's local timezone.
  const todayKey = useMemo(() => dayKey(new Date().toISOString()), []);

  return (
    <div className="flex flex-col gap-5 px-3.5 py-3">
      {MONTHS.map((spec) => (
        <MonthGrid
          key={spec.label}
          spec={spec}
          matchDays={matchDays}
          todayKey={todayKey}
          selectedKey={selectedKey}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

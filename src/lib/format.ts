/**
 * format.ts — date/number helpers using Intl (user's local timezone).
 */

/** Format an ISO kickoff string to local time, e.g. "3:00 PM" */
export function kickoffTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

/** Format an ISO date string to a short date label, e.g. "FRI JUN 12" */
export function dateLabel(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d).toUpperCase();
  const mon = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(d).toUpperCase();
  const num = d.getDate();
  return `${day} ${mon} ${num}`;
}

/** How long ago was an ISO timestamp? e.g. "3m ago", "2h ago", "yesterday" */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

/** Format a probability (0–1) as a percent string, e.g. "34%" */
export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

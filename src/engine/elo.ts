/**
 * elo.ts — Elo replay from the pre-tournament seed.
 *
 * Per SPEC.md "Engine" §1:
 *   R' = R + K·G·(W − We),  K = 60
 *   We = 1 / (1 + 10^(−d/400)),  d = ratingDiff + homeBonus
 *   homeBonus = +100 to a team when that team's country (USA/MEX/CAN, by team.code)
 *               equals the stadium country of the match venue.
 *   Goal-diff multiplier G: 1 (margin ≤ 1), 1.5 (margin 2), (11+margin)/8 (margin ≥ 3).
 *   Shootout / draw-after-90'+ET counts as W = 0.5 (use the 90'/120' result).
 *
 * Only `state==='post'` matches with two decided team slots and numeric scores are
 * replayed, in chronological order (by date, then id).
 */

import type { Match, Team, Stadium, TeamId } from '../lib/types';

export const K = 60;
const HOME_BONUS = 100;

const HOST_CODES = new Set(['USA', 'MEX', 'CAN']);

/** We = 1 / (1 + 10^(−d/400)). */
export function winExpectancy(ratingDiff: number): number {
  return 1 / (1 + Math.pow(10, -ratingDiff / 400));
}

/** Goal-difference multiplier per spec. */
export function goalDiffMultiplier(margin: number): number {
  const m = Math.abs(margin);
  if (m <= 1) return 1;
  if (m === 2) return 1.5;
  return (11 + m) / 8;
}

/** venueId → stadium country ('USA'|'MEX'|'CAN'). */
export function buildVenueCountry(stadiums: Stadium[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of stadiums) map.set(s.venueId, s.country);
  return map;
}

/**
 * Decide whether a host team playing at home earns the +100 Elo bonus.
 * Returns the bonus (0 or +100) to add to the home team's effective rating diff.
 */
export function homeBonusFor(
  homeCode: string | undefined,
  awayCode: string | undefined,
  venueCountry: string | undefined,
): { home: number; away: number } {
  let home = 0;
  let away = 0;
  if (venueCountry) {
    if (homeCode && HOST_CODES.has(homeCode) && homeCode === venueCountry) home = HOME_BONUS;
    if (awayCode && HOST_CODES.has(awayCode) && awayCode === venueCountry) away = HOME_BONUS;
  }
  return { home, away };
}

/**
 * Replay all completed matches chronologically onto a copy of the seed ratings.
 * Missing teams default to 1450 (matches the seed's documented fallback).
 */
export function replayElo(
  seed: Record<TeamId, number>,
  matches: Match[],
  teams: Record<TeamId, Team>,
  stadiums: Stadium[],
): Record<TeamId, number> {
  const ratings: Record<TeamId, number> = { ...seed };
  const venueCountry = buildVenueCountry(stadiums);

  const get = (id: TeamId): number => {
    const r = ratings[id];
    return r === undefined ? 1450 : r;
  };

  const completed = matches
    .filter(
      (m) =>
        m.state === 'post' &&
        m.home.kind === 'team' &&
        m.away.kind === 'team' &&
        m.homeScore !== undefined &&
        m.awayScore !== undefined,
    )
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc !== 0 ? dc : a.id.localeCompare(b.id);
    });

  for (const m of completed) {
    // narrowed by the filter above
    const homeId = (m.home as { kind: 'team'; teamId: TeamId }).teamId;
    const awayId = (m.away as { kind: 'team'; teamId: TeamId }).teamId;
    const hs = m.homeScore as number;
    const as = m.awayScore as number;

    const bonus = homeBonusFor(
      teams[homeId]?.code,
      teams[awayId]?.code,
      venueCountry.get(m.venueId),
    );

    const rHome = get(homeId);
    const rAway = get(awayId);

    // d from the home team's perspective: (rHome + homeBonus) − (rAway + awayBonus)
    const d = rHome + bonus.home - (rAway + bonus.away);
    const weHome = winExpectancy(d);
    const weAway = 1 - weHome;

    // W from the 90'/120' result: 1 win / 0.5 draw / 0 loss (shootout → draw → 0.5)
    let wHome: number;
    if (hs > as) wHome = 1;
    else if (hs < as) wHome = 0;
    else wHome = 0.5;
    const wAway = 1 - wHome;

    const g = goalDiffMultiplier(hs - as);

    ratings[homeId] = rHome + K * g * (wHome - weHome);
    ratings[awayId] = rAway + K * g * (wAway - weAway);
  }

  return ratings;
}

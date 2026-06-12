/**
 * store.ts — Zustand store + selectors for World Cup 2026 dashboard.
 * API is frozen per SPEC.md.
 */

import { create } from 'zustand';
import type { FeatureCollection } from 'geojson';
import type { TeamId, Team, Match, Group, NewsItem, Stadium, Predictions, Stage } from '../lib/types';
import { fetchScoreboard, fetchStandings, fetchNews } from './espn';
import { normalizeTeams, normalizeGroups, normalizeMatches, normalizeNews } from './normalize';

// ─── State interface ──────────────────────────────────────────────────────────

interface WorldCupState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  lastUpdated?: string;
  teams: Record<TeamId, Team>;
  matches: Match[];
  groups: Group[];
  news: NewsItem[];
  stadiums: Stadium[];
  hostGeo: FeatureCollection | null;
  predictions: Predictions | null;
  focusVenueId: string | null;
  load(): Promise<void>;
  refresh(): Promise<void>;
  setPredictions(p: Predictions): void;
  setFocusVenue(id: string | null): void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWorldCup = create<WorldCupState>()((set, get) => ({
  status: 'idle',
  error: undefined,
  lastUpdated: undefined,
  teams: {},
  matches: [],
  groups: [],
  news: [],
  stadiums: [],
  hostGeo: null,
  predictions: null,
  focusVenueId: null,

  async load() {
    set({ status: 'loading', error: undefined });
    try {
      const base = import.meta.env.BASE_URL;

      const [stadiumsRes, hostGeoRes, eloRes, scoreboardRaw, standingsRaw, newsRaw] =
        await Promise.all([
          fetch(`${base}data/stadiums.json`).then(r => r.json()),
          fetch(`${base}data/hosts.geo.json`).then(r => r.json()),
          fetch(`${base}data/elo-seed.json`).then(r => r.json()),
          fetchScoreboard(),
          fetchStandings(),
          fetchNews(),
        ]);

      const teams = normalizeTeams(standingsRaw);
      const groups = normalizeGroups(standingsRaw);
      const matches = normalizeMatches(scoreboardRaw, standingsRaw);
      const news = normalizeNews(newsRaw);

      // Preserve existing predictions but update elo seed from file
      const existingPredictions = get().predictions;
      const updatedPredictions = existingPredictions
        ? { ...existingPredictions, elo: eloRes.ratings ?? existingPredictions.elo }
        : null;

      set({
        status: 'ready',
        teams,
        groups,
        matches,
        news,
        stadiums: stadiumsRes.stadiums ?? [],
        hostGeo: hostGeoRes as FeatureCollection,
        predictions: updatedPredictions,
        lastUpdated: new Date().toISOString(),
        error: undefined,
      });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async refresh() {
    // Keep status as 'ready' while refreshing — no loading screen flash
    const prevStatus = get().status;
    if (prevStatus !== 'ready') {
      return get().load();
    }
    try {
      const base = import.meta.env.BASE_URL;

      const [stadiumsRes, hostGeoRes, eloRes, scoreboardRaw, standingsRaw, newsRaw] =
        await Promise.all([
          fetch(`${base}data/stadiums.json`).then(r => r.json()),
          fetch(`${base}data/hosts.geo.json`).then(r => r.json()),
          fetch(`${base}data/elo-seed.json`).then(r => r.json()),
          fetchScoreboard(),
          fetchStandings(),
          fetchNews(),
        ]);

      const teams = normalizeTeams(standingsRaw);
      const groups = normalizeGroups(standingsRaw);
      const matches = normalizeMatches(scoreboardRaw, standingsRaw);
      const news = normalizeNews(newsRaw);

      const existingPredictions = get().predictions;
      const updatedPredictions = existingPredictions
        ? { ...existingPredictions, elo: eloRes.ratings ?? existingPredictions.elo }
        : null;

      // Swap atomically — no intermediate state shown
      set({
        status: 'ready',
        teams,
        groups,
        matches,
        news,
        stadiums: stadiumsRes.stadiums ?? [],
        hostGeo: hostGeoRes as FeatureCollection,
        predictions: updatedPredictions,
        lastUpdated: new Date().toISOString(),
        error: undefined,
      });
    } catch (err) {
      // On refresh error, keep old data — just set an error note
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  setPredictions(p: Predictions) {
    set({ predictions: p });
  },

  setFocusVenue(id: string | null) {
    set({ focusVenueId: id });
  },
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectLive = (s: WorldCupState): Match[] =>
  s.matches.filter(m => m.state === 'in');

export const selectByVenue = (s: WorldCupState, venueId: string): Match[] =>
  s.matches.filter(m => m.venueId === venueId);

const BRACKET_STAGE_ORDER: Stage[] = ['r32', 'r16', 'qf', 'sf', 'final'];

export const selectBracketRounds = (
  s: WorldCupState,
): Array<{ stage: Stage; matches: Match[] }> => {
  const result: Array<{ stage: Stage; matches: Match[] }> = [];
  for (const stage of BRACKET_STAGE_ORDER) {
    const matches = s.matches
      .filter(m => m.stage === stage)
      .sort((a, b) => a.ordinal - b.ordinal);
    if (matches.length > 0) result.push({ stage, matches });
  }
  return result;
};

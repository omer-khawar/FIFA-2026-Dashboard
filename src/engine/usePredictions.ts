/**
 * usePredictions.ts — mounts the Monte Carlo prediction engine.
 *
 * Mounted once in App. On store status==='ready' (and whenever the `matches`
 * identity changes), it:
 *   1. reads teams / matches / stadiums from the store,
 *   2. fetches the Elo seed once (module-level cache),
 *   3. spawns the worker, posts the job, and on result calls store.setPredictions,
 *   4. terminates the worker.
 *
 * Concurrency: exactly one job in flight at a time. If `matches` changes mid-flight,
 * exactly one re-run is queued (collapsing rapid changes).
 */

import { useEffect, useRef } from 'react';
import { useWorldCup } from '../data/store';
import type { Team, Match, Stadium, TeamId, Predictions } from '../lib/types';
import type { SimulateRequest, SimulateResponse } from './worker';

const ITERATIONS = 10000;

// ─── Module-level Elo seed cache (fetched once per page load) ────────────────────

let eloSeedPromise: Promise<Record<TeamId, number>> | null = null;

function loadEloSeed(): Promise<Record<TeamId, number>> {
  if (!eloSeedPromise) {
    const url = import.meta.env.BASE_URL + 'data/elo-seed.json';
    eloSeedPromise = fetch(url)
      .then((r) => r.json())
      .then((j: { ratings?: Record<TeamId, number> }) => j.ratings ?? {})
      .catch(() => ({}));
  }
  return eloSeedPromise;
}

export function usePredictions(): void {
  const status = useWorldCup((s) => s.status);
  const matches = useWorldCup((s) => s.matches);
  const teams = useWorldCup((s) => s.teams);
  const stadiums = useWorldCup((s) => s.stadiums);
  const setPredictions = useWorldCup((s) => s.setPredictions);

  // Mutable refs that don't trigger re-render.
  const runningRef = useRef(false);
  const pendingRef = useRef(false);
  // Latest inputs, so a queued re-run uses fresh data.
  const latestRef = useRef<{
    teams: Record<TeamId, Team>;
    matches: Match[];
    stadiums: Stadium[];
  }>({ teams, matches, stadiums });
  latestRef.current = { teams, matches, stadiums };

  useEffect(() => {
    if (status !== 'ready') return;
    if (matches.length === 0) return;

    let cancelled = false;

    const runJob = async () => {
      if (cancelled) return;
      runningRef.current = true;

      const eloSeed = await loadEloSeed();
      if (cancelled) {
        runningRef.current = false;
        return;
      }

      const { teams: t, matches: m, stadiums: st } = latestRef.current;

      const worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
      });

      const cleanup = () => {
        worker.terminate();
      };

      worker.onmessage = (e: MessageEvent<SimulateResponse>) => {
        const data = e.data;
        if (data && data.type === 'result' && !cancelled) {
          setPredictions(data.payload as Predictions);
        }
        cleanup();
        runningRef.current = false;
        // If inputs changed while we ran, kick off exactly one more pass.
        if (pendingRef.current && !cancelled) {
          pendingRef.current = false;
          void runJob();
        }
      };

      worker.onerror = () => {
        cleanup();
        runningRef.current = false;
        if (pendingRef.current && !cancelled) {
          pendingRef.current = false;
          void runJob();
        }
      };

      const req: SimulateRequest = {
        type: 'simulate',
        payload: {
          teams: t,
          matches: m,
          eloSeed,
          stadiums: st,
          iterations: ITERATIONS,
          asOf: new Date().toISOString(),
        },
      };
      worker.postMessage(req);
    };

    if (runningRef.current) {
      // A job is in flight — queue exactly one re-run with the newest matches.
      pendingRef.current = true;
    } else {
      void runJob();
    }

    return () => {
      cancelled = true;
    };
    // Re-run when the matches identity changes or the store becomes ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, matches, setPredictions]);
}

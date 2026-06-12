/**
 * worker.ts — Web Worker entry for the Monte Carlo prediction engine.
 *
 * Vite spawns this as a module worker:
 *   new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
 *
 * Message in:  { type: 'simulate', payload: { teams, matches, eloSeed, stadiums, iterations, asOf } }
 * Message out: { type: 'result',   payload: Predictions }
 */

import type { Match, Team, Stadium, TeamId, Predictions } from '../lib/types';
import { simulate } from './simulate';

export interface SimulateRequest {
  type: 'simulate';
  payload: {
    teams: Record<TeamId, Team>;
    matches: Match[];
    eloSeed: Record<TeamId, number>;
    stadiums: Stadium[];
    iterations: number;
    asOf: string;
  };
}

export interface SimulateResponse {
  type: 'result';
  payload: Predictions;
}

self.onmessage = (e: MessageEvent<SimulateRequest>) => {
  const msg = e.data;
  if (!msg || msg.type !== 'simulate') return;
  const { teams, matches, eloSeed, stadiums, iterations, asOf } = msg.payload;

  const predictions = simulate({
    teams,
    matches,
    eloSeed,
    stadiums,
    iterations,
    asOf,
  });

  const response: SimulateResponse = { type: 'result', payload: predictions };
  (self as unknown as Worker).postMessage(response);
};

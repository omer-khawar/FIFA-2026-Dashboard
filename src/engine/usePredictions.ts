/**
 * usePredictions.ts — stub no-op hook. Engine agent replaces internals.
 * Mounted once in App. Effect on [matches, teams, status==='ready']:
 * spawn worker, post {teams, matches, eloSeed, stadiums, iterations: 10000},
 * on message call setPredictions, terminate worker.
 */
export function usePredictions(): void {
  // Engine agent replaces this stub with the real MC worker integration.
  // No-op intentionally — the hook is mounted but does nothing until Engine is built.
}

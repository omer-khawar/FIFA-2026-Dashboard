/**
 * poisson.ts — Elo → win-expectancy → λ → independent-Poisson score grid.
 *
 * Per SPEC.md "Engine" §2:
 *   We_home = 1/(1+10^(−d/400)), d = (eloHome + homeBonus) − eloAway
 *   λ_home = base · (We_home / 0.5)^0.85
 *   λ_away = base · (We_away / 0.5)^0.85
 *   base = 1.35,  We_away = 1 − We_home,  λ clamped to [0.25, 4]
 *   Score grid 0..8 goals each side, independent Poisson, normalized.
 *   pHome / pDraw / pAway from the grid.
 *   Knockout: pHomeAdvance = pHome + pDraw · We_home_noBonus.
 */

export const GRID_MAX = 8; // goals 0..8 inclusive → 9 buckets per side
const GRID_N = GRID_MAX + 1; // 9
const BASE_LAMBDA = 1.35;
const LAMBDA_MIN = 0.25;
const LAMBDA_MAX = 4;
const LAMBDA_EXP = 0.85;

export interface MatchProbsResult {
  pHome: number;
  pDraw: number;
  pAway: number;
  /** knockout only: probability home advances (incl. ET/pens approximation) */
  pHomeAdvance?: number;
  /** flattened 9×9 grid, row = home goals, col = away goals; sums to ~1 */
  grid: number[];
  lambdaHome: number;
  lambdaAway: number;
}

function clampLambda(x: number): number {
  if (x < LAMBDA_MIN) return LAMBDA_MIN;
  if (x > LAMBDA_MAX) return LAMBDA_MAX;
  return x;
}

/** We = 1 / (1 + 10^(−d/400)). */
export function winExpectancy(ratingDiff: number): number {
  return 1 / (1 + Math.pow(10, -ratingDiff / 400));
}

/** Map a win-expectancy to an expected-goals λ. */
export function lambdaFromWe(we: number): number {
  return clampLambda(BASE_LAMBDA * Math.pow(we / 0.5, LAMBDA_EXP));
}

/** Poisson pmf row P(k) for k = 0..GRID_MAX given mean λ (not renormalized). */
function poissonRow(lambda: number): number[] {
  const row = new Array<number>(GRID_N);
  // P(0) = e^-λ; P(k) = P(k-1) · λ/k
  let p = Math.exp(-lambda);
  row[0] = p;
  for (let k = 1; k < GRID_N; k++) {
    p = (p * lambda) / k;
    row[k] = p;
  }
  return row;
}

/**
 * Build the full 9×9 outcome distribution + 1X2 probabilities for a pairing.
 *
 * @param eloHome     home team's current Elo
 * @param eloAway     away team's current Elo
 * @param homeBonus   +Elo applied to the home side's diff (e.g. +100 host bonus); 0 otherwise
 * @param knockout    if true, also compute pHomeAdvance using the no-bonus We
 */
export function matchProbs(
  eloHome: number,
  eloAway: number,
  homeBonus = 0,
  knockout = false,
): MatchProbsResult {
  const weHome = winExpectancy(eloHome + homeBonus - eloAway);
  const weAway = 1 - weHome;

  const lambdaHome = lambdaFromWe(weHome);
  const lambdaAway = lambdaFromWe(weAway);

  const rowH = poissonRow(lambdaHome);
  const rowA = poissonRow(lambdaAway);

  const grid = new Array<number>(GRID_N * GRID_N);
  let total = 0;
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (let h = 0; h < GRID_N; h++) {
    const ph = rowH[h];
    const base = h * GRID_N;
    for (let a = 0; a < GRID_N; a++) {
      const cell = ph * rowA[a];
      grid[base + a] = cell;
      total += cell;
      if (h > a) pHome += cell;
      else if (h === a) pDraw += cell;
      else pAway += cell;
    }
  }

  // Normalize (the 0..8 truncation drops a little tail mass).
  const inv = total > 0 ? 1 / total : 0;
  for (let i = 0; i < grid.length; i++) grid[i] *= inv;
  pHome *= inv;
  pDraw *= inv;
  pAway *= inv;

  const result: MatchProbsResult = {
    pHome,
    pDraw,
    pAway,
    grid,
    lambdaHome,
    lambdaAway,
  };

  if (knockout) {
    // ET/pens approximation: drawn matches resolved by the bonus-free We.
    const weHomeNoBonus = winExpectancy(eloHome - eloAway);
    result.pHomeAdvance = pHome + pDraw * weHomeNoBonus;
  }

  return result;
}

/**
 * Cumulative distribution over the flattened 9×9 grid, for fast MC sampling.
 * Returns a length-81 array of running sums ending at ~1. Sample with a single
 * uniform u ∈ [0,1): the first index whose cdf ≥ u is the chosen (home,away) cell.
 */
export function gridCdf(grid: number[]): number[] {
  const cdf = new Array<number>(grid.length);
  let acc = 0;
  for (let i = 0; i < grid.length; i++) {
    acc += grid[i];
    cdf[i] = acc;
  }
  // guard the last entry against fp drift so u≈1 always lands somewhere
  cdf[cdf.length - 1] = 1;
  return cdf;
}

/**
 * Sample a (homeGoals, awayGoals) pair from a grid CDF given a uniform u.
 * Linear scan from the start; the grid concentrates mass in low indices so this
 * is fast in practice. Returns goals encoded as homeGoals*GRID_N + awayGoals via
 * the index; callers decode with /GRID_N and %GRID_N.
 */
export function sampleGridIndex(cdf: number[], u: number): number {
  // binary search for the first cdf[i] >= u
  let lo = 0;
  let hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function decodeHome(index: number): number {
  return Math.floor(index / GRID_N);
}
export function decodeAway(index: number): number {
  return index % GRID_N;
}

/**
 * adjustments.ts — future news-aware seam.
 *
 * Per SPEC.md "Engine": statistical only, NO news/sentiment inputs. This is the
 * single hook where future news-aware adjustments would fold into the Elo map.
 * Today it is a pure identity passthrough, called exactly once in the pipeline.
 */

import type { TeamId } from '../lib/types';

export function applyAdjustments(elo: Record<TeamId, number>): Record<TeamId, number> {
  return elo;
}

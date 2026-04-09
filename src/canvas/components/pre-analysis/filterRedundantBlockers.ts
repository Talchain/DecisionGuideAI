/**
 * filterRedundantBlockers — drop Must fix entries that the draft error card
 * already surfaces.
 *
 * P0-2: when CEE returns a draft failure (lastDraftError set) AND the same
 * underlying problem also appears as an enriched blocker, the user sees the
 * signal twice — once in the Draft failed card at the top of pre-analysis,
 * once in the Must fix list below. This helper filters the Must fix list
 * down to remove that duplication.
 *
 * The filter is purely render-time. It does not mutate validation state.
 */

import type { EnrichedBlocker } from './blockerEnrichment'

/**
 * Map of CEE draft error codes → blocker codes that should be hidden from
 * Must fix because the draft error card carries the same signal.
 *
 * Keep this mapping tight: only include cases where the draft error message
 * + retry/edit-brief affordances genuinely subsume the blocker card. Adding
 * an entry here means users will *not* see the blocker title in Must fix.
 */
const DRAFT_ERROR_REDUNDANT_BLOCKERS: Record<string, readonly string[]> = {
  MISSING_INTERVENTIONS: ['OPTIONS_NEED_MAPPING', 'EMPTY_INTERVENTIONS'],
  OPTIONS_NEED_MAPPING: ['OPTIONS_NEED_MAPPING'],
  EMPTY_INTERVENTIONS: ['EMPTY_INTERVENTIONS'],
  ANALYSIS_NOT_READY: ['ANALYSIS_NOT_READY'],
  ANALYSIS_READY_INVALID: ['ANALYSIS_READY_INVALID'],
  CATEGORY_MISSING: ['CATEGORY_MISSING'],
}

export interface DraftErrorLike {
  code?: string | null
}

/**
 * Filter `enriched` blockers to remove entries that are already covered by
 * the draft error card. If `lastDraftError` is null or its code is not in
 * the redundancy map, returns the input unchanged.
 *
 * Pure function — safe to call inside `useMemo` without side effects.
 */
export function filterRedundantBlockers(
  enriched: readonly EnrichedBlocker[],
  lastDraftError: DraftErrorLike | null,
): EnrichedBlocker[] {
  if (!lastDraftError?.code) return [...enriched]
  const redundant = DRAFT_ERROR_REDUNDANT_BLOCKERS[lastDraftError.code]
  if (!redundant || redundant.length === 0) return [...enriched]
  const redundantSet = new Set(redundant)
  return enriched.filter(b => !redundantSet.has(b.blocker.code))
}

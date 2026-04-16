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
 * Map of error codes (draft or run) → blocker codes that should be hidden from
 * Must fix because an external card already surfaces the same signal.
 *
 * Keep this mapping tight: only include cases where the external card's
 * message + affordances genuinely subsume the blocker card. Adding an entry
 * here means users will *not* see the blocker title in Must fix.
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
 * Filter `enriched` blockers to remove entries already covered by either
 * the draft error card (set in draftStore) OR the run error banner rendered
 * by OutputsDock (e.g. "Options need their effects mapped" when V2 run fails
 * with MISSING_INTERVENTIONS). When both are null or their codes are not in
 * the redundancy map, returns the input unchanged.
 *
 * Pure function — safe to call inside `useMemo` without side effects.
 */
export function filterRedundantBlockers(
  enriched: readonly EnrichedBlocker[],
  lastDraftError: DraftErrorLike | null,
  runErrorCode?: string | null,
): EnrichedBlocker[] {
  const redundant = new Set<string>()
  const draftCode = lastDraftError?.code
  if (draftCode) {
    for (const c of DRAFT_ERROR_REDUNDANT_BLOCKERS[draftCode] ?? []) redundant.add(c)
  }
  if (runErrorCode) {
    for (const c of DRAFT_ERROR_REDUNDANT_BLOCKERS[runErrorCode] ?? []) redundant.add(c)
  }
  if (redundant.size === 0) return [...enriched]
  return enriched.filter(b => !redundant.has(b.blocker.code))
}

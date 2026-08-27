/**
 * Analysis (New) — the store-aware hook that assembles the view model.
 *
 * ⭐⭐ THIS HOOK IS READ-ONLY, AND THAT IS THE LOAD-BEARING PROPERTY OF THE
 * WHOLE EXPERIMENT. It performs NO writes: no store mutation, no fetch, no
 * dispatch, no reconcile. Switching to the Analysis (New) tab must not re-run
 * analysis, create a second result, change canonical state, change readiness or
 * change staleness — otherwise the two tabs are not a presentation comparison,
 * they are an A/B test on different data, and Paul's comparison is void.
 *
 * ⚠ IT DOES NOT CALL `useResultsSectionData()` EITHER. The analysis data
 * arrives as a PROP, so the new tab renders the SAME instance `OutputsDock`
 * already hands `ResultsBody` — one data authority for both surfaces, exactly
 * as the 'Alt view' comparison tab did (PR #673). Calling the hook again here
 * would be a second derivation of the same thing and would silently reopen the
 * "are they even looking at the same run?" question this experiment exists to
 * close.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { deriveGuidanceDskProvenance, useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import { useStrengthenStore } from '../../../canvas/stores/strengthenStore'
import { buildRecommendations } from '../strengthen/buildRecommendations'
import type { Recommendation } from '../strengthen/strengthenTypes'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { buildStrengthenInputsForAnalysisNew } from './buildStrengthenInputsForAnalysisNew'
import { buildAnalysisNewViewModel } from './buildAnalysisNewViewModel'
import type { AnalysisNewViewModel } from './analysisNewTypes'

/**
 * Lifecycle statuses that REMOVE a recommendation from the live list.
 *
 * Read-only reuse of the shared strengthen store: if the user dismissed or
 * completed something on the existing Analysis tab, it must not reappear here.
 * The two surfaces disagreeing about what is still outstanding would be a worse
 * defect than the new tab showing nothing.
 */
const RETIRED_STATUSES = new Set(['dismissed', 'addressed'])

export interface UseAnalysisNewViewModelArgs {
  /** THE SAME instance OutputsDock hands ResultsBody. Never re-derived. */
  data: ResultsSectionDataReturn
  isPreRun: boolean
  isRunning: boolean
  isStale: boolean
  nSamples?: number
  seedUsed?: number | string
  responseHash?: string
}

export function useAnalysisNewViewModel(args: UseAnalysisNewViewModelArgs): AnalysisNewViewModel {
  const { data, isPreRun, isRunning, isStale, nSamples, seedUsed, responseHash } = args

  // ── reads only ────────────────────────────────────────────────────────────
  const currentStage = useCanvasStore((s) => s.currentStage)
  const biasSignals = useCanvasStore((s) => s.draftCoaching?.biasSignals ?? null)
  const guidanceItems = useGuidanceStore((s) => s.guidanceItems)
  const strengthenRecords = useStrengthenStore((s) => s.records)

  const recommendations: Recommendation[] = useMemo(() => {
    const inputs = buildStrengthenInputsForAnalysisNew({
      data,
      guidanceItems,
      biasSignals,
      currentStage,
    })
    // The engine is the authority on what a grounded intervention is. This
    // surface runs it and renders it; it never adds one of its own, and it
    // never relaxes one of the engine's gates.
    return buildRecommendations(inputs).filter((rec) => {
      const record = strengthenRecords[rec.id]
      return !record || !RETIRED_STATUSES.has(record.status)
    })
  }, [data, guidanceItems, biasSignals, currentStage, strengthenRecords])

  /**
   * Re-join the producer's DSK attestation onto the engine's phase-3
   * recommendations.
   *
   * ⚠ THE JOIN KEY IS DERIVED FROM THE ENGINE'S OWN ID SHAPE, not guessed:
   * `buildRecommendations` mints producer-guidance rows as
   * `strengthen:phase3:${item.item_id}`. Nothing else in this file may invent a
   * key, and a recommendation the engine minted from its OWN deterministic
   * triggers has no guidance item behind it and therefore gets no grounding —
   * which is correct, not a gap to paper over.
   *
   * ⚠ ID-GATED AS A UNIT. `deriveGuidanceDskProvenance` returns undefined
   * unless the producer sent a non-empty `dsk_claim_id`; absence means "not
   * grounded", never a default. This hook adds no key in that case.
   */
  const scienceGrounding = useMemo(() => {
    const out: Record<string, { claimId: string; protocolId?: string; strength?: string }> = {}
    for (const item of guidanceItems) {
      const provenance = deriveGuidanceDskProvenance(item)
      if (provenance) out[`strengthen:phase3:${item.item_id}`] = provenance
    }
    return out
  }, [guidanceItems])

  return useMemo(
    () =>
      buildAnalysisNewViewModel({
        data,
        recommendations,
        recommendationCandidateCount: recommendations.length,
        isPreRun,
        isRunning,
        isStale,
        nSamples,
        seedUsed,
        responseHash,
        scienceGrounding,
      }),
    [
      data,
      recommendations,
      isPreRun,
      isRunning,
      isStale,
      nSamples,
      seedUsed,
      responseHash,
      scienceGrounding,
    ],
  )
}

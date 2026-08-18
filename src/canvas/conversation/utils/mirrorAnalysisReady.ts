/**
 * mirrorAnalysisReady — Shared utility for mirroring CEE analysis_ready
 * payload into the canvas store and option/goal node caches.
 *
 * Used by both the manual-accept path (ConversationPanel.tsx) and the
 * auto-apply path (useConversation.ts handleEnvelope) to guarantee identical
 * store mutations regardless of how the patch was accepted.
 */

import type { CEEAnalysisReady } from '../../../adapters/cee/types'
import type { GraphPatchBlock } from '../types'
import { useCanvasStore } from '../../store'
import { backfillInterventionsOntoOptionNodes, backfillGoalThresholdOntoGoalNode } from '../../utils/applyDraftResult'
import { logger } from '../../../lib/logger'

// ---------------------------------------------------------------------------
// Extract
// ---------------------------------------------------------------------------

export interface AnalysisReadyPatch {
  ceeAnalysisReady: CEEAnalysisReady
}

/**
 * Extracts analysis_ready from a graph patch block.
 * Returns null if block has no analysis_ready payload.
 */
export function buildAnalysisReadyPatch(
  block: GraphPatchBlock,
): AnalysisReadyPatch | null {
  const resolved = block.analysis_ready ?? null
  if (!resolved) return null
  return { ceeAnalysisReady: resolved }
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/**
 * Applies the analysis_ready payload to the canvas store and node caches.
 * Idempotent: calling twice with the same patch produces the same store state.
 */
export function applyAnalysisReadyPatch(
  patch: AnalysisReadyPatch,
  context: { patchId?: string; scenarioId?: string | null },
): void {
  // ⚠⚠ P0-B — THE PATCH-ACCEPT TAIL ESCAPED THE SUPPRESSION WINDOW.
  // `ConversationPanel` opens `beginExternalGraphMutation('patch_apply')`, applies
  // the patch, and CLOSES the window in its `finally` — and only THEN calls
  // `mirrorAnalysisReadyAfterAccept()`, which lands here and writes node `data`
  // through the two backfills below. So the tail's writes arrived unsuppressed,
  // twelve lines before the DELIBERATE, TARGETED `clearItemsByTargetIds(allIds)`
  // that follows. A blanket clear at that moment empties the store, and the
  // targeted prune — whose very existence proves the codebase expects guidance to
  // be PRESENT and SELECTIVELY PRESERVED here — then no-ops on nothing.
  //
  // ⭐ FIXED IN THE WRITER, NOT AT THE CALL SITE, DELIBERATELY: there are TWO
  // callers of `mirrorAnalysisReadyAfterAccept` (`ConversationPanel.tsx:335` for
  // the validated path and `:393` for the adapter-less fallback), and the review
  // that found this named only the first. Guarding here covers both, and covers
  // the next one nobody remembers to guard. The counter is re-entrant, so this
  // nests harmlessly inside any window a caller already holds.
  useCanvasStore.getState().beginExternalGraphMutation('patch_apply')
  try {
  useCanvasStore.getState().setCeeAnalysisReady(patch.ceeAnalysisReady)

  // Freshness source of truth: a patch's analysis_ready.freshness must flow
  // through the freshness reducer, not be silently dropped. When it carries a
  // verdict, the reducer applies it (and clears the dirty overlay that the graph
  // mutation set); when it lacks one, the reducer leaves the retained verdict +
  // dirty overlay in place so the patch shows "cannot confirm" rather than a
  // stale "fresh". Mirrors the V5 ingress at applyV5State. Optional-chained so
  // partial store doubles in tests don't break.
  useCanvasStore.getState().setAnalysisFreshness?.(patch.ceeAnalysisReady)

  const backfillResult = backfillInterventionsOntoOptionNodes(patch.ceeAnalysisReady)
  if (backfillResult.interventionBackfilledCount > 0) {
    logger.warn('analysis_ready.intervention_backfill', {
      patchId: context.patchId ?? null,
      scenarioId: context.scenarioId ?? null,
      interventionBackfilledCount: backfillResult.interventionBackfilledCount,
      baselineOnlyUpdatedCount: backfillResult.baselineOnlyUpdatedCount,
      totalOptionsInPayload: patch.ceeAnalysisReady.options?.length ?? 0,
    })
  }

  backfillGoalThresholdOntoGoalNode(patch.ceeAnalysisReady)
  } finally {
    useCanvasStore.getState().endExternalGraphMutation()
  }
}

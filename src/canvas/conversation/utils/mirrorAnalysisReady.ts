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
  useCanvasStore.getState().setCeeAnalysisReady(patch.ceeAnalysisReady)

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
}

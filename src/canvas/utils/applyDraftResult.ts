/**
 * applyDraftResult - Apply a CEE draft response to the canvas store
 *
 * Standalone utility extracted from DraftChat's applyDraftToCanvas for reuse
 * in retry flows. Maps CEE adapter output to React Flow node/edge format
 * and updates the store in a single transaction.
 *
 * Key differences from DraftChat's version:
 * - No DEV-only diagnostic logging (keeps module small)
 * - Omits provenance text formatting (display concern, not analysis-critical)
 * - Includes saveAutosave for crash resilience
 */

import { useCanvasStore } from '../store'
import { DEFAULT_EDGE_DATA } from '../domain/edges'
import { saveAutosave } from '../store/scenarios'
import { hasAnalysisReady, isCEEv3Response } from '../../adapters/cee/types'
import type { CEEDraftResponse, CEEv2Response, CEEv3Response, EffectDirection } from '../../adapters/cee/types'
import { logger } from '../../lib/logger'

/**
 * Apply a CEE draft response to the canvas, replacing the current graph.
 *
 * This function replaces all existing nodes/edges, pushes history, triggers
 * layout, selects the goal node, and stores analysis_ready + quality from
 * the response.
 */
export function applyDraftResult(
  draftData: CEEDraftResponse | CEEv2Response | CEEv3Response
): { nodeCount: number; edgeCount: number } {
  const rawNodes = draftData?.nodes ?? (draftData as any)?.graph?.nodes ?? []
  const rawEdges = draftData?.edges ?? (draftData as any)?.graph?.edges ?? []

  if (!rawNodes.length) return { nodeCount: 0, edgeCount: 0 }

  // --- Map nodes ---
  const nodes = rawNodes.map((n: any) => {
    const { id, kind, type: nodeType, label, observed_state, ...rest } = n

    // Derive interventionKeys when interventions object is present (e.g. from CEE add_node)
    const interventions = rest.interventions as Record<string, unknown> | undefined
    const interventionKeys = interventions && typeof interventions === 'object' && !Array.isArray(interventions)
      ? Object.keys(interventions)
      : undefined

    return {
      id,
      type: kind || nodeType,
      position: { x: 0, y: 0 },
      data: {
        ...rest,
        label,
        kind: kind || nodeType,
        ...(observed_state ? { observedState: observed_state } : {}),
        ...(interventionKeys ? { interventionKeys } : {}),
      },
    }
  })

  // --- Map edges ---
  const edges = rawEdges.map((e: any, i: number) => {
    const id =
      typeof e.id === 'string' && e.id.trim().length > 0 ? e.id : `e-${i}`

    // Weight priority: strength.mean > strength_mean > weight > default
    const rawWeight: number =
      typeof e.strength?.mean === 'number'
        ? e.strength.mean
        : typeof e.strength_mean === 'number'
          ? e.strength_mean
          : typeof e.weight === 'number'
            ? e.weight
            : DEFAULT_EDGE_DATA.weight

    // Direction inference
    const directionFromEdge: EffectDirection | undefined =
      e.effect_direction === 'positive' || e.effect_direction === 'negative'
        ? e.effect_direction
        : undefined
    const direction: EffectDirection =
      directionFromEdge ?? (rawWeight < 0 ? 'negative' : 'positive')

    // UI-SEM-038: Duplicate of UI-SEM-023/024/025 on alternate ingestion path.
    const weight = Math.max(0, Math.min(2, Math.abs(rawWeight)))
    const confidence =
      typeof e.belief === 'number'
        ? Math.max(0, Math.min(1, e.belief))
        : undefined
    const beliefExists =
      typeof e.belief_exists === 'number'
        ? Math.max(0, Math.min(1, e.belief_exists))
        : typeof e.exists_probability === 'number'
          ? Math.max(0, Math.min(1, e.exists_probability))
          : confidence
    const strengthStd: number | undefined =
      typeof e.strength?.std === 'number'
        ? e.strength.std
        : typeof e.strength_std === 'number'
          ? e.strength_std
          : undefined

    // V3 edge metadata — explicitly extract known fields (no blind spread)
    const edgeType = typeof e.edge_type === 'string' ? e.edge_type : undefined
    const provenanceSource = typeof e.provenance_source === 'string' ? e.provenance_source : undefined
    const existsProbability =
      typeof e.exists_probability === 'number'
        ? Math.max(0, Math.min(1, e.exists_probability))
        : undefined

    return {
      id,
      source: e.from,
      target: e.to,
      type: 'styled' as const,
      data: {
        ...DEFAULT_EDGE_DATA,
        weight,
        pathType: 'bezier' as const,
        confidence,
        beliefExists,
        ...(direction ? { direction } : {}),
        ...(strengthStd !== undefined ? { strengthStd } : {}),
        ...(edgeType !== undefined ? { edge_type: edgeType } : {}),
        ...(provenanceSource !== undefined ? { provenance_source: provenanceSource } : {}),
        ...(existsProbability !== undefined ? { exists_probability: existsProbability } : {}),
      },
    }
  })

  // --- Apply to store ---
  const store = useCanvasStore.getState()
  store.pushHistory()
  useCanvasStore.setState({
    nodes,
    edges,
  })

  // Trigger layout (all new nodes start at 0,0)
  void store
    .applyLayout()
    .then(() => store.setPendingFitView(true))
    .catch((err) => console.error('[applyDraftResult] Layout failed:', err))

  // Immediate autosave for crash resilience
  try {
    const current = useCanvasStore.getState()
    saveAutosave({
      timestamp: Date.now(),
      scenarioId: current.currentScenarioId || undefined,
      nodes: current.nodes,
      edges: current.edges,
    })
  } catch {
    // Non-critical — swallow save errors
  }

  // Auto-select goal node if exactly one exists
  const goalNodes = nodes.filter((n: any) => n.type === 'goal')
  if (goalNodes.length === 1) {
    useCanvasStore.getState().setOutcomeNode(goalNodes[0].id)
  }

  // Store analysis_ready for pre-analysis panel & run pipeline
  if (hasAnalysisReady(draftData)) {
    const coachingSummary = (draftData as any).coaching?.summary
    const analysisReadyWithCoaching = coachingSummary
      ? { ...draftData.analysis_ready, coaching_summary: coachingSummary }
      : draftData.analysis_ready
    useCanvasStore.getState().setCeeAnalysisReady(analysisReadyWithCoaching)

    // Backfill interventions onto option nodes. CEE publishes intervention data
    // via analysis_ready.options[], not via graph_patch add_node operations, so
    // we mirror them onto node.data.interventions for the consumers that read
    // there directly: OptionNode/FactorNode rendering, islRequestAdapter,
    // useScenarioComparison, and the debug bundle export.
    //
    // The PLoT v2 adapter prefers analysis_ready and falls back to node.data
    // when reconciling — see adapters/plot/v2/adapter.ts:reconcileOptionsWithCanvasNodes.
    //
    // This backfill stays until every consumer migrates to read from
    // ceeAnalysisReady.options[]. The CEE-side fix on 2026-04-08 (preventing
    // envelope.ts from clobbering analysis_ready) does NOT remove this need.
    //
    // Timing: runs synchronously after setCeeAnalysisReady; nodes are already
    // in store from the setState call above. If option nodes don't exist yet,
    // this is a no-op.
    const { backfilledCount } = backfillInterventionsOntoOptionNodes(analysisReadyWithCoaching)

    // Per-draft observability: emit a structured log with the count of option
    // nodes that received backfilled interventions. The goal is for this to
    // trend to zero after the 2026-04-08 envelope fix; if it stays >0 it means
    // the pipeline still publishes interventions on analysis_ready.options[]
    // rather than on graph_patch add_node operations and the canvas-side
    // backfill is still load-bearing. See docs/intervention-authority-contract.md.
    if (backfilledCount > 0) {
      logger.warn('apply_draft.intervention_backfill', {
        scenarioId: useCanvasStore.getState().currentScenarioId ?? null,
        backfilledCount,
        totalOptionsInPayload: analysisReadyWithCoaching.options?.length ?? 0,
      })
    }

    // Backfill goal_threshold_raw/unit/cap from analysis_ready onto the goal node.
    // CEE sends these on analysis_ready, but the GoalNode component reads from node.data.
    backfillGoalThresholdOntoGoalNode(analysisReadyWithCoaching)
  }

  // Store goal_constraints from V3 response root (for non-orchestrator draft flow).
  // Orchestrator flow handles this in useConversation.handleEnvelope.
  // Must also clear stale constraints when the new draft has none — mirrors
  // DraftChat.tsx:720 and useConversation.ts:1832-1835 clearing logic.
  if (isCEEv3Response(draftData)) {
    if (Array.isArray(draftData.goal_constraints) && draftData.goal_constraints.length > 0) {
      useCanvasStore.getState().setGoalConstraints(draftData.goal_constraints)
    } else {
      useCanvasStore.getState().setGoalConstraints(null)
    }
  }

  // Store quality dimensions
  const quality = (draftData as any).quality
  if (quality && typeof quality.overall === 'number') {
    useCanvasStore.getState().setCeeQuality({
      overall: quality.overall ?? 5,
      structure: quality.structure ?? quality.overall ?? 5,
      coverage: quality.coverage ?? quality.overall ?? 5,
      causality: quality.causality ?? quality.overall ?? 5,
      safety: quality.safety ?? quality.overall ?? 5,
    })
  }

  // Store pipeline trace if present
  const pipelineTrace =
    (draftData as any).pipeline_trace ?? (draftData as any).trace?.pipeline
  if (
    pipelineTrace &&
    typeof pipelineTrace === 'object' &&
    Array.isArray(pipelineTrace.stages)
  ) {
    useCanvasStore.getState().setCeePipelineTrace(pipelineTrace)
  }

  return { nodeCount: nodes.length, edgeCount: edges.length }
}

// ---------------------------------------------------------------------------
// Intervention backfill — shared between applyDraftResult and handleEnvelope
// ---------------------------------------------------------------------------

/**
 * Backfill interventions and is_baseline from analysis_ready onto option nodes.
 *
 * CEE publishes intervention data and the is_baseline flag on
 * analysis_ready.options[], not on individual graph_patch add_node operations.
 * Multiple UI consumers read from node.data.interventions / node.data.is_baseline
 * directly: OptionNode, FactorNode, islRequestAdapter, useScenarioComparison,
 * the debug bundle export, and the PLoT v2 adapter as a fallback.
 *
 * Idempotent: only writes to store when at least one node's interventions or
 * is_baseline value actually differ (deep equality via JSON serialisation),
 * avoiding unnecessary re-renders on repeated calls.
 *
 * @returns `{ backfilledCount }` — number of option nodes that received an
 *   updated payload. Used by the call site to emit per-draft observability
 *   so we can track whether the backfill is still load-bearing after the
 *   2026-04-08 envelope fix; see docs/intervention-authority-contract.md.
 */
export function backfillInterventionsOntoOptionNodes(
  analysisReady: { options?: Array<{ id: string; interventions?: Record<string, unknown>; is_baseline?: boolean | null }> } | null
): { backfilledCount: number } {
  if (!analysisReady?.options?.length) return { backfilledCount: 0 }

  // TODO: type narrowing — useCanvasStore.getState().nodes typed as Node[]
  // but node.type/data shape varies by kind. Cast to any for now.
  const currentNodes = useCanvasStore.getState().nodes as any[]
  let needsUpdate = false

  const updatedNodes = currentNodes.map((n) => {
    if (n.data?.kind !== 'option' && n.data?.type !== 'option') return n
    const optEntry = analysisReady.options!.find((o) => o.id === n.id)
    if (!optEntry) return n

    const hasInterventions = optEntry.interventions && Object.keys(optEntry.interventions).length > 0

    // Backfill is_baseline from analysis_ready onto option node data.
    // Always write the boolean so that non-baseline options clear a stale true.
    const existingBaseline = (n.data?.is_baseline as boolean | undefined) ?? false
    const newBaseline = optEntry.is_baseline === true
    const baselineChanged = newBaseline !== existingBaseline

    if (!hasInterventions && !baselineChanged) return n

    // Idempotent guard: skip if interventions are already identical (keys + values)
    const existing = n.data?.interventions as Record<string, unknown> | undefined
    const newKeys = hasInterventions ? Object.keys(optEntry.interventions!) : undefined
    if (hasInterventions && existing) {
      try {
        if (JSON.stringify(existing) === JSON.stringify(optEntry.interventions) && !baselineChanged) return n
      } catch {
        // Fall through to update if serialisation fails
      }
    }

    needsUpdate = true
    return {
      ...n,
      data: {
        ...n.data,
        ...(hasInterventions ? { interventions: optEntry.interventions, interventionKeys: newKeys } : {}),
        is_baseline: newBaseline,
      },
    }
  })

  let backfilledCount = 0
  if (needsUpdate) {
    useCanvasStore.setState({ nodes: updatedNodes as any })
    backfilledCount = updatedNodes.filter((n, i) => n !== currentNodes[i]).length
    if (import.meta.env.DEV) {
      console.warn('[backfillInterventionsOntoOptionNodes]', backfilledCount, 'option nodes updated')
    }
  }
  return { backfilledCount }
}

// ---------------------------------------------------------------------------
// Goal threshold backfill
// ---------------------------------------------------------------------------

/**
 * Backfill goal_threshold_raw/unit/cap from analysis_ready onto the goal node.
 *
 * CEE sends these on analysis_ready, but GoalNode reads from node.data.
 * Distinguishes "field absent" (don't touch) from "field present but null"
 * (clear stale value). Idempotent: only writes when values actually differ.
 */
export function backfillGoalThresholdOntoGoalNode(
  analysisReady: {
    goal_node_id?: string
    goal_threshold_raw?: number | null
    goal_threshold_unit?: string | null
    goal_threshold_cap?: number | null
  } | null
): void {
  if (!analysisReady?.goal_node_id) return

  // Distinguish "field absent from analysisReady" (don't touch) from
  // "field present but null" (clear the value on the goal node).
  const hasRaw = 'goal_threshold_raw' in analysisReady
  const hasUnit = 'goal_threshold_unit' in analysisReady
  const hasCap = 'goal_threshold_cap' in analysisReady

  // Nothing to backfill if none of the fields are present on analysisReady
  if (!hasRaw && !hasUnit && !hasCap) return

  const raw = analysisReady.goal_threshold_raw ?? null
  const unit = analysisReady.goal_threshold_unit ?? null
  const cap = analysisReady.goal_threshold_cap ?? null

  const currentNodes = useCanvasStore.getState().nodes as any[]
  const goalNode = currentNodes.find((n: any) => n.id === analysisReady.goal_node_id)
  if (!goalNode) return

  // Idempotent: skip if already matching (only check fields that are present)
  const d = goalNode.data as Record<string, unknown> | undefined
  if (
    (!hasRaw || d?.goal_threshold_raw === raw) &&
    (!hasUnit || d?.goal_threshold_unit === unit) &&
    (!hasCap || d?.goal_threshold_cap === cap)
  ) return

  const updatedNodes = currentNodes.map((n: any) => {
    if (n.id !== analysisReady.goal_node_id) return n
    return {
      ...n,
      data: {
        ...n.data,
        ...(hasRaw ? { goal_threshold_raw: raw } : {}),
        ...(hasUnit ? { goal_threshold_unit: unit } : {}),
        ...(hasCap ? { goal_threshold_cap: cap } : {}),
      },
    }
  })

  useCanvasStore.setState({ nodes: updatedNodes as any })
}

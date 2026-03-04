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
import { hasAnalysisReady } from '../../adapters/cee/types'
import type { CEEDraftResponse, CEEv2Response, CEEv3Response, EffectDirection } from '../../adapters/cee/types'

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
    return {
      id,
      type: kind || nodeType,
      position: { x: 0, y: 0 },
      data: {
        ...rest,
        label,
        kind: kind || nodeType,
        ...(observed_state ? { observedState: observed_state } : {}),
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

    const weight = Math.max(0, Math.min(2, Math.abs(rawWeight)))
    const confidence =
      typeof e.belief === 'number'
        ? Math.max(0, Math.min(1, e.belief))
        : undefined
    const beliefExists =
      typeof e.belief_exists === 'number'
        ? Math.max(0, Math.min(1, e.belief_exists))
        : confidence
    const strengthStd: number | undefined =
      typeof e.strength?.std === 'number'
        ? e.strength.std
        : typeof e.strength_std === 'number'
          ? e.strength_std
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

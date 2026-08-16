/**
 * useScenarioComparison - Orchestrates the scenario comparison workflow
 *
 * Combines:
 * 1. Scenario generation from current graph (generateScenarios)
 * 2. The structural diff between the generated scenarios
 *
 * ⚠ THE COMPUTE LEG IS RETIRED. This hook used to POST the full graph to PLoT
 * `/v2/run` directly from the browser and render per-option numbers from the
 * response. That direct browser→PLoT call is retired: analysis is orchestrated
 * by CEE, and no CEE-routed compare endpoint exists yet.
 *
 * What survives is REAL: the sliced graphs and their structural diff are
 * computed locally. What is gone is the NUMBERS, and the hook reports that as
 * its own status (`'unavailable'`) rather than as a failure or as a fabricated
 * empty result. See COMPARISON_UNAVAILABLE_REASON.
 */

import { useState, useCallback, useMemo } from 'react'
import { useCanvasStore } from '../store'
import { generateScenarios, canGenerateScenarios } from '../utils/generateScenarios'
import type { Snapshot, ComparisonResult } from '../snapshots/types'
import type { Node, Edge } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'

/**
 * The user-facing reason the comparison shows no numbers.
 *
 * Exported so the rendering surface and its guard bind to THIS string by
 * identity rather than to a copy that could drift (trap 19). It must stay
 * true: it claims only that the compute is unavailable in this build, and
 * promises nothing about when it returns.
 */
export const COMPARISON_UNAVAILABLE_REASON =
  'Comparison numbers are unavailable in this build. The structural differences below are real, but no analysis was run to compare the options.'

/**
 * Analysis status from PLoT response.
 * - computed: Success, show results
 * - partial: Warning state, show available results + warning
 * - blocked: Error state, show status_reason, no retry (user must fix graph)
 * - failed: Error state, show status_reason, allow retry
 */
export type ComparisonAnalysisStatus =
  | 'idle'
  | 'loading'
  | 'computed'
  | 'partial'
  | 'blocked'
  | 'failed'
  /**
   * The compute leg is retired: no analysis was run, so there are no
   * numbers. Distinct from 'failed' on purpose — nothing failed, and
   * saying it did would be untrue. See COMPARISON_UNAVAILABLE_REASON.
   */
  | 'unavailable'

/**
 * Per-option outcome result extracted from PLoT response.
 */
export interface OptionOutcome {
  optionId: string
  optionLabel: string
  outcome: {
    mean: number
    std?: number
    p10: number
    p50: number
    p90: number
  }
  probabilityOfGoal?: number
  winProbability?: number
  status: 'computed' | 'failed'
}

/**
 * Comparison API response shape for UI consumption.
 * Normalised from PLoT V2RunResponse.
 */
export interface ComparisonApiResponse {
  analysisStatus: ComparisonAnalysisStatus
  statusReason?: string
  options: OptionOutcome[]
  optionById: Record<string, OptionOutcome>
  bestOptionId?: string
  goalNodeId: string
  goalLabel: string
  goalUnit?: string
  responseHash?: string
}

export interface ScenarioComparisonState {
  /** Whether comparison is in progress */
  loading: boolean
  /** Analysis status from PLoT */
  analysisStatus: ComparisonAnalysisStatus
  /** Error/status reason if comparison failed or blocked */
  error: string | null
  /** Generated snapshot for option A */
  snapshotA: Snapshot | null
  /** Generated snapshot for option B */
  snapshotB: Snapshot | null
  /** Comparison diff result */
  comparison: ComparisonResult | null
  /** Normalised API response with per-option outcomes */
  apiResponse: ComparisonApiResponse | null
}

export interface UseScenarioComparisonReturn extends ScenarioComparisonState {
  /** Whether the current graph can generate comparison scenarios */
  canCompare: boolean
  /** Start comparison with optional specific option IDs */
  startComparison: (optionIds?: [string, string]) => Promise<void>
  /** Clear comparison results */
  clearComparison: () => void
}

/**
 * Convert ReactFlow nodes/edges to Snapshot format
 */
function toSnapshot(
  name: string,
  nodes: Node[],
  edges: Edge[]
): Snapshot {
  return {
    id: crypto.randomUUID(),
    name,
    description: `Generated scenario for ${name}`,
    createdAt: new Date(),
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.type,
      data: n.data,
      position: n.position,
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      data: e.data,
    })),
  }
}

/**
 * Fields to exclude from edge data comparison (volatile UI state).
 */
const EDGE_VOLATILE_FIELDS = new Set(['position', 'selected', 'dragging', 'measured', 'zIndex'])

/**
 * Create a comparable edge data object by excluding volatile fields.
 */
function getComparableEdgeData(data: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!data) return {}
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (!EDGE_VOLATILE_FIELDS.has(key)) {
      result[key] = value
    }
  }
  return result
}

/**
 * Compute diff between two snapshots.
 * Uses edge.id for identity (not source->target) to correctly identify different edges.
 */
function computeComparison(a: Snapshot, b: Snapshot): ComparisonResult {
  const aNodeIds = new Set(a.nodes.map(n => n.id))
  const bNodeIds = new Set(b.nodes.map(n => n.id))
  // Task 3: Key edges by edge.id, not source->target
  const aEdgeIds = new Set(a.edges.map(e => e.id))
  const bEdgeIds = new Set(b.edges.map(e => e.id))

  // Added: in B but not A
  const addedNodes = b.nodes.filter(n => !aNodeIds.has(n.id))
  const addedEdges = b.edges.filter(e => !aEdgeIds.has(e.id))

  // Removed: in A but not B
  const removedNodes = a.nodes.filter(n => !bNodeIds.has(n.id))
  const removedEdges = a.edges.filter(e => !bEdgeIds.has(e.id))

  // Modified: in both but with different data (excluding volatile fields)
  const modifiedNodes = a.nodes.filter(n => {
    const bNode = b.nodes.find(bn => bn.id === n.id)
    if (!bNode) return false
    return JSON.stringify(n.data) !== JSON.stringify(bNode.data)
  })
  const modifiedEdges = a.edges.filter(e => {
    const bEdge = b.edges.find(be => be.id === e.id)
    if (!bEdge) return false
    // Compare only non-volatile fields
    const aData = getComparableEdgeData(e.data as Record<string, unknown>)
    const bData = getComparableEdgeData(bEdge.data as Record<string, unknown>)
    return JSON.stringify(aData) !== JSON.stringify(bData)
  })

  // Unchanged: in both with same data
  const unchangedNodes = a.nodes.filter(n => {
    const bNode = b.nodes.find(bn => bn.id === n.id)
    if (!bNode) return false
    return JSON.stringify(n.data) === JSON.stringify(bNode.data)
  })
  const unchangedEdges = a.edges.filter(e => {
    const bEdge = b.edges.find(be => be.id === e.id)
    if (!bEdge) return false
    const aData = getComparableEdgeData(e.data as Record<string, unknown>)
    const bData = getComparableEdgeData(bEdge.data as Record<string, unknown>)
    return JSON.stringify(aData) === JSON.stringify(bData)
  })

  return {
    added: { nodes: addedNodes, edges: addedEdges },
    removed: { nodes: removedNodes, edges: removedEdges },
    modified: { nodes: modifiedNodes, edges: modifiedEdges },
    unchanged: { nodes: unchangedNodes, edges: unchangedEdges },
  }
}

/**
 * Get goal node info from canvas nodes.
 * Task 4: Respect selected goal, with fallback to first goal/outcome node.
 */
function getGoalNodeInfo(
  nodes: Node[],
  outcomeNodeId: string | null
): { id: string; label: string; unit?: string } | null {
  // First try the selected outcomeNodeId
  if (outcomeNodeId) {
    const goalNode = nodes.find(n => n.id === outcomeNodeId)
    if (goalNode) {
      const data = goalNode.data as Record<string, unknown> | undefined
      return {
        id: goalNode.id,
        label: (data?.label as string) || goalNode.id,
        unit: (data?.observed_state as Record<string, unknown>)?.unit as string | undefined
          ?? data?.unit as string | undefined,
      }
    }
  }

  // Fallback: find first node with kind='goal' or kind='outcome'
  const fallbackNode = nodes.find(n => {
    const kind = (n.data as Record<string, unknown>)?.kind
    return kind === 'goal' || kind === 'outcome'
  })

  if (fallbackNode) {
    const data = fallbackNode.data as Record<string, unknown> | undefined
    return {
      id: fallbackNode.id,
      label: (data?.label as string) || fallbackNode.id,
      unit: (data?.observed_state as Record<string, unknown>)?.unit as string | undefined
        ?? data?.unit as string | undefined,
    }
  }

  return null
}

/**
 * Hook to manage scenario comparison workflow
 */
export function useScenarioComparison(): UseScenarioComparisonReturn {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const outcomeNodeId = useCanvasStore(s => s.outcomeNodeId)
  const enterComparisonMode = useCanvasStore(s => s.enterComparisonMode)
  const exitComparisonMode = useCanvasStore(s => s.exitComparisonMode)

  const [state, setState] = useState<ScenarioComparisonState>({
    loading: false,
    analysisStatus: 'idle',
    error: null,
    snapshotA: null,
    snapshotB: null,
    comparison: null,
    apiResponse: null,
  })

  // Check if current graph can generate scenarios
  const canCompare = useMemo(
    () => canGenerateScenarios({ nodes, edges }),
    [nodes, edges]
  )

  // Start comparison workflow
  const startComparison = useCallback(
    async (optionIds?: [string, string]) => {
      setState(prev => ({ ...prev, loading: true, analysisStatus: 'loading', error: null }))

      try {
        // 1. Generate scenarios (for UI display and diff only)
        const scenariosResult = generateScenarios(
          { nodes, edges },
          optionIds ? { optionIds } : {}
        )

        const { scenarios, labels, optionIds: scenarioOptionIds, hasMoreOptions, allOptions } = scenariosResult

        if (scenarios.length < 2) {
          throw new Error('At least two scenarios are required for comparison')
        }

        // 2. Create snapshots for UI display
        const snapshotA = toSnapshot(
          labels[0] || 'Option A',
          scenarios[0].nodes,
          scenarios[0].edges
        )
        const snapshotB = toSnapshot(
          labels[1] || 'Option B',
          scenarios[1].nodes,
          scenarios[1].edges
        )

        // 3. Compute structural diff
        const comparison = computeComparison(snapshotA, snapshotB)

        // 4. Ensure option IDs are present
        const optionAId = scenarioOptionIds[0]
        const optionBId = scenarioOptionIds[1]
        if (!optionAId || !optionBId) {
          throw new Error('Could not identify option nodes in scenarios')
        }

        // 5. Get goal node info (Task 4: respect selected goal)
        // The goal-node precondition is still real: without one there is
        // nothing to compare, and saying so is truer than an empty view.
        if (!getGoalNodeInfo(nodes, outcomeNodeId)) {
          throw new Error('No goal node selected or found. Please select a goal node before comparing.')
        }

        // 6. RETIRED — the direct browser→PLoT compare compute is gone.
        //
        // This surface used to POST the whole graph straight to PLoT `/v2/run`
        // from the browser. That call is retired with the rest of the direct
        // browser→PLoT run seam (analysis is orchestrated by CEE), and no
        // CEE-routed compare endpoint exists yet.
        //
        // We deliberately do NOT fabricate numbers and do NOT reuse the
        // 'failed' state — nothing failed, so saying "Comparison failed" would
        // be untrue. The structural diff is computed locally and IS still
        // true, so the comparison view still opens; only the computed numbers
        // are missing, and the surface says exactly that.
        setState({
          loading: false,
          analysisStatus: 'unavailable',
          error: null,
          snapshotA,
          snapshotB,
          comparison,
          apiResponse: null,
        })

        enterComparisonMode(
          scenarios.map((scenario, idx) => ({
            nodes: scenario.nodes,
            edges: scenario.edges as Edge<EdgeData>[],
            label: labels[idx] || `Option ${scenarioOptionIds[idx]}`,
            optionId: scenarioOptionIds[idx],
          })),
          null,
          comparison,
          null,
          { hasMoreOptions, allOptionsCount: allOptions.length }
        )
        return


      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Comparison failed'
        console.error('[useScenarioComparison] Error:', error)

        setState({
          loading: false,
          analysisStatus: 'failed',
          error: errorMessage,
          snapshotA: null,
          snapshotB: null,
          comparison: null,
          apiResponse: null,
        })
      }
    },
    [nodes, edges, outcomeNodeId, enterComparisonMode]
  )

  // Clear comparison results and exit comparison mode
  const clearComparison = useCallback(() => {
    setState({
      loading: false,
      analysisStatus: 'idle',
      error: null,
      snapshotA: null,
      snapshotB: null,
      comparison: null,
      apiResponse: null,
    })
    exitComparisonMode()
  }, [exitComparisonMode])

  return {
    ...state,
    canCompare,
    startComparison,
    clearComparison,
  }
}

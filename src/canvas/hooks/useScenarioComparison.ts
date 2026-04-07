/**
 * useScenarioComparison - Orchestrates the scenario comparison workflow
 *
 * Combines:
 * 1. Scenario generation from current graph (generateScenarios)
 * 2. API call to PLoT /v2/run (single request with both options)
 * 3. Result transformation for ScenarioComparison display
 *
 * Architecture (post-fix):
 * - Sends ONE request to /bff/engine/v2/run with full graph + both options
 * - Extracts per-option results from response.option_comparison array
 * - Sliced graphs from generateScenarios() are for UI display/diff only
 */

import { useState, useCallback, useMemo } from 'react'
import { useCanvasStore } from '../store'
import { generateScenarios, canGenerateScenarios } from '../utils/generateScenarios'
import { unwrapInterventionValue } from '../utils/labelUtils'
import type { Snapshot, ComparisonResult } from '../snapshots/types'
import type { Node, Edge } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'
import {
  runV2,
  buildV2Request,
  isBlockedResponse,
  isFailedAnalysis,
  isSuccessfulAnalysis,
  type V2AdapterConfig,
  type V2RunResponse,
  type V2OptionComparison,
} from '../../adapters/plot/v2'

/**
 * Analysis status from PLoT response.
 * - computed: Success, show results
 * - partial: Warning state, show available results + warning
 * - blocked: Error state, show status_reason, no retry (user must fix graph)
 * - failed: Error state, show status_reason, allow retry
 */
export type ComparisonAnalysisStatus = 'idle' | 'loading' | 'computed' | 'partial' | 'blocked' | 'failed'

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
 * Extract option outcome from V2 response option_comparison array.
 */
function extractOptionOutcome(
  optionComparison: V2OptionComparison[] | undefined,
  optionId: string,
  fallbackLabel?: string
): OptionOutcome | null {
  if (!optionComparison) return null
  const result = optionComparison.find(oc => oc.option_id === optionId)
  if (!result) return null

  return {
    optionId: result.option_id,
    optionLabel: result.option_label || fallbackLabel || optionId,
    outcome: {
      mean: result.expected_outcome ?? result.outcome?.mean ?? 0,
      std: result.outcome?.std,
      // Task 2: Use p10/p90, not p5/p95
      p10: result.outcome?.p10 ?? result.confidence_interval?.[0] ?? 0,
      p50: result.outcome?.p50 ?? result.expected_outcome ?? 0,
      p90: result.outcome?.p90 ?? result.confidence_interval?.[1] ?? 0,
    },
    probabilityOfGoal: result.probability_of_goal,
    winProbability: result.win_probability,
    status: 'computed',
  }
}

function buildFallbackOutcome(optionId: string, label: string): OptionOutcome {
  return {
    optionId,
    optionLabel: label,
    outcome: { mean: 0, p10: 0, p50: 0, p90: 0 },
    status: 'failed',
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

        const optionLabelMap = new Map(
          scenarioOptionIds.map((id, idx) => [id, labels[idx] || `Option ${id}`])
        )

        // 5. Get goal node info (Task 4: respect selected goal)
        const goalInfo = getGoalNodeInfo(nodes, outcomeNodeId)
        if (!goalInfo) {
          throw new Error('No goal node selected or found. Please select a goal node before comparing.')
        }

        // 6. Build V2 request with FULL graph + both options
        // Critical: PLoT requires minimum 2 options per request
        const validNodeIds = new Set(nodes.map(n => n.id))
        const optionNodes = nodes.filter(n => {
          const kind = (n.data as Record<string, unknown>)?.kind
          const type = (n.data as Record<string, unknown>)?.type
          return kind === 'option' || type === 'option' || n.type === 'option'
        })

        // Build options array with interventions from option nodes
        const uiOptions = optionNodes
          .filter(n => scenarioOptionIds.includes(n.id))
          .map(node => {
            const data = node.data as Record<string, unknown>
            const interventions: Record<string, number> = {}

            // Extract interventions from node data. Use the shared unwrap
            // helper so heterogeneous shapes (number / V3 object / malformed)
            // are normalised once. Entries that fail to unwrap are dropped
            // — sending {value: null} to PLoT would either error or produce
            // nonsense scenarios.
            if (data?.interventions && typeof data.interventions === 'object') {
              for (const [key, rawValue] of Object.entries(data.interventions as Record<string, unknown>)) {
                if (validNodeIds.has(key) && key !== node.id) {
                  const unwrapped = unwrapInterventionValue(rawValue)
                  if (unwrapped != null) {
                    interventions[key] = unwrapped
                  }
                }
              }
            }

            return {
              id: node.id,
              label: (data?.label as string) || optionLabelMap.get(node.id) || node.id,
              status: 'ready' as const,
              interventions: Object.fromEntries(
                Object.entries(interventions).map(([k, v]) => [k, { value: v, source: 'user_specified' as const }])
              ),
              source: 'legacy_node' as const,
            }
          })

        // 7. Call PLoT /v2/run with full graph + both options
        const config: V2AdapterConfig = {
          baseUrl: import.meta.env.VITE_PLOT_PROXY_BASE || '/bff/engine',
          timeout: 120000,
        }

        const { request, reverseIdMap: _reverseIdMap } = buildV2Request(
          nodes as Node<Record<string, unknown>>[],
          edges as Edge<Record<string, unknown>>[],
          uiOptions,
          goalInfo.id
        )

        // Add request ID for tracing
        request.request_id = `compare-${Date.now()}`

        if (import.meta.env.DEV) {
          console.log('[useScenarioComparison] Sending PLoT request:', {
            requestId: request.request_id,
            nodeCount: request.graph.nodes.length,
            edgeCount: request.graph.edges.length,
            optionCount: request.options.length,
            goalNodeId: request.goal_node_id,
            optionIds: request.options.map(o => o.id),
          })
        }

        const result = await runV2(config, request)

        // 8. Handle response based on analysis_status (Task 5)
        let apiResponse: ComparisonApiResponse

        if (isBlockedResponse(result)) {
          // Blocked: user must fix graph, no retry
          const fallbackOptions = scenarioOptionIds.map((id, idx) =>
            buildFallbackOutcome(id, labels[idx] || `Option ${id}`)
          )
          const optionById = Object.fromEntries(fallbackOptions.map((opt) => [opt.optionId, opt]))

          apiResponse = {
            analysisStatus: 'blocked',
            statusReason: result.status_reason,
            options: fallbackOptions,
            optionById,
            goalNodeId: goalInfo.id,
            goalLabel: goalInfo.label,
            goalUnit: goalInfo.unit,
          }

          setState({
            loading: false,
            analysisStatus: 'blocked',
            error: result.status_reason,
            snapshotA,
            snapshotB,
            comparison,
            apiResponse,
          })

          // Still enter comparison mode to show the structural diff
          // Type assertion safe: edges originate from canvas store which uses EdgeData
          enterComparisonMode(
            scenarios.map((scenario, idx) => ({
              nodes: scenario.nodes,
              edges: scenario.edges as Edge<EdgeData>[],
              label: labels[idx] || `Option ${scenarioOptionIds[idx]}`,
              optionId: scenarioOptionIds[idx],
            })),
            null,
            comparison,
            { analysis_status: 'blocked' },
            { hasMoreOptions, allOptionsCount: allOptions.length }
          )
          return
        }

        if (isFailedAnalysis(result)) {
          // Failed: allow retry
          const failedResult = result as V2RunResponse
          const fallbackOptions = scenarioOptionIds.map((id, idx) =>
            buildFallbackOutcome(id, labels[idx] || `Option ${id}`)
          )
          const optionById = Object.fromEntries(fallbackOptions.map((opt) => [opt.optionId, opt]))

          apiResponse = {
            analysisStatus: 'failed',
            statusReason: 'Analysis could not complete. Please try again.',
            options: fallbackOptions,
            optionById,
            goalNodeId: goalInfo.id,
            goalLabel: goalInfo.label,
            goalUnit: goalInfo.unit,
            responseHash: failedResult.response_hash,
          }

          setState({
            loading: false,
            analysisStatus: 'failed',
            error: 'Analysis could not complete',
            snapshotA,
            snapshotB,
            comparison,
            apiResponse,
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
            { analysis_status: 'failed' },
            { hasMoreOptions, allOptionsCount: allOptions.length }
          )
          return
        }

        if (isSuccessfulAnalysis(result)) {
          const successResult = result as V2RunResponse
          const status: ComparisonAnalysisStatus = successResult.analysis_status === 'partial' ? 'partial' : 'computed'

          // Extract per-option outcomes from option_comparison array
          const options = scenarioOptionIds.map((id, idx) =>
            extractOptionOutcome(successResult.option_comparison, id, labels[idx] || `Option ${id}`)
              ?? buildFallbackOutcome(id, labels[idx] || `Option ${id}`)
          )
          const optionById = Object.fromEntries(options.map((opt) => [opt.optionId, opt]))

          const bestOption = [...options]
            .filter((opt) => opt.status === 'computed')
            .sort((a, b) => {
              const aScore = a.winProbability ?? a.outcome.mean
              const bScore = b.winProbability ?? b.outcome.mean
              return bScore - aScore
            })[0]

          apiResponse = {
            analysisStatus: status,
            statusReason: status === 'partial' ? 'Some results may be incomplete' : undefined,
            options,
            optionById,
            bestOptionId: bestOption?.optionId,
            goalNodeId: goalInfo.id,
            goalLabel: goalInfo.label,
            goalUnit: goalInfo.unit,
            responseHash: successResult.response_hash,
          }

          if (import.meta.env.DEV) {
            console.log('[useScenarioComparison] PLoT response processed:', {
              status,
              optionCount: options.length,
              goalLabel: goalInfo.label,
            })
          }

          setState({
            loading: false,
            analysisStatus: status,
            error: null,
            snapshotA,
            snapshotB,
            comparison,
            apiResponse,
          })

          const optionComparisonPayload = successResult.option_comparison?.map((item) => ({
            option_id: item.option_id,
            option_label: item.option_label,
            expected_outcome: item.expected_outcome,
            win_probability: item.win_probability,
            outcome: item.outcome?.mean !== undefined
              ? {
                  mean: item.outcome.mean ?? 0,
                  p10: item.outcome.p10 ?? 0,
                  p50: item.outcome.p50 ?? 0,
                  p90: item.outcome.p90 ?? 0,
                }
              : undefined,
          }))

          const legacyApiResponse = options.length >= 2 ? {
            base_scenario: {
              id: options[0].optionId,
              name: options[0].optionLabel,
              outcome_predictions: { [goalInfo.id]: options[0].outcome.mean },
            },
            alternative_scenarios: options.slice(1).map((opt) => ({
              id: opt.optionId,
              name: opt.optionLabel,
              outcome_predictions: { [goalInfo.id]: opt.outcome.mean },
            })),
            option_comparison: optionComparisonPayload,
            analysis_status: successResult.analysis_status,
          } : {
            option_comparison: optionComparisonPayload,
            analysis_status: successResult.analysis_status,
          }

          enterComparisonMode(
            scenarios.map((scenario, idx) => ({
              nodes: scenario.nodes,
              edges: scenario.edges as Edge<EdgeData>[],
              label: labels[idx] || `Option ${scenarioOptionIds[idx]}`,
              optionId: scenarioOptionIds[idx],
            })),
            null,
            comparison,
            legacyApiResponse,
            { hasMoreOptions, allOptionsCount: allOptions.length }
          )
          return
        }

        // Unexpected state
        throw new Error('Unexpected response format from PLoT')

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

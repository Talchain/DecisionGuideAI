/**
 * useScenarioComparison - Orchestrates the scenario comparison workflow
 *
 * Combines:
 * 1. Scenario generation from current graph (generateScenarios)
 * 2. API call to /bff/isl/compare
 * 3. Result transformation for ScenarioComparison display
 */

import { useState, useCallback, useMemo } from 'react'
import { useCanvasStore } from '../store'
import { generateScenarios, canGenerateScenarios } from '../utils/generateScenarios'
import { useISLComparison } from '../../hooks/useISLComparison'
import type { Snapshot, ComparisonResult } from '../snapshots/types'
import type { Node, Edge } from '@xyflow/react'

export interface ScenarioComparisonState {
  /** Whether comparison is in progress */
  loading: boolean
  /** Error if comparison failed */
  error: string | null
  /** Generated snapshot for option A */
  snapshotA: Snapshot | null
  /** Generated snapshot for option B */
  snapshotB: Snapshot | null
  /** Comparison diff result */
  comparison: ComparisonResult | null
  /** API response with predictions */
  apiResponse: any | null
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
 * Compute diff between two snapshots
 */
function computeComparison(a: Snapshot, b: Snapshot): ComparisonResult {
  const aNodeIds = new Set(a.nodes.map(n => n.id))
  const bNodeIds = new Set(b.nodes.map(n => n.id))
  const aEdgeKeys = new Set(a.edges.map(e => `${e.source}->${e.target}`))
  const bEdgeKeys = new Set(b.edges.map(e => `${e.source}->${e.target}`))

  // Added: in B but not A
  const addedNodes = b.nodes.filter(n => !aNodeIds.has(n.id))
  const addedEdges = b.edges.filter(e => !aEdgeKeys.has(`${e.source}->${e.target}`))

  // Removed: in A but not B
  const removedNodes = a.nodes.filter(n => !bNodeIds.has(n.id))
  const removedEdges = a.edges.filter(e => !bEdgeKeys.has(`${e.source}->${e.target}`))

  // Modified: in both but with different data (simplified check)
  const modifiedNodes = a.nodes.filter(n => {
    const bNode = b.nodes.find(bn => bn.id === n.id)
    if (!bNode) return false
    return JSON.stringify(n.data) !== JSON.stringify(bNode.data)
  })
  const modifiedEdges = a.edges.filter(e => {
    const bEdge = b.edges.find(be => be.source === e.source && be.target === e.target)
    if (!bEdge) return false
    return JSON.stringify(e.data) !== JSON.stringify(bEdge.data)
  })

  // Unchanged: in both with same data
  const unchangedNodes = a.nodes.filter(n => {
    const bNode = b.nodes.find(bn => bn.id === n.id)
    if (!bNode) return false
    return JSON.stringify(n.data) === JSON.stringify(bNode.data)
  })
  const unchangedEdges = a.edges.filter(e => {
    const bEdge = b.edges.find(be => be.source === e.source && be.target === e.target)
    if (!bEdge) return false
    return JSON.stringify(e.data) === JSON.stringify(bEdge.data)
  })

  return {
    added: { nodes: addedNodes, edges: addedEdges },
    removed: { nodes: removedNodes, edges: removedEdges },
    modified: { nodes: modifiedNodes, edges: modifiedEdges },
    unchanged: { nodes: unchangedNodes, edges: unchangedEdges },
  }
}

/**
 * Hook to manage scenario comparison workflow
 */
export function useScenarioComparison(): UseScenarioComparisonReturn {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const enterComparisonMode = useCanvasStore(s => s.enterComparisonMode)
  const exitComparisonMode = useCanvasStore(s => s.exitComparisonMode)

  const [state, setState] = useState<ScenarioComparisonState>({
    loading: false,
    error: null,
    snapshotA: null,
    snapshotB: null,
    comparison: null,
    apiResponse: null,
  })

  const { compare } = useISLComparison()

  // Check if current graph can generate scenarios
  const canCompare = useMemo(
    () => canGenerateScenarios({ nodes, edges }),
    [nodes, edges]
  )

  // Start comparison workflow
  const startComparison = useCallback(
    async (optionIds?: [string, string]) => {
      setState(prev => ({ ...prev, loading: true, error: null }))

      try {
        // 1. Generate scenarios
        const scenarios = generateScenarios(
          { nodes, edges },
          optionIds ? { optionIds } : {}
        )

        // 2. Create snapshots for UI display
        const snapshotA = toSnapshot(
          scenarios.labels.a,
          scenarios.scenarioA.nodes,
          scenarios.scenarioA.edges
        )
        const snapshotB = toSnapshot(
          scenarios.labels.b,
          scenarios.scenarioB.nodes,
          scenarios.scenarioB.edges
        )

        // 3. Compute diff
        const comparison = computeComparison(snapshotA, snapshotB)

        // 4. Call ISL compare API (optional, depends on backend availability)
        let apiResponse = null
        try {
          // Transform to ISL format
          const islRequest = {
            graph: {
              nodes: nodes.map(n => ({
                id: n.id,
                label: (n.data?.label as string) || n.id,
                type: n.type || 'unknown',
                value: n.data?.value,
              })),
              edges: edges.map(e => ({
                from: e.source,
                to: e.target,
                weight: (e.data?.weight as number) || 1,
              })),
            },
            options: {
              comparison_scenarios: [
                {
                  name: scenarios.labels.a,
                  modifications: { selected_option: scenarios.scenarioA.nodes.find(n => n.type === 'option')?.id },
                },
                {
                  name: scenarios.labels.b,
                  modifications: { selected_option: scenarios.scenarioB.nodes.find(n => n.type === 'option')?.id },
                },
              ],
            },
          }

          apiResponse = await compare(islRequest)
        } catch (apiError) {
          // API call is optional - log but don't fail the comparison
          console.warn('[useScenarioComparison] ISL compare API failed:', apiError)
        }

        // 5. Update state with results
        setState({
          loading: false,
          error: null,
          snapshotA,
          snapshotB,
          comparison,
          apiResponse,
        })

        // 6. Activate comparison mode in the store for canvas layout switching
        enterComparisonMode(
          {
            nodes: scenarios.scenarioA.nodes as Node[],
            edges: scenarios.scenarioA.edges as Edge[],
            label: scenarios.labels.a,
          },
          {
            nodes: scenarios.scenarioB.nodes as Node[],
            edges: scenarios.scenarioB.edges as Edge[],
            label: scenarios.labels.b,
          },
          comparison, // Pass diff data to store for stats bar and changes view
          apiResponse // Pass API response with outcome predictions
        )
      } catch (error) {
        setState({
          loading: false,
          error: error instanceof Error ? error.message : 'Comparison failed',
          snapshotA: null,
          snapshotB: null,
          comparison: null,
          apiResponse: null,
        })
      }
    },
    [nodes, edges, compare, enterComparisonMode]
  )

  // Clear comparison results and exit comparison mode
  const clearComparison = useCallback(() => {
    setState({
      loading: false,
      error: null,
      snapshotA: null,
      snapshotB: null,
      comparison: null,
      apiResponse: null,
    })
    // Also exit comparison mode in the store
    exitComparisonMode()
  }, [exitComparisonMode])

  return {
    ...state,
    canCompare,
    startComparison,
    clearComparison,
  }
}

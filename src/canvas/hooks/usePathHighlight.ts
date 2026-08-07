/**
 * usePathHighlight - Highlight causal paths based on node selection
 *
 * When a single node is selected:
 * - Factor: Highlight all downstream paths to goal
 * - Option: Highlight intervention targets → goal paths
 * - Goal: Highlight all incoming paths from roots
 *
 * Features:
 * - Uses two-phase algorithm for correct reconverging graph handling
 * - Dims nodes not on highlighted paths (opacity ~0.4)
 * - Clears highlights on selection change (no timer-based auto-clear)
 * - Multi-select clears all highlights to prevent stale state
 * - F3 (graph-visuals): defers to an active focus dim (store.focusDimSourceId)
 *   for the selected node — and clears it the moment selection moves away
 *
 * IMPORTANT: Uses canonical sources for goal_node_id and options:
 * - Goal node ID: ceeAnalysisReady.goal_node_id
 * - Options with interventions: ceeAnalysisReady.options
 *
 * React #185 FIX: Uses primitive selectors and getState() pattern to avoid
 * infinite loops with Zustand v5. Object/array selectors would cause
 * re-renders on reference changes.
 */

import { useEffect } from 'react'
import { useCanvasStore } from '../store'
import {
  findPathsToGoal,
  findPathsFromRoots,
  getInterventionTargets,
} from '../utils/pathFinding'

/**
 * Hook to manage path highlighting based on node selection.
 * Call this hook in the main canvas component to enable path highlighting.
 */
export function usePathHighlight(): void {
  // React #185 FIX: Use primitive selector for selection size to avoid infinite loops
  const selectionSize = useCanvasStore((s) => s.selection.nodeIds.size)

  // Get selected ID as primitive (only meaningful when size === 1)
  const selectedId = useCanvasStore((s) => {
    if (s.selection.nodeIds.size !== 1) return null
    return s.selection.nodeIds.values().next().value ?? null
  })

  // IMPORTANT: Use canonical goal node ID from ceeAnalysisReady
  // Fallback to finding goal node directly for draft/imported graphs without CEE metadata
  const goalNodeId = useCanvasStore((s) => {
    // Prefer canonical source
    if (s.ceeAnalysisReady?.goal_node_id) {
      return s.ceeAnalysisReady.goal_node_id
    }
    // Fallback: find goal node directly (for drafts without CEE metadata)
    const goalNode = s.nodes.find(
      (n) => n.data?.kind === 'goal' || n.data?.type === 'goal' || n.type === 'goal'
    )
    return goalNode?.id ?? null
  })

  // Track edge changes to re-compute highlights when graph is edited
  // Using primitive count to avoid reference-based re-renders
  const edgeCount = useCanvasStore((s) => s.edges.length)

  // F3 (graph-visuals): the focus dim BORROWS dimmedNodeIds from the path dim,
  // so this hook must re-run when that ownership changes — in particular when
  // the focus lens is ended from OUTSIDE (a camera move, an edge focus, the
  // focused node being removed) with the selection unchanged. Without this dep
  // nothing below re-runs on that path, and clearFocusDim's wipe of
  // dimmedNodeIds would leave the selected node's path dim gone for good.
  // Primitive selector (React #185 rule above).
  const focusDimSourceId = useCanvasStore((s) => s.focusDimSourceId)

  useEffect(() => {
    // Access store actions and state via getState() to avoid dependency array issues
    const {
      nodes,
      edges,
      setHighlightedEdges,
      setDimmedNodes,
      ceeAnalysisReady,
      clearFocusDim,
    } = useCanvasStore.getState()

    // F3 (graph-visuals): while a TRANSIENT focus dim is active for the
    // selected node, it owns dimmedNodeIds — the path dim must not clobber
    // it (path edges still highlight below). The moment selection moves
    // away — deselect, multi-select, reselect another node — the focus dim
    // is cleared HERE, so it can never survive after focus ends, and normal
    // path dimming resumes.
    //
    // When the lens is instead ended from OUTSIDE with the selection intact
    // (camera move / edge focus / focused node removed), focusDimSourceId
    // drops to null and re-runs this effect: ownership returns here and the
    // path dim below is recomputed, so ending the lens RESTORES the selected
    // node's path dim rather than leaving the graph permanently undimmed.
    const focusDimOwnsDimming =
      focusDimSourceId !== null && selectionSize === 1 && selectedId === focusDimSourceId
    if (focusDimSourceId !== null && !focusDimOwnsDimming) {
      clearFocusDim()
    }

    const options = ceeAnalysisReady?.options ?? []

    // Clear if no selection, multi-select, or no goal
    // Multi-select explicitly clears to prevent stale state
    if (selectionSize !== 1 || !selectedId || !goalNodeId) {
      setHighlightedEdges([])
      if (!focusDimOwnsDimming) setDimmedNodes([])
      return
    }

    const selectedNode = nodes.find((n) => n.id === selectedId)
    if (!selectedNode) {
      setHighlightedEdges([])
      if (!focusDimOwnsDimming) setDimmedNodes([])
      return
    }

    // Determine node kind (type is the ReactFlow node type, data.kind or data.type for semantic)
    const kind = selectedNode.data?.kind ?? selectedNode.data?.type ?? selectedNode.type
    let pathEdgeIds: string[] = []

    if (kind === 'goal') {
      // Goal selected: highlight all incoming paths
      pathEdgeIds = findPathsFromRoots(goalNodeId, edges)
    } else if (kind === 'option') {
      // Option selected: highlight intervention targets → goal
      // Use canonical options source, not node data
      const targets = getInterventionTargets(selectedId, options)
      for (const targetId of targets) {
        pathEdgeIds.push(...findPathsToGoal(targetId, goalNodeId, edges))
      }
      // Deduplicate
      pathEdgeIds = [...new Set(pathEdgeIds)]
    } else if (kind === 'factor' || kind === 'risk' || kind === 'outcome') {
      // Factor/Risk/Outcome selected: highlight downstream to goal
      pathEdgeIds = findPathsToGoal(selectedId, goalNodeId, edges)
    }

    // Set highlighted edges
    setHighlightedEdges(pathEdgeIds)

    // Calculate dimmed nodes (not on any highlighted path)
    // PERFORMANCE: Use Set for O(1) lookup instead of O(n) array.includes()
    const pathEdgeIdSet = new Set(pathEdgeIds)
    const nodesOnPath = new Set<string>()
    nodesOnPath.add(selectedId)

    for (const edge of edges) {
      if (pathEdgeIdSet.has(edge.id)) {
        // O(1) lookup
        nodesOnPath.add(edge.source)
        nodesOnPath.add(edge.target)
      }
    }

    const dimmedIds = nodes.filter((n) => !nodesOnPath.has(n.id)).map((n) => n.id)

    // F3: the focus dim owns dimmedNodeIds while active (see above).
    if (!focusDimOwnsDimming) setDimmedNodes(dimmedIds)

    // No cleanup needed - we want highlights to persist until selection changes
    // The next effect run will update or clear highlights as appropriate
  }, [selectionSize, selectedId, goalNodeId, edgeCount, focusDimSourceId])
}

export default usePathHighlight

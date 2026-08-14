/**
 * usePathHighlight - selection focus: causal paths where they exist, the direct
 * neighbourhood everywhere else.
 *
 * 6A (selection focus) — TWO gaps this hook used to have, both of which left
 * the user with no focus at all or with a graph dimmed to nothing:
 *
 *  1. No goal node (drafts before analysis, imported graphs) → the effect bailed
 *     early and NOTHING dimmed.
 *  2. A kind with no path branch (decision, action, constraint) → pathEdgeIds
 *     stayed empty, so `nodesOnPath` was just the selected node and EVERY other
 *     node dimmed, including its own direct neighbours.
 *
 * Both now fall back to the DIRECT NEIGHBOURHOOD (the selected element plus
 * whatever it is directly connected to), reusing neighbourhoodNodeIds — the
 * same primitive the F2/F3 focus lens uses. Selecting a single EDGE focuses
 * that edge and its two endpoints.
 *
 * ⚠ In neighbourhood mode we deliberately DO NOT write highlightedEdges.
 * FocusModeChip renders "Showing paths from X to goal" purely on
 * `highlightedEdges.size > 0`, so writing that set for a neighbourhood focus —
 * which involves no goal and no path — would make the chip state something
 * untrue. Prominence in neighbourhood mode comes from DIMMING THE REST, not
 * from claiming a path. Path mode is unchanged and still owns the chip.
 *
 * STABLE MODEL, ADAPTIVE ATTENTION: everything here is transient view state.
 * No node, edge, position or value is mutated, and deselect restores exactly.
 *
 * When a single node is selected:
 * - Factor: Highlight all downstream paths to goal
 * - Option: Highlight intervention targets → goal paths
 * - Goal: Highlight all incoming paths from roots
 *
 * Features:
 * - Uses two-phase algorithm for correct reconverging graph handling
 * - Dims nodes AND edges outside the focus (nodes opacity-60, edges 0.25)
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
import { neighbourhoodNodeIds } from '../utils/focusNeighbourhood'

/**
 * Hook to manage path highlighting based on node selection.
 * Call this hook in the main canvas component to enable path highlighting.
 */
export function usePathHighlight(): void {
  // React #185 FIX: Use primitive selector for selection size to avoid infinite loops
  const selectionSize = useCanvasStore((s) => s.selection.nodeIds.size)
  // 6A: edge selection participates in focus too. Primitive size + primitive id,
  // same React #185 rule as the node selectors.
  const edgeSelectionSize = useCanvasStore((s) => s.selection.edgeIds.size)

  // Get selected ID as primitive (only meaningful when size === 1)
  const selectedId = useCanvasStore((s) => {
    if (s.selection.nodeIds.size !== 1) return null
    return s.selection.nodeIds.values().next().value ?? null
  })

  // 6A: the single selected EDGE id — only meaningful when exactly one edge and
  // no node is selected (a mixed or multi selection gets no focus, matching the
  // existing multi-select rule).
  const selectedEdgeId = useCanvasStore((s) => {
    if (s.selection.edgeIds.size !== 1 || s.selection.nodeIds.size !== 0) return null
    return s.selection.edgeIds.values().next().value ?? null
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
      setDimmedEdges,
      ceeAnalysisReady,
      clearFocusDim,
    } = useCanvasStore.getState()

    /**
     * 6A: apply a NEIGHBOURHOOD focus — the given ids stay fully prominent and
     * everything else dims. Deliberately writes an EMPTY highlightedEdges (see
     * the file header: the "paths to goal" chip must not appear for a focus
     * that involves no path).
     */
    const applyNeighbourhoodFocus = (
      prominentNodeIds: Set<string>,
      prominentEdgeIds: Set<string>,
      skipNodeDim: boolean,
    ) => {
      setHighlightedEdges([])
      if (!skipNodeDim) {
        setDimmedNodes(nodes.filter((n) => !prominentNodeIds.has(n.id)).map((n) => n.id))
      }
      setDimmedEdges(edges.filter((e) => !prominentEdgeIds.has(e.id)).map((e) => e.id))
    }

    /** Edges INCIDENT to the focused node — literally "its connections".
     *  Deliberately not "both endpoints in the neighbourhood": an edge between
     *  two of the selected node's neighbours is not one of ITS connections, and
     *  leaving it dim keeps the focus about the selected element. */
    const incidentEdgeIds = (nodeId: string) => {
      const ids = new Set<string>()
      for (const e of edges) {
        if (e.source === nodeId || e.target === nodeId) ids.add(e.id)
      }
      return ids
    }

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

    // 6A: a single selected EDGE focuses that connection and its two endpoints.
    // Checked before the node branch because selectedEdgeId is only non-null
    // when NO node is selected, so the two can never both apply.
    if (selectedEdgeId) {
      const selectedEdge = edges.find((e) => e.id === selectedEdgeId)
      if (selectedEdge) {
        applyNeighbourhoodFocus(
          new Set([selectedEdge.source, selectedEdge.target]),
          new Set([selectedEdge.id]),
          false,
        )
        return
      }
    }

    // Clear if no selection, multi-select, or the selected node has gone.
    // Multi-select explicitly clears to prevent stale state.
    const selectedNode =
      selectionSize === 1 && !!selectedId && edgeSelectionSize === 0
        ? nodes.find((n) => n.id === selectedId)
        : undefined
    if (!selectedNode) {
      setHighlightedEdges([])
      if (!focusDimOwnsDimming) setDimmedNodes([])
      setDimmedEdges([])
      return
    }

    // Determine node kind (type is the ReactFlow node type, data.kind or data.type for semantic)
    const kind = selectedNode.data?.kind ?? selectedNode.data?.type ?? selectedNode.type
    let pathEdgeIds: string[] = []

    // 6A: path mode needs a goal to aim at. Without one (drafts, imports) we
    // skip straight to the neighbourhood fallback below rather than bailing
    // with no focus at all, which is what used to happen.
    if (!goalNodeId) {
      pathEdgeIds = []
    } else if (kind === 'goal') {
      // Goal selected: highlight all incoming paths
      pathEdgeIds = findPathsFromRoots(goalNodeId, edges)
    } else if (kind === 'option') {
      // Option selected: highlight intervention targets → goal
      // Use canonical options source, not node data
      const targets = getInterventionTargets(selectedNode.id, options)
      for (const targetId of targets) {
        pathEdgeIds.push(...findPathsToGoal(targetId, goalNodeId, edges))
      }
      // Deduplicate
      pathEdgeIds = [...new Set(pathEdgeIds)]
    } else if (kind === 'factor' || kind === 'risk' || kind === 'outcome') {
      // Factor/Risk/Outcome selected: highlight downstream to goal
      pathEdgeIds = findPathsToGoal(selectedNode.id, goalNodeId, edges)
    }

    // 6A: NO USABLE PATH → focus the direct neighbourhood instead.
    // Reached when there is no goal node, when the selected kind has no path
    // branch (decision / action / constraint), or when the node simply has no
    // route to the goal. The old code fell through to the path-dim below with
    // an empty path set, which dimmed EVERY other node — including the selected
    // node's own neighbours — and left the user with a blanked graph.
    if (pathEdgeIds.length === 0) {
      const hood = neighbourhoodNodeIds(selectedNode.id, edges)
      applyNeighbourhoodFocus(hood, incidentEdgeIds(selectedNode.id), focusDimOwnsDimming)
      return
    }

    // Set highlighted edges
    setHighlightedEdges(pathEdgeIds)

    // Calculate dimmed nodes (not on any highlighted path)
    // PERFORMANCE: Use Set for O(1) lookup instead of O(n) array.includes()
    const pathEdgeIdSet = new Set(pathEdgeIds)
    const nodesOnPath = new Set<string>()
    nodesOnPath.add(selectedNode.id)

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

    // 6A: dim the edges off the path so the highlighted route reads as a route
    // rather than as a few thicker lines in an undimmed web. Edge dimming is
    // never owned by the F3 focus dim (that lens only writes dimmedNodeIds),
    // so there is no ownership guard here.
    setDimmedEdges(edges.filter((e) => !pathEdgeIdSet.has(e.id)).map((e) => e.id))

    // No cleanup needed - we want highlights to persist until selection changes
    // The next effect run will update or clear highlights as appropriate
  }, [
    selectionSize,
    selectedId,
    edgeSelectionSize,
    selectedEdgeId,
    goalNodeId,
    edgeCount,
    focusDimSourceId,
  ])
}

export default usePathHighlight

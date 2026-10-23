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
 * Both now fall back to a NEIGHBOURHOOD focus: no path is claimed, and the
 * selection's own ring is the focus. Selecting a single EDGE focuses that edge.
 *
 * ⚠ In neighbourhood mode we deliberately DO NOT write highlightedEdges.
 * FocusModeChip renders "Showing paths from X to goal" purely on
 * `highlightedEdges.size > 0`, so writing that set for a neighbourhood focus —
 * which involves no goal and no path — would make the chip state something
 * untrue. Path mode still owns the chip.
 *
 * ⛔ NOTHING DIMS (vision spec §3 PR H, 23 Oct; Paul, repeatedly, on greyed-out models). Selecting a factor, the
 * goal, an option or a link never fades the rest of the model: the traced paths take the highlight glow, the selected
 * card keeps its ring and the selected link its own selected stroke, and every other card and link stays at rest.
 * This hook only ever CLEARS `dimmedNodeIds` / `dimmedEdgeIds` now (an older dim must not outlive the change).
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
 * - Dims nothing: re-weights the focus (highlight glow, selection ring), never fades the rest
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

import { useEffect, useRef } from 'react'
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

  // F3 (graph-visuals): the focus lens records its source here, so this hook
  // re-runs when that ownership changes (a camera move, an edge focus, the
  // focused node being removed). Primitive selector (React #185 rule above).
  const focusDimSourceId = useCanvasStore((s) => s.focusDimSourceId)

  // WHERE THIS CHANGE FLOWS (`graphChanges/routeFocus`): the link a C1 Changes row asked to show the route of.
  // Primitive selector (React #185 rule above).
  const routeFocusId = useCanvasStore((s) => s.runChangesRouteFocusId)

  // ⭐ A HOVER THAT ENDS MUST NOT ERASE A STANDING ROUTE (Canvas lane, 4 Oct 2026 — beat 6). The Compare/Changes rows
  // hover through `highlightEdge` / `clearHighlight`, which write the SAME `highlightedEdges` set the path focus below
  // draws into, and nothing re-ran this effect on a clear: hover a row → click it (route lit) → leave wiped the route
  // and its "Showing paths" chip under a selection that still asked for it. `drawnPath` is the path this hook drew
  // and still stands behind (null in every other mode); the effect after this one puts exactly that back when a
  // clear empties the set. Primitive selector (React #185 rule above).
  const drawnPath = useRef<string[] | null>(null)
  const highlightedEdgesEmpty = useCanvasStore((s) => s.highlightedEdges.size === 0)

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

    // F3 (graph-visuals): while a TRANSIENT focus is active for the selected
    // node, it owns dimmedNodeIds — this hook must not clobber it. The moment
    // selection moves away — deselect, multi-select, reselect another node —
    // the focus is cleared HERE, so it can never survive after focus ends.
    const focusDimOwnsDimming =
      focusDimSourceId !== null && selectionSize === 1 && selectedId === focusDimSourceId
    if (focusDimSourceId !== null && !focusDimOwnsDimming) {
      clearFocusDim()
    }

    /**
     * Draw the focus: the given path edges highlight (a non-empty path owns the "paths to goal" chip; an empty one is
     * a NEIGHBOURHOOD focus, where the selection's own ring / selected stroke is the whole focus and no path is
     * claimed). ⛔ Nothing else changes: no card or link off the path fades (vision spec §3 PR H, "Nothing dims";
     * #2939 did the same for a selected option). Any older dim is cleared so it cannot outlive the change.
     */
    const applyFocus = (pathEdgeIds: string[]) => {
      drawnPath.current = pathEdgeIds.length > 0 ? pathEdgeIds : null
      setHighlightedEdges(pathEdgeIds)
      if (!focusDimOwnsDimming) setDimmedNodes([])
      setDimmedEdges([])
    }

    const options = ceeAnalysisReady?.options ?? []

    // 6A: a single selected EDGE focuses that connection and its two endpoints.
    // Checked before the node branch because selectedEdgeId is only non-null
    // when NO node is selected, so the two can never both apply.
    if (selectedEdgeId) {
      const selectedEdge = edges.find((e) => e.id === selectedEdgeId)
      if (selectedEdge) {
        // WHERE THIS CHANGE FLOWS: a C1 Changes row asked for THIS link's route → the link plus every downstream
        // route from its target to the goal (the same reach a selected factor gets). Any other edge selection keeps
        // the endpoints-only focus below.
        if (routeFocusId === selectedEdge.id && goalNodeId) {
          const downstream =
            selectedEdge.target === goalNodeId ? [] : findPathsToGoal(selectedEdge.target, goalNodeId, edges)
          applyFocus([...new Set([selectedEdge.id, ...downstream])])
          return
        }
        applyFocus([])
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
      applyFocus([])
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

    // 6A: NO USABLE PATH (no goal node, a kind with no path branch, or no route to the goal) → a neighbourhood
    // focus: nothing is claimed and nothing dims; the selected card's ring is the focus. An empty path set reaches
    // the same call, so the two branches can never disagree.
    applyFocus(pathEdgeIds)

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
    routeFocusId,
  ])

  // Declared AFTER the focus effect, so on a selection change that effect has already updated `drawnPath` when this
  // one reads it. Restores only a non-empty path this hook drew; a hover still lights what it points at meanwhile.
  useEffect(() => {
    if (!highlightedEdgesEmpty) return
    const path = drawnPath.current
    if (path && path.length > 0) useCanvasStore.getState().setHighlightedEdges(path)
  }, [highlightedEdgesEmpty])
}

export default usePathHighlight

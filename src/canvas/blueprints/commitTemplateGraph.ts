/**
 * commitTemplateGraphReplace — the single canvas-store commit for a template
 * ("blueprint") graph replace.
 *
 * Pushes one history frame, replaces the graph's nodes/edges, then marks the
 * analysis-freshness overlay dirty. A template insert/replace is an
 * analysis-affecting graph mutation done via bare setState (it bypasses the store
 * edit chokepoints), so a retained CEE 'fresh' verdict must be downgraded to
 * cannot-confirm — otherwise "Start from Template" / replace would leave the
 * Results panel falsely claiming the prior analysis reflects the new graph.
 *
 * Extracted from ReactFlowGraph.insertBlueprint so the freshness-dirty behaviour is
 * unit-testable without rendering the whole canvas tree. Used by insertBlueprint
 * ("Start from Template") and — transitively, since it calls insertBlueprint after
 * pruning the existing template — handleConfirmReplace.
 */

import type { Edge, Node } from '@xyflow/react'
import { useCanvasStore } from '../store'
import type { EdgeData } from '../domain/edges'

export function commitTemplateGraphReplace(
  nodes: Node[],
  edges: Edge<EdgeData>[],
): void {
  const store = useCanvasStore.getState()
  store.pushHistory()
  useCanvasStore.setState({ nodes, edges })
  // Optional-chained so partial store doubles in tests don't break.
  useCanvasStore.getState().markAnalysisFreshnessDirty?.()
}

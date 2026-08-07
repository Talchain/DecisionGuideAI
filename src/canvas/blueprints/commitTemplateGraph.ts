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
import type { EdgeData } from '../domain/edges'
import { commitGraphMutation } from '../mutations/commitGraphMutation'

export function commitTemplateGraphReplace(
  nodes: Node[],
  edges: Edge<EdgeData>[],
): void {
  // Template insert/replace is a full graph replace. Delegate to the shared
  // graph-mutation commit so it converges on the same dirty-overlay path as every
  // other raw-setState graph route (TemplatesPanel merge, …) rather than
  // re-implementing pushHistory + setState + markDirty here.
  commitGraphMutation(() => ({ nodes, edges }), { pushHistory: true })
}

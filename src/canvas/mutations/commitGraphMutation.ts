/**
 * commitGraphMutation — the ONE canvas-store commit for an analysis-affecting graph
 * mutation performed OUTSIDE the store edit chokepoints (template insert/replace,
 * TemplatesPanel merge, and any future raw-setState graph route).
 *
 * It:
 *   1. optionally pushes a single history frame (undoable),
 *   2. applies the structural mutation via a FUNCTIONAL setState updater — so a
 *      caller that `await`ed before committing still reads fresh store state (no
 *      stale-closure clobber of concurrent edits), and
 *   3. marks the analysis-freshness overlay dirty.
 *
 * Step 3 is the whole point. A bare `setState({ nodes, edges })` replaces/merges the
 * graph without touching readiness or the freshness verdict, so a retained CEE
 * 'fresh' verdict would survive the structural change and the Results panel would
 * falsely claim the prior analysis still reflects the graph. The overlay can only
 * DOWNGRADE a retained fresh → cannot-confirm; it never fabricates 'stale' — stale
 * stays a CEE-only verdict (resolveDisplayedFreshness enforces this).
 *
 * Active raw-setState graph routes converge here so freshness invalidation has one
 * definition rather than being re-derived (and forgotten) per call site.
 */

import type { Edge, Node } from '@xyflow/react'
import { useCanvasStore } from '../store'
import type { EdgeData } from '../domain/edges'

export interface GraphSnapshot {
  nodes: Node[]
  // Loose `Edge[]` so call sites that build template edges as `any[]`/`Edge[]`
  // need no cast; the helper narrows once on write-back to the store's `Edge<EdgeData>[]`.
  edges: Edge[]
}

export interface CommitGraphMutationOptions {
  /** Push a single undoable history frame before committing (default true). */
  pushHistory?: boolean
}

export function commitGraphMutation(
  mutate: (current: GraphSnapshot) => GraphSnapshot,
  options: CommitGraphMutationOptions = {},
): void {
  const { pushHistory = true } = options
  if (pushHistory) useCanvasStore.getState().pushHistory()
  useCanvasStore.setState((current) => {
    const next = mutate({
      nodes: current.nodes as Node[],
      edges: current.edges as Edge[],
    })
    return { nodes: next.nodes, edges: next.edges as Edge<EdgeData>[] }
  })
  // Optional-chained so partial store doubles in tests don't break.
  useCanvasStore.getState().markAnalysisFreshnessDirty?.()
}

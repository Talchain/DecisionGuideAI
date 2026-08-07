/**
 * resolveAnalysisTargets — pure id resolution for the analysis-graph projection.
 *
 * The V7 evidence disclosure names decision elements by producer ids (flip-risk
 * edges by from/to endpoints or a producer edge_id; drivers by a canvas node
 * focus id). This module maps those producer references onto the REAL canvas
 * elements currently on the graph, returning the React-Flow ids to mark.
 *
 * Doctrine (Paul-approved projection lane):
 *  · PURE id mapping + display — no fabricated values, no thresholds, no
 *    semantic transform. This is deliberately NOT a UI-SEM entry.
 *  · Honest / fail-closed — mark ONLY references that resolve to a real canvas
 *    element. An unresolvable reference is silently dropped, never guessed.
 *  · Never over-mark — a flip risk that names only a from_id (a factor may have
 *    several outgoing edges) is ambiguous and resolves to nothing. Resolution
 *    needs a producer edge_id OR a full from→to endpoint pair to name THE edge.
 *
 * The edge matching order (edge_id first, then endpoint pair) mirrors the shared
 * fragile-edge matcher (fragileEdgeMatch.isEdgeFragile) so the projection and
 * the on-canvas "Sensitive" badge agree on which edge a flip risk refers to.
 */

/** A flip-risk reference as carried by the V7 evidence model (structural subset). */
export interface FlipRiskRef {
  /** Producer source node id (canvas node ids are the producer node ids). */
  fromId?: string
  /** Producer target node id. */
  toId?: string
  /** Producer edge id — may equal a canvas RF edge id, or a canvas edge's
   * data.edge_id / data.plot_edge_id. */
  edgeId?: string
}

/** The canvas-edge shape this resolver reads (a structural subset of RF Edge). */
export interface ProjectionEdge {
  id: string
  source: string
  target: string
  data?: unknown
}

/** The canvas-node shape this resolver reads (a structural subset of RF Node). */
export interface ProjectionNode {
  id: string
}

function edgeDataId(data: unknown, key: 'edge_id' | 'plot_edge_id'): string | undefined {
  if (data && typeof data === 'object') {
    const v = (data as Record<string, unknown>)[key]
    if (typeof v === 'string') return v
  }
  return undefined
}

/**
 * Resolve one flip-risk reference to a single canvas edge id, or null when it
 * cannot be named unambiguously.
 *
 * 1. edge_id → a canvas edge whose RF id, data.edge_id, or data.plot_edge_id
 *    matches. (Producer edge ids are opaque; try every id a canvas edge carries.)
 * 2. from→to → the canvas edge whose source/target equal the endpoint pair.
 *
 * A bare from_id (no to_id, no edge_id) is intentionally unresolvable: it does
 * not name a single edge, and guessing would violate the honesty rule.
 */
function resolveOneFragileEdge(ref: FlipRiskRef, edges: readonly ProjectionEdge[]): string | null {
  if (ref.edgeId) {
    const byId = edges.find(
      (e) =>
        e.id === ref.edgeId ||
        edgeDataId(e.data, 'edge_id') === ref.edgeId ||
        edgeDataId(e.data, 'plot_edge_id') === ref.edgeId,
    )
    if (byId) return byId.id
  }
  if (ref.fromId && ref.toId) {
    const byEnds = edges.find((e) => e.source === ref.fromId && e.target === ref.toId)
    if (byEnds) return byEnds.id
  }
  return null
}

/**
 * Resolve the fragile-edge flip-risk references to a de-duplicated, ordered list
 * of canvas RF edge ids. Unresolvable references are dropped.
 */
export function resolveFragileEdgeIds(
  refs: readonly FlipRiskRef[],
  edges: readonly ProjectionEdge[],
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const ref of refs) {
    const id = resolveOneFragileEdge(ref, edges)
    if (id && !seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

/**
 * Resolve driver focus ids to a de-duplicated, ordered list of canvas node ids
 * that actually exist on the graph. Falsy ids (a driver that could not be
 * focused upstream) and ids with no matching node are dropped.
 */
export function resolveDriverNodeIds(
  focusIds: readonly (string | undefined)[],
  nodes: readonly ProjectionNode[],
): string[] {
  const present = new Set(nodes.map((n) => n.id))
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of focusIds) {
    if (id && present.has(id) && !seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

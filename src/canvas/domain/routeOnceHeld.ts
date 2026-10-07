/** Science 393023 Rule R: read-time mirror of CEE's routeOnceCoveredSources.
 * Never persist this relational hold: an edit on another route can remove it.
 */
import { isHeldUserLink, linkEndsOf } from './heldUserLink'

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
type StructuralLink = { edge: Rec; from: string; to: string; isDefault: boolean }
type Held = { edges: ReadonlySet<object>; ids: ReadonlySet<string> }
const cache = new WeakMap<readonly unknown[], WeakMap<readonly unknown[], Held>>()

/** Nothing held: a graph that is not yet two arrays (a store not loaded, a partial test store) holds nothing. */
const NOTHING_HELD: Held = Object.freeze({ edges: new Set<object>(), ids: new Set<string>() })

function heldOf(nodes: readonly unknown[], edges: readonly unknown[]): Held {
  // Fail closed BEFORE the WeakMap: only an object may key it, and only arrays carry a graph.
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return NOTHING_HELD
  let byEdges = cache.get(nodes)
  const cached = byEdges?.get(edges)
  if (cached) return cached
  if (!byEdges) cache.set(nodes, byEdges = new WeakMap())
  const held = computeRouteOnceHeld(nodes, edges)
  byEdges.set(edges, held)
  return held
}

/** The walk itself, uncached: O(V + E). Exported for the scaling row only; readers use the memoised exports below. */
export function computeRouteOnceHeld(nodes: readonly unknown[], edges: readonly unknown[]): Held {

  // Participating node ids, and the identity operands of the (few) identity nodes: no per-node allocation.
  const participating = new Set<string>()
  const operands = new Map<string, readonly unknown[]>()
  for (const node of nodes) {
    if (!isRec(node) || typeof node.id !== 'string') continue
    const wire = typeof node.kind === 'string' && typeof node.label === 'string'
    const fields = !wire && isRec(node.data) ? node.data : node
    // CEE (Codex buddy r1 P1): the route structure is the graph the Run is SENT. A node the user kept out of the
    // calculation is withheld with its links before the hold, so it is not in the structure at all.
    if ((fields.analysis_participation ?? node.analysis_participation) === 'retained_excluded') continue
    participating.add(node.id)
    const identity = fields.nonlinear_identity ?? node.nonlinear_identity
    if (isRec(identity) && Array.isArray(identity.factor_ids)) operands.set(node.id, identity.factor_ids)
  }
  const endsOf = linkEndsOf(nodes)
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, StructuralLink[]>()
  const links: StructuralLink[] = []
  for (const edge of edges) {
    if (!isRec(edge)) continue
    const wire = 'from' in edge || 'to' in edge
    const from = wire ? edge.from : edge.source
    const to = wire ? edge.to : edge.target
    if (typeof from !== 'string' || typeof to !== 'string' || !participating.has(from) || !participating.has(to)) continue
    const data = isRec(edge.data) ? edge.data : undefined
    // CEE (Codex buddy r2 P1): a BIDIRECTED link is not a route (PLoT sends ISL directed links only), so it is not in
    // the structure: it neither covers its target nor is ever held.
    if ((wire ? edge.edge_type : data?.edge_type) === 'bidirected') continue
    const p = wire ? edge.exists_probability : finite(data?.exists_probability) ? data.exists_probability : data?.beliefExists
    const baseHeld = wire ? isHeldUserLink(edge, endsOf(edge)) : data?.existenceHeld === true
    const link = { edge, from, to, isDefault: finite(p) && p > 0 && p < 1 && !baseHeld && !(operands.get(to)?.includes(from) ?? false) }
    links.push(link)
    if (!incoming.has(from)) incoming.set(from, 0)
    incoming.set(to, (incoming.get(to) ?? 0) + 1)
    const out = outgoing.get(from)
    if (out) out.push(link)
    else outgoing.set(from, [link])
  }

  // Kahn order: all incoming routes must have encountered default doubt.
  const remaining = new Map(incoming)
  const uncovered = new Set<string>()
  const covered = new Set<string>()
  const queue = [...incoming].filter(([, count]) => count === 0).map(([id]) => id)
  for (let i = 0; i < queue.length; i++) {
    const source = queue[i]!
    if (incoming.get(source)! > 0 && !uncovered.has(source)) covered.add(source)
    for (const link of outgoing.get(source) ?? []) {
      if (!link.isDefault && !covered.has(source)) uncovered.add(link.to)
      const count = remaining.get(link.to)! - 1
      remaining.set(link.to, count)
      if (count === 0) queue.push(link.to)
    }
  }
  const heldEdges = new Set<object>()
  const heldIds = new Set<string>()
  // Any structural cycle fails closed throughout the graph, as in CEE.
  if (queue.length === incoming.size) for (const link of links) {
    if (!link.isDefault || !covered.has(link.from)) continue
    heldEdges.add(link.edge)
    if (typeof link.edge.id === 'string' && 'source' in link.edge && 'target' in link.edge) heldIds.add(link.edge.id)
  }
  return { edges: heldEdges, ids: heldIds }
}

export function routeOnceHeldEdges(nodes: readonly unknown[], edges: readonly unknown[]): ReadonlySet<object> {
  return heldOf(nodes, edges).edges
}

export function routeOnceHeldIds(nodes: readonly unknown[], edges: readonly unknown[]): ReadonlySet<string> {
  return heldOf(nodes, edges).ids
}

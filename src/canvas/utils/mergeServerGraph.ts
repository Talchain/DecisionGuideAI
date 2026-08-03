/**
 * mergeServerGraphOnHydrate — VALUES FROM THE SERVER, LAYOUT FROM LOCAL.
 *
 * ROADMAP 2.312 piece 3. On boot, the canvas restores from the localStorage
 * autosave (`ReactFlowGraph`'s init effect → `hydrateGraphSlice`) and nothing
 * ever asked the server what it holds for this scenario. The measured
 * consequence: a persisted edit is forgotten on refresh, and a later edit
 * REBASES against a value the user was never shown (the server recorded "from
 * £3,500 to £4,200" where the screen said £4,000).
 *
 * This closes that by merging CEE's copy over the restored canvas. The two
 * sides are authoritative for different things and neither is authoritative
 * for both:
 *
 *   · CEE owns the ANALYTICAL state. `scenarios.graph` is what every turn and
 *     every analysis is computed from.
 *   · The CANVAS owns the LAYOUT. `scenarios.graph` carries no geometry at all
 *     — no `position`, no `x`/`y`, no `layout` — and CEE measures that on the
 *     bytes it returns (`layout_present`, false for every real graph today).
 *     The autosave is the only place a position has ever existed.
 *
 * ⚠ NEVER go through `hydrateGraphSlice` for this. That path REPLACES the
 * node array, so the server's layout-free nodes would land at {0,0} and the
 * user's canvas would scramble on every refresh. The position-preserving
 * overlay is the only correct write, and it is the SAME `overlayNode` /
 * `overlayEdge` the applied-edit receipt path uses — imported, not copied.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SCOPE BOUNDARY — SERVER-WINS-ON-VALUES, AT BOOT, ONCE
 * ─────────────────────────────────────────────────────────────────────────────
 * Hydration re-opens last-writer-wins between the server row and the
 * localStorage autosave, and this merge resolves it ONE way and only at boot:
 * on a field both sides carry, the server's value wins. That is deliberate —
 * the server's copy is what the next turn and the next analysis will be
 * computed against, so showing anything else is the rebase defect again.
 *
 * What is NOT in scope, and is NOT silently half-done here:
 *   · no continuous sync — this runs at boot, not on every change;
 *   · no compare-and-swap — the UI does not write back through this path;
 *   · no DELETION. An element the canvas has and the server does not SURVIVES.
 *     The autosave can legitimately be ahead of the server (guest inspector
 *     edits never reach CEE at all — ROADMAP 2.304), so reconciling absence to
 *     deletion would trade a stale value for lost work. Absence is only ever
 *     authoritative on the applied-edit receipt path, which has a receipt to
 *     justify it; a boot read has none.
 *
 * The residual is therefore named rather than hidden: a local-only edit made
 * before this boot keeps its node on the canvas, but a field the server also
 * carries is overwritten by the server's value. That is the ruled behaviour
 * for this rung; a CAS/merge-policy rung is a separate row if wanted.
 */

import { useCanvasStore } from '../store'
import { logger } from '../../lib/logger'
import { canvasEdgePairKey, wireEdgePairKey } from './graphIdentity'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from './applyDraftResult'
import {
  ADDED_COLUMN_X_GAP,
  ADDED_COLUMN_Y_STEP,
  overlayEdge,
  overlayNode,
} from './mergeAppliedGraph'

export interface MergeServerGraphResult {
  addedNodeCount: number
  addedEdgeCount: number
  updatedNodeCount: number
  updatedEdgeCount: number
  /**
   * Always 0. Present so the shape matches the receipt reconciler's and so the
   * "boot never deletes" invariant is an ASSERTABLE counter rather than a
   * promise in a comment.
   */
  removedNodeCount: number
  removedEdgeCount: number
}

const NO_CHANGE: MergeServerGraphResult = Object.freeze({
  addedNodeCount: 0,
  addedEdgeCount: 0,
  updatedNodeCount: 0,
  updatedEdgeCount: 0,
  removedNodeCount: 0,
  removedEdgeCount: 0,
})

function noChange(): MergeServerGraphResult {
  return { ...NO_CHANGE }
}

/**
 * Merge the server's graph onto the live canvas.
 *
 * @param serverGraph `scenarios.graph` VERBATIM, as returned by
 *   `scenario_graph.v1`. Null / absent / empty is a strict no-op: an empty
 *   server graph is a normal state (every scenario starts there) and must
 *   never blank a canvas that has content.
 */
export function mergeServerGraphOnHydrate(
  serverGraph: unknown,
): MergeServerGraphResult {
  if (serverGraph === null || typeof serverGraph !== 'object') return noChange()

  const g = serverGraph as Record<string, unknown>
  const rawNodes: any[] = Array.isArray(g.nodes) ? g.nodes : []
  const rawEdges: any[] = Array.isArray(g.edges) ? g.edges : []

  // Honest absence: nothing to merge, so nothing is written and no identity is
  // recorded. A server graph with no elements must not authorise later
  // deletions either.
  if (rawNodes.length === 0 && rawEdges.length === 0) return noChange()

  const store = useCanvasStore.getState()
  const existingNodeIds = new Set(store.nodes.map((n: any) => n.id))
  const existingEdgeIds = new Set(store.edges.map((e: any) => e.id))

  // Structural guard, same rationale as the receipt path: a scenario's server
  // graph and its own restored canvas always share node ids. ZERO overlap with
  // a NON-EMPTY canvas means these are two unrelated graphs (a stale autosave
  // stamped with a scenario id whose server row has since been redrafted), and
  // unioning them would produce a graph neither side ever had. Drop and warn.
  // An EMPTY canvas is the opposite case and the whole point of this feature:
  // there is nothing to conflict with, so it hydrates in full.
  if (store.nodes.length > 0 && rawNodes.length > 0) {
    const hasOverlap = rawNodes.some(
      (n: any) => n != null && typeof n.id === 'string' && existingNodeIds.has(n.id),
    )
    if (!hasOverlap) {
      logger.warn('merge_server_graph.zero_overlap_drop', {
        scenarioId: store.currentScenarioId ?? null,
        canvasNodeCount: store.nodes.length,
        serverNodeCount: rawNodes.length,
      })
      return noChange()
    }
  }

  // --- Server indexes. Node identity is the id; EDGE identity is the endpoint
  // pair (CEE mints composite ids, the draft mapper falls back to positional
  // ones, so the same edge routinely carries different ids on the two sides).
  const serverNodeById = new Map<string, any>()
  for (const n of rawNodes) {
    if (n != null && typeof n.id === 'string' && n.id.length > 0) {
      if (!serverNodeById.has(n.id)) serverNodeById.set(n.id, n)
    }
  }
  const serverEdgeByPair = new Map<string, any>()
  for (const e of rawEdges) {
    if (e == null) continue
    const key = wireEdgePairKey(e)
    if (key && !serverEdgeByPair.has(key)) serverEdgeByPair.set(key, e)
  }

  // --- Updates. `overlayNode` spreads the EXISTING node first and discards the
  // mapper's `position`, so every canvas-owned root field — position, width,
  // height, measured, selected, dragging, style, zIndex, parentId — survives by
  // construction, bound to the node that owned it. Matching is by id, never by
  // array index.
  let updatedNodeCount = 0
  const mergedNodes = store.nodes.map((n: any) => {
    const serverNode = serverNodeById.get(n.id)
    if (!serverNode) return n
    const next = overlayNode(n, serverNode)
    if (next !== n) updatedNodeCount += 1
    return next
  })

  let updatedEdgeCount = 0
  const mergedEdges = store.edges.map((e: any) => {
    const key = canvasEdgePairKey(e)
    const serverEdge = key ? serverEdgeByPair.get(key) : undefined
    if (!serverEdge) return e
    const next = overlayEdge(e, serverEdge)
    if (next !== e) updatedEdgeCount += 1
    return next
  })

  // --- Additions: on the server, not on the canvas.
  const missingRawNodes = rawNodes.filter(
    (n: any) =>
      n != null &&
      typeof n.id === 'string' &&
      n.id.length > 0 &&
      !existingNodeIds.has(n.id),
  )
  const addedNodes = missingRawNodes.map((n: any) => mapDraftNodeToCanvas(n))

  // Deterministic placement, right of the existing bounding box — never a
  // re-layout of nodes the user has already arranged. Same constants as the
  // receipt path, imported from it.
  if (addedNodes.length > 0) {
    const xs = mergedNodes.map((n: any) => n.position?.x ?? 0)
    const ys = mergedNodes.map((n: any) => n.position?.y ?? 0)
    const baseX = (xs.length ? Math.max(...xs) : 0) + ADDED_COLUMN_X_GAP
    const baseY = ys.length ? Math.min(...ys) : 0
    addedNodes.forEach((n: any, idx: number) => {
      n.position = { x: baseX, y: baseY + idx * ADDED_COLUMN_Y_STEP }
    })
  }

  const unionNodeIds = new Set<string>([
    ...mergedNodes.map((n: any) => n.id as string),
    ...addedNodes.map((n: any) => n.id as string),
  ])
  const seenEdgePairs = new Set<string>(
    mergedEdges
      .map((e: any) => canvasEdgePairKey(e))
      .filter((k): k is string => k !== null),
  )
  const missingRawEdges = rawEdges.filter((e: any) => {
    if (e == null) return false
    const key = wireEdgePairKey(e)
    if (key === null) return false
    if (typeof e.id === 'string' && existingEdgeIds.has(e.id)) return false
    if (seenEdgePairs.has(key)) return false
    // Fail closed: never add a dangling edge.
    const from = e.from ?? e.source
    const to = e.to ?? e.target
    if (!unionNodeIds.has(from) || !unionNodeIds.has(to)) return false
    seenEdgePairs.add(key)
    return true
  })
  const usedEdgeIds = new Set<string>(existingEdgeIds)
  const addedEdges = missingRawEdges.map((e: any, i: number) => {
    const mapped = mapDraftEdgeToCanvas(e, i)
    let id: string = mapped.id
    while (usedEdgeIds.has(id)) id = `${id}-a`
    usedEdgeIds.add(id)
    return { ...mapped, id }
  })

  const result: MergeServerGraphResult = {
    addedNodeCount: addedNodes.length,
    addedEdgeCount: addedEdges.length,
    updatedNodeCount,
    updatedEdgeCount,
    // Structural, not incidental: this path has no removal branch at all.
    removedNodeCount: 0,
    removedEdgeCount: 0,
  }

  // The server graph IS CEE's view of this scenario, so everything in it is an
  // element CEE has acknowledged. Recording it is what lets the FIRST applied
  // -edit receipt after this boot reconcile a deletion; `lastAuthoritativeGraph`
  // names "DB hydration" as one of its three sources for exactly this reason,
  // and `loadScenario` already seeds it the same way on the Supabase path.
  //
  // ⚠ RECORDED EVEN WHEN THE MERGE CHANGED NOTHING, and that is deliberate: the
  // evidence is the READ, not the write. A server graph identical to the canvas
  // is still proof that CEE has seen exactly these elements, and gating the
  // record on a diff would leave the acknowledged set stale after precisely the
  // most common boot — the one where nothing has drifted. The receipt path
  // states the same rule for the same reason. It is recorded only AFTER the
  // guards above: a graph dropped for zero overlap was refused, not observed.
  useCanvasStore.getState().setLastAuthoritativeGraph({
    nodeIds: [...serverNodeById.keys()],
    edgePairs: [...serverEdgeByPair.keys()],
  })

  const changed =
    result.addedNodeCount > 0 ||
    result.addedEdgeCount > 0 ||
    result.updatedNodeCount > 0 ||
    result.updatedEdgeCount > 0

  if (!changed) return result

  // One atomic write. Deliberately NO history entry — boot is not an edit and
  // there is no prior state a user could meaningfully undo to — and no applied
  // -edit pulse, which announces a change the user just made rather than the
  // state their canvas was already in.
  useCanvasStore.setState({
    nodes: [...mergedNodes, ...addedNodes] as any,
    edges: [...mergedEdges, ...addedEdges] as any,
  })

  logger.info('merge_server_graph.applied', {
    scenarioId: store.currentScenarioId ?? null,
    ...result,
  })

  return result
}

/**
 * durableDeletionGuard — a history restore may not resurrect an element the
 * SERVER has durably removed.
 *
 * THE DEFECT THIS CLOSES. `structural_delete` (schemas 0.48.0) made a canvas
 * delete DURABLE: `resolveStructuralDelete` reads a receipt CEE stamps only
 * after re-reading the COMMITTED bytes, so a `'proven'` receipt is evidence the
 * element is gone from the saved model. Undo, however, restores
 * `history.past[n]` VERBATIM in one `set()` — it predates the removal verb and
 * knows nothing about it. So Cmd+Z put the node back on the canvas while the
 * server still held it deleted, and the product asserted a model state the
 * server had durably declined to hold. That is the founder's original complaint
 * — *"it keeps adding the option that I deleted back"* — re-opened on screen,
 * one keystroke after `structural_delete` closed it on the wire.
 *
 * ⚠ THIS INVENTS NO NEW NOTION OF DIVERGENCE, and that is deliberate (Paul's
 * convergence rule). The estate already has exactly one authority on whether a
 * removal reached the saved model: the `structural_delete` RECEIPT, read by
 * `readStructuralDeleteReceipt` and adjudicated in `resolveStructuralDelete`'s
 * three states. This module does not re-derive that judgement, does not compare
 * hashes, and does not ask the server anything. It consumes the SAME receipt —
 * `'proven'` and only `'proven'` — and extends its authority over the one
 * consumer that was ignoring it. `refuted` / `unproven` / 409 / transport
 * already have their own owner (`revertStructuralDelete` puts the elements
 * back), and none of them records anything here: an element whose deletion was
 * refused is NOT durably deleted and undo may restore it freely.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO OPERATIONS, DELIBERATELY NAMED APART (CLAUDE.md trap 21 — two questions
 * must not share one name). They differ by exactly one guard and collapsing
 * them would break one of the two:
 *
 *   · `withholdDurableDeletions` answers *"which elements of this SNAPSHOT may
 *     be restored?"* — for undo/redo. It withholds a durably-deleted element
 *     only when that element is ABSENT from the live canvas, because withholding
 *     one that is currently on screen would DELETE something the user can see
 *     rather than decline to resurrect something they cannot.
 *   · `reconcileDurableDeletions` answers *"which elements of the LIVE CANVAS
 *     does the server say are gone?"* — for the race below. It has no
 *     present-guard, because being present is precisely its trigger.
 *
 * THE RACE, and why the second operation exists. The receipt is asynchronous:
 * the delete leaves the canvas immediately and the proof lands a turn later. A
 * user who deletes and reflexively hits Cmd+Z inside that window undoes against
 * an EMPTY record — nothing is withheld, the node returns, and the receipt then
 * proves it gone. Without reconciliation the canvas would lie for the rest of
 * the session, in a narrower window but in exactly the original way. So when a
 * receipt is proven, anything it names that is currently on the canvas is
 * removed, and the user is told.
 *
 * ⚠ EDGES CASCADE WITH THEIR NODE, ALWAYS. Restoring a node's incident edge
 * without the node is the dangling-edge hazard the server refuses and the
 * store's own `addEdge` guardrails forbid. Both operations therefore drop every
 * edge incident to a withheld/removed node, whether or not that edge was itself
 * named — which mirrors CEE's `applyRemoveNode`, the owner of the cascade
 * server-side.
 *
 * ⚠ BY IDENTITY, NEVER BY COUNT OR SHAPE. Every decision here keys on the
 * element's own id. A predicate over node count, label or kind would be
 * satisfied by a DIFFERENT element than the one the server removed.
 */

import type { Edge, Node } from '@xyflow/react'

/**
 * The canvas ids the server has PROVEN removed from the saved model.
 *
 * Canvas ids, not canonical wire refs — the history snapshots this guards hold
 * canvas elements, so the join has to be in canvas-id space.
 * `StructuralDeleteIntent.claimedNodeIds` / `.claimedEdgeIds` are exactly that,
 * and they already include the edges the gesture cascaded (structuralDelete.ts
 * :223-232), so no incidence has to be re-derived at record time.
 */
export interface DurableDeletionRecord {
  readonly nodeIds: readonly string[]
  readonly edgeIds: readonly string[]
}

export const EMPTY_DURABLE_DELETION_RECORD: DurableDeletionRecord = {
  nodeIds: [],
  edgeIds: [],
}

/**
 * A graph the guard reads or rewrites — the shape both history and the live
 * store use.
 *
 * ⚠ GENERIC OVER THE EDGE TYPE, deliberately. The store's edges are
 * `Edge<EdgeData>` while history snapshots and React Flow's own callbacks carry
 * plain `Edge`; pinning this to either one forces a cast at the other call site,
 * and a cast is where an edge's `data` silently stops being checked. The guard
 * never reads `data`, so it has no reason to know.
 */
export interface GuardedGraph<E extends Edge = Edge> {
  readonly nodes: readonly Node[]
  readonly edges: readonly E[]
}

/**
 * What the guard did, in identities.
 *
 * `nodes`/`edges` are the graph to apply. `withheldNodeIds`/`withheldEdgeIds`
 * name what was kept out and are what the user-facing notice is built from —
 * empty arrays mean the guard did nothing and NO notice is owed.
 */
export interface DurableGuardResult<E extends Edge = Edge> {
  readonly nodes: Node[]
  readonly edges: E[]
  readonly withheldNodeIds: string[]
  readonly withheldEdgeIds: string[]
}

/** Merge a newly-proven deletion into the record, deduped and order-stable. */
export function addDurableDeletion(
  record: DurableDeletionRecord,
  added: { readonly nodeIds: readonly string[]; readonly edgeIds: readonly string[] },
): DurableDeletionRecord {
  return {
    nodeIds: [...new Set([...record.nodeIds, ...added.nodeIds])],
    edgeIds: [...new Set([...record.edgeIds, ...added.edgeIds])],
  }
}

/**
 * Strip named elements from a graph, cascading each removed node's incident
 * edges. The shared core of both operations — the ONLY difference between them
 * is which ids the caller passes in.
 */
function stripByIdentity<E extends Edge>(
  graph: GuardedGraph<E>,
  nodeIdsToStrip: ReadonlySet<string>,
  edgeIdsToStrip: ReadonlySet<string>,
): DurableGuardResult<E> {
  const withheldNodeIds: string[] = []
  const nodes = graph.nodes.filter((n) => {
    if (!nodeIdsToStrip.has(n.id)) return true
    withheldNodeIds.push(n.id)
    return false
  })

  const strippedNodeIds = new Set(withheldNodeIds)
  const withheldEdgeIds: string[] = []
  const edges = graph.edges.filter((e) => {
    // The cascade is not optional: an edge whose endpoint is being withheld
    // cannot be restored without dangling.
    const cascades =
      strippedNodeIds.has(String(e.source)) || strippedNodeIds.has(String(e.target))
    if (!edgeIdsToStrip.has(e.id) && !cascades) return true
    withheldEdgeIds.push(e.id)
    return false
  })

  return { nodes, edges, withheldNodeIds, withheldEdgeIds }
}

/**
 * UNDO / REDO. Restore `snapshot`, minus anything the server has durably
 * deleted that is not already on the canvas.
 *
 * `present` is the LIVE graph, and it is the guard that keeps this honest in
 * both directions: an element the canvas currently shows is not a resurrection,
 * so it is restored normally even if the record names it. Only an element that
 * is both durably deleted AND absent is withheld.
 */
export function withholdDurableDeletions<E extends Edge>(
  snapshot: GuardedGraph<E>,
  record: DurableDeletionRecord,
  present: GuardedGraph<E>,
): DurableGuardResult<E> {
  if (record.nodeIds.length === 0 && record.edgeIds.length === 0) {
    return {
      nodes: [...snapshot.nodes],
      edges: [...snapshot.edges],
      withheldNodeIds: [],
      withheldEdgeIds: [],
    }
  }

  const presentNodeIds = new Set(present.nodes.map((n) => n.id))
  const presentEdgeIds = new Set(present.edges.map((e) => e.id))

  return stripByIdentity(
    snapshot,
    new Set(record.nodeIds.filter((id) => !presentNodeIds.has(id))),
    new Set(record.edgeIds.filter((id) => !presentEdgeIds.has(id))),
  )
}

/**
 * RECEIPT-TIME RECONCILIATION. Remove from the LIVE canvas anything this
 * record proves the server deleted.
 *
 * No present-guard, by design — see the header's race note. A no-op in the
 * overwhelmingly common case (the element left on delete and never came back),
 * and it fires only when an undo beat the receipt home.
 */
export function reconcileDurableDeletions<E extends Edge>(
  current: GuardedGraph<E>,
  record: DurableDeletionRecord,
): DurableGuardResult<E> {
  if (record.nodeIds.length === 0 && record.edgeIds.length === 0) {
    return {
      nodes: [...current.nodes],
      edges: [...current.edges],
      withheldNodeIds: [],
      withheldEdgeIds: [],
    }
  }
  return stripByIdentity(current, new Set(record.nodeIds), new Set(record.edgeIds))
}

/**
 * What the canvas must say when the guard fires. Session-local, never persisted
 * — the same discipline as `analysisRefusalNotice`: a fact about one gesture,
 * and restoring it into a later session would assert a refusal that did not
 * happen there.
 */
export interface DurableDeletionNotice {
  /**
   * `withheld`   — an undo/redo declined to bring elements back.
   * `reconciled` — the receipt landed after an undo had already restored them,
   *                so they were removed from the canvas again.
   */
  readonly kind: 'withheld' | 'reconciled'
  /** Labels of the withheld NODES, for copy. Empty when only edges were withheld. */
  readonly labels: readonly string[]
  /** Identities — what the copy is actually about. Never a count-based claim. */
  readonly nodeIds: readonly string[]
  readonly edgeIds: readonly string[]
  /**
   * Monotonic, so two identical outcomes in a row are still two events. Without
   * it a subscriber comparing by value would swallow the second — the user
   * would press Cmd+Z twice and be told once.
   */
  readonly seq: number
}

/** A node's display label, or its id when it has none. Never invented. */
function labelOf(node: Node): string {
  const label = (node.data as Record<string, unknown> | undefined)?.label
  return typeof label === 'string' && label.trim().length > 0 ? label.trim() : node.id
}

/**
 * Build the notice for a guard result, or `null` when nothing was withheld.
 *
 * `withheldFrom` is the graph the withheld elements were read out of, so the
 * labels are the ones the user last saw rather than a lookup against a canvas
 * that no longer contains them.
 */
export function buildDurableDeletionNotice<E extends Edge>(
  kind: DurableDeletionNotice['kind'],
  result: DurableGuardResult<E>,
  withheldFrom: GuardedGraph<E>,
  seq: number,
): DurableDeletionNotice | null {
  if (result.withheldNodeIds.length === 0 && result.withheldEdgeIds.length === 0) {
    return null
  }
  const withheld = new Set(result.withheldNodeIds)
  return {
    kind,
    labels: withheldFrom.nodes.filter((n) => withheld.has(n.id)).map(labelOf),
    nodeIds: [...result.withheldNodeIds],
    edgeIds: [...result.withheldEdgeIds],
    seq,
  }
}

/**
 * The sentence the canvas shows.
 *
 * ⚠ IT CLAIMS ONLY WHAT THE RECEIPT ESTABLISHES. The receipt proves the element
 * is absent from the COMMITTED bytes — so "deleted from your saved model" is
 * grounded, and the copy stops there. It does not tell the user to reload, retry
 * or re-sync: there is no restore verb in the wire vocabulary, so every such
 * instruction would be an affordance terminating in refusal (the P8 trap
 * `STRUCTURAL_DELETE_NOTICE.base_hash_diverged` documents at length). It says
 * what happened and what is true now, and offers no action it cannot honour.
 *
 * ⚠ NAMING THE USER'S OWN NODE IS GROUNDED, unlike naming one in the analysis-
 * refusal notice: this label is read from the very snapshot being withheld, not
 * inferred from a bare code.
 */
export function describeDurableDeletionNotice(notice: DurableDeletionNotice): string {
  const named = notice.labels.length > 0 ? `"${notice.labels[0]}"` : null
  const extra =
    notice.labels.length > 1 ? ` and ${notice.labels.length - 1} more` : ''

  if (notice.kind === 'reconciled') {
    return named === null
      ? 'Those connections were already deleted from your saved model, so they have been taken off the canvas again.'
      : `${named}${extra} was already deleted from your saved model, so it has been taken off the canvas again.`
  }

  if (named === null) {
    return 'Those connections are deleted from your saved model, so undo cannot bring them back. Everything else in that step was undone.'
  }
  return `${named}${extra} is deleted from your saved model, so undo cannot bring it back. Everything else in that step was undone.`
}

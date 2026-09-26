/**
 * ⭐⭐ THE EDIT'S OWN OPTIMISTIC WRITE IS NOT A STRANGER — the canvas as it stood
 * before THIS turn's own write, for the applied-receipt acknowledgement.
 *
 * ## The defect this closes (served witness, 23 Sep 09:29–09:51Z, UI 4c6ec07b)
 *
 * #1895 made an applied receipt that carries CEE's committed graph count as the
 * acknowledgement — but only when the canvas just BEFORE the receipt was
 * already acknowledged. Option edits passed (0 post-settle registers). Three
 * gestures did not, because each writes the canvas OPTIMISTICALLY before its
 * turn is sent, so the pre-receipt canvas already carries the edit's own write:
 *
 *   · `structural_delete` — the node and its connections leave the canvas at the
 *     gesture; a whole-graph `graph/register` followed the receipt at +51 ms;
 *   · `structural_rename` — the label is written at the gesture; +70 ms;
 *   · `edge_strength_edit` — the magnitude is written at the gesture; +58 ms,
 *     and that register's edge omitted the `provenance` CEE had just recorded,
 *     so CEE's copy lost the user's authorship.
 *
 * ## The rule
 *
 * CEE held G₀ — the canvas as it stood before THIS edit's own optimistic write
 * — ∧ CEE applied this edit and returned its committed postimage ∧ the canvas
 * has been reconciled to that postimage ⇒ CEE holds the canvas.
 *
 * It must still FAIL CLOSED. Only THIS turn's write is undone, and only when
 *   (a) the receipt's committed graph PROVES the write applied — by identity:
 *       the delete's exact ids/pairs absent, the rename's node at the new label,
 *       the link at the sent magnitude; and
 *   (b) the canvas still shows exactly that write (nothing restored, renamed
 *       again, or re-set since).
 * Anything else answers `null` and the caller asks about the canvas as it is.
 * Any OTHER unacknowledged change on the canvas — a different optimistic write
 * still unanswered, a local-only edit — survives the undo, so G₀ is not a model
 * CEE acknowledged, nothing is marked, and a registration offers the model once
 * delivery settles (#1855 preserved). A refused or unconfirmed (409 / 500) turn
 * carries no committed graph, so it can never reach (a).
 *
 * ## The structural ADD and the drawn LINK (26 Sep 2026, C32 served witness)
 *
 * The same gap, found for the two gestures the list above missed. Served UI
 * 5a8a27a9 against CEE 3829c96 ("+ Add option", #1937 linking the option to the
 * model's sole decision in the add's own commit): the reply's `graph_hash` was
 * a9a91f7c, and a whole-graph `graph/register` followed the receipt. It re-wrote
 * CEE's committed link with `edge_type:'directed'` and `provenance: null`, which
 * moved the stored hash to e6a0a760 (Canonical State, olumi-programme-docs#70
 * 5841806589). That left the canvas's next edit on a stale base, and it wiped the
 * user's `user_specified` link authorship. The add and the link both write the
 * canvas at the gesture, so, as for the three kinds above, the canvas at the
 * receipt already carried the edit's own write.
 *
 *   · `structural_add`: undo the node and every link incident on it. The
 *     links the commit does NOT hold yet (a chained link still on its own way)
 *     are named, and the caller acknowledges the canvas WITHOUT them, which is
 *     exactly what CEE holds. The canvas as it stands, with the unsent link,
 *     stays unacknowledged, so the link's own receipt is what closes the
 *     chain: fail CLOSED.
 *   · `structural_add_edge`: undo the one link, found by its endpoint pair, when
 *     the committed graph holds that pair and the canvas shows exactly one link
 *     for it.
 *
 * ## Why the turn's own opts, not a registry
 *
 * The receipt handler already holds the one thing that ties a receipt to its
 * write BY CONSTRUCTION: the intent the turn was sent with (`SendTurnOpts` —
 * `structuralDelete`, `structuralRename`, `optimisticEdgeEdit`), carried
 * verbatim through the deferral buffer. A module-level "in flight" registry
 * would re-derive that tie from ids and would have to be settled on every exit
 * to stay honest; the opts cannot be about any other turn.
 */
import type { Edge, Node } from '@xyflow/react'

import { readStructuralAddReceipt, type StructuralAddIntent } from '../mutations/structuralAdd'
import { readStructuralDeleteReceipt, type StructuralDeleteIntent } from '../mutations/structuralDelete'
import { readStructuralRenameReceipt, type StructuralRenameIntent } from '../mutations/structuralRename'
import { canvasEdgePairKey, wireEdgePairKey } from '../utils/graphIdentity'
import { edgeDataWithStrengthWriteUndone, edgeEditWrittenKeys, edgeShowsPendingWrite } from './pendingEdgeEdit'

/**
 * The optimistic link-strength write ONE `edge_strength_edit` turn announces.
 * `before` is the edge's data just before THIS write — not the original
 * pre-edit data a refusal restores (`PendingEdgeEdit.before`): G₀ is the canvas
 * before this turn's write, whatever wrote it before that.
 */
export interface OptimisticEdgeEdit {
  readonly edgeId: string
  readonly sentMagnitude: number
  readonly before: Readonly<Record<string, unknown>>
  /** Set only by a direction edit — see `PendingEdgeEdit.sentDirection`. */
  readonly sentDirection?: 'positive' | 'negative'
}

/** What this turn wrote to the canvas ahead of its own receipt. */
export interface OwnOptimisticWrite {
  readonly structuralDelete?: StructuralDeleteIntent
  readonly structuralRename?: StructuralRenameIntent
  readonly optimisticEdgeEdit?: OptimisticEdgeEdit
  /** The node THIS `structural_add` turn wrote at the gesture. */
  readonly structuralAdd?: StructuralAddIntent
  /** The link THIS `structural_add_edge` turn wrote at the gesture, by the endpoint pair it sent. */
  readonly structuralAddEdge?: { readonly from: string; readonly to: string }
}

export interface CanvasGraph {
  readonly nodes: readonly Node[]
  readonly edges: readonly Edge[]
}

/**
 * G₀, plus the ids of any of THIS turn's own links the commit does not carry
 * yet. For an add, that is a link chained to the new node that is still on its
 * way as its own `structural_add_edge`. The caller acknowledges the reconciled
 * canvas WITHOUT those links, which is exactly what CEE holds, and never the
 * canvas as it stands. The link's own receipt closes the chain later.
 */
export interface GraphBeforeOwnWrite extends CanvasGraph {
  readonly notYetCommittedEdgeIds?: readonly string[]
}

type WireEdge = { from?: unknown; to?: unknown; source?: unknown; target?: unknown; strength?: { mean?: unknown } }

function committedEdges(response: unknown): WireEdge[] | null {
  const draftGraph = (response as { draft_graph?: unknown } | null | undefined)?.draft_graph
  const edges = (draftGraph as { edges?: unknown } | null | undefined)?.edges
  return Array.isArray(edges) ? (edges as WireEdge[]) : null
}

function beforeOwnDelete(intent: StructuralDeleteIntent, response: unknown, canvas: CanvasGraph): CanvasGraph | null {
  if (readStructuralDeleteReceipt(intent, response) !== 'proven') return null
  const nodeIds = new Set(canvas.nodes.map((n) => n.id))
  const edgeIds = new Set(canvas.edges.map((e) => e.id))
  const edgePairs = new Set(canvas.edges.map((e) => canvasEdgePairKey(e)).filter((k): k is string => k !== null))
  // (b) The canvas must still show the whole removal — every element it took
  // is still gone. A partial undo is not this write any more.
  if (intent.restore.nodes.some((n) => nodeIds.has(n.id))) return null
  if (
    intent.restore.edges.some((e) => {
      const key = canvasEdgePairKey(e)
      return edgeIds.has(e.id) || (key !== null && edgePairs.has(key))
    })
  ) {
    return null
  }
  return {
    nodes: [...canvas.nodes, ...intent.restore.nodes],
    edges: [...canvas.edges, ...intent.restore.edges],
  }
}

function beforeOwnRename(intent: StructuralRenameIntent, response: unknown, canvas: CanvasGraph): CanvasGraph | null {
  if (readStructuralRenameReceipt(intent, response) !== 'proven') return null
  const node = canvas.nodes.find((n) => n.id === intent.nodeId)
  if (!node || (node.data as { label?: unknown } | undefined)?.label !== intent.label) return null
  return {
    nodes: canvas.nodes.map((n) => {
      if (n.id !== intent.nodeId) return n
      // The same two fields `applyStructuralRenameRevert` restores, and the
      // same absent-vs-undefined distinction: `updateNodeLabel` writes the label
      // and, on a goal, `provenance`.
      const data: Record<string, unknown> = { ...(n.data as Record<string, unknown>), label: intent.restore.label }
      if (intent.restore.provenanceWasPresent) data.provenance = intent.restore.provenance
      else delete data.provenance
      return { ...n, data } as Node
    }),
    edges: canvas.edges,
  }
}

function beforeOwnAdd(intent: StructuralAddIntent, response: unknown, canvas: CanvasGraph): GraphBeforeOwnWrite | null {
  // (a) The committed graph holds the node, by id.
  if (readStructuralAddReceipt(intent, response) !== 'proven') return null
  // (b) The canvas still shows it. A node since removed is not this write any more.
  if (!canvas.nodes.some((n) => n.id === intent.nodeId)) return null
  const committedPairs = new Set(
    (committedEdges(response) ?? []).map((e) => wireEdgePairKey(e)).filter((k): k is string => k !== null),
  )
  const incident = canvas.edges.filter((e) => e.source === intent.nodeId || e.target === intent.nodeId)
  // A link on a node minted by this gesture can only be this gesture's (or a
  // later one's, still queued behind it), so every incident link leaves G₀.
  // The ones the commit does NOT hold yet are named, so the caller never
  // acknowledges a link CEE has not written.
  const notYetCommittedEdgeIds = incident
    .filter((e) => {
      const key = canvasEdgePairKey(e)
      return key === null || !committedPairs.has(key)
    })
    .map((e) => e.id)
  return {
    nodes: canvas.nodes.filter((n) => n.id !== intent.nodeId),
    edges: canvas.edges.filter((e) => e.source !== intent.nodeId && e.target !== intent.nodeId),
    ...(notYetCommittedEdgeIds.length > 0 ? { notYetCommittedEdgeIds } : {}),
  }
}

function beforeOwnAddEdge(
  write: { readonly from: string; readonly to: string },
  response: unknown,
  canvas: CanvasGraph,
): CanvasGraph | null {
  const pair = canvasEdgePairKey({ source: write.from, target: write.to })
  const wire = committedEdges(response)
  if (pair === null || wire === null) return null
  // (a) The committed graph holds this exact pair, in its direction.
  if (!wire.some((e) => wireEdgePairKey(e) === pair)) return null
  // (b) The canvas shows exactly one link for it.
  if (canvas.edges.filter((e) => canvasEdgePairKey(e) === pair).length !== 1) return null
  return { nodes: canvas.nodes, edges: canvas.edges.filter((e) => canvasEdgePairKey(e) !== pair) }
}

/**
 * Does this receipt's committed graph show THIS turn's link magnitude — the
 * link found by its endpoint pair, its |mean| equal to the magnitude sent?
 *
 * ⚠ DELIBERATELY SILENT ON WHAT THE CANVAS SHOWS NOW. This is the question that
 * settles the edit's pending state (`editDeliveryHold` signal 5), and the canvas
 * is not evidence about it: a pick queued behind another turn is overwritten on
 * screen by the EARLIER receipt's reconcile before its own receipt lands, so
 * "the canvas still shows it" was false for exactly the deferred edit whose
 * carrier had heard only 'queued' — and the hold then never released.
 * The acknowledgement undo below asks the canvas question as well.
 */
export function receiptProvesOwnEdgeEdit(
  write: OptimisticEdgeEdit,
  response: unknown,
  edges: readonly Edge[],
): boolean {
  const edge = edges.find((e) => e.id === write.edgeId)
  const pair = edge ? canvasEdgePairKey(edge) : null
  const wire = committedEdges(response)
  if (pair === null || wire === null) return false
  const committed = wire.find((e) => wireEdgePairKey(e) === pair)
  const mean = committed?.strength?.mean
  if (typeof mean !== 'number' || Math.abs(mean) !== write.sentMagnitude) return false
  // A direction edit keeps `|mean|`, so the magnitude alone was already true
  // before it landed: the committed SIGN must be the one sent. Zero states no
  // sign, so it proves no direction.
  if (write.sentDirection === undefined) return true
  return mean !== 0 && (mean < 0 ? 'negative' : 'positive') === write.sentDirection
}

function beforeOwnEdgeEdit(write: OptimisticEdgeEdit, response: unknown, canvas: CanvasGraph): CanvasGraph | null {
  if (!receiptProvesOwnEdgeEdit(write, response, canvas.edges)) return null
  const edge = canvas.edges.find((e) => e.id === write.edgeId)
  // The same "does the canvas still show this write" test the revert uses — a
  // direction write by its sign alone, never the server's magnitude against
  // the canvas weight (5820664860).
  if (!edge || !edgeShowsPendingWrite(edge, write)) return null
  return {
    nodes: canvas.nodes,
    edges: canvas.edges.map((e) =>
      e.id === write.edgeId
        ? ({
            ...e,
            data: edgeDataWithStrengthWriteUndone(
              (e.data ?? {}) as Record<string, unknown>,
              write.before,
              edgeEditWrittenKeys(write),
            ),
          } as Edge)
        : e,
    ),
  }
}

/**
 * G₀ for this receipt: `canvas` with THIS turn's own optimistic write undone —
 * or `null` when the receipt does not prove that write applied, or the canvas
 * no longer shows exactly that write. Pure: reads nothing but its arguments.
 */
export function canvasBeforeOwnAppliedWrite(
  eventType: string | undefined,
  own: OwnOptimisticWrite,
  response: unknown,
  canvas: CanvasGraph,
): GraphBeforeOwnWrite | null {
  if (eventType === 'structural_delete' && own.structuralDelete) {
    return beforeOwnDelete(own.structuralDelete, response, canvas)
  }
  if (eventType === 'structural_rename' && own.structuralRename) {
    return beforeOwnRename(own.structuralRename, response, canvas)
  }
  if (eventType === 'edge_strength_edit' && own.optimisticEdgeEdit) {
    return beforeOwnEdgeEdit(own.optimisticEdgeEdit, response, canvas)
  }
  if (eventType === 'structural_add' && own.structuralAdd) {
    return beforeOwnAdd(own.structuralAdd, response, canvas)
  }
  if (eventType === 'structural_add_edge' && own.structuralAddEdge) {
    return beforeOwnAddEdge(own.structuralAddEdge, response, canvas)
  }
  return null
}

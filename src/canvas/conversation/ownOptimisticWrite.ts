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
}

export interface CanvasGraph {
  readonly nodes: readonly Node[]
  readonly edges: readonly Edge[]
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
): CanvasGraph | null {
  if (eventType === 'structural_delete' && own.structuralDelete) {
    return beforeOwnDelete(own.structuralDelete, response, canvas)
  }
  if (eventType === 'structural_rename' && own.structuralRename) {
    return beforeOwnRename(own.structuralRename, response, canvas)
  }
  if (eventType === 'edge_strength_edit' && own.optimisticEdgeEdit) {
    return beforeOwnEdgeEdit(own.optimisticEdgeEdit, response, canvas)
  }
  return null
}

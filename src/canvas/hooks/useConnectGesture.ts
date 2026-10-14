import { reportManualEdit } from '../editNotes/editNoteStore'
/**
 * ⭐ THE DRAW-A-LINK GESTURE — React Flow's four connect callbacks, extracted
 * from `ReactFlowGraph` so the gesture can be driven end-to-end in a spec
 * against the real store (the canvas component itself has no connect harness).
 *
 * Two defects closed here (canvas audit, 27 Sep 2026):
 *
 * ── edit-structure/F5: A DROP ON THE CARD'S BODY SAID "not allowed" ──────────
 * React Flow calls `onConnect` only when the pointer is released within
 * `connectionRadius` of a valid handle. The target handle is invisible
 * (`BaseNode` `TARGET_HANDLE_STYLE`), so the drop zone was an unseen spot about
 * 12px across on the card's top edge. A release anywhere else on the card fell
 * to `onConnectEnd`, which re-ran every check (self-loop, duplicate, limit,
 * cycle) and, when ALL of them passed, toasted "This connection is not
 * allowed." — a false reason for a connection that is allowed. It now makes the
 * link: a release anywhere on a card means "connect to this card". A drag that
 * began on a top (input) handle is read in its own direction, so the pair is
 * swapped. A release on empty canvas stays silent, and the real refusals keep
 * their messages.
 *
 * ⛔ NOT BY RAISING `connectionRadius`. A card's centre is ~84 flow units from
 * its handle; a radius that large snaps to the wrong card on a dense board.
 *
 * ── edit-structure/F3 (disclosure): PUT THE STRENGTH CONTROL IN FRONT ────────
 * A drawn causal link opens its strength panel, independently of the capture
 * receipt. Its unchanged add-control states the strength that sends it (the
 * 0.3 default is never sent). Structural links have no strength question.
 *
 * ── edit-structure/F7: THE QUESTION'S ONE LINK, ON THE DRAWN PATH TOO ────────
 * (Delivery Lead, #2235 r1.) The menu refused a Question as one end of a
 * connected add, but a drag from the Question's own output port still drew
 * Question → factor, and the body drop above made that drag land more often —
 * with the strength editor raised on it, one click from sending
 * `structural_add_edge {from: decision}`. All three callbacks now refuse a
 * link `isRefusedQuestionLink` refuses (`domain/questionLink.ts`, the menu
 * guard's rule): the drag validator, the handle drop and the body drop.
 * Question → option, the Question's one legitimate link, still draws.
 */
import { useCallback, useRef } from 'react'
import type { Connection } from '@xyflow/react'

import { useCanvasStore } from '../store'
import { USER_EDGE_DEFAULTS } from '../domain/edges'
import {
  isDuplicateEdge,
  isSelfLoop,
  limitExceededMessage,
  wouldCreateCycle,
  wouldExceedLimits,
} from '../validation/graphGuardrails'
import { SHARED_MODEL_AUTHORITY_COPY } from '../mutations/mutationAuthority'
import { openEdgeStrengthEditor } from '../utils/openEdgeStrengthEditor'
import { proposeForDrawnLink } from '../conversation/drawnLinkProposal'
import { isRefusedQuestionLink } from '../domain/questionLink'
import { DECISION_NODE_LABEL } from '../domain/vocabulary'
import { linkIsStructural } from '../edges/edgePresentation'

type ShowToast = (message: string, type: 'error' | 'info' | 'success' | 'warning') => void

/** The one set of refusal sentences for a drawn link, whichever callback met it. */
export const CONNECTION_REFUSAL_COPY = {
  cycle: 'This would create a circular dependency. Causal models require one-way relationships.',
  duplicate: 'This relationship already exists. Click it to adjust its strength.',
  edge_limit: 'Your model has reached the edge limit. Consider simplifying before adding more.',
  question: `The ${DECISION_NODE_LABEL} links only to its options. To show what an option changes, draw the link from the option.`,
  /** A picked pair that stopped being valid between being offered and being chosen (the model moved). */
  no_longer_valid: 'That link can no longer be added: the model changed since the list was shown. Choose again.',
} as const

/** Does this pair put the Question at one end of a link CEE forbids? Read against the live store. */
function refusesQuestionLink(source: string, target: string): boolean {
  const { nodes } = useCanvasStore.getState()
  return isRefusedQuestionLink(
    nodes.find(n => n.id === source),
    nodes.find(n => n.id === target),
  )
}

/** UI only: open the causal link this add actually landed, never an earlier pair. */
export function openNewCausalLinkStrengthEditor(
  edgeIdsBefore: ReadonlySet<string>,
  source: string,
  target: string,
): string | null {
  const state = useCanvasStore.getState()
  const edge = state.edges.find(e => !edgeIdsBefore.has(e.id) && e.source === source && e.target === target)
  if (!edge) return null
  const kind = (id: string) => {
    const node = state.nodes.find(n => n.id === id)
    return (node?.data as { kind?: string } | undefined)?.kind ?? node?.type
  }
  if (linkIsStructural(kind(source), kind(target), edge.data)) return null
  return openEdgeStrengthEditor(edge.id, { centre: false }) ? edge.id : null
}

/** Create one user link through the canvas gesture's existing writer and capture. */
export function createUserEdge(
  connection: Pick<Connection, 'source' | 'target'> & Partial<Connection>,
  showToast: ShowToast,
) {
  // Task 6a: user-specific defaults for manually created edges.
  const edgeIdsBefore = new Set(useCanvasStore.getState().edges.map(e => e.id))
  const result = useCanvasStore.getState().addEdge({ ...connection, data: USER_EDGE_DEFAULTS })
  if (!result.created) {
    const msg = result.reason
      ? (CONNECTION_REFUSAL_COPY as Record<string, string | undefined>)[result.reason]
      : undefined
    if (msg) showToast(msg, 'warning')
    return
  }
  const landed = useCanvasStore.getState()
  const edge = landed.edges.find(e => e.source === connection.source && e.target === connection.target)
  if (edge) reportManualEdit({ edit: { kind: 'structural_add_edge', elementId: edge.id, accepted: true },
    before: { nodes: landed.nodes, edges: landed.edges.filter(e => e.id !== edge.id) }, after: landed })
  openNewCausalLinkStrengthEditor(edgeIdsBefore, connection.source, connection.target)
  // Item 3 (Paul 7 Oct): the link has no strength yet, so Olumi proposes one (direction, band, one reason) as a card
  // the user accepts, changes or declines. The editor above still opens: the user's own figure always wins.
  if (edge) proposeForDrawnLink(edge.id)
}

interface ConnectStartParams {
  nodeId: string | null
  handleType?: 'source' | 'target' | null
}

export function useConnectGesture({
  enabled,
  showToast,
}: {
  /** `CANVAS_EDGE_ADD_CONNECTED` — the edge-draw carrier's authority, owned by `ReactFlowGraph`. */
  enabled: boolean
  showToast: ShowToast
}) {
  const connectSucceededRef = useRef(false)
  const connectStartRef = useRef<{ nodeId: string; handleType: 'source' | 'target' } | null>(null)

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!enabled) {
        showToast(SHARED_MODEL_AUTHORITY_COPY, 'info')
        return
      }
      connectSucceededRef.current = true // Task 4b: mark success before processing
      // F7: React Flow does not call this for a pair `isValidConnection` refused;
      // this is the fence for any caller that does.
      if (refusesQuestionLink(connection.source, connection.target)) {
        showToast(CONNECTION_REFUSAL_COPY.question, 'warning')
        return
      }
      createUserEdge(connection, showToast)
    },
    [enabled, showToast],
  )

  // Graph Editing Experience Task 2c: validate connections during drag.
  const isValidConnection = useCallback(
    (connection: { source: string | null; target: string | null }) => {
      if (!enabled) return false
      if (!connection.source || !connection.target) return false
      if (isSelfLoop(connection.source, connection.target)) return false
      if (refusesQuestionLink(connection.source, connection.target)) return false // F7
      const { nodes, edges, engineLimits } = useCanvasStore.getState()
      if (isDuplicateEdge(edges, connection.source, connection.target)) return false
      if (wouldExceedLimits(nodes.length, edges.length, 0, 1, engineLimits)) return false
      if (wouldCreateCycle(nodes.map(n => n.id), edges, connection.source, connection.target)) return false
      return true
    },
    [enabled],
  )

  // Task 4b: track connection start/end for drop feedback.
  const onConnectStart = useCallback((_: unknown, params: ConnectStartParams) => {
    connectSucceededRef.current = false
    connectStartRef.current = params.nodeId
      ? { nodeId: params.nodeId, handleType: params.handleType === 'target' ? 'target' : 'source' }
      : null
  }, [])

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const start = connectStartRef.current
      connectStartRef.current = null
      // onConnect already fired: the connection succeeded.
      if (connectSucceededRef.current || !start) return
      // Released over a card? (Empty canvas: silent, as before.)
      const nodeEl = (event.target as HTMLElement | null)?.closest?.('.react-flow__node')
      const dropNodeId = nodeEl?.getAttribute('data-id') ?? null
      if (!dropNodeId) return
      const { nodes, edges, engineLimits } = useCanvasStore.getState()
      // A card that is not on the model (a ghost suggestion) is not a target.
      if (!nodes.some(n => n.id === dropNodeId)) return
      // A drag begun on a top (input) handle reads the other way round.
      const [source, target] =
        start.handleType === 'target' ? [dropNodeId, start.nodeId] : [start.nodeId, dropNodeId]
      if (isSelfLoop(source, target)) return // silent: self-loops are obvious
      if (!enabled) {
        showToast(SHARED_MODEL_AUTHORITY_COPY, 'info')
        return
      }
      // F7: the Question's one link is Question → option — checked before the
      // other refusals, because no strength, dedupe or ordering makes it valid.
      if (refusesQuestionLink(source, target)) {
        showToast(CONNECTION_REFUSAL_COPY.question, 'warning')
      } else if (isDuplicateEdge(edges, source, target)) {
        showToast(CONNECTION_REFUSAL_COPY.duplicate, 'warning')
      } else if (wouldExceedLimits(nodes.length, edges.length, 0, 1, engineLimits)) {
        showToast(limitExceededMessage('edge_limit', edges.length), 'warning')
      } else if (wouldCreateCycle(nodes.map(n => n.id), edges, source, target)) {
        showToast(CONNECTION_REFUSAL_COPY.cycle, 'warning')
      } else {
        // ⭐ Every check passed: the connection IS allowed. Make it
        // (edit-structure/F5), rather than stating a false reason.
        createUserEdge({ source, target, sourceHandle: null, targetHandle: null }, showToast)
      }
    },
    [enabled, showToast],
  )

  return { onConnect, isValidConnection, onConnectStart, onConnectEnd }
}

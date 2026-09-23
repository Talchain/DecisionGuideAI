/**
 * Fixtures for "a hold says its operative cause" — one saved-example canvas and
 * one arrangement per `editDeliveryHold` cause, each built from the SAME
 * registers production writes (the wire mark, the deferral count, the structural
 * queues and lifecycles, the pending factor-edit register). Nothing here stubs
 * `editDeliveryHold` itself: a spec that mocked the predicate would be measuring
 * its own double.
 *
 * Shared by the pure/surface spec and the real-wiring dock spec so both describe
 * the identical state — two fixtures for one state is how two specs come to
 * agree with two different products.
 */
import { useCanvasStore } from '../../../store'
import { beginModelEditDelivery } from '../../editDeliveryHold'
import {
  __resetPendingFactorEditsForTest,
  markFactorEditInFlight,
} from '../../../conversation/pendingFactorEdit'
import {
  clearImportRegistrationMarkers,
  markGraphServerAcknowledged,
} from '../../../store/importRegistrationMarker'
import {
  __resetUnconfirmedDeletesForTest,
  settleStructuralDeleteAttempt,
} from '../../../conversation/unconfirmedStructuralDelete'
import { captureStructuralDelete } from '../../../mutations/structuralDelete'
import {
  __resetPendingEdgeEditsForTest,
  markEdgeEditInFlight,
} from '../../../conversation/pendingEdgeEdit'

export const SCENARIO = 'scn-hold-names-cause'
export const FACTOR_ID = 'fac_adoption'
export const FACTOR_LABEL = 'Adoption friction'
/** The number the user typed, on the model scale the edit sends. */
export const USER_VALUE = 0.42
/** How the card's own projection renders that number (`factorDisplayText`). */
export const USER_VALUE_TEXT = '0.42'
export const RENAMED_LABEL = 'Adoption drag'
/**
 * ⚠ DELIBERATELY CONTAINS "Edge". The footer and the reanalyse bar pass a
 * blocked reason through `vetBlockedReason`, whose foreign-string arm rewrites
 * "edge" to "connection" — so a user's own label would read one way on the chip
 * and another in the footer. Choosing a label the guard would rewrite is what
 * makes the parity assertions able to see that.
 */
export const ADDED_LABEL = 'Edge sales capacity'
export const ADDED_ID = 'fac_added'
/**
 * A node the user deleted (with its one incident link). ⚠ Also contains "Edge",
 * for the same parity reason as `ADDED_LABEL`. Once the delete is applied the
 * node is NOT on the canvas, so the only place its name can come from is the
 * delete record itself (the intent's `restore` payload).
 */
export const DELETED_LABEL = 'Edge reseller churn'
export const DELETED_ID = 'fac_reseller'
export const GOAL_LABEL = 'Grow revenue'
/** The fixture's one link (`e1`: the factor to the goal), as the hold sentence names it. */
export const LINK_NAME = `the link from ${FACTOR_LABEL} to ${GOAL_LABEL}`
/** `e1`'s strength before the user's edit, and the magnitude the edit sent. */
export const LINK_WEIGHT_BEFORE = 0.5
export const USER_LINK_MAGNITUDE = 0.8

export type HoldCause =
  | 'edit_on_the_wire'
  | 'edit_queued'
  | 'structural_edit_queued'
  | 'unresolved_rename'
  | 'unresolved_add'
  | 'unconfirmed_value'
  | 'unresolved_delete'
  | 'unresolved_delete_link'
  | 'unconfirmed_link_value'

export const HOLD_CAUSES: readonly HoldCause[] = [
  'edit_on_the_wire',
  'edit_queued',
  'structural_edit_queued',
  'unresolved_rename',
  'unresolved_add',
  'unconfirmed_value',
  'unresolved_delete',
  'unresolved_delete_link',
  'unconfirmed_link_value',
]

type Stamp = Record<string, unknown>
export const STARTER_STAMP: Stamp = { starterId: 'market-entry' }
export const TEMPLATE_STAMP: Stamp = { templateId: 'marketing-v1' }

interface CanvasOptions {
  stamp?: Stamp
  factorLabel?: string
  factorValue?: number
  withAddedNode?: boolean
  /** The canvas BEFORE the delete: the node the user then deleted, and its incident link. */
  withDeletedNode?: boolean
  /** `e1`'s strength as the canvas shows it. */
  linkWeight?: number
}

function canvas({
  stamp = STARTER_STAMP,
  factorLabel = FACTOR_LABEL,
  factorValue = 0.55,
  withAddedNode = false,
  withDeletedNode = false,
  linkWeight = LINK_WEIGHT_BEFORE,
}: CanvasOptions) {
  const nodes = [
    { id: 'dec_1', type: 'decision', position: { x: 0, y: 0 }, data: { kind: 'decision', label: 'Enter the German market?', ...stamp } },
    { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: GOAL_LABEL, ...stamp } },
    { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Enter now', ...stamp } },
    { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Wait a year', ...stamp } },
    {
      id: FACTOR_ID,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { kind: 'factor', label: factorLabel, observedState: { value: factorValue, unit: 'scale' }, ...stamp },
    },
    ...(withAddedNode
      ? [{ id: ADDED_ID, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: ADDED_LABEL } }]
      : []),
    ...(withDeletedNode
      ? [{ id: DELETED_ID, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: DELETED_LABEL, ...stamp } }]
      : []),
  ]
  const edges = [
    { id: 'e1', source: FACTOR_ID, target: 'goal_1', data: { weight: linkWeight, direction: 'positive' } },
    ...(withDeletedNode
      ? [{ id: 'e_reseller', source: DELETED_ID, target: 'goal_1', data: { weight: 0.3, direction: 'negative' } }]
      : []),
  ]
  return { nodes, edges }
}

/** The edit registers at rest. Every arrangement starts from here. */
const QUIET = {
  pendingEmittedEdits: 0,
  pendingStructuralDeletes: [],
  pendingStructuralRenames: [],
  pendingStructuralAdds: [],
  pendingStructuralAddEdges: [],
  structuralRenameLifecycle: [],
  structuralAddLifecycle: [],
}

/** Put a saved-example canvas on the store with no edit anywhere in flight. */
export function seedHeldCanvas(options: CanvasOptions = {}): void {
  const { nodes, edges } = canvas(options)
  useCanvasStore.setState({
    nodes: nodes as never,
    edges: edges as never,
    currentScenarioId: SCENARIO,
    importPendingServerRegistration: true,
    ...QUIET,
  } as never)
}

/** Positive evidence that CEE holds the graph currently on the store. */
export function acknowledgeCurrentGraph(): void {
  const { nodes, edges, currentScenarioId } = useCanvasStore.getState()
  markGraphServerAcknowledged(currentScenarioId, nodes as never, edges as never)
}

let releaseWire: (() => void) | null = null

/**
 * A delete captured the way the canvas captures it (`captureStructuralDelete`
 * over the PRE-delete graph), so its `restore` payload is the real shape.
 */
export function captureDelete(removedNodeIds: string[], removedEdgeIds: string[] = []) {
  const before = canvas({ withDeletedNode: removedNodeIds.includes(DELETED_ID) })
  const captured = captureStructuralDelete({
    nodesBefore: before.nodes as never,
    edgesBefore: before.edges as never,
    removedNodeIds,
    removedEdgeIds,
    baseGraphHash: 'aag_v1:before-delete',
    externalMutationActive: false,
    makeId: () => `del-${removedNodeIds.join('+')}-${removedEdgeIds.join('+')}`,
  })
  if (!captured.ok) throw new Error(`fixture delete did not capture: ${captured.reason}`)
  return captured.intent
}

/** The canvas AFTER `captureDelete(...)` was applied: every element it removed is gone. */
export function applyDeleteToStore(intent: ReturnType<typeof captureDelete>): void {
  const before = canvas({ withDeletedNode: intent.claimedNodeIds.includes(DELETED_ID) })
  const nodes = new Set(intent.claimedNodeIds)
  const edges = new Set(intent.claimedEdgeIds)
  useCanvasStore.setState({
    nodes: before.nodes.filter((n) => !nodes.has(n.id)) as never,
    edges: before.edges.filter((e) => !edges.has(e.id)) as never,
  } as never)
}

/**
 * Arrange ONE cause on top of `seedHeldCanvas`, through the register that
 * production writes for it. Returns nothing; `resetEditHoldRegisters` undoes
 * every arrangement.
 */
export function arrangeHoldCause(cause: HoldCause): void {
  switch (cause) {
    case 'edit_on_the_wire':
      releaseWire = beginModelEditDelivery('factor_value_edit')
      return
    case 'edit_queued':
      useCanvasStore.setState({ pendingEmittedEdits: 1 } as never)
      return
    case 'structural_edit_queued':
      // A SENDABLE queued rename — it carries a base. #1893: a rename queued
      // with no base anywhere cannot be delivered until a registration's ack
      // seeds one, so it does not hold (`sendableQueuedRenames`); a base-less
      // fixture here would arrange no hold at all.
      useCanvasStore.setState({
        pendingStructuralRenames: [
          { id: 'intent-queued', nodeId: FACTOR_ID, label: RENAMED_LABEL, baseGraphHash: 'aag_v1:before-rename' },
        ],
      } as never)
      return
    case 'unresolved_rename': {
      // The rename's optimistic label is what the canvas shows, and its turn
      // settled `unconfirmed` (the untyped 500 arm keeps the label).
      const { nodes } = canvas({ factorLabel: RENAMED_LABEL })
      useCanvasStore.setState({
        nodes: nodes as never,
        structuralRenameLifecycle: [
          { status: 'unconfirmed', scenarioId: SCENARIO, intent: { id: 'r1', nodeId: FACTOR_ID, label: RENAMED_LABEL } },
        ],
      } as never)
      return
    }
    case 'unresolved_add': {
      const { nodes } = canvas({ withAddedNode: true })
      useCanvasStore.setState({
        nodes: nodes as never,
        structuralAddLifecycle: [
          { status: 'unconfirmed', scenarioId: SCENARIO, intent: { id: 'a1', nodeId: ADDED_ID } },
        ],
      } as never)
      return
    }
    case 'unconfirmed_value': {
      // After the untyped 500: the user's number stays on the canvas and the
      // pending register still records it as sent and unanswered.
      const { nodes } = canvas({ factorValue: USER_VALUE })
      useCanvasStore.setState({ nodes: nodes as never } as never)
      markFactorEditInFlight(FACTOR_ID, USER_VALUE)
      return
    }
    case 'unresolved_delete': {
      // A node delete whose turn ended in an untyped 500: the deletion stays on
      // the canvas and the attempt is recorded `unconfirmed` (#1905 residual 1).
      const intent = captureDelete([DELETED_ID])
      applyDeleteToStore(intent)
      settleStructuralDeleteAttempt(intent, SCENARIO, 'unconfirmed')
      return
    }
    case 'unresolved_delete_link': {
      // The same, for a link deleted on its own: both of its ends stay on the canvas.
      const intent = captureDelete([], ['e1'])
      applyDeleteToStore(intent)
      settleStructuralDeleteAttempt(intent, SCENARIO, 'unconfirmed')
      return
    }
    case 'unconfirmed_link_value': {
      // Signal 5 (#1905): the user's link strength stays on the canvas after an
      // unanswered send, and the pending register still records it as sent.
      const { edges } = canvas({ linkWeight: USER_LINK_MAGNITUDE })
      useCanvasStore.setState({ edges: edges as never } as never)
      markEdgeEditInFlight('e1', USER_LINK_MAGNITUDE, { weight: LINK_WEIGHT_BEFORE, direction: 'positive' })
      return
    }
  }
}

/** Undo every arrangement, including the module-level registers. */
export function resetEditHoldRegisters(): void {
  releaseWire?.()
  releaseWire = null
  __resetPendingFactorEditsForTest()
  __resetUnconfirmedDeletesForTest()
  __resetPendingEdgeEditsForTest()
  clearImportRegistrationMarkers()
  useCanvasStore.setState(QUIET as never)
}

/** What the sentence for each cause must name — the element and, where held, the value. */
export const CAUSE_MUST_NAME: Record<HoldCause, readonly (string | RegExp)[]> = {
  edit_on_the_wire: [/still being saved/i],
  edit_queued: [/still being saved/i],
  structural_edit_queued: [/still being saved/i],
  unresolved_rename: [/couldn['’]t confirm/i, RENAMED_LABEL],
  unresolved_add: [/couldn['’]t confirm/i, ADDED_LABEL],
  unconfirmed_value: [/couldn['’]t confirm/i, FACTOR_LABEL, USER_VALUE_TEXT],
  // The remedy is pinned too (Panel #1917 F1): every surface must name the one
  // exit the user can take — the chat — never "remove it again" or Undo.
  unresolved_delete: [/couldn['’]t confirm/i, `that ${DELETED_LABEL} was removed from the saved model`, /ask Olumi to remove it\?/],
  unresolved_delete_link: [/couldn['’]t confirm/i, `that ${LINK_NAME} was removed from the saved model`, /ask Olumi to remove it\?/],
  unconfirmed_link_value: [/couldn['’]t confirm/i, `your change to the strength of ${LINK_NAME}`, /set the strength again/],
}

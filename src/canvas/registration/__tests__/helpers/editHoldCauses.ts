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

export type HoldCause =
  | 'edit_on_the_wire'
  | 'edit_queued'
  | 'structural_edit_queued'
  | 'unresolved_rename'
  | 'unresolved_add'
  | 'unconfirmed_value'

export const HOLD_CAUSES: readonly HoldCause[] = [
  'edit_on_the_wire',
  'edit_queued',
  'structural_edit_queued',
  'unresolved_rename',
  'unresolved_add',
  'unconfirmed_value',
]

type Stamp = Record<string, unknown>
export const STARTER_STAMP: Stamp = { starterId: 'market-entry' }
export const TEMPLATE_STAMP: Stamp = { templateId: 'marketing-v1' }

interface CanvasOptions {
  stamp?: Stamp
  factorLabel?: string
  factorValue?: number
  withAddedNode?: boolean
}

function canvas({ stamp = STARTER_STAMP, factorLabel = FACTOR_LABEL, factorValue = 0.55, withAddedNode = false }: CanvasOptions) {
  const nodes = [
    { id: 'dec_1', type: 'decision', position: { x: 0, y: 0 }, data: { kind: 'decision', label: 'Enter the German market?', ...stamp } },
    { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Grow revenue', ...stamp } },
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
  ]
  const edges = [{ id: 'e1', source: FACTOR_ID, target: 'goal_1', data: { weight: 0.5, direction: 'positive' } }]
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
      useCanvasStore.setState({
        pendingStructuralRenames: [{ id: 'intent-queued', nodeId: FACTOR_ID, label: RENAMED_LABEL }],
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
  }
}

/** Undo every arrangement, including the module-level registers. */
export function resetEditHoldRegisters(): void {
  releaseWire?.()
  releaseWire = null
  __resetPendingFactorEditsForTest()
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
}

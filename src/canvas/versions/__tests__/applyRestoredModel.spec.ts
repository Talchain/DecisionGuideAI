/**
 * A RESTORE REPLACES; A RECEIPT OVERLAYS.
 *
 * `reconcileAppliedGraph`'s field rule is "the wire WINS on keys it carries,
 * the canvas KEEPS keys the wire omits" (`overlayNode`, mergeAppliedGraph.ts).
 * That is right for an edit receipt, whose graph may omit optional fields CEE
 * has no value for. It is wrong for a version restore: the restored graph is
 * the COMPLETE stored model, so a key it lacks is a key that version did not
 * have. Under the overlay, restoring the version from before a first-time value
 * edit leaves the edited value on the canvas while the saved model has none —
 * the canvas/saved-model split that switched Undo off in the first place.
 *
 * Every seeded node goes through the REAL `mapDraftNodeToCanvas`, so no fixture
 * encodes a node shape the product does not produce.
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { useCanvasStore } from '../../store'
import { mapDraftNodeToCanvas, mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { reconcileAppliedGraph } from '../../utils/mergeAppliedGraph'
import { applyRestoredGraph } from '../applyRestoredModel'

const GOAL = 'goal_mrr'
const FACTOR = 'fac_churn'
const OPTION = 'opt_raise'
const OTHER = 'opt_hold'

function wireGoal(extra: Record<string, unknown> = {}) {
  return { id: GOAL, kind: 'goal', label: 'MRR', ...extra }
}
function wireFactor(extra: Record<string, unknown> = {}) {
  return { id: FACTOR, kind: 'factor', label: 'Churn', ...extra }
}
function wireOption(id: string, label: string) {
  return { id, kind: 'option', label }
}
function wireEdge(from: string, to: string) {
  return { id: `${from}->${to}`, from, to, strength: { mean: 0.4, std: 0.1 }, effect_direction: 'positive' }
}

const CHURN_SET = { value: 0.037, raw_value: 3.7, unit: '%', source: 'user_override' }

function seed(nodes: unknown[], edges: unknown[] = []) {
  const canvasNodes = nodes.map((n, i) => ({
    ...mapDraftNodeToCanvas(n),
    position: { x: 100 * (i + 1), y: 50 * (i + 1) },
  }))
  useCanvasStore.setState({
    nodes: canvasNodes,
    edges: edges.map((e, i) => mapDraftEdgeToCanvas(e, i)),
    lastAuthoritativeGraph: {
      nodeIds: canvasNodes.map((n: { id: string }) => n.id),
      edgePairs: [],
    },
  } as never)
}

function node(id: string): { data: Record<string, unknown>; position: { x: number; y: number } } {
  const n = useCanvasStore.getState().nodes.find((x) => x.id === id)
  if (!n) throw new Error(`node ${id} not on canvas`)
  return n as never
}

beforeEach(() => {
  useCanvasStore.getState().resetCanvas?.()
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    lastAuthoritativeGraph: null,
    durablyDeletedElements: { nodeIds: [], edgeIds: [] },
  } as never)
})

describe('applyRestoredGraph — the restored version is the whole model', () => {
  it('clears a value the restored version does not carry (undo of a first-time value)', () => {
    seed([wireGoal(), wireFactor({ observed_state: CHURN_SET }), wireOption(OPTION, 'Raise to £60')])
    expect(node(FACTOR).data.observedState).toEqual(CHURN_SET)

    applyRestoredGraph({ nodes: [wireGoal(), wireFactor(), wireOption(OPTION, 'Raise to £60')], edges: [] })

    expect(node(FACTOR).data.observedState).toBeUndefined()
  })

  it('clears a goal target the restored version does not carry', () => {
    seed([wireGoal({ goal_threshold: 0.8 }), wireFactor(), wireOption(OPTION, 'Raise to £60')])
    expect(node(GOAL).data.goal_threshold).toBe(0.8)

    applyRestoredGraph({ nodes: [wireGoal(), wireFactor(), wireOption(OPTION, 'Raise to £60')], edges: [] })

    expect(node(GOAL).data.goal_threshold).toBeUndefined()
  })

  it('takes every value the restored version carries (rename undone)', () => {
    seed([wireGoal(), wireFactor(), wireOption(OPTION, 'Raise to £60')])

    applyRestoredGraph({ nodes: [wireGoal(), wireFactor(), wireOption(OPTION, 'Raise to £59')], edges: [] })

    expect(node(OPTION).data.label).toBe('Raise to £59')
  })

  it('keeps the canvas layout of nodes that survive', () => {
    seed([wireGoal(), wireFactor({ observed_state: CHURN_SET }), wireOption(OPTION, 'Raise to £60')])
    const before = node(FACTOR).position

    applyRestoredGraph({ nodes: [wireGoal(), wireFactor(), wireOption(OPTION, 'Raise to £60')], edges: [] })

    expect(node(FACTOR).position).toEqual(before)
  })

  it('brings back a deleted option WITH its link (undo of a delete)', () => {
    seed([wireGoal(), wireFactor(), wireOption(OPTION, 'Raise to £60')], [wireEdge(OPTION, FACTOR)])
    // The delete, as the server proved it.
    useCanvasStore.getState().recordDurableDeletion({ nodeIds: [OTHER], edgeIds: [`${OTHER}->${FACTOR}`] })

    applyRestoredGraph({
      nodes: [wireGoal(), wireFactor(), wireOption(OPTION, 'Raise to £60'), wireOption(OTHER, 'Hold at £54')],
      edges: [wireEdge(OPTION, FACTOR), wireEdge(OTHER, FACTOR)],
    })

    const ids = useCanvasStore.getState().nodes.map((n) => n.id)
    expect(ids).toContain(OTHER)
    const pairs = useCanvasStore.getState().edges.map((e) => `${e.source}->${e.target}`)
    expect(pairs).toContain(`${OTHER}->${FACTOR}`)
    // The server holds it again, so it is no longer "proven deleted".
    const record = useCanvasStore.getState().durablyDeletedElements
    expect(record.nodeIds).not.toContain(OTHER)
    expect(record.edgeIds).not.toContain(`${OTHER}->${FACTOR}`)
  })

  it('a restored node survives the NEXT proven delete of a different node', () => {
    seed([wireGoal(), wireFactor(), wireOption(OPTION, 'Raise to £60')])
    useCanvasStore.getState().recordDurableDeletion({ nodeIds: [OTHER], edgeIds: [] })
    applyRestoredGraph({
      nodes: [wireGoal(), wireFactor(), wireOption(OPTION, 'Raise to £60'), wireOption(OTHER, 'Hold at £54')],
      edges: [],
    })

    useCanvasStore.getState().recordDurableDeletion({ nodeIds: [OPTION], edgeIds: [] })

    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toContain(OTHER)
  })
})

describe('control — the edit-receipt path keeps its documented overlay rule', () => {
  it('reconcileAppliedGraph (no restore) still KEEPS a key the wire omits', () => {
    seed([wireGoal(), wireFactor({ observed_state: CHURN_SET }), wireOption(OPTION, 'Raise to £60')])

    reconcileAppliedGraph({ graph: { nodes: [wireGoal(), wireFactor(), wireOption(OPTION, 'Raise to £60')], edges: [] } } as never)

    expect(node(FACTOR).data.observedState).toEqual(CHURN_SET)
  })
})

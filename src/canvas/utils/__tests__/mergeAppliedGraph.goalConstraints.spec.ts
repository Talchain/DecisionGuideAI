/**
 * ROADMAP 2.932 (Codex R4 finding MF2) — reconcileAppliedGraph must commit the
 * applied-edit receipt's `goal_constraints` into the store.
 *
 * THE DEFECT. A populated-canvas (terminal analysis) turn routes to
 * reconcileAppliedGraph, which before this fix read ONLY nodes and edges. So a
 * turn on which CEE returned goal_constraints left the store on its previous
 * value: the completed canvas showed "No limits on record", and the NEXT
 * analysis (which reads store.goalConstraints) omitted the user's limits.
 *
 * Bindings are by IDENTITY (constraint_id + target + frame), never a value
 * predicate another constraint could satisfy (CLAUDE.md trap 19). The
 * three-constraint receipt exists so the discriminating mutant pair has a
 * constraint the identity test does NOT bind to.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { reconcileAppliedGraph } from '../mergeAppliedGraph'
import { useCanvasStore } from '../../store'
import { seedCanvas as seedStore } from './__helpers__/mergeAppliedGraphHarness'

const EXISTING_NODES = [
  { id: 'goal-1', type: 'goal', position: { x: 400, y: 40 }, data: { kind: 'goal', label: 'Revenue' } },
  { id: 'factor-1', type: 'factor', position: { x: 40, y: 200 }, data: { kind: 'factor', label: 'Spend' } },
]

// The constraints CEE returned on the terminal turn (the MF2 report shape).
// A third, un-asserted constraint gives the mutant pair a "different" object.
const RECEIPT_CONSTRAINTS = [
  { constraint_id: 'c_spend_max', node_id: 'factor-1', operator: '<=', value: 5000, unit: '£' },
  { constraint_id: 'c_revenue_min', node_id: 'goal-1', operator: '>=', value: 20000, unit: '£' },
  { constraint_id: 'c_extra', node_id: 'factor-1', operator: '<=', value: 5000, unit: '£' },
]

// A receipt whose graph OVERLAPS the canvas (so the zero-overlap guard passes)
// and is structurally identical to it — the analysis turn does not change the
// graph, so this is a node/edge NO-OP that nonetheless carries constraints.
function receipt(constraints: unknown) {
  return {
    nodes: [
      { id: 'goal-1', kind: 'goal', label: 'Revenue' },
      { id: 'factor-1', kind: 'factor', label: 'Spend' },
    ],
    edges: [],
    goal_constraints: constraints,
  } as never
}

beforeEach(() => {
  useCanvasStore.getState().reset()
  seedStore(EXISTING_NODES, [])
  useCanvasStore.getState().setGoalConstraints(null, { fromProducerSync: true })
})

describe('reconcileAppliedGraph — goal_constraints (ROADMAP 2.932)', () => {
  it('commits the receipt constraints into the store BY IDENTITY, even on a graph no-op', () => {
    const before = useCanvasStore.getState().goalConstraints
    expect(before).toBeNull()

    reconcileAppliedGraph(receipt(RECEIPT_CONSTRAINTS))

    const stored = useCanvasStore.getState().goalConstraints
    // RED at pristine (named): reconcile never wrote constraints, so `stored`
    // stays null — `expect(stored).not.toBeNull()` fails.
    expect(stored).not.toBeNull()
    expect(stored).toHaveLength(3)

    // Bind by IDENTITY, not by "some constraint with value 5000" (c_extra shares
    // that value): assert the SPECIFIC constraint_id carries the right frame.
    const spend = stored!.find((c) => c.constraint_id === 'c_spend_max')
    expect(spend).toBeDefined()
    expect(spend!.node_id).toBe('factor-1')
    expect(spend!.operator).toBe('<=')
    expect(spend!.value).toBe(5000)

    const revenue = stored!.find((c) => c.constraint_id === 'c_revenue_min')
    expect(revenue).toBeDefined()
    expect(revenue!.node_id).toBe('goal-1')
    expect(revenue!.operator).toBe('>=')
    expect(revenue!.value).toBe(20000)
  })

  it('leaves the store untouched when the receipt carries NO goal_constraints (absence never clears)', () => {
    // A prior turn established the constraints.
    useCanvasStore
      .getState()
      .setGoalConstraints(RECEIPT_CONSTRAINTS as never, { fromProducerSync: true })

    reconcileAppliedGraph(receipt(undefined))

    const stored = useCanvasStore.getState().goalConstraints
    expect(stored).toHaveLength(3)
    expect(stored!.map((c) => c.constraint_id).sort()).toEqual([
      'c_extra',
      'c_revenue_min',
      'c_spend_max',
    ])
  })

  it('leaves the store untouched when the receipt carries an EMPTY goal_constraints array', () => {
    useCanvasStore
      .getState()
      .setGoalConstraints(RECEIPT_CONSTRAINTS as never, { fromProducerSync: true })

    reconcileAppliedGraph(receipt([]))

    expect(useCanvasStore.getState().goalConstraints).toHaveLength(3)
  })
})

/**
 * add_constraint graph_patch — apply CEE's server-applied constraint patches
 * into the canvas `goalConstraints` store slice (the SAME slice GoalPanel's
 * "Add constraint" flow writes via setGoalConstraints).
 *
 * Wire shape: a graph_patch block with operation 'add_constraint' carries the
 * constrained node in `target_id` and the constraint payload in `after`
 * (untyped Record on the wire). The applicator maps `after` → CEEGoalConstraint
 * and APPENDS it (deduped) to the existing constraints via setGoalConstraints
 * with { fromProducerSync: true } (a producer sync — the response's own
 * analysis_ready.freshness verdict governs staleness, so the write must not
 * self-dirty the freshness overlay).
 *
 * Operator vocabulary tolerance: `after.operator` may be the schema form
 * ('>=' / '<=') OR the chip form ('at_least' / 'at_most'); node id may be
 * `after.node_id`, `after.target_id`, or fall back to the patch `target_id`.
 * Anything that cannot resolve a node id + operator + finite value is DEFERRED
 * (fail-closed) — the applicator never fabricates a constraint.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import type { CEEGoalConstraint } from '../../adapters/cee/types'

const { pulseMock } = vi.hoisted(() => ({ pulseMock: vi.fn() }))
vi.mock('../../canvas/utils/appliedEditPulse', () => ({
  pulseAppliedTargets: pulseMock,
  __resetAppliedEditPulseForTests: vi.fn(),
  PULSE_COALESCE_MS: 100,
  PULSE_DURATION_MS: 2000,
}))
vi.mock('../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

import { applyV5State, type V5ApplicatorStore } from '../applyV5State'

function baseResponse(overrides: Partial<OlumiResponse> = {}): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
    ...overrides,
  }
}

function makeStore(
  goalConstraints: CEEGoalConstraint[] | null = null,
  nodes: V5ApplicatorStore['nodes'] = [],
): V5ApplicatorStore {
  return {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    setGoalConstraints: vi.fn(),
    backfillGoalThreshold: vi.fn(),
    selectNodeWithoutHistory: vi.fn(),
    selectEdgeWithoutHistory: vi.fn(),
    goalConstraints,
    nodes,
    edges: [],
  }
}

const constraintPatch = (after: Record<string, unknown> | null, target_id = 'goal-1') =>
  ({
    type: 'graph_patch',
    status: 'applied',
    operation: 'add_constraint',
    target_id,
    before: null,
    after,
  }) as never

beforeEach(() => {
  pulseMock.mockClear()
})

describe('applyV5State — add_constraint graph_patch', () => {
  it('appends a constraint (schema operator) to goalConstraints via setGoalConstraints', () => {
    const store = makeStore(null)
    const result = applyV5State(
      baseResponse({
        blocks: [
          constraintPatch({
            constraint_id: 'c_budget',
            node_id: 'factor-spend',
            operator: '<=',
            value: 250,
            label: 'Budget cap',
            unit: '£',
          }),
        ],
      }),
      store,
    )
    expect(store.setGoalConstraints).toHaveBeenCalledTimes(1)
    const [constraints, opts] = (store.setGoalConstraints as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(constraints).toHaveLength(1)
    expect(constraints[0]).toMatchObject({
      constraint_id: 'c_budget',
      node_id: 'factor-spend',
      operator: '<=',
      value: 250,
      label: 'Budget cap',
      unit: '£',
    })
    // producer sync — must NOT self-dirty the freshness overlay
    expect(opts).toEqual({ fromProducerSync: true })
    expect(result.applied).toContain('graph_patch:add_constraint:factor-spend')
  })

  it('preserves existing constraints — the new one is APPENDED, not replaced', () => {
    const existing: CEEGoalConstraint = {
      constraint_id: 'c_old',
      node_id: 'factor-a',
      operator: '>=',
      value: 10,
    }
    const store = makeStore([existing])
    applyV5State(
      baseResponse({
        blocks: [
          constraintPatch({ node_id: 'factor-b', operator: '<=', value: 5 }),
        ],
      }),
      store,
    )
    const [constraints] = (store.setGoalConstraints as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(constraints).toHaveLength(2)
    expect(constraints[0]).toBe(existing)
    expect(constraints[1]).toMatchObject({ node_id: 'factor-b', operator: '<=', value: 5 })
  })

  it('maps the chip operator vocabulary (at_least → >=, at_most → <=)', () => {
    const store = makeStore(null)
    applyV5State(
      baseResponse({
        blocks: [
          constraintPatch({ node_id: 'factor-a', constraint_type: 'at_least', value: 3 }),
        ],
      }),
      store,
    )
    const [constraints] = (store.setGoalConstraints as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(constraints[0].operator).toBe('>=')
  })

  it('falls back to the patch target_id for node_id when after omits it', () => {
    const store = makeStore(null)
    applyV5State(
      baseResponse({
        blocks: [constraintPatch({ operator: '>=', value: 7 }, 'goal-node')],
      }),
      store,
    )
    const [constraints] = (store.setGoalConstraints as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(constraints[0].node_id).toBe('goal-node')
  })

  it('IDEMPOTENT: applying the same response twice does not double-append', () => {
    const store = makeStore(null)
    const response = baseResponse({
      blocks: [
        constraintPatch({ node_id: 'factor-a', operator: '>=', value: 3 }),
      ],
    })
    applyV5State(response, store)
    const firstArray = (store.setGoalConstraints as ReturnType<typeof vi.fn>).mock.calls[0][0]
    // second fire: the store now already holds that constraint
    const store2 = makeStore(firstArray)
    const result2 = applyV5State(response, store2)
    expect(store2.setGoalConstraints).not.toHaveBeenCalled()
    expect(result2.deferred.some((d) => d.reason === 'add_constraint_duplicate_skipped')).toBe(true)
  })

  it('coalesces multiple add_constraint patches into ONE setGoalConstraints call', () => {
    const store = makeStore(null)
    applyV5State(
      baseResponse({
        blocks: [
          constraintPatch({ node_id: 'factor-a', operator: '>=', value: 3 }),
          constraintPatch({ node_id: 'factor-b', operator: '<=', value: 9 }),
        ],
      }),
      store,
    )
    expect(store.setGoalConstraints).toHaveBeenCalledTimes(1)
    const [constraints] = (store.setGoalConstraints as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(constraints).toHaveLength(2)
  })

  it('NEGATIVE CONTROL: a non-applied patch is skipped (no store write)', () => {
    const store = makeStore(null)
    applyV5State(
      baseResponse({
        blocks: [
          {
            type: 'graph_patch',
            status: 'proposed',
            operation: 'add_constraint',
            target_id: 'goal-1',
            before: null,
            after: { node_id: 'factor-a', operator: '>=', value: 3 },
          } as never,
        ],
      }),
      store,
    )
    expect(store.setGoalConstraints).not.toHaveBeenCalled()
  })

  it('NEGATIVE CONTROL: an unmappable shape (no operator) DEFERS fail-closed, no write', () => {
    const store = makeStore(null)
    const result = applyV5State(
      baseResponse({
        blocks: [constraintPatch({ node_id: 'factor-a', value: 3 })],
      }),
      store,
    )
    expect(store.setGoalConstraints).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === 'add_constraint_unmappable_shape')).toBe(true)
  })

  it('NEGATIVE CONTROL: a non-finite / non-numeric value DEFERS (never coerced)', () => {
    const store = makeStore(null)
    const result = applyV5State(
      baseResponse({
        blocks: [constraintPatch({ node_id: 'factor-a', operator: '>=', value: '3' })],
      }),
      store,
    )
    expect(store.setGoalConstraints).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === 'add_constraint_unmappable_shape')).toBe(true)
  })

  it('does not mutate node/edge data (constraints are metadata, not causal structure)', () => {
    const store = makeStore(null)
    applyV5State(
      baseResponse({
        blocks: [constraintPatch({ node_id: 'factor-a', operator: '>=', value: 3 })],
      }),
      store,
    )
    expect(store.updateNode).not.toHaveBeenCalled()
    expect(store.updateEdgeData).not.toHaveBeenCalled()
  })
})

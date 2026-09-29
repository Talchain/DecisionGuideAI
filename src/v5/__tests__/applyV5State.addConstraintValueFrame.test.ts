/**
 * ⛔ R1 S4-core (CEE #2261; PR Review CHANGES_REQUIRED 5880215622, blocking 1): the applied `add_constraint` receipt
 * keeps the limit's `value_frame`. CEE emits the validated constraint as the patch's `after`, frame included; the
 * projection into `goalConstraints` copied every field BUT the frame, so a chat-added "no more than 10% above today"
 * reached the reader as `{operator:'<=', value:0.1}` and was said as the level "≤ 0.1". Pinned patch → store → reader.
 *
 * Also the goal-minimum mirror: a `>=` limit on the goal with a unit is mirrored onto the goal's own target
 * (`goal_threshold_raw`). A limit stated as a CHANGE is not a level target, so it is never mirrored as one.
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

import { goalConstraintText } from '../../canvas/utils/goalConstraintText'

const stored = (store: V5ApplicatorStore): CEEGoalConstraint =>
  (store.setGoalConstraints as ReturnType<typeof vi.fn>).mock.calls[0][0][0]

// CEE #2261's admitted row, as the patch's `after` carries it (S4L-3: change_rel 0.1, no unit).
const CHANGE_REL = { constraint_id: 'agent-lane:fac_cost:<=:change_rel', node_id: 'fac_cost', operator: '<=', value: 0.1, value_frame: 'change_rel', label: 'Total monthly cloud cost' }

describe('applyV5State — add_constraint keeps value_frame (patch → store → reader)', () => {
  it('RED: a change_rel limit is stored with its frame and read as the change', () => {
    const store = makeStore(null)
    applyV5State(baseResponse({ blocks: [constraintPatch(CHANGE_REL, 'fac_cost')] }), store)
    expect(stored(store).value_frame).toBe('change_rel')
    expect(goalConstraintText(stored(store), [], { omitLabel: true })).toBe('no more than 10% above today')
  })

  it('RED: change_abs is carried too', () => {
    const store = makeStore(null)
    applyV5State(baseResponse({ blocks: [constraintPatch({ ...CHANGE_REL, value: 5000, unit: 'GBP', value_frame: 'change_abs' }, 'fac_cost')] }), store)
    expect(stored(store).value_frame).toBe('change_abs')
  })

  it('RED (PR Review 5880865579): a present but unknown frame DEFERS — nothing stored, nothing mirrored', () => {
    for (const frame of ['bogus', null, 'CHANGE_REL', 1]) {
      const store = makeStore(null)
      const result = applyV5State(baseResponse({ blocks: [constraintPatch({ ...CHANGE_REL, value_frame: frame }, 'fac_cost')] }), store)
      expect(store.setGoalConstraints, String(frame)).not.toHaveBeenCalled()
      expect(result.deferred.some((d) => d.reason === 'add_constraint_unknown_value_frame'), String(frame)).toBe(true)
    }
  })

  it('⛔ CONTRAST: a level keeps "level"; no frame (legacy level) adds no key', () => {
    for (const [frame, want] of [['level', 'level'], [undefined, undefined]] as const) {
      const store = makeStore(null)
      const after: Record<string, unknown> = { ...CHANGE_REL, value: 250000, unit: 'GBP' }
      if (frame === undefined) delete after.value_frame; else after.value_frame = frame
      applyV5State(baseResponse({ blocks: [constraintPatch(after, 'fac_cost')] }), store)
      expect(stored(store).value_frame, String(frame)).toBe(want)
      if (want === undefined) expect(Object.keys(stored(store)), String(frame)).not.toContain('value_frame')
    }
  })
})

describe('applyV5State — a change limit on the goal is never mirrored as its level target', () => {
  const goalStore = () => {
    const store = makeStore(null, [{ id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Cut the cloud bill', kind: 'goal' } }] as never)
    ;(store as unknown as { setGoalThreshold: ReturnType<typeof vi.fn> }).setGoalThreshold = vi.fn()
    return store
  }
  const onGoal = (extra: Record<string, unknown>) =>
    constraintPatch({ constraint_id: 'c_goal_min', node_id: 'goal-1', operator: '>=', value: 5000, unit: 'GBP', ...extra }, 'goal-1')

  it('RED: a ">=" change_abs limit with a unit does not stamp goal_threshold_raw', () => {
    const store = goalStore()
    applyV5State(baseResponse({ blocks: [onGoal({ value_frame: 'change_abs' })] }), store)
    expect(store.updateNode).not.toHaveBeenCalled()
    expect((store as unknown as { setGoalThreshold: ReturnType<typeof vi.fn> }).setGoalThreshold).not.toHaveBeenCalled()
  })

  it('RED (PR Review 5880865579): a ">=" limit with an UNKNOWN frame on the goal is never mirrored as its level', () => {
    const store = goalStore()
    applyV5State(baseResponse({ blocks: [onGoal({ value_frame: 'bogus' })] }), store)
    expect(store.updateNode).not.toHaveBeenCalled()
    expect((store as unknown as { setGoalThreshold: ReturnType<typeof vi.fn> }).setGoalThreshold).not.toHaveBeenCalled()
  })

  it('⛔ CONTRAST: the same ">=" limit as a level IS mirrored, as before', () => {
    const store = goalStore()
    applyV5State(baseResponse({ blocks: [onGoal({})] }), store)
    expect(store.updateNode).toHaveBeenCalledTimes(1)
    expect((store.updateNode as ReturnType<typeof vi.fn>).mock.calls[0][1].data).toMatchObject({ goal_threshold_raw: 5000, goal_threshold_unit: 'GBP' })
  })
})

/**
 * ⛔ PR Review CHANGES_REQUIRED 5881464028, blocking 1: the UPSERT no-op compared every content field BUT
 * `value_frame`, so a same-ID patch whose ONLY change is level/absent → change_rel was declared an exact echo and
 * never written — the stored row stayed a level and readers said "≤ 0.1" for a 10%-from-today limit.
 */
describe('applyV5State — a same-ID frame-only update writes (patch → store → reader)', () => {
  const LEVEL_ROW: CEEGoalConstraint = { constraint_id: 'c_cost', node_id: 'fac_cost', operator: '<=', value: 0.1, label: 'Total monthly cloud cost' } as CEEGoalConstraint

  it('RED: stored as a level (no frame), re-sent as change_rel with the same ID → written, read as the change', () => {
    const store = makeStore([LEVEL_ROW])
    const result = applyV5State(baseResponse({ blocks: [constraintPatch({ ...LEVEL_ROW, value_frame: 'change_rel' }, 'fac_cost')] }), store)
    expect(result.deferred.some((d) => d.reason === 'add_constraint_noop_skipped')).toBe(false)
    expect(store.setGoalConstraints).toHaveBeenCalledTimes(1)
    const rows = (store.setGoalConstraints as ReturnType<typeof vi.fn>).mock.calls[0][0] as CEEGoalConstraint[]
    expect(rows).toHaveLength(1)
    expect(rows[0].value_frame).toBe('change_rel')
    expect(goalConstraintText(rows[0], [], { omitLabel: true })).toBe('no more than 10% above today')
  })

  it('RED: stored as an explicit "level", re-sent as change_rel → written', () => {
    const store = makeStore([{ ...LEVEL_ROW, value_frame: 'level' } as CEEGoalConstraint])
    applyV5State(baseResponse({ blocks: [constraintPatch({ ...LEVEL_ROW, value_frame: 'change_rel' }, 'fac_cost')] }), store)
    expect(stored(store).value_frame).toBe('change_rel')
  })

  it('⛔ CONTRAST: the exact echo (same ID, same frame) is still a no-op — zero writes', () => {
    const store = makeStore([{ ...LEVEL_ROW, value_frame: 'change_rel' } as CEEGoalConstraint])
    const result = applyV5State(baseResponse({ blocks: [constraintPatch({ ...LEVEL_ROW, value_frame: 'change_rel' }, 'fac_cost')] }), store)
    expect(store.setGoalConstraints).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === 'add_constraint_noop_skipped')).toBe(true)
  })

  it('⛔ CONTRAST: absent and "level" are the same statement — a level echo is a no-op either way', () => {
    const store = makeStore([LEVEL_ROW])
    const result = applyV5State(baseResponse({ blocks: [constraintPatch({ ...LEVEL_ROW, value_frame: 'level' }, 'fac_cost')] }), store)
    expect(store.setGoalConstraints).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === 'add_constraint_noop_skipped')).toBe(true)
  })
})

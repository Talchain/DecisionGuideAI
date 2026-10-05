/**
 * "No measurable success target is set" over a goal set to "at most 400" (red team #87 6003539060): the results
 * hook's EXISTENCE answer read only the node and the store scalar, and CEE stores "at most 400" ONLY as the goal's own
 * `<=` limit row. It now counts that row (CEE's rule, `goalOwnLimitRow`), before a run and after one.
 * Real hook, real store; the served shapes (CEE rt10b goal node; the red team's Confirm-turn row, verbatim).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { buildStrengthenInputsForAnalysisNew } from '../analysisNew/buildStrengthenInputsForAnalysisNew'
import { buildRecommendations } from '../strengthen/buildRecommendations'
import { useCanvasStore } from '../../../canvas/store'
import { resetPaulRun, seedPaulRun } from './helpers/paulRun4276f3f9'

const GOAL_ID = 'monthly_cancellations'
const GOAL_NODE = {
  id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 },
  data: { label: 'monthly cancellations', kind: 'goal', goal_direction: '<=', goal_threshold_unit: 'cancellations/month', goal_threshold_frame: 'level' },
}
const SERVED_ROW = {
  constraint_id: 'gc-111d4aa6-6f70-4de4-a1af-4a8cdb35723a', node_id: GOAL_ID, operator: '<=', value: 400,
  label: 'monthly cancellations', unit: 'cancellations/month', provenance: 'explicit', value_frame: 'level',
}
const NO_TARGET = 'No measurable success target is set.'

const data = () => renderHook(() => useResultsSectionData()).result.current
const signals = () => buildRecommendations(buildStrengthenInputsForAnalysisNew({
  data: data(), guidanceItems: [], biasSignals: [], currentStage: 'evaluate', analysisIdentityIsCurrent: true,
} as never)).map((r) => r.signal)

afterEach(() => {
  resetPaulRun()
  useCanvasStore.setState({ nodes: [], goalConstraints: null, goalThreshold: null, ceeAnalysisReady: null, hasCompletedFirstRun: false } as never)
})

describe('before a run', () => {
  const seed = (goalConstraints: unknown) => useCanvasStore.setState({
    nodes: [GOAL_NODE], goalConstraints, goalThreshold: null, ceeAnalysisReady: null,
    hasCompletedFirstRun: false, results: { status: 'idle', report: null },
  } as never)
  it('PRECONDITION (the served defect): the node alone → no stated target, and the card says so', () => {
    seed(null)
    expect(data().recommendation.hasGoalTarget).toBe(false)
    expect(signals()).toContain(NO_TARGET)
  })
  it('⭐ the goal\'s own "at most 400" row → a stated target, and the card is gone', () => {
    seed([SERVED_ROW])
    expect(data().recommendation.hasGoalTarget).toBe(true)
    expect(signals()).not.toContain(NO_TARGET)
  })
  it('CONTROL — a deadline row on the goal, or another node\'s limit: still none', () => {
    seed([{ ...SERVED_ROW, deadline_metadata: { as_stated: 'within 6 months' } }, { ...SERVED_ROW, node_id: 'pause_instead_of_cancel_availability' }])
    expect(data().recommendation.hasGoalTarget).toBe(false)
  })
})

describe('after a run (Paul\'s served Run 4276f3f9, its goal given a ceiling row)', () => {
  const PAUL_GOAL = 'securing_funding'
  const seed = (goalConstraints: unknown) => {
    seedPaulRun({ permitted: true })
    useCanvasStore.setState({ goalConstraints, goalThreshold: null, ceeAnalysisReady: null } as never)
  }
  it('PRECONDITION (the served defect, after Rerun): without the row, the completed run\'s card says no target', () => {
    seed(null)
    expect(data().recommendation.analysisStatus).toBe('computed')
    expect(data().recommendation.hasGoalTarget).not.toBe(true)
    expect(signals()).toContain(NO_TARGET)
  })
  it('⭐ the goal\'s own `<=` row → a stated target on the completed run, and the card is gone', () => {
    seed([{ ...SERVED_ROW, node_id: PAUL_GOAL }])
    expect(data().recommendation.hasGoalTarget).toBe(true)
    expect(signals()).not.toContain(NO_TARGET)
  })
})

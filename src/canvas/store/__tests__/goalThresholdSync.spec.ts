/**
 * CEE → store goal-threshold sync unit contract.
 *
 * store.goalThreshold holds USER UNITS (the goal_threshold_raw scale):
 * threshold editors write raw values and every display consumer (Results
 * target line, goal badge, inspector) reads raw. The CEE sync must therefore
 * prefer goal_threshold_raw over the normalised 0-1 goal_threshold —
 * syncing the normalised value painted the Results target at "80%" when the
 * real target was 20% (staging trust review).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'

function analysisReady(extra: Record<string, unknown>): CEEAnalysisReady {
  return {
    goal_node_id: 'goal_node',
    options: [
      { id: 'option_a', label: 'Option A', status: 'ready', interventions: {} },
    ],
    ...extra,
  } as CEEAnalysisReady
}

describe('Canvas Store – setCeeAnalysisReady goal-threshold sync (unit contract)', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset()
    useCanvasStore.setState({ goalThreshold: null })
  })

  it('prefers goal_threshold_raw (user units) over normalised goal_threshold', () => {
    useCanvasStore.getState().setCeeAnalysisReady(
      analysisReady({ goal_threshold: 0.8, goal_threshold_raw: 20, goal_threshold_cap: 25 }),
    )
    expect(useCanvasStore.getState().goalThreshold).toBe(20)
  })

  it('falls back to goal_threshold when raw is absent (raw ≡ normalised without a cap)', () => {
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold: 0.8 }))
    expect(useCanvasStore.getState().goalThreshold).toBe(0.8)
  })

  it('never overwrites a non-null (user-set) threshold', () => {
    useCanvasStore.setState({ goalThreshold: 15 })
    useCanvasStore.getState().setCeeAnalysisReady(
      analysisReady({ goal_threshold: 0.8, goal_threshold_raw: 20 }),
    )
    expect(useCanvasStore.getState().goalThreshold).toBe(15)
  })

  it('syncs nothing when CEE provides no threshold fields', () => {
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({}))
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
  })
})

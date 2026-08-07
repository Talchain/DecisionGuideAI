/**
 * Codex P1-2 — a goal-scale-cap edit must stale the analysis.
 *
 * `goal_threshold_cap` participates in the normalised threshold the run request
 * carries (resolveGoalThresholdCap → resolveChipGoalThreshold, UI-SEM-058:
 * normalised = raw / cap). But the registry marked it persist-only, so a
 * GoalAdvancedEditor "Scale cap" edit (setGoalCap → updateNode(goal_threshold_cap))
 * left analysisFreshnessDirty=false WHILE CHANGING THE MATH — the UI kept saying
 * "fresh" over a stale result. Repro: raw 20, cap 25→100 flips the implied
 * threshold 0.8→0.2.
 *
 * Codex P1-2 gives `goal_threshold_cap` the `stale` purpose so the edit routes
 * through hasAnalyticalNodeChange → invalidateAnalysisReady → markAnalysisFreshnessDirty.
 *
 * RED before the fix: goal_threshold_cap ∉ STALE_NODE_FIELDS, so the cap-only
 * updateNode is a no-op for staleness and analysisFreshnessDirty stays false.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { resolveChipGoalThreshold } from '../useV2Run'

const GOAL_ID = 'goal-1'

function seedGoalWithCap(cap: number) {
  useCanvasStore.getState().reset()
  useCanvasStore.setState({
    outcomeNodeId: GOAL_ID,
    analysisFreshnessDirty: false,
    nodes: [
      {
        id: GOAL_ID,
        type: 'goal',
        position: { x: 0, y: 0 },
        data: {
          kind: 'goal',
          label: 'Revenue',
          goal_threshold_raw: 20,
          goal_threshold_cap: cap,
        },
      },
    ] as any,
    edges: [] as any,
  })
}

describe('Codex P1-2 — goal_threshold_cap edit stales the analysis', () => {
  beforeEach(() => {
    seedGoalWithCap(25)
  })

  it('a cap-only edit flips analysisFreshnessDirty', () => {
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)

    // Exactly what GoalAdvancedEditor → setGoalCap performs.
    useCanvasStore.getState().updateNode(GOAL_ID, {
      data: { ...useCanvasStore.getState().nodes[0].data, goal_threshold_cap: 100 },
    } as any)

    // RED before the fix: goal_threshold_cap was persist-only, so this stayed false.
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('the new cap changes the normalised threshold the next run would carry (0.8 → 0.2)', () => {
    const nodesBefore = useCanvasStore.getState().nodes
    const before = resolveChipGoalThreshold(20, {
      analysisReady: null,
      nodes: nodesBefore,
      goalNodeId: GOAL_ID,
      representation: 'raw',
    })
    expect(before).toBeCloseTo(0.8, 5) // 20 / 25

    useCanvasStore.getState().updateNode(GOAL_ID, {
      data: { ...useCanvasStore.getState().nodes[0].data, goal_threshold_cap: 100 },
    } as any)

    const after = resolveChipGoalThreshold(20, {
      analysisReady: null,
      nodes: useCanvasStore.getState().nodes,
      goalNodeId: GOAL_ID,
      representation: 'raw',
    })
    expect(after).toBeCloseTo(0.2, 5) // 20 / 100
  })
})

/**
 * ⛔ AIQ 5902450527 (ruling 5901136155): ISL's `GOAL_DIRECTION_UNATTESTED` renders "the model does not say which way
 * your goal should go" on every run. On a goal that HOLDS `>=` (MRR: "grow MRR to £25,000") that is false, so the
 * entry is omitted there; a `<=` goal (cut-costs), a negative change or an absent comparator keep it.
 * Corpus: the producer's own warnings from Paul's run `95b92672` (dated evidence, not authored here).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../../canvas/store'
import { useResultsSectionData } from '../useResultsSectionData'
import { goalDirectionWarningIsMoot } from '../../../canvas/domain/goalTarget'
import { INFERENCE_WARNINGS_95B92672 } from '../utils/__fixtures__/inferenceWarnings.95b92672'

const MRR_GOAL = { label: 'MRR', goal_threshold_raw: 25000, goal_threshold_unit: '£/month', goal_threshold_frame: 'level', goal_direction: '>=' }
const CUT_COSTS_GOAL = { label: 'Costs', goal_threshold_raw: -0.2, goal_threshold_unit: '£/month', goal_threshold_frame: 'change_rel', goal_direction: '<=' }

function codesWith(goalData: Record<string, unknown>): string[] {
  useCanvasStore.setState({
    nodes: [{ id: 'goal', type: 'goal', position: { x: 0, y: 0 }, data: goalData }],
    edges: [],
    results: { status: 'complete', progress: 100, report: { inference_warnings: INFERENCE_WARNINGS_95B92672 }, hash: 'h' },
    hasCompletedFirstRun: true,
  } as never)
  const { result } = renderHook(() => useResultsSectionData())
  return (result.current.confidence.inferenceWarnings ?? []).map((w: { code: string }) => w.code)
}

describe('GOAL_DIRECTION_UNATTESTED on a goal that holds its direction', () => {
  beforeEach(() => { useCanvasStore.setState({ nodes: [], edges: [] } as never) })

  it('POSITIVE CONTROL: the real corpus carries the code', () => {
    expect(INFERENCE_WARNINGS_95B92672.some((w) => w.code === 'GOAL_DIRECTION_UNATTESTED')).toBe(true)
  })

  it('RED: a held `>=` goal (MRR) never shows it; every other warning is kept', () => {
    const codes = codesWith(MRR_GOAL)
    expect(codes).not.toContain('GOAL_DIRECTION_UNATTESTED')
    expect(codes.length).toBe(INFERENCE_WARNINGS_95B92672.length - 1)
  })

  it('CONTROL: a held `<=` goal (cut-costs) keeps it', () => {
    expect(codesWith(CUT_COSTS_GOAL)).toContain('GOAL_DIRECTION_UNATTESTED')
  })

  it('the predicate: only `>=`/`>` that is not a negative or unreadable change', () => {
    expect(goalDirectionWarningIsMoot(MRR_GOAL)).toBe(true)
    expect(goalDirectionWarningIsMoot({ ...MRR_GOAL, goal_direction: '>' })).toBe(true)
    expect(goalDirectionWarningIsMoot({ ...MRR_GOAL, goal_threshold_frame: 'change_rel', goal_threshold_raw: 0.2 })).toBe(true)
    expect(goalDirectionWarningIsMoot(CUT_COSTS_GOAL)).toBe(false)
    expect(goalDirectionWarningIsMoot({ ...CUT_COSTS_GOAL, goal_direction: '>=' })).toBe(false) // a negative change
    expect(goalDirectionWarningIsMoot({ ...MRR_GOAL, goal_threshold_frame: 'change_abs', goal_threshold_raw: '5k' })).toBe(false)
    expect(goalDirectionWarningIsMoot({ ...MRR_GOAL, goal_direction: undefined })).toBe(false)
    expect(goalDirectionWarningIsMoot({ ...MRR_GOAL, goal_direction: 'maximise' })).toBe(false)
    expect(goalDirectionWarningIsMoot(null)).toBe(false)
  })
})

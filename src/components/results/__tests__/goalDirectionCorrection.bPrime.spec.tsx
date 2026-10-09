import served from '../analysis-hero/__tests__/fixtures/served-7ad369b7-pricing-drivers-accordion.json'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
/**
 * ⭐ B′ (5 Oct; RT-10, Science 5999608477 + 6000086883; DL github-e8): `GOAL_DIRECTION_UNATTESTED` says the assumption
 * in this model, as CEE's Run line does, and offers CEE's correction ("set the goal's target to 'at most' and re-run")
 * ONLY where the goal's target line can make it: no target, or a level target in a frame this UI reads. A change target
 * is not edited by the target line (CEE refuses `goal_is_a_change`), so it, an unread frame and a code-only call keep
 * the copy that prescribes nothing.
 * Corpus: the producer's own warnings from Paul's run `95b92672` (dated evidence, not authored here).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../../canvas/store'
import { useResultsSectionData } from '../useResultsSectionData'
import { goalDirectionCorrectableByTarget } from '../../../canvas/domain/goalTarget'
import { INFERENCE_WARNINGS_95B92672 } from '../utils/__fixtures__/inferenceWarnings.95b92672'
import { humaniseCritique, GOAL_DIRECTION_UNATTESTED_TITLE, GOAL_DIRECTION_CORRECTABLE_TITLE } from '../utils/humaniseCritique'
import { humaniseInferenceWarningTitle } from '../utils/humaniseInferenceWarning'

import { InferenceWarningStrip } from '../InferenceWarningStrip'
import { critiqueRunContext } from '../utils/critiqueRunContext'

const CODE = 'GOAL_DIRECTION_UNATTESTED'
/** A level target with no held comparator: the case B′ corrects (CEE sends no direction, ISL ranks by largest). */
const LEVEL_GOAL = { label: 'Monthly cancellations', goal_threshold_raw: 400, goal_threshold_unit: 'cancellations/month', goal_threshold_frame: 'level' }
const NO_TARGET_GOAL = { label: 'Monthly cancellations' }
const CHANGE_GOAL = { label: 'Costs', goal_threshold_raw: -0.2, goal_threshold_unit: '£/month', goal_threshold_frame: 'change_rel', goal_direction: '<=' }

function rowWith(goalData: Record<string, unknown>) {
  useCanvasStore.setState({
    nodes: [{ id: 'goal', type: 'goal', position: { x: 0, y: 0 }, data: goalData }],
    edges: [],
    results: { status: 'complete', progress: 100, report: { inference_warnings: INFERENCE_WARNINGS_95B92672 }, hash: 'h' },
    hasCompletedFirstRun: true,
  } as never)
  const { result } = renderHook(() => useResultsSectionData())
  return (result.current.confidence.inferenceWarnings ?? []).find((w: { code: string }) => w.code === CODE)
}

describe('the exact words, both arms', () => {
  it('default (no correction): the assumption in this model, both facts ISL states, nothing prescribed', () => {
    expect(GOAL_DIRECTION_UNATTESTED_TITLE).toBe(
      'In this model I’ve assumed a higher value is better for your goal, so the options were ordered by which one produces the largest value. If you want it lower, or held at a particular level, that ordering answers a different question.',
    )
    expect(humaniseCritique({ code: CODE, message: '' }).title).toBe(GOAL_DIRECTION_UNATTESTED_TITLE)
  })

  it('correctable: the same assumption, then CEE’s correction verbatim', () => {
    expect(GOAL_DIRECTION_CORRECTABLE_TITLE).toBe(
      'In this model I’ve assumed a higher value is better for your goal, so the options were ordered by which one produces the largest value. If lower is better, set the goal’s target to ‘at most’ and re-run.',
    )
    const h = humaniseCritique({ code: CODE, message: '', goalDirectionCorrectable: true })
    expect(h.title).toBe(GOAL_DIRECTION_CORRECTABLE_TITLE)
    expect(h.displayText).toBe(GOAL_DIRECTION_CORRECTABLE_TITLE)
  })

  it('scan: every arm names the comparison only in this model, and only the correctable arm prescribes', () => {
    for (const title of [GOAL_DIRECTION_UNATTESTED_TITLE, GOAL_DIRECTION_CORRECTABLE_TITLE]) {
      expect(title.startsWith('In this model ')).toBe(true)
      expect(title).not.toMatch(/[‒-―]/)
    }
    expect(GOAL_DIRECTION_UNATTESTED_TITLE).not.toMatch(/at most/)
    expect(GOAL_DIRECTION_CORRECTABLE_TITLE).toMatch(/‘at most’ and re-run\.$/)
  })

  it('the flag is the ONLY switch: another code carrying it is unchanged (control)', () => {
    const other = INFERENCE_WARNINGS_95B92672.find((w) => w.code !== CODE)!
    expect(humaniseCritique({ code: other.code, message: '', goalDirectionCorrectable: true }).title)
      .toBe(humaniseCritique({ code: other.code, message: '' }).title)
  })
})

describe('the carrier: adapter row → strip title', () => {
  beforeEach(() => { useCanvasStore.setState({ nodes: [], edges: [] } as never) })

  it('RED: a level target marks the row correctable, and the strip says the correction', () => {
    const row = rowWith(LEVEL_GOAL)
    expect(row?.goal_direction_correctable).toBe(true)
    expect(humaniseInferenceWarningTitle(row!)).toBe(GOAL_DIRECTION_CORRECTABLE_TITLE)
  })

  it('RED: a goal with no target is correctable too (the target line sets one)', () => {
    expect(rowWith(NO_TARGET_GOAL)?.goal_direction_correctable).toBe(true)
  })

  it('CONTROL: a change target keeps the row, unmarked, and the strip prescribes nothing', () => {
    const row = rowWith(CHANGE_GOAL)
    expect(row).toBeDefined()
    expect(row?.goal_direction_correctable).toBeUndefined()
    expect(humaniseInferenceWarningTitle(row!)).toBe(GOAL_DIRECTION_UNATTESTED_TITLE)
  })

  it('no other warning row is marked', () => {
    useCanvasStore.setState({ nodes: [], edges: [] } as never)
    rowWith(LEVEL_GOAL)
    const { result } = renderHook(() => useResultsSectionData())
    const others = (result.current.confidence.inferenceWarnings ?? []).filter((w: { code: string }) => w.code !== CODE)
    expect(others.length).toBeGreaterThan(0)
    for (const w of others) expect(w.goal_direction_correctable).toBeUndefined()
  })
})

describe('goalDirectionCorrectableByTarget agrees with the target line’s own `changeGoal`', () => {
  it.each([
    ['a level target', LEVEL_GOAL, true],
    ['no target', NO_TARGET_GOAL, true],
    ['the legacy delta frame (read as a level)', { ...LEVEL_GOAL, goal_threshold_frame: 'delta' }, true],
    ['a relative change', CHANGE_GOAL, false],
    ['an absolute change', { ...LEVEL_GOAL, goal_threshold_frame: 'change_abs', goal_threshold_raw: -50 }, false],
    ['an unread frame', { ...LEVEL_GOAL, goal_threshold_frame: 'per_head' }, false],
    ['no goal', null, false],
  ] as const)('%s → %s', (_name, goal, expected) => {
    expect(goalDirectionCorrectableByTarget(goal as never)).toBe(expected)
  })
})

describe('D1 run ranking context', () => {
  const report = mapV5AnalysisToReport(served.analysis_result as never)
  const unranked = { ...report, producer_leader_permission: { permitted: false } }
  const ranked = { ...report, option_probabilities: Object.fromEntries(Object.entries(report.option_probabilities ?? {}).slice(0, 1)) }
  it('D1-a all unranked: title, displayText and description contain no ordering claim', () => {
    for (const goalDirectionCorrectable of [false, true]) {
      const copy = humaniseCritique({ code: CODE, message: '', goalDirectionCorrectable }, undefined, critiqueRunContext(unranked))
      for (const text of [copy.title, copy.displayText, copy.description]) {
        expect(text).not.toMatch(/ordered|largest value|different question|scored highest/i)
      }
      expect(copy.title).toBe(goalDirectionCorrectable
        ? 'In this model I’ve assumed a higher value is better for your goal. If lower is better, set the goal’s target to ‘at most’ and re-run.'
        : 'In this model I’ve assumed a higher value is better for your goal.')
    }
  })
  it('D1-b one ranked: exact existing constants', () => {
    for (const goalDirectionCorrectable of [false, true]) {
      const copy = humaniseCritique({ code: CODE, message: '', goalDirectionCorrectable }, undefined, critiqueRunContext(ranked))
      expect(copy.title).toBe(goalDirectionCorrectable ? GOAL_DIRECTION_CORRECTABLE_TITLE : GOAL_DIRECTION_UNATTESTED_TITLE)
      expect(copy.displayText).toBe(copy.title)
    }
  })
  it('D1-c mounted strip: all-unranked run uses the unranked words', () => {
    rowWith(NO_TARGET_GOAL)
    render(<InferenceWarningStrip warnings={[{ ...INFERENCE_WARNINGS_95B92672.find(w => w.code === CODE)!, severity: 'warning', affected_nodes: [] }]} heldBackListedUnder={null} />)
    const entry = screen.getByTestId('inference-warning-strip-entry')
    expect(entry).toHaveAttribute('data-warning-code', CODE)
    expect(screen.getByTestId('inference-warning-strip-entry-text').textContent).toBe('In this model I’ve assumed a higher value is better for your goal.')
  })
})

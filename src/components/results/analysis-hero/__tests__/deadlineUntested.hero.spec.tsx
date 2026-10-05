/**
 * THE DEADLINE THE RUN DID NOT TEST — the hero says it, in CEE's words (DL 0df0e1, beat 2).
 *
 * The PL's beat-2 wording separates "no option reaches the target" from "the nine-month deadline is untested". On
 * journey 4 (served, 4 Oct) the second was said only in chat: CEE's host line A7, "This model doesn't yet say whether
 * any option gets there within 9 months." The Run now carries it as a typed inference warning,
 * `GOAL_HORIZON_NOT_TESTED`, and the hero shows that warning's sentence beside its goal-fit statement.
 *
 * Bound by IDENTITY: the warning is matched by its code and the sentence compared with `toBe`, so a different code
 * carrying the same words, or the same code with other words, cannot pass. The UI decides nothing about the deadline.
 *
 * Scope (trap 3): a built model plus a jsdom render of the panel. Wording, presence and absence; not layout.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { buildHeroModel, readGoalHorizonUntested } from '../buildHeroModel'
import { GOAL_HORIZON_NOT_TESTED_CODE } from '../../utils/humaniseInferenceWarning'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData } from '../__fixtures__/hero.fixtures'
import type { InferenceWarning } from '../../types'
import { humaniseInferenceWarning } from '../../utils/humaniseInferenceWarning'

/** CEE's sentence, verbatim from journey 4's served chat (05-olumi, wire/16), now carried on the Run. */
const A7_9 = 'This model doesn\'t yet say whether any option gets there within 9 months.'
const TESTID = 'hero-goal-horizon-untested'
const PANEL_PROPS = { rerunDisabled: false, focusPanelMounted: false } as const

const horizonWarning = (message = A7_9): InferenceWarning =>
  ({ code: GOAL_HORIZON_NOT_TESTED_CODE, severity: 'info', message, affected_nodes: ['goal'] }) as InferenceWarning

const dataWith = (inferenceWarnings: InferenceWarning[] | undefined) => {
  const data = makeHeroData()
  return { ...data, confidence: { ...data.confidence, inferenceWarnings } }
}
const chart = (inferenceWarnings: InferenceWarning[] | undefined): HeroChartModel => {
  const model = buildHeroModel(dataWith(inferenceWarnings))
  if (model.kind !== 'chart') throw new Error(`precondition: a chart hero, got ${model.kind}`)
  return model
}
const shown = (model: HeroChartModel) =>
  render(<AnalysisHeroPanel model={model} {...PANEL_PROPS} />).queryByTestId(TESTID)?.textContent ?? null

describe('the hero says the deadline is untested, in CEE\'s words', () => {
  it('RED: a Run carrying GOAL_HORIZON_NOT_TESTED shows its sentence, exactly', () => {
    const model = chart([horizonWarning()])
    expect(model.goalHorizonUntested).toBe(A7_9)
    expect(shown(model)).toBe(A7_9)
  })

  it('RED: it is found among the Run\'s other warnings, by code, and only its own words are shown', () => {
    const model = chart([
      { code: 'GOAL_FIGURES_TARGET_NOT_TESTABLE', severity: 'warning', message: 'Not shown. Olumi can compare your options, but can\'t yet test them against your target.', affected_nodes: [] } as InferenceWarning,
      horizonWarning(),
    ])
    expect(shown(model)).toBe(A7_9)
  })

  it('CONTROL: no such warning → no line (the same fixture otherwise)', () => {
    expect(chart(undefined).goalHorizonUntested).toBeNull()
    expect(shown(chart([]))).toBeNull()
  })

  it('CONTROL: the same words under another code → no line (bound by code, never by wording)', () => {
    const model = chart([{ ...horizonWarning(), code: 'SOME_OTHER_CODE' }])
    expect(shown(model)).toBeNull()
  })

  it('RED: the lists that humanise warnings by code say what it is, never the unmapped fallback', () => {
    // "Advanced and receipts", "Sources and limits" and the Model tab's audit humanise every warning by code. Unmapped,
    // this one read "Part of this analysis was limited … a condition this version has no wording for yet".
    const h = humaniseInferenceWarning({ code: GOAL_HORIZON_NOT_TESTED_CODE, message: A7_9, severity: 'info' })
    expect(h.title).toBe('Your deadline isn\'t tested')
    expect(humaniseInferenceWarning({ code: 'SOME_UNMAPPED_CODE', message: A7_9, severity: 'info' }).title)
      .toBe('Part of this analysis was limited')
  })

  it('fails closed on words that are missing, blank or not display-safe', () => {
    expect(readGoalHorizonUntested([{ code: GOAL_HORIZON_NOT_TESTED_CODE }])).toBeNull()
    expect(readGoalHorizonUntested([{ code: GOAL_HORIZON_NOT_TESTED_CODE, message: '   ' }])).toBeNull()
    expect(readGoalHorizonUntested([{ code: GOAL_HORIZON_NOT_TESTED_CODE, message: 'goal_horizon_months is 9' }])).toBeNull()
    expect(readGoalHorizonUntested([{ code: GOAL_HORIZON_NOT_TESTED_CODE, message: `  ${A7_9}  ` }])).toBe(A7_9)
  })
})

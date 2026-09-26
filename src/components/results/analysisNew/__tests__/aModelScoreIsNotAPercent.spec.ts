/**
 * ⛔ A NORMALISED OUTCOME IS A MODEL SCORE — NO `%`, NO `+` (AI Quality,
 * #70 5841808930, 26 Sep 2026).
 *
 * On a normalised run the view model's outcome claim read "…has the highest
 * expected outcome: +13%." — a unit and a direction the origin-form score does
 * not have. It now prints the score as the comparison axis does, and names it.
 * CONTRAST: a run with a real unit keeps `formatThreshold`'s figure.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { formatModelScore, MODEL_SCORE_COPY } from '../modelScore'
import { formatThreshold } from '../../RangeVisualization'
import type { DecisionResultData } from '../../types'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { makeData, makeOption } from './analysisNewFixtures'

const ENTITLED = {
  verdict: { leaderId: 'opt_a', hasLeadingOption: true } as DecisionResultData['verdict'],
  leaderDesignationPermitted: true,
}
const ranged = (id: string, label: string, centre: number) =>
  makeOption({
    id,
    label,
    expected: centre,
    p10: centre - 0.05,
    p50: centre,
    p90: centre + 0.05,
    outcome: { mean: centre, p10: centre - 0.05, p50: centre, p90: centre + 0.05 },
    nValidSamples: 2000,
  })
const run = (
  isNormalised: boolean,
  unit?: { outcomeUnit: 'currency'; outcomeUnitSymbol: string },
  [a, b]: [number, number] = [0.136, 0.126],
): ResultsSectionDataReturn =>
  makeData({
    recommendation: {
      allOptions: [ranged('opt_a', 'Raise price', a), ranged('opt_b', 'Keep price', b)],
      recommendedOption: ranged('opt_a', 'Raise price', a),
      isNormalised,
      ...(unit ?? {}),
      ...ENTITLED,
    },
  })
const outcomeSentence = (data: ResultsSectionDataReturn): string | null => {
  const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
  const imp = (vm as unknown as { modelImplication?: { outcome?: { sentence?: string } } }).modelImplication
  return imp?.outcome?.sentence ?? null
}

describe('a model score is not a percent', () => {
  it('⭐ a normalised run: the outcome claim prints the score with no % and no +, and says it is a model score', () => {
    const s = outcomeSentence(run(true))
    expect(s, 'PRECONDITION: the entitled run makes an outcome claim').not.toBeNull()
    expect(s!).toContain(MODEL_SCORE_COPY.readout(0.136))
    expect(s!).toContain(formatModelScore(0.136))
    expect(s!).not.toMatch(/%/)
    expect(s!).not.toMatch(/:\s*\+/)
  })

  it('CONTRAST: a run with a real unit keeps formatThreshold\'s figure', () => {
    // Real-unit magnitudes: at 0.136 both options would render "£0" and the
    // render-tie rule (UI-SEM-070) would withhold the claim.
    const s = outcomeSentence(run(false, { outcomeUnit: 'currency', outcomeUnitSymbol: '£' }, [1360, 1260]))
    expect(s, 'PRECONDITION').not.toBeNull()
    expect(s!).toContain(formatThreshold(1360, 'currency', '£', false))
    expect(s!).not.toContain('model score')
  })
})

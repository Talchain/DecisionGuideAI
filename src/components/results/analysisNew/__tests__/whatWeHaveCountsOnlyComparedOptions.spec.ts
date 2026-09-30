/**
 * "What we have" counts only the options the run COMPARED (served, 30 Sep 2026).
 *
 * Paul's funding brief on served staging `7bfe1b04`: the run left
 * "Fundraising Advisor Support" out (`not_analysed`, "The analysis returned no
 * result for this option"). The Analysis tab said "Comparing 2 of 3 options";
 * the Reasoning tab's first commitment bullet said "3 options compared." Two
 * tabs, one run, two counts, and the Reasoning one was false.
 *
 * The bullet counted `optionsComparison.rows.length`, and `rows` holds EVERY
 * option the user has, including the `not_analysed` rows the chart lists with a
 * "Not analysed" badge. "Compared" is a claim about the run, so it counts only
 * rows the run compared (`kind !== 'not_analysed'`), and says "N of M" when the
 * two differ. The row kind is the producer's own omission, typed upstream
 * (`deriveNotAnalysedReason`); nothing is re-derived here.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildCommitmentSynthesis, COMMITMENT_COPY } from '../commitmentSynthesis'
import { makeData, makeOption } from './analysisNewFixtures'
import type { DecisionResultData } from '../../types'

const WITHHELD = {
  verdict: { leaderId: 'opt_a', hasLeadingOption: false } as DecisionResultData['verdict'],
  leaderDesignationPermitted: false,
}

function option(id: string, label: string, centre: number) {
  return makeOption({
    id,
    label,
    expected: centre,
    p10: centre - 10,
    p50: centre,
    p90: centre + 10,
    outcome: { mean: centre, p10: centre - 10, p50: centre, p90: centre + 10 },
    nValidSamples: 2000,
  })
}

function vmFor(leftOut: boolean) {
  const a = option('opt_a', 'Investment Firm Outreach', 120)
  const b = option('opt_b', 'Angel Bridge Outreach', 60)
  const c = leftOut
    ? makeOption({ id: 'opt_c', label: 'Fundraising Advisor Support', notAnalysed: true, notAnalysedReason: 'not_returned' })
    : option('opt_c', 'Fundraising Advisor Support', 90)
  return buildAnalysisNewViewModel({
    data: makeData({ recommendation: { allOptions: [a, b, c], recommendedOption: a, ...WITHHELD } }),
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })
}

describe('"What we have" counts only the options the run compared', () => {
  it('one option left out of the run → "2 of 3 options compared.", never "3 options compared."', () => {
    const vm = vmFor(true)
    const kinds = vm.optionsComparison.rows.map((r) => `${r.id}:${r.kind}`)
    expect(kinds, 'PRECONDITION: the chart lists all three, one of them not analysed').toEqual([
      'opt_a:analysed',
      'opt_b:analysed',
      'opt_c:not_analysed',
    ])
    const founded = buildCommitmentSynthesis(vm).founded
    expect(founded?.source).toBe('withheld_count')
    expect(founded?.text).toBe(COMMITMENT_COPY.withheldFoundedOf(2, 3))
    expect(founded?.text).toBe('2 of 3 options compared.')
  })

  it('CONTRAST: every option compared → the plain count, unchanged', () => {
    const vm = vmFor(false)
    expect(vm.optionsComparison.rows.every((r) => r.kind === 'analysed'), 'PRECONDITION').toBe(true)
    expect(buildCommitmentSynthesis(vm).founded?.text).toBe('3 options compared.')
  })
})

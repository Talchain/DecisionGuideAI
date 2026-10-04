/**
 * BEAT 2 — a Run whose ranking was withheld does not presuppose a leader.
 *
 * Two Reasoning-tab sentences stated or presupposed an order without asking the
 * leader licence, while their neighbours in the same builders did ask
 * (`insight:hinge`, the glance headline, tipping):
 *   1. the conditional-winner insight: "which option leads depends on X" /
 *      "Above S, A scores higher; below it, B does";
 *   2. the threshold row headline: "X could change which option leads".
 * Each now asks `rankingWasWithheld` (the hinge's predicate). Every row below is
 * paired: the SAME producer rows on the licensed decision (`genuineDecision`) and
 * on its withheld twin (`decisionWithLeaderWithheld`, which differs in the two
 * licence fields only), so a gate that dropped everything, or nothing, fails one
 * side of each pair.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { decisionWithLeaderWithheld, genuineDecision, uncertaintyDerivedFindings } from './analysisNewFixtures'
import type { ConditionalWinner, UncertaintyItem } from '../../types'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const build = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })

const withConfidence = (base: ResultsSectionDataReturn, confidence: Partial<ResultsSectionDataReturn['confidence']>) =>
  ({ ...base, confidence: { ...base.confidence, ...confidence } }) as ResultsSectionDataReturn

const SPLIT: ConditionalWinner = {
  factor_id: 'f_elasticity',
  factor_label: 'Price elasticity',
  split_value: 10,
  winner_flips: true,
  high_bucket: { winner_label: 'Raise price' },
  low_bucket: { winner_label: 'Hold price' },
}

const THRESHOLD_ROW: UncertaintyItem = {
  code: 'SENSITIVE_ASSUMPTION',
  message: 'If "Price elasticity → Revenue" changes significantly, "Hold price" could become the better choice',
  displayText: 'If "Price elasticity → Revenue" changes significantly, "Hold price" could become the better choice',
  affectedNodes: ['f_elasticity'],
  threshold: { variable: 'Price elasticity', direction: 'negative', value: 0.42 },
} as UncertaintyItem

describe('a withheld ranking presupposes no leader (beat 2)', () => {
  it('the conditional-winner insight is stated on a licensed Run and absent on its withheld twin', () => {
    const ids = (base: ResultsSectionDataReturn) =>
      build(withConfidence(base, { conditionalWinners: [SPLIT] })).keyInsights.insights.map((i) => i.id)
    expect(ids(genuineDecision())).toContain('insight:conditional-winner:f_elasticity')
    expect(ids(decisionWithLeaderWithheld())).not.toContain('insight:conditional-winner:f_elasticity')
  })

  it('the threshold row names no leader on a withheld Run, and keeps its licensed wording otherwise', () => {
    const headline = (base: ResultsSectionDataReturn) => {
      const rows = uncertaintyDerivedFindings(
        build(withConfidence(base, { evidenceGapsAssessed: true, uncertainties: [THRESHOLD_ROW] })),
      )
      return rows.find((r) => r.headline.startsWith('Price elasticity could change'))?.headline
    }
    expect(headline(genuineDecision())).toBe('Price elasticity could change which option leads in this model')
    expect(headline(decisionWithLeaderWithheld())).toBe('Price elasticity could change the answer in this model')
  })
})

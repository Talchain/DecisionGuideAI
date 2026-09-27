/**
 * Served fresh guest (UI c2840e1a, 27 Sep): a permitted run at rest showed
 * only "Before acting". V2 `synthesisHTML()` always states what we have and
 * what is still open ("Four options compared…", "…lacks assessed evidence").
 */
import { describe, it, expect } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildCommitmentSynthesis } from '../commitmentSynthesis'
import { genuineDecision } from './analysisNewFixtures'

const base = buildAnalysisNewViewModel({
  data: genuineDecision() as never, recommendations: [], isPreRun: false, isRunning: false, isStale: false,
} as never)
const withChecks = (evidence: string) => ({
  ...base,
  modelImplication: { kind: 'none' },
  checks: { ...base.checks, leaderWithheld: false, items: base.checks.items.map((i) => (i.id === 'evidence' ? { ...i, code: evidence } : i.id === 'robustness' ? { ...i, code: 'robustness_high' } : i)) },
}) as never

describe('a permitted run at rest keeps "What we have" and "Still open"', () => {
  it('no reading → the option count', () => {
    const s = buildCommitmentSynthesis(withChecks('evidence_not_assessed'))
    expect(s.founded?.text).toMatch(/^\d+ options? compared\.$/)
  })

  it('evidence not assessed → said as still open', () => {
    expect(buildCommitmentSynthesis(withChecks('evidence_not_assessed')).open?.text)
      .toBe('The evidence behind the inputs has not been assessed.')
  })

  it('CONTRAST: evidence addressed → nothing invented for Still open', () => {
    expect(buildCommitmentSynthesis(withChecks('evidence_all_addressed')).open).toBeNull()
  })
})

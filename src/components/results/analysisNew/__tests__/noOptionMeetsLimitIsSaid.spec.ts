/**
 * F-LIMIT (DL 5850643426 tier 1, 5850672588 tier 2): CEE's per-option limit
 * verdicts are said plainly in "Still open"; neither fires "Goal only".
 * Tier-1 served negative control: panel/d1-capture-20260926/S9.
 */
import { describe, it, expect } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildCommitmentSynthesis } from '../commitmentSynthesis'
import { withheldLeaderCause } from '../analysisNewCopy'
import { decisionWithLeaderWithheld } from './analysisNewFixtures'

const vmFor = (reason: string) =>
  buildAnalysisNewViewModel({
    data: decisionWithLeaderWithheld() as never,
    producerLeaderWithholdReason: reason,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'limit-verdict',
  } as never)

const CASES = [
  ['no_option_meets_limit', 'On this run, no option meets one of your limits.'],
  ['every_option_likely_breaks_limit', 'On these estimates, every option is more likely than not to break one of your limits.'],
] as const

describe.each(CASES)('%s', (token, sentence) => {
  it('is said in "Still open", whatever the admission says', () => {
    expect(withheldLeaderCause(token, false)).toBe(sentence)
    expect(withheldLeaderCause(token, true)).toBe(sentence)
    expect(buildCommitmentSynthesis(vmFor(token)).open?.text).toBe(sentence)
  })

  it('does not fire "Goal only"', () => {
    expect(vmFor(token).checks.sharesExcludeLimits).toBe(false)
  })
})

it('tier 2 never says "meets"', () => {
  expect(CASES[1][1]).not.toMatch(/meets/i)
})

it('CONTRAST: the generic withhold keeps its own sentence and its "Goal only"', () => {
  const vm = vmFor('constraint_verdict_withheld')
  expect(vm.checks.leaderWithholdCause).not.toMatch(/one of your limits/)
  expect(vm.checks.sharesExcludeLimits).toBe(true)
})

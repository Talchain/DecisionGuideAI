/**
 * Canonical's intake cause `options_not_reconciled_with_brief` (#72 5886426614; DL 5886466744): the leader is
 * withheld because an option Olumi added cannot be reconciled to the brief. Served 29 Sep (Canvas 5886223069,
 * 4/4 Pro-price runs) this was published as `constraint_verdict_withheld` while every limit was `scored`, so the
 * surface said the checks declined. The true cause is said, and it is not a limit statement.
 */
import { it, expect } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildCommitmentSynthesis } from '../commitmentSynthesis'
import { withheldLeaderCause } from '../analysisNewCopy'
import { decisionWithLeaderWithheld } from './analysisNewFixtures'

const TOKEN = 'options_not_reconciled_with_brief'
/** AIQ #72 5886555442, without the ‹label› parenthetical until the carrier names the option ids. */
const SENTENCE = "Olumi added an option your brief didn't name, so this run doesn't put one forward. You can remove it and re-run."

const vmFor = (reason: string) =>
  buildAnalysisNewViewModel({
    data: decisionWithLeaderWithheld() as never,
    producerLeaderWithholdReason: reason,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'intake-unreconciled',
  } as never)

it('the intake cause is said in "Still open", whatever the admission says', () => {
  expect(withheldLeaderCause(TOKEN, false)).toBe(SENTENCE)
  expect(withheldLeaderCause(TOKEN, true)).toBe(SENTENCE)
  expect(buildCommitmentSynthesis(vmFor(TOKEN)).open?.text).toBe(SENTENCE)
})

it('it is not a limit statement, and it does not say the checks declined', () => {
  expect(SENTENCE).not.toMatch(/limit|check/i)
  expect(vmFor(TOKEN).checks.leaderWithholdCause).not.toMatch(/checks on this run do not support/)
})

it('CONTRAST: the generic withhold keeps its own sentence', () => {
  expect(vmFor('constraint_verdict_withheld').checks.leaderWithholdCause).not.toBe(SENTENCE)
})

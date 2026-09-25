/**
 * ⭐ THE WITHHELD LEADER IS NOT BLAMED ON LIMITS THE USER NEVER SET.
 *
 * Local integration witness (bundle 3 on #1978 plus #1983, CEE `c673223`,
 * OpenAI, hiring brief, 25 Sep 2026): on the automatic first run, "Move
 * towards commitment" said "Still open: The check against the limits you set
 * does not support putting one option forward." The user had set no limits
 * (the strip read "Target: None set", and the brief states none).
 *
 * CEE emits `constraint_verdict_withheld` whenever its claim-safety verdict is
 * not entitled, for any reason (`analysis-state-v1.ts` `composeLeaderClaim`:
 * `!entitled ? WITHHELD_CONSTRAINT_VERDICT`). On an automatic first run the
 * reason is the admission's own: every estimate is Olumi's
 * (`CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED`). The glance already states it
 * in the producer's words. The commitment block contradicted it.
 *
 * The rule: where the producer's admission refused the comparative leader
 * claim, the withheld cause names the estimates, not limits. The cause stays
 * nameable, so "a re-run would not help" still holds and no re-run is offered.
 *
 * ⭐ THE SECOND CASE (25 Sep 02:20Z, same build, Paul's PRICING brief, CEE
 * `e39f6e0`, OpenAI): one estimate is his own, so the admission PERMITTED a
 * leader (`CONFIDENCE_PARAMETERS_PARTLY_USER_STATED`), and the automatic first
 * pass still withheld it with the same token. "Still open" again said "the
 * limits you set" on a brief with none. An explicit Run on the same model then
 * PERMITTED the leader (02:37Z), so the withhold was the first-pass policy.
 *
 * The token's own sentence is now the one true of every cause it covers (the
 * constraint states, the fail-closed reads, the first-pass policy): "Olumi's
 * checks on this run…". No limits are named.
 *
 * ⛔ NOT GATED ON THE CANVAS `goalConstraints` SLICE. That was tried twice and
 * is wrong: the slice is readiness state (`READINESS_CLEAR_FIELDS`), nulled by
 * every analysis-affecting edit and every turn without `analysis_ready`, so on a
 * real limits model the sentence would vanish after an ordinary follow-up turn.
 *
 * CEE's own fix (Canonical, RC 5825756972) emits `unrequested_analysis_withheld`
 * for the first pass. It is unmapped here (no cause, so the retry stays), and
 * the admission override covers it where the admission refused.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { leaderWithholdCause, LEADER_WITHHELD_UNTIL_AN_ESTIMATE_IS_YOURS } from '../analysisNewCopy'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { decisionWithLeaderWithheld, decisionWithLeaderWithheldAndReason } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const REASON = 'constraint_verdict_withheld'
const LIMITS = 'limits you set'

const checksOf = (data: ResultsSectionDataReturn, reason: string = REASON) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'run_x',
    producerLeaderWithholdReason: reason,
  }).checks

const FIRST_PASS = 'unrequested_analysis_withheld'
const SEPARATION = 'separation_unavailable'

/** Paul's pricing run's admission, verbatim (CEE `e39f6e0`, 25 Sep 02:20Z): it PERMITS a leader. */
const CAPTURED_PRICING_ADMISSION = {
  structurally_analysable: true,
  missing_important_inputs: [],
  semantic_quality_sufficient: true,
  permitted_analysis_mode: 'comparative_leader',
  reasons: [
    { field: 'structurally_analysable', code: 'READY_TO_COMPARE', message: 'Analysis can run on this model as it stands.' },
    {
      field: 'semantic_quality_sufficient',
      code: 'CONFIDENCE_PARAMETERS_PARTLY_USER_STATED',
      message: 'At least one of the estimates this comparison rests on is yours, so a leading option can be named.',
    },
    {
      field: 'permitted_analysis_mode',
      code: 'CONFIDENCE_PARAMETERS_PARTLY_USER_STATED',
      message: 'At least one of the estimates this comparison rests on is yours, so a leading option can be named.',
    },
  ],
}

const pricingFirstPass = (): ResultsSectionDataReturn => {
  const data = decisionWithLeaderWithheld()
  return { ...data, recommendation: { ...data.recommendation, analysisAdmission: CAPTURED_PRICING_ADMISSION } } as ResultsSectionDataReturn
}

/**
 * The captured refusal with its `permitted_analysis_mode` reason re-coded. Only 2 of
 * the codes that reach that slot ask for an estimate (ESTIMATE_REMEDY_ADMISSION_CAUSES);
 * the others (independent review of #1993, 5826650947) must not get the estimates cause.
 */
const refusalCoded = (code: string, message: string): ResultsSectionDataReturn => {
  const data = decisionWithLeaderWithheldAndReason()
  const adm = data.recommendation.analysisAdmission as unknown as {
    reasons: { field: string; code: string; message: string }[]
  }
  return {
    ...data,
    recommendation: {
      ...data.recommendation,
      analysisAdmission: {
        ...adm,
        reasons: adm.reasons.map((r) => (r.field === 'permitted_analysis_mode' ? { ...r, code, message } : r)),
      },
    },
  } as ResultsSectionDataReturn
}

const NOT_ABOUT_ESTIMATES = [
  ['NOTHING_TO_COMPARE', 'Name at least two different options you are weighing.'],
  ['NO_COMPARISON_SUBSTRATE', 'Nothing in this model connects the options to your goal.'],
  ['MODEL_HAS_BLOCKERS', 'This model cannot be analysed yet.'],
] as const

beforeEach(() => useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never))
afterEach(cleanup)

describe('the withheld leader is not blamed on limits the user never set', () => {
  it('PRECONDITION: the producer token alone maps to a sentence, and it names no limits', () => {
    expect(leaderWithholdCause(REASON)).not.toBeNull()
    expect(leaderWithholdCause(REASON)).not.toContain(LIMITS)
  })

  it('⭐ where the admission refused the claim, the cause names the estimates, not limits', () => {
    const checks = checksOf(decisionWithLeaderWithheldAndReason())
    expect(checks.leaderWithheld).toBe(true)
    expect(checks.leaderWithholdCause).not.toBeNull()
    expect(checks.leaderWithholdCause).not.toContain(LIMITS)
    expect(checks.leaderWithholdCause).toContain('estimates')
    // Still a nameable cause, so a re-run is still not offered as the remedy.
    expect(checks.rerunWouldNotHelp).toBe(true)

    render(
      <AnalysisNewTabBody
        resultsSectionData={decisionWithLeaderWithheldAndReason()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="h"
      />,
    )
    expect(screen.getByTestId('analysis-new-commitment')).not.toHaveTextContent(LIMITS)
  })

  it('⭐ pricing: the admission permits a leader, the first pass withholds it → the cause names no limits', () => {
    const checks = checksOf(pricingFirstPass())
    expect(checks.leaderWithheld, 'PRECONDITION: the leader is withheld').toBe(true)
    expect(checks.leaderWithholdCause).not.toBeNull()
    expect(checks.leaderWithholdCause).not.toMatch(/limit/i)
    expect(checks.leaderWithholdCause).toBe(leaderWithholdCause(REASON))
    // ⭐ A NAMEABLE CAUSE, NOT A DURABLE ONE: an explicit Run on this model
    // permitted the leader (02:37Z), so Run stays the honest next action and the
    // surfaces must not swap it for "Review estimates" (pre-review 5826233187).
    expect(checks.rerunWouldNotHelp).toBe(false)
  })

  it('OPPOSITE CONTROL: the same token behind a REFUSING admission is durable (a re-run would not help)', () => {
    const checks = checksOf(decisionWithLeaderWithheldAndReason())
    expect(checks.leaderWithholdCause).toBe(LEADER_WITHHELD_UNTIL_AN_ESTIMATE_IS_YOURS)
    expect(checks.rerunWouldNotHelp).toBe(true)
  })

  it('CONTROL: a token that names its own cause keeps the suppression (separation_unavailable, no admission)', () => {
    const checks = checksOf(decisionWithLeaderWithheld(), SEPARATION)
    expect(checks.leaderWithholdCause).toBe(leaderWithholdCause(SEPARATION))
    expect(checks.rerunWouldNotHelp).toBe(true)
  })

  it('the token\'s sentence is true of every cause it covers: no limits, no "unchecked", no breach, no estimates', () => {
    const sentence = leaderWithholdCause(REASON) ?? ''
    expect(sentence).not.toBe('')
    expect(sentence).not.toMatch(/limit|could not be checked|unchecked|break|estimate/i)
    expect(sentence).not.toContain('—')
  })

  it('⭐ CEE\'s first-pass token behind a refusing admission → the estimates cause, and no re-run as the remedy', () => {
    const checks = checksOf(decisionWithLeaderWithheldAndReason(), FIRST_PASS)
    expect(checks.leaderWithholdCause).toBe(LEADER_WITHHELD_UNTIL_AN_ESTIMATE_IS_YOURS)
    expect(checks.rerunWouldNotHelp).toBe(true)
  })

  it('CEE\'s first-pass token behind a PERMITTING admission → no cause is named, so the run stays offered', () => {
    // An explicit Run on the same model permitted the leader (02:37Z).
    const checks = checksOf(pricingFirstPass(), FIRST_PASS)
    expect(checks.leaderWithheld).toBe(true)
    expect(checks.leaderWithholdCause).toBeNull()
    expect(checks.rerunWouldNotHelp).toBe(false)
  })

  it.each(NOT_ABOUT_ESTIMATES)(
    '⭐ OPPOSITE CONTROL: a refusal coded %s is not about estimates → the token\'s own sentence, and Run is not suppressed',
    (code, message) => {
      const checks = checksOf(refusalCoded(code, message))
      expect(checks.leaderWithheld, 'PRECONDITION: the leader is withheld').toBe(true)
      expect(checks.leaderWithholdCause).not.toBe(LEADER_WITHHELD_UNTIL_AN_ESTIMATE_IS_YOURS)
      expect(checks.leaderWithholdCause).toBe(leaderWithholdCause(REASON))
      expect(checks.rerunWouldNotHelp).toBe(false)
    },
  )

  it('CONTROL: the same re-coding helper with an estimate code keeps the estimates cause (the helper is not what changes it)', () => {
    const checks = checksOf(
      refusalCoded('USER_STATED_PARAMETERS_NOT_MATERIAL', 'None of the estimates you set changes the comparison.'),
    )
    expect(checks.leaderWithholdCause).toBe(LEADER_WITHHELD_UNTIL_AN_ESTIMATE_IS_YOURS)
    expect(checks.rerunWouldNotHelp).toBe(true)
  })

  it('⭐ an admission refusal does not replace a cause the producer named for itself (separation_unavailable)', () => {
    const checks = checksOf(decisionWithLeaderWithheldAndReason(), SEPARATION)
    expect(leaderWithholdCause(SEPARATION), 'PRECONDITION: the separation token has its own sentence').not.toBeNull()
    expect(checks.leaderWithholdCause).toBe(leaderWithholdCause(SEPARATION))
  })
})

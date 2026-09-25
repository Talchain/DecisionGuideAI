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
 * Where no admission refused it, today's sentence about limits stands ONLY IF
 * the model has limits.
 *
 * ⭐ THE SECOND CASE, Paul's pricing brief on the same build (25 Sep 02:20Z,
 * OpenAI, CEE `e39f6e0`): one estimate is his own, so the admission PERMITTED
 * a leader (`CONFIDENCE_PARAMETERS_PARTLY_USER_STATED`), the automatic first
 * pass still withheld it with the same token, and "Still open" again said "the
 * limits you set" on a brief with none. CEE's typed first-pass marker
 * (`enrichment.run_provenance`) is stripped by its transport keep-list, so the
 * precise cause is not on the wire. The model's own limits are: the canvas
 * `goalConstraints` slice, the one a run sends to PLoT, persisted with the
 * scenario. With none, the cause is the sentence true of every cause the token
 * covers, and the options section does not say "your limits" either.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { leaderWithholdCause, LEADER_WITHHELD_BY_THIS_RUNS_CHECKS } from '../analysisNewCopy'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useCanvasStore } from '../../../../canvas/store'
import { decisionWithLeaderWithheld, decisionWithLeaderWithheldAndReason } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const REASON = 'constraint_verdict_withheld'
const LIMITS = 'limits you set'

const checksOf = (data: ResultsSectionDataReturn, modelHasLimits = false) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'run_x',
    producerLeaderWithholdReason: REASON,
    modelHasLimits,
  }).checks

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

/** One limit, in the draft-time shape CEE sends (`constraint_id`, no `id`). */
const ONE_LIMIT = [{ constraint_id: 'c1', label: 'Churn stays under 5%', node_id: 'f_churn', operator: '<=', value: 0.05 }]

/** The held result stamped with the token by the store's own writer, as a turn stamps it. */
function holdTheWithheldRun(goalConstraints: unknown) {
  useCanvasStore.setState({
    analysisStateV1: null,
    analysisFreshnessDirty: false,
    goalConstraints,
    results: { status: 'complete', progress: 100, hash: 'pricing-first-pass', report: { option_probabilities: {} } },
  } as never)
  useCanvasStore.getState().resultsWithholdLeaderClaim('leader_claim_withheld', REASON)
}

const renderWired = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="pricing-first-pass" />,
  )

beforeEach(() => useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never))
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ analysisStateV1: null, goalConstraints: null, results: { status: 'idle', progress: 0 } } as never)
})

describe('the withheld leader is not blamed on limits the user never set', () => {
  it('PRECONDITION: the producer token alone still maps to the limits sentence', () => {
    expect(leaderWithholdCause(REASON)).toContain(LIMITS)
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

  it('OPPOSITE CONTROL: with no admission refusal and a model that has limits, the limits sentence stands', () => {
    const checks = checksOf(decisionWithLeaderWithheld(), true)
    expect(checks.leaderWithholdCause).toContain(LIMITS)
    expect(checks.sharesExcludeLimits).toBe(true)
  })

  it('⭐ pricing: the admission permits a leader, the first pass withholds it, the model has no limits → no "limits" anywhere', () => {
    const checks = checksOf(pricingFirstPass())
    expect(checks.leaderWithheld, 'PRECONDITION: the leader is withheld').toBe(true)
    expect(checks.leaderWithholdCause).toBe(LEADER_WITHHELD_BY_THIS_RUNS_CHECKS)
    expect(checks.leaderWithholdCause).not.toContain('limit')
    expect(checks.sharesExcludeLimits, '"your limits aren\'t in these shares" presupposes limits').toBe(false)
    // Still a nameable cause: a re-run of the same model is not offered as the remedy.
    expect(checks.rerunWouldNotHelp).toBe(true)
  })

  it('the no-limits sentence is true of every cause the token covers', () => {
    expect(LEADER_WITHHELD_BY_THIS_RUNS_CHECKS).not.toMatch(/limit|could not be checked|unchecked|breaks|estimate/i)
    expect(LEADER_WITHHELD_BY_THIS_RUNS_CHECKS).not.toContain('—')
  })
})

describe('through the production seam: the store holds the model and the stamped result', () => {
  it('⭐ no limits on the model → "Move towards commitment" names none', () => {
    holdTheWithheldRun(null)
    renderWired(pricingFirstPass())
    const commitment = screen.getByTestId('analysis-new-commitment')
    expect(commitment).toHaveTextContent(LEADER_WITHHELD_BY_THIS_RUNS_CHECKS)
    expect(commitment).not.toHaveTextContent(LIMITS)
  })

  it('OPPOSITE CONTROL: the same run on a model with a limit keeps the limits sentence', () => {
    holdTheWithheldRun(ONE_LIMIT)
    renderWired(pricingFirstPass())
    expect(screen.getByTestId('analysis-new-commitment')).toHaveTextContent(LIMITS)
  })
})

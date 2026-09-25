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
 * Where no admission refused it, today's sentence about limits stands.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { leaderWithholdCause } from '../analysisNewCopy'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { decisionWithLeaderWithheld, decisionWithLeaderWithheldAndReason } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const REASON = 'constraint_verdict_withheld'
const LIMITS = 'limits you set'

const checksOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'run_x',
    producerLeaderWithholdReason: REASON,
  }).checks

beforeEach(() => useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never))
afterEach(cleanup)

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

  it('OPPOSITE CONTROL: with no admission refusal, the limits sentence stands', () => {
    const checks = checksOf(decisionWithLeaderWithheld())
    expect(checks.leaderWithholdCause).toContain(LIMITS)
  })
})

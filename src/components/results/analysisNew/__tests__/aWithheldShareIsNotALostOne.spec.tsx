/**
 * ⭐ A WITHHELD SHARE IS NOT A LOST ONE.
 *
 * Joined guest witness, #63 5824916222 (25 Sep 2026, UI `820aeed1`, CEE
 * `c673223`, OpenAI): on the automatic first run of BOTH briefs the glance's
 * first lines read "This analysis is partial. The win share and the overall
 * robustness rating did not come back." The run was complete
 * (`run_state: complete_current`). The producer had WITHHELD the leader claim
 * (`leader_claim.permitted: false`), and its withheld projection drops exactly
 * those two results: the block carried no `win_probabilities` and
 * `robustness` carried no `level`. The admission beside it says why ("Every
 * estimate this comparison rests on is Olumi’s… no option can be called the
 * leader and no result can be called stable or robust until you have set at
 * least one of them"). "Did not come back" told the reader the opposite: that
 * something was lost, which is what a re-run would fix.
 *
 * The rule: where the producer withheld the leader designation, the win share
 * and the robustness rating are withheld, not missing, so the partial warning
 * does not name them. Any other missing result is still named, and on a run
 * whose leader the producer permitted, the same absences are still named.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { decisionWithLeaderWithheldAndReason, withLeaderLicensed } from './analysisNewFixtures'
import type { MissingFieldKey, ResultCompleteness } from '../../useResultCompleteness'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

/** What `useResultCompleteness` derives from the captured withheld block. */
const CAPTURED_MISSING: MissingFieldKey[] = ['win_probability', 'robustness_level', 'recommendation_stability']
const PROVISIONAL = 'analysis-new-status-provisional'

const withMissing = (data: ResultsSectionDataReturn, missing: MissingFieldKey[]): ResultsSectionDataReturn => ({
  ...data,
  completeness: { status: 'partial', missing, reasons: [] } as unknown as ResultCompleteness,
})

const withheld = (missing: MissingFieldKey[] = CAPTURED_MISSING) =>
  withMissing(decisionWithLeaderWithheldAndReason(), missing)
const licensed = (missing: MissingFieldKey[] = CAPTURED_MISSING) =>
  withMissing(withLeaderLicensed(decisionWithLeaderWithheldAndReason()), missing)

const statusOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'run_x',
    producerLeaderWithholdReason: 'constraint_verdict_withheld',
  }).status

beforeEach(() => useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never))
afterEach(cleanup)

describe('a withheld share is not a lost one', () => {
  it('PRECONDITION: the fixtures are the withheld run and its licensed twin', () => {
    expect(withheld().recommendation.leaderDesignationPermitted).toBe(false)
    expect(licensed().recommendation.leaderDesignationPermitted).toBe(true)
    expect(withheld().recommendation.analysisStatus, 'the producer did not call it partial').not.toBe('partial')
  })

  it('⭐ the withheld run does not say its withheld results "did not come back"', () => {
    const status = statusOf(withheld())
    expect(status.missingResults).toEqual([])
    expect(status.isProvisional).toBe(false)

    render(<AnalysisNewTabBody resultsSectionData={withheld()} isPreRun={false} isRunning={false} isStale={false} responseHash="h" />)
    expect(screen.queryByTestId(PROVISIONAL)).toBeNull()
    expect(document.body.textContent ?? '').not.toContain('did not come back')
  })

  it('OPPOSITE CONTROL: on a run whose leader the producer permitted, the same absences are still named', () => {
    const status = statusOf(licensed())
    expect(status.isProvisional).toBe(true)
    expect(status.missingResults).toEqual(['the win share', 'the overall robustness rating'])
  })

  it('CONTROL: a withheld run still names a result that really is missing', () => {
    const status = statusOf(withheld([...CAPTURED_MISSING, 'expected_outcome']))
    expect(status.isProvisional).toBe(true)
    expect(status.missingResults).toEqual(['the expected outcome'])
  })
})

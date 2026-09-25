/**
 * A provisional admission outranks the producer's own "slightly ahead" headline.
 *
 * Codex's focused challenge on #63 (5826448049), from RC's hiring S3 capture on
 * served CEE `92b1bf8d`:
 * - the response's `analysis_ready.analysis_admission.permitted_analysis_mode`
 *   is `quantified_provisional` (0 of 19 parameters user-stated);
 * - the same response's typed result still carries `leading_option_id`, and
 *   `decision_brief.headline_banded` says the leader is slightly ahead, with
 *   `robustness_gated: false`.
 *
 * The Reasoning tab must follow the admission: no leader designated, no
 * "slightly ahead", while the numeric comparison stays. The CONTROL is the same
 * payload under a `comparative_leader` admission: the leader IS designated, so
 * the probe can see a designation and the withheld arm's absence is real.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render as rtlRender, renderHook, screen } from '@testing-library/react'

vi.mock('../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { useCanvasStore } from '../../../canvas/store'
import { useResultsSectionData } from '../useResultsSectionData'
import { AnalysisNewTabBody } from '../analysisNew/AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../analysisNew/buildAnalysisNewViewModel'
import { admission, OPT_HEDGE, OPT_BOLD, OPT_HEDGE_LABEL, resetStore, setStore } from './helpers/admissionGatesHarness'
import type { PermittedAnalysisMode } from '../../../adapters/cee/types'

/** The served shape: the producer's band names the leader, not robustness-gated. */
function withSlightlyAheadHeadline(mode: PermittedAnalysisMode) {
  setStore({ separated: true, admission: admission(mode) })
  const s = useCanvasStore.getState() as unknown as { results: { report: Record<string, unknown> } }
  useCanvasStore.setState({
    results: {
      ...s.results,
      report: {
        ...s.results.report,
        leading_option_id: OPT_HEDGE,
        decision_brief: {
          headline_banded: {
            band: 'slightly_ahead',
            leader_option_id: OPT_HEDGE,
            second_option_id: OPT_BOLD,
            robustness_gated: false,
          },
        },
      },
    },
  } as never)
  return renderHook(() => useResultsSectionData()).result.current
}

const vmOf = (data: ReturnType<typeof withSlightlyAheadHeadline>) =>
  buildAnalysisNewViewModel({
    data: data as never,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'run_s3',
  })

beforeEach(resetStore)
afterEach(cleanup)

describe('a provisional admission outranks the producer headline', () => {
  it('CONTROL: under comparative_leader the same payload designates the leader', () => {
    const data = withSlightlyAheadHeadline('comparative_leader')
    expect(data.recommendation?.verdict?.hasLeadingOption, 'PRECONDITION: the result separated').toBe(true)
    expect(data.recommendation?.leaderDesignationPermitted).toBe(true)
    expect(vmOf(data).checks.leaderWithheld).toBe(false)
    rtlRender(
      <AnalysisNewTabBody resultsSectionData={data as never} isPreRun={false} isRunning={false} isStale={false} responseHash="run_s3" />,
    )
    // The probe can see a designation: the leader's name in a first-screen claim.
    expect(screen.getByTestId('analysis-new-commitment')).toHaveTextContent(`${OPT_HEDGE_LABEL} has the highest expected outcome`)
  })

  it('⭐ under quantified_provisional: no leader designated, and the Reasoning tab says so', () => {
    const data = withSlightlyAheadHeadline('quantified_provisional')
    expect(data.recommendation?.verdict?.hasLeadingOption, 'PRECONDITION: the result separated').toBe(true)
    expect(data.recommendation?.leaderDesignationPermitted).toBe(false)
    const vm = vmOf(data)
    expect(vm.checks.leaderWithheld).toBe(true)

    rtlRender(
      <AnalysisNewTabBody resultsSectionData={data as never} isPreRun={false} isRunning={false} isStale={false} responseHash="run_s3" />,
    )
    const commitment = screen.getByTestId('analysis-new-commitment')
    expect(commitment).not.toHaveTextContent(`${OPT_HEDGE_LABEL} has the highest expected outcome`)
    expect(commitment).toHaveTextContent('Olumi could not confirm which option is most likely on this run')
    expect(document.body.textContent ?? '').not.toMatch(/slightly ahead|scored highest/i)
    // The comparison itself stays: both options are still on the first screen.
    expect(commitment).toHaveTextContent(OPT_HEDGE_LABEL)
    expect(commitment).toHaveTextContent('Go big in one step')
  })
})

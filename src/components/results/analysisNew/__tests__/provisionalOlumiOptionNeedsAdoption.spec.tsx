import '@testing-library/jest-dom/vitest'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { useCanvasStore } from '../../../../canvas/store'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { decisionWithLeaderWithheld } from './analysisNewFixtures'

const previousResults = useCanvasStore.getState().results
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ results: previousResults } as never)
})

it('a current no-limit Run that kept an unadopted Olumi option asks for adoption, not a limit repair or rerun alone', () => {
  const base = decisionWithLeaderWithheld()
  const data = {
    ...base,
    // A partial result mounts the status ribbon, where a wrong recovery act
    // would otherwise appear even though this selected Run is current.
    recommendation: { ...base.recommendation, analysisStatus: 'partial' as const },
  }
  const token = 'olumi_option_provisional'
  const vm = buildAnalysisNewViewModel({
    data,
    producerLeaderWithholdReason: token,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'selected-current-provisional',
  })
  expect(vm.checks.items.find((item) => item.id === 'leader')?.code).toBe('leader_not_assessed')
  expect(vm.checks.leaderWithholdCause).toMatch(/Add to comparison card/)
  expect(vm.checks.provisionalOptionWithheld).toBe(true)
  expect(vm.checks.rerunWouldNotHelp).toBe(true)
  expect(vm.checks.sharesExcludeLimits).toBe(false)
  expect(vm.status.isProvisional).toBe(true)

  useCanvasStore.setState((state) => ({
    results: {
      ...state.results,
      report: {
        ...state.results.report,
        run_provenance: { provisional: true },
        producer_leader_permission: { permitted: false, producer_cause: token },
      },
    },
  }) as never)
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="selected-current-provisional"
      onReanalyse={vi.fn()}
      onReviewEstimates={vi.fn()}
    />,
  )
  expect(screen.getByTestId('analysis-new-status-provisional')).toBeInTheDocument()
  expect(screen.getByText(/ask Olumi for the Add to comparison card/)).toBeInTheDocument()
  expect(screen.queryByTestId('analysis-new-glance-ribbon-reanalyse')).toBeNull()
  expect(screen.queryByTestId('analysis-new-glance-ribbon-review-estimates')).toBeNull()
  expect(screen.queryByText(/no option meets one of your limits/i)).toBeNull()
  expect(screen.queryByText(/no option can be put forward until at least one of the estimates/i)).toBeNull()
})

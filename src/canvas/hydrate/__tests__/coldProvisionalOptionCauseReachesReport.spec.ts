import { afterEach, expect, it } from 'vitest'

import { useCanvasStore } from '../../store'
import { applyBootLeaderClaimWithholding, applyScenarioAnalysisRead } from '../applyScenarioAnalysisRead'
import { readProvisionalApplyStore } from '../provisionalApplyStore'
import { leaderWithholdCause } from '../../../components/results/analysisNew/analysisNewCopy'
import savedRead from './fixtures/no-limit-provisional-cold-read.json'

const previous = useCanvasStore.getState()
afterEach(() => {
  useCanvasStore.setState({
    currentScenarioId: previous.currentScenarioId,
    results: previous.results,
    analysisStateV1: previous.analysisStateV1,
  } as never)
})

it('a fresh browser binds the saved provisional-option cause to the report it restores', () => {
  // Extracted from the real isolated CEE read of scenario b6fde091 after Run
  // 2026-09-30T00:01:29.585Z. Its leader claim is withheld, without a failed
  // limit, while £54 is marked kept_olumi_provisional.
  expect(savedRead.analysis_state.run_state).toMatchObject({
    kind: 'complete_current', computed_at: '2026-09-30T00:01:29.585Z',
  })
  expect(savedRead.analysis_state.leader_claim).toEqual({
    permitted: false, withheld_reason: 'olumi_option_provisional',
  })
  expect(savedRead.analysis_option_participation).toEqual([
    { option_id: 'set_price_at_54', state: 'kept_olumi_provisional' },
  ])

  useCanvasStore.setState({
    currentScenarioId: savedRead.scenario_id,
    nodes: [], edges: [],
    results: { status: 'idle', progress: 0 },
    analysisStateV1: null,
  } as never)
  expect(useCanvasStore.getState().results.report).toBeUndefined()

  // Boot's verdict leg runs before the cold Run report exists. Its store
  // action intentionally cannot stamp an absent report.
  applyBootLeaderClaimWithholding({
    analysisState: savedRead.analysis_state as never,
    store: { resultsWithholdLeaderClaim: useCanvasStore.getState().resultsWithholdLeaderClaim },
  })
  expect(useCanvasStore.getState().results.report).toBeUndefined()

  const outcome = applyScenarioAnalysisRead({
    analysisState: savedRead.analysis_state as never,
    analysisResult: savedRead.analysis_result as never,
    optionParticipation: savedRead.analysis_option_participation as never,
    store: readProvisionalApplyStore(),
  })
  expect(outcome).toMatchObject({ outcome: 'applied', kind: 'complete_current', resultsHydrated: true })
  const stamp = useCanvasStore.getState().results.report?.producer_leader_permission
  expect(stamp).toEqual({
    permitted: false,
    withheld_reason: 'leader_claim_withheld',
    producer_cause: 'olumi_option_provisional',
  })
  expect(leaderWithholdCause(stamp?.producer_cause)).toMatch(/Add to comparison card/)
})

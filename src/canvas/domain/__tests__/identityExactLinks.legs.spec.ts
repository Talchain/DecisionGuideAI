/**
 * IDENTITY-EXACT carriers: the turn that ran a Run (CEE #3046, `__additive__.identity_evaluated_node_ids`) and the
 * cold read (`analysis_identity_evaluated_node_ids`) record the SAME set under the SAME report hash, so a Run pressed
 * mid-session shows "Exact" at once and a reload shows the same. Harness: `optionParticipationConsumer.spec.tsx`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AnalysisStateV1, OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { applyScenarioAnalysisRead, type ScenarioAnalysisApplyStore } from '../../hydrate/applyScenarioAnalysisRead'
import { identityEvaluatedFromResponse, recordIdentityEvaluated, useIdentityEvaluatedStore } from '../identityExactLinks'

const BLOCK = {
  type: 'analysis_result' as const,
  summary: 's',
  leading_option_id: 'raise_to_59',
  enrichment: {
    option_comparison: [
      { id: 'keep_49_price', option_id: 'keep_49_price', label: 'Keep £49 price', option_label: 'Keep £49 price', status: 'computed', win_probability: 0.2 },
      { id: 'raise_to_59', option_id: 'raise_to_59', label: 'Raise to £59', option_label: 'Raise to £59', status: 'computed', win_probability: 0.8 },
    ],
  },
}
const CURRENT = {
  run_state: { kind: 'complete_current', computed_at: '2026-09-29T10:00:00.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: true },
  robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
  requires_rerun: false, blocked_unusable: false, contradictions: [],
} as unknown as AnalysisStateV1

function turn(extra: Record<string, unknown>): string {
  const resultsComplete = vi.fn()
  const store = {
    setCurrentStage: vi.fn(), updateNode: vi.fn(), updateEdgeData: vi.fn(), setRunMeta: vi.fn(), setCeeAnalysisReady: vi.fn(),
    setAnalysisFreshness: vi.fn(), resultsComplete, nodes: [], edges: [], currentResultsHash: null,
  } as unknown as V5ApplicatorStore
  const response = { response_version: 2, assistant_text: '', blocks: [BLOCK], suggested_actions: [], insights: [], stage_indicator: 'frame', ...extra } as unknown as OlumiResponse
  applyV5State(response, store)
  expect(resultsComplete, 'the turn leg must hydrate the report').toHaveBeenCalledTimes(1)
  return resultsComplete.mock.calls[0][0].hash as string
}
function read(identityEvaluated: unknown): string {
  const resultsComplete = vi.fn()
  const store = { setAnalysisStateV1: vi.fn(), resultsComplete, setLimitVerdicts: vi.fn(), currentResultsHash: null, currentScenarioId: 'scn-1' } as unknown as ScenarioAnalysisApplyStore
  applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: BLOCK, identityEvaluated, store })
  expect(resultsComplete, 'the read leg must hydrate the report').toHaveBeenCalledTimes(1)
  return resultsComplete.mock.calls[0][0].hash as string
}
const held = () => useIdentityEvaluatedStore.getState().held

beforeEach(() => recordIdentityEvaluated(null, null))

describe('the turn and the read record the same identity set under the same report', () => {
  it('the turn key is read top level first, then the additive sidecar', () => {
    expect(identityEvaluatedFromResponse({ identity_evaluated_node_ids: ['mrr'] })).toEqual(['mrr'])
    expect(identityEvaluatedFromResponse({ __additive__: { identity_evaluated_node_ids: ['mrr'] } })).toEqual(['mrr'])
    expect(identityEvaluatedFromResponse({})).toBeUndefined()
  })
  it('PARITY: a Run pressed mid-session (turn sidecar) and its cold reload (read) hold the same set and hash', () => {
    const turnHash = turn({ __additive__: { identity_evaluated_node_ids: ['mrr'] } })
    expect(held()).toEqual({ responseHash: turnHash, ids: ['mrr'] })
    recordIdentityEvaluated(null, null)
    const readHash = read(['mrr'])
    expect(readHash).toBe(turnHash)
    expect(held()).toEqual({ responseHash: turnHash, ids: ['mrr'] })
  })
  it('CONTRAST: a turn without the key (not attested) records nothing; [] records "none"', () => {
    turn({})
    expect(held()).toEqual({ responseHash: null, ids: [] })
    const hash = turn({ __additive__: { identity_evaluated_node_ids: [] } })
    expect(held()).toEqual({ responseHash: hash, ids: [] })
  })
})

/**
 * B5 PARITY ON THE READ LEG (Canonical 22030f71, 28 Sep 2026).
 *
 * A turn that carries `limit_verdicts` stores them beside the analysis it came with (`applyV5State.ts`, B5). The
 * READ leg (`POST /scenarios/:id/graph`, delivered by `useProvisionalAnalysisDelivery`) puts the SAME analysis on
 * screen through `resultsComplete`, and CEE serves the SAME verdicts beside it as `analysis_limit_verdicts`
 * (byte-equal to the turn's, witnessed on served CEE 0db4f43, scenario 0800ad10) — but this leg never wrote them, so
 * an analysis that arrived by read showed no per-limit caption. The read leg now stores them exactly as the turn leg
 * does: bound to the hash `resultsComplete` received, and evicted when a new analysis lands without any.
 */
import { describe, it, expect, vi } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { applyScenarioAnalysisRead, type ScenarioAnalysisApplyStore } from '../applyScenarioAnalysisRead'

const CURRENT = {
  run_state: { kind: 'complete_current', computed_at: '2026-09-28T01:41:46.989Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: false, withheld_reason: 'no_option_meets_limit', separation: 'separated' },
  robustness: {},
  usable_for_prose: false,
  usable_for_chips: false,
  usable_for_followup: false,
  requires_rerun: false,
  blocked_unusable: false,
  contradictions: [],
} as unknown as AnalysisStateV1

const RESULT_BLOCK = {
  type: 'analysis_result',
  summary: 'Comparison on the current model.',
  leading_option_id: null,
  win_probabilities: { opt_59: 0.5, opt_49: 0.5 },
  computed_against_hash: '401917e935dfdea1',
  enrichment: {
    analysis_status: 'ok',
    option_comparison: [
      { option_id: 'opt_59', option_label: 'Raise to £59', win_probability: 0.5, outcome_mean: 0.55 },
      { option_id: 'opt_49', option_label: 'Keep £49', win_probability: 0.5, outcome_mean: 0.54 },
    ],
  },
}

/** Served verbatim on CEE 0db4f43 (scenario 0800ad10), identical on the turn and on the read. */
const SERVED_VERDICTS = {
  per_limit: [{ constraint_id: 'agent-lane:annual_churn_rate:<=', state: 'estimate_only', reason: 'level_user_assumption' }],
  joint: { state: 'estimate_only' },
}

function harness(overrides: Partial<ScenarioAnalysisApplyStore> = {}) {
  const resultsComplete = vi.fn()
  const setLimitVerdicts = vi.fn()
  const store = {
    setAnalysisStateV1: vi.fn(),
    resultsComplete,
    setLimitVerdicts,
    currentResultsHash: null,
    currentScenarioId: 'scn-0800ad10',
    ...overrides,
  } as unknown as ScenarioAnalysisApplyStore
  return { store, resultsComplete, setLimitVerdicts }
}

describe('read leg stores the per-limit verdicts beside the analysis it displays', () => {
  it('RED: a read with analysis_limit_verdicts stores them, bound to the hash resultsComplete received', () => {
    const h = harness()
    const out = applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: RESULT_BLOCK, limitVerdicts: SERVED_VERDICTS, store: h.store })
    expect(out.outcome).toBe('applied')
    expect(h.resultsComplete).toHaveBeenCalledTimes(1)
    const hash = h.resultsComplete.mock.calls[0][0].hash
    expect(h.setLimitVerdicts).toHaveBeenCalledTimes(1)
    const written = h.setLimitVerdicts.mock.calls[0][0]
    expect(written.analysisHash).toBe(hash)
    expect(written.scenarioId).toBe('scn-0800ad10')
    expect(written.verdicts.perLimit).toEqual([
      expect.objectContaining({ constraintId: 'agent-lane:annual_churn_rate:<=', state: 'estimate_only' }),
    ])
    expect(written.verdicts.joint?.state).toBe('estimate_only')
  })

  it('RED: a new analysis read WITHOUT verdicts evicts any held ones (the turn leg\'s rule)', () => {
    const h = harness()
    applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: RESULT_BLOCK, store: h.store })
    expect(h.setLimitVerdicts).toHaveBeenCalledWith(null)
  })

  it('CONTROL: a re-read of the analysis already on screen writes nothing (dedupe unchanged)', () => {
    const first = harness()
    applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: RESULT_BLOCK, limitVerdicts: SERVED_VERDICTS, store: first.store })
    const heldHash = first.resultsComplete.mock.calls[0][0].hash
    const again = harness({ currentResultsHash: heldHash })
    const out = applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: RESULT_BLOCK, limitVerdicts: SERVED_VERDICTS, store: again.store })
    expect(out.outcome).toBe('alreadyHeld')
    expect(again.setLimitVerdicts).not.toHaveBeenCalled()
  })

  it('CONTROL: a verdict-only read (no analysis_result) never touches the stored verdicts', () => {
    const h = harness()
    applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: null, limitVerdicts: SERVED_VERDICTS, store: h.store })
    expect(h.setLimitVerdicts).not.toHaveBeenCalled()
  })
})

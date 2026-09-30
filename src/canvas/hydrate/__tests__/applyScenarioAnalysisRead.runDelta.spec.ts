/**
 * SC-24 ON THE READ LEG: a cold reload shows the SAME A/B pair the turn showed (#84 5914416431). CEE serves the turn's
 * own `run_delta` beside the displayed analysis on `POST /scenarios/:id/graph`; the read leg stores it exactly as the
 * turn leg does — bound to the hash `resultsComplete` received — and evicts it when a new analysis lands without one.
 */
import { describe, it, expect, vi } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { applyScenarioAnalysisRead, type ScenarioAnalysisApplyStore } from '../applyScenarioAnalysisRead'

const CURRENT = {
  run_state: { kind: 'complete_current', computed_at: '2026-09-30T13:09:00.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: true, separation: 'separated' },
  robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
  requires_rerun: false, blocked_unusable: false, contradictions: [],
} as unknown as AnalysisStateV1

const BLOCK = {
  type: 'analysis_result', summary: 'Comparison on the current model.', leading_option_id: null,
  win_probabilities: { opt_60: 0.44, opt_49: 0.56 }, computed_against_hash: 'b1a2c3d4e5f60718',
  enrichment: { analysis_status: 'ok', option_comparison: [
    { option_id: 'opt_60', option_label: 'Raise to £60', win_probability: 0.44, outcome_mean: 0.5 },
    { option_id: 'opt_49', option_label: 'Keep £49', win_probability: 0.56, outcome_mean: 0.52 },
  ] },
}

const DELTA = {
  attribution_case: 'C5_unattributed',
  pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'unknown', n_equal: true },
  leader: { changed: false, noise_verdict: 'not_noise_qualified' },
  win_probabilities: [], flip_thresholds: [],
  endpoints: { prior: { run_id: 'run-a' }, current: { run_id: 'run-b' } },
  input_coverage: 'complete',
  input_changes: [{ entity_kind: 'option_setting', entity_id: 'fac_price', option_id: 'opt_60', field: 'value',
    before: { raw: 59, unit: '£' }, after: { raw: 60, unit: '£' }, change: 'changed' }],
}

function harness() {
  const setRunDelta = vi.fn()
  const store = {
    setAnalysisStateV1: vi.fn(), resultsComplete: vi.fn(), setLimitVerdicts: vi.fn(), setRunDelta,
    currentResultsHash: null, currentScenarioId: 'scn-sc24',
  } as unknown as ScenarioAnalysisApplyStore
  return { store, setRunDelta, resultsComplete: store.resultsComplete as ReturnType<typeof vi.fn> }
}

describe('SC-24 · the cold read stores the pair it was served', () => {
  it('stores run_delta bound to the hash resultsComplete received, in this scenario', () => {
    const h = harness()
    applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: BLOCK, runDelta: DELTA, store: h.store })
    const hash = h.resultsComplete.mock.calls[0][0].hash
    expect(h.setRunDelta).toHaveBeenCalledWith({ delta: DELTA, analysisHash: hash, scenarioId: 'scn-sc24' })
  })

  it('a new analysis served WITHOUT a delta evicts the held one (never a delta about another Run)', () => {
    const h = harness()
    applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: BLOCK, store: h.store })
    expect(h.setRunDelta).toHaveBeenCalledWith(null)
  })

  it('a malformed delta is refused WHOLE and reads as absent — never a partial comparison', () => {
    const h = harness()
    const { endpoints: _drop, ...listWithoutEnds } = DELTA
    applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: BLOCK, runDelta: listWithoutEnds, store: h.store })
    expect(h.setRunDelta).toHaveBeenCalledWith(null)
  })

  it('a re-read of the analysis already on screen writes nothing (the turn\'s delta stays)', () => {
    const h = harness()
    applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: BLOCK, runDelta: DELTA, store: h.store })
    const hash = h.resultsComplete.mock.calls[0][0].hash
    const again = harness()
    ;(again.store as { currentResultsHash: string }).currentResultsHash = hash
    applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: BLOCK, store: again.store })
    expect(again.setRunDelta).not.toHaveBeenCalled()
  })
})

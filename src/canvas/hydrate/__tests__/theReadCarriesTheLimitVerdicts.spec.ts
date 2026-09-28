/**
 * B5 on the READ leg (CEE #2146 `analysis_limit_verdicts`). Served 28 Sep 2026 on UI `3b4af5aa`:
 * Olumi's automatic first pass arrived through the scenario read, not a turn, so the per-limit
 * lines (#2212) never rendered — the UI read `limit_verdicts` only from turns. The read carries
 * the same rows for the SAME fact as its `analysis_result`; this binds them exactly as the turn
 * applier does (`applyV5State`): stored beside the analysis, evicted by a new analysis without
 * them, and on reload bound only to the analysis actually on screen.
 */
import { describe, expect, it, vi } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { applyBootLimitVerdicts, applyScenarioAnalysisRead, type ScenarioAnalysisApplyStore } from '../applyScenarioAnalysisRead'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import type { LimitVerdicts } from '../../state/storedLimitVerdicts'
import realStagingFixture from '../../../v5/__tests__/fixtures/v5-analysis-result.staging-real-shape.json'

const BLOCK = realStagingFixture.blocks[0] as unknown
const HASH = mapV5AnalysisToReport(BLOCK as AnalysisResultBlock).model_card.response_hash
const VERDICTS: LimitVerdicts = {
  perLimit: [{ constraintId: 'c_churn', state: 'estimate_only', reason: null }],
  joint: null,
} as unknown as LimitVerdicts

const current = (): AnalysisStateV1 =>
  ({
    run_state: { kind: 'complete_current', computed_at: '2026-09-28T08:00:00.000Z' },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
  }) as AnalysisStateV1

function store(held: string | null) {
  const setLimitVerdicts = vi.fn()
  const s: ScenarioAnalysisApplyStore = {
    setAnalysisStateV1: vi.fn(),
    resultsComplete: vi.fn(),
    currentResultsHash: held,
    setLimitVerdicts,
    currentScenarioId: 'scn_1',
  }
  return { s, setLimitVerdicts }
}

describe('the read binds per-limit verdicts to the analysis it delivers', () => {
  it('⭐ a new analysis WITH verdicts: stored beside it (hash + scenario)', () => {
    const { s, setLimitVerdicts } = store(null)
    applyScenarioAnalysisRead({ analysisState: current(), analysisResult: BLOCK, limitVerdicts: VERDICTS, store: s })
    expect(setLimitVerdicts).toHaveBeenCalledWith({ verdicts: VERDICTS, analysisHash: HASH, scenarioId: 'scn_1' })
  })

  it('CONTROL: a new analysis WITHOUT verdicts evicts the previous ones (never carried across analyses)', () => {
    const { s, setLimitVerdicts } = store('an_older_hash')
    applyScenarioAnalysisRead({ analysisState: current(), analysisResult: BLOCK, limitVerdicts: null, store: s })
    expect(setLimitVerdicts).toHaveBeenCalledWith(null)
  })

  it('a re-read of the analysis already held: binds what it attests, never evicts on absence', () => {
    const withRows = store(HASH)
    applyScenarioAnalysisRead({ analysisState: current(), analysisResult: BLOCK, limitVerdicts: VERDICTS, store: withRows.s })
    expect(withRows.setLimitVerdicts).toHaveBeenCalledWith({ verdicts: VERDICTS, analysisHash: HASH, scenarioId: 'scn_1' })
    const without = store(HASH)
    applyScenarioAnalysisRead({ analysisState: current(), analysisResult: BLOCK, limitVerdicts: null, store: without.s })
    expect(without.setLimitVerdicts).not.toHaveBeenCalled()
  })

  it('no analysis delivered ⇒ no write, even with rows (they describe a result that did not arrive)', () => {
    const { s, setLimitVerdicts } = store(null)
    applyScenarioAnalysisRead({ analysisState: current(), analysisResult: null, limitVerdicts: VERDICTS, store: s })
    expect(setLimitVerdicts).not.toHaveBeenCalled()
  })
})

describe('reload: bound only to the analysis on screen', () => {
  const boot = (held: string | null, limitVerdicts: LimitVerdicts | null) => {
    const setLimitVerdicts = vi.fn()
    const out = applyBootLimitVerdicts({
      analysisResult: BLOCK,
      limitVerdicts,
      store: { currentResultsHash: held, currentScenarioId: 'scn_1', setLimitVerdicts },
    })
    return { out, setLimitVerdicts }
  }
  it('⭐ the restored analysis IS the read one: bound', () => {
    const { out, setLimitVerdicts } = boot(HASH, VERDICTS)
    expect(out).toBe('bound')
    expect(setLimitVerdicts).toHaveBeenCalledWith({ verdicts: VERDICTS, analysisHash: HASH, scenarioId: 'scn_1' })
  })
  it('CONTROL: a different analysis on screen: nothing written', () => {
    const { out, setLimitVerdicts } = boot('another_hash', VERDICTS)
    expect(out).toBe('skipped')
    expect(setLimitVerdicts).not.toHaveBeenCalled()
  })
  it('no rows attested: nothing written', () => {
    expect(boot(HASH, null).out).toBe('skipped')
  })
})

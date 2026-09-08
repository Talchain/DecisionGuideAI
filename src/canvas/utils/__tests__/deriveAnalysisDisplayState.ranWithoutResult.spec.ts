/**
 * ⭐ "ANALYSIS COMPLETE" MAY NOT BE SAID OVER AN EMPTY RESULT.
 *
 * MEASURED, NOT HYPOTHETICAL. Paul's manual test on build `acd3db4d` produced a
 * debug bundle in which the product displayed `analysis_display_headline:
 * "Analysis complete"` while every analytic value it rendered was unattributed:
 *
 *   · 5 of 5 rendered factors — `influence_source: "unmatched"`
 *   · 3 of 3 rendered options — `win_probability_source: "unmatched"`
 *   · `payloads.plot_request/plot_response/isl_request/isl_response` — all null
 *   · `isl_diagnostic.data_source: "none"`, `plot_evidence_source: "unavailable"`
 *   · CEE's own `leader_claim: { permitted: false, withheld_reason:
 *     "separation_unavailable" }`
 *
 * `hasReport` could not catch it. A report can be POPULATED and carry all-null
 * probabilities — an engine "I tried per-option and failed" state, which is not
 * a result. `hasAnyRealProbability` was written for exactly that, and was
 * consumed by three surfaces and NOT by the canonical headline.
 *
 * The tests below are DISCRIMINATING PAIRS: each withholding case is stated
 * beside the otherwise-identical input that still earns 'complete', so a future
 * change that simply stops distinguishing them REDs rather than passing by
 * agreeing with itself.
 */

import { describe, it, expect } from 'vitest'
import {
  deriveAnalysisDisplayState,
  type DeriveAnalysisDisplayStateInput,
} from '../deriveAnalysisDisplayState'

const READY: Pick<DeriveAnalysisDisplayStateInput, 'ceeAnalysisReadyStatus'> = {
  ceeAnalysisReadyStatus: 'ready',
}

describe('deriveAnalysisDisplayState — a run that produced nothing is not "complete"', () => {
  it('⭐ a populated report with NO renderable probability is ran_without_result', () => {
    const v = deriveAnalysisDisplayState({
      ...READY,
      hasReport: true,
      analysisChanged: false,
      hasRenderableResult: false,
    })
    expect(v.state).toBe('ran_without_result')
    expect(v.headline).toBe('Analysis finished without a result')
    // It must not wear success chrome.
    expect(v.textColorClass).not.toContain('success')
    expect(v.iconName).not.toBe('Check')
    // And it must offer the way out, because the user can rerun.
    expect(v.cta).toEqual({ kind: 'secondary', label: 'Rerun analysis' })
  })

  it('⭐ the DISCRIMINATING TWIN: identical input WITH a renderable result is complete', () => {
    const v = deriveAnalysisDisplayState({
      ...READY,
      hasReport: true,
      analysisChanged: false,
      hasRenderableResult: true,
    })
    expect(v.state).toBe('complete')
    expect(v.headline).toBe('Analysis complete')
    // Only `hasRenderableResult` differs between these two tests. If a change
    // ever makes them agree, one of them REDs.
  })

  it('an omitted hasRenderableResult defaults to true — an existing caller is unchanged', () => {
    const v = deriveAnalysisDisplayState({
      ...READY,
      hasReport: true,
      analysisChanged: false,
    })
    expect(v.state).toBe('complete')
  })

  it('a STALE report outranks the empty-result branch — it is out of date, not empty', () => {
    // Ordering matters: `results_stale` already tells the user to rerun and is
    // the more specific statement about a report the user has seen. The new
    // branch must not swallow it.
    const v = deriveAnalysisDisplayState({
      ...READY,
      hasReport: true,
      analysisChanged: true,
      hasRenderableResult: false,
    })
    expect(v.state).toBe('results_stale')
  })

  it('no report at all is still ready_to_analyse, never ran_without_result', () => {
    // The new state is about a run that FINISHED and returned nothing. A model
    // that has not run is a different situation and keeps its own copy.
    const v = deriveAnalysisDisplayState({
      ...READY,
      hasReport: false,
      analysisChanged: false,
      hasRenderableResult: false,
    })
    expect(v.state).toBe('ready_to_analyse')
  })

  it('an explicitly not-ready model outranks everything — the gate order is unchanged', () => {
    const v = deriveAnalysisDisplayState({
      // A REAL member of ANALYSIS_READY_STATUSES — 'not_ready' is not one,
      // and using it silently fell through to the branch under test rather
      // than the one this case names.
      ceeAnalysisReadyStatus: 'blocked',
      hasReport: true,
      analysisChanged: false,
      hasRenderableResult: false,
    })
    expect(v.state).toBe('not_ready')
  })
})

/**
 * Phase 4 — null-probability guard fixture coverage.
 *
 * Kept in the canvas/ui-v2 directory (not src/v5/) so the v5-scoped
 * typecheck (tsconfig.ci.json) does not transitively pull canvas types
 * into scope via a v5-local import. The v5 applyV5State fixtures test
 * does its own behaviour assertions without importing this helper.
 */
import { describe, it, expect } from 'vitest'

import {
  hasAnyRealProbability,
  type InspectorReport,
} from '../useAnalysisResults'

import fullProbsFixture from '../../../../fixtures/v5/run_success_full_probs.json'
import nullProbsFixture from '../../../../fixtures/v5/run_success_null_probs.json'
import staleReadyFixture from '../../../../fixtures/v5/analysis_complete_null_probs_stale_ready.json'

describe('null-probability guard fixture coverage', () => {
  it('full-probs fixture has at least one finite probability', () => {
    const report = (fullProbsFixture as { results: { report: InspectorReport } })
      .results.report
    expect(hasAnyRealProbability(report)).toBe(true)
  })

  it('null-probs fixture has zero finite probabilities', () => {
    const report = (nullProbsFixture as unknown as {
      results: { report: InspectorReport }
    }).results.report
    expect(hasAnyRealProbability(report)).toBe(false)
  })

  it('analysis_complete_null_probs_stale_ready: guard hides "Analysis complete"', () => {
    // Recent failing-trace reproduction. Report carries null per-option
    // probabilities. Guard must return false so InsightsPanel, GoalNode,
    // and renderTimeline all suppress the "Analysis complete" string.
    const report = (staleReadyFixture as unknown as {
      results: { report: InspectorReport }
    }).results.report
    expect(hasAnyRealProbability(report)).toBe(false)
  })
})

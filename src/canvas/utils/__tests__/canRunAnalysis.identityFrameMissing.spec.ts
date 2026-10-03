/**
 * CEE #2317 (R3 Science, 29 Sep): readiness now blocks a stated identity with a frameless part, carrying the Run's own
 * unit question as `IDENTITY_FRAME_MISSING` (`repairability: human_input_required`). Canvas's consumer: the Run control
 * is shut and SAYS that question — the served first-pass case on `823bc028`, now asked before the click.
 * The message is CEE's verbatim string from #2317 @ 808d2167.
 */
import { describe, it, expect } from 'vitest'
import { canRunAnalysis } from '../canRunAnalysis'
import { gateBlockedSubline } from '../../components/pre-analysis-v3/footer/readinessDisplay'
import type { GraphReadiness, ReadinessIssue } from '../../hooks/useGraphReadiness'

const ASK = 'What unit is "New paying subscribers" in? Olumi needs it to work out "Incremental MRR" from it.'
const ISSUE = {
  message: ASK, code: 'IDENTITY_FRAME_MISSING', factor_id: 'new_paying_subscribers', factor_label: 'New paying subscribers',
  obligation: 'required',
} as unknown as ReadinessIssue

function readiness(issues: ReadinessIssue[]): GraphReadiness {
  return {
    readiness_score: 60, readiness_level: 'needs_work', can_run_analysis: false, confidence_explanation: '',
    improvements: [], options_ready: 4, options_total: 4, goal_node_valid: true, may_run: false,
    blocker_reason: ASK, readiness_issues: issues,
  } as unknown as GraphReadiness
}
const gate = (r: GraphReadiness) =>
  canRunAnalysis({ graphHealth: null, readiness: r, analysisReadiness: null as never, mayRun: false, hasBlockers: true, nodeCount: 14, isRunning: false, readinessStale: false } as never)

describe('IDENTITY_FRAME_MISSING shuts the Run control and says the unit question', () => {
  it('the gate is shut, and the words under the button carry the question verbatim', () => {
    const r = gate(readiness([ISSUE]))
    expect(r.allowed).toBe(false)
    const said = [gateBlockedSubline(r.reason), ...(r.blockedListing?.sentences ?? []).map((s) => s.text)].join(' ')
    expect(said).toContain('What unit is "New paying subscribers" in?')
  })
})

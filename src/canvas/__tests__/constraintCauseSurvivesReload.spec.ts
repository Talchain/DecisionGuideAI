/**
 * ⭐ THE PRODUCER'S LIMIT CAUSE TRAVELS WITH THE RESULT IT QUALIFIES — through
 * the real turn leg, the autosave slot, a fresh page and the boot restore
 * (Codex #1921 5804215687; RC #63 5803875794 P0 #3c).
 *
 * The card's `Goal only` (on the share line, full meaning "your limits aren't
 * in this share" in its name and tooltip — ED #63 5806207128 choice 3) reads
 * `results.report.producer_leader_permission.producer_cause`. The live
 * `analysis_state` envelope is session-local and NOT persisted, so a qualifier
 * read from it vanished on reload and on any later turn without the envelope.
 * Harness from `withheldLeaderClaimSurvivesReload.spec.ts` (same real chain:
 * applyV5State → store → localStorage → restoreAnalysisFromAutosave).
 */
import { describe, it, expect, beforeEach } from 'vitest'

import { useCanvasStore } from '../store'
import { loadAutosave } from '../store/scenarios'
import { restoreAnalysisFromAutosave } from '../store/restoreAnalysisFromAutosave'
import { applyV5State, type V5ApplicatorStore } from '../../v5/applyV5State'

const SCENARIO_ID = 'c475a0c1-fb3c-448e-b3ef-91ae5cd01f8d'

/**
 * The live V5 `analysis_result` block shape.
 *
 * ⚠ THE ENRICHMENT IS LOAD-BEARING, NOT DECORATION, and a first cut of this
 * file omitted it and produced a PRECONDITION that could never pass. Derived at
 * `v5/mapV5AnalysisToReport.ts`: the mapped report's `robustness` is an
 * explicit KEEP-LIST that DROPS `near_tie`, so on this path the leading option
 * is authorised by `decision_brief.headline_banded` alone — Authority 2, which
 * the mapper does carry through. Measured on the mapped report:
 * `{ leaderId: 'opt_freehold', separation: 'clear', hasLeadingOption: true,
 *    gapPp: 49, source: 'producer_band' }`. Without this block there is no
 * claim to withdraw and every assertion below would be about nothing
 * (CLAUDE.md trap 13).
 */
const ANALYSIS_BLOCK = {
  type: 'analysis_result' as const,
  summary: 'Buy Freehold Unit Outright leads.',
  leading_option_id: 'opt_freehold',
  win_probabilities: { opt_freehold: 0.71, opt_relocate: 0.22 },
  enrichment: {
    robustness: { recommended_option_id: 'opt_freehold' },
    decision_brief: {
      headline_banded: { band: 'clearly_ahead', leader_option_id: 'opt_freehold' },
    },
    option_comparison: [
      { option_id: 'opt_freehold', option_label: 'Buy freehold', win_probability: 0.71 },
      { option_id: 'opt_relocate', option_label: 'Relocate', win_probability: 0.22 },
    ],
  },
}

/** CEE's composed verdict. `.strict()` at every level, so this is the contract
 *  shape and not a convenient approximation of it. */
function analysisState(permitted: boolean, withheldReason = 'constraint_verdict_withheld') {
  return {
    run_state: { kind: 'complete_current', computed_at: '2026-09-04T10:00:00Z' },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: permitted
      ? { permitted: true }
      : { permitted: false, withheld_reason: withheldReason },
    robustness: {},
    usable_for_prose: permitted,
    usable_for_chips: permitted,
    usable_for_followup: permitted,
    requires_rerun: !permitted,
    blocked_unusable: false,
    contradictions: [],
  }
}

function v5Response(permitted: boolean, withheldReason?: string) {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [ANALYSIS_BLOCK],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    analysis_state: analysisState(permitted, withheldReason),
  } as never
}

/** The applicator store, built from the REAL canvas store — not a double. */
function realApplicatorStore(): V5ApplicatorStore {
  const s = useCanvasStore.getState()
  return {
    setCurrentStage: s.setCurrentStage,
    updateNode: s.updateNode,
    updateEdgeData: s.updateEdgeData,
    setRunMeta: s.setRunMeta,
    setCeeAnalysisReady: s.setCeeAnalysisReady,
    setAnalysisFreshness: s.setAnalysisFreshness,
    setAnalysisStateV1: s.setAnalysisStateV1,
    resultsComplete: s.resultsComplete,
    resultsWithholdLeaderClaim: s.resultsWithholdLeaderClaim,
    nodes: s.nodes,
    edges: s.edges,
    currentResultsHash: s.results.hash ?? null,
  } as V5ApplicatorStore
}

/** Everything a reload destroys: a brand-new page load. */
function simulateReturnToAFreshPage(): void {
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 },
    hasCompletedFirstRun: false,
    analysisStateV1: null,
  } as never)
}


const cause = () =>
  (useCanvasStore.getState().results.report as { producer_leader_permission?: { producer_cause?: string } } | null)
    ?.producer_leader_permission?.producer_cause

describe('the limit cause survives the reload and later turns (Codex 5804215687)', () => {
  beforeEach(() => {
    localStorage.clear()
    useCanvasStore.setState({
      nodes: [
        { id: 'opt_freehold', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Buy freehold' } },
        { id: 'opt_relocate', type: 'option', position: { x: 200, y: 0 }, data: { label: 'Relocate' } },
      ],
      edges: [],
      results: { status: 'idle', progress: 0 },
      currentScenarioId: SCENARIO_ID,
    } as never)
  })

  it('a constraint_verdict_withheld turn stamps the producer cause on the result, and it survives a reload', () => {
    applyV5State(v5Response(false, 'constraint_verdict_withheld'), realApplicatorStore())
    expect(cause()).toBe('constraint_verdict_withheld')
    simulateReturnToAFreshPage()
    expect(useCanvasStore.getState().results.report ?? null).toBeNull() // the reload really emptied it
    restoreAnalysisFromAutosave(loadAutosave(), useCanvasStore.getState().resultsLoadHistorical)
    expect(useCanvasStore.getState().analysisStateV1 ?? null).toBeNull() // no live envelope after reload
    expect(cause()).toBe('constraint_verdict_withheld')
  })

  it('a LATER turn without analysis_state keeps the cause on the still-displayed result', () => {
    applyV5State(v5Response(false, 'constraint_verdict_withheld'), realApplicatorStore())
    const ideation = { response_version: 2, assistant_text: 'An idea.', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'ideate' } as never
    applyV5State(ideation, realApplicatorStore())
    expect(cause()).toBe('constraint_verdict_withheld')
  })

  it('CONTRAST — another reason is carried as ITSELF, never as the limit cause', () => {
    applyV5State(v5Response(false, 'separation_unavailable'), realApplicatorStore())
    expect(cause()).toBe('separation_unavailable')
  })

  it('CONTRAST — a permitting run carries no cause', () => {
    applyV5State(v5Response(true), realApplicatorStore())
    expect(cause()).toBeUndefined()
  })

  it('a REPLACEMENT permitting result clears the old result\'s cause', () => {
    applyV5State(v5Response(false, 'constraint_verdict_withheld'), realApplicatorStore())
    expect(cause()).toBe('constraint_verdict_withheld')
    const next = { ...(v5Response(true) as Record<string, unknown>), blocks: [{ ...ANALYSIS_BLOCK, summary: 'A new run.', win_probabilities: { opt_freehold: 0.6, opt_relocate: 0.4 } }] } as never
    applyV5State(next, realApplicatorStore())
    expect(cause()).toBeUndefined()
  })
})

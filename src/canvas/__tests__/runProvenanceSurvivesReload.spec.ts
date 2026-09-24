/**
 * run_provenance (CEE's typed "automatic first pass" marker) survives from the
 * turn to the report and through a reload. Harness copied from
 * `constraintCauseSurvivesReload.spec.ts`: the REAL applicator and store.
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
/** Runtime 5818605567: CEE's typed marker for the run Olumi started by itself. */
const RUN_PROVENANCE = { initiated_by: 'auto_post_construction', provisional: true, construction_turn_id: 'turn-build-1' }

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
    run_provenance: RUN_PROVENANCE,
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

function v5Response(permitted: boolean, withheldReason?: string, block: unknown = ANALYSIS_BLOCK) {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [block],
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


const provenance = () =>
  (useCanvasStore.getState().results.report as { run_provenance?: Record<string, unknown> } | null)?.run_provenance

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

/**
 * ⭐ THE TYPED PROVISIONAL MARKER REACHES THE REPORT AND SURVIVES A RELOAD.
 *
 * Traced at staging `bfb2d0b2`: the block's `enrichment` is `z.record` (keeps
 * every key) and autosave persists `results.report` whole, but
 * `mapV5AnalysisToReport` copies only the enrichment keys it knows, so
 * `run_provenance` was dropped between the two. RC 5818628860 §4: "clearly
 * provisional" needs the marker on the turn AND after reload.
 */
describe('run_provenance: the turn, the report, the reload', () => {
  it('a turn carrying the marker stamps it on the report verbatim, and it survives a reload', () => {
    applyV5State(v5Response(false), realApplicatorStore())
    expect(provenance()).toEqual(RUN_PROVENANCE)
    simulateReturnToAFreshPage()
    expect(useCanvasStore.getState().results.report ?? null).toBeNull() // the reload really emptied it
    restoreAnalysisFromAutosave(loadAutosave(), useCanvasStore.getState().resultsLoadHistorical)
    expect(provenance()).toEqual(RUN_PROVENANCE)
  })

  it('CONTRAST: a turn without the marker leaves no provenance on the report', () => {
    const { run_provenance: _dropped, ...rest } = ANALYSIS_BLOCK.enrichment
    applyV5State(v5Response(false, undefined, { ...ANALYSIS_BLOCK, enrichment: rest }), realApplicatorStore())
    expect(useCanvasStore.getState().results.report).not.toBeNull()
    expect(provenance()).toBeUndefined()
  })
})

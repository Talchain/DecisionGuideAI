/**
 * A REFUSAL THE USER RELOADS PAST — W1-e (c), the client half.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HARM, WITNESSED ON DEPLOYED STAGING `113375a1` (drive 3, 4 Sep 2026)
 * ═══════════════════════════════════════════════════════════════════════════
 * CEE refuses to name a leading option. The refusal renders in the
 * conversation. The user reloads. Measured post-reload: "did not run" 0
 * occurrences, "Leading option" 1, "49%" 7. **The honest half was transient and
 * the unsafe half was durable, which is exactly backwards.**
 *
 * ⭐ WHAT THIS FILE PROVES, AND WHAT IT DOES NOT (CLAUDE.md trap 3, and the
 * scope correction its sibling `analysisSurvivesLeaveAndReturn.spec.ts` had to
 * make about itself):
 *
 *   IT DOES PROVE  the LIVE producer (`applyV5State`, the real handler for the
 *                  `analysis_result` block and for `analysis_state`) driving
 *                  the REAL canvas store, the withholding landing in the REAL
 *                  `localStorage` autosave slot beside the report it is about,
 *                  the restore helper the boot path calls putting it back, and
 *                  `deriveDecisionVerdict` — the one module entitled to answer
 *                  "is there a leading option?" — refusing over the restored
 *                  report.
 *   IT DOES NOT    prove ReactFlowGraph's mount effect calls that helper, and
 *   PROVE          it makes no rendering or visibility claim whatsoever. jsdom
 *                  cannot establish either. Those need a deployed witness, and
 *                  this lane has none — the PR says so.
 *
 * Every store double here would have passed against the broken code too, which
 * is why there are none: the chain producer → store → localStorage → restore →
 * verdict is the deployed one end to end.
 */
import { describe, it, expect, beforeEach } from 'vitest'

import { useCanvasStore } from '../store'
import { loadAutosave } from '../store/scenarios'
import { restoreAnalysisFromAutosave } from '../store/restoreAnalysisFromAutosave'
import { applyV5State, type V5ApplicatorStore } from '../../v5/applyV5State'
import {
  deriveDecisionVerdict,
  type DecisionVerdictReportLike,
} from '../../lib/decisionVerdict'

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
function analysisState(permitted: boolean) {
  return {
    run_state: { kind: 'complete_current', computed_at: '2026-09-04T10:00:00Z' },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: permitted
      ? { permitted: true }
      : { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: permitted,
    usable_for_chips: permitted,
    usable_for_followup: permitted,
    requires_rerun: !permitted,
    blocked_unusable: false,
    contradictions: [],
  }
}

function v5Response(permitted: boolean) {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [ANALYSIS_BLOCK],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    analysis_state: analysisState(permitted),
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

/** The verdict as a surface would compute it — from the store's own report. */
function verdictOverHeldReport() {
  return deriveDecisionVerdict(
    useCanvasStore.getState().results.report as DecisionVerdictReportLike | null,
  )
}

describe('a withheld leader claim survives the reload the refusal does not', () => {
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

  it('PRECONDITION: a PERMITTING turn names a leader, and still does after the reload', () => {
    // The positive control for everything below. Without it the withholding
    // assertions could pass because the restore never worked at all — an
    // absence probe pointed at nothing (CLAUDE.md trap 13).
    applyV5State(v5Response(true), realApplicatorStore())
    expect(verdictOverHeldReport().hasLeadingOption).toBe(true)

    simulateReturnToAFreshPage()
    expect(
      restoreAnalysisFromAutosave(loadAutosave(), useCanvasStore.getState().resultsLoadHistorical),
    ).toBe(true)
    expect(verdictOverHeldReport().hasLeadingOption).toBe(true)
  })

  it('DEFECT SIGNATURE: the withholding is still in force after a reload', () => {
    applyV5State(v5Response(false), realApplicatorStore())
    // Live: the claim is already withdrawn.
    expect(verdictOverHeldReport().hasLeadingOption).toBe(false)

    simulateReturnToAFreshPage()
    expect(
      restoreAnalysisFromAutosave(loadAutosave(), useCanvasStore.getState().resultsLoadHistorical),
    ).toBe(true)

    // ⭐ THE ASSERTION THE WITNESSED DRIVE FAILED. Post-reload the deployed
    // build resurrected the designation because nothing carried the producer's
    // refusal across the page load.
    expect(verdictOverHeldReport().hasLeadingOption).toBe(false)
  })

  it('the RESULT DATA survives the withholding — it is marked, never deleted', () => {
    applyV5State(v5Response(false), realApplicatorStore())
    simulateReturnToAFreshPage()
    restoreAnalysisFromAutosave(loadAutosave(), useCanvasStore.getState().resultsLoadHistorical)

    const report = useCanvasStore.getState().results.report
    expect(report?.option_probabilities?.opt_freehold?.win_probability).toBe(0.71)
    expect(report?.option_probabilities?.opt_relocate?.win_probability).toBe(0.22)
    // Identity survives too: the non-claiming consumers — ordering, focus, the
    // decision record — must keep working under a withheld designation.
    expect(verdictOverHeldReport().leaderId).toBe('opt_freehold')
  })

  it('the withholding reaches the PERSISTED record, not just the in-memory slice', () => {
    // Bound to the artefact by IDENTITY: read out of the autosave slot itself,
    // so a slice-only write — which would not survive the page load — cannot
    // satisfy this.
    applyV5State(v5Response(false), realApplicatorStore())
    const stored = loadAutosave()
    expect(stored?.analysis?.report?.producer_leader_permission).toEqual({
      permitted: false,
      withheld_reason: 'leader_claim_withheld',
    })
  })

  it('a NEW permitting run clears the withholding — permission returns the only way it safely can', () => {
    // The one-way property, driven rather than asserted. There is no action
    // that GRANTS; a fresh report simply carries no stamp, so the next genuine
    // run restores the designation without any client deciding the producer has
    // changed its mind.
    applyV5State(v5Response(false), realApplicatorStore())
    expect(verdictOverHeldReport().hasLeadingOption).toBe(false)

    const rerun = v5Response(true) as unknown as { blocks: Array<Record<string, unknown>> }
    // A genuinely different analysis: a new content hash, so the store's dedupe
    // does not skip the write. Pinned below, or this test proves nothing.
    rerun.blocks[0]!.summary = 'Buy Freehold Unit Outright leads, on a rerun.'
    const hashBefore = useCanvasStore.getState().results.hash
    applyV5State(rerun as never, realApplicatorStore())
    expect(useCanvasStore.getState().results.hash).not.toBe(hashBefore)

    expect(verdictOverHeldReport().hasLeadingOption).toBe(true)
  })
})

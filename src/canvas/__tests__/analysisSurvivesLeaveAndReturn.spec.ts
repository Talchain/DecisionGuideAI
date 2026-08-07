/**
 * THE ANSWER MUST SURVIVE LEAVING AND COMING BACK.
 *
 * THE DEFECT THIS PINS — reproduced 1/1 on DEPLOYED staging (bundle
 * `index-BlVFnI6e.js`, 26 Jul 2026), by running a real conversation-driven
 * analysis, navigating to the Olumi home screen and returning via "Continue
 * without an account":
 *
 *   before leaving  results.status = 'complete', report present (20,644 B),
 *                   hash 'v5:c9185f4c9c602851', "Buy Freehold Unit Outright
 *                   currently leads by 78 percentage points" on screen
 *   after returning 19 nodes restored, results.status = 'idle', no report,
 *                   hasCompletedFirstRun = false, "Analyse first pass" on screen
 *
 * The chat still showed the assistant stating the answer while the Results panel
 * claimed nothing had been run.
 *
 * TWO DEAD LINKS, both live-probed in the same session:
 *   1. the WRITE — run history is gated on a SEED, and the live V5 path has
 *      none (`'seed' in results === false`; `olumi-canvas-run-history` absent);
 *   2. the POINTER — `last_result_hash` is written onto a SCENARIO record that
 *      guest mode never creates (`olumi-canvas-scenarios` absent).
 *
 * THE FIX these tests pin: the completed analysis rides the ONE record that
 * demonstrably survives and is demonstrably read back at boot — the autosave —
 * and is restored from there. See store/scenarios.ts `PersistedAnalysis`.
 *
 * ⚠ CLAIM TYPE, stated precisely because this exact defect was once reported
 * fixed on the strength of a store test that was inert on the deployed path
 * (see store.conversationRunSurvivesReload.spec.ts's own header):
 *   - These tests DO prove the live PRODUCER (`applyV5State`, the real handler
 *     for the `analysis_result` block) drives the real store, that the answer
 *     lands in the real `localStorage` autosave slot, and that the restore
 *     helper the boot path calls puts it back.
 *   - They do NOT prove ReactFlowGraph's mount effect calls that helper, and
 *     they are NOT a rendering or visibility claim. jsdom cannot establish
 *     either. Those are evidenced ONLY by the live deployed leave-and-return
 *     recorded in the PR description.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useCanvasStore } from '../store'
import { loadAutosave, saveAutosave, type AutosaveData } from '../store/scenarios'
import { projectAutosaveData, autosaveSourceFromStore } from '../store/autosaveProjection'
import { restoreAnalysisFromAutosave } from '../store/restoreAnalysisFromAutosave'
import { loadRuns } from '../store/runHistory'
import { deriveStageFromState } from '../hooks/useStagePill'
import { applyV5State, type V5ApplicatorStore } from '../../v5/applyV5State'
import type { ReportV1 } from '../../adapters/plot/types'

const AUTOSAVE_KEY = 'olumi-canvas-autosave'

/** The live V5 analysis_result block shape (captured from staging). */
const analysisBlock = {
  type: 'analysis_result' as const,
  summary: 'Buy Freehold Unit Outright currently leads by 78 percentage points.',
  leading_option_id: 'opt_freehold',
  win_probabilities: { opt_freehold: 0.86, opt_relocate: 0.08, opt_renew: 0.06 },
  enrichment: {
    factor_sensitivity: [
      {
        factor_id: 'fac_retention',
        factor_label: 'Patient Retention Rate at Site',
        sensitivity: 0.75,
        direction: 'positive' as const,
      },
    ],
  },
}

function v5Response(blocks: unknown[]) {
  return {
    response_version: 2,
    assistant_text: '',
    blocks,
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
  } as never
}

function graphNodes() {
  return [
    { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Patient Retention' } },
    { id: 'n2', type: 'option', position: { x: 200, y: 0 }, data: { label: 'Buy Freehold' } },
  ] as never
}

/**
 * The applicator store, built from the REAL canvas store — not a double.
 *
 * This is the point of the test: `applyV5State` is the LIVE handler
 * (applyV5State.ts step 5) and `resultsComplete` here is the real action, so
 * the chain producer → store → localStorage is the deployed one, not a mock of
 * it. A `vi.fn()` double would have passed against the broken code too.
 */
function realApplicatorStore(): V5ApplicatorStore {
  const s = useCanvasStore.getState()
  return {
    setCurrentStage: s.setCurrentStage,
    updateNode: s.updateNode,
    updateEdgeData: s.updateEdgeData,
    setRunMeta: s.setRunMeta,
    setCeeAnalysisReady: s.setCeeAnalysisReady,
    setAnalysisFreshness: s.setAnalysisFreshness,
    resultsComplete: s.resultsComplete,
    nodes: s.nodes,
    edges: s.edges,
    currentResultsHash: s.results.hash ?? null,
  } as V5ApplicatorStore
}

/**
 * `summary` is not declared on `ReportV1` — it rides the runtime payload and
 * the store itself reads it through an index cast (store.ts's robustness
 * probe). Same pattern here rather than asserting a field the type does not
 * have; it is the value the user sees, so the test reads it honestly.
 */
function reportSummary(report: unknown): unknown {
  return (report as Record<string, unknown> | null | undefined)?.summary
}

/** Everything the deployed leave-and-return destroys: a brand-new page load. */
function simulateReturnToAFreshPage(): void {
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 },
    hasCompletedFirstRun: false,
    nodes: [],
    edges: [],
  } as never)
}

describe('a completed analysis survives leaving the canvas and returning', () => {
  beforeEach(() => {
    localStorage.clear()
    useCanvasStore.setState({
      nodes: graphNodes(),
      edges: [] as never,
      results: { status: 'idle', progress: 0 },
      currentScenarioId: 'c475a0c1-fb3c-448e-b3ef-91ae5cd01f8d',
      hasCompletedFirstRun: false,
    } as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POSITIVE CONTROL — the probe sees the ABSENT case: no analysis run ⇒ nothing restored', () => {
    // Prove this spec can observe the failure it later asserts is gone.
    // Without this, "results.status === complete" after the fix would be
    // unfalsifiable (CLAUDE.md trap #13).
    saveAutosave(
      projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState() as never)),
    )
    const stored = loadAutosave()
    expect(stored).toBeTruthy()
    expect(stored?.analysis ?? null).toBeNull()

    simulateReturnToAFreshPage()
    const restored = restoreAnalysisFromAutosave(
      stored,
      useCanvasStore.getState().resultsLoadHistorical,
    )
    expect(restored).toBe(false)
    expect(useCanvasStore.getState().results.status).toBe('idle')
  })

  it('the LIVE V5 path persists the answer into the autosave record', () => {
    // Exactly the deployed sequence: resultsAnalysing (never resultsStart, so
    // no seed), then applyV5State's analysis_result branch.
    useCanvasStore.getState().resultsAnalysing()
    expect(useCanvasStore.getState().results.seed).toBeUndefined()

    applyV5State(v5Response([analysisBlock]), realApplicatorStore())

    expect(useCanvasStore.getState().results.status).toBe('complete')

    const stored = loadAutosave()
    expect(stored?.analysis).toBeTruthy()
    expect(stored?.analysis?.report).toBeTruthy()
    expect(stored?.analysis?.hash).toBe(useCanvasStore.getState().results.hash)
    expect(stored?.analysis?.resultsSource).toBe('conversation')
    expect(typeof stored?.analysis?.computedAt).toBe('string')
  })

  it('⭐ the returning user gets the ANSWER back, not "Analyse first pass"', () => {
    useCanvasStore.getState().resultsAnalysing()
    applyV5State(v5Response([analysisBlock]), realApplicatorStore())
    const hashBefore = useCanvasStore.getState().results.hash
    const summaryBefore = reportSummary(useCanvasStore.getState().results.report)

    // The journey: the page goes away, localStorage does not.
    simulateReturnToAFreshPage()
    expect(useCanvasStore.getState().results.status).toBe('idle')

    const restored = restoreAnalysisFromAutosave(
      loadAutosave(),
      useCanvasStore.getState().resultsLoadHistorical,
    )

    expect(restored).toBe(true)
    const after = useCanvasStore.getState()
    // 'complete' vs 'idle' is exactly what the Results panel branches on:
    // 'idle' renders the "Analysis available / Analyse first pass" state.
    expect(after.results.status).toBe('complete')
    expect(after.results.hash).toBe(hashBefore)
    expect(reportSummary(after.results.report)).toBe(summaryBefore)
    expect(after.hasCompletedFirstRun).toBe(true)
  })

  it('the stage stops regressing to Ideate — it follows from the restored result', () => {
    // The reported symptom "the stage regresses from Evaluate/Analyse back to
    // Ideate/Frame" is a CONSEQUENCE, not a separate thing to persist:
    // useStagePill falls back to deriveStageFromState(hasNodes, isComplete)
    // where isComplete = status==='complete' || hasCompletedFirstRun. Pinned
    // here so nobody "fixes" it by persisting `currentStage` separately and
    // re-creating the divergence this lane is deleting.
    useCanvasStore.getState().resultsAnalysing()
    applyV5State(v5Response([analysisBlock]), realApplicatorStore())

    simulateReturnToAFreshPage()
    useCanvasStore.setState({ nodes: graphNodes() } as never)
    expect(deriveStageFromState(true, false)).toBe('ideate') // the regression
    restoreAnalysisFromAutosave(loadAutosave(), useCanvasStore.getState().resultsLoadHistorical)

    const s = useCanvasStore.getState()
    expect(deriveStageFromState(s.nodes.length > 0, s.results.status === 'complete')).toBe(
      'evaluate',
    )
  })

  it('invents NO seed — the seed-gated run history stays empty and honest', () => {
    useCanvasStore.getState().resultsAnalysing()
    applyV5State(v5Response([analysisBlock]), realApplicatorStore())

    // A run identity built on a fabricated seed forks the graph hash
    // (CLAUDE.md trap #10). The fix routes around the seed; it must not
    // resurrect the seed path by defaulting one.
    expect(loadRuns()).toHaveLength(0)
    expect(loadAutosave()?.analysis?.seed).toBeUndefined()

    simulateReturnToAFreshPage()
    restoreAnalysisFromAutosave(loadAutosave(), useCanvasStore.getState().resultsLoadHistorical)
    expect(useCanvasStore.getState().results.seed).toBeUndefined()
  })

  it('a later autosave write does NOT strip the answer back out', () => {
    // saveAutosave REPLACES. Before the projection carried `analysis`, the very
    // next graph edit would have silently overwritten the record that held the
    // user's answer — the partial-write class that made autosaveProjection
    // necessary in the first place (#386, ceeAnalysisReady).
    useCanvasStore.getState().resultsAnalysing()
    applyV5State(v5Response([analysisBlock]), realApplicatorStore())
    expect(loadAutosave()?.analysis).toBeTruthy()

    saveAutosave(
      projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState() as never)),
    )
    expect(loadAutosave()?.analysis?.report).toBeTruthy()
  })

  it('a quota failure drops the ANALYSIS and keeps the GRAPH — never the reverse', () => {
    const payloads: string[] = []
    let first = true
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation((key: string, value: string) => {
        if (key === AUTOSAVE_KEY) {
          if (first) {
            first = false
            throw new DOMException('quota', 'QuotaExceededError')
          }
          payloads.push(value)
          return
        }
        return
      })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const data: AutosaveData = projectAutosaveData({
      nodes: graphNodes(),
      edges: [] as never,
      scenarioId: 'sc1',
      ceeAnalysisReady: undefined,
      selectedGoalNode: null,
      analysis: {
        hash: 'v5:abc',
        computedAt: new Date().toISOString(),
        report: { summary: 'x' } as unknown as ReportV1,
      },
    })
    saveAutosave(data)

    expect(setItem).toHaveBeenCalled()
    expect(payloads).toHaveLength(1)
    const retried = JSON.parse(payloads[0]) as AutosaveData
    expect(retried.nodes).toHaveLength(2) // the user's work survived
    expect(retried.analysis).toBeNull() // the recomputable part was dropped
    // The degradation is DECLARED, never silent.
    expect(warn).toHaveBeenCalled()
  })

  it('a corrupt persisted analysis degrades to "no answer", not to a broken store', () => {
    saveAutosave({
      timestamp: Date.now(),
      nodes: graphNodes(),
      edges: [] as never,
      analysis: { computedAt: 'not-a-date', report: null as never },
    })
    simulateReturnToAFreshPage()
    expect(
      restoreAnalysisFromAutosave(loadAutosave(), useCanvasStore.getState().resultsLoadHistorical),
    ).toBe(false)
    expect(useCanvasStore.getState().results.status).toBe('idle')
  })
})

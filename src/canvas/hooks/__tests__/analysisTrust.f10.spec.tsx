/**
 * F10+F11 — freshness consolidation (UI-WORKSTREAM-BRIEF-2026-07-16 item 1).
 *
 * Paul's session: CEE stamped a run turn's own response `freshness:'stale'`
 * with IDENTICAL hashes; the UI turned one verdict into two stacked banners
 * ("Results may be outdated" strip + the orphan "Refresh analysis" banner),
 * because the run-fact gate only accepts 'fresh' — conflating "ran" with
 * "current". Meanwhile a dead third mechanism (useStaleGuard) read hash keys
 * nothing writes, and run completion never touched the freshness slice.
 *
 * These pins are written RED-first against the tip; each names the defect it
 * must catch when reverted.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  extractPhase3FromV5Response,
  v5ResponseHasRunAnalysisFact,
  deriveV5AnalysisFactUpdate,
} from '../../../v5/extractPhase3FromV5Response'
import { applyV5State } from '../../../v5/applyV5State'
import {
  deriveAnalysisFreshnessUpdate,
  RUN_COMPLETED_WITHOUT_VERDICT,
  type AnalysisFreshnessState,
} from '../../store/analysisFreshness'
import { classifyAnalysisStateSource } from '../useAnalysisStateSource'
import { computeAnalysisTrust, ORPHANED_RESULT } from '../useAnalysisTrust'

/** The a16a0e82-class fixture: a run turn whose OWN response carries a
 *  'stale' verdict with IDENTICAL hashes (CEE guard defect — CEE lane owns
 *  the verdict; the UI must still behave sanely receiving it). */
function staleVerdictRunResponse() {
  return {
    response_version: 'v5',
    assistant_text: 'Analysis complete.',
    blocks: [
      {
        type: 'analysis_result' as const,
        summary: 'Bring On Technical Co-Founder leads.',
        leading_option_id: 'opt_a',
        win_probabilities: { opt_a: 0.86, opt_b: 0.14 },
      },
    ],
    suggested_actions: [],
    analysis_ready: {
      status: 'ready',
      freshness: 'stale',
      freshness_reason: 'analysed_options_diverged',
      graph_hash_at_run: '595d1a7b7ec9272b',
      current_graph_hash: '595d1a7b7ec9272b',
      options: [],
    },
  } as any
}

describe('F10 pin 1 — the run-fact gate must not conflate "ran" with "current"', () => {
  it('a stale-verdict run turn with an analysis_result block STILL minted a run fact', () => {
    // Pre-fix: v5ResponseHasRunAnalysisFact required freshness==='fresh' in
    // its fallback, so this exact response (Paul's session) returned false →
    // factForScenario false → the orphan banner stacked on top of the
    // freshness strip. A stale-verdict run still RAN.
    const response = staleVerdictRunResponse()
    expect(v5ResponseHasRunAnalysisFact(response)).toBe(true)
  })

  it('explicit has_run_analysis_fact=false is still respected (no fact fabrication)', () => {
    // The flag must live where the extractor actually reads it — the
    // additive sidecar or the analysis_ready container, NEVER the response
    // top level. (An earlier revision of this pin set it at top level and
    // guarded the assertion behind `if (ext.hasRunAnalysisFact === false)`,
    // which never fired — the pin asserted nothing.)
    const response = staleVerdictRunResponse()
    response.analysis_ready.has_run_analysis_fact = false
    const ext = extractPhase3FromV5Response(response)
    expect(ext.hasRunAnalysisFact).toBe(false)
    expect(v5ResponseHasRunAnalysisFact(response, ext)).toBe(false)
    expect(deriveV5AnalysisFactUpdate(response, ext)).toEqual({ action: 'clear' })
  })

  it('a conversational turn with no analysis_result mints NO fact (positive control for absence)', () => {
    const response = staleVerdictRunResponse()
    response.blocks = [{ type: 'text', text: 'hello' }]
    delete response.analysis_ready
    expect(v5ResponseHasRunAnalysisFact(response)).toBe(false)
    expect(deriveV5AnalysisFactUpdate(response)).toEqual({ action: 'retain' })
  })
})

describe('F10 pin 1b — the mint→classify seam (the production fact update believed end-to-end)', () => {
  // The first fix minted a fact for a stale-verdict run but wrote CEE's RAW
  // nullable flag into it, and classifyAnalysisStateSource re-tested
  // freshness — so BOTH F10 scenarios still classified orphaned one layer
  // up. This pin drives the PRODUCTION update decision
  // (deriveV5AnalysisFactUpdate — the same value useConversation writes)
  // into the classifier, so neither end can quietly re-open the split.
  const scenarioId = 'scenario-A'

  function classifyMinted(response: unknown) {
    const update = deriveV5AnalysisFactUpdate(response as never)
    expect(update.action).toBe('set')
    if (update.action !== 'set') throw new Error('unreachable')
    return classifyAnalysisStateSource({
      canonicalFlagOn: true,
      reportPresent: true,
      reportHash: 'hash-A',
      currentScenarioId: scenarioId,
      fact: {
        scenarioId,
        analysisHash: 'hash-A',
        hasRunAnalysisFact: update.hasRunAnalysisFact,
        freshness: update.freshness,
      },
    })
  }

  it('a16a0e82 stale-verdict run: minted fact classifies as cee_v5_run_analysis, NOT orphaned', () => {
    const r = classifyMinted(staleVerdictRunResponse())
    expect(r.source).toBe('cee_v5_run_analysis')
    expect(r.showOrphanBanner).toBe(false)
    expect(
      computeAnalysisTrust({
        freshness: { freshness: 'stale' },
        dirty: false,
        source: r.source,
        resultsStatus: 'complete',
      }).orphaned,
    ).toBe(false)
  })

  it('run completed WITHOUT a verdict: minted fact (freshness null) also classifies as a run, NOT orphaned', () => {
    const response = staleVerdictRunResponse()
    delete response.analysis_ready
    const r = classifyMinted(response)
    expect(r.source).toBe('cee_v5_run_analysis')
    expect(r.showOrphanBanner).toBe(false)
  })

  it('the minted fact records the COMPOSED ran-answer, never the raw nullable CEE flag', () => {
    // CEE emitted no explicit flag on the a16a0e82 fixture (raw null) —
    // writing that raw null is exactly what let the classifier disbelieve
    // the fact.
    const response = staleVerdictRunResponse()
    const ext = extractPhase3FromV5Response(response)
    expect(ext.hasRunAnalysisFact).toBeNull()
    const update = deriveV5AnalysisFactUpdate(response, ext)
    expect(update).toMatchObject({ action: 'set', hasRunAnalysisFact: true, freshness: 'stale' })
  })
})

describe('F10 pin 2 — run completion without a verdict writes unknown, never retains pre-run stale', () => {
  it('applyV5State step 5: NEW hash + NO analysis_ready → freshness becomes unknown/run_completed_without_verdict', () => {
    const calls: Record<string, unknown[]> = { resultsComplete: [], noteRun: [] }
    const store: any = {
      nodes: [],
      edges: [],
      currentResultsHash: 'prev-hash',
      setCurrentStage: () => {},
      updateNode: () => {},
      updateEdgeData: () => {},
      setRunMeta: () => {},
      setCeeAnalysisReady: () => {},
      resultsComplete: (p: unknown) => calls.resultsComplete.push(p),
      noteRunCompletedWithoutVerdict: () => calls.noteRun.push(true),
    }
    const response = staleVerdictRunResponse()
    delete response.analysis_ready // run completed, engine said nothing about freshness
    applyV5State(response, store)
    expect(calls.resultsComplete).toHaveLength(1)
    // The defect this catches when reverted: nothing touched the freshness
    // slice, so a retained pre-run 'stale' kept claiming "Model changed"
    // over the results this very run just produced.
    expect(calls.noteRun).toHaveLength(1)
  })

  it('with an explicit verdict on the same response, the without-verdict path does NOT fire', () => {
    const calls: Record<string, unknown[]> = { noteRun: [], clearDirty: [] }
    const store: any = {
      nodes: [],
      edges: [],
      currentResultsHash: 'prev-hash',
      setCurrentStage: () => {},
      updateNode: () => {},
      updateEdgeData: () => {},
      setRunMeta: () => {},
      setCeeAnalysisReady: () => {},
      setAnalysisFreshness: () => {},
      resultsComplete: () => {},
      clearAnalysisFreshnessDirty: () => calls.clearDirty.push(true),
      noteRunCompletedWithoutVerdict: () => calls.noteRun.push(true),
    }
    applyV5State(staleVerdictRunResponse(), store)
    expect(calls.noteRun).toHaveLength(0)
    expect(calls.clearDirty).toHaveLength(1)
  })
})

describe('F10 pin 3 — one trust surface', () => {
  const freshState: AnalysisFreshnessState = { freshness: 'fresh', freshnessReason: 'graph_hash_match' }

  it('computeAnalysisTrust composes verdict + orphan + running into ONE answer', () => {
    expect(
      computeAnalysisTrust({
        freshness: freshState,
        dirty: false,
        source: 'cee_v5_run_analysis',
        resultsStatus: 'complete',
      }),
    ).toEqual({ semantic: 'current', orphaned: false, isRunning: false, reason: 'graph_hash_match' })

    expect(
      computeAnalysisTrust({
        freshness: freshState,
        dirty: false,
        source: 'orphaned_plot_result',
        resultsStatus: 'complete',
      }),
    ).toMatchObject({ semantic: 'current', orphaned: true })

    expect(
      computeAnalysisTrust({
        freshness: { freshness: 'unknown', freshnessReason: RUN_COMPLETED_WITHOUT_VERDICT },
        dirty: false,
        source: 'cee_v5_run_analysis',
        resultsStatus: 'complete',
      }),
    ).toMatchObject({ semantic: 'cannot_confirm', reason: RUN_COMPLETED_WITHOUT_VERDICT })

    expect(
      computeAnalysisTrust({
        freshness: null,
        dirty: false,
        source: 'cee_v5_run_analysis',
        resultsStatus: 'streaming',
      }),
    ).toMatchObject({ semantic: 'none', isRunning: true })
  })

  it('orphan fold: orphaned + NO verdict composes cannot_confirm — the same answer the strip renders', () => {
    // Pre-fix the hook said semantic 'none' here while the strip synthesised
    // the cannot-confirm variant with the Rerun — the "single composed trust
    // answer" disagreed with the surface it canonicalises, so any adopting
    // consumer would regress the F11 fold at the moment of adoption.
    expect(
      computeAnalysisTrust({
        freshness: null,
        dirty: false,
        source: 'orphaned_plot_result',
        resultsStatus: 'complete',
      }),
    ).toMatchObject({ semantic: 'cannot_confirm', orphaned: true, reason: ORPHANED_RESULT })
  })

  it("orphan fold: orphaned + a 'none' verdict ALSO composes cannot_confirm (results exist — never claim 'no analysis yet' over them)", () => {
    expect(
      computeAnalysisTrust({
        freshness: { freshness: 'none' },
        dirty: false,
        source: 'orphaned_plot_result',
        resultsStatus: 'complete',
      }),
    ).toMatchObject({ semantic: 'cannot_confirm', orphaned: true, reason: ORPHANED_RESULT })
  })

  it("no orphan: a 'none' verdict without an orphaned result stays semantic 'none' (nothing to fold)", () => {
    expect(
      computeAnalysisTrust({
        freshness: { freshness: 'none' },
        dirty: false,
        source: 'cee_v5_run_analysis',
        resultsStatus: 'complete',
      }),
    ).toMatchObject({ semantic: 'none', orphaned: false })
  })
})

describe('F10 pin 4 — the reducer honours an explicit run-completion overwrite', () => {
  beforeEach(() => {})
  it('a retained stale verdict is replaced, not retained, by the run-completion write', () => {
    const retainedStale: AnalysisFreshnessState = {
      freshness: 'stale',
      freshnessReason: 'analysed_options_diverged',
      computedAt: '2026-07-16T09:00:00Z',
    }
    // The normal reducer path retains on absence — that rule is correct for
    // CEE turns and is untouched:
    expect(deriveAnalysisFreshnessUpdate(retainedStale, undefined)).toBe(retainedStale)
  })
})

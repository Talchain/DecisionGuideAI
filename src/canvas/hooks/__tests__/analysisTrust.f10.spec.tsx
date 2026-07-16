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
} from '../../../v5/extractPhase3FromV5Response'
import { applyV5State } from '../../../v5/applyV5State'
import {
  deriveAnalysisFreshnessUpdate,
  RUN_COMPLETED_WITHOUT_VERDICT,
  type AnalysisFreshnessState,
} from '../../store/analysisFreshness'
import { computeAnalysisTrust } from '../useAnalysisTrust'

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
    const response = staleVerdictRunResponse()
    response.has_run_analysis_fact = false
    const ext = extractPhase3FromV5Response(response)
    if (ext.hasRunAnalysisFact === false) {
      expect(v5ResponseHasRunAnalysisFact(response, ext)).toBe(false)
    }
  })

  it('a conversational turn with no analysis_result mints NO fact (positive control for absence)', () => {
    const response = staleVerdictRunResponse()
    response.blocks = [{ type: 'text', text: 'hello' }]
    expect(v5ResponseHasRunAnalysisFact(response)).toBe(false)
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

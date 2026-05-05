/**
 * Table-driven tests for the analysis-freshness selector
 * (P0 V5 golden-path repair, Wave 3).
 *
 * The selector must report a coherent verdict + recommended action
 * across the four UI surfaces that previously derived this independently:
 *   - pre-analysis panel
 *   - results panel header / hero
 *   - chat composer
 *   - debug overlay
 *
 * Tests cover every branch of the precedence ladder: wire wins → local
 * fallback → no successful run → no options. Wire-side `unknown` is
 * tested explicitly because it's the legacy/edge-case path most likely
 * to drift.
 */

import { describe, it, expect } from 'vitest'

import { deriveAnalysisFreshnessState } from '../analysisFreshnessState'
import type {
  AnalysisFreshnessInputs,
  AnalysisFreshnessState,
} from '../analysisFreshnessState'
import type { CEEAnalysisReady } from '../../adapters/cee/types'

function makeWire(
  freshness: 'fresh' | 'stale' | 'unknown' | 'none' | undefined,
  reason?: string,
): CEEAnalysisReady {
  return {
    options: [],
    goal_node_id: 'goal_1',
    ...(freshness !== undefined ? { freshness } : {}),
    ...(reason !== undefined ? { freshness_reason: reason } : {}),
  } as CEEAnalysisReady
}

function inputs(overrides: Partial<AnalysisFreshnessInputs>): AnalysisFreshnessInputs {
  return {
    ceeAnalysisReady: null,
    graphEditedSinceLastRun: false,
    resultsStatus: 'idle',
    hasOptions: true,
    hasSuccessfulAnalysisResult: false,
    ...overrides,
  }
}

describe('deriveAnalysisFreshnessState — wire freshness wins', () => {
  it('wire fresh → fresh + view_results, no inputsMissing', () => {
    const result = deriveAnalysisFreshnessState(
      inputs({ ceeAnalysisReady: makeWire('fresh', 'graph_hash_match') }),
    )
    expect(result).toEqual<AnalysisFreshnessState>({
      freshness: 'fresh',
      reason: 'graph_hash_match',
      recommendedAction: 'view_results',
      inputsMissing: [],
    })
  })

  it('wire stale → stale + rerun_analysis', () => {
    const result = deriveAnalysisFreshnessState(
      inputs({ ceeAnalysisReady: makeWire('stale', 'graph_hash_diverged') }),
    )
    expect(result.freshness).toBe('stale')
    expect(result.recommendedAction).toBe('rerun_analysis')
    expect(result.reason).toBe('graph_hash_diverged')
  })

  it('wire stale wins over local "no edits" (wire is authoritative)', () => {
    const result = deriveAnalysisFreshnessState(
      inputs({
        ceeAnalysisReady: makeWire('stale', 'graph_hash_diverged'),
        graphEditedSinceLastRun: false,
        hasSuccessfulAnalysisResult: true,
      }),
    )
    expect(result.freshness).toBe('stale')
    expect(result.recommendedAction).toBe('rerun_analysis')
  })

  it('wire fresh wins over local "edited" (wire is authoritative)', () => {
    // The local signal can lag the wire — e.g. a draft edit that the
    // wire round-trip already absorbed. Wire wins.
    const result = deriveAnalysisFreshnessState(
      inputs({
        ceeAnalysisReady: makeWire('fresh', 'graph_hash_match'),
        graphEditedSinceLastRun: true,
        hasSuccessfulAnalysisResult: true,
      }),
    )
    expect(result.freshness).toBe('fresh')
    expect(result.recommendedAction).toBe('view_results')
  })
})

describe('deriveAnalysisFreshnessState — local fallback when wire absent', () => {
  it('no wire, has successful result, no edits → local_results_match (fresh)', () => {
    const result = deriveAnalysisFreshnessState(
      inputs({
        ceeAnalysisReady: null,
        graphEditedSinceLastRun: false,
        hasSuccessfulAnalysisResult: true,
        resultsStatus: 'complete',
      }),
    )
    expect(result.freshness).toBe('fresh')
    expect(result.reason).toBe('local_results_match')
    expect(result.recommendedAction).toBe('view_results')
  })

  it('no wire, has successful result, has edits → local_graph_edited (stale)', () => {
    const result = deriveAnalysisFreshnessState(
      inputs({
        ceeAnalysisReady: null,
        graphEditedSinceLastRun: true,
        hasSuccessfulAnalysisResult: true,
        resultsStatus: 'complete',
      }),
    )
    expect(result.freshness).toBe('stale')
    expect(result.reason).toBe('local_graph_edited')
    expect(result.recommendedAction).toBe('rerun_analysis')
  })

  it('no wire, no successful result, has options → no_successful_run_yet (none + run_analysis)', () => {
    const result = deriveAnalysisFreshnessState(
      inputs({ ceeAnalysisReady: null, hasOptions: true }),
    )
    expect(result.freshness).toBe('none')
    expect(result.reason).toBe('no_successful_run_yet')
    expect(result.recommendedAction).toBe('run_analysis')
  })

  it('no wire, no successful result, NO options → no_options_yet (none + add_options)', () => {
    const result = deriveAnalysisFreshnessState(
      inputs({ ceeAnalysisReady: null, hasOptions: false }),
    )
    expect(result.freshness).toBe('none')
    expect(result.reason).toBe('no_options_yet')
    expect(result.recommendedAction).toBe('add_options')
  })

  it('analysis running → recommendedAction=null (don\'t suggest a run already in progress)', () => {
    const result = deriveAnalysisFreshnessState(
      inputs({ ceeAnalysisReady: null, hasOptions: true, resultsStatus: 'running' }),
    )
    expect(result.recommendedAction).toBeNull()
  })
})

describe('deriveAnalysisFreshnessState — wire "none" passes reason through', () => {
  it('wire none with reason → none + reason kept + run_analysis', () => {
    const result = deriveAnalysisFreshnessState(
      inputs({
        ceeAnalysisReady: makeWire('none', 'no_successful_run_analysis_fact'),
        hasOptions: true,
      }),
    )
    expect(result.freshness).toBe('none')
    expect(result.reason).toBe('no_successful_run_analysis_fact')
    expect(result.recommendedAction).toBe('run_analysis')
  })

  it('wire none, no options → add_options', () => {
    const result = deriveAnalysisFreshnessState(
      inputs({
        ceeAnalysisReady: makeWire('none', 'no_successful_run_analysis_fact'),
        hasOptions: false,
      }),
    )
    expect(result.recommendedAction).toBe('add_options')
  })
})

describe('deriveAnalysisFreshnessState — wire "unknown" surfaces inputsMissing', () => {
  it('wire unknown, no successful local result → keeps reason, marks inputsMissing', () => {
    const result = deriveAnalysisFreshnessState(
      inputs({
        ceeAnalysisReady: makeWire('unknown', 'derivation_failed'),
        hasOptions: true,
      }),
    )
    expect(result.freshness).toBe('unknown')
    expect(result.reason).toBe('derivation_failed')
    expect(result.recommendedAction).toBe('run_analysis')
    expect(result.inputsMissing).toContain('ceeAnalysisReady')
  })

  it('wire unknown, but local report present → resolves via local signals (fresh, no inputsMissing)', () => {
    // The local signal can sometimes resolve a wire `unknown`. If we
    // ran successfully locally and the canvas hasn\'t been edited
    // since, freshness is fresh.
    const result = deriveAnalysisFreshnessState(
      inputs({
        ceeAnalysisReady: makeWire('unknown', 'legacy_fact_missing_hash'),
        hasSuccessfulAnalysisResult: true,
        graphEditedSinceLastRun: false,
      }),
    )
    expect(result.freshness).toBe('fresh')
    expect(result.inputsMissing).toEqual([])
  })

  it('wire unknown + no options → unknown + add_options', () => {
    const result = deriveAnalysisFreshnessState(
      inputs({
        ceeAnalysisReady: makeWire('unknown', 'derivation_failed'),
        hasOptions: false,
      }),
    )
    expect(result.freshness).toBe('unknown')
    expect(result.recommendedAction).toBe('add_options')
  })
})

describe('deriveAnalysisFreshnessState — coherence properties', () => {
  // Property: the wire signal is stable across local edits when fresh.
  // A consumer that just observed a fresh response and then sees the
  // local edit signal flip true should NOT see the verdict become
  // 'stale' until the wire reflects the change. Otherwise the four
  // surfaces could disagree mid-render.
  it('wire fresh → freshness stays fresh even when graphEditedSinceLastRun toggles', () => {
    const wire = makeWire('fresh', 'graph_hash_match')
    const r1 = deriveAnalysisFreshnessState(
      inputs({ ceeAnalysisReady: wire, graphEditedSinceLastRun: false }),
    )
    const r2 = deriveAnalysisFreshnessState(
      inputs({ ceeAnalysisReady: wire, graphEditedSinceLastRun: true }),
    )
    expect(r1.freshness).toBe(r2.freshness)
  })

  it('absent wire never collapses two distinct states to the same verdict', () => {
    // No-wire + has-options + no-result   → 'none' / run_analysis
    // No-wire + no-options + no-result    → 'none' / add_options
    const a = deriveAnalysisFreshnessState(inputs({ hasOptions: true }))
    const b = deriveAnalysisFreshnessState(inputs({ hasOptions: false }))
    expect(a.recommendedAction).not.toEqual(b.recommendedAction)
  })

  it('result is deterministic — same inputs give same output', () => {
    const i = inputs({
      ceeAnalysisReady: makeWire('stale', 'graph_hash_diverged'),
      graphEditedSinceLastRun: true,
    })
    expect(deriveAnalysisFreshnessState(i)).toEqual(deriveAnalysisFreshnessState(i))
  })
})

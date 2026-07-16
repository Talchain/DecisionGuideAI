/**
 * useAnalysisStateSource — classification tests.
 *
 * v5-canonical-analysis brief PR 1 correction 2: flag OFF + V2 result must
 * be `direct_plot_legacy`, not orphan. Correction 3: ceeAnalysisReady is
 * NOT proof of a run_analysis fact — only an explicit fact slice is.
 */
import { describe, it, expect } from 'vitest'

import { classifyAnalysisStateSource } from '../useAnalysisStateSource'

describe('classifyAnalysisStateSource', () => {
  const scenarioId = 'scenario-A'

  it('returns none when no results report is present', () => {
    const r = classifyAnalysisStateSource({
      canonicalFlagOn: true,
      reportPresent: false,
      reportHash: null,
      currentScenarioId: scenarioId,
      fact: null,
    })
    expect(r.source).toBe('none')
    expect(r.showOrphanBanner).toBe(false)
    expect(r.hasResultsReport).toBe(false)
    expect(r.factPresentForScenario).toBe(false)
  })

  it('canonical flag OFF + report present = direct_plot_legacy (correction 2)', () => {
    const r = classifyAnalysisStateSource({
      canonicalFlagOn: false,
      reportPresent: true,
      reportHash: 'hash-A',
      currentScenarioId: scenarioId,
      fact: null,
    })
    expect(r.source).toBe('direct_plot_legacy')
    expect(r.showOrphanBanner).toBe(false)
  })

  it('canonical flag ON + report present + no fact = orphaned_plot_result', () => {
    const r = classifyAnalysisStateSource({
      canonicalFlagOn: true,
      reportPresent: true,
      reportHash: 'hash-A',
      currentScenarioId: scenarioId,
      fact: null,
    })
    expect(r.source).toBe('orphaned_plot_result')
    expect(r.showOrphanBanner).toBe(true)
    expect(r.factPresentForScenario).toBe(false)
  })

  it('canonical flag ON + report present + fact with hasRunAnalysisFact=true = cee_v5_run_analysis', () => {
    const r = classifyAnalysisStateSource({
      canonicalFlagOn: true,
      reportPresent: true,
      reportHash: 'hash-A',
      currentScenarioId: scenarioId,
      fact: {
        scenarioId,
        analysisHash: 'hash-A',
        hasRunAnalysisFact: true,
        freshness: 'fresh',
      },
    })
    expect(r.source).toBe('cee_v5_run_analysis')
    expect(r.showOrphanBanner).toBe(false)
  })

  it('fact with freshness=fresh but no hasRunAnalysisFact is still counted (conservative fallback)', () => {
    const r = classifyAnalysisStateSource({
      canonicalFlagOn: true,
      reportPresent: true,
      reportHash: 'hash-A',
      currentScenarioId: scenarioId,
      fact: {
        scenarioId,
        analysisHash: 'hash-A',
        hasRunAnalysisFact: null,
        freshness: 'fresh',
      },
    })
    expect(r.source).toBe('cee_v5_run_analysis')
  })

  it('cross-scenario fact does NOT count as coverage', () => {
    const r = classifyAnalysisStateSource({
      canonicalFlagOn: true,
      reportPresent: true,
      reportHash: 'hash-A',
      currentScenarioId: 'scenario-A',
      fact: {
        scenarioId: 'scenario-B',
        analysisHash: 'hash-A',
        hasRunAnalysisFact: true,
        freshness: 'fresh',
      },
    })
    expect(r.source).toBe('orphaned_plot_result')
    expect(r.showOrphanBanner).toBe(true)
  })

  it('hash mismatch between fact and results.hash classifies as followup, not orphan', () => {
    const r = classifyAnalysisStateSource({
      canonicalFlagOn: true,
      reportPresent: true,
      reportHash: 'hash-NEW',
      currentScenarioId: scenarioId,
      fact: {
        scenarioId,
        analysisHash: 'hash-OLD',
        hasRunAnalysisFact: true,
        freshness: 'fresh',
      },
    })
    expect(r.source).toBe('cee_v5_followup')
    expect(r.showOrphanBanner).toBe(false)
  })

  it('hasRunAnalysisFact=false explicitly = orphan (CEE said no fact)', () => {
    const r = classifyAnalysisStateSource({
      canonicalFlagOn: true,
      reportPresent: true,
      reportHash: 'hash-A',
      currentScenarioId: scenarioId,
      fact: {
        scenarioId,
        analysisHash: null,
        hasRunAnalysisFact: false,
        freshness: 'none',
      },
    })
    expect(r.source).toBe('orphaned_plot_result')
    expect(r.showOrphanBanner).toBe(true)
  })

  it('F10: a minted fact is believed regardless of its freshness verdict — a stale-verdict run still RAN', () => {
    // The OLD gate here re-tested freshness (hasRunAnalysisFact===true ||
    // freshness==='fresh'), so the exact fact the mint site writes for a
    // stale-verdict run classified as orphaned — the ran-vs-current
    // conflation surviving one layer above the fixed mint gate. Ran is
    // decided ONCE, at deriveV5AnalysisFactUpdate; the classifier trusts a
    // minted, scenario-matched fact.
    const r = classifyAnalysisStateSource({
      canonicalFlagOn: true,
      reportPresent: true,
      reportHash: 'hash-A',
      currentScenarioId: scenarioId,
      fact: {
        scenarioId,
        analysisHash: 'hash-A',
        hasRunAnalysisFact: true,
        freshness: 'stale',
      },
    })
    expect(r.source).toBe('cee_v5_run_analysis')
    expect(r.showOrphanBanner).toBe(false)
    expect(r.factPresentForScenario).toBe(true)
  })

  it('F10: a legacy-shaped fact (hasRunAnalysisFact=null, freshness=stale) is also believed — only explicit false is disbelieved', () => {
    const r = classifyAnalysisStateSource({
      canonicalFlagOn: true,
      reportPresent: true,
      reportHash: 'hash-A',
      currentScenarioId: scenarioId,
      fact: {
        scenarioId,
        analysisHash: 'hash-A',
        hasRunAnalysisFact: null,
        freshness: 'stale',
      },
    })
    expect(r.source).toBe('cee_v5_run_analysis')
    expect(r.showOrphanBanner).toBe(false)
  })
})

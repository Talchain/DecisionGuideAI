/**
 * useResultsSectionData — reactivity + warning-parity regressions.
 *
 * Two independent selector fixes are pinned here:
 *  - P0: the `confidence` memo must recompute when the asynchronous CEE
 *    review lands (it updates `runMeta.ceeReviewV1` while `report` identity is
 *    unchanged). The memo reads `ceeReviewV1` for readiness/tier, so it must
 *    also list it as a dependency — the sibling `completeness` memo already
 *    does.
 *  - P1: `recommendation.hasWarnings` must agree with the uncertainties list.
 *    Advisories emitted as severity 'IMPROVEMENT' + semantic_severity
 *    'WARNING' (the UI-SEM-069 class) are ingested into uncertainties, so
 *    hasWarnings must count them too or the panel shows "ready, no warnings"
 *    while the list simultaneously shows warnings.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { mapV2ResponseToReportV1 } from '../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

function makeV2Response(overrides: Partial<V2RunResponse> = {}): V2RunResponse {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: [
      {
        option_id: 'opt_a',
        option_label: 'Option A',
        confidence_interval: [30, 70],
        win_probability: 0.65,
        outcome: { mean: 50, std: 12, p10: 30, p50: 50, p90: 70, n_samples: 1000, n_valid_samples: 1000, validity_ratio: 1 },
      },
      {
        option_id: 'opt_b',
        option_label: 'Option B',
        confidence_interval: [20, 60],
        win_probability: 0,
        outcome: { mean: 35, std: 14, p10: 20, p50: 35, p90: 60, n_samples: 1000, n_valid_samples: 998, validity_ratio: 0.998 },
      },
    ],
    critiques: [],
    drivers: [{ node_id: 'd', label: 'D', contribution: 0.5, direction: 'positive' }],
    edge_sensitivity: [],
    factor_sensitivity: [{ factor_id: 'f1', elasticity: 0.4, importance_rank: 1 }],
    robustness: { fragile_edges: [], robust_edges: ['e1'] },
    response_hash: 'h',
    meta: { seed_used: '42', n_samples: 1000, detail_level: 'standard', latency_ms: 100 },
    ...overrides,
  }
}

const OPTION_NODES = [
  { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option A' } },
  { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option B' } },
]

/** Mapped report with confidence_tier stripped so the readiness path decides the tier. */
function baseReport(critique?: unknown[]): any {
  const report = mapV2ResponseToReportV1(makeV2Response(), { seed: 42 }) as any
  report.confidence_tier = undefined
  report.run = { ...(report.run ?? {}), critique: critique ?? [] }
  report.robustness = { ...(report.robustness ?? {}), fragile_edges: [] }
  return report
}

describe('useResultsSectionData — confidence memo reacts to a late CEE review (P0)', () => {
  beforeEach(() => {
    useCanvasStore.setState({ results: null, runMeta: {} as any, rawV2Response: null, nodes: [], edges: [], hasCompletedFirstRun: false } as any)
  })

  it('recomputes the confidence tier when runMeta.ceeReviewV1 CHANGES after report (report identity held constant)', () => {
    // The report has no confidence_tier, so the tier is decided by the CEE
    // review's readiness level. Start with a low readiness, then let a better
    // review land — ONLY runMeta.ceeReviewV1 changes; the same `report` object
    // stays in the store (shallow-merge setState). Without ceeReviewV1 in the
    // memo deps the tier would stay frozen at 'needs_work'.
    const report = baseReport()
    act(() => {
      useCanvasStore.setState({
        results: { status: 'complete', progress: 100, report } as any,
        runMeta: { ceeReviewV1: { readiness: { level: 'not_ready', score: 20 } } } as any,
        nodes: OPTION_NODES as any, edges: [], hasCompletedFirstRun: true, rawV2Response: null,
      } as any)
    })
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.confidence?.tier?.tier).toBe('needs_work')

    act(() => {
      useCanvasStore.setState({ runMeta: { ceeReviewV1: { readiness: { level: 'ready', score: 90 } } } as any } as any)
    })
    expect(result.current.confidence?.tier?.tier).toBe('strong')
  })
})

describe('useResultsSectionData — hasWarnings ⇄ uncertainties parity (P1, UI-SEM-069)', () => {
  beforeEach(() => {
    useCanvasStore.setState({ results: null, runMeta: {} as any, rawV2Response: null, nodes: [], edges: [], hasCompletedFirstRun: false } as any)
  })

  function renderWith(critique: unknown[]) {
    act(() => {
      useCanvasStore.setState({
        results: { status: 'complete', progress: 100, report: baseReport(critique) } as any,
        runMeta: {} as any,
        nodes: OPTION_NODES as any, edges: [], hasCompletedFirstRun: true, rawV2Response: null,
      } as any)
    })
    return renderHook(() => useResultsSectionData())
  }

  it('sets hasWarnings for a severity:IMPROVEMENT + semantic_severity:WARNING advisory', () => {
    const { result } = renderWith([{ severity: 'IMPROVEMENT', semantic_severity: 'WARNING', message: 'Graph is dense' }])
    expect(result.current.recommendation?.hasWarnings).toBe(true)
  })

  it('negative control: a plain IMPROVEMENT critique (no semantic WARNING, no fragile edges) does not set hasWarnings', () => {
    const { result } = renderWith([{ severity: 'IMPROVEMENT', message: 'Consider adding evidence' }])
    expect(result.current.recommendation?.hasWarnings).toBe(false)
  })

  it('still sets hasWarnings for a first-class WARNING critique (unchanged behaviour)', () => {
    const { result } = renderWith([{ severity: 'WARNING', message: 'Low sample validity' }])
    expect(result.current.recommendation?.hasWarnings).toBe(true)
  })
})

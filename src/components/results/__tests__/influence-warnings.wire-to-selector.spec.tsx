/**
 * Lane UI-R3 (truth rendering) — roadmap 1.7 + 1.12 wire-to-selector proof.
 *
 * Chain under test (same five links as
 * v5-analysis-to-results-panel.wire-to-selector.spec.ts):
 *
 *   real bundle-shaped V5 envelope → applyV5State (mapV5AnalysisToReport)
 *     → resultsComplete payload → useCanvasStore.results.report
 *     → useResultsSectionData selector
 *
 * Feature B (1.7): the producer's influence_score / influence_rank /
 * zero_reason survive to DriverItem — in particular the PINNED factor
 * (zero_reason intervention_override, sensitivity 0, influence_score 1)
 * must stay VISIBLE with its influence, instead of being dropped as
 * zero-impact when influence_score was narrowed away.
 *
 * Feature C (1.12): warning-severity inference_warnings reach
 * confidence.inferenceWarnings WITH their severity so the Analysis-tab
 * strip can filter on it.
 *
 * Fixture: real staging capture (debug bundle olumi-debug-45c9b625-20260707).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import type { OlumiResponse } from '@talchain/schemas/boundary'

import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { useCanvasStore } from '../../../canvas/store'
import { useResultsSectionData } from '../useResultsSectionData'
import { selectWarningSeverityEntries } from '../InferenceWarningStrip'

import bundleFixture from '../../../v5/__tests__/fixtures/v5-analysis-result.bundle-45c9b625.json'

function hydrateStoreFromBundle(): void {
  const envelope = {
    response_version: 2,
    assistant_text: 'Analysis complete.',
    blocks: [bundleFixture.block],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
  } as unknown as OlumiResponse

  const captured: Array<{ report: unknown; hash: string }> = []
  const applicatorStore: V5ApplicatorStore = {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    nodes: [],
    edges: [],
    resultsComplete: (params) => {
      captured.push({ report: params.report, hash: params.hash })
    },
    currentResultsHash: null,
  }
  const apply = applyV5State(envelope, applicatorStore)
  expect(apply.applied).toContain('analysis_result:results_hydrated')
  expect(captured).toHaveLength(1)

  useCanvasStore.setState({
    results: {
      status: 'complete',
      progress: 100,
      report: captured[0].report,
      hash: captured[0].hash,
    } as unknown as ReturnType<typeof useCanvasStore.getState>['results'],
    hasCompletedFirstRun: true,
  } as Partial<ReturnType<typeof useCanvasStore.getState>>)
}

describe('bundle 45c9b625 → Results selector: influence + warnings truth rendering', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 } as unknown as ReturnType<
        typeof useCanvasStore.getState
      >['results'],
      runMeta: {} as ReturnType<typeof useCanvasStore.getState>['runMeta'],
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
      currentScenarioFraming: null,
      ceeAnalysisReady: undefined,
    })
  })

  it('driver rows expose the producer influence_score and influence_rank (1.7)', () => {
    hydrateStoreFromBundle()
    const { result } = renderHook(() => useResultsSectionData())
    const drivers = result.current.drivers.drivers
    const byKey = new Map(drivers.map((d) => [d.factorKey, d]))

    const receptivity = byKey.get('fac_market_receptivity')
    expect(receptivity?.influenceScore).toBe(0.6209677419354838)
    expect(receptivity?.influenceRank).toBe(2)

    const founderTime = byKey.get('fac_founder_time')
    expect(founderTime?.influenceScore).toBe(0.4838709677419354)
    expect(founderTime?.influenceRank).toBe(3)
  })

  it('pinned factor stays visible with influence (not dropped as zero-impact) and carries zero_reason (1.7)', () => {
    hydrateStoreFromBundle()
    const { result } = renderHook(() => useResultsSectionData())
    const drivers = result.current.drivers.drivers
    const pinned = drivers.find((d) => d.factorKey === 'fac_marketing_expertise')

    expect(pinned).toBeDefined()
    expect(pinned?.influenceScore).toBe(1)
    expect(pinned?.influenceRank).toBe(1)
    expect(pinned?.zeroReason).toBe('intervention_override')
    // Zero-impact filter keys off influenceScore ?? normalisedInfluence —
    // with influence_score present the pinned factor is NOT zero-impact.
    // (Sensitivity is 0 by producer decree: intervention_override.)
    expect(pinned?.rawElasticity).toBe(0)
  })

  it('inferenceWarnings reach the selector with severity; the strip filter picks exactly the warning-severity entry (1.12)', () => {
    hydrateStoreFromBundle()
    const { result } = renderHook(() => useResultsSectionData())
    const warnings = result.current.confidence.inferenceWarnings
    expect(warnings).toBeDefined()
    expect(warnings).toHaveLength(3)
    expect(warnings?.map((w) => w.severity)).toEqual(['info', 'info', 'warning'])

    const visible = selectWarningSeverityEntries(warnings)
    expect(visible).toHaveLength(1)
    expect(visible[0].code).toBe('CONSTRAINT_TARGET_UNRELIABLE')
    // Producer message verbatim — the caveat copy the strip will render.
    expect(visible[0].message).toBe(
      "The target for 'out_campaign_effectiveness' could not be reliably assessed - set an explicit range for this outcome to make the target meaningful.",
    )
  })
})

/**
 * V5 analysis_result → Results panel selector wire-to-selector proof.
 *
 * Asserts the END-TO-END contract that the user-visible Results panel can
 * actually consume V5-hydrated analysis data. The five-link chain:
 *
 *   1. Real staging V5 envelope (label-keyed win_probabilities + canonical
 *      enrichment.option_comparison)
 *        ↓
 *   2. applyV5State step 5 ─ mapV5AnalysisToReport builds ReportV1
 *        ↓
 *   3. resultsComplete payload (report keyed by canonical option_id)
 *        ↓
 *   4. useCanvasStore.results.report
 *        ↓
 *   5. useResultsSectionData selector → allOptions[].winProbability
 *
 * Specifically asserts the field path the user told us must be tested:
 *
 *   report.option_probabilities[option_id].win_probability
 *
 * surfaces on the Results panel as `result.current.allOptions[id].winProbability`
 * with the exact value from the staging envelope — no rounding, no defaults,
 * no silent zeros, no synthesised opt_0/opt_1 keys.
 *
 * The chain catches the regression class the user warned about ("hydrating
 * the wrong field can still leave the UI empty"). A label-keyed mapper
 * output would silently produce zero matches when the selector reads
 * `optionProbs[node.id]` (useResultsSectionData.ts:1042) — this test will
 * fail loudly in that scenario.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import type { OlumiResponse } from '@talchain/schemas/boundary'

import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { useCanvasStore } from '../../../canvas/store'
import { useResultsSectionData } from '../useResultsSectionData'

// Real staging V5 envelope (redacted, label-keyed win_probabilities). Same
// fixture mapV5AnalysisToReport.test.ts uses for its real-payload assertions
// — sharing the fixture ensures the selector and the mapper are tested
// against identical wire shape. The fixture lives under src/v5/__tests__/
// because the V5 mapper is the producing side; this test imports it via
// relative path so the two cannot drift apart.
import realStagingFixture from '../../../v5/__tests__/fixtures/v5-analysis-result.staging-real-shape.json'

interface StagingFixtureBlock {
  type: 'analysis_result'
  summary: string
  leading_option_id: string
  win_probabilities: Record<string, number>
  enrichment: {
    option_comparison: Array<{
      id?: string
      option_id?: string
      option_label?: string
      win_probability?: number
      outcome?: { mean?: number; p10?: number; p50?: number; p90?: number }
    }>
    [k: string]: unknown
  }
}

describe('V5 analysis_result → Results panel selector wire-to-selector proof', () => {
  beforeEach(() => {
    // Reset the canvas store to a clean state. The seed below mirrors what
    // the real V5 draft_graph path would produce: option nodes named with
    // canonical option_ids that match enrichment.option_comparison[].id.
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 } as unknown as ReturnType<
        typeof useCanvasStore.getState
      >['results'],
      runMeta: {} as ReturnType<typeof useCanvasStore.getState>['runMeta'],
      nodes: [
        // Option nodes: data.kind === 'option' is the gate at
        // useResultsSectionData.ts:1043 (`optionNodes = nodes.filter(...)`)
        {
          id: 'opt_hire_local',
          type: 'option',
          position: { x: 0, y: 0 },
          data: { kind: 'option', label: 'Hire Two Senior Engineers Locally' },
        },
        {
          id: 'opt_offshore',
          type: 'option',
          position: { x: 0, y: 0 },
          data: { kind: 'option', label: 'Engage Offshore Partner' },
        },
        {
          id: 'opt_status_quo',
          type: 'option',
          position: { x: 0, y: 0 },
          data: { kind: 'option', label: 'Maintain Current Team (Status Quo)' },
        },
        {
          id: 'opt_tiered_pricing',
          type: 'option',
          position: { x: 0, y: 0 },
          data: { kind: 'option', label: 'Introduce Tiered Pricing for Gradual Hiring' },
        },
      ] as unknown as ReturnType<typeof useCanvasStore.getState>['nodes'],
      edges: [],
      hasCompletedFirstRun: false,
      currentScenarioFraming: null,
      ceeAnalysisReady: undefined,
    })
  })

  it('after applyV5State step 5, every option row exposes the exact win_probability from the staging fixture', () => {
    // Build the OlumiResponse-shaped envelope by ferrying the fixture block.
    const block = (realStagingFixture.blocks[0] as unknown) as StagingFixtureBlock
    const envelope = {
      response_version: 2,
      assistant_text: realStagingFixture.assistant_text,
      blocks: [block],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'analyse',
    } as unknown as OlumiResponse

    // Capture what applyV5State step 5 passes to resultsComplete. A partial
    // store double — we do NOT invoke the real `useCanvasStore.resultsComplete`
    // here because its side-effect chain (snapshot creation, scenarios.update,
    // telemetry) is out of scope for this contract test. We just need the
    // payload step 5 produces, then plumb it into the store via setState.
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

    // Plumb the captured payload into the canvas store the same way the real
    // resultsComplete action would (the parts useResultsSectionData reads).
    const { report, hash } = captured[0]
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report,
        hash,
      } as unknown as ReturnType<typeof useCanvasStore.getState>['results'],
      hasCompletedFirstRun: true,
    } as Partial<ReturnType<typeof useCanvasStore.getState>>)

    // Render the Results panel selector and verify exact win_probability
    // surfaces per option_id.
    const { result } = renderHook(() => useResultsSectionData())
    const allOptions = result.current.recommendation.allOptions
    expect(allOptions).toHaveLength(4)

    const byId = new Map(allOptions.map((o) => [o.id, o]))
    // EXACT values from real staging envelope — these are the field-path
    // assertions the brief requires:
    //   report.option_probabilities[option_id].win_probability
    //     → OptionResult.winProbability
    expect(byId.get('opt_hire_local')?.winProbability).toBe(0.7193333333333334)
    expect(byId.get('opt_offshore')?.winProbability).toBe(0.054)
    expect(byId.get('opt_status_quo')?.winProbability).toBe(0.22533333333333333)
    expect(byId.get('opt_tiered_pricing')?.winProbability).toBe(0.0013333333333333333)
  })

  it('recommended option is opt_hire_local (highest win_probability, matches leading_option_id)', () => {
    const block = (realStagingFixture.blocks[0] as unknown) as StagingFixtureBlock
    const envelope = {
      response_version: 2,
      assistant_text: 'Analysis complete.',
      blocks: [block],
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
    applyV5State(envelope, applicatorStore)

    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: captured[0].report,
        hash: captured[0].hash,
      } as unknown as ReturnType<typeof useCanvasStore.getState>['results'],
      hasCompletedFirstRun: true,
    } as Partial<ReturnType<typeof useCanvasStore.getState>>)

    const { result } = renderHook(() => useResultsSectionData())
    const recommended = result.current.recommendation.recommendedOption
    expect(recommended?.id).toBe('opt_hire_local')
    expect(recommended?.winProbability).toBe(0.7193333333333334)
  })

  it('option labels in win_probabilities (e.g. "Hire Two Senior Engineers Locally") do NOT leak as synthetic option rows', () => {
    // Regression guard: an earlier mapper draft keyed option_probabilities
    // by win_probabilities keys verbatim — which in real staging are LABELS,
    // not IDs. That would have produced "ghost" option entries (e.g. an
    // entry keyed by "Hire Two Senior Engineers Locally") that the
    // selector's `optionProbs[node.id]` lookup would silently miss while
    // simultaneously polluting the store.
    const block = (realStagingFixture.blocks[0] as unknown) as StagingFixtureBlock
    const envelope = {
      response_version: 2,
      assistant_text: 'Analysis complete.',
      blocks: [block],
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
    applyV5State(envelope, applicatorStore)

    const report = captured[0].report as {
      option_probabilities?: Record<string, unknown>
    }
    const keys = Object.keys(report.option_probabilities ?? {})
    // All keys must be canonical option_ids — no human-language labels.
    for (const key of keys) {
      expect(key).toMatch(/^opt_/)
      expect(key).not.toContain(' ')
    }
  })
})

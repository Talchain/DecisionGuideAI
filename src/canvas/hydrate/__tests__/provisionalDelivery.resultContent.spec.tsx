/**
 * Captured 2026-09-09 poll, request 3d5ce286 / scenario b8e98c0e.
 * The real receiver retains three computed distributions while CEE deliberately
 * omits ranking probabilities. Only fetch/time are injected: the schedule,
 * response parser, applier, mapper, store and mounted display consumers are real.
 * Counterfactuals below alter one returned state/content boundary explicitly.
 * No provider, browser or full graph-hydration acceptance is claimed here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import { fetchScenarioGraph, scenarioGraphUrl } from '../../../adapters/cee/scenarioGraph'
import { useCanvasStore } from '../../store'
import { useAnalysisState } from '../../state/analysisStateSelector'
import { AnalysisRunAnnouncer } from '../../components/AnalysisRunAnnouncer'
import {
  readProvisionalApplyStore,
  runProvisionalDeliverySchedule,
} from '../../hooks/useProvisionalAnalysisDelivery'
import { selectHasAnyRealProbability } from '../../ui/inspector-v2/useAnalysisResults'
import capture from './fixtures/pricing-provisional-poll.json'

const scenarioId = capture.scenario_id
const capturedVerdict = AnalysisStateV1Schema.parse(capture.analysis_state)
const initialState = useCanvasStore.getState()

beforeEach(() => {
  // A draft is already mounted when this delivery leg arms. Keep its actual
  // node/edge identities; rendering layout and model values are not rewritten.
  useCanvasStore.setState(initialState, true)
  useCanvasStore.getState().resultsReset()
  useCanvasStore.setState({
    currentScenarioId: scenarioId,
    nodes: capture.graph.nodes.map(node => ({
      id: node.id,
      type: node.kind,
      position: { x: 0, y: 0 },
      data: { label: node.label },
    })),
    edges: capture.graph.edges.map(edge => ({
      id: `${edge.from}->${edge.to}`,
      source: edge.from,
      target: edge.to,
    })),
    lastAuthoritativeGraph: {
      nodeIds: capture.graph.nodes.map(node => node.id),
      edgePairs: capture.graph.edges.map(edge => `${edge.from}->${edge.to}`),
    },
    ceeAnalysisReady: null,
    analysisStateV1: null,
    v5AnalysisFact: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
    pendingEmittedEdits: 0,
  })
})

afterEach(() => { vi.unstubAllGlobals() })

async function deliver(body: unknown = capture, signal = new AbortController().signal) {
  const fetchSpy = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(async () => new Response(JSON.stringify(body), {
    status: 200, headers: { 'content-type': 'application/json' },
  }))
  vi.stubGlobal('fetch', fetchSpy)
  const outcome = await runProvisionalDeliverySchedule({
    scenarioId, userId: null, accessToken: null, signal,
    read: fetchScenarioGraph,
    wait: async () => {},
    delays: [0],
    // No getStore substitute: exercise readProvisionalApplyStore itself.
  })
  return { outcome, fetchSpy }
}

function withComparisons(comparisons: unknown[], status?: string) {
  return {
    ...capture,
    analysis_result: {
      ...capture.analysis_result,
      enrichment: {
        ...capture.analysis_result.enrichment,
        option_comparison: comparisons,
        ...(status === undefined ? {} : { option_comparison_status: status }),
      },
    },
  }
}

function expectRetainedDistributionAndWithholding() {
  const state = useCanvasStore.getState()
  // Report identity is the mapper's local digest, not the producer's graph
  // hash. Keep the two authorities distinct; the real poll dedupes this one.
  expect(state.results.hash).toMatch(/^v5:[0-9a-f]{16}$/)
  expect(state.results.hash).toBe(state.results.report?.model_card.response_hash)
  expect(state.results.report).toMatchObject({
    option_comparison: capture.analysis_result.enrichment.option_comparison.map(option => ({
      option_id: option.option_id,
      outcome: {
        mean: option.outcome.mean,
        p10: option.outcome.p10,
        p50: option.outcome.p50,
        p90: option.outcome.p90,
      },
    })),
  })
  expect(state.analysisStateV1).toEqual(capturedVerdict)
  expect(state.analysisStateV1?.leader_claim.permitted).toBe(false)
  expect(state.results.report).not.toHaveProperty('leading_option_id')
  expect(selectHasAnyRealProbability(state)).toBe(false)
  expect(state.v5AnalysisFact).toBeNull() // This leg never needed that other slice.
}

describe('captured provisional poll → real store → result-content consumers', () => {
  it('recognises the delivered three distributions without inventing ranking probabilities', async () => {
    const { result } = renderHook(() => useAnalysisState())
    let delivery: Awaited<ReturnType<typeof deliver>> | undefined
    await act(async () => { delivery = await deliver() })
    expect(delivery?.outcome).toBe('delivered')
    expect(delivery?.fetchSpy.mock.calls[0]?.[0]).toBe(scenarioGraphUrl(scenarioId))
    expectRetainedDistributionAndWithholding()
    expect(result.current.displayState.state).toBe('complete')
    expect(result.current.requiresRerun).toBe(false)
  })

  it('announces the actual running → delivered transition as completed, not resultless', async () => {
    render(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    act(() => useCanvasStore.getState().setAnalysisStateV1({
      ...capturedVerdict,
      run_state: { kind: 'running', started_at: '2026-09-09T03:48:42.462Z' },
    }))
    await act(async () => { await deliver() })
    expectRetainedDistributionAndWithholding()
    expect(screen.getByTestId('analysis-run-announcer')).toHaveTextContent('Analysis complete.')
    expect(screen.getByTestId('analysis-run-announcer')).not.toHaveTextContent('without a result')
  })

  it('keeps a computed median of exactly zero when it is the only outcome statistic supplied', async () => {
    const body = withComparisons(capture.analysis_result.enrichment.option_comparison.map(option => ({
      option_id: option.option_id, status: 'computed', outcome: { p50: option.outcome.p50 },
    })))
    const { result } = renderHook(() => useAnalysisState())
    await act(async () => { await deliver(body) })
    expect(useCanvasStore.getState().results.report).toMatchObject({
      option_comparison: capture.analysis_result.enrichment.option_comparison.map(option => ({
        option_id: option.option_id, outcome: { p50: 0 },
      })),
    })
    expect(selectHasAnyRealProbability(useCanvasStore.getState())).toBe(false)
    expect(result.current.displayState.state).toBe('complete')
  })

  it('does not promote populated all-null comparisons into a result', async () => {
    const body = withComparisons(capture.analysis_result.enrichment.option_comparison.map(option => ({
      option_id: option.option_id,
      win_probability: null,
      outcome: { mean: null, p10: null, p50: null, p90: null },
    })))
    const { result } = renderHook(() => useAnalysisState())
    await act(async () => { await deliver(body) })
    expect(useCanvasStore.getState().results.report).toBeDefined()
    expect(result.current.displayState.state).toBe('ran_without_result')
  })

  it.each(['pending', 'running', 'error', 'failed'])('does not promote %s comparison data', async status => {
    const { result } = renderHook(() => useAnalysisState())
    await act(async () => {
      await deliver(withComparisons(capture.analysis_result.enrichment.option_comparison, status))
    })
    expect(result.current.displayState.state).toBe('ran_without_result')
  })

  it('retains genuine zero probability as a value, without granting the withheld leader claim', async () => {
    const body = withComparisons(capture.analysis_result.enrichment.option_comparison.map(option => ({
      option_id: option.option_id, win_probability: 0,
    })))
    const { result } = renderHook(() => useAnalysisState())
    await act(async () => { await deliver(body) })
    expect(selectHasAnyRealProbability(useCanvasStore.getState())).toBe(true)
    expect(result.current.displayState.state).toBe('complete')
    expect(useCanvasStore.getState().analysisStateV1?.leader_claim.permitted).toBe(false)
  })

  it('nonterminal never_run writes no result and keeps the bounded wait unresolved', async () => {
    const body = {
      ...capture, analysis_result: null,
      analysis_state: { ...capture.analysis_state, run_state: { kind: 'never_run' } },
    }
    const delivery = await deliver(body)
    expect(delivery.outcome).toBe('deadline')
    expect(useCanvasStore.getState().results.report).toBeUndefined()
    expect(useCanvasStore.getState().analysisStateV1).toBeNull()
  })

  it('a divergent mounted graph still refuses the result before any adoption', async () => {
    useCanvasStore.setState({ lastAuthoritativeGraph: null })
    expect(readProvisionalApplyStore().graphAcceptedForCanvas).toBe(false)
    const delivery = await deliver()
    expect(delivery.outcome).toBe('withheld')
    expect(useCanvasStore.getState().results.report).toBeUndefined()
    expect(useCanvasStore.getState().analysisStateV1).toBeNull()
  })

  it('a scenario-change abort still prevents the late read from adopting anything', async () => {
    const controller = new AbortController()
    const fetchSpy = vi.fn(async () => {
      useCanvasStore.setState({ currentScenarioId: '11111111-2222-4333-8444-555555555555' })
      controller.abort() // The mounted hook owns aborting on a scenario change.
      return new Response(JSON.stringify(capture), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchSpy)
    const outcome = await runProvisionalDeliverySchedule({
      scenarioId, userId: null, accessToken: null, signal: controller.signal,
      read: fetchScenarioGraph, wait: async () => {}, delays: [0],
    })
    expect(outcome).toBe('aborted')
    expect(useCanvasStore.getState().results.report).toBeUndefined()
    expect(useCanvasStore.getState().analysisStateV1).toBeNull()
  })

  it('real outcome data never clears an undispatched local edit or makes that result current', async () => {
    useCanvasStore.setState({ analysisFreshnessDirty: true, pendingEmittedEdits: 1 })
    const { result } = renderHook(() => useAnalysisState())
    await act(async () => { await deliver() })
    expectRetainedDistributionAndWithholding()
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(result.current.displayState.state).toBe('results_stale')
    expect(result.current.requiresRerun).toBe(true)
  })

  it('a second identical poll is deduplicated against the real report hash', async () => {
    expect((await deliver()).outcome).toBe('delivered')
    const report = useCanvasStore.getState().results.report
    expect((await deliver()).outcome).toBe('already_held')
    expect(useCanvasStore.getState().results.report).toBe(report)
  })
})

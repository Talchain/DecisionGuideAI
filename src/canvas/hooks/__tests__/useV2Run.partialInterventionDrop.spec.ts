/**
 * The pre-run gate must fire on a PARTIAL intervention drop, not only a total one.
 *
 * Before this change the gate keyed on `flattenInterventions(opt.interventions).length === 0`
 * — it fired only when EVERY entry was unusable. An option with one good entry and one
 * unusable entry sailed straight through, and the analysis ran on a graph the user never
 * authored while the UI reported success.
 *
 * The affordance is the one PR #499 established and OutputsDock already renders: the
 * `MISSING_INTERVENTIONS` store error carrying `affectedOptions`, drawn as the amber
 * "Options need their effects mapped" banner with a focus button per option. No new UI.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useV2Run } from '../useV2Run'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { useResultsStore } from '../../stores/resultsStore'

vi.mock('../../../adapters/plot/v2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../adapters/plot/v2')>()
  return { ...actual, executeV2RunWithAnalysisReady: vi.fn() }
})
vi.mock('../../../lib/resultsInstrumentation', () => ({
  trackRunCompleted: vi.fn(),
  trackRunFailed: vi.fn(),
  trackEmptyComputedResults: vi.fn(),
}))
vi.mock('../../../lib/telemetry', () => ({ trackTypedError: vi.fn() }))
vi.mock('../../../lib/gate-state', () => ({
  useGateStore: { getState: () => ({ setGate: vi.fn() }) },
  updateRobustnessGate: vi.fn(),
  updateRobustnessGateFromV2: vi.fn(),
}))
vi.mock('../../../utils/payloadRedaction', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/payloadRedaction')>()
  return { ...actual, buildRawErrorData: vi.fn(() => null), hashStackTrace: vi.fn(() => '') }
})
vi.mock('../../../types/requestId', () => ({
  generateRequestId: vi.fn(() => 'req-partial-drop'),
}))

import { executeV2RunWithAnalysisReady } from '../../../adapters/plot/v2'
const mockExecute = executeV2RunWithAnalysisReady as Mock

/**
 * `fac-1` is labelled "Unit margin" and `fac-2` "Customer churn" so the assertions can
 * prove the surfaced text names the target by its CANVAS LABEL, not its node id.
 */
function setupCanvas(analysisReady: any, extraOptionNodes: any[] = []) {
  const baseResults = useCanvasStore.getState().results
  const arOptionNodes = (analysisReady?.options || []).map((o: any, i: number) => ({
    id: o.id,
    type: 'option',
    data: { label: o.label, kind: 'option', interventions: o.interventions },
    position: { x: 200 + i * 100, y: 0 },
  }))
  const nodes: any[] = [
    { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
    { id: 'fac-1', type: 'factor', data: { label: 'Unit margin', kind: 'factor' }, position: { x: 100, y: 0 } },
    { id: 'fac-2', type: 'factor', data: { label: 'Customer churn', kind: 'factor' }, position: { x: 100, y: 80 } },
    ...arOptionNodes,
    ...extraOptionNodes,
  ]
  useCanvasStore.setState({
    nodes,
    edges: [{ id: 'e1', source: 'fac-1', target: 'goal-1' }],
    outcomeNodeId: 'goal-1',
    ceeAnalysisReady: analysisReady ?? null,
    ceeAnalysisReadyNodeIds: analysisReady ? nodes.map((n) => n.id) : null,
    goalConstraints: null,
    goalThreshold: null,
    currentScenarioFraming: null,
    results: { ...baseResults, status: 'idle' },
  } as any)
  useDraftStore.getState().setLastDraftDescription('')
}

beforeEach(() => {
  vi.clearAllMocks()
  useResultsStore.setState({ analysisSummary: null } as any)
})

describe('pre-run gate — partial intervention drop', () => {
  it('BLOCKS a run whose option has one usable and one unusable intervention', async () => {
    setupCanvas({
      goal_node_id: 'goal-1',
      status: 'ready',
      options: [
        {
          id: 'opt-1',
          label: 'Raise price',
          status: 'ready',
          interventions: {
            'fac-1': { value: 0.4, source: 'cee_hypothesis' },
            'fac-2': { value: null, source: 'cee_hypothesis' },
          },
        },
      ],
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    // The run must NOT have been sent with a shrunken option set.
    expect(mockExecute).not.toHaveBeenCalled()
    expect(result.current.isRunning).toBe(false)
    expect(useCanvasStore.getState().results.status).toBe('error')
  })

  it('names the option AND the unusable target by its canvas label', async () => {
    setupCanvas({
      goal_node_id: 'goal-1',
      status: 'ready',
      options: [
        {
          id: 'opt-1',
          label: 'Raise price',
          status: 'ready',
          interventions: {
            'fac-1': { value: 0.4, source: 'cee_hypothesis' },
            'fac-2': { value: null, source: 'cee_hypothesis' },
          },
        },
      ],
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    expect(result.current.error).toContain('Raise price')
    expect(result.current.error).toContain('Customer churn')
  })

  it('routes through the EXISTING MISSING_INTERVENTIONS + affectedOptions affordance', async () => {
    setupCanvas({
      goal_node_id: 'goal-1',
      status: 'ready',
      options: [
        {
          id: 'opt-1',
          label: 'Raise price',
          status: 'ready',
          interventions: {
            'fac-1': { value: 0.4, source: 'cee_hypothesis' },
            'fac-2': { value: 'tbd', source: 'cee_hypothesis' },
          },
        },
      ],
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    const storeError = useCanvasStore.getState().results.error
    expect(storeError?.code).toBe('MISSING_INTERVENTIONS')
    expect(storeError?.affectedOptions).toEqual([{ id: 'opt-1', label: 'Raise price' }])
  })

  it('fires on the CANVAS-BACKFILL branch too, where the reconciler used to filter before the gate could look', async () => {
    setupCanvas(null, [
      {
        id: 'opt-canvas',
        type: 'option',
        data: {
          label: 'Canvas option',
          kind: 'option',
          interventions: { 'fac-1': 0.5, 'fac-2': { value: null } },
        },
        position: { x: 300, y: 0 },
      },
    ])

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    expect(mockExecute).not.toHaveBeenCalled()
    expect(result.current.error).toContain('Canvas option')
    expect(result.current.error).toContain('Customer churn')
  })

  it('POSITIVE CONTROL — an all-valid option still runs, untouched', async () => {
    mockExecute.mockResolvedValue({
      analysis_status: 'computed',
      option_comparison: [],
      response_hash: 'test-hash',
    })
    setupCanvas({
      goal_node_id: 'goal-1',
      status: 'ready',
      options: [
        {
          id: 'opt-1',
          label: 'Good Option',
          status: 'ready',
          interventions: {
            'fac-1': { value: 10, source: 'cee_hypothesis' },
            'fac-2': { value: 0, source: 'cee_hypothesis' },
          },
        },
      ],
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  it('POSITIVE CONTROL — the ALL-unusable option keeps its existing full-drop wording and code', async () => {
    setupCanvas({
      goal_node_id: 'goal-1',
      status: 'ready',
      options: [
        {
          id: 'opt-1',
          label: 'Empty Option',
          status: 'ready',
          interventions: { 'fac-1': { value: null, source: 'cee_hypothesis' } },
        },
      ],
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    expect(mockExecute).not.toHaveBeenCalled()
    expect(result.current.error).toContain('Empty Option')
    expect(result.current.error).toContain('intervention values')
    const storeError = useCanvasStore.getState().results.error
    expect(storeError?.code).toBe('MISSING_INTERVENTIONS')
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePalette } from '../usePalette'
import { loadRuns, getRun } from '../../store/runHistory'
import * as blueprints from '../../../templates/blueprints'

// Shared mock state for canvas store
const mockResultsLoadHistorical = vi.fn()
const mockSetShowResultsPanel = vi.fn()
const mockSetShowInspectorPanel = vi.fn()
const mockSelectNodeWithoutHistory = vi.fn()
const mockOpenTemplatesPanel = vi.fn()

const baseState: any = {
  nodes: [],
  edges: [],
  selectNodeWithoutHistory: mockSelectNodeWithoutHistory,
  results: { seed: undefined, hash: undefined },
  resultsLoadHistorical: mockResultsLoadHistorical,
  setShowResultsPanel: mockSetShowResultsPanel,
  setShowInspectorPanel: mockSetShowInspectorPanel,
  currentScenarioFraming: null,
  currentScenarioLastResultHash: null,
  openTemplatesPanel: mockOpenTemplatesPanel,
}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector?: any) => (selector ? selector(baseState) : baseState)),
}))

vi.mock('../../store/runHistory', () => ({
  loadRuns: vi.fn(),
  getRun: vi.fn(),
}))

describe('usePalette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    baseState.nodes = []
    baseState.edges = []
    baseState.results = { seed: undefined, hash: undefined }
    mockOpenTemplatesPanel.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('indexes recent runs from run history', () => {
    vi.useFakeTimers()

    const mockRun: any = {
      id: 'run-1',
      ts: 1700000000000,
      seed: 42,
      hash: 'hash-1234567890',
      adapter: 'auto',
      summary: 'Test run',
      graphHash: 'graph-hash',
      report: {},
    }

    vi.mocked(loadRuns).mockReturnValue([mockRun])

    const { result, unmount } = renderHook(() => usePalette({ enabled: true, indexDebounce: 0 }))

    act(() => {
      vi.runAllTimers()
    })

    const runResults = result.current.results.filter(item => item.kind === 'run')

    expect(loadRuns).toHaveBeenCalled()
    expect(runResults.length).toBeGreaterThan(0)
    expect(runResults[0].id).toBe(`run:${mockRun.id}`)

    unmount()
  })

  it('indexes templates from blueprints and opens Templates panel when executed', () => {
    vi.useFakeTimers()

    // No run history needed for this test
    vi.mocked(loadRuns).mockReturnValue([] as any)

    const getTemplateMetasSpy = vi.spyOn(blueprints, 'getTemplateMetas').mockReturnValue([
      {
        id: 't1',
        name: 'Pricing Decision',
        description: 'Test template',
        category: 'Strategy',
      } as any,
    ])

    const { result, unmount } = renderHook(() => usePalette({ enabled: true, indexDebounce: 0 }))

    act(() => {
      vi.runAllTimers()
    })

    const templateItem = result.current.results.find(item => item.kind === 'template')
    expect(templateItem).toBeDefined()
    expect(templateItem?.label).toContain('Pricing Decision')

    act(() => {
      result.current.executeItem(templateItem as any)
    })

    expect(mockOpenTemplatesPanel).toHaveBeenCalledTimes(1)

    getTemplateMetasSpy.mockRestore()
    unmount()
  })

  it('indexes drivers from the current results report and focuses their node when executed', () => {
    vi.useFakeTimers()

    // Seed drivers on the current results report
    baseState.results = {
      seed: undefined,
      hash: undefined,
      report: {
        drivers: [
          { label: 'Market Risk', polarity: 'up', strength: 'high', node_id: 'node-1' },
        ],
      },
    }

    // No run history needed for this test
    vi.mocked(loadRuns).mockReturnValue([] as any)

    const { result, unmount } = renderHook(() => usePalette({ enabled: true, indexDebounce: 0 }))

    act(() => {
      vi.runAllTimers()
    })

    const driverItem = result.current.results.find(item => item.kind === 'driver')
    expect(driverItem).toBeDefined()
    expect(driverItem?.label).toContain('Market Risk')

    act(() => {
      result.current.executeItem(driverItem as any)
    })

    expect(mockSelectNodeWithoutHistory).toHaveBeenCalledWith('node-1')

    unmount()
  })

  it('labels the scenario last run clearly in palette results when scenario metadata is present', () => {
    vi.useFakeTimers()

    const mockRun: any = {
      id: 'run-1',
      ts: 1700000000000,
      seed: 42,
      hash: 'hash-1234567890',
      adapter: 'auto',
      summary: 'Test run',
      graphHash: 'graph-hash',
      report: {},
    }

    baseState.currentScenarioFraming = { title: 'Choose pricing strategy' }
    baseState.currentScenarioLastResultHash = mockRun.hash
    baseState.results = { seed: undefined, hash: undefined }

    vi.mocked(loadRuns).mockReturnValue([mockRun])

    const { result, unmount } = renderHook(() => usePalette({ enabled: true, indexDebounce: 0 }))

    act(() => {
      vi.runAllTimers()
    })

    const runItem = result.current.results.find(item => item.kind === 'run')
    expect(runItem).toBeDefined()
    expect(runItem?.label).toContain('Last run')
    expect(runItem?.label).toContain('Choose pricing strategy')
    expect(runItem?.metadata?.isScenarioLastRun).toBe(true)

    unmount()
  })

  it('executes run items to restore historical runs and open Results panel', () => {
    vi.useFakeTimers()

    const mockRun: any = {
      id: 'run-1',
      ts: 1700000000000,
      seed: 42,
      hash: 'hash-1234567890',
      adapter: 'auto',
      summary: 'Test run',
      graphHash: 'graph-hash',
      report: {},
    }

    vi.mocked(loadRuns).mockReturnValue([mockRun])
    vi.mocked(getRun).mockReturnValue(mockRun)

    const { result, unmount } = renderHook(() => usePalette({ enabled: true, indexDebounce: 0 }))

    act(() => {
      vi.runAllTimers()
    })

    const runItem = result.current.results.find(item => item.kind === 'run')
    expect(runItem).toBeDefined()

    act(() => {
      result.current.executeItem(runItem as any)
    })

    expect(mockResultsLoadHistorical).toHaveBeenCalledTimes(1)
    expect(mockResultsLoadHistorical).toHaveBeenCalledWith(mockRun)
    expect(mockSetShowResultsPanel).toHaveBeenCalledWith(true)

    unmount()
  })

  it('executes panel actions to open Results and Inspector panels', () => {
    const { result, unmount } = renderHook(() => usePalette({ enabled: true }))

    act(() => {
      result.current.executeItem({
        id: 'action:results',
        kind: 'action',
        label: 'Open Results',
      } as any)
    })

    expect(mockSetShowResultsPanel).toHaveBeenCalledWith(true)

    act(() => {
      result.current.executeItem({
        id: 'action:inspector',
        kind: 'action',
        label: 'Open Inspector',
      } as any)
    })

    expect(mockSetShowInspectorPanel).toHaveBeenCalledWith(true)

    unmount()
  })
})

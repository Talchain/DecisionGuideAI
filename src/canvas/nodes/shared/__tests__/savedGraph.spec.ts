/** The shared saved-graph read shows only the scenario and saved hash on screen now (Codex R1 on #2886). */
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const fetchScenarioGraph = vi.fn()
vi.mock('../../../../adapters/cee/scenarioGraph', () => ({ fetchScenarioGraph: (...a: unknown[]) => fetchScenarioGraph(...a) }))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: vi.fn(async () => ({ userId: null, accessToken: null })) }))
const aiMode = vi.hoisted(() => ({ value: 'core-route' as string | null }))
vi.mock('../../../../v5/aiComparisonMode', async (actual) => ({ ...(await actual<object>()), resolveAiComparisonMode: () => aiMode.value }))
vi.mock('../../../hydrate/bootGraphRead', () => ({ isCeeAddressableScenarioId: (id: unknown) => typeof id === 'string' }))

import { savedGraphNow, useSavedGraph } from '../savedGraph'
import { useCanvasStore } from '../../../store'
import { bumpSavedGraphEpoch } from '../savedGraphEpoch'

const GRAPH = { nodes: [], living_model: { links: [] } }

describe('useSavedGraph', () => {
  // ⭐ Served 21 Oct (CEE 9e113412): the staging default is `openai`, which CEE serves as the core lane (`laneModeFor`),
  // so a new scenario's living model (other aims, Olumi's suggested measure) was never read on the default path.
  it.each([['openai', true], ['core-route', true], ['conventional', false], [null, false]] as const)('mode %s → read: %s', async (mode, reads) => {
    aiMode.value = mode
    fetchScenarioGraph.mockClear()
    useCanvasStore.setState({ currentScenarioId: `s-${String(mode)}`, lastServerGraphHash: 'bbbbbbbbbbbbbbbb' } as never)
    fetchScenarioGraph.mockResolvedValue({ status: 'graph', scenarioId: `s-${String(mode)}`, graphHash: 'bbbbbbbbbbbbbbbb', graph: GRAPH })
    const { result } = renderHook(() => useSavedGraph())
    if (reads) await waitFor(() => expect(result.current).toBe(GRAPH))
    else { await act(async () => { await Promise.resolve() }); expect(fetchScenarioGraph).not.toHaveBeenCalled(); expect(result.current).toBeNull() }
    aiMode.value = 'core-route'
    fetchScenarioGraph.mockReset()
  })

  it('⭐ the read for this scenario and saved hash is shown', async () => {
    useCanvasStore.setState({ currentScenarioId: 's1', lastServerGraphHash: 'aaaaaaaaaaaaaaaa' } as never)
    fetchScenarioGraph.mockResolvedValueOnce({ status: 'graph', scenarioId: 's1', graphHash: 'aaaaaaaaaaaaaaaa', graph: GRAPH })
    const { result } = renderHook(() => useSavedGraph())
    await waitFor(() => expect(result.current).toBe(GRAPH))
  })

  it('⛔ another scenario\'s or another save\'s graph is never shown, and a failed read is read again on the next mount', async () => {
    useCanvasStore.setState({ currentScenarioId: 's2', lastServerGraphHash: 'bbbbbbbbbbbbbbbb' } as never)
    fetchScenarioGraph.mockResolvedValueOnce({ status: 'graph', scenarioId: 's1', graphHash: 'bbbbbbbbbbbbbbbb', graph: GRAPH })
    const first = renderHook(() => useSavedGraph())
    await waitFor(() => expect(fetchScenarioGraph).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 20))
    expect(first.result.current).toBeNull()
    first.unmount()
    fetchScenarioGraph.mockResolvedValueOnce({ status: 'graph', scenarioId: 's2', graphHash: 'cccccccccccccccc', graph: GRAPH })
    const second = renderHook(() => useSavedGraph())
    await waitFor(() => expect(fetchScenarioGraph).toHaveBeenCalledTimes(2))
    await new Promise((r) => setTimeout(r, 20))
    expect(second.result.current).toBeNull()
  })

  it('⭐ served d6d2d921: a rename leaves the analysis hash as it was; the applied acknowledgement reads the saved model again', async () => {
    useCanvasStore.setState({ currentScenarioId: 's3', lastServerGraphHash: 'dddddddddddddddd' } as never)
    const renamed = { nodes: [{ id: 'goal', label: 'Renamed item zz' }], living_model: { links: [] } }
    fetchScenarioGraph.mockResolvedValueOnce({ status: 'graph', scenarioId: 's3', graphHash: 'dddddddddddddddd', graph: GRAPH })
    const { result } = renderHook(() => useSavedGraph())
    await waitFor(() => expect(result.current).toBe(GRAPH))
    fetchScenarioGraph.mockResolvedValueOnce({ status: 'graph', scenarioId: 's3', graphHash: 'dddddddddddddddd', graph: renamed })
    act(() => bumpSavedGraphEpoch())
    await waitFor(() => expect(result.current).toBe(renamed))
  })
})

/** The send boundary's synchronous read of the same answer (lease U-W1): pure, the read `useSavedGraph` keys, or null. */
describe('savedGraphNow', () => {
  it('⭐ the answered read for the scenario, saved hash and epoch on screen now', async () => {
    const graph = { nodes: [], living_model: { model_program: 'v1' } }
    useCanvasStore.setState({ currentScenarioId: 's4', lastServerGraphHash: 'eeeeeeeeeeeeeeee' } as never)
    fetchScenarioGraph.mockResolvedValueOnce({ status: 'graph', scenarioId: 's4', graphHash: 'eeeeeeeeeeeeeeee', graph })
    const { result } = renderHook(() => useSavedGraph())
    await waitFor(() => expect(result.current).toBe(graph))
    expect(savedGraphNow()).toBe(graph)
  })

  it('⛔ another saved hash, or the next epoch, is not that read: null', async () => {
    const graph = { nodes: [], living_model: { model_program: 'v1' } }
    useCanvasStore.setState({ currentScenarioId: 's5', lastServerGraphHash: 'ffffffffffffffff' } as never)
    fetchScenarioGraph.mockResolvedValueOnce({ status: 'graph', scenarioId: 's5', graphHash: 'ffffffffffffffff', graph })
    const { result, unmount } = renderHook(() => useSavedGraph())
    await waitFor(() => expect(result.current).toBe(graph))
    unmount()
    useCanvasStore.setState({ lastServerGraphHash: '1111111111111111' } as never)
    expect(savedGraphNow()).toBeNull()
    useCanvasStore.setState({ lastServerGraphHash: 'ffffffffffffffff' } as never)
    expect(savedGraphNow()).toBe(graph)
    bumpSavedGraphEpoch()
    expect(savedGraphNow()).toBeNull()
  })

  it('⛔ before the read answers: null (and no read is started by asking)', async () => {
    const graph = { nodes: [], living_model: { model_program: 'v1' } }
    let answer: (v: unknown) => void = () => {}
    useCanvasStore.setState({ currentScenarioId: 's6', lastServerGraphHash: '2222222222222222' } as never)
    fetchScenarioGraph.mockClear()
    expect(savedGraphNow()).toBeNull()
    expect(fetchScenarioGraph).not.toHaveBeenCalled()
    fetchScenarioGraph.mockReturnValueOnce(new Promise((r) => { answer = r }))
    const { result } = renderHook(() => useSavedGraph())
    await waitFor(() => expect(fetchScenarioGraph).toHaveBeenCalledTimes(1))
    expect(savedGraphNow()).toBeNull()
    await act(async () => { answer({ status: 'graph', scenarioId: 's6', graphHash: '2222222222222222', graph }) })
    await waitFor(() => expect(result.current).toBe(graph))
    expect(savedGraphNow()).toBe(graph)
  })
})

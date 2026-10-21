/** The shared saved-graph read shows only the scenario and saved hash on screen now (Codex R1 on #2886). */
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const fetchScenarioGraph = vi.fn()
vi.mock('../../../../adapters/cee/scenarioGraph', () => ({ fetchScenarioGraph: (...a: unknown[]) => fetchScenarioGraph(...a) }))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: vi.fn(async () => ({ userId: null, accessToken: null })) }))
const aiMode = vi.hoisted(() => ({ value: 'core' as string | null }))
vi.mock('../../../../v5/aiComparisonMode', () => ({ resolveAiComparisonMode: () => aiMode.value }))
vi.mock('../../../hydrate/bootGraphRead', () => ({ isCeeAddressableScenarioId: (id: unknown) => typeof id === 'string' }))

import { useSavedGraph } from '../savedGraph'
import { useCanvasStore } from '../../../store'
import { bumpSavedGraphEpoch } from '../savedGraphEpoch'

const GRAPH = { nodes: [], living_model: { links: [] } }

describe('useSavedGraph', () => {
  // ⭐ Served 21 Oct (CEE 9e113412): the staging default is `openai`, which CEE serves as the core lane (`laneModeFor`),
  // so a new scenario's living model (other aims, Olumi's suggested measure) was never read on the default path.
  it.each([['openai', true], ['core', true], ['conventional', false], [null, false]] as const)('mode %s → read: %s', async (mode, reads) => {
    aiMode.value = mode
    fetchScenarioGraph.mockClear()
    useCanvasStore.setState({ currentScenarioId: `s-${String(mode)}`, lastServerGraphHash: 'bbbbbbbbbbbbbbbb' } as never)
    fetchScenarioGraph.mockResolvedValue({ status: 'graph', scenarioId: `s-${String(mode)}`, graphHash: 'bbbbbbbbbbbbbbbb', graph: GRAPH })
    const { result } = renderHook(() => useSavedGraph())
    if (reads) await waitFor(() => expect(result.current).toBe(GRAPH))
    else { await act(async () => { await Promise.resolve() }); expect(fetchScenarioGraph).not.toHaveBeenCalled(); expect(result.current).toBeNull() }
    aiMode.value = 'core'
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

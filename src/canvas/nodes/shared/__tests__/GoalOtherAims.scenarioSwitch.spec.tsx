/** Codex R1 (P1): after a scenario switch, the previous scenario's aims never show while the new read is pending. */
import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const pending = new Map<string, (v: unknown) => void>()
vi.mock('../../../../adapters/cee/scenarioGraph', () => ({
  fetchScenarioGraph: vi.fn((scenarioId: string) => new Promise((resolve) => pending.set(scenarioId, resolve))),
}))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: vi.fn(async () => ({ userId: null, accessToken: null })) }))
vi.mock('../../../../v5/aiComparisonMode', async (actual) => ({ ...(await actual<object>()), resolveAiComparisonMode: () => 'core-route' }))
vi.mock('../../../hydrate/bootGraphRead', () => ({ isCeeAddressableScenarioId: (id: unknown) => typeof id === 'string' }))

import { useOtherAims } from '../GoalOtherAims'
import { useCanvasStore } from '../../../store'

// A served read names its scenario and saved hash (bound by savedGraph.ts).
const graphWith = (aimId: string, scenarioId: string, graphHash: string) => ({ status: 'graph', scenarioId, graphHash, graph: { nodes: [], living_model: { aims: [{ id: aimId, text: `Aim ${aimId}`, source: 'user', status: 'current' }], links: [] } } })
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

describe('useOtherAims', () => {
  it('shows only the aims read for the scenario and saved graph on screen', async () => {
    act(() => useCanvasStore.setState({ currentScenarioId: 'scn-a', lastServerGraphHash: 'h-a' } as never))
    const { result } = renderHook(() => useOtherAims())
    await flush()
    await act(async () => { pending.get('scn-a')!(graphWith('aim_a', 'scn-a', 'h-a')) })
    expect(result.current.map((a) => a.id)).toEqual(['aim_a'])
    // Switch: B's read is still pending, so A's aims must not stay on B's canvas.
    act(() => useCanvasStore.setState({ currentScenarioId: 'scn-b', lastServerGraphHash: 'h-b' } as never))
    await flush()
    expect(result.current).toEqual([])
    await act(async () => { pending.get('scn-b')!(graphWith('aim_b', 'scn-b', 'h-b')) })
    expect(result.current.map((a) => a.id)).toEqual(['aim_b'])
  })
})

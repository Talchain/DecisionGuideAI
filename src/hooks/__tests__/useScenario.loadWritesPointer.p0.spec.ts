/**
 * P0 (5 Oct 2026): a signed-in switch moved the store to the opened scenario and left the disk pointer on the
 * previous one. The next cold boot bound the autosave (the opened scenario's bytes) to that stale pointer, and a
 * whole-graph register wrote one scenario's model into another (see `canvas/hydrate/__tests__/bootSlotOwner.p0.spec.ts`).
 * `loadScenario` now writes the pointer wherever it installs `currentScenarioId`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import {
  HARNESS_NODES,
  supabaseMockModule,
  authMockModule,
  routerMockModule,
  resetScenarioHarness,
  setScenarioRow,
  scenarioRow,
} from '../../test/helpers/useScenarioSupabaseHarness'

const access = vi.hoisted(() => ({ getScenarioAccess: vi.fn() }))
vi.mock('../../services/scenarioSharingService', () => access)
vi.mock('../../lib/supabase', () => supabaseMockModule())
vi.mock('react-router-dom', () => routerMockModule())
vi.mock('../../contexts/AuthContext', () => authMockModule())

import { useScenario } from '../useScenario'
import { useCanvasStore } from '../../canvas/store'
import * as scenarios from '../../canvas/store/scenarios'

const A1 = '0265d61c-5ebe-4aa7-9cdd-96edcabee340'
const A2 = '4a492d04-1111-4111-8111-111111111111'

beforeEach(() => {
  localStorage.clear()
  resetScenarioHarness()
  access.getScenarioAccess.mockReset()
  scenarios.setCurrentScenarioId(A1)
  useCanvasStore.setState({ currentScenarioId: A1, nodes: [] as never, edges: [] as never } as never)
})

describe('useScenario.loadScenario keeps the disk pointer on the scenario it opened', () => {
  it('⭐ OWNER: opening A2 from A1 moves the store AND the pointer to A2', async () => {
    setScenarioRow(A2, scenarioRow(A2, { nodes: HARNESS_NODES, edges: [] }))
    const { result } = renderHook(() => useScenario())
    await act(async () => { await result.current.loadScenario(A2) })
    expect(useCanvasStore.getState().currentScenarioId).toBe(A2)
    expect(scenarios.getCurrentScenarioId()).toBe(A2)
  })

  it('⭐ VIEWER: a shared decision opened on a clean slate under its id moves the pointer with it', async () => {
    access.getScenarioAccess.mockResolvedValue('viewer')
    const { result } = renderHook(() => useScenario())
    await act(async () => { await result.current.loadScenario(A2) })
    expect(useCanvasStore.getState().currentScenarioId).toBe(A2)
    expect(scenarios.getCurrentScenarioId()).toBe(A2)
  })

  it('⭐ (Codex r1) a load answered after a sign-out writes neither the store nor the pointer', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    setScenarioRow(A2, scenarioRow(A2, { nodes: HARNESS_NODES, edges: [] }))
    const { result, unmount } = renderHook(() => useScenario())
    let pending!: Promise<void>
    const { mockSingle } = await import('../../test/helpers/useScenarioSupabaseHarness')
    const answer = mockSingle.getMockImplementation()!
    mockSingle.mockImplementationOnce(async (...args: unknown[]) => { await gate; return answer(...(args as [string])) })
    act(() => { pending = result.current.loadScenario(A2) })
    // The sign-out sweep removes the pointer, and the canvas unmounts, while the load is in flight.
    scenarios.clearCurrentScenarioId()
    unmount()
    release()
    await act(async () => { await pending })
    expect(scenarios.getCurrentScenarioId()).toBeNull()
    expect(useCanvasStore.getState().currentScenarioId).toBe(A1)
  })

  it('CONTRAST: a load that finds nothing (not a member) changes neither the store nor the pointer', async () => {
    access.getScenarioAccess.mockResolvedValue('none')
    const { result } = renderHook(() => useScenario())
    await act(async () => { await result.current.loadScenario(A2) })
    expect(useCanvasStore.getState().currentScenarioId).toBe(A1)
    expect(scenarios.getCurrentScenarioId()).toBe(A1)
  })
})

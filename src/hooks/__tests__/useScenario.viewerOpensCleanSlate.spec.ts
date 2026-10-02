/**
 * ACCOUNTS viewer mode: opening a decision SHARED with you. The Supabase row is
 * hidden from a member (scenarios RLS stays owner-only), so `loadScenario` reads
 * not-found. For a viewer that is expected, not a failure:
 * - no "could not be opened" toast;
 * - the viewed decision opens on a CLEAN SLATE under its own id, so the previously
 *   open decision (model, id, Run) never stays on screen and CEE's member read
 *   merges into the right scenario;
 * - a newer load (A→B) is never wiped by A's late answer.
 * CONTRAST: a non-member keeps today's notice and the store is untouched.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
// The signed-in account is switchable here: another tab can change it with no new load.
const auth = vi.hoisted(() => ({ userId: null as string | null }))
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.userId ? { id: auth.userId } : authMockModule().useAuth().user, authenticated: true }),
}))

import { useScenario } from '../useScenario'
import { useCanvasStore } from '../../canvas/store'

const OWN = 'own-decision-a'
const SHARED = 'shared-decision-b'

let toasts: Array<{ message?: string }> = []
const onToast = (e: Event) => { toasts.push((e as CustomEvent).detail ?? {}) }

function previousDecisionOnScreen() {
  useCanvasStore.setState({
    nodes: HARNESS_NODES as never,
    edges: [] as never,
    currentScenarioId: OWN,
    results: { status: 'complete', progress: 100 } as never,
  } as never)
}

beforeEach(() => {
  auth.userId = null
  resetScenarioHarness()
  access.getScenarioAccess.mockReset()
  toasts = []
  window.addEventListener('topbar:show-toast', onToast)
  previousDecisionOnScreen()
})
afterEach(() => { window.removeEventListener('topbar:show-toast', onToast) })

describe('useScenario.loadScenario: a decision shared with this user', () => {
  it('VIEWER: no toast; the viewed decision opens on a clean slate under ITS id (nothing of the previous one stays)', async () => {
    access.getScenarioAccess.mockResolvedValue('viewer')
    const { result } = renderHook(() => useScenario())
    await act(async () => { await result.current.loadScenario(SHARED) })

    expect(access.getScenarioAccess).toHaveBeenCalledWith(SHARED)
    expect(toasts).toHaveLength(0)
    const s = useCanvasStore.getState()
    expect(s.currentScenarioId).toBe(SHARED)
    expect(s.nodes).toHaveLength(0)
    expect(s.results.status).toBe('idle')
  })

  it('CONTRAST, NOT A MEMBER: today\'s notice, and the store is untouched', async () => {
    access.getScenarioAccess.mockResolvedValue('none')
    const { result } = renderHook(() => useScenario())
    await act(async () => { await result.current.loadScenario(SHARED) })

    expect(toasts).toHaveLength(1)
    expect(String(toasts[0].message)).toMatch(/could not be opened/i)
    expect(useCanvasStore.getState().currentScenarioId).toBe(OWN)
    expect(useCanvasStore.getState().nodes).toHaveLength(HARNESS_NODES.length)
  })

  it('A→B: the shared A answering "viewer" AFTER the owner\'s B loaded never wipes B', async () => {
    let answerA!: (v: string) => void
    access.getScenarioAccess.mockImplementation(() => new Promise<string>((r) => { answerA = r }))
    setScenarioRow(OWN, scenarioRow(OWN, { nodes: HARNESS_NODES, edges: [] }))
    const { result } = renderHook(() => useScenario())

    let loadA!: Promise<void>
    await act(async () => { loadA = result.current.loadScenario(SHARED) })
    await act(async () => { await result.current.loadScenario(OWN) })
    expect(useCanvasStore.getState().currentScenarioId).toBe(OWN)

    await act(async () => { answerA('viewer'); await loadA })
    expect(useCanvasStore.getState().currentScenarioId).toBe(OWN)
    expect(useCanvasStore.getState().nodes).toHaveLength(HARNESS_NODES.length)
    expect(toasts).toHaveLength(0)
  })

  it('A→B (Codex P2): A answering "none" after B loaded raises NO stale notice over B', async () => {
    let answerA!: (v: string) => void
    access.getScenarioAccess.mockImplementation(() => new Promise<string>((r) => { answerA = r }))
    setScenarioRow(OWN, scenarioRow(OWN, { nodes: HARNESS_NODES, edges: [] }))
    const { result } = renderHook(() => useScenario())

    let loadA!: Promise<void>
    await act(async () => { loadA = result.current.loadScenario(SHARED) })
    await act(async () => { await result.current.loadScenario(OWN) })
    await act(async () => { answerA('none'); await loadA })
    expect(toasts).toHaveLength(0)
    expect(useCanvasStore.getState().currentScenarioId).toBe(OWN)
  })

  it('ACCOUNT SWITCH (Codex delta P2): U1\'s late "viewer" answer never clears the canvas U2 now has', async () => {
    let answer!: (v: string) => void
    access.getScenarioAccess.mockImplementation(() => new Promise<string>((r) => { answer = r }))
    auth.userId = 'user-one'
    const hook = renderHook(() => useScenario())

    let load!: Promise<void>
    await act(async () => { load = hook.result.current.loadScenario(SHARED) })
    auth.userId = 'user-two'
    hook.rerender()
    await act(async () => { answer('viewer'); await load })

    expect(useCanvasStore.getState().currentScenarioId).toBe(OWN)
    expect(useCanvasStore.getState().nodes).toHaveLength(HARNESS_NODES.length)
  })
})

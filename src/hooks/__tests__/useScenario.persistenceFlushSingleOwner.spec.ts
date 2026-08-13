/**
 * useScenario — persistence flush barrier (F1) + single-owner autosave (F4)
 *
 * Codex review findings, both CONFIRMED at the bytes:
 *
 * F1 RACE — an authenticated user who edits then presses Analyse within the
 * 1500ms autosave debounce dispatches a canonical V5 run (scenario_id only, no
 * graph on the wire) that CEE resolves against the PREVIOUS persisted graph.
 * The fix is `flushPendingSaves`: an awaitable barrier that persists any
 * pending/dirty graph and resolves only once the write lands (reject on
 * failure), a no-op for guests / inactive persistence.
 *
 * F4 DOUBLE PIPELINE — useScenario() mounts in BOTH CanvasMVP and OutputsDock.
 * Two instances each installed their own store subscriptions + debounce timers,
 * so ONE edit scheduled TWO independent saves and a slower stale save could
 * overwrite newer work. The fix is a module-level ownership registry: only the
 * head owner persists, so two mounts + one edit ⇒ exactly one save.
 *
 * MUTATION CHECKS (proved in a throwaway tree, see PR body):
 * - Remove the `if (!isAutosaveOwner(...)) return` guard from the graph
 *   subscription ⇒ "two mounts, one edit ⇒ exactly one save" flips to 2 saves.
 * - Make `flushPendingSaves` resolve without awaiting the write ⇒ the
 *   "waits for the slow save" test flips (spy not yet called at assert time).
 * - Swallow the save rejection in the flush ⇒ the failure-path test flips
 *   (promise resolves instead of rejecting).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks (mirror useScenario.spec.ts harness)
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))

let mockAuthValue = {
  user: null as { id: string; email?: string } | null,
  authenticated: false,
}
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mockAuthValue }))

const mockSaveGraphViaGatedPath = vi.fn()
const mockSaveFraming = vi.fn()
const mockSaveTitle = vi.fn()

vi.mock('../../services/scenarioService', () => ({
  createScenario: vi.fn(),
  loadScenario: vi.fn(),
  deleteScenario: vi.fn(),
  saveGraphViaGatedPath: (...args: unknown[]) => mockSaveGraphViaGatedPath(...args),
  saveFraming: (...args: unknown[]) => mockSaveFraming(...args),
  storeAnalysis: vi.fn(),
  storeAnalysisFailure: vi.fn(),
  storeBrief: vi.fn(),
  setStage: vi.fn(),
  createSharedBrief: vi.fn(),
  resetAnalysisStatus: vi.fn(),
  setAnalysisRunning: vi.fn(),
  saveTitle: (...args: unknown[]) => mockSaveTitle(...args),
}))

const mockMarkClean = vi.fn()
let storeState: Record<string, unknown> = {}

const mockGetState = vi.fn(() => ({
  markClean: mockMarkClean,
  hydrateGraphSlice: vi.fn(),
  ...storeState,
}))
const mockSetState = vi.fn((partial: Record<string, unknown>) => {
  storeState = { ...storeState, ...partial }
})

// Records every subscribe callback so a test can drive the debounced autosave
// directly. The graph-autosave effect subscribes FIRST per mount.
type StoreSubscriber = (state: Record<string, unknown>, prev: Record<string, unknown>) => void
const mockSubscribeCallbacks: StoreSubscriber[] = []

vi.mock('../../canvas/store', () => ({
  useCanvasStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector(storeState),
    {
      getState: () => mockGetState(),
      setState: (partial: Record<string, unknown>) => mockSetState(partial),
      subscribe: (cb: StoreSubscriber) => {
        mockSubscribeCallbacks.push(cb)
        return () => {}
      },
    },
  ),
}))

vi.mock('../../canvas/domain/edges', () => ({
  DEFAULT_EDGE_DATA: { weight: 0.5, style: 'solid', curvature: 0.15 },
}))


// ⚠ THE CLIENT GRAPH-WRITE POLICY IS LIFTED FOR THIS FILE — deliberately.
//
// P0 2026-08-13 shut the client's write to `scenarios.graph` entirely
// (`hooks/clientGraphWritePolicy.ts`): it holds raw React Flow bytes, there is no
// React-Flow→GraphV3 projector, and CEE's analyse read 500s on them. That is a
// POLICY, and it is pinned — with mutants — in
// `useScenario.reactFlowNeverPersisted.p0.spec.ts`.
//
// This file pins the MECHANISM: which RPC, which owner, which ordering, which
// hash. Every one of those properties is still true and must not be deleted
// because the policy is currently shut — when a projector lands the plumbing has
// to be right on the first day. So the policy is opened here explicitly and this
// file goes on proving the write path. Two questions, two files, neither
// impersonating the other.
vi.mock('../clientGraphWritePolicy', () => ({
  clientCanWriteReadableGraph: () => true,
}))

import { useScenario } from '../useScenario'

const REAL_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

function setAuth(userId: string | null, authenticated: boolean) {
  mockAuthValue = {
    user: userId ? { id: userId, email: `${userId}@test.com` } : null,
    authenticated,
  }
}

// A deferred promise the test resolves/rejects manually.
function deferred<T = void>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSubscribeCallbacks.length = 0
  storeState = {
    currentScenarioId: null,
    nodes: [],
    edges: [],
    goalConstraints: null,
    currentScenarioFraming: null,
    isDirty: false,
    results: { status: 'idle' },
  }
  setAuth(null, false)
  mockSaveGraphViaGatedPath.mockResolvedValue(undefined)
  mockSaveFraming.mockResolvedValue(undefined)
  mockSaveTitle.mockResolvedValue(undefined)
})

afterEach(() => {
  // RTL auto-cleanup (tests/setup/rtl.ts) unmounts every render, which empties
  // the ownership registry and resets the shared save key between tests.
})

// ---------------------------------------------------------------------------
// F1 — flush barrier
// ---------------------------------------------------------------------------

describe('F1: flushPendingSaves barrier', () => {
  it('is a no-op for guests / inactive persistence (no write, resolves)', async () => {
    setAuth('guest', true)
    storeState = { ...storeState, currentScenarioId: 'sc-1', nodes: [{ id: 'a' }] }
    const { result } = renderHook(() => useScenario())

    await act(async () => {
      await result.current.flushPendingSaves()
    })

    expect(mockSaveGraphViaGatedPath).not.toHaveBeenCalled()
  })

  it('persists a dirty graph and resolves only after the write lands', async () => {
    setAuth(REAL_USER_ID, true)
    storeState = { ...storeState, currentScenarioId: 'sc-1', nodes: [{ id: 'a' }] }
    const { result } = renderHook(() => useScenario())

    const d = deferred()
    mockSaveGraphViaGatedPath.mockReturnValueOnce(d.promise)

    let settled = false
    let flushPromise!: Promise<void>
    act(() => {
      flushPromise = result.current.flushPendingSaves().then(() => {
        settled = true
      })
    })

    // The write is in flight but not yet resolved — the barrier MUST still be
    // pending (this is the whole point: dispatch must wait for the save).
    await Promise.resolve()
    expect(mockSaveGraphViaGatedPath).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)

    await act(async () => {
      d.resolve()
      await flushPromise
    })
    expect(settled).toBe(true)
  })

  it('rejects when the save fails — dispatch must NOT silently proceed', async () => {
    setAuth(REAL_USER_ID, true)
    storeState = { ...storeState, currentScenarioId: 'sc-1', nodes: [{ id: 'a' }] }
    const { result } = renderHook(() => useScenario())

    mockSaveGraphViaGatedPath.mockRejectedValueOnce(new Error('network down'))

    await act(async () => {
      await expect(result.current.flushPendingSaves()).rejects.toThrow('network down')
    })
  })

  it('resolves immediately without a second write when the graph is already clean', async () => {
    setAuth(REAL_USER_ID, true)
    storeState = { ...storeState, currentScenarioId: 'sc-1', nodes: [{ id: 'a' }] }
    const { result } = renderHook(() => useScenario())

    // First flush persists and records the "already saved" key.
    await act(async () => {
      await result.current.flushPendingSaves()
    })
    expect(mockSaveGraphViaGatedPath).toHaveBeenCalledTimes(1)

    // Graph unchanged → second flush is a no-op.
    await act(async () => {
      await result.current.flushPendingSaves()
    })
    expect(mockSaveGraphViaGatedPath).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// F4 — single-owner autosave
// ---------------------------------------------------------------------------

describe('F4: single-owner autosave (two mounts, one writer)', () => {
  it('schedules exactly ONE debounced save when two mounts observe the same edit', () => {
    vi.useFakeTimers()
    try {
      setAuth(REAL_USER_ID, true)
      storeState = { ...storeState, currentScenarioId: 'sc-1', nodes: [] }

      // Two independent mounts of useScenario — CanvasMVP + OutputsDock.
      renderHook(() => useScenario())
      renderHook(() => useScenario())

      // Each mount's graph-autosave effect subscribes first, so callbacks
      // 0 and 3 are the two graph subscribers.
      const graphSubs = [mockSubscribeCallbacks[0], mockSubscribeCallbacks[3]]
      expect(graphSubs.every((cb) => typeof cb === 'function')).toBe(true)

      // The store notifies BOTH subscribers of the same edit.
      const prev = { ...storeState }
      storeState = { ...storeState, nodes: [{ id: 'n1' }] }
      act(() => {
        graphSubs.forEach((cb) => cb(storeState, prev))
        vi.advanceTimersByTime(1600)
      })

      // F4: only the owner writes — exactly one save, not two.
      expect(mockSaveGraphViaGatedPath).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

/**
 * useScenario — the UNMOUNT best-effort graph flush must obey the SAME
 * persistence gate as every other write path.
 *
 * THE DEFECT (found by the PR #662 adversarial review, pre-existing):
 * `persistGraphNow` declares itself "the ONE write code path", and it is the
 * function that consults `shouldPersistGraphForScenario` — the guard that
 * refuses to write a graph whose streamed values the UI KNOWS are unsettled.
 * The unmount flush called `scenarioService.saveGraphViaGatedPath` DIRECTLY,
 * so the guard was never consulted: for a signed-in user, navigating away
 * while a kept-unsettled preview stood on the canvas wrote that preview over
 * CEE's committed graph. Exactly the loss `persistGraphNow`'s header says the
 * suppression exists to prevent, reached through the one door that skipped it.
 *
 * SECOND LIMB — `graphSaveTimerRef` was never nulled once the debounce FIRED,
 * so the unmount cleanup's `if (graphSaveTimerRef.current)` was truthy for a
 * timer that had already run to completion. The "best-effort flush of a
 * PENDING save" therefore fired for saves that were not pending at all.
 *
 * Both limbs are pinned by IDENTITY (the mock write's scenario id and node
 * payload), and the (d)/(e) controls pin the flush's legitimate behaviour so
 * the suite cannot be satisfied by deleting the flush.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

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

import { useScenario } from '../useScenario'
// REAL draft store — the guard under test reads it. A mocked guard would only
// prove the test can mock, never that the live predicate is consulted.
import { useDraftStore, shouldPersistGraphForScenario } from '../../canvas/stores/draftStore'

const REAL_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const SCENARIO = 'sc-unsettled-1'

/**
 * ⚠ EVERY CASE GETS ITS OWN GRAPH, and this is load-bearing, not tidiness.
 * `useScenario` keeps `sharedLastSavedGraphKey` at MODULE scope — deliberately,
 * so two mounts cannot re-write each other's save — and it survives
 * `vi.clearAllMocks()`. Two cases sharing a node set therefore let the first
 * case's successful write make the second case's debounce a no-op, and the
 * second case would then "pass" while never exercising the path it names.
 */
function graphFor(caseId: string) {
  return [{ id: `kept_goal_${caseId}` }, { id: `kept_opt_${caseId}` }]
}

/** Fire the canvas-store subscription so the debounced graph save is scheduled. */
function scheduleGraphSave(nodes: Array<{ id: string }>) {
  const prev = { ...storeState }
  storeState = { ...storeState, nodes }
  act(() => {
    for (const cb of mockSubscribeCallbacks) cb(storeState, prev)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSubscribeCallbacks.length = 0
  storeState = {
    currentScenarioId: SCENARIO,
    nodes: [],
    edges: [],
    goalConstraints: null,
    currentScenarioFraming: null,
    isDirty: false,
    results: { status: 'idle' },
  }
  mockAuthValue = { user: { id: REAL_USER_ID, email: 'u@test.com' }, authenticated: true }
  mockSaveGraphViaGatedPath.mockResolvedValue(undefined)
  useDraftStore.getState().resetDraft()
})

afterEach(() => {
  vi.useRealTimers()
  useDraftStore.getState().resetDraft()
})

describe('useScenario — unmount flush obeys the unsettled-persistence gate', () => {
  it('(a) CONTROL: the debounced autosave IS suppressed while unsettled (the guard works on the guarded path)', async () => {
    vi.useFakeTimers()
    renderHook(() => useScenario())
    useDraftStore.getState().setDraftStreamPhase('unsettled', 't1', SCENARIO)
    expect(shouldPersistGraphForScenario(SCENARIO)).toBe(false)

    scheduleGraphSave(graphFor('a'))
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockSaveGraphViaGatedPath).not.toHaveBeenCalled()
  })

  it('(b) unmount after a FIRED-and-suppressed debounce must not write the unsettled graph', async () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() => useScenario())
    useDraftStore.getState().setDraftStreamPhase('unsettled', 't1', SCENARIO)

    scheduleGraphSave(graphFor('b'))
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(mockSaveGraphViaGatedPath).not.toHaveBeenCalled()
    // Still unsettled at the moment of unmount — the guard's answer has not moved.
    expect(shouldPersistGraphForScenario(SCENARIO)).toBe(false)

    unmount()

    expect(
      mockSaveGraphViaGatedPath,
      'the unmount flush wrote the kept-unsettled graph over CEE’s commit',
    ).not.toHaveBeenCalled()
  })

  it('(c) unmount with a PENDING (never-fired) debounce must not write the unsettled graph', () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() => useScenario())
    useDraftStore.getState().setDraftStreamPhase('unsettled', 't1', SCENARIO)

    scheduleGraphSave(graphFor('c'))
    unmount()

    expect(mockSaveGraphViaGatedPath).not.toHaveBeenCalled()
  })

  it('(d) CONTROL: with the gate OPEN, a pending debounce IS flushed at unmount — exactly once, for this scenario, with this graph', () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() => useScenario())
    // No unsettled phase: the guard permits the write.
    expect(shouldPersistGraphForScenario(SCENARIO)).toBe(true)

    const graph = graphFor('d')
    scheduleGraphSave(graph)
    unmount()

    expect(mockSaveGraphViaGatedPath).toHaveBeenCalledTimes(1)
    const [sid, written] = mockSaveGraphViaGatedPath.mock.calls[0] as [
      string,
      { nodes: unknown[]; edges: unknown[] },
    ]
    expect(sid).toBe(SCENARIO)
    expect(written.nodes).toEqual(graph)
  })

  it('(e) a debounce that already FIRED AND WROTE is not re-flushed at unmount (the timer ref is nulled once it runs)', async () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() => useScenario())
    expect(shouldPersistGraphForScenario(SCENARIO)).toBe(true)

    scheduleGraphSave(graphFor('e'))
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(mockSaveGraphViaGatedPath).toHaveBeenCalledTimes(1)

    unmount()

    expect(
      mockSaveGraphViaGatedPath,
      'the settled graph was written a SECOND time by a flush for a save that was not pending',
    ).toHaveBeenCalledTimes(1)
  })
})

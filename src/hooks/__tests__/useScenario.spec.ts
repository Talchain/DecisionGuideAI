/**
 * useScenario hook tests — Brief C.1a
 *
 * Verifies:
 * - Auth gating: guest user → all operations are no-ops
 * - createScenario calls service + navigates to /scenario/:id
 * - loadScenario hydrates canvas store correctly
 * - loadScenario handles interrupted analysis (status 'running' → reset)
 * - deleteScenario removes from service and clears store if active
 * - C.1b stubs gate on persistence + currentScenarioId
 * - isPersistenceActive reflects auth state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import type { UseScenarioReturn } from '../useScenario'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

// Auth mock — controllable per test
let mockAuthValue = {
  user: null as { id: string; email?: string } | null,
  authenticated: false,
}

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}))

// scenarioService mock
const mockCreateScenario = vi.fn()
const mockLoadScenario = vi.fn()
const mockDeleteScenario = vi.fn()
const mockSaveGraphViaGatedPath = vi.fn()
const mockSaveFraming = vi.fn()
const mockStoreAnalysis = vi.fn()
const mockStoreAnalysisFailure = vi.fn()
const mockStoreBrief = vi.fn()
const mockSetStage = vi.fn()
const mockCreateSharedBrief = vi.fn()
const mockResetAnalysisStatus = vi.fn()
const mockSetAnalysisRunning = vi.fn()
const mockSaveTitle = vi.fn()

vi.mock('../../services/scenarioService', () => ({
  createScenario: (...args: unknown[]) => mockCreateScenario(...args),
  loadScenario: (...args: unknown[]) => mockLoadScenario(...args),
  deleteScenario: (...args: unknown[]) => mockDeleteScenario(...args),
  saveGraphViaGatedPath: (...args: unknown[]) => mockSaveGraphViaGatedPath(...args),
  saveFraming: (...args: unknown[]) => mockSaveFraming(...args),
  storeAnalysis: (...args: unknown[]) => mockStoreAnalysis(...args),
  storeAnalysisFailure: (...args: unknown[]) => mockStoreAnalysisFailure(...args),
  storeBrief: (...args: unknown[]) => mockStoreBrief(...args),
  setStage: (...args: unknown[]) => mockSetStage(...args),
  createSharedBrief: (...args: unknown[]) => mockCreateSharedBrief(...args),
  resetAnalysisStatus: (...args: unknown[]) => mockResetAnalysisStatus(...args),
  setAnalysisRunning: (...args: unknown[]) => mockSetAnalysisRunning(...args),
  saveTitle: (...args: unknown[]) => mockSaveTitle(...args),
}))

// Canvas store mock — minimal Zustand-compatible mock
const mockHydrateGraphSlice = vi.fn()
const mockMarkClean = vi.fn()
const mockResultsHydrateFromSupabase = vi.fn()
const mockResultsError = vi.fn()

let storeState: Record<string, unknown> = {}

const mockGetState = vi.fn(() => ({
  hydrateGraphSlice: mockHydrateGraphSlice,
  markClean: mockMarkClean,
  resultsHydrateFromSupabase: mockResultsHydrateFromSupabase,
  resultsError: mockResultsError,
  currentScenarioId: storeState.currentScenarioId ?? null,
  ...storeState,
}))

const mockSetState = vi.fn((partial: Record<string, unknown>) => {
  storeState = { ...storeState, ...partial }
})

// Capture every subscribe callback so a test can drive the debounced autosave
// subscription directly (the graph-autosave effect subscribes first).
type StoreSubscriber = (state: Record<string, unknown>, prev: Record<string, unknown>) => void
const mockSubscribeCallbacks: StoreSubscriber[] = []

vi.mock('../../canvas/store', () => ({
  useCanvasStore: Object.assign(
    // The hook-style call: useCanvasStore(selector)
    (selector: (state: Record<string, unknown>) => unknown) => selector(storeState),
    {
      getState: () => mockGetState(),
      setState: (partial: Record<string, unknown>) => mockSetState(partial),
      // subscribe mock — records the callback and returns an unsubscribe no-op
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

// Import after mocks

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
vi.mock('../../lib/clientGraphWritePolicy', () => ({
  clientCanWriteReadableGraph: () => true,
}))

import { useScenario } from '../useScenario'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REAL_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

function setAuth(userId: string | null, authenticated: boolean) {
  mockAuthValue = {
    user: userId ? { id: userId, email: `${userId}@test.com` } : null,
    authenticated,
  }
}

function setStoreState(partial: Record<string, unknown>) {
  storeState = { ...storeState, ...partial }
}

/** Simple wrapper — useScenario needs no special providers since we mock everything */
function renderUseScenario() {
  return renderHook(() => useScenario())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useScenario', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubscribeCallbacks.length = 0
    storeState = {
      currentScenarioId: null,
      nodes: [],
      edges: [],
      currentScenarioFraming: null,
      isDirty: false,
      lastSavedAt: null,
      results: { status: 'idle' },
    }
    setAuth(null, false)
    // Default mock returns — flush-on-unmount calls .catch() on these
    mockSaveGraphViaGatedPath.mockResolvedValue(undefined)
    mockSaveFraming.mockResolvedValue(undefined)
    mockSaveTitle.mockResolvedValue(undefined)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // -----------------------------------------------------------------------
  // isPersistenceActive
  // -----------------------------------------------------------------------

  describe('isPersistenceActive', () => {
    it('is false when unauthenticated', () => {
      setAuth(null, false)
      const { result } = renderUseScenario()
      expect(result.current.isPersistenceActive).toBe(false)
    })

    it('is false for guest user', () => {
      setAuth('guest', true)
      const { result } = renderUseScenario()
      expect(result.current.isPersistenceActive).toBe(false)
    })

    it('is true for a real Supabase user', () => {
      setAuth(REAL_USER_ID, true)
      const { result } = renderUseScenario()
      expect(result.current.isPersistenceActive).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // createScenario
  // -----------------------------------------------------------------------

  describe('createScenario', () => {
    it('throws when persistence is not active', async () => {
      setAuth('guest', true)
      const { result } = renderUseScenario()

      await expect(result.current.createScenario('Test')).rejects.toThrow(
        'Persistence not active',
      )
      expect(mockCreateScenario).not.toHaveBeenCalled()
    })

    it('calls service.createScenario and navigates to /scenario/:id', async () => {
      setAuth(REAL_USER_ID, true)
      mockCreateScenario.mockResolvedValue({ id: 'new-scenario-id' })

      const { result } = renderUseScenario()

      let id: string | undefined
      await act(async () => {
        id = await result.current.createScenario('My Scenario')
      })

      expect(id).toBe('new-scenario-id')
      expect(mockCreateScenario).toHaveBeenCalledWith(
        REAL_USER_ID,
        expect.any(String), // eventId (UUID)
        'My Scenario',
      )
      expect(mockNavigate).toHaveBeenCalledWith('/scenario/new-scenario-id')
    })
  })

  // -----------------------------------------------------------------------
  // loadScenario
  // -----------------------------------------------------------------------

  describe('loadScenario', () => {
    it('is a no-op when persistence is not active', async () => {
      setAuth('guest', true)
      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.loadScenario('some-id')
      })

      expect(mockLoadScenario).not.toHaveBeenCalled()
    })

    it('hydrates canvas store on successful load', async () => {
      setAuth(REAL_USER_ID, true)

      const mockRow = {
        id: 'scenario-1',
        graph: {
          nodes: [{ id: 'n1', data: { label: 'Factor' }, type: 'factor', position: { x: 0, y: 0 } }],
          edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.8 } }],
        },
        framing: { title: 'Test scenario', goal: 'Increase revenue' },
        analysis_status: 'ready',
        updated_at: '2026-01-15T12:00:00Z',
      }
      mockLoadScenario.mockResolvedValue(mockRow)

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.loadScenario('scenario-1')
      })

      // Verify service was called
      expect(mockLoadScenario).toHaveBeenCalledWith('scenario-1')

      // Verify hydrateGraphSlice was called with upgraded edges
      expect(mockHydrateGraphSlice).toHaveBeenCalledWith({
        nodes: mockRow.graph.nodes,
        edges: [
          {
            id: 'e1',
            source: 'n1',
            target: 'n2',
            data: {
              weight: 0.8,      // from persisted data (overrides DEFAULT_EDGE_DATA.weight)
              style: 'solid',   // from DEFAULT_EDGE_DATA
              curvature: 0.15,  // from DEFAULT_EDGE_DATA
            },
          },
        ],
        currentScenarioId: 'scenario-1',
        // B3: every full-context load now assigns the loaded constraints OR
        // null. This row has none, so null — asserted explicitly, because
        // "key absent" was exactly the bug (it let the previous scenario's
        // constraint ride the new one).
        goalConstraints: null,
      })

      // Verify framing and metadata were set
      expect(mockSetState).toHaveBeenCalledWith(
        expect.objectContaining({
          currentScenarioFraming: { title: 'Test scenario', goal: 'Increase revenue' },
          isDirty: false,
        }),
      )

      // Verify save status was set
      expect(result.current.saveStatus).toBe('saved')
      expect(result.current.lastSavedAt).toBe(new Date('2026-01-15T12:00:00Z').getTime())
    })

    it('returns early when scenario not found (null)', async () => {
      setAuth(REAL_USER_ID, true)
      mockLoadScenario.mockResolvedValue(null)

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.loadScenario('nonexistent')
      })

      expect(mockHydrateGraphSlice).not.toHaveBeenCalled()
    })

    it('resets interrupted analysis (status running) with fire-and-forget resetAnalysisStatus', async () => {
      setAuth(REAL_USER_ID, true)

      const mockRow = {
        id: 'scenario-2',
        graph: { nodes: [], edges: [] },
        framing: null,
        analysis_status: 'running', // Interrupted
        updated_at: '2026-01-15T12:00:00Z',
      }
      mockLoadScenario.mockResolvedValue(mockRow)
      mockResetAnalysisStatus.mockResolvedValue(undefined)

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.loadScenario('scenario-2')
      })

      // Should have called resetAnalysisStatus (not a graph write) to reset the interrupted analysis
      expect(mockResetAnalysisStatus).toHaveBeenCalledWith('scenario-2')
      expect(mockSaveGraphViaGatedPath).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // Graph autosave routing (trust-spine board #2)
  //
  // The debounced autosave MUST persist through the single gated path
  // (saveGraphViaGatedPath → apply_patch_and_log, event + hash), never a raw
  // write. Reverting the hook back to a raw `saveGraph` call flips this RED.
  // -----------------------------------------------------------------------

  describe('graph autosave routing', () => {
    it('routes the debounced autosave through saveGraphViaGatedPath', async () => {
      setAuth(REAL_USER_ID, true)
      setStoreState({
        currentScenarioId: 'scenario-1',
        nodes: [{ id: 'n1' }],
        edges: [],
        results: { status: 'idle' },
      })

      renderUseScenario()

      // The graph-autosave effect subscribes first.
      expect(mockSubscribeCallbacks.length).toBeGreaterThan(0)
      const graphSub = mockSubscribeCallbacks[0]

      const prev = { nodes: [{ id: 'n1' }], edges: [], results: { status: 'idle' } }
      const nextNodes = [{ id: 'n1' }, { id: 'n2' }]
      const next = { nodes: nextNodes, edges: [], results: { status: 'idle' } }
      // getState() (read inside the debounce timer) must reflect the change too.
      setStoreState({ nodes: nextNodes, edges: [] })

      await act(async () => {
        graphSub(next, prev)
        await vi.advanceTimersByTimeAsync(1600)
      })

      expect(mockSaveGraphViaGatedPath).toHaveBeenCalledTimes(1)
      const [sid, graph, eventId] = mockSaveGraphViaGatedPath.mock.calls[0]
      expect(sid).toBe('scenario-1')
      expect(graph).toEqual({ nodes: nextNodes, edges: [] })
      expect(typeof eventId).toBe('string')
      expect(eventId.length).toBeGreaterThan(0)
    })

    it('does not autosave in guest mode (persistence inactive)', async () => {
      setAuth('guest', true)
      setStoreState({
        currentScenarioId: 'scenario-1',
        nodes: [{ id: 'n1' }],
        edges: [],
        results: { status: 'idle' },
      })

      renderUseScenario()

      // Subscription still registers, but the callback must no-op for guests.
      const graphSub = mockSubscribeCallbacks[0]
      if (graphSub) {
        await act(async () => {
          graphSub(
            { nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [], results: { status: 'idle' } },
            { nodes: [{ id: 'n1' }], edges: [], results: { status: 'idle' } },
          )
          await vi.advanceTimersByTimeAsync(1600)
        })
      }

      expect(mockSaveGraphViaGatedPath).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // deleteScenario
  // -----------------------------------------------------------------------

  describe('deleteScenario', () => {
    it('is a no-op when persistence is not active', async () => {
      setAuth('guest', true)
      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.deleteScenario('some-id')
      })

      expect(mockDeleteScenario).not.toHaveBeenCalled()
    })

    it('calls service.deleteScenario', async () => {
      setAuth(REAL_USER_ID, true)
      mockDeleteScenario.mockResolvedValue(undefined)

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.deleteScenario('scenario-1')
      })

      expect(mockDeleteScenario).toHaveBeenCalledWith('scenario-1')
    })

    it('clears currentScenarioId from store when deleting the active scenario', async () => {
      setAuth(REAL_USER_ID, true)
      setStoreState({ currentScenarioId: 'active-scenario' })
      mockDeleteScenario.mockResolvedValue(undefined)

      // Override getState to return the active scenario
      mockGetState.mockReturnValue({
        hydrateGraphSlice: mockHydrateGraphSlice,
        markClean: mockMarkClean,
        currentScenarioId: 'active-scenario',
      })

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.deleteScenario('active-scenario')
      })

      expect(mockSetState).toHaveBeenCalledWith({ currentScenarioId: null })
    })
  })

  // -----------------------------------------------------------------------
  // C.1b stubs — persistence gating
  // -----------------------------------------------------------------------

  describe('C.1b stubs', () => {
    it('persistAnalysisSuccess is a no-op without persistence', async () => {
      setAuth('guest', true)
      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.persistAnalysisSuccess({}, 'hash', 42, 'resp')
      })

      expect(mockStoreAnalysis).not.toHaveBeenCalled()
    })

    it('persistAnalysisSuccess is a no-op without currentScenarioId', async () => {
      setAuth(REAL_USER_ID, true)
      setStoreState({ currentScenarioId: null })

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.persistAnalysisSuccess({}, 'hash', 42, 'resp')
      })

      expect(mockStoreAnalysis).not.toHaveBeenCalled()
    })

    it('persistAnalysisSuccess calls storeAnalysis when active', async () => {
      setAuth(REAL_USER_ID, true)
      setStoreState({ currentScenarioId: 'scenario-1' })
      mockStoreAnalysis.mockResolvedValue(undefined)

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.persistAnalysisSuccess(
          { data: 'analysis' },
          'graph-hash',
          42,
          'resp-hash',
          { winner: 'A' },
          'turn-1',
        )
      })

      expect(mockStoreAnalysis).toHaveBeenCalledWith(
        'scenario-1',
        { data: 'analysis' },
        'graph-hash',
        42,
        'resp-hash',
        expect.any(String), // eventId
        { winner: 'A' },
        'turn-1',
      )
    })

    it('persistAnalysisFailure gates on persistence + scenarioId', async () => {
      setAuth('guest', true)
      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.persistAnalysisFailure({ code: 'ERR', message: 'fail' })
      })

      expect(mockStoreAnalysisFailure).not.toHaveBeenCalled()
    })

    it('persistBrief gates on persistence + scenarioId', async () => {
      setAuth('guest', true)
      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.persistBrief({ brief: 'data' })
      })

      expect(mockStoreBrief).not.toHaveBeenCalled()
    })

    it('setStage gates on persistence + scenarioId', async () => {
      setAuth('guest', true)
      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.setStage('evaluate')
      })

      expect(mockSetStage).not.toHaveBeenCalled()
    })

    it('createSharedBrief returns null when persistence is not active', async () => {
      setAuth('guest', true)
      const { result } = renderUseScenario()

      let res: { slug: string } | null = null
      await act(async () => {
        res = await result.current.createSharedBrief()
      })

      expect(res).toBeNull()
      expect(mockCreateSharedBrief).not.toHaveBeenCalled()
    })

    it('createSharedBrief calls service when active', async () => {
      setAuth(REAL_USER_ID, true)
      setStoreState({ currentScenarioId: 'scenario-1' })
      mockCreateSharedBrief.mockResolvedValue({ id: 'sb-1', slug: 'abc123' })

      const { result } = renderUseScenario()

      let res: { slug: string } | null = null
      await act(async () => {
        res = await result.current.createSharedBrief()
      })

      expect(res).toEqual({ slug: 'abc123' })
      expect(mockCreateSharedBrief).toHaveBeenCalledWith('scenario-1')
    })
  })

  // -----------------------------------------------------------------------
  // Save status defaults
  // -----------------------------------------------------------------------

  describe('save status defaults', () => {
    it('starts with saved status and null timestamps', () => {
      setAuth(REAL_USER_ID, true)
      const { result } = renderUseScenario()

      expect(result.current.saveStatus).toBe('saved')
      expect(result.current.lastSavedAt).toBeNull()
      expect(result.current.saveError).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // C.1b: setAnalysisRunning
  // -----------------------------------------------------------------------

  describe('setAnalysisRunning', () => {
    it('is a no-op without persistence', async () => {
      setAuth('guest', true)
      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.setAnalysisRunning()
      })

      expect(mockSetAnalysisRunning).not.toHaveBeenCalled()
    })

    it('calls service.setAnalysisRunning when active', async () => {
      setAuth(REAL_USER_ID, true)
      setStoreState({ currentScenarioId: 'scenario-1' })
      mockSetAnalysisRunning.mockResolvedValue(undefined)

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.setAnalysisRunning()
      })

      expect(mockSetAnalysisRunning).toHaveBeenCalledWith('scenario-1')
    })
  })

  // -----------------------------------------------------------------------
  // C.1b: resetAnalysisStatus
  // -----------------------------------------------------------------------

  describe('resetAnalysisStatus', () => {
    it('is a no-op without persistence', async () => {
      setAuth('guest', true)
      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.resetAnalysisStatus()
      })

      expect(mockResetAnalysisStatus).not.toHaveBeenCalled()
    })

    it('calls service.resetAnalysisStatus when active', async () => {
      setAuth(REAL_USER_ID, true)
      setStoreState({ currentScenarioId: 'scenario-1' })
      mockResetAnalysisStatus.mockResolvedValue(undefined)

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.resetAnalysisStatus()
      })

      expect(mockResetAnalysisStatus).toHaveBeenCalledWith('scenario-1')
    })
  })

  // -----------------------------------------------------------------------
  // C.1b: analysisStale
  // -----------------------------------------------------------------------

  describe('analysisStale', () => {
    it('starts as false', () => {
      setAuth(REAL_USER_ID, true)
      const { result } = renderUseScenario()
      expect(result.current.analysisStale).toBe(false)
    })

    it('is cleared by clearAnalysisStale', () => {
      setAuth(REAL_USER_ID, true)
      const { result } = renderUseScenario()

      act(() => {
        result.current.clearAnalysisStale()
      })

      expect(result.current.analysisStale).toBe(false)
    })

    it('is cleared by persistAnalysisSuccess', async () => {
      setAuth(REAL_USER_ID, true)
      setStoreState({ currentScenarioId: 'scenario-1' })
      mockStoreAnalysis.mockResolvedValue(undefined)

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.persistAnalysisSuccess({}, 'hash', 42, 'resp')
      })

      expect(result.current.analysisStale).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // C.1b: Auto-title from framing goal (Task 10 + H2 fix)
  // -----------------------------------------------------------------------

  describe('auto-title', () => {
    it('fires saveTitle when framing has goal and no existing title', async () => {
      setAuth(REAL_USER_ID, true)
      setStoreState({
        currentScenarioId: 'scenario-1',
        currentScenarioFraming: { goal: 'Increase revenue by 20%' },
      })
      mockSaveTitle.mockResolvedValue(undefined)

      renderUseScenario()

      // Auto-title fires synchronously in the effect cycle
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(mockSaveTitle).toHaveBeenCalledWith('scenario-1', 'Increase revenue by 20%')
    })

    it('does NOT fire saveTitle when framing already has a non-empty title', async () => {
      setAuth(REAL_USER_ID, true)
      setStoreState({
        currentScenarioId: 'scenario-1',
        currentScenarioFraming: { title: 'My Custom Title', goal: 'Increase revenue' },
      })

      renderUseScenario()

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(mockSaveTitle).not.toHaveBeenCalled()
    })

    it('truncates goals longer than 60 characters', async () => {
      setAuth(REAL_USER_ID, true)
      const longGoal = 'A'.repeat(80)
      setStoreState({
        currentScenarioId: 'scenario-1',
        currentScenarioFraming: { goal: longGoal },
      })
      mockSaveTitle.mockResolvedValue(undefined)

      renderUseScenario()

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(mockSaveTitle).toHaveBeenCalledWith('scenario-1', 'A'.repeat(57) + '...')
    })

    it('does not fire when persistence is inactive', async () => {
      setAuth('guest', true)
      setStoreState({
        currentScenarioId: 'scenario-1',
        currentScenarioFraming: { goal: 'Some goal' },
      })

      renderUseScenario()

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(mockSaveTitle).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // P0-1: Analysis hydration on load
  // -----------------------------------------------------------------------

  describe('analysis hydration', () => {
    it('hydrates results when analysis_status is ready', async () => {
      setAuth(REAL_USER_ID, true)

      const mockRow = {
        id: 'scenario-3',
        graph: { nodes: [], edges: [] },
        framing: null,
        analysis_status: 'ready',
        analysis: {
          analysis_status: 'computed',
          option_comparison_status: 'computed',
          robustness_status: 'unavailable',
          drivers_status: 'unavailable',
          option_comparison: [
            { option_id: 'opt-1', option_label: 'Option A', confidence_interval: [0.3, 0.7] },
          ],
          critiques: [],
          response_hash: 'resp-hash-from-analysis',
        },
        analysis_provenance: {
          graph_hash: 'g-hash',
          seed_used: 42,
          response_hash: 'resp-hash-prov',
          analysed_at: '2026-02-20T10:00:00Z',
        },
        analysis_error: null,
        updated_at: '2026-02-20T10:00:00Z',
      }
      mockLoadScenario.mockResolvedValue(mockRow)

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.loadScenario('scenario-3')
      })

      // resultsHydrateFromSupabase should have been called
      expect(mockResultsHydrateFromSupabase).toHaveBeenCalledTimes(1)
      const hydrated = mockResultsHydrateFromSupabase.mock.calls[0][0]
      expect(hydrated.results.status).toBe('complete')
      expect(hydrated.results.progress).toBe(100)
      expect(hydrated.results.seed).toBe(42)
      expect(hydrated.results.hash).toBe('resp-hash-prov')

      // Staleness metadata set via setState
      expect(mockSetState).toHaveBeenCalledWith(
        expect.objectContaining({
          currentScenarioLastResultHash: 'resp-hash-prov',
          currentScenarioLastRunAt: '2026-02-20T10:00:00Z',
          currentScenarioLastRunSeed: '42',
        }),
      )
    })

    it('hydrates error state when analysis_status is failed', async () => {
      setAuth(REAL_USER_ID, true)

      const mockRow = {
        id: 'scenario-4',
        graph: { nodes: [], edges: [] },
        framing: null,
        analysis_status: 'failed',
        analysis: null,
        analysis_provenance: null,
        analysis_error: { code: 'TIMEOUT', message: 'Analysis timed out' },
        updated_at: '2026-02-20T10:00:00Z',
      }
      mockLoadScenario.mockResolvedValue(mockRow)

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.loadScenario('scenario-4')
      })

      // Should set error state with stale fields cleared
      expect(mockSetState).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.objectContaining({
            status: 'error',
            error: expect.objectContaining({
              code: 'TIMEOUT',
              message: 'Analysis timed out',
            }),
          }),
          currentScenarioLastResultHash: null,
          currentScenarioLastRunSeed: null,
        }),
      )
      // resultsHydrateFromSupabase should NOT have been called
      expect(mockResultsHydrateFromSupabase).not.toHaveBeenCalled()
    })

    it('does not crash when analysis_status is ready but analysis is null', async () => {
      setAuth(REAL_USER_ID, true)

      const mockRow = {
        id: 'scenario-5',
        graph: { nodes: [], edges: [] },
        framing: null,
        analysis_status: 'ready',
        analysis: null,
        analysis_provenance: null,
        analysis_error: null,
        updated_at: '2026-02-20T10:00:00Z',
      }
      mockLoadScenario.mockResolvedValue(mockRow)

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.loadScenario('scenario-5')
      })

      expect(mockResultsHydrateFromSupabase).not.toHaveBeenCalled()
    })

    it('does not hydrate analysis when analysis_status is none', async () => {
      setAuth(REAL_USER_ID, true)

      const mockRow = {
        id: 'scenario-7',
        graph: { nodes: [], edges: [] },
        framing: null,
        analysis_status: 'none',
        analysis: null,
        analysis_provenance: null,
        analysis_error: null,
        updated_at: '2026-02-20T10:00:00Z',
      }
      mockLoadScenario.mockResolvedValue(mockRow)

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.loadScenario('scenario-7')
      })

      expect(mockResultsHydrateFromSupabase).not.toHaveBeenCalled()
    })

    it('hydrates error with defaults when analysis_error has no code/message', async () => {
      setAuth(REAL_USER_ID, true)

      const mockRow = {
        id: 'scenario-8',
        graph: { nodes: [], edges: [] },
        framing: null,
        analysis_status: 'failed',
        analysis: null,
        analysis_provenance: null,
        analysis_error: {},
        updated_at: '2026-02-20T10:00:00Z',
      }
      mockLoadScenario.mockResolvedValue(mockRow)

      const { result } = renderUseScenario()

      await act(async () => {
        await result.current.loadScenario('scenario-8')
      })

      expect(mockSetState).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.objectContaining({
            error: expect.objectContaining({
              code: 'PERSISTED_FAILURE',
              message: 'Previous analysis failed',
            }),
          }),
        }),
      )
    })
  })

  // -----------------------------------------------------------------------
  // C.1b: Navigation guard (beforeunload)
  // -----------------------------------------------------------------------

  describe('navigation guard', () => {
    it('adds beforeunload handler', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      setAuth(REAL_USER_ID, true)
      renderUseScenario()

      expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
      addSpy.mockRestore()
    })

    it('removes beforeunload handler on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      setAuth(REAL_USER_ID, true)
      const { unmount } = renderUseScenario()

      unmount()

      expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
      removeSpy.mockRestore()
    })
  })
})

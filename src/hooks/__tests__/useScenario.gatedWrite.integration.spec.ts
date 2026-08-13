/**
 * Trust-spine board #2 — behavioural pins for EVERY autosave write path.
 *
 * WHY THIS FILE EXISTS (review finding): useScenario.spec.ts mocks
 * scenarioService wholesale, so mutating the retry / unmount-flush call sites
 * went RED only via a mock-shape artifact ("No `saveGraph` export defined on
 * the mock") rather than a real assertion about what got persisted. A raw
 * `supabase.from('scenarios').update({ graph })` introduced in the hook would
 * have satisfied that mock-shaped test and shipped.
 *
 * So this spec deliberately does NOT mock scenarioService. It wires the REAL
 * service to a mocked `lib/supabase` and asserts, for all three write paths
 * (debounced save, retry-after-failure, unmount flush), that the actual
 * `apply_patch_and_log` RPC was invoked with the gated payload — a
 * `graph_saved` event carrying a derived `graph_hash`. Nothing here can pass
 * on "no error was thrown".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// --- supabase (the real boundary we assert on) ------------------------------
const mockRpc = vi.fn()
const mockUpdate = vi.fn((..._args: unknown[]) => ({
  eq: vi.fn().mockResolvedValue({ error: null }),
}))
const mockFrom = vi.fn((..._args: unknown[]) => ({
  update: mockUpdate,
  upsert: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
  insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
  select: vi.fn(() => ({ eq: vi.fn(), order: vi.fn() })),
  delete: vi.fn(() => ({ eq: vi.fn() })),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

// --- router / auth ----------------------------------------------------------
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

const REAL_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
let mockAuthValue: { user: { id: string } | null; authenticated: boolean } = {
  user: { id: REAL_USER_ID },
  authenticated: true,
}
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mockAuthValue }))

// --- canvas store (capture the autosave subscription) -----------------------
type StoreSubscriber = (state: Record<string, unknown>, prev: Record<string, unknown>) => void
const mockSubscribeCallbacks: StoreSubscriber[] = []
let storeState: Record<string, unknown> = {}

vi.mock('../../canvas/store', () => ({
  useCanvasStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) => selector(storeState),
    {
      getState: () => ({
        markClean: vi.fn(),
        hydrateGraphSlice: vi.fn(),
        resultsHydrateFromSupabase: vi.fn(),
        ...storeState,
      }),
      setState: (partial: Record<string, unknown>) => {
        storeState = { ...storeState, ...partial }
      },
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCENARIO_ID = 'scenario-1'
const NODES_BEFORE = [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } }]
const NODES_AFTER = [
  ...NODES_BEFORE,
  { id: 'n2', type: 'option', position: { x: 1, y: 1 }, data: { label: 'B' } },
]

/** Every apply_patch_and_log invocation seen so far. */
function gatedCalls() {
  return mockRpc.mock.calls.filter((c) => c[0] === 'apply_patch_and_log')
}

/** Assert one gated write happened with the full event payload. */
function expectGatedPayload(params: Record<string, unknown>) {
  expect(params.p_scenario_id).toBe(SCENARIO_ID)
  expect(params.p_event_type).toBe('graph_saved')
  expect(typeof params.p_event_id).toBe('string')
  expect((params.p_event_id as string).length).toBeGreaterThan(0)
  const hashes = params.p_hashes as { graph_hash?: string }
  expect(typeof hashes?.graph_hash).toBe('string')
  expect(hashes.graph_hash!.length).toBeGreaterThan(0)
  const graph = params.p_graph as { nodes: unknown[]; edges: unknown[] }
  expect(graph.nodes).toHaveLength(NODES_AFTER.length)
}

/** Drive a nodes change through the captured autosave subscription. */
function triggerGraphChange() {
  storeState = { ...storeState, nodes: NODES_AFTER, edges: [] }
  const graphSub = mockSubscribeCallbacks[0]
  graphSub(
    { nodes: NODES_AFTER, edges: [], results: { status: 'idle' } },
    { nodes: NODES_BEFORE, edges: [], results: { status: 'idle' } },
  )
}

describe('useScenario — every graph write path goes through apply_patch_and_log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubscribeCallbacks.length = 0
    mockAuthValue = { user: { id: REAL_USER_ID }, authenticated: true }
    storeState = {
      currentScenarioId: SCENARIO_ID,
      nodes: NODES_BEFORE,
      edges: [],
      currentScenarioFraming: null,
      isDirty: false,
      lastSavedAt: null,
      results: { status: 'idle' },
    }
    mockRpc.mockResolvedValue({ data: {}, error: null })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // Path 1 — the debounced save
  // -------------------------------------------------------------------------

  it('debounced autosave calls apply_patch_and_log with a graph_saved event + hash', async () => {
    renderHook(() => useScenario())

    await act(async () => {
      triggerGraphChange()
      await vi.advanceTimersByTimeAsync(1600)
    })

    const calls = gatedCalls()
    expect(calls).toHaveLength(1)
    expectGatedPayload(calls[0][1] as Record<string, unknown>)
    // And crucially: no raw column write.
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Path 2 — the retry after a failed save (useScenario.ts retry branch)
  // -------------------------------------------------------------------------

  it('RETRY after a failed save re-persists through the gated RPC', async () => {
    // First gated write fails; the retry (3s later) succeeds.
    mockRpc
      .mockResolvedValueOnce({ data: null, error: { message: 'network blip' } })
      .mockResolvedValue({ data: {}, error: null })

    renderHook(() => useScenario())

    await act(async () => {
      triggerGraphChange()
      await vi.advanceTimersByTimeAsync(1600) // debounce → attempt 1 (fails)
    })
    expect(gatedCalls()).toHaveLength(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3200) // RETRY_DELAY_MS → attempt 2
    })

    const calls = gatedCalls()
    expect(calls).toHaveLength(2)
    // The retry is a real gated write with its own event id, not a raw update.
    expectGatedPayload(calls[1][1] as Record<string, unknown>)
    expect(calls[1][1].p_event_id).not.toBe(calls[0][1].p_event_id)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Path 3 — the unmount flush (pending debounce fired on cleanup)
  // -------------------------------------------------------------------------

  it('UNMOUNT FLUSH of a pending save persists through the gated RPC', async () => {
    const { unmount } = renderHook(() => useScenario())

    // Schedule a debounced save but do NOT let it fire...
    await act(async () => {
      triggerGraphChange()
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(gatedCalls()).toHaveLength(0)

    // ...then unmount: the cleanup must flush it through the gated path.
    await act(async () => {
      unmount()
      await Promise.resolve()
    })

    const calls = gatedCalls()
    expect(calls).toHaveLength(1)
    expectGatedPayload(calls[0][1] as Record<string, unknown>)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Guest mode — zero RPC, zero raw write
  // -------------------------------------------------------------------------

  it('guest mode performs NO graph write at all (no RPC, no raw update)', async () => {
    mockAuthValue = { user: { id: 'guest' }, authenticated: true }
    const { unmount } = renderHook(() => useScenario())

    await act(async () => {
      triggerGraphChange()
      await vi.advanceTimersByTimeAsync(1600)
    })
    await act(async () => {
      unmount()
      await Promise.resolve()
    })

    expect(gatedCalls()).toHaveLength(0)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

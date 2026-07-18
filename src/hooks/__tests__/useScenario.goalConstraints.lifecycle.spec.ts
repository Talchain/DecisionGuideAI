/**
 * B3 (Codex deep review, 2026-07-18) — `goal_constraints` lifecycle.
 *
 * Before this lane the constraint was SESSION-ONLY, which broke in two
 * opposite directions:
 *
 *   1. LEAK A→B. The production hydration clear-set (DECISION_CONTEXT_CLEAR,
 *      consumed by hydrateGraphSlice) listed every other member of the goal
 *      context but not `goalConstraints`. Switching from a scenario with a
 *      £50k cap to one with none left the cap in place, and B's first run
 *      could ship A's constraint.
 *   2. LOST ON COLD LOAD. `useScenario.loadScenario` reconstructed only
 *      `{ nodes, edges }` from the row, and the autosave WROTE only
 *      `{ nodes, edges }` — which also stripped any top-level
 *      `goal_constraints` CEE had persisted into that column.
 *
 * The existing positive control for the IMMEDIATE path is
 * `canvas/conversation/__tests__/draftGoalConstraints.wire.spec.ts`: it proves
 * real CEE wire bytes reach the store. That half already worked and is
 * deliberately untouched. This file covers the half that did not: PERSISTENCE
 * and HYDRATION.
 *
 * Both cases below fail on the pre-fix HEAD — case 1 retains A's constraint,
 * case 2 restores nothing.
 *
 * Deliberately NOT mocking scenarioService: the defect lived in the exact
 * bytes handed to / read back from the gated RPC, so a mocked service would
 * assert against the wrong surface (the same trap documented at the top of
 * useScenario.gatedWrite.integration.spec.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// --- supabase (the real boundary) ------------------------------------------
const mockRpc = vi.fn()
let mockRowsById: Record<string, Record<string, unknown>> = {}

const mockSingle = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          single: () => mockSingle(id),
        }),
      }),
      update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

const REAL_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: REAL_USER_ID }, authenticated: true }),
}))

import { useScenario } from '../useScenario'
import { useCanvasStore } from '../../canvas/store'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CAP_50K = [
  {
    constraint_id: 'constraint_spend_max',
    node_id: 'factor-1',
    operator: '<=' as const,
    value: 50000,
    unit: 'GBP',
  },
]

const NODES = [
  { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Revenue' } },
  { id: 'factor-1', type: 'factor', position: { x: 0, y: 100 }, data: { kind: 'factor', label: 'Spend' } },
]

function scenarioRow(id: string, graph: unknown): Record<string, unknown> {
  return {
    id,
    graph,
    framing: null,
    stage: 'analyse',
    updated_at: new Date().toISOString(),
    analysis_status: 'none',
    analysis: null,
    analysis_provenance: null,
    analysis_error: null,
    thread: null,
    events: null,
  }
}

/** The `p_graph` of the most recent gated write. */
function lastWrittenGraph(): Record<string, unknown> | null {
  const calls = mockRpc.mock.calls.filter((c) => c[0] === 'apply_patch_and_log')
  if (calls.length === 0) return null
  return (calls[calls.length - 1][1] as Record<string, unknown>)
    .p_graph as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRowsById = {}
  mockSingle.mockImplementation(async (id: string) =>
    mockRowsById[id]
      ? { data: mockRowsById[id], error: null }
      : { data: null, error: { code: 'PGRST116' } },
  )
  mockRpc.mockResolvedValue({ data: {}, error: null })
  useCanvasStore.getState().setGoalConstraints(null)
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Case 1 — the LEAK: A (non-empty) → B (absent) must CLEAR
// ---------------------------------------------------------------------------

describe('B3 — goal_constraints do not leak across a scenario switch', () => {
  it('switching from a scenario WITH a constraint to one WITHOUT clears it', async () => {
    mockRowsById['scenario-A'] = scenarioRow('scenario-A', {
      nodes: NODES,
      edges: [],
      goal_constraints: CAP_50K,
    })
    // B genuinely has no constraint — the key is absent, as it is for every
    // scenario created before this lane.
    mockRowsById['scenario-B'] = scenarioRow('scenario-B', {
      nodes: NODES,
      edges: [],
    })

    const { result } = renderHook(() => useScenario())

    await act(async () => {
      await result.current.loadScenario('scenario-A')
    })

    // Precondition — A's constraint really did land. Without this assertion
    // the clear below could pass against a value that was never there.
    expect(useCanvasStore.getState().goalConstraints).toHaveLength(1)
    expect(useCanvasStore.getState().goalConstraints![0].value).toBe(50000)

    await act(async () => {
      await result.current.loadScenario('scenario-B')
    })

    // THE DEFECT: this was A's constraint, still sitting on B, ready to be
    // sent on B's first run.
    expect(useCanvasStore.getState().goalConstraints).toBeNull()
  })

  it('switching between two scenarios that BOTH have constraints installs the new one', () => {
    // Guards against "fixed the leak by always clearing" — a clear-only fix
    // would pass the case above and still lose every real constraint.
    mockRowsById['scenario-A'] = scenarioRow('scenario-A', {
      nodes: NODES,
      edges: [],
      goal_constraints: CAP_50K,
    })
    mockRowsById['scenario-C'] = scenarioRow('scenario-C', {
      nodes: NODES,
      edges: [],
      goal_constraints: [{ ...CAP_50K[0], constraint_id: 'c_other', value: 120000 }],
    })

    const { result } = renderHook(() => useScenario())

    return act(async () => {
      await result.current.loadScenario('scenario-A')
      expect(useCanvasStore.getState().goalConstraints![0].value).toBe(50000)
      await result.current.loadScenario('scenario-C')
      expect(useCanvasStore.getState().goalConstraints).toHaveLength(1)
      expect(useCanvasStore.getState().goalConstraints![0].value).toBe(120000)
    })
  })
})

// ---------------------------------------------------------------------------
// Case 2 — the ROUND TRIP: save → cold load must PRESERVE
// ---------------------------------------------------------------------------

describe('B3 — goal_constraints survive save → cold load', () => {
  it('a constraint held in memory is written to the graph column and restored on reload', async () => {
    vi.useFakeTimers()

    // Cold-load a constraint-free scenario, then have CEE deliver a
    // constraint into the store (what applyDraftResult does on a real turn).
    mockRowsById['scenario-A'] = scenarioRow('scenario-A', { nodes: NODES, edges: [] })

    const { result, unmount } = renderHook(() => useScenario())

    await act(async () => {
      await result.current.loadScenario('scenario-A')
    })
    expect(useCanvasStore.getState().goalConstraints).toBeNull()

    // A turn arrives carrying the cap, and the graph changes with it.
    await act(async () => {
      useCanvasStore.getState().setGoalConstraints(CAP_50K as never)
      useCanvasStore.setState({
        nodes: [...NODES, { id: 'factor-2', type: 'factor', position: { x: 0, y: 200 }, data: { kind: 'factor', label: 'Risk' } }],
      } as never)
      await vi.advanceTimersByTimeAsync(1600) // past GRAPH_DEBOUNCE_MS
    })

    // HALF 1 — the constraint actually reached the persisted payload. Before
    // this lane `p_graph` was `{ nodes, edges }` and this key did not exist.
    const written = lastWrittenGraph()
    expect(written).not.toBeNull()
    expect(written!.goal_constraints).toBeDefined()
    expect((written!.goal_constraints as unknown[])).toHaveLength(1)
    expect((written!.goal_constraints as Array<{ value: number }>)[0].value).toBe(50000)

    // The hash is still derived over nodes+edges only — widening it would
    // fork this UI's definition from CEE's.
    const rpcArgs = mockRpc.mock.calls.filter((c) => c[0] === 'apply_patch_and_log').pop()![1] as Record<string, unknown>
    expect((rpcArgs.p_hashes as { graph_hash?: string }).graph_hash).toBeTruthy()

    unmount()

    // HALF 2 — COLD LOAD. Feed back exactly the bytes that were written,
    // into a fresh store with the constraint cleared: nothing survives in
    // memory, so anything present afterwards came out of the column.
    vi.useRealTimers()
    useCanvasStore.getState().setGoalConstraints(null)
    mockRowsById['scenario-A'] = scenarioRow('scenario-A', written)

    const reloaded = renderHook(() => useScenario())
    await act(async () => {
      await reloaded.result.current.loadScenario('scenario-A')
    })

    expect(useCanvasStore.getState().goalConstraints).toHaveLength(1)
    expect(useCanvasStore.getState().goalConstraints![0].value).toBe(50000)
    expect(useCanvasStore.getState().goalConstraints![0].operator).toBe('<=')
  })

  it('a malformed persisted constraint degrades to null rather than reaching a run', async () => {
    // The column is untyped JSONB and this value feeds the run request.
    mockRowsById['scenario-junk'] = scenarioRow('scenario-junk', {
      nodes: NODES,
      edges: [],
      goal_constraints: [{ label: 'no operator, no value' }, 'not an object'],
    })

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.loadScenario('scenario-junk')
    })

    expect(useCanvasStore.getState().goalConstraints).toBeNull()
  })
})

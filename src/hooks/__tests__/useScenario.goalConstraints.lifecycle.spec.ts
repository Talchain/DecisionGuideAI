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
// R-3: the harness now lives at src/test/helpers/useScenarioSupabaseHarness.ts,
// shared with canvas/utils/__tests__/edgeValidationRebuildHops.spec.ts, which had
// copied it from here line-for-line (~135 lines) and had already narrowed
// `scenarioRow` to `(id, edges)` with `graph` hard-wired. The harness keeps THIS
// file's `(id, graph)` signature, so nothing here loses reach.
//
// ⚠ THIS IMPORT MUST STAY ABOVE the imports of the code under test below — the
// `vi.mock` factories close over the harness. See the harness header.
import {
  HARNESS_NODES,
  supabaseMockModule,
  authMockModule,
  routerMockModule,
  resetScenarioHarness,
  setScenarioRow,
  scenarioRow,
  mockRpc,
  lastWrittenGraph,
} from '../../test/helpers/useScenarioSupabaseHarness'

// Only the SPECIFIERS stay here — they resolve relative to this file.
vi.mock('../../lib/supabase', () => supabaseMockModule())
vi.mock('react-router-dom', () => routerMockModule())
vi.mock('../../contexts/AuthContext', () => authMockModule())


// ⚠ THE CLIENT GRAPH-WRITE POLICY IS LIFTED FOR THIS FILE — deliberately.
//
// P0 2026-08-13 shut the client's write to `scenarios.graph` entirely
// (`lib/clientGraphWritePolicy.ts`): it holds raw React Flow bytes, there is no
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

/** R-3: from the shared harness — `scenarioRow` and `lastWrittenGraph` too. */
const NODES = HARNESS_NODES

/** Make the faked Supabase serve a scenario row holding this graph. */
function seedRow(id: string, graph: unknown): void {
  setScenarioRow(id, scenarioRow(id, graph))
}

beforeEach(() => {
  vi.clearAllMocks()
  // Re-arms both spies, including the `PGRST116` "no rows" arm `useScenario`
  // branches on — `vi.clearAllMocks()` above strips the implementations, so this
  // must run after it.
  resetScenarioHarness()
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
    seedRow('scenario-A', {
      nodes: NODES,
      edges: [],
      goal_constraints: CAP_50K,
    })
    // B genuinely has no constraint — the key is absent, as it is for every
    // scenario created before this lane.
    seedRow('scenario-B', {
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
    seedRow('scenario-A', {
      nodes: NODES,
      edges: [],
      goal_constraints: CAP_50K,
    })
    seedRow('scenario-C', {
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
    seedRow('scenario-A', { nodes: NODES, edges: [] })

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
    seedRow('scenario-A', written)

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
    seedRow('scenario-junk', {
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

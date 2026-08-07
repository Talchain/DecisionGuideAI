/**
 * B2 (Codex deep review, 2026-07-18) — END-TO-END durability of a CEE edit.
 *
 * THE FAILURE THIS PINS
 * ---------------------
 * The user confirms "set Spend from 100 to 250 and add Risk". CEE re-referees,
 * canonicalises, commits BOTH operations, and returns the authoritative
 * post-commit graph as top-level `draft_graph` (a successful edit carries no
 * blocks — `edit-graph-dispatch.ts:832-833`).
 *
 * The UI's ingestion was ADDITIVE: it added Risk but deliberately did not
 * update Spend. That alone would be a display bug. What made it data LOSS is
 * the second half: adding Risk changed store state, which woke the 1500ms
 * autosave, which then wrote the whole graph — including the stale Spend=100 —
 * over the 250 CEE had already committed. The server was right, the user was
 * told it worked, and 1.5 seconds later it was silently undone.
 *
 * WHY THIS TEST IS SHAPED THIS WAY
 * --------------------------------
 * Asserting on the store alone would have passed the moment the reconcile was
 * fixed while leaving the write-back live — the defect is a RACE between two
 * layers, so the test has to cross both. It therefore drives the REAL
 * reconcile, the REAL useScenario autosave, and the REAL scenarioService
 * against a mocked supabase, and checks all four stations the review named:
 *
 *      immediate UI  →  past the debounce  →  the DB payload  →  reload
 *
 * Nothing here can pass on "no error was thrown": every assertion names the
 * value 250 at a specific station.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// --- supabase (the "database") ---------------------------------------------
const mockRpc = vi.fn()
let mockRowsById: Record<string, Record<string, unknown>> = {}
const mockSingle = vi.fn()

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) => ({ single: () => mockSingle(id) }),
      }),
      update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '550e8400-e29b-41d4-a716-446655440000' },
    authenticated: true,
  }),
}))

import { useScenario } from '../../../hooks/useScenario'
import { useCanvasStore } from '../../store'
import { reconcileAppliedGraph } from '../mergeAppliedGraph'

const SCENARIO_ID = 'scenario-e2e'

/** The canvas as it stands before the turn: Spend = 100. */
const NODES_BEFORE = [
  { id: 'goal-1', type: 'goal', position: { x: 400, y: 0 }, data: { kind: 'goal', label: 'Revenue' } },
  {
    id: 'factor-1',
    type: 'factor',
    position: { x: 40, y: 200 },
    data: { kind: 'factor', label: 'Spend', observedState: { value: 100 } },
  },
]
const EDGES_BEFORE = [
  {
    id: 'e-0',
    source: 'factor-1',
    target: 'goal-1',
    type: 'styled',
    data: { weight: 0.7, direction: 'positive' },
  },
]

/**
 * The authoritative post-commit receipt for "set Spend to 250 and add Risk".
 * Note the shape: the FULL graph in CEE's analytical spelling, with no
 * position fields anywhere — CEE's NodeV3 has none.
 */
const RECEIPT = {
  nodes: [
    { id: 'goal-1', kind: 'goal', label: 'Revenue' },
    { id: 'factor-1', kind: 'factor', label: 'Spend', observed_state: { value: 250 } },
    { id: 'risk-1', kind: 'risk', label: 'Risk' },
  ],
  edges: [
    { id: 'factor-1::goal-1::0', from: 'factor-1', to: 'goal-1', weight: 0.7 },
    { id: 'risk-1::goal-1::0', from: 'risk-1', to: 'goal-1', weight: -0.4 },
  ],
}

function scenarioRow(graph: unknown): Record<string, unknown> {
  return {
    id: SCENARIO_ID,
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

/** The `p_graph` of the most recent gated write — i.e. what the DB now holds. */
function persistedGraph(): Record<string, unknown> | null {
  const calls = mockRpc.mock.calls.filter((c) => c[0] === 'apply_patch_and_log')
  if (calls.length === 0) return null
  return (calls[calls.length - 1][1] as Record<string, unknown>).p_graph as Record<string, unknown>
}

function spendValueOf(nodes: unknown): unknown {
  const n = (nodes as Array<Record<string, any>>).find((x) => x.id === 'factor-1')
  return n?.data?.observedState?.value
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRowsById = { [SCENARIO_ID]: scenarioRow({ nodes: NODES_BEFORE, edges: EDGES_BEFORE }) }
  mockSingle.mockImplementation(async (id: string) =>
    mockRowsById[id] ? { data: mockRowsById[id], error: null } : { data: null, error: { code: 'PGRST116' } },
  )
  mockRpc.mockResolvedValue({ data: {}, error: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('B2 — a confirmed CEE edit is durable through UI, autosave, DB and reload', () => {
  it('mixed edit (update Spend 100→250 + add Risk) survives all four stations', async () => {
    vi.useFakeTimers()
    const { result, unmount } = renderHook(() => useScenario())

    // Cold-load the pre-edit scenario.
    await act(async () => {
      await result.current.loadScenario(SCENARIO_ID)
    })
    expect(spendValueOf(useCanvasStore.getState().nodes)).toBe(100)

    // --- The turn: CEE's authoritative receipt is ingested -----------------
    await act(async () => {
      reconcileAppliedGraph(RECEIPT as never)
    })

    // STATION 1 — IMMEDIATE UI. The user sees 250 without a reload, and Risk
    // is on the canvas. (Additive merge: Risk yes, 250 no.)
    expect(spendValueOf(useCanvasStore.getState().nodes)).toBe(250)
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toContain('risk-1')

    // The user's layout for the pre-existing node is untouched — CEE cannot
    // return positions, so a wholesale replace would have reset this to 0,0.
    const spendNode = useCanvasStore.getState().nodes.find((n) => n.id === 'factor-1') as any
    expect(spendNode.position).toEqual({ x: 40, y: 200 })

    // STATION 2 — PAST THE DEBOUNCE. This is the write that used to carry
    // the stale 100 back over CEE's 250.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
    const written = persistedGraph()
    expect(written).not.toBeNull()

    // STATION 3 — THE DATABASE. The persisted graph holds 250, not 100.
    expect(spendValueOf(written!.nodes)).toBe(250)
    expect((written!.nodes as Array<{ id: string }>).map((n) => n.id)).toContain('risk-1')
    // And the layout the DB would otherwise have lost is in the payload —
    // CEE's own commit overwrites `nodes` with position-free GraphV3, so this
    // write is what restores it. (This is why the echo save is NOT suppressed.)
    expect(
      (written!.nodes as Array<Record<string, any>>).find((n) => n.id === 'factor-1')!.position,
    ).toEqual({ x: 40, y: 200 })

    unmount()

    // STATION 4 — RELOAD. Feed back exactly the persisted bytes into a fresh
    // load and confirm the user still sees 250.
    vi.useRealTimers()
    useCanvasStore.setState({ nodes: [], edges: [] } as never)
    mockRowsById[SCENARIO_ID] = scenarioRow(written)

    const reloaded = renderHook(() => useScenario())
    await act(async () => {
      await reloaded.result.current.loadScenario(SCENARIO_ID)
    })

    expect(spendValueOf(useCanvasStore.getState().nodes)).toBe(250)
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toContain('risk-1')
  })

  it('a receipt that only DELETES an element is durable too', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useScenario())

    await act(async () => {
      await result.current.loadScenario(SCENARIO_ID)
    })
    // Hydration seeds the acknowledgement set from the DB — which IS CEE's
    // view — so the very first receipt after a cold load can delete.
    expect(useCanvasStore.getState().lastAuthoritativeGraph).not.toBeNull()

    await act(async () => {
      reconcileAppliedGraph({
        nodes: [{ id: 'goal-1', kind: 'goal', label: 'Revenue' }],
        edges: [],
      } as never)
    })

    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(['goal-1'])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })

    const written = persistedGraph()
    expect(written).not.toBeNull()
    expect((written!.nodes as Array<{ id: string }>).map((n) => n.id)).toEqual(['goal-1'])
    expect(written!.edges).toHaveLength(0)
  })
})

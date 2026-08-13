/**
 * P0 (2026-08-13) — the client must never write RAW REACT FLOW bytes into
 * `scenarios.graph`.
 *
 * THE DEFECT THIS PINS, in one sentence: `scenarios.graph` has two writers with
 * two incompatible shapes. CEE writes `GraphV3`; this client wrote the raw React
 * Flow canvas store through `persistGraphNow` → `saveGraphViaGatedPath` →
 * `apply_patch_and_log`, with **no projector anywhere on the path**. When the
 * browser's autosave landed it REPLACED CEE's graph, and CEE's next analyse read
 * ran `GraphV3.safeParse` over React Flow bytes, threw, and the turn came back
 * **HTTP 500 `scenario_read_failed`**. Measured on the real persisted bytes of
 * scenario `197062e4…`: **116 issues, every one `invalid_type`, and — the load-
 * bearing number — ZERO numeric-range issues**, so CEE's graceful
 * `analysis_not_ready` carve-out (which fires only on `too_small`/`too_big` on a
 * `number`) could not catch it. See `DIAGNOSIS.md` §2, §4.
 *
 * It began on 12 August only because `apply_patch_and_log` is
 * `WHERE user_id = auth.uid()`: for the guest population the write always threw
 * and never landed (`graph_saved`: 0 events every day 20 Jul – 11 Aug, 13 on
 * 12 Aug). The auth flip did not break the read — it switched on a writer that
 * had never run.
 *
 * ── WHY THIS FILE IS SHAPED THE WAY IT IS ──────────────────────────────────
 *
 * 1. **The oracle is derived from the CONSUMER's contract, not from the
 *    symptom** (trap 13c/13d). `isCeeReadableGraph` below asserts the fields
 *    CEE's `src/schemas/cee-v3.ts` REQUIRES — `NodeV3` (:117) `id`/`kind`/
 *    `label`; `EdgeV3` (:218) `from`/`to`/`strength`/`exists_probability`/
 *    `effect_direction`. It does NOT check for the presence of `position` or
 *    `source`/`target`, which is what a rule written from the failure mode
 *    would have done and which would go blind the moment the shape drifted.
 *
 * 2. **It has a CONTRAST CONTROL** (trap 13e). An oracle that rejected
 *    everything would make every assertion below pass while proving nothing, so
 *    one test asserts the two arms discriminate: the deployed UI's real shape
 *    FAILS and a CEE-shaped graph PASSES, in the same run.
 *
 * 3. **The mocked RPC APPLIES the write to the served row**, exactly as the real
 *    `apply_patch_and_log` does (`UPDATE scenarios SET graph = p_graph …`).
 *    Without that, the "cold re-read still parses" assertion would pass at
 *    pristine too — the harness would simply never corrupt anything — and would
 *    be a guard agreeing with itself (trap 13b). The applying behaviour is
 *    itself pinned by a positive control so it cannot silently stop.
 *
 * 4. **Assertions bind by IDENTITY** (trap 19): the surviving row is checked for
 *    CEE's own node ids and required fields, never for "a node with 2 entries"
 *    or "no error was thrown".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ⚠ MUST stay above the imports of the code under test — the `vi.mock`
// factories close over this harness. See the harness header.
import {
  supabaseMockModule,
  authMockModule,
  routerMockModule,
  resetScenarioHarness,
  setScenarioRow,
  scenarioRow,
  mockRpc,
  mockSingle,
  lastWrittenGraph,
} from '../../test/helpers/useScenarioSupabaseHarness'

vi.mock('../../lib/supabase', () => supabaseMockModule())
vi.mock('react-router-dom', () => routerMockModule())
vi.mock('../../contexts/AuthContext', () => authMockModule())

import { useScenario, flushPendingGraphSave } from '../useScenario'
// The REAL policy module — deliberately NOT mocked here. This is the one file
// that asserts what it actually answers; the mechanism specs lift it.
import { clientCanWriteReadableGraph } from '../clientGraphWritePolicy'
import { useCanvasStore } from '../../canvas/store'

// ---------------------------------------------------------------------------
// The oracle — CEE's REQUIRED fields, read at `cee-v3.ts` (`e655cbe2`)
// ---------------------------------------------------------------------------

interface ReadResult {
  readonly readable: boolean
  /** Count of missing REQUIRED fields, mirroring CEE's own issue count. */
  readonly missingRequired: number
}

function isCeeReadableGraph(graph: unknown): ReadResult {
  if (graph == null || typeof graph !== 'object') return { readable: false, missingRequired: -1 }
  const g = graph as { nodes?: unknown; edges?: unknown }
  if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) {
    return { readable: false, missingRequired: -1 }
  }
  let missing = 0
  // NodeV3 (cee-v3.ts:117): id, kind, label are REQUIRED. Everything else is
  // `.optional()`. GraphV3 is a plain `z.object`, so EXTRA keys (`position`,
  // `data`, `type`, `measured`) are legal — absence of a required field is the
  // only thing that fails, which is why all 116 real issues were `invalid_type`.
  for (const n of g.nodes as Array<Record<string, unknown>>) {
    for (const f of ['id', 'kind', 'label'] as const) {
      if (typeof n?.[f] !== 'string') missing++
    }
  }
  // EdgeV3 (cee-v3.ts:218): from, to, strength, exists_probability,
  // effect_direction are REQUIRED.
  for (const e of g.edges as Array<Record<string, unknown>>) {
    if (typeof e?.from !== 'string') missing++
    if (typeof e?.to !== 'string') missing++
    if (e?.strength == null || typeof e.strength !== 'object') missing++
    if (typeof e?.exists_probability !== 'number') missing++
    if (e?.effect_direction !== 'positive' && e?.effect_direction !== 'negative') missing++
  }
  return { readable: missing === 0, missingRequired: missing }
}

// ---------------------------------------------------------------------------
// Fixtures — both shapes, taken from the key manifests of the REAL rows
// (`DIAGNOSIS.md` §1). Not invented: the UI arm is the deployed writer's
// manifest `{data,id,measured,position,type}` / `{data,id,source,target,type}`;
// the CEE arm is `{id,kind,label,…}` / `{from,to,strength,…}`.
// ---------------------------------------------------------------------------

const SCENARIO_ID = 'p0-scenario'

/** What CEE wrote, and what its analyse read expects to find again. */
const CEE_GRAPH = {
  nodes: [
    { id: 'goal_revenue', kind: 'goal', label: 'Revenue', category: undefined },
    { id: 'fac_spend', kind: 'factor', label: 'Marketing spend' },
  ],
  edges: [
    {
      from: 'fac_spend',
      to: 'goal_revenue',
      strength: { mean: 0.4, std: 0.1 },
      exists_probability: 0.8,
      effect_direction: 'positive',
    },
  ],
} as const

/** What the deployed browser store holds — raw React Flow, no projector. */
const REACT_FLOW_NODES = [
  {
    id: 'goal_revenue',
    type: 'goal',
    position: { x: 0, y: 0 },
    measured: { width: 200, height: 80 },
    data: { kind: 'goal', label: 'Revenue' },
  },
  {
    id: 'fac_spend',
    type: 'factor',
    position: { x: 0, y: 160 },
    measured: { width: 200, height: 80 },
    data: { kind: 'factor', label: 'Marketing spend' },
  },
]
const REACT_FLOW_EDGES = [
  {
    id: 'e1',
    source: 'fac_spend',
    target: 'goal_revenue',
    type: 'influence',
    data: { beliefStrength: 0.4, exists_probability: 0.8, direction: 'positive' },
  },
]

/**
 * A DISTINCT React Flow edit, per test.
 *
 * ⚠ NOT cosmetic. `sharedLastSavedGraphKey` is MODULE-LEVEL in `useScenario`
 * and survives between tests in a file, so re-using one payload made three of
 * these tests pass at pristine for the wrong reason: the subscription saw the
 * key it had already persisted, decided the graph was clean, and scheduled no
 * write at all. A test that passes before the fix is not a test (trap 4/11), and
 * the tell was that mutant M1 could not RED them. Each test therefore drags its
 * nodes to its own coordinates, which is also exactly the user gesture this
 * defect rides in on.
 */
function reactFlowEdit(tag: number): { nodes: unknown[]; edges: unknown[] } {
  return {
    nodes: REACT_FLOW_NODES.map((n) => ({
      ...n,
      position: { x: n.position.x + tag * 17, y: n.position.y + tag * 23 },
    })),
    edges: REACT_FLOW_EDGES,
  }
}

/** The bytes the harness will serve on a read, mutated by the applying RPC. */
let servedGraph: unknown = CEE_GRAPH

function seedCeeRow(): void {
  servedGraph = JSON.parse(JSON.stringify(CEE_GRAPH))
  setScenarioRow(SCENARIO_ID, scenarioRow(SCENARIO_ID, servedGraph))
}

/** A cold re-read of the column, as CEE's analyse turn performs it. */
function coldReadGraph(): unknown {
  return servedGraph
}

/**
 * Mount the hook with an active scenario, WITHOUT going through
 * `loadScenario`.
 *
 * ⚠ NOT a convenience — `loadScenario` cannot hydrate a CEE-written row at all.
 * It feeds the persisted column straight into the React Flow store
 * (`useScenario.ts:605-619`, comment verbatim: *"The graph JSONB column stores
 * `{ nodes: Node[], edges: Edge[] }`"*), and `store.reseedIds` →
 * `getMaxNumericId` then does `id.replace(...)` over every EDGE id — which
 * `GraphV3` edges do not have (they are keyed `from`/`to`; see the real CEE row
 * manifest in `DIAGNOSIS.md` §1). It throws `TypeError: Cannot read properties
 * of undefined (reading 'replace')` at `store.ts:1490`. That is the same root
 * cause as `DIAGNOSIS.md` §9b, reached down a second route, and it is NOT this
 * lane's to fix.
 *
 * Giving the CEE fixture invented edge ids would make the load work and make the
 * fixture a lie about the wire (trap 16-inverse: a fixture you wrote yourself is
 * not evidence about the wire). So the scenario id is set on the store directly
 * and the fixture stays faithful to the bytes CEE actually writes.
 */
function mountWithActiveScenario() {
  const rendered = renderHook(() => useScenario())
  act(() => {
    useCanvasStore.setState({ currentScenarioId: SCENARIO_ID } as never)
  })
  return rendered
}

beforeEach(() => {
  vi.clearAllMocks()
  resetScenarioHarness()

  // ⚠ THE RPC APPLIES THE WRITE. The real `apply_patch_and_log` body is
  // `UPDATE scenarios SET graph = p_graph WHERE id = … AND user_id = auth.uid()`.
  // A mock that only RECORDS the call cannot corrupt the row, so "the row still
  // parses" would hold at pristine for the wrong reason.
  mockRpc.mockImplementation(async (name: string, params: Record<string, unknown>) => {
    if (name === 'apply_patch_and_log') {
      servedGraph = params.p_graph
      setScenarioRow(SCENARIO_ID, scenarioRow(SCENARIO_ID, servedGraph))
    }
    return { data: {}, error: null }
  })

  seedCeeRow()
  useCanvasStore.getState().setGoalConstraints(null)
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// 0. Instrument controls — before any claim rests on them
// ---------------------------------------------------------------------------

describe('P0 instrument controls', () => {
  it('the oracle DISCRIMINATES: the deployed UI shape fails, CEE shape passes (contrast control)', () => {
    const ui = isCeeReadableGraph({ nodes: REACT_FLOW_NODES, edges: REACT_FLOW_EDGES })
    const cee = isCeeReadableGraph(CEE_GRAPH)

    expect(ui.readable).toBe(false)
    // 2 nodes × 2 missing (`kind`, `label` live inside `data`, which is not a
    // declared key) + 1 edge × 5 missing = 9. The real row's arithmetic was
    // 13×2 + 18×5 = 116 (`DIAGNOSIS.md` §4) — same mechanism, same per-element
    // multipliers.
    expect(ui.missingRequired).toBe(9)

    // The contrast arm. An oracle that rejected everything would satisfy every
    // other assertion in this file while proving nothing.
    expect(cee.readable).toBe(true)
    expect(cee.missingRequired).toBe(0)
  })

  it('the mocked RPC really does OVERWRITE the served row (positive control)', async () => {
    // Pins this file's own precondition. If the applying behaviour is ever
    // reduced to a recording spy, the cold-read assertions below become
    // tautologies — so it is asserted directly, not assumed.
    expect(isCeeReadableGraph(coldReadGraph()).readable).toBe(true)
    await mockRpc('apply_patch_and_log', {
      p_scenario_id: SCENARIO_ID,
      p_graph: { nodes: REACT_FLOW_NODES, edges: REACT_FLOW_EDGES },
    })
    expect(isCeeReadableGraph(coldReadGraph()).readable).toBe(false)
    expect(mockSingle).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 1. The P0 itself
// ---------------------------------------------------------------------------

describe('P0 — a canvas edit must not corrupt CEE-written scenarios.graph', () => {
  it('the debounced autosave writes NOTHING into scenarios.graph', async () => {
    vi.useFakeTimers()
    const { result: _result } = mountWithActiveScenario()
    void _result

    // Precondition, pinned in-test: the row we are protecting really is
    // CEE-readable before the edit. Without this the assertion after the edit
    // could pass against a row that was never good.
    expect(isCeeReadableGraph(coldReadGraph()).readable).toBe(true)

    // The user drags a node and adds one — the raw React Flow store changes.
    await act(async () => {
      useCanvasStore.setState(reactFlowEdit(1) as never)
      await vi.advanceTimersByTimeAsync(1600) // past GRAPH_DEBOUNCE_MS
    })

    const gated = mockRpc.mock.calls.filter((c) => c[0] === 'apply_patch_and_log')
    expect(gated).toHaveLength(0)
    expect(lastWrittenGraph()).toBeNull()

    // …and the row a CEE analyse turn will read is still CEE's, by IDENTITY.
    const after = coldReadGraph() as { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> }
    expect(isCeeReadableGraph(after).readable).toBe(true)
    expect(after.nodes.map((n) => n.id)).toEqual(['goal_revenue', 'fac_spend'])
    expect(after.nodes[1].kind).toBe('factor')
    expect(after.nodes[1].label).toBe('Marketing spend')
    expect(after.edges[0].from).toBe('fac_spend')
    expect(after.edges[0].exists_probability).toBe(0.8)
  })

  it('the pre-run flush barrier — the guaranteed overwrite — writes NOTHING', async () => {
    // `OutputsDock.tsx:963` awaits `flushPendingSaves()` IMMEDIATELY before
    // dispatching a run, so in production this path was not a race: it was a
    // guaranteed overwrite microseconds before every analyse turn. Six attempts,
    // six 500s (`DIAGNOSIS.md` §5).
    mountWithActiveScenario()
    expect(isCeeReadableGraph(coldReadGraph()).readable).toBe(true)

    await act(async () => {
      useCanvasStore.setState(reactFlowEdit(2) as never)
      await flushPendingGraphSave(true)
    })

    expect(mockRpc.mock.calls.filter((c) => c[0] === 'apply_patch_and_log')).toHaveLength(0)
    expect(isCeeReadableGraph(coldReadGraph()).readable).toBe(true)
  })

  it('the unmount flush — the path that bypassed the guard once already — writes NOTHING', async () => {
    vi.useFakeTimers()
    const { unmount } = mountWithActiveScenario()

    // Schedule a debounced save, then navigate away before it fires.
    await act(async () => {
      useCanvasStore.setState(reactFlowEdit(3) as never)
      await vi.advanceTimersByTimeAsync(100) // < GRAPH_DEBOUNCE_MS: still pending
    })
    await act(async () => {
      unmount()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(mockRpc.mock.calls.filter((c) => c[0] === 'apply_patch_and_log')).toHaveLength(0)
    expect(isCeeReadableGraph(coldReadGraph()).readable).toBe(true)
  })

  it('the retry-after-failure path writes NOTHING (no write, so nothing to retry)', async () => {
    vi.useFakeTimers()
    mountWithActiveScenario()

    // Arm the RPC to fail, which at pristine produced TWO gated calls: the
    // initial write and the 3 s retry. Both are React Flow bytes.
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    await act(async () => {
      useCanvasStore.setState(reactFlowEdit(4) as never)
      await vi.advanceTimersByTimeAsync(1600)
      await vi.advanceTimersByTimeAsync(3500) // past RETRY_DELAY_MS
    })

    expect(mockRpc.mock.calls.filter((c) => c[0] === 'apply_patch_and_log')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 2. The suppression is honest, and the indicator does not lie
// ---------------------------------------------------------------------------

describe('P0 — the suppression is stated, and the save indicator stays honest', () => {
  it('the client declares it cannot produce CEE-readable bytes', () => {
    // Bound to the exported predicate rather than to a source grep: a comment
    // cannot satisfy this, and a mutation that re-opens the write REDs it.
    expect(clientCanWriteReadableGraph()).toBe(false)
  })

  it('the top bar never enters "Saving…" for a write that structurally cannot happen', async () => {
    // `persistGraphNow` returns false when suppressed and its caller then
    // correctly refuses to claim "saved" (R2-N1). Left ungated, a signed-in
    // user's TopBar (`TopBar.tsx:84-93`) would show "Saving…" for ever after
    // every canvas edit — a permanent false-progress indicator that did not
    // exist before 12 Aug, when everyone was a guest and the subscription never
    // ran at all.
    vi.useFakeTimers()

    // ⚠ HOLD THE WRITE OPEN. Reading the FINAL status passes at pristine for the
    // wrong reason: there the write succeeds inside the same `act`, so the
    // indicator has already moved on to 'saved' and the 'saving' it passed
    // through is invisible. Gating the RPC makes the in-flight moment
    // observable, which is the only moment the claim is about.
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = () => r()
    })
    mockRpc.mockImplementation(async (name: string, params: Record<string, unknown>) => {
      if (name === 'apply_patch_and_log') {
        await gate
        servedGraph = params.p_graph
      }
      return { data: {}, error: null }
    })

    const rendered = mountWithActiveScenario()
    expect(rendered.result.current.saveStatus).toBe('saved')

    await act(async () => {
      useCanvasStore.setState(reactFlowEdit(5) as never)
      await vi.advanceTimersByTimeAsync(1600)
    })

    // THE ASSERTION, at the in-flight moment. Coherent in both worlds: the
    // indicator announces progress only for a write actually being attempted.
    // At pristine a write IS in flight here and this reads 'saving' → RED. With
    // the fix nothing is attempted, so there is nothing to announce.
    expect(rendered.result.current.saveStatus).toBe('saved')
    expect(rendered.result.current.saveError).toBeNull()

    release()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  })
})

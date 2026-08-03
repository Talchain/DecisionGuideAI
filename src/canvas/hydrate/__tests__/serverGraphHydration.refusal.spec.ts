/**
 * L61 ITEM 2 (hydration half) — RED-first. A REFUSED MERGE MUST NOT RECORD THE
 * SERVER'S IDENTITY TOKEN, AND MUST NOT BE REPORTED AS `'merged'`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT
 * ─────────────────────────────────────────────────────────────────────────────
 * `hydrateCanvasFromServer` discarded the merge's return value, stored CEE's
 * identity token unconditionally, and returned `'merged'` unconditionally — even
 * when `mergeServerGraphOnHydrate` had REFUSED the graph outright (zero node-id
 * overlap, an empty server graph, an unusable shape).
 *
 * Two consequences, and they are not equally severe — say so rather than
 * flattening them:
 *
 *   1. UNCONDITIONAL, AND PROVEN HERE: the outcome is FALSE. This module exists
 *      so that "every boot outcome — including the refusals — is measurable
 *      without mounting React" (its own docstring). A refusal reported as
 *      `'merged'` breaks exactly that contract, and the hook logs the false
 *      value as telemetry.
 *
 *   2. THE STORED TOKEN IS A CLAIM THAT WE APPLIED THIS GRAPH, and it HAS A
 *      READER — the `isSameServerGraph` short-circuit at the top of this very
 *      function, which returns `'unchanged'` without merging. So a refusal
 *      recorded as an application makes the NEXT read skip a merge that might by
 *      then succeed (the guard that refused depends on the CANVAS, which moves;
 *      the token compares only the SERVER, which has not). This is the opposite
 *      of a write-only column with no readers: the blast radius is not zero.
 *
 * ⚠ HONEST NARROWING. `serverGraphIdentity` is in-memory only and is cleared by
 * `DECISION_CONTEXT_CLEAR`, and `useServerGraphHydration` attempts once per
 * scenario id — so today the second read is narrowly reachable. The defect being
 * fixed is the broken INVARIANT and the false outcome, not a demonstrated
 * currently-firing wrong number. §2 pins the mechanism at this function's own
 * seam so the guarantee holds however the hook is later wired.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
const CEE_TOKEN = 'c'.repeat(63) + '1'

function envelope(value = CEE_TOKEN, projection = 'identity.v1') {
  return {
    kind: 'graph_identity_hash',
    value,
    algorithm: 'sha256',
    projection_version: projection,
    graph_schema_version: 'graph_v3',
    normaliser_version: '1',
  }
}

function body(graph: unknown) {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: SCENARIO_ID,
    graph,
    graph_present: true,
    brief_text: null,
    graph_identity_hash: envelope(),
    layout_present: false,
    request_id: 'req-l61',
  }
}

function jsonResponse(status: number, b: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => b } as unknown as Response
}

/** A server graph sharing NO node id with the canvas — the structural guard's case. */
const UNRELATED_GRAPH = {
  nodes: [
    { id: 'unrelated-a', kind: 'factor', label: 'Other' },
    { id: 'unrelated-b', kind: 'goal', label: 'Elsewhere' },
  ],
  edges: [],
}

/** A server graph that DOES overlap — the acceptance control. */
const OVERLAPPING_GRAPH = {
  nodes: [{ id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 }],
  edges: [],
}

function seedCanvas(nodes: unknown[]): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: nodes as never,
    edges: [] as never,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    history: { past: [], future: [] },
  } as never)
}

function populatedCanvas() {
  return [
    { id: 'factor-1', type: 'factor', position: { x: 10, y: 20 }, data: { label: 'Spend', kind: 'factor', value: 100 } },
    { id: 'goal-1', type: 'goal', position: { x: 300, y: 400 }, data: { label: 'Profit', kind: 'goal', value: 5 } },
  ]
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  seedCanvas(populatedCanvas())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/* ══════════════════════════════════════════════════════════════════════════
 * §1 A REFUSAL IS NOT A MERGE
 * ══════════════════════════════════════════════════════════════════════════ */

describe('§1 a refused merge reports itself and records nothing', () => {
  it('ZERO OVERLAP — the outcome is a refusal, never `merged`', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, body(UNRELATED_GRAPH)))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('mergeRefused')
  })

  it('ZERO OVERLAP — the identity token is NOT recorded', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, body(UNRELATED_GRAPH)))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().serverGraphIdentity).toBeNull()
  })

  it('ZERO OVERLAP — the canvas is untouched, bound by node identity', async () => {
    const before = useCanvasStore.getState().nodes
    fetchSpy.mockResolvedValue(jsonResponse(200, body(UNRELATED_GRAPH)))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().nodes).toBe(before)
    const factor = useCanvasStore.getState().nodes.find((n: any) => n.id === 'factor-1') as any
    expect(factor.data.value).toBe(100)
  })

  it('an EMPTY server graph is a refusal and records no token', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, body({ nodes: [], edges: [] })))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('mergeRefused')
    expect(useCanvasStore.getState().serverGraphIdentity).toBeNull()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * §2 THE MECHANISM — a refusal must not suppress the NEXT read
 * ══════════════════════════════════════════════════════════════════════════ */

describe('§2 a refusal leaves the next read free to re-attempt', () => {
  it('⭐ THE LOAD-BEARING PIN — refuse, then a canvas that CAN merge does merge', async () => {
    // Read 1: the restored canvas shares no id with the server row, so the
    // structural guard refuses. The server has NOT moved, so its token is
    // identical on read 2 — the only thing that changed is the CANVAS, which the
    // token knows nothing about. Recording the token on the refusal made read 2
    // return `unchanged` and the server's real graph never landed.
    fetchSpy.mockResolvedValue(jsonResponse(200, body(UNRELATED_GRAPH)))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('mergeRefused')

    // ⚠ MOVE ONLY THE CANVAS. `seedCanvas` would also null `serverGraphIdentity`
    // and that is precisely the state the defect depends on NOT being reset — a
    // helper that clears the token would make this pin vacuous by construction
    // (it would pass with the defect fully present). So the nodes are replaced
    // directly and whatever read 1 recorded is left exactly where it put it.
    useCanvasStore.setState({
      nodes: [
        { id: 'unrelated-a', type: 'factor', position: { x: 5, y: 5 }, data: { label: 'Stale', kind: 'factor' } },
      ] as never,
    } as never)

    fetchSpy.mockResolvedValue(jsonResponse(200, body(UNRELATED_GRAPH)))
    const outcome = await hydrateCanvasFromServer(SCENARIO_ID)
    expect(outcome, 'the same server graph now overlaps and must merge').toBe('merged')
    const merged = useCanvasStore.getState().nodes.find((n: any) => n.id === 'unrelated-b')
    expect(merged, 'the server node the first read refused must now be on the canvas').toBeTruthy()
  })

  it('IDENTITY-BOUND — the token stored after read 1 does not classify read 2 as unchanged', async () => {
    // Same idea, stated against the token directly: after a refusal there is no
    // stored token, so `isSameServerGraph` cannot short-circuit read 2.
    fetchSpy.mockResolvedValue(jsonResponse(200, body(UNRELATED_GRAPH)))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().serverGraphIdentity).toBeNull()

    fetchSpy.mockResolvedValue(jsonResponse(200, body(UNRELATED_GRAPH)))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).not.toBe('unchanged')
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * §3 THE ACCEPTANCE PATH IS UNCHANGED
 * ══════════════════════════════════════════════════════════════════════════ */

describe('§3 acceptance behaves exactly as before', () => {
  it('an overlapping graph merges, records the token and returns `merged`', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, body(OVERLAPPING_GRAPH)))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(useCanvasStore.getState().serverGraphIdentity).toEqual({
      value: CEE_TOKEN,
      projectionVersion: 'identity.v1',
    })
    const factor = useCanvasStore.getState().nodes.find((n: any) => n.id === 'factor-1') as any
    expect(factor.data.value).toBe(250)
  })

  it('AN IDEMPOTENT ACCEPTED MERGE STILL RECORDS THE TOKEN', async () => {
    // ⭐ The anti-overcorrection pin. Gating the token on `changed` instead of on
    // `accepted` would ALSO make §1 green while breaking the common boot — the
    // one where the server matches the canvas — into a permanent re-merge. The
    // gate is ACCEPTANCE, not movement.
    seedCanvas([
      { id: 'factor-1', type: 'factor', position: { x: 10, y: 20 }, data: { label: 'Spend', kind: 'factor', value: 250 } },
    ])
    fetchSpy.mockResolvedValue(jsonResponse(200, body(OVERLAPPING_GRAPH)))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(useCanvasStore.getState().serverGraphIdentity?.value).toBe(CEE_TOKEN)
  })

  it('an accepted merge still short-circuits the NEXT identical read', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, body(OVERLAPPING_GRAPH)))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('unchanged')
  })
})

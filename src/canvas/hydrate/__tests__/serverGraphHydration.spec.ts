/**
 * hydrateCanvasFromServer — RED-first spec (ROADMAP 2.312 piece 3).
 *
 * The boot orchestration: read the server's graph for the scenario in hand and
 * merge its VALUES onto the local canvas, keeping the local LAYOUT. Every
 * non-200 answer leaves the canvas exactly as it was — a refusal is never a
 * deletion and a blip is never an empty canvas.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
const CEE_TOKEN = 'a'.repeat(63) + '7'
const CEE_TOKEN_2 = 'b'.repeat(63) + '4'

const A_POS = { x: 10, y: 20 }
const B_POS = { x: 300, y: 400 }

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

function okBody(over: Record<string, unknown> = {}) {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: SCENARIO_ID,
    graph: {
      nodes: [
        { id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 },
        { id: 'goal-1', kind: 'goal', label: 'Profit', value: 9 },
      ],
      edges: [],
    },
    graph_present: true,
    brief_text: null,
    graph_identity_hash: envelope(),
    layout_present: false,
    request_id: 'req-1',
    ...over,
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

function seedCanvas(): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      {
        id: 'factor-1',
        type: 'factor',
        position: { ...A_POS },
        data: { label: 'Spend', kind: 'factor', value: 100 },
      },
      {
        id: 'goal-1',
        type: 'goal',
        position: { ...B_POS },
        data: { label: 'Profit', kind: 'goal', value: 5 },
      },
    ] as never,
    edges: [] as never,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    history: { past: [], future: [] },
  } as never)
}

function nodeById(id: string): any {
  return useCanvasStore.getState().nodes.find((n: any) => n.id === id)
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  seedCanvas()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('hydrateCanvasFromServer — boot WITH a server graph', () => {
  it('hydrates the server’s values and keeps the LOCAL positions', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    const outcome = await hydrateCanvasFromServer(SCENARIO_ID)
    expect(outcome).toBe('merged')
    expect(nodeById('factor-1').data.value).toBe(250)
    expect(nodeById('goal-1').data.value).toBe(9)
    expect(nodeById('factor-1').position).toEqual(A_POS)
    expect(nodeById('goal-1').position).toEqual(B_POS)
  })

  it('stores CEE’s identity token VERBATIM, envelope fields intact', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().serverGraphIdentity).toEqual({
      value: CEE_TOKEN,
      projectionVersion: 'identity.v1',
    })
  })

  it('MUTANT GUARD — the stored token is CEE’s, never locally recomputed', async () => {
    // The fixture token is a fixed 64-hex string with no relationship to the
    // graph bytes. Any local re-derivation (a hash of the graph, a digest of
    // the JSON, a checksum) produces a different value and fails here.
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().serverGraphIdentity?.value).toBe(CEE_TOKEN)
  })
})

describe('hydrateCanvasFromServer — CEE-to-CEE token comparison only', () => {
  it('skips the merge when CEE returns the SAME token at the SAME projection', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')

    // Local edit after the first hydrate; a second identical read must not
    // silently roll it back — the token says the server has not moved.
    useCanvasStore.setState({
      nodes: useCanvasStore
        .getState()
        .nodes.map((n: any) =>
          n.id === 'factor-1' ? { ...n, data: { ...n.data, value: 777 } } : n,
        ) as never,
    })

    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('unchanged')
    expect(nodeById('factor-1').data.value).toBe(777)
  })

  it('re-merges when CEE issues a DIFFERENT token', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    await hydrateCanvasFromServer(SCENARIO_ID)

    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({
          graph_identity_hash: envelope(CEE_TOKEN_2),
          graph: {
            nodes: [{ id: 'factor-1', kind: 'factor', label: 'Spend', value: 42 }],
            edges: [],
          },
        }),
      ),
    )
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(nodeById('factor-1').data.value).toBe(42)
  })

  it('NEVER compares across projection_version — a version change always re-merges', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    await hydrateCanvasFromServer(SCENARIO_ID)

    // Same token VALUE, different projection. The values are not comparable
    // across projections, so equality here must not be trusted.
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({
          graph_identity_hash: envelope(CEE_TOKEN, 'identity.v2'),
          graph: {
            nodes: [{ id: 'factor-1', kind: 'factor', label: 'Spend', value: 42 }],
            edges: [],
          },
        }),
      ),
    )
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(nodeById('factor-1').data.value).toBe(42)
    expect(useCanvasStore.getState().serverGraphIdentity).toEqual({
      value: CEE_TOKEN,
      projectionVersion: 'identity.v2',
    })
  })

  it('a null token never suppresses a merge', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ graph_identity_hash: null })),
    )
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(useCanvasStore.getState().serverGraphIdentity).toBeNull()
  })
})

describe('hydrateCanvasFromServer — refusals never touch the canvas', () => {
  it('404 leaves the canvas EXACTLY as it was — never a deletion', async () => {
    const before = useCanvasStore.getState().nodes
    fetchSpy.mockResolvedValue(jsonResponse(404, { error: 'NOT_FOUND' }))
    expect(await hydrateCanvasFromServer(SCENARIO_ID, { retryDelayMs: 0 })).toBe(
      'notReadable',
    )
    expect(useCanvasStore.getState().nodes).toBe(before)
    expect(useCanvasStore.getState().nodes).toHaveLength(2)
    expect(nodeById('factor-1').data.value).toBe(100)
    expect(useCanvasStore.getState().lastAuthoritativeGraph).toBeNull()
  })

  it('200 + graph_present:false leaves the canvas untouched (honest absence)', async () => {
    const before = useCanvasStore.getState().nodes
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({ graph: null, graph_present: false, graph_identity_hash: null }),
      ),
    )
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('absent')
    expect(useCanvasStore.getState().nodes).toBe(before)
  })

  it('a persistent 503 RETRIES and then leaves the canvas untouched', async () => {
    const before = useCanvasStore.getState().nodes
    fetchSpy.mockResolvedValue(jsonResponse(503, { error: 'INTERNAL' }))
    expect(await hydrateCanvasFromServer(SCENARIO_ID, { retryDelayMs: 0 })).toBe(
      'unavailable',
    )
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(useCanvasStore.getState().nodes).toBe(before)
  })

  it('a 503 that clears on retry DOES hydrate', async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(503, { error: 'INTERNAL' }))
      .mockResolvedValueOnce(jsonResponse(200, okBody()))
    expect(await hydrateCanvasFromServer(SCENARIO_ID, { retryDelayMs: 0 })).toBe(
      'merged',
    )
    expect(nodeById('factor-1').data.value).toBe(250)
    expect(nodeById('factor-1').position).toEqual(A_POS)
  })

  it('401 leaves the canvas untouched', async () => {
    const before = useCanvasStore.getState().nodes
    fetchSpy.mockResolvedValue(jsonResponse(401, { error: 'UNAUTHENTICATED' }))
    expect(await hydrateCanvasFromServer(SCENARIO_ID, { retryDelayMs: 0 })).toBe(
      'refused',
    )
    expect(useCanvasStore.getState().nodes).toBe(before)
  })
})

describe('hydrateCanvasFromServer — guards', () => {
  it('makes NO request without a scenario id', async () => {
    expect(await hydrateCanvasFromServer(null)).toBe('skipped')
    expect(await hydrateCanvasFromServer('')).toBe('skipped')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('makes NO request for a non-UUID scenario id', async () => {
    expect(await hydrateCanvasFromServer('draft-local-1')).toBe('skipped')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

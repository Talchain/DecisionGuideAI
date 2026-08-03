/**
 * scenarioGraph client — RED-first spec (ROADMAP 2.312 piece 3).
 *
 * Pins the CEE scenario-addressed graph read (`scenario_graph.v1`, PR #804)
 * as the UI consumes it, INCLUDING the four binding consumer notes from that
 * PR's merged body and the base-resolution hazard that would silently point
 * this call at the wrong host.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  SCENARIO_GRAPH_BASE,
  scenarioGraphUrl,
  fetchScenarioGraph,
} from '../scenarioGraph'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'

/** A 64-hex token no local computation in this repo could reproduce. */
const CEE_TOKEN = 'a'.repeat(63) + '7'

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
    graph: { nodes: [{ id: 'n1', kind: 'factor', label: 'N1' }], edges: [] },
    graph_present: true,
    brief_text: 'a brief',
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

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('scenarioGraph — base resolution (⚠ hazard: VITE_CEE_BFF_BASE points at PLoT)', () => {
  it('resolves the SAME-ORIGIN Netlify edge path, never an absolute host', () => {
    expect(SCENARIO_GRAPH_BASE).toBe('/bff/cee')
    expect(scenarioGraphUrl(SCENARIO_ID)).toBe(
      `/bff/cee/scenarios/${SCENARIO_ID}/graph`,
    )
  })

  it('IGNORES VITE_CEE_BFF_BASE — it is dashboard-set to an absolute PLoT URL', async () => {
    // The deployed bundle carries ZERO `/bff/cee` literals and four absolute
    // `https://plot-lite-service-staging.onrender.com/v1/cee` bases, because
    // Vite INLINES this var at build time. Any hydrate call that resolved its
    // base from it would reach PLoT, which does not serve this route.
    //
    // ⚠ THE ENV MUST BE SET BEFORE THE MODULE IS IMPORTED, and the module
    // RE-IMPORTED, or this control is VACUOUS. The defect being guarded is a
    // MODULE-LEVEL `env.VITE_CEE_BFF_BASE || '/bff/cee'` const, which is
    // evaluated once at import time — mutating the env afterwards and calling
    // the already-imported function could never observe it, so the assertion
    // would pass against the very code it exists to forbid. Verified by
    // mutation: with the module const swapped for the env-resolved form, this
    // case goes RED only in this shape.
    const PLOT = 'https://plot-lite-service-staging.onrender.com/v1/cee'
    const prev = (import.meta as any).env.VITE_CEE_BFF_BASE
    try {
      ;(import.meta as any).env.VITE_CEE_BFF_BASE = PLOT
      vi.resetModules()
      const fresh = await import('../scenarioGraph')

      // Positive control: the env var really is visible to a fresh import, so a
      // module that DID read it would see PLoT here.
      expect((import.meta as any).env.VITE_CEE_BFF_BASE).toBe(PLOT)

      expect(fresh.SCENARIO_GRAPH_BASE).toBe('/bff/cee')
      expect(fresh.scenarioGraphUrl(SCENARIO_ID)).toBe(
        `/bff/cee/scenarios/${SCENARIO_ID}/graph`,
      )
      expect(fresh.scenarioGraphUrl(SCENARIO_ID)).not.toContain('plot-lite')
      expect(fresh.scenarioGraphUrl(SCENARIO_ID)).not.toContain('http')
    } finally {
      ;(import.meta as any).env.VITE_CEE_BFF_BASE = prev
      vi.resetModules()
    }
  })

  it('POSTs to the pinned URL with a JSON body', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    await fetchScenarioGraph(SCENARIO_ID)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe(`/bff/cee/scenarios/${SCENARIO_ID}/graph`)
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('sends user_id only when supplied, and never the guest sentinel', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    await fetchScenarioGraph(SCENARIO_ID)
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({})

    fetchSpy.mockClear()
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    await fetchScenarioGraph(SCENARIO_ID, { userId: 'guest' })
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({})

    fetchSpy.mockClear()
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    await fetchScenarioGraph(SCENARIO_ID, { userId: 'u-42' })
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({ user_id: 'u-42' })
  })
})

describe('scenarioGraph — 200 semantics', () => {
  it('returns the graph VERBATIM alongside the identity envelope value', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    const res = await fetchScenarioGraph(SCENARIO_ID)
    expect(res.status).toBe('graph')
    if (res.status !== 'graph') return
    expect(res.graph).toEqual({
      nodes: [{ id: 'n1', kind: 'factor', label: 'N1' }],
      edges: [],
    })
    expect(res.briefText).toBe('a brief')
    expect(res.layoutPresent).toBe(false)
  })

  it('CONSUMER NOTE 1 — reads `.value` off the envelope, never the object', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    const res = await fetchScenarioGraph(SCENARIO_ID)
    if (res.status !== 'graph') throw new Error('expected graph')
    expect(res.identity).toEqual({
      value: CEE_TOKEN,
      projectionVersion: 'identity.v1',
    })
    // The object itself must never end up where the hash is expected.
    expect(typeof res.identity?.value).toBe('string')
    expect(res.identity?.value).not.toContain('graph_identity_hash')
  })

  it('CONSUMER NOTE 2 — stores CEE’s token VERBATIM (no local recomputation)', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    const res = await fetchScenarioGraph(SCENARIO_ID)
    if (res.status !== 'graph') throw new Error('expected graph')
    // Byte-identical to what CEE issued. Any locally-derived value — a hash of
    // the graph, a JSON digest, anything — differs from this fixed token.
    expect(res.identity?.value).toBe(CEE_TOKEN)
  })

  it('refuses a BARE STRING hash — the envelope trap — rather than adopting it', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ graph_identity_hash: CEE_TOKEN })),
    )
    const res = await fetchScenarioGraph(SCENARIO_ID)
    if (res.status !== 'graph') throw new Error('expected graph')
    expect(res.identity).toBeNull()
  })

  it('null identity envelope is carried as null, not fabricated', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ graph_identity_hash: null })),
    )
    const res = await fetchScenarioGraph(SCENARIO_ID)
    if (res.status !== 'graph') throw new Error('expected graph')
    expect(res.identity).toBeNull()
  })

  it('graph_present:false is ABSENT — a normal empty canvas, never an error', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({ graph: null, graph_present: false, graph_identity_hash: null }),
      ),
    )
    const res = await fetchScenarioGraph(SCENARIO_ID)
    expect(res.status).toBe('absent')
  })

  it('graph_present:true with a null graph DISAGREES — fail closed, never a graph', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody({ graph: null })))
    const res = await fetchScenarioGraph(SCENARIO_ID)
    expect(res.status).toBe('unusable')
  })

  it('a wrong schema discriminator is unusable, never adopted', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ schema: 'scenario_graph.v2' })),
    )
    const res = await fetchScenarioGraph(SCENARIO_ID)
    expect(res.status).toBe('unusable')
  })
})

describe('scenarioGraph — refusal semantics', () => {
  it('CONSUMER NOTE 3 — 404 is NOT-READABLE, a distinct status from absent', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(404, { error: 'NOT_FOUND' }))
    const res = await fetchScenarioGraph(SCENARIO_ID)
    expect(res.status).toBe('notReadable')
    // The two must never collapse: `absent` means "no graph yet" (200),
    // `notReadable` means "absent ∪ not-yours ∪ oracle-unresolvable".
    expect(res.status).not.toBe('absent')
  })

  it('401 / 403 / 429 are refusals and are NOT retried', async () => {
    for (const code of [401, 403, 429]) {
      fetchSpy.mockClear()
      fetchSpy.mockResolvedValue(jsonResponse(code, { error: 'x' }))
      const res = await fetchScenarioGraph(SCENARIO_ID, { retryDelayMs: 0 })
      expect(res.status).toBe('refused')
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    }
  })

  it('404 is NOT retried — it is a stable answer, not a blip', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(404, { error: 'NOT_FOUND' }))
    await fetchScenarioGraph(SCENARIO_ID, { retryDelayMs: 0 })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe('scenarioGraph — 503 retry', () => {
  it('CONSUMER NOTE 3 — 503 RETRIES and can succeed on a later attempt', async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(503, { error: 'INTERNAL' }))
      .mockResolvedValueOnce(jsonResponse(200, okBody()))
    const res = await fetchScenarioGraph(SCENARIO_ID, { retryDelayMs: 0 })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(res.status).toBe('graph')
  })

  it('a persistent 503 ends UNAVAILABLE after a bounded number of attempts', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(503, { error: 'INTERNAL' }))
    const res = await fetchScenarioGraph(SCENARIO_ID, { retryDelayMs: 0 })
    expect(res.status).toBe('unavailable')
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    // Never degrades into "no graph" — a DB blip must not read as an empty canvas.
    expect(res.status).not.toBe('absent')
    expect(res.status).not.toBe('notReadable')
  })

  it('a transport rejection is unusable, never absent', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'))
    const res = await fetchScenarioGraph(SCENARIO_ID, { retryDelayMs: 0 })
    expect(res.status).toBe('unusable')
  })
})

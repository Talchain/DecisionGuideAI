/**
 * ROADMAP 2.467 — the registration client.
 *
 * The source-text block at the bottom is not decoration. `VITE_CEE_BFF_BASE` is
 * unset in this tree but IS set in the Netlify dashboard to a PLoT origin, and
 * Vite inlines `import.meta.env` at BUILD time — so the house-style
 * `import.meta.env.VITE_CEE_BFF_BASE || '/bff/cee'` resolves to PLoT in the
 * deployed bundle and this route would 404 in production while every jsdom test
 * stayed green. This estate has shipped an invisible feature that way. The pin
 * reads the module's own bytes, and a second assertion kills the
 * dead-constant mutant (a literal nothing reads is the same defect renamed).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  SCENARIO_GRAPH_REGISTER_BASE,
  registerScenarioGraph,
  scenarioGraphRegisterUrl,
} from '../registerScenarioGraph'

const SCENARIO = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const OWNER = '0f8a1b2c-3d4e-4f50-9a6b-7c8d9e0f1a2b'
const GRAPH = { nodes: [{ id: 'a', kind: 'goal', label: 'A' }], edges: [] }

const ACK = {
  schema: 'scenario_graph_registration.v1',
  scenario_id: SCENARIO,
  registered: true,
  graph_identity_hash: { value: 'a'.repeat(64), projection_version: 'identity.v1' },
  node_count: 1,
  edge_count: 0,
  request_id: 'req-1',
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('registerScenarioGraph — the acknowledgement', () => {
  it('POSITIVE CONTROL: a well-formed ack really is recognised (so every refusal below means something)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, ACK))
    const result = await registerScenarioGraph(SCENARIO, GRAPH)
    expect(result.status).toBe('registered')
    if (result.status !== 'registered') throw new Error('unreachable')
    expect(result.identity).toEqual({ value: 'a'.repeat(64), projectionVersion: 'identity.v1' })
    expect(result.nodeCount).toBe(1)
  })

  it('POSTs the graph to the scenario-addressed register path', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, ACK))
    await registerScenarioGraph(SCENARIO, GRAPH)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`/bff/cee/scenarios/${SCENARIO}/graph/register`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).graph).toEqual(GRAPH)
  })

  it('sends a real user id, and NEVER the guest sentinel (CEE requires a UUID)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, ACK))

    await registerScenarioGraph(SCENARIO, GRAPH, { userId: OWNER })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).user_id).toBe(OWNER)

    fetchMock.mockClear()
    await registerScenarioGraph(SCENARIO, GRAPH, { userId: 'guest' })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('user_id')
  })

  it.each([
    ['a 200 with no discriminator', { registered: true }],
    ['a 200 from a different route', { schema: 'scenario_graph.v1', registered: true }],
    ['a 200 that does not say registered', { schema: 'scenario_graph_registration.v1' }],
  ])('does NOT treat %s as an acknowledgement', async (_label, body) => {
    // An SPA fallback or a proxy interstitial answers 200. Releasing the hold on
    // a body we never recognised would re-open the P0 with extra steps.
    fetchMock.mockResolvedValue(jsonResponse(200, body))
    expect((await registerScenarioGraph(SCENARIO, GRAPH)).status).toBe('unavailable')
  })

  it('does NOT treat an unreadable 200 body as an acknowledgement', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('not json')
      },
    } as unknown as Response)
    expect((await registerScenarioGraph(SCENARIO, GRAPH)).status).toBe('unavailable')
  })
})

describe('registerScenarioGraph — refusals and retries', () => {
  it('retries a 503 and succeeds on a later attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, ACK))
    const result = await registerScenarioGraph(SCENARIO, GRAPH, { retryDelayMs: 0 })
    expect(result.status).toBe('registered')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up after three attempts of 503', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, {}))
    expect((await registerScenarioGraph(SCENARIO, GRAPH, { retryDelayMs: 0 })).status).toBe(
      'unavailable',
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('NEVER retries a 409 — re-sending would be the clobber CEE just refused', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, {}))
    expect((await registerScenarioGraph(SCENARIO, GRAPH, { retryDelayMs: 0 })).status).toBe(
      'conflict',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces a 422 refusal with its code and node ids, and does not retry', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, {
        schema: 'error.v1',
        code: 'BAD_INPUT',
        message: 'Some nodes declare two different kinds. Fix the file and import again.',
        details: { code: 'GRAPH_NODE_KIND_DIVERGENT', node_ids: ['opt_alpha'] },
      }),
    )
    const result = await registerScenarioGraph(SCENARIO, GRAPH, { retryDelayMs: 0 })
    expect(result).toMatchObject({
      status: 'rejected',
      code: 'GRAPH_NODE_KIND_DIVERGENT',
      nodeIds: ['opt_alpha'],
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats a transport failure as unknown, never as success', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    expect((await registerScenarioGraph(SCENARIO, GRAPH)).status).toBe('unavailable')
  })

  it.each([
    [401, 'refused'],
    [403, 'refused'],
    [429, 'refused'],
    [404, 'notRegistrable'],
  ])('maps %i to %s without retrying', async (status, expected) => {
    fetchMock.mockResolvedValue(jsonResponse(status, {}))
    expect((await registerScenarioGraph(SCENARIO, GRAPH, { retryDelayMs: 0 })).status).toBe(
      expected,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('the base is a same-origin LITERAL, pinned at the source text', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/adapters/cee/registerScenarioGraph.ts'),
    'utf8',
  )

  /**
   * Comments STRIPPED before the absence assertions: the module's own header
   * explains why `VITE_CEE_BFF_BASE` is refused, and a naive substring search
   * over the whole file would fire on the explanation rather than on code —
   * a guard that reds on its own documentation teaches the next author to
   * delete the documentation.
   */
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')

  it('POSITIVE CONTROL: the source was read AND the comment strip left real code behind', () => {
    // Trap 13 twice over — a read that returned '' or a strip that ate the
    // whole file would make both assertions below pass by never firing.
    expect(source.length).toBeGreaterThan(1000)
    expect(code).toContain('export async function registerScenarioGraph')
    expect(code).toContain('fetch(url')
    // And the strip really did remove the prose that mentions the env var.
    expect(source).toContain('VITE_CEE_BFF_BASE')
    expect(code).not.toContain('the header')
  })

  it('declares the base as the literal `/bff/cee`, never an env lookup', () => {
    expect(code).toContain("SCENARIO_GRAPH_REGISTER_BASE = '/bff/cee'")
    expect(code).not.toContain('VITE_CEE_BFF_BASE')
    expect(code).not.toContain('import.meta.env')
    expect(SCENARIO_GRAPH_REGISTER_BASE).toBe('/bff/cee')
  })

  it('BUILDS the url from that constant — a literal nothing reads is the same defect renamed', () => {
    const builder = code.slice(code.indexOf('export function scenarioGraphRegisterUrl'))
    const body = builder.slice(0, builder.indexOf('\n}'))
    expect(body).toContain('SCENARIO_GRAPH_REGISTER_BASE')
    expect(scenarioGraphRegisterUrl('abc')).toBe('/bff/cee/scenarios/abc/graph/register')
  })
})

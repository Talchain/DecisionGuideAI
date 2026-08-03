/**
 * scenarioGraph client — RED-first spec (ROADMAP 2.312 piece 3).
 *
 * Pins the CEE scenario-addressed graph read (`scenario_graph.v1`, PR #804)
 * as the UI consumes it, INCLUDING the four binding consumer notes from that
 * PR's merged body and the base-resolution hazard that would silently point
 * this call at the wrong host.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SCENARIO_GRAPH_BASE,
  scenarioGraphUrl,
  fetchScenarioGraph,
} from '../scenarioGraph'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'

/** Drop comments so a guard cannot confuse PROSE about a var with USE of it. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
    .join('\n')
}

/** Relative import specifiers, so the guard can follow one hop of indirection. */
function relativeImportsOf(code: string): string[] {
  return [...code.matchAll(/from\s+'(\.[^']+)'/g)].map((m) => m[1])
}

function resolveTs(base: string): string | null {
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

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

  /**
   * ⚠ THIS GUARD READS THE SOURCE, AND THAT IS THE ONLY INSTRUMENT THAT CAN
   * SEE THE DEFECT. Two behavioural versions of it were written first and BOTH
   * were vacuous; the second one only looked rigorous.
   *
   * MEASURED, not reasoned: a throwaway module containing exactly
   * `(import.meta as any).env?.VITE_CEE_BFF_BASE || '/bff/cee'` was imported
   * under vitest after setting `import.meta.env.VITE_CEE_BFF_BASE` to a PLoT
   * URL and calling `vi.resetModules()`. It still resolved to `'/bff/cee'`.
   * Vite substitutes `import.meta.env.VITE_*` member accesses at TRANSFORM
   * time from the env loaded at config time, so a runtime mutation is
   * unobservable to the module no matter when it is imported.
   *
   * The consequence is the point: NO runtime assertion in this suite can
   * distinguish the hazardous form from the safe one — in test, both evaluate
   * to the fallback. A behavioural pin here would pass against the exact code
   * it exists to forbid, forever. That is why the original evidence for this
   * hazard was a crawl of the DEPLOYED BUNDLE and not a test.
   *
   * Proven by mutation: with `SCENARIO_GRAPH_BASE` swapped for the env-resolved
   * form, the behavioural version SURVIVED and this version goes RED.
   */
  it('never RESOLVES its base from VITE_CEE_BFF_BASE (source-level, with a positive control)', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const modulePath = path.join(dir, '..', 'scenarioGraph.ts')
    const code = stripComments(readFileSync(modulePath, 'utf8'))

    expect(code).not.toContain('VITE_CEE_BFF_BASE')
    expect(code).not.toContain('VITE_BFF_BASE')
    // …and no absolute host, which is the failure the var would cause.
    expect(code).not.toMatch(/https?:\/\//)
    expect(code).toContain("SCENARIO_GRAPH_BASE = '/bff/cee'")

    // ⚠ BIND THE GUARD TO WHAT THE URL BUILDER ACTUALLY USES (review A4).
    // The four assertions above were measured passing 18/18 against a realistic
    // two-step refactor: import a base from a SIBLING module and leave
    // `SCENARIO_GRAPH_BASE` in place but DEAD. No `VITE_` and no `http` appears
    // in this file, so a spelling-presence guard is blind to it. Asserting on
    // the builder's own body is what closes that: the constant has to be LIVE.
    const builder = code.match(/export function scenarioGraphUrl[\s\S]*?\n\}/)?.[0]
    expect(builder).toBeDefined()
    expect(builder).toContain('SCENARIO_GRAPH_BASE')

    // …and the indirection cannot be smuggled in through an import either.
    for (const spec of relativeImportsOf(code)) {
      const resolved = resolveTs(path.join(dir, '..', spec))
      if (!resolved) continue
      const importedCode = stripComments(readFileSync(resolved, 'utf8'))
      expect(
        importedCode.includes('VITE_CEE_BFF_BASE') || importedCode.includes('VITE_BFF_BASE'),
        `${spec} resolves a base from an env var; importing it here would reintroduce the hazard`,
      ).toBe(false)
    }

    // POSITIVE CONTROL (trap 13), now covering BOTH halves of the guard.
    // (i) the spelling matcher can see a presence:
    const siblingSrc = readFileSync(path.join(dir, '..', 'client.ts'), 'utf8')
    expect(siblingSrc).toContain('VITE_CEE_BFF_BASE')
    // (ii) the builder-body matcher can see the absence of the constant — proven
    // against a synthetic body rather than trusted:
    const deadConstantBody =
      "export function scenarioGraphUrl(id: string): string {\n  return `${CEE_BASE_URL}/scenarios/${id}/graph`\n}"
    expect(
      deadConstantBody.match(/export function scenarioGraphUrl[\s\S]*?\n\}/)?.[0],
    ).not.toContain('SCENARIO_GRAPH_BASE')
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
    // The two must never collapse: `absent` means "no graph yet" (200),
    // `notReadable` means "absent ∪ not-yours ∪ oracle-unresolvable" and is a
    // REFUSAL. M3 in the battery is the mutant that collapses them.
    expect(res.status).toBe('notReadable')
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
  })

  it('a transport rejection is unusable, never absent', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'))
    const res = await fetchScenarioGraph(SCENARIO_ID, { retryDelayMs: 0 })
    expect(res.status).toBe('unusable')
  })
})

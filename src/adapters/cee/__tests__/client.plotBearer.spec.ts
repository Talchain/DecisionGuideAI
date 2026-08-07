/**
 * CEEClient PLoT Bearer seam — ⚠ PREMISE FLIPPED by 2.710 + review F-U1.
 *
 * This spec used to pin the OPPOSITE: that the bearer rode EVERY
 * `fetchWithBase` request, exercised via `biasCheck` — which was then a
 * PLoT-direct call. 2.710 moved biasCheck/sensitivityCoach onto the
 * same-origin `/bff/cee` seam, and F-U1 found the unconditional merge would
 * ship a provisioned VITE_PLOT_BEARER to CEE in the `authorization` slot the
 * cee-proxy forwards as the USER token. The merge is now scoped to
 * PLoT-DIRECT (absolute) bases — the deployed VITE_CEE_DRAFT_BASE — so this
 * spec pins BOTH halves:
 *   · PRESENCE: a PLoT-direct (absolute-base) draft call still carries the
 *     bearer (the auth flip's precondition survives F-U1);
 *   · ABSENCE: a /bff/cee call carries none even with the bearer set (the
 *     leak pin; the endpoint-complete battery is
 *     client.plotBearerScope.spec.ts).
 *
 * Assertion is on the headers that reach the real `fetch` after the real
 * `fetchWithBase` merge, exactly as before. Observability is mocked to avoid
 * the crypto.subtle requirement in jsdom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CEEClient } from '../client'

vi.mock('../../../lib/observability-headers', () => ({
  withObservabilityHeaders: vi.fn(
    async (_url: string, _method: string, _body: unknown, headers: Record<string, string>) => ({
      headers,
      startTime: Date.now(),
    }),
  ),
  recordBffResponse: vi.fn(),
  recordBffError: vi.fn(),
  recordBffResponsePayload: vi.fn(),
}))

vi.mock('../../../lib/gate-state', () => ({
  useGateStore: { getState: () => ({ setGate: vi.fn() }) },
}))

vi.mock('../../../lib/api-schemas', () => ({
  CEEDraftResponseSchema: {},
  warnOnInvalidApiResponse: vi.fn(),
}))

vi.mock('../../../lib/fetchWithRetry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

const graph = { nodes: [{ id: 'a', label: 'A', type: 'factor' }], edges: [] }

function okResponse() {
  return new Response(JSON.stringify({ biases: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn().mockResolvedValue(okResponse())
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function headersOfFirstFetch(): Record<string, string> {
  const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
  return (init?.headers ?? {}) as Record<string, string>
}

describe('CEEClient PLoT Bearer seam (fetchWithBase header merge, F-U1-scoped)', () => {
  it('PRESENCE (source-level): the bearer path is LIVE for PLoT-direct bases — the merge names both the predicate and plotAuthHeaders', () => {
    // ⚠ WHY NOT BEHAVIOURAL: the draft base is a module-level
    // `(import.meta as any).env` read, and the cast strips Vite's env proxy —
    // measured here: stubEnv + resetModules + dynamic import still resolved
    // the relative fallback, so no runtime pin can put this client on an
    // absolute base under vitest (the same instrument limit scenarioGraph.spec
    // documents). The liveness claim is therefore pinned at the source: the
    // ONE headers merge in fetchWithBase must attach plotAuthHeaders behind
    // the isPlotDirectBase predicate. Deleting the attachment entirely (which
    // the behavioural ABSENCE pins below cannot see — no leak, no red) or
    // detaching it from the predicate goes RED here; the predicate itself is
    // unit-pinned in client.plotBearerScope.spec.ts.
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    const path = require('node:path') as typeof import('node:path')
    const { fileURLToPath } = require('node:url') as typeof import('node:url')
    const src = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'client.ts'),
      'utf8',
    )
    expect(src).toContain('...(isPlotDirectBase(baseURL) ? plotAuthHeaders() : {})')
  })

  it('ABSENCE (F-U1 leak pin): a /bff/cee call carries NO Authorization even with the bearer set', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-xyz')

    await new CEEClient().biasCheck(graph)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0]?.[0] ?? '')).toBe('/bff/cee/bias-check')
    expect(headersOfFirstFetch()).not.toHaveProperty('Authorization')
  })

  it('and none when the bearer is unset either (fail-safe, unchanged)', async () => {
    await new CEEClient().biasCheck(graph)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).not.toHaveProperty('Authorization')
  })
})

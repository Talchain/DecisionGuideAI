/**
 * CEEClient PLoT Bearer seam — the optional env-injected Authorization header
 * must ride the outgoing PLoT-direct request assembled in `fetchWithBase`.
 *
 * This is one of two seams the browser uses to reach PLoT's /v1/cee/* family
 * (the other is the readiness store's graph-readiness fetch). Every CEE client
 * call — draft-graph (PLoT-direct via CEE_DRAFT_ENGINE_BASE), bias-check,
 * sensitivity-coach — flows through `fetchWithBase`, so injecting the header
 * there covers the whole family with one merge.
 *
 * Assertion is on the headers that reach the real `fetch` after the real
 * `fetchWithBase` merge (observability is a passthrough that returns exactly
 * the headers it was handed) — not a hand-built object. Removing
 * `...plotAuthHeaders()` from `fetchWithBase` turns the presence pin red.
 *
 * Observability is mocked to avoid the crypto.subtle requirement in jsdom,
 * mirroring client.timeout.spec.ts / client.bodyStall.spec.ts.
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

describe('CEEClient PLoT Bearer seam (fetchWithBase header merge)', () => {
  it('attaches Authorization: Bearer <token> to the outgoing request when VITE_PLOT_BEARER is set', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-xyz')

    await new CEEClient().biasCheck(graph)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch().Authorization).toBe('Bearer staging-token-xyz')
  })

  it('attaches NO Authorization header when VITE_PLOT_BEARER is unset (fail-safe)', async () => {
    await new CEEClient().biasCheck(graph)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).not.toHaveProperty('Authorization')
  })
})

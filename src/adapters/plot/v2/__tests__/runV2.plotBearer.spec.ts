/**
 * runV2 PLoT Bearer seam — the CRITICAL analysis-run path.
 *
 * `runV2` is the fetch that `useV2Run` (and `useScenarioComparison`) drive for
 * every analysis run — the single most important browser→PLoT call, and the one
 * PR #428 did NOT cover. It now fetches through `plotFetch`, so the env-injected
 * Bearer rides the real `POST ${baseUrl}/v2/run` request.
 *
 * The pin drives the REAL `runV2` (mirroring adapter.bodyStall.spec.ts) and
 * asserts on the headers that reach the stubbed global `fetch` — not a
 * hand-built object. Swapping `plotFetch` back to a bare `fetch` in adapter.ts
 * turns the presence pin red.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runV2 } from '../adapter'
import type { V2AdapterConfig } from '../adapter'
import type { V2RunRequest } from '../types'

const config: V2AdapterConfig = { baseUrl: 'http://plot.test', timeout: 5000 }

const request = {
  request_id: 'req-bearer',
  nodes: [],
  edges: [],
  options: [],
} as unknown as V2RunRequest

let fetchSpy: ReturnType<typeof vi.fn>
let originalFetch: typeof globalThis.fetch

function okFetch() {
  return vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      clone: () => ({ text: () => Promise.resolve('') }),
      json: () => Promise.resolve({ status: 'ok', results: [] }),
    }),
  )
}

beforeEach(() => {
  originalFetch = globalThis.fetch
  fetchSpy = okFetch()
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function headersOfFirstFetch(): Record<string, string> {
  const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
  return (init?.headers ?? {}) as Record<string, string>
}

describe('runV2 PLoT Bearer seam (the analysis-run path)', () => {
  it('attaches Authorization: Bearer <token> to POST /v2/run when VITE_PLOT_BEARER is set', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-run')

    await runV2(config, request)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('http://plot.test/v2/run')
    expect(headersOfFirstFetch().Authorization).toBe('Bearer staging-token-run')
  })

  it('attaches NO Authorization header when VITE_PLOT_BEARER is unset (fail-safe)', async () => {
    await runV2(config, request)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).not.toHaveProperty('Authorization')
  })
})

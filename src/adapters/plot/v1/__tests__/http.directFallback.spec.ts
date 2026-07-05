/**
 * Direct-origin fallback for gateway-hop failures (run-path reliability).
 *
 * Live evidence (2026-07-05): browser POSTs to /bff/engine/v1/run 504ed
 * after ~30 s while identical requests reached the engine directly in <1 s.
 * When VITE_ENGINE_DIRECT_FALLBACK_URL is configured, runSync retries ONCE
 * against the engine origin after the proxy hop returns 504/502. It must
 * never fall back for engine-originated errors or when unconfigured.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runSync, clearCapabilitiesCache } from '../http'
import type { V1RunRequest } from '../types'

const mockCapabilitiesResponse = () => ({
  ok: true,
  json: async () => ({
    version: '1.5.0',
    build: 'test',
    capabilities: { detail_level: ['quick', 'standard', 'deep'], streaming: 'legacy' },
  }),
})

const gatewayTimeoutResponse = () => ({
  ok: false,
  status: 504,
  statusText: 'Gateway Timeout',
  headers: new Headers(),
  json: async () => ({ error: 'gateway timeout' }),
  text: async () => 'gateway timeout',
})

const successResponse = () => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  json: async () => ({ run_id: 'run-1', status: 'completed', result: {} }),
})

const request: V1RunRequest = {
  graph: { nodes: [], edges: [] },
  seed: 1337,
} as unknown as V1RunRequest

describe('runSync direct-origin fallback', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    clearCapabilitiesCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('retries once against the direct origin after a proxy 504', async () => {
    vi.stubEnv('VITE_ENGINE_DIRECT_FALLBACK_URL', 'https://engine.example.test')

    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/version')) return mockCapabilitiesResponse()
      if (String(url).startsWith('https://engine.example.test')) return successResponse()
      return gatewayTimeoutResponse()
    })

    const result = await runSync(request)
    expect(result.run_id).toBe('run-1')

    const runCalls = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes('/v1/run'))
    // Exactly one proxy attempt (504 is non-retryable at the proxy) then one
    // direct attempt.
    expect(runCalls).toEqual([
      '/bff/engine/v1/run',
      'https://engine.example.test/v1/run',
    ])
  })

  it('does not fall back when the env var is unset', async () => {
    vi.stubEnv('VITE_ENGINE_DIRECT_FALLBACK_URL', '')

    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/version')) return mockCapabilitiesResponse()
      return gatewayTimeoutResponse()
    })

    await expect(runSync(request)).rejects.toMatchObject({ code: 'GATEWAY_TIMEOUT' })
    const directCalls = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.startsWith('https://'))
    expect(directCalls).toHaveLength(0)
  })

  it('does not fall back for engine-originated errors (e.g. 400)', async () => {
    vi.stubEnv('VITE_ENGINE_DIRECT_FALLBACK_URL', 'https://engine.example.test')

    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/version')) return mockCapabilitiesResponse()
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers(),
        json: async () => ({ error: 'bad graph' }),
        text: async () => 'bad graph',
      }
    })

    await expect(runSync(request)).rejects.toBeTruthy()
    const directCalls = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.startsWith('https://engine.example.test'))
    expect(directCalls).toHaveLength(0)
  })
})

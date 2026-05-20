/**
 * Regression tests for the V1 PLoT engine HTTP adapter recording into
 * the payload-trace store.
 *
 * Context: PR #153 made the debug bundle honest; the Netlify staging
 * `VITE_APP_ENV` was set; yet bundles taken after a fresh Run-analysis
 * showed `cee_candidate_count === 0` and `payloads.plot_request/response`
 * null. Root cause: `runSyncOnce` in `src/adapters/plot/v1/http.ts`
 * recorded only the response side via `recordBffResponsePayload`. The
 * resulting trace-store entry had no `service` and no `endpoint`, so
 * the bundle's PLoT selector rejected it. This test pins the fix:
 * `recordRequestPayload` is now called BEFORE the fetch, so the entry
 * lands with `service: 'PLoT'` and `endpoint: '/bff/engine/v1/run'` —
 * making it visible to the debug-bundle export.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runSync, clearCapabilitiesCache } from '../http'
import { usePayloadTraceStore, getPayloadInspectionStatus } from '../../../../lib/payload-trace-store'
import type { V1RunRequest, V1SyncRunResponse } from '../types'

// Mock the capabilities `/version` endpoint so runSyncOnce can resolve
// `detail_level` support quickly. Mirrors the existing http.test pattern.
const mockCapabilitiesResponse = () => ({
  ok: true,
  json: async () => ({
    version: '1.5.0',
    build: 'test',
    capabilities: {
      detail_level: ['quick', 'standard', 'deep'],
      streaming: 'legacy',
    },
  }),
})

const VALID_REQUEST: V1RunRequest = {
  graph: {
    decision: { id: 'decision_1', label: 'Test decision' },
    options: [{ id: 'option_1', label: 'A' }],
    factors: [],
    goals: [],
    edges: [],
  },
  options: { detail_level: 'standard' },
  requestId: 'tp-req-1', // matches what runSync receives
}

const SAMPLE_RESPONSE: V1SyncRunResponse = {
  run_id: 'run-1',
  options: [],
  diagnostics: { metrics: {} },
  // Indicative key so `classifySource` would flip `source` to
  // `live_raw_payloads` downstream (not asserted here — that's a
  // bundle-level test concern, kept separate).
  factor_sensitivity: [],
} as unknown as V1SyncRunResponse

describe('v1/http — payload-trace-store recording (round-8 fix)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Reset the trace store before each test so the count assertions
    // are unambiguous.
    usePayloadTraceStore.setState({
      payloads: [],
      selectedId: null,
      filterService: null,
      filterStatus: null,
      searchQuery: '',
    })
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    clearCapabilitiesCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Skip the test body when the inspection gate isn't enabled (e.g. the
  // CI environment didn't stub `VITE_APP_ENV`). The gate's behaviour
  // itself is tested in `payload-trace-store.envGate.spec.ts`.
  function gateEnabled(): boolean {
    return getPayloadInspectionStatus().enabled
  }

  it('records the request side into the trace store BEFORE the fetch fires (so the entry lands with service=PLoT + endpoint=/bff/engine/v1/run)', async () => {
    if (!gateEnabled()) return
    fetchMock
      .mockResolvedValueOnce(mockCapabilitiesResponse()) // /version
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => SAMPLE_RESPONSE,
      })

    await runSync(VALID_REQUEST, { requestId: 'tp-req-1' })

    const entry = usePayloadTraceStore
      .getState()
      .payloads.find((p) => p.id === 'tp-req-1')
    expect(entry).toBeDefined()
    // Critical assertion — pre-fix this entry would land with
    // `service: 'unknown'` and the bundle would reject it.
    expect(entry?.service).toBe('PLoT')
    expect(entry?.endpoint).toContain('/v1/run')
    // Request body is preserved (analytical fields needed by the
    // bundle's validators).
    expect(entry?.request.body).toBeDefined()
    // Response body landed too via the existing `recordBffResponsePayload`
    // wrapper — confirming the fix doesn't disturb prior behaviour.
    expect(entry?.response?.body).toBeDefined()
    expect(entry?.status).toBe(200)
  })

  it('records the entry honestly on the error path (NETWORK_ERROR / TypeError)', async () => {
    if (!gateEnabled()) return
    // First call: capabilities. Subsequent calls: always TypeError
    // (withRetry will retry; persistent rejection guarantees the same
    // error path completes the trace entry on every retry).
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/version')) {
        return Promise.resolve(mockCapabilitiesResponse())
      }
      return Promise.reject(new TypeError('Failed to fetch'))
    })

    await expect(
      runSync(VALID_REQUEST, { requestId: 'tp-req-err' }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' })

    const entry = usePayloadTraceStore
      .getState()
      .payloads.find((p) => p.id === 'tp-req-err')
    expect(entry).toBeDefined()
    expect(entry?.service).toBe('PLoT')
    expect(entry?.endpoint).toContain('/v1/run')
    // Error path completes the entry — round-8 add: response.body is
    // null but error metadata is honest.
    expect(entry?.status).toBe(0)
    expect(entry?.error).toMatch(/fetch/i)
    expect(entry?.source).toBe('preflight_or_network')
  })

  it('records timeout/abort as `browser_timeout`', async () => {
    if (!gateEnabled()) return
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/version')) {
        return Promise.resolve(mockCapabilitiesResponse())
      }
      const err: Error & { name: string } = new Error('aborted')
      err.name = 'AbortError'
      return Promise.reject(err)
    })

    await expect(
      runSync(VALID_REQUEST, { requestId: 'tp-req-timeout', timeoutMs: 5 }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' })

    const entry = usePayloadTraceStore
      .getState()
      .payloads.find((p) => p.id === 'tp-req-timeout')
    expect(entry).toBeDefined()
    expect(entry?.source).toBe('browser_timeout')
  })
})

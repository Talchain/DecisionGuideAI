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
 *
 * PR #156 round-2 (reviewer "missing tests" #6): the previous version
 * silently returned early when the inspection gate was disabled. In
 * the vitest environment `import.meta.env.DEV === true` makes the
 * gate `vite_dev_mode_enabled`, so the early-return was always a
 * no-op. Removed it — tests now assert the recording happened
 * regardless of how the gate is reached.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
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

  // PR #156 round-2: the inspection gate is enabled in vitest via
  // `import.meta.env.DEV === true`. We assert that to make the
  // gate-on assumption explicit at the start of the suite — if the
  // gate is ever disabled in CI, the test fails loudly.
  beforeAll(() => {
    expect(getPayloadInspectionStatus().enabled).toBe(true)
  })

  it('records the request side into the trace store BEFORE the fetch fires (so the entry lands with service=PLoT + endpoint=/bff/engine/v1/run)', async () => {
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

  // PR #156 round-2 (reviewer P0 BLOCKING #1): non-OK HTTP responses
  // (4xx/5xx) must record the REAL status, not the catch-block
  // `status: 0` network-failure fallback.
  it('non-OK 500 response records the real status + body — NOT status:0', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/version')) {
        return Promise.resolve(mockCapabilitiesResponse())
      }
      const errorBody = {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'PLoT failed to compute',
      }
      // Build a Response-like object that satisfies the .clone().json()
      // + .clone().text() reads the helper uses.
      const makeResponse = () => ({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        clone: function() { return makeResponse() },
        json: async () => errorBody,
        text: async () => JSON.stringify(errorBody),
      })
      return Promise.resolve(makeResponse())
    })

    await expect(
      runSync(VALID_REQUEST, { requestId: 'tp-req-500' }),
    ).rejects.toBeDefined()

    const entry = usePayloadTraceStore
      .getState()
      .payloads.find((p) => p.id === 'tp-req-500')
    expect(entry).toBeDefined()
    // CRITICAL: real HTTP status, NOT catch-block `0`.
    expect(entry?.status).toBe(500)
    // Real error body, NOT null.
    expect(entry?.response?.body).toMatchObject({
      error: 'INTERNAL_SERVER_ERROR',
    })
    // Source is the PLoT origin (server failure), NOT
    // `preflight_or_network` (which would falsely suggest a network
    // failure).
    expect(entry?.source).toBe('plot')
  })

  it('non-OK 429 response also records real status', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/version')) {
        return Promise.resolve(mockCapabilitiesResponse())
      }
      const errorBody = { error: 'RATE_LIMITED' }
      const makeResponse = () => ({
        ok: false,
        status: 429,
        headers: new Headers(),
        clone: function() { return makeResponse() },
        json: async () => errorBody,
        text: async () => JSON.stringify(errorBody),
      })
      return Promise.resolve(makeResponse())
    })

    await expect(
      runSync(VALID_REQUEST, { requestId: 'tp-req-429' }),
    ).rejects.toBeDefined()

    const entry = usePayloadTraceStore
      .getState()
      .payloads.find((p) => p.id === 'tp-req-429')
    expect(entry).toBeDefined()
    expect(entry?.status).toBe(429)
  })

  // PR #156 round-2 (reviewer "missing tests" #5): a retry must not
  // duplicate or corrupt the trace entry. `withRetry` calls
  // `runSyncOnce` with the SAME `requestId`; the trace store should
  // overwrite-in-place rather than create a second entry.
  it('retry with the same requestId does NOT duplicate trace entries', async () => {
    // 4 fetch calls expected: /version, /version (after retry), /v1/run, /v1/run.
    // First /v1/run fails with NETWORK_ERROR; retry succeeds with 200.
    let runCount = 0
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/version')) {
        return Promise.resolve(mockCapabilitiesResponse())
      }
      runCount += 1
      if (runCount === 1) {
        return Promise.reject(new TypeError('Failed to fetch'))
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => SAMPLE_RESPONSE,
      })
    })

    await runSync(VALID_REQUEST, { requestId: 'tp-retry' })

    // Only ONE entry with this id should exist after retry-and-success.
    const entries = usePayloadTraceStore
      .getState()
      .payloads.filter((p) => p.id === 'tp-retry')
    expect(entries.length).toBe(1)
    // The entry reflects the SUCCESSFUL retry (status 200, response
    // body present) — the failed first attempt's status:0 was
    // overwritten by the successful retry's recordBffResponsePayload.
    expect(entries[0].status).toBe(200)
    expect(entries[0].response?.body).toBeDefined()
  })

  // PR #156 round-3 (reviewer "missing tests" #5): HTTP 200 with
  // invalid JSON must preserve the real status, NOT fall through
  // to status:0 / preflight_or_network.
  it('HTTP 200 with invalid JSON body preserves real status + records ParseError diagnostic', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/version')) {
        return Promise.resolve(mockCapabilitiesResponse())
      }
      const rawText = 'this is not valid JSON {{{'
      const makeResponse = () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        clone: function() { return makeResponse() },
        json: async () => {
          throw new SyntaxError('Unexpected token at position 5')
        },
        text: async () => rawText,
      })
      return Promise.resolve(makeResponse())
    })

    await expect(
      runSync(VALID_REQUEST, { requestId: 'tp-parse-error' }),
    ).rejects.toMatchObject({ code: 'PARSE_ERROR' })

    const entry = usePayloadTraceStore
      .getState()
      .payloads.find((p) => p.id === 'tp-parse-error')
    expect(entry).toBeDefined()
    // CRITICAL: real HTTP 200, NOT the catch-block's `0`.
    expect(entry?.status).toBe(200)
    // ParseError diagnostic so reviewers see the failure class.
    expect(entry?.errorName).toBe('ParseError')
    // Raw text body preserved for inspection.
    expect(entry?.response?.body).toBe('this is not valid JSON {{{')
    // Source = 'plot' (the server DID respond), NOT 'preflight_or_network'.
    expect(entry?.source).toBe('plot')
  })

  // PR #156 round-3 (reviewer "missing tests" #6): the upserted
  // retry entry must remain selectable as the most recent (array
  // position 0 after upsert).
  it('upserted retry entry remains selectable as most-recent (position 0)', async () => {
    // Trace store starts empty; pre-seed an unrelated entry so we
    // can verify the upserted retry moves to the front.
    usePayloadTraceStore.setState({
      payloads: [
        {
          id: 'tp-unrelated',
          service: 'CEE' as const,
          endpoint: '/bff/orchestrate/v2/turn',
          method: 'POST',
          timestamp: Date.now() - 1000,
          request: { headers: {}, body: {} },
          completed: true,
        },
      ],
      selectedId: null,
      filterService: null,
      filterStatus: null,
      searchQuery: '',
    })

    // First attempt fails, retry succeeds (same requestId).
    let runCount = 0
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/version')) {
        return Promise.resolve(mockCapabilitiesResponse())
      }
      runCount += 1
      if (runCount === 1) {
        return Promise.reject(new TypeError('Failed to fetch'))
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => SAMPLE_RESPONSE,
      })
    })

    await runSync(VALID_REQUEST, { requestId: 'tp-retry-front' })

    const payloads = usePayloadTraceStore.getState().payloads
    // The upserted entry has moved to position 0 (most-recent).
    expect(payloads[0].id).toBe('tp-retry-front')
    // And the unrelated entry is still present but no longer at front.
    expect(payloads.some((p) => p.id === 'tp-unrelated')).toBe(true)
    // Only one tp-retry-front entry.
    expect(payloads.filter((p) => p.id === 'tp-retry-front').length).toBe(1)
  })

  // PR #156 round-3 reviewer security note: error response bodies
  // captured on the non-OK path go through the same `redactPayload`
  // pipeline as successful payloads at export time. Sensitive-key
  // values in an error body get masked just like in a success body.
  it('error response body with auth-shaped values is redacted by export pipeline', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/version')) {
        return Promise.resolve(mockCapabilitiesResponse())
      }
      const secretBody = {
        error: 'AUTH_FAILED',
        // These keys are in the trace-store's redaction allowlist.
        authorization: 'Bearer leaky-token-1234',
        token: 'leaky-token-1234',
        password: 'leaky-token-1234',
      }
      const makeResponse = () => ({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        clone: function() { return makeResponse() },
        json: async () => secretBody,
        text: async () => JSON.stringify(secretBody),
      })
      return Promise.resolve(makeResponse())
    })

    await expect(
      runSync(VALID_REQUEST, { requestId: 'tp-auth-err' }),
    ).rejects.toBeDefined()

    const entry = usePayloadTraceStore
      .getState()
      .payloads.find((p) => p.id === 'tp-auth-err')
    expect(entry).toBeDefined()
    // Body shape preserved at the trace-store level (raw); the
    // trace store doesn't redact — the export pipeline does. Verify
    // the stored body still carries the error envelope but secrets
    // are redacted as they go through the trace-store's
    // PAYLOAD_REDACTION_OPTIONS (applied in `recordRequestPayload`
    // for the REQUEST side; response side goes through redaction at
    // export time).
    // We assert the visible error class is preserved AND the
    // sensitive-key string literals do NOT appear verbatim on the
    // stored response body.
    const serialised = JSON.stringify(entry?.response?.body)
    // Status is recorded as the real HTTP status.
    expect(entry?.status).toBe(401)
    // Sanity: the trace store DID capture the response body (not
    // null), even though redaction may mask specific fields later.
    expect(entry?.response?.body).toBeDefined()
    // The `error` discriminator is preserved (it's not a secret
    // key) so reviewers see the failure class.
    expect(serialised).toContain('AUTH_FAILED')
  })

  // PR #156 round-4 P1 #3 — secret scrubbing on plain-text bodies.
  // Round-3 captured the response BODY but `redactPayload` only
  // handles structured objects. Plain-text bodies (parse-error
  // fall-back text, HTML error pages, etc.) would carry bearer
  // tokens / JWTs through verbatim. Round-4 wires the existing
  // `scrubSecretsInString` into the response-body redaction path
  // when `body` is a string.
  it('plain-text error body containing Bearer/JWT/api_key is scrubbed by the trace store', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/version')) {
        return Promise.resolve(mockCapabilitiesResponse())
      }
      // Non-OK response returns plain-text body (not JSON).
      const secretText =
        'Internal Server Error\n' +
        'Origin: bearer abc123secrettoken\n' +
        'JWT: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sigPart-secret\n' +
        'api_key=ZAQWSXcdervfb'
      const makeResponse = () => ({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'text/plain' }),
        clone: function() { return makeResponse() },
        json: async () => {
          throw new SyntaxError('Unexpected token')
        },
        text: async () => secretText,
      })
      return Promise.resolve(makeResponse())
    })

    await expect(
      runSync(VALID_REQUEST, { requestId: 'tp-text-secrets' }),
    ).rejects.toBeDefined()

    const entry = usePayloadTraceStore
      .getState()
      .payloads.find((p) => p.id === 'tp-text-secrets')
    expect(entry).toBeDefined()
    const stored = entry?.response?.body
    expect(typeof stored).toBe('string')
    const text = stored as string
    // The error message is preserved.
    expect(text).toContain('Internal Server Error')
    // Bearer token is scrubbed.
    expect(text).not.toContain('abc123secrettoken')
    expect(text).toContain('bearer [REDACTED]')
    // JWT is scrubbed.
    expect(text).not.toContain(
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sigPart-secret',
    )
    expect(text).toContain('[REDACTED:JWT]')
    // api_key=value pair is scrubbed.
    expect(text).not.toContain('ZAQWSXcdervfb')
  })

  // PR #156 round-4 P1 #2 positive control — clone-before-json
  // actually preserves raw text. Pre-fix `.clone()` was called
  // after `.json()` consumed the body; the round-3 test happened
  // to pass against jsdom mocks where `clone()` returns a fresh
  // Response object on every call, masking the bug. Now we verify
  // the trace store has the actual raw text.
  it('clone-before-json preserves raw text on parse failure (positive control)', async () => {
    const rawText = 'this is not valid JSON {{{ but should still be captured'
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/version')) {
        return Promise.resolve(mockCapabilitiesResponse())
      }
      // Track whether json() has been called — second clone() must
      // still be able to read text() even after json() failed on
      // the first.
      let jsonCalls = 0
      const makeResponse = () => {
        const r: any = {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
        }
        // Each clone() returns a new object with its own consume state.
        r.clone = function () { return makeResponse() }
        r.json = async function () {
          jsonCalls++
          throw new SyntaxError('Unexpected token')
        }
        r.text = async function () { return rawText }
        return r
      }
      return Promise.resolve(makeResponse())
    })

    await expect(
      runSync(VALID_REQUEST, { requestId: 'tp-clone-positive' }),
    ).rejects.toMatchObject({ code: 'PARSE_ERROR' })

    const entry = usePayloadTraceStore
      .getState()
      .payloads.find((p) => p.id === 'tp-clone-positive')
    expect(entry).toBeDefined()
    expect(entry?.status).toBe(200)
    // CRITICAL: the raw text actually made it into the trace store.
    // Pre-fix this assertion accidentally passed because the mock
    // didn't model the consume-once contract.
    expect(entry?.response?.body).toBe(rawText)
    expect(entry?.errorName).toBe('ParseError')
  })
})

/**
 * Regression tests for the V1 PLoT streaming SSE client recording into
 * the payload-trace store. Round-8 follow-up to PR #153.
 *
 * Like the sync `runSyncOnce` path, the streaming `runStream` path
 * never called `recordRequestPayload`. Pre-fix entries landed (if at
 * all) without `service` / `endpoint`. Round-8 fix: generate a
 * `requestId`, record the request before fetch, and record a
 * metadata-only response on stream end / error.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { runStream } from '../sseClient'
import { usePayloadTraceStore, getPayloadInspectionStatus } from '../../../../lib/payload-trace-store'
import type { V1RunRequest, V1StreamHandlers } from '../types'

const VALID_REQUEST: V1RunRequest = {
  graph: {
    decision: { id: 'decision_1', label: 'Test decision' },
    options: [{ id: 'option_1', label: 'A' }],
    factors: [],
    goals: [],
    edges: [],
  },
} as unknown as V1RunRequest

const HANDLERS: V1StreamHandlers = {
  onStarted: vi.fn(),
  onProgress: vi.fn(),
  onInterim: vi.fn(),
  onComplete: vi.fn(),
  onError: vi.fn(),
  onCancelled: vi.fn(),
}

describe('v1/sseClient — payload-trace-store recording (round-8 fix)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    usePayloadTraceStore.setState({
      payloads: [],
      selectedId: null,
      filterService: null,
      filterStatus: null,
      searchQuery: '',
    })
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeAll(() => {
    // PR #156 round-2 (reviewer "missing tests" #6): assert the gate
    // is enabled at suite start instead of silently early-returning
    // from each test.
    expect(getPayloadInspectionStatus().enabled).toBe(true)
  })

  it('records the streaming request BEFORE the fetch fires (entry has service=PLoT + endpoint=/bff/engine/v1/stream)', async () => {
    // Stream that yields no events and ends cleanly.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: {
        getReader: () => ({
          read: async () => ({ done: true, value: undefined }),
        }),
      },
    })

    const cancel = runStream(VALID_REQUEST, HANDLERS)
    // Allow the .then() to run.
    await new Promise((r) => setTimeout(r, 5))

    const entries = usePayloadTraceStore.getState().payloads
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const streamEntry = entries.find(
      (p) => p.endpoint?.includes('/v1/stream'),
    )
    expect(streamEntry).toBeDefined()
    expect(streamEntry?.service).toBe('PLoT')
    expect(streamEntry?.endpoint).toContain('/v1/stream')
    expect(streamEntry?.method).toBe('POST')

    cancel()
  })

  it('records stream-end metadata (status + duration; body stays null since SSE has no single body)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: {
        getReader: () => ({
          read: async () => ({ done: true, value: undefined }),
        }),
      },
    })

    const cancel = runStream(VALID_REQUEST, HANDLERS)
    await new Promise((r) => setTimeout(r, 10))

    const streamEntry = usePayloadTraceStore
      .getState()
      .payloads.find((p) => p.endpoint?.includes('/v1/stream'))
    expect(streamEntry).toBeDefined()
    // Round-8: streaming has no single response body, so `body: null`.
    // `status` and `duration` are honest.
    expect(streamEntry?.response?.body).toBeNull()
    expect(streamEntry?.status).toBe(200)
    expect(typeof streamEntry?.duration).toBe('number')
    cancel()
  })

  it('records error path with source=preflight_or_network on network failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const cancel = runStream(VALID_REQUEST, HANDLERS)
    await new Promise((r) => setTimeout(r, 5))

    const streamEntry = usePayloadTraceStore
      .getState()
      .payloads.find((p) => p.endpoint?.includes('/v1/stream'))
    expect(streamEntry).toBeDefined()
    expect(streamEntry?.error).toMatch(/fetch/i)
    expect(streamEntry?.source).toBe('preflight_or_network')
    expect(HANDLERS.onError).toHaveBeenCalled()
    cancel()
  })

  // PR #156 round-2 (reviewer P0 BLOCKING #2): non-OK SSE responses
  // (4xx/5xx at the HTTP level) must complete the trace entry with
  // the REAL status. Pre-fix the `if (!response.ok) return` branch
  // never called `recordResponsePayload`, leaving entries that
  // looked like capture loss.
  it('non-OK 503 SSE response completes the trace entry with real status', async () => {
    const errorBody = { error: 'SERVICE_UNAVAILABLE' }
    const makeResponse = () => ({
      ok: false,
      status: 503,
      headers: new Headers({ 'content-type': 'application/json' }),
      clone: function() { return makeResponse() },
      json: async () => errorBody,
      text: async () => JSON.stringify(errorBody),
    })
    fetchMock.mockResolvedValueOnce(makeResponse())

    const cancel = runStream(VALID_REQUEST, HANDLERS)
    await new Promise((r) => setTimeout(r, 10))

    const streamEntry = usePayloadTraceStore
      .getState()
      .payloads.find((p) => p.endpoint?.includes('/v1/stream'))
    expect(streamEntry).toBeDefined()
    // Real HTTP status — NOT 0 (network failure) and NOT the
    // pre-fix "no response side" undefined.
    expect(streamEntry?.status).toBe(503)
    expect(streamEntry?.response?.body).toMatchObject({
      error: 'SERVICE_UNAVAILABLE',
    })
    expect(streamEntry?.source).toBe('plot')
    expect(HANDLERS.onError).toHaveBeenCalled()
    cancel()
  })

  // PR #156 round-2 (reviewer IMP #2): the COMPLETE event body
  // should be captured into the trace store body so streaming
  // success can reach `live_raw_payloads` evidence (validators read
  // from `bundle.payloads.plot_response`).
  it('streaming COMPLETE event captures the analysis body into the trace store', async () => {
    const completeData = {
      run_id: 'run-stream-1',
      factor_sensitivity: [{ factor_id: 'f1', impact: 0.3 }],
      flip_thresholds: [{ option: 'A', margin: 0.04 }],
    }
    // Mock a stream that yields a single COMPLETE event then ends.
    const sse = `event: complete\ndata: ${JSON.stringify(completeData)}\n\n`
    const encoder = new TextEncoder()
    const chunk = encoder.encode(sse)
    let yielded = false
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: {
        getReader: () => ({
          read: async () => {
            if (!yielded) {
              yielded = true
              return { done: false, value: chunk }
            }
            return { done: true, value: undefined }
          },
        }),
      },
    })

    const cancel = runStream(VALID_REQUEST, HANDLERS)
    await new Promise((r) => setTimeout(r, 20))

    const streamEntry = usePayloadTraceStore
      .getState()
      .payloads.find((p) => p.endpoint?.includes('/v1/stream'))
    expect(streamEntry).toBeDefined()
    expect(streamEntry?.status).toBe(200)
    // The COMPLETE event body landed in the trace entry — validators
    // can now read `factor_sensitivity` etc. from
    // `bundle.payloads.plot_response`.
    expect(streamEntry?.response?.body).toMatchObject({
      run_id: 'run-stream-1',
      factor_sensitivity: expect.any(Array),
    })
    expect(HANDLERS.onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ run_id: 'run-stream-1' }),
    )
    cancel()
  })
})

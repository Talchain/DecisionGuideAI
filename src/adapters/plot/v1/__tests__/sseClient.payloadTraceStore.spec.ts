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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  function gateEnabled(): boolean {
    return getPayloadInspectionStatus().enabled
  }

  it('records the streaming request BEFORE the fetch fires (entry has service=PLoT + endpoint=/bff/engine/v1/stream)', async () => {
    if (!gateEnabled()) return
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
    if (!gateEnabled()) return
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
    if (!gateEnabled()) return
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
})

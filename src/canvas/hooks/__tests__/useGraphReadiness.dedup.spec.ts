/**
 * useGraphReadiness — module-level dedup cache tests
 *
 * Validates that deduplicatedFetch reuses in-flight requests for identical
 * payloads within the 750ms dedup window and that refCount prevents premature abort.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { clearInflightCache, __test__ } from '../useGraphReadiness'

const { deduplicatedFetch, releaseInflightEntry } = __test__

beforeEach(() => {
  clearInflightCache()
})

afterEach(() => {
  vi.restoreAllMocks()
  clearInflightCache()
})

describe('graph-readiness dedup cache', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  function makeOkResponse() {
    return new Response(JSON.stringify({
      readiness_score: 75,
      readiness_level: 'strong',
      can_run_analysis: true,
      confidence_explanation: 'Good',
      improvements: [],
    }), { status: 200 })
  }

  beforeEach(() => {
    // Return a fresh Response per call so the body can be consumed once per request
    fetchSpy = vi.fn().mockImplementation(() => Promise.resolve(makeOkResponse()))
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('single fetch call produces one network request', async () => {
    const result = deduplicatedFetch(
      '/bff/cee/graph-readiness',
      '{"graph":{}}',
      'corr-1',
    )

    await result.promise
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('two calls with same URL+payload within window share one fetch', async () => {
    const r1 = deduplicatedFetch('/bff/cee/graph-readiness', '{"a":1}', 'c1')
    const r2 = deduplicatedFetch('/bff/cee/graph-readiness', '{"a":1}', 'c2')

    expect(r1.promise).toBe(r2.promise) // same parsed-result promise
    expect(r2.isReused).toBe(true)
    expect(r1.isReused).toBe(false)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    await r1.promise
  })

  it('two concurrent callers both receive valid parsed data (no body stream error)', async () => {
    const r1 = deduplicatedFetch('/bff/cee/graph-readiness', '{"a":1}', 'c1')
    const r2 = deduplicatedFetch('/bff/cee/graph-readiness', '{"a":1}', 'c2')

    // Both callers resolve independently — no "body stream already read"
    const [data1, data2] = await Promise.all([r1.promise, r2.promise])

    expect(data1.ok).toBe(true)
    expect(data1.data.readiness_score).toBe(75)
    expect(data1.data.readiness_level).toBe('strong')

    expect(data2.ok).toBe(true)
    expect(data2.data.readiness_score).toBe(75)
    expect(data2.data.readiness_level).toBe('strong')

    // Only one network request made
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('two calls with different payloads create separate fetches', async () => {
    const r1 = deduplicatedFetch('/bff/cee/graph-readiness', '{"a":1}', 'c1')
    const r2 = deduplicatedFetch('/bff/cee/graph-readiness', '{"a":2}', 'c2')

    expect(r1.promise).not.toBe(r2.promise)
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    await Promise.all([r1.promise, r2.promise])
  })

  it('two calls with different URLs create separate fetches', async () => {
    const r1 = deduplicatedFetch('/bff/cee/graph-readiness', '{"a":1}', 'c1')
    const r2 = deduplicatedFetch('/bff/cee/other-endpoint', '{"a":1}', 'c2')

    expect(r1.promise).not.toBe(r2.promise)
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    await Promise.all([r1.promise, r2.promise])
  })

  it('two concurrent callers both see error response without body stream error', async () => {
    fetchSpy.mockResolvedValue(
      new Response('Service unavailable', { status: 503, statusText: 'Service Unavailable' })
    )

    const r1 = deduplicatedFetch('/bff/cee/graph-readiness', '{"err":1}', 'c1')
    const r2 = deduplicatedFetch('/bff/cee/graph-readiness', '{"err":1}', 'c2')

    const [data1, data2] = await Promise.all([r1.promise, r2.promise])

    expect(data1.ok).toBe(false)
    expect(data1.status).toBe(503)
    expect(data1.errorBody).toBe('Service unavailable')

    expect(data2.ok).toBe(false)
    expect(data2.status).toBe(503)
    expect(data2.errorBody).toBe('Service unavailable')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('reused entry increments refCount', () => {
    const r1 = deduplicatedFetch('/bff/cee/graph-readiness', '{"a":1}', 'c1')
    expect(r1.entry.refCount).toBe(1)

    const r2 = deduplicatedFetch('/bff/cee/graph-readiness', '{"a":1}', 'c2')
    expect(r2.entry.refCount).toBe(2)
    expect(r1.entry).toBe(r2.entry) // same entry object
  })

  it('reuses in-flight request beyond 750ms dedup window', async () => {
    // Simulate a slow request that takes longer than DEDUP_WINDOW_MS (750ms)
    let resolveSlowFetch!: (res: Response) => void
    fetchSpy.mockImplementationOnce(() =>
      new Promise<Response>((resolve) => { resolveSlowFetch = resolve })
    )

    const r1 = deduplicatedFetch('/bff/cee/graph-readiness', '{"slow":1}', 'c1')

    // Advance time past the 750ms window while request is still in-flight
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000)

    const r2 = deduplicatedFetch('/bff/cee/graph-readiness', '{"slow":1}', 'c2')

    // Should reuse the in-flight request even though 1000ms > 750ms window
    expect(r2.isReused).toBe(true)
    expect(r1.promise).toBe(r2.promise)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Resolve the slow fetch and verify both consumers get the result
    resolveSlowFetch(makeOkResponse())
    const [data1, data2] = await Promise.all([r1.promise, r2.promise])
    expect(data1.ok).toBe(true)
    expect(data2.ok).toBe(true)

    vi.spyOn(Date, 'now').mockRestore()
  })
})

describe('releaseInflightEntry', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response('{}', { status: 200 }))
    )
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('decrements refCount without aborting when other consumers remain', () => {
    const r1 = deduplicatedFetch('/bff/cee/graph-readiness', '{"a":1}', 'c1')
    deduplicatedFetch('/bff/cee/graph-readiness', '{"a":1}', 'c2') // refCount = 2

    const abortSpy = vi.spyOn(r1.entry.controller, 'abort')

    releaseInflightEntry(r1.entry)
    expect(r1.entry.refCount).toBe(1)
    expect(abortSpy).not.toHaveBeenCalled()
  })

  it('aborts when last consumer releases (refCount drops to 0)', () => {
    const r1 = deduplicatedFetch('/bff/cee/graph-readiness', '{"a":1}', 'c1')
    const abortSpy = vi.spyOn(r1.entry.controller, 'abort')

    releaseInflightEntry(r1.entry)
    expect(r1.entry.refCount).toBe(0)
    expect(abortSpy).toHaveBeenCalledTimes(1)
  })

  it('handles null gracefully', () => {
    expect(() => releaseInflightEntry(null)).not.toThrow()
  })
})

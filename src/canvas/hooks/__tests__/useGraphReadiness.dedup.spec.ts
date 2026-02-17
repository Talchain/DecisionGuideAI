/**
 * useGraphReadiness — module-level dedup cache tests
 *
 * Validates that deduplicatedFetch reuses in-flight requests for identical
 * payloads within the 250ms window and that refCount prevents premature abort.
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

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        readiness_score: 75,
        readiness_level: 'strong',
        can_run_analysis: true,
        confidence_explanation: 'Good',
        improvements: [],
      }), { status: 200 })
    )
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

    expect(r1.promise).toBe(r2.promise) // same promise object
    expect(r2.isReused).toBe(true)
    expect(r1.isReused).toBe(false)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    await r1.promise
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

  it('reused entry increments refCount', () => {
    const r1 = deduplicatedFetch('/bff/cee/graph-readiness', '{"a":1}', 'c1')
    expect(r1.entry.refCount).toBe(1)

    const r2 = deduplicatedFetch('/bff/cee/graph-readiness', '{"a":1}', 'c2')
    expect(r2.entry.refCount).toBe(2)
    expect(r1.entry).toBe(r2.entry) // same entry object
  })
})

describe('releaseInflightEntry', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
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

/**
 * fetchLimits body-stall timeout — the abort timer must stay armed until the
 * response BODY has been read, not just until the headers arrive.
 *
 * Sibling of the runV2 defect fixed in #367. `await fetch(...)` resolves as
 * soon as the HEADERS land, but fetchLimits cleared the abort timer at exactly
 * that point, leaving the `await response.json()` below unprotected. A
 * headers-then-body stall (the Netlify-edge hang class this project has hit
 * before) left the returned promise pending FOREVER — and because every caller
 * awaits fetchLimits before it can size the graph-capacity guard, that wedges
 * the caller with no escape.
 *
 * Error semantics preserved: fetchLimits NEVER throws. Its documented contract
 * is "falls back to defaults if fetch fails", so a stalled body must RESOLVE to
 * the same defaults object a headers-phase timeout already produces — it must
 * not start rejecting.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchLimits, clearLimitsCache } from '../limits'

const TIMEOUT_MS = 5000

/** The defaults fetchLimits falls back to — its existing timeout semantics. */
const FALLBACK = {
  schema: 'limits.v1',
  max_nodes: 50,
  max_edges: 100,
  max_body_kb: 96,
  rate_limit_rpm: 60,
  flags: { scm_lite: 1 },
}

/**
 * A fetch that resolves HEADERS immediately but whose body read never settles
 * on its own — it settles only if the caller's AbortSignal fires, exactly as a
 * real fetch behaves when the connection stalls mid-body.
 */
function stallingBodyFetch(status = 200) {
  return vi.fn((_url: string, init?: { signal?: AbortSignal }) => {
    const signal = init?.signal
    const stalledBody = new Promise<never>((_resolve, reject) => {
      signal?.addEventListener('abort', () => {
        const err = new Error('The operation was aborted.')
        err.name = 'AbortError'
        reject(err)
      })
    })
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: 'OK',
      headers: new Headers(),
      json: () => stalledBody,
      text: () => stalledBody,
    })
  })
}

/** Track settlement without awaiting, so a genuine hang fails loudly instead of timing the runner out. */
function track<T>(p: Promise<T>) {
  const state = {
    settled: 'pending' as 'pending' | 'resolved' | 'rejected',
    value: undefined as unknown,
    error: undefined as unknown,
  }
  const done = p.then(
    (v) => { state.settled = 'resolved'; state.value = v },
    (e) => { state.settled = 'rejected'; state.error = e },
  )
  return { state, done }
}

let originalFetch: typeof globalThis.fetch

beforeEach(() => {
  originalFetch = globalThis.fetch
  clearLimitsCache()
  sessionStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('fetchLimits — a stalled response body must not wedge the caller forever', () => {
  it('falls back to defaults when headers arrive but the body never settles', async () => {
    globalThis.fetch = stallingBodyFetch(200) as unknown as typeof globalThis.fetch

    const { state, done } = track(fetchLimits())

    // Nothing should have settled before the timeout elapses.
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1)
    expect(state.settled).toBe('pending')

    // Once the timeout fires, the armed abort must tear the body read down and
    // the existing catch must return the documented defaults.
    // Asserted BEFORE awaiting `done` so an unprotected body read fails here
    // deterministically instead of hanging until the runner's own timeout.
    await vi.advanceTimersByTimeAsync(2)
    expect(state.settled).toBe('resolved')
    expect(state.value).toEqual(FALLBACK)
    await done
  })

  it('does not cache the fallback produced by a stalled body', async () => {
    globalThis.fetch = stallingBodyFetch(200) as unknown as typeof globalThis.fetch

    const { done } = track(fetchLimits())
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 1)
    await done

    // A timed-out run must not poison the 1-hour cache with defaults.
    expect(sessionStorage.getItem('plot_limits_cache')).toBeNull()
  })

  it('a normal fetch still resolves and does not leave the abort timer pending', async () => {
    const payload = {
      schema: 'limits.v1',
      max_nodes: 50,
      max_edges: 200,
      max_body_kb: 96,
      rate_limit_rpm: 60,
    }
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: () => Promise.resolve(payload),
      }),
    ) as unknown as typeof globalThis.fetch

    const { state, done } = track(fetchLimits())
    await vi.advanceTimersByTimeAsync(0)
    await done

    expect(state.settled).toBe('resolved')
    expect(state.value).toEqual(payload)
    // The timer was cleared on the success path — nothing left to fire.
    expect(vi.getTimerCount()).toBe(0)
  })
})

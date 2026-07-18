/**
 * runV2 body-stall timeout — the abort timer must stay armed until the
 * response BODY has been read, not just until the headers arrive.
 *
 * The adapter used to `clearTimeout(timeoutId)` immediately after `await
 * fetch(...)` resolved — i.e. as soon as headers landed. The subsequent
 * `await response.json()` was therefore unprotected, so a headers-then-body
 * stall (the Netlify-edge hang class this project has hit before) left the
 * returned promise pending FOREVER: useV2Run's catch/finally never ran,
 * `results.status` stayed 'preparing'/'connecting', and the Compare tab and
 * coaching panel showed a run cover indefinitely with no escape control.
 *
 * clearTimeout now lives in a `finally`, so the timer survives the body read
 * and a stalled body surfaces as the same 'V2 run request timed out' error
 * that a headers-phase timeout already produced.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runV2 } from '../adapter'
import type { V2AdapterConfig } from '../adapter'
import type { V2RunRequest } from '../types'

const TIMEOUT_MS = 5000

const config: V2AdapterConfig = { baseUrl: 'http://plot.test', timeout: TIMEOUT_MS }

const request = {
  request_id: 'req-body-stall',
  nodes: [],
  edges: [],
  options: [],
} as unknown as V2RunRequest

/**
 * A fetch that resolves HEADERS immediately but whose body read never
 * settles on its own — it settles only if the caller's AbortSignal fires,
 * exactly as a real fetch behaves when the connection stalls mid-body.
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
      clone: () => ({ text: () => stalledBody }),
      json: () => stalledBody,
      text: () => stalledBody,
    })
  })
}

/** Track settlement without awaiting, so a genuine hang fails loudly instead of timing the runner out. */
function track<T>(p: Promise<T>) {
  const state = { settled: 'pending' as 'pending' | 'resolved' | 'rejected', error: undefined as unknown }
  const done = p.then(
    () => { state.settled = 'resolved' },
    (e) => { state.settled = 'rejected'; state.error = e },
  )
  return { state, done }
}

let originalFetch: typeof globalThis.fetch

beforeEach(() => {
  originalFetch = globalThis.fetch
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('runV2 — a stalled response body must not wedge the run forever', () => {
  it('rejects with the timeout error when headers arrive but the body never settles', async () => {
    globalThis.fetch = stallingBodyFetch(200) as unknown as typeof globalThis.fetch

    const { state, done } = track(runV2(config, request))

    // Nothing should have settled before the timeout elapses.
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1)
    expect(state.settled).toBe('pending')

    // Once the timeout fires, the armed abort must tear the body read down.
    // Asserted BEFORE awaiting `done` so an unprotected body read fails here
    // deterministically instead of hanging until the runner's own timeout.
    await vi.advanceTimersByTimeAsync(2)
    expect(state.settled).toBe('rejected')
    expect((state.error as Error).message).toBe('V2 run request timed out')
    await done
  })

  it('rejects with the timeout error when a 422 error body stalls', async () => {
    // The 422 branch reads the body too — it must be protected identically.
    globalThis.fetch = stallingBodyFetch(422) as unknown as typeof globalThis.fetch

    const { state, done } = track(runV2(config, request))

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 1)
    expect(state.settled).toBe('rejected')
    expect((state.error as Error).message).toBe('V2 run request timed out')
    await done
  })

  it('a normal run still resolves and does not leave the abort timer pending', async () => {
    const payload = { status: 'ok', results: [] }
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        clone: () => ({ text: () => Promise.resolve('') }),
        json: () => Promise.resolve(payload),
      }),
    ) as unknown as typeof globalThis.fetch

    const { state, done } = track(runV2(config, request))
    await vi.advanceTimersByTimeAsync(0)
    await done

    expect(state.settled).toBe('resolved')
    // The timer was cleared on the success path — nothing left to fire.
    expect(vi.getTimerCount()).toBe(0)
  })
})

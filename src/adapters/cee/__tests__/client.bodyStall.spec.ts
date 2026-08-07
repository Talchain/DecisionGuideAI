/**
 * CEEClient body-stall timeout — the abort timer must stay armed until the
 * response BODY has been read, not just until the headers arrive.
 *
 * Sibling of the runV2 defect fixed in #367. `await fetch(...)` resolves as
 * soon as the HEADERS land, but fetchWithBase cleared the abort timer at
 * exactly that point, leaving both body reads below unprotected:
 *   - `await response.json().catch(...)` on the !ok branch, and
 *   - `await response.json()` on the success branch.
 *
 * A headers-then-body stall (the Netlify-edge hang class this project has hit
 * before) left the returned promise pending FOREVER. Every draft/coaching
 * surface awaits this client, so the canvas showed a pending state with no
 * escape control — the exact failure the F-67 headers-phase timeout was added
 * to prevent, reachable one phase later.
 *
 * Error semantics preserved: a timeout surfaces as
 * `CEEError('Request timeout', 408)` with the request's correlationId — the
 * exact shape the existing F-67 spec (client.timeout.spec.ts) already pins for
 * a headers-phase timeout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CEEClient, CEEError } from '../client'

// Default CEE timeout (DEFAULT_CEE_TIMEOUT); /bias-check is not in ENDPOINT_TIMEOUTS.
const TIMEOUT_MS = 150_000

// Avoid crypto.subtle requirement in the test env; mirrors client.timeout.spec.ts.
vi.mock('../../../lib/observability-headers', () => ({
  withObservabilityHeaders: vi.fn(async (_url: string, _method: string, _body: unknown, headers: Record<string, string>) => ({
    headers,
    startTime: Date.now(),
  })),
  recordBffResponse: vi.fn(),
  recordBffError: vi.fn(),
  recordBffResponsePayload: vi.fn(),
}))

vi.mock('../../../lib/gate-state', () => ({
  useGateStore: { getState: () => ({ setGate: vi.fn() }) },
}))

vi.mock('../../../lib/api-schemas', () => ({
  CEEDraftResponseSchema: {},
  warnOnInvalidApiResponse: vi.fn(),
}))

// Passthrough: this spec pins fetchWithBase's timer, not the retry policy.
vi.mock('../../../lib/fetchWithRetry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

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

const graph = { nodes: [{ id: 'a', label: 'A', type: 'factor' }], edges: [] }

let originalFetch: typeof globalThis.fetch
const originalListeners: ((...args: never[]) => void)[] = []

beforeEach(() => {
  originalFetch = globalThis.fetch
  vi.useFakeTimers()
  // Suppress unhandled-rejection noise from the abort listener firing after the
  // test body completes; mirrors the existing F-67 timeout spec.
  originalListeners.push(...(process.listeners('unhandledRejection') as never[]))
  process.removeAllListeners('unhandledRejection')
  process.on('unhandledRejection', () => {})
})

afterEach(() => {
  vi.useRealTimers()
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
  process.removeAllListeners('unhandledRejection')
  originalListeners.forEach((l) => process.on('unhandledRejection', l as never))
  originalListeners.length = 0
})

describe('CEEClient — a stalled response body must not wedge the request forever', () => {
  it('rejects with CEEError 408 when headers arrive but the body never settles', async () => {
    globalThis.fetch = stallingBodyFetch(200) as unknown as typeof globalThis.fetch

    const client = new CEEClient()
    const { state, done } = track(client.biasCheck(graph))

    // Nothing should have settled before the timeout elapses.
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1)
    expect(state.settled).toBe('pending')

    // Once the timeout fires, the armed abort must tear the body read down and
    // the existing catch must map it to the client's typed timeout error.
    // Asserted BEFORE awaiting `done` so an unprotected body read fails here
    // deterministically instead of hanging until the runner's own timeout.
    await vi.advanceTimersByTimeAsync(2)
    expect(state.settled).toBe('rejected')
    expect(state.error).toBeInstanceOf(CEEError)
    expect((state.error as CEEError).status).toBe(408)
    expect((state.error as CEEError).message).toBe('Request timeout')
    await done
  })

  it('settles rather than hanging when an HTTP-error body stalls', async () => {
    // The !ok branch reads the body too — it must be protected identically.
    // Its error semantics differ from the success branch and are preserved
    // as-is: `response.json().catch(() => ({}))` deliberately tolerates an
    // unreadable error body, so the mid-body AbortError is swallowed there and
    // the client reports the REAL HTTP status rather than 408. That is correct
    // — the server did return 500; only its explanatory body was unreadable.
    // What this pin asserts is the defect being fixed: it SETTLES.
    globalThis.fetch = stallingBodyFetch(500) as unknown as typeof globalThis.fetch

    const client = new CEEClient()
    const { state, done } = track(client.biasCheck(graph))

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 1)
    expect(state.settled).toBe('rejected')
    expect(state.error).toBeInstanceOf(CEEError)
    expect((state.error as CEEError).status).toBe(500)
    expect((state.error as CEEError).message).toBe('Request failed: 500')
    await done
  })

  it('a normal request still resolves and does not leave the abort timer pending', async () => {
    const payload = { biases: [] }
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: () => Promise.resolve(payload),
      }),
    ) as unknown as typeof globalThis.fetch

    const client = new CEEClient()
    const { state, done } = track(client.biasCheck(graph))
    await vi.advanceTimersByTimeAsync(0)
    await done

    expect(state.settled).toBe('resolved')
    expect(state.value).toEqual(payload)
    // The timer was cleared on the success path — nothing left to fire.
    expect(vi.getTimerCount()).toBe(0)
  })
})

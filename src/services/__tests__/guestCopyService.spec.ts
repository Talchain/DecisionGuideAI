/**
 * ACCOUNTS B3 — the client of CEE #2493's frozen copy contract.
 *
 * The rows that matter most are the 404 PAIR: only a 404 naming
 * `scenario_not_copyable` is terminal. A bare 404 (the edge allow-list or a CEE
 * deploy without the route) must stay retryable, or the caller forgets the guest
 * id and the guest's work never reaches the account.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { GUEST_COPY_TIMEOUT_MS, requestGuestCopy } from '../guestCopyService'

const SOURCE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const COPY = '3b241101-e2bb-4255-8caf-4136c566a962'
const TOKEN = 'eyJ.header.sig'

function respond(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': typeof body === 'string' ? 'text/html' : 'application/json' },
    }),
  )
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('requestGuestCopy — request shape', () => {
  it('POSTs to the same-origin seam with the bearer token and NO body (the owner is the token, never a field)', async () => {
    const fetchSpy = respond(200, { scenario_id: COPY, created: true })
    vi.stubGlobal('fetch', fetchSpy)

    await requestGuestCopy(SOURCE, TOKEN)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`/bff/cee/scenarios/${SOURCE}/copy`)
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
    expect(init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` })
  })
})

describe('requestGuestCopy — outcomes', () => {
  it('200 → copied, carrying the NEW id and created:true', async () => {
    vi.stubGlobal('fetch', respond(200, { scenario_id: COPY, created: true }))
    await expect(requestGuestCopy(SOURCE, TOKEN)).resolves.toEqual({ kind: 'copied', scenarioId: COPY, created: true })
  })

  it('200 replay → copied with created:false (the same copy, not a second one)', async () => {
    vi.stubGlobal('fetch', respond(200, { scenario_id: COPY, created: false }))
    await expect(requestGuestCopy(SOURCE, TOKEN)).resolves.toEqual({ kind: 'copied', scenarioId: COPY, created: false })
  })

  it.each([
    ['no scenario_id', { created: true }],
    ['a non-UUID scenario_id', { scenario_id: 'nope', created: true }],
    ['the SOURCE id echoed back', { scenario_id: SOURCE, created: true }],
    ['the SOURCE id echoed back in upper case', { scenario_id: SOURCE.toUpperCase(), created: true }],
    ['no created flag', { scenario_id: COPY }],
    ['a non-boolean created', { scenario_id: COPY, created: 'yes' }],
  ])('200 with %s is NOT a copy → retry_later', async (_label, body) => {
    vi.stubGlobal('fetch', respond(200, body))
    await expect(requestGuestCopy(SOURCE, TOKEN)).resolves.toEqual({ kind: 'retry_later', reason: 'malformed_response' })
  })

  it('404 scenario_not_copyable → not_copyable (terminal)', async () => {
    vi.stubGlobal('fetch', respond(404, { error: 'scenario_not_copyable', code: 'scenario_not_copyable', message: 'x', request_id: 'r' }))
    await expect(requestGuestCopy(SOURCE, TOKEN)).resolves.toEqual({ kind: 'not_copyable' })
  })

  it('CONTRAST: a 404 WITHOUT that code (route not deployed / edge page) → retry_later, never terminal', async () => {
    vi.stubGlobal('fetch', respond(404, '<html>Not Found</html>'))
    await expect(requestGuestCopy(SOURCE, TOKEN)).resolves.toEqual({ kind: 'retry_later', reason: 'http_404' })

    vi.stubGlobal('fetch', respond(404, { error: 'not_found', code: 'not_found' }))
    await expect(requestGuestCopy(SOURCE, TOKEN)).resolves.toEqual({ kind: 'retry_later', reason: 'not_found' })
  })

  it.each([
    [401, 'sign_in_required'],
    [429, 'rate_limited'],
    [503, 'copy_unavailable'],
    [500, 'internal'],
  ])('%i %s → retry_later (the id is kept)', async (status, code) => {
    vi.stubGlobal('fetch', respond(status, { error: code, code }))
    await expect(requestGuestCopy(SOURCE, TOKEN)).resolves.toEqual({ kind: 'retry_later', reason: code })
  })

  it('a network failure → retry_later, and it never throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(requestGuestCopy(SOURCE, TOKEN)).resolves.toEqual({ kind: 'retry_later', reason: 'network_error' })
  })

  it('a hung edge is bounded → retry_later timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      }),
    ))
    const pending = requestGuestCopy(SOURCE, TOKEN)
    await vi.advanceTimersByTimeAsync(GUEST_COPY_TIMEOUT_MS)
    await expect(pending).resolves.toEqual({ kind: 'retry_later', reason: 'timeout' })
  })

  it('a STALLED BODY is bounded too (headers arrived, json never settles) → retry_later timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => ({
      status: 200,
      json: () => new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      }),
    })))
    const pending = requestGuestCopy(SOURCE, TOKEN)
    await vi.advanceTimersByTimeAsync(GUEST_COPY_TIMEOUT_MS)
    await expect(pending).resolves.toEqual({ kind: 'retry_later', reason: 'timeout' })
  })
})

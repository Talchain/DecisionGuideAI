/**
 * plotFetch — unit pins for the one PLoT-direct fetch wrapper.
 *
 * Asserts the two behaviours the flip depends on:
 *   · PRESENCE — with VITE_PLOT_BEARER set, the outgoing request carries
 *     `Authorization: Bearer <token>`, merged over the caller's own headers.
 *   · ABSENCE (fail-safe) — with it unset, the call is forwarded to the global
 *     `fetch` UNTOUCHED: no Authorization header, and the very `init` reference
 *     the caller passed reaches `fetch` unchanged (byte-for-byte identical to a
 *     bare fetch).
 *
 * The global `fetch` is stubbed and the assertion is on what actually reached
 * it — the same technique the two #428 seam specs use.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { plotFetch } from '../plotFetch'

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function initOfFirstCall(): RequestInit | undefined {
  return fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
}
function headersOfFirstCall(): Record<string, string> {
  return (initOfFirstCall()?.headers ?? {}) as Record<string, string>
}

describe('plotFetch', () => {
  it('merges Authorization: Bearer <token> when VITE_PLOT_BEARER is set', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-123')

    await plotFetch('/bff/engine/v1/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstCall()).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer staging-token-123',
    })
  })

  it('passes the URL through unchanged regardless of which PLoT base was used', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-123')

    await plotFetch('https://plot-lite-service-staging.onrender.com/v2/run', { method: 'POST' })

    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://plot-lite-service-staging.onrender.com/v2/run')
    expect(headersOfFirstCall().Authorization).toBe('Bearer staging-token-123')
  })

  it('attaches NO Authorization header when VITE_PLOT_BEARER is unset (fail-safe)', async () => {
    await plotFetch('/bff/engine/v1/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstCall()).not.toHaveProperty('Authorization')
  })

  it('forwards the exact same init reference untouched when the token is absent', async () => {
    const init: RequestInit = { method: 'POST', headers: { 'X-Foo': 'bar' } }

    await plotFetch('/bff/engine/v1/run', init)

    // Byte-for-byte identical to a bare fetch: not cloned, not re-shaped.
    expect(initOfFirstCall()).toBe(init)
  })

  it('works with no init at all (token absent → bare forward)', async () => {
    await plotFetch('/bff/engine/v1/health')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/bff/engine/v1/health')
    expect(initOfFirstCall()).toBeUndefined()
  })

  it('merges the Bearer even when the caller passed no headers (token present)', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-123')

    await plotFetch('/bff/engine/v1/health', { cache: 'no-store' })

    expect(headersOfFirstCall().Authorization).toBe('Bearer staging-token-123')
    // Non-header init survives the merge.
    expect(initOfFirstCall()?.cache).toBe('no-store')
  })

  it('normalises a Headers-instance init and still injects the Bearer (defensive arm)', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-123')

    await plotFetch('/bff/engine/v1/run', {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
    })

    expect(headersOfFirstCall()).toMatchObject({
      'content-type': 'application/json',
      Authorization: 'Bearer staging-token-123',
    })
  })

  it('the injected Bearer wins over a stale caller-supplied Authorization', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'fresh-token')

    await plotFetch('/bff/engine/v1/run', {
      headers: { Authorization: 'Bearer stale' },
    })

    expect(headersOfFirstCall().Authorization).toBe('Bearer fresh-token')
  })
})

/**
 * F5 hardening (defense-in-depth):
 *   (a) ORIGIN GUARD — with the Bearer present, a request whose resolved origin
 *       is not same-origin or the configured PLoT base is REJECTED pre-flight
 *       (thrown before `fetch`), so the token can never ride to a foreign origin.
 *       When the token is ABSENT (fail-safe) the guard is inert — the request
 *       forwards untouched, exactly as a bare fetch would.
 *   (b) REQUEST-OBJECT HEADERS — when the caller passes a Request object, its own
 *       headers survive the merge alongside the injected Bearer (the pre-fix path
 *       replaced them with the init.headers object and dropped them).
 */
describe('plotFetch — F5 hardening', () => {
  describe('(a) origin guard: the Bearer never rides to a foreign origin', () => {
    it('THROWS pre-flight for a foreign origin and never calls fetch (token present)', () => {
      vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-123')

      expect(() =>
        plotFetch('https://evil.example.com/steal', { method: 'POST' }),
      ).toThrow(/origin/i)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('rejects a look-alike host that merely embeds the PLoT marker', () => {
      vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-123')

      expect(() =>
        plotFetch('https://plot-lite-service.evil.com/v2/run'),
      ).toThrow(/origin/i)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('rejects a protocol-relative URL to a foreign host', () => {
      vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-123')

      expect(() => plotFetch('//evil.example.com/steal')).toThrow(/origin/i)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('ALLOWS a same-origin relative path (token present)', async () => {
      vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-123')

      await plotFetch('/bff/engine/v1/run', { method: 'POST' })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(headersOfFirstCall().Authorization).toBe('Bearer staging-token-123')
    })

    it('ALLOWS the canonical PLoT staging host (token present)', async () => {
      vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-123')

      await plotFetch('https://plot-lite-service-staging.onrender.com/v2/run')

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(headersOfFirstCall().Authorization).toBe('Bearer staging-token-123')
    })

    it('ALLOWS an absolute origin that matches the configured PLoT base env', async () => {
      vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-123')
      vi.stubEnv('VITE_PLOT_PROXY_BASE', 'https://plot.internal.example.test')

      await plotFetch('https://plot.internal.example.test/v1/run', { method: 'POST' })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(headersOfFirstCall().Authorization).toBe('Bearer staging-token-123')
    })

    it('does NOT guard the fail-safe path: a foreign origin forwards untouched when the token is absent', async () => {
      // No Bearer to leak → the request is a bare, byte-identical forward. The
      // guard must not change today's behaviour before the token is provisioned.
      const init: RequestInit = { method: 'POST' }
      await plotFetch('https://evil.example.com/whatever', init)

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://evil.example.com/whatever')
      expect(initOfFirstCall()).toBe(init)
      expect(headersOfFirstCall()).not.toHaveProperty('Authorization')
    })
  })

  describe('(b) Request-object input: original headers survive alongside the Bearer', () => {
    it('merges the Request object’s own headers AND the injected Bearer', async () => {
      vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-123')

      // Absolute same-origin URL: jsdom's Request does not resolve relative URLs.
      const req = new Request(`${location.origin}/bff/engine/v1/run`, {
        method: 'POST',
        headers: { 'X-Trace': 'abc', 'Content-Type': 'application/json' },
      })
      await plotFetch(req)

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const headers = headersOfFirstCall()
      // Both the Request's own headers AND the Bearer are present (pre-fix the
      // Request headers were dropped when init.headers was set).
      expect(headers['x-trace']).toBe('abc')
      expect(headers['content-type']).toBe('application/json')
      expect(headers.Authorization).toBe('Bearer staging-token-123')
    })

    it('init.headers override the Request’s headers, and the Bearer overrides a stale Authorization case-insensitively', async () => {
      vi.stubEnv('VITE_PLOT_BEARER', 'fresh-token')

      // The Request carries a stale, LOWERCASE authorization (jsdom lowercases a
      // Request's header names). The injected capitalised Authorization must
      // replace it — not coexist as a second key that fetch would combine.
      const req = new Request(`${location.origin}/bff/engine/v1/run`, {
        headers: { 'x-both': 'from-request', 'x-req': 'req', authorization: 'Bearer stale' },
      })
      await plotFetch(req, { headers: { 'x-both': 'from-init', 'x-init': 'init' } })

      const headers = headersOfFirstCall()
      expect(headers['x-req']).toBe('req') // survives from the Request
      expect(headers['x-init']).toBe('init') // added by init
      expect(headers['x-both']).toBe('from-init') // init wins over the Request
      expect(headers.Authorization).toBe('Bearer fresh-token') // Bearer wins over all
      // The stale lowercase authorization must NOT survive alongside the Bearer.
      expect(headers.authorization).toBeUndefined()
    })

    it('a Request object to a foreign origin is rejected pre-flight (token present)', () => {
      vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-123')

      const req = new Request('https://evil.example.com/steal')
      expect(() => plotFetch(req)).toThrow(/origin/i)
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})

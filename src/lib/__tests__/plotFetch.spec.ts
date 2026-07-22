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

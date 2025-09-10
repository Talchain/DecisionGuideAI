import { describe, it, expect, vi } from 'vitest'
import { fetchWithTimeout, TimeoutError, withTimeout } from '@/lib/network'

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

describe('network utilities', () => {
  it('fetchWithTimeout returns response when fetch resolves before timeout', async () => {
    const originalFetch = globalThis.fetch
    const mock = vi
      .spyOn(globalThis as any, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }))

    try {
      const res = await fetchWithTimeout('https://example.com', {}, 50)
      expect(res.ok).toBe(true)
      const text = await res.text()
      expect(text).toBe('ok')
    } finally {
      mock.mockRestore()
      globalThis.fetch = originalFetch
    }
  })

  it('fetchWithTimeout throws TimeoutError when fetch takes too long', async () => {
    const originalFetch = globalThis.fetch
    const mock = vi
      .spyOn(globalThis as any, 'fetch')
      .mockImplementation(async (..._args: unknown[]) => {
        await delay(200)
        return new Response('late', { status: 200 })
      })

    try {
      await expect(fetchWithTimeout('https://example.com', {}, 50)).rejects.toBeInstanceOf(TimeoutError)
    } finally {
      mock.mockRestore()
      globalThis.fetch = originalFetch
    }
  })

  it('withTimeout resolves when underlying promise resolves in time', async () => {
    const result = await withTimeout(async (_signal) => {
      await delay(10)
      return 42
    }, 50)
    expect(result).toBe(42)
  })

  it('withTimeout throws TimeoutError when underlying promise exceeds timeout', async () => {
    await expect(
      withTimeout(async (_signal) => {
        await delay(200)
        return 'done'
      }, 50)
    ).rejects.toBeInstanceOf(TimeoutError)
  })
})

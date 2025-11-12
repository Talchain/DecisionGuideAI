/**
 * M1.1: Health Probe Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { probeHealth } from '../health'

describe('probeHealth (M1.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('returns "healthy" when HEAD /v1/run returns 204', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 204,
      ok: true,
    } as Response)

    const result = await probeHealth()

    expect(result).toBe('healthy')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/run'),
      expect.objectContaining({ method: 'HEAD' })
    )
  })

  it('returns "unhealthy" when HEAD /v1/run returns non-204', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 405,
      ok: false,
    } as Response)

    const result = await probeHealth()

    expect(result).toBe('unhealthy')
  })

  it('returns "unhealthy" on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    const result = await probeHealth()

    expect(result).toBe('unhealthy')
  })

  it('returns "unhealthy" on timeout', async () => {
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 6000)
        })
    )

    const result = await probeHealth()

    expect(result).toBe('unhealthy')
  }, 10000) // 10s timeout for this test
})

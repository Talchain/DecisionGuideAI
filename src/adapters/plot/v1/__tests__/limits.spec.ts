/**
 * M1.2: Limits Fetching Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchLimits, clearLimitsCache } from '../limits'
import type { V1LimitsResponse } from '../types'

describe('fetchLimits (M1.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearLimitsCache()
    sessionStorage.clear()
    global.fetch = vi.fn()
  })

  it('fetches and parses limits.v1 format', async () => {
    const mockLimits: V1LimitsResponse = {
      schema: 'limits.v1',
      max_nodes: 50,
      max_edges: 200,
      max_body_kb: 96,
      rate_limit_rpm: 60,
      flags: { scm_lite: 1 },
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLimits,
    } as Response)

    const limits = await fetchLimits()

    expect(limits).toEqual(mockLimits)
    expect(limits.max_nodes).toBe(50)
    expect(limits.max_edges).toBe(200)
    expect(limits.max_body_kb).toBe(96)
  })

  it('caches limits for 1 hour', async () => {
    const mockLimits: V1LimitsResponse = {
      schema: 'limits.v1',
      max_nodes: 50,
      max_edges: 200,
      max_body_kb: 96,
      rate_limit_rpm: 60,
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLimits,
    } as Response)

    // First fetch
    await fetchLimits()
    expect(fetch).toHaveBeenCalledTimes(1)

    // Second fetch should use cache
    await fetchLimits()
    expect(fetch).toHaveBeenCalledTimes(1) // Still 1, cached
  })

  it('returns defaults on fetch failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    const limits = await fetchLimits()

    expect(limits.max_nodes).toBe(50)
    expect(limits.max_edges).toBe(200)
    expect(limits.max_body_kb).toBe(96)
  })
})

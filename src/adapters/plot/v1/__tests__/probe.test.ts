/**
 * Tests for PLoT v1 capability probe
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { probeCapability, PROBE_CACHE_KEY, clearProbeCache } from '../probe'

describe('v1/probe', () => {
  const originalFetch = global.fetch
  const mockFetch = vi.fn()

  beforeEach(() => {
    global.fetch = mockFetch as any
    // Clear cache before each test
    clearProbeCache()
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.clearAllMocks()
  })

  describe('probeCapability', () => {
    it('should use custom base URL when provided', async () => {
      // Mock successful health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      })

      // Mock successful v1/run OPTIONS request (CORS preflight)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      })

      const customBase = 'https://custom.example.com/api'
      await probeCapability(customBase)

      // Verify fetch was called with custom base
      expect(mockFetch).toHaveBeenCalledWith(
        `${customBase}/v1/health`,
        expect.objectContaining({ method: 'GET' })
      )
      expect(mockFetch).toHaveBeenCalledWith(
        `${customBase}/v1/run`,
        expect.objectContaining({ method: 'OPTIONS' })
      )
    })

    it('should use VITE_PLOT_PROXY_BASE env var when no base provided', async () => {
      // Mock env variable
      const customProxyBase = '/custom/proxy/path'
      vi.stubEnv('VITE_PLOT_PROXY_BASE', customProxyBase)

      // Mock successful health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      })

      // Mock successful v1/run OPTIONS request (CORS preflight)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      })

      await probeCapability()

      // Verify fetch was called with env var base
      expect(mockFetch).toHaveBeenCalledWith(
        `${customProxyBase}/v1/health`,
        expect.objectContaining({ method: 'GET' })
      )
      expect(mockFetch).toHaveBeenCalledWith(
        `${customProxyBase}/v1/run`,
        expect.objectContaining({ method: 'OPTIONS' })
      )

      vi.unstubAllEnvs()
    })

    it('should default to /api/plot when no base or env var provided', async () => {
      // Ensure no env var is set
      vi.unstubAllEnvs()

      // Mock successful health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      })

      // Mock successful v1/run OPTIONS request (CORS preflight)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      })

      await probeCapability()

      // Verify fetch was called with default base
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/plot/v1/health',
        expect.objectContaining({ method: 'GET' })
      )
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/plot/v1/run',
        expect.objectContaining({ method: 'OPTIONS' })
      )
    })

    it('should mark v1 as available when health and run checks pass', async () => {
      // Mock successful health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      })

      // Mock successful v1/run OPTIONS request (CORS preflight returns 204)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      })

      const result = await probeCapability('/test')

      expect(result.available).toBe(true)
      expect(result.healthStatus).toBe('ok')
      expect(result.endpoints.health).toBe(true)
      expect(result.endpoints.run).toBe(true)
      // Stream endpoint is NOT live yet (Oct 2025)
      expect(result.endpoints.stream).toBe(false)
    })

    it('should mark v1 as unavailable when health fails', async () => {
      // Mock failed health check
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await probeCapability('/test')

      expect(result.available).toBe(false)
      expect(result.healthStatus).toBe('down')
      expect(result.endpoints.health).toBe(false)
      expect(result.endpoints.run).toBe(false)
      expect(result.endpoints.stream).toBe(false)
    })

    it('should mark v1 as unavailable when run endpoint returns 404', async () => {
      // Mock successful health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      })

      // Mock 404 for v1/run HEAD request (no OPTIONS fallback anymore)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await probeCapability('/test')

      expect(result.available).toBe(false)
      expect(result.healthStatus).toBe('ok')
      expect(result.endpoints.health).toBe(true)
      expect(result.endpoints.run).toBe(false)
      expect(result.endpoints.stream).toBe(false)
    })
  })

  describe('PROBE_CACHE_KEY', () => {
    it('should export the cache key constant', () => {
      expect(PROBE_CACHE_KEY).toBe('plot_v1_capability_probe')
    })
  })
})

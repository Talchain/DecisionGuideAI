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
      // Mock successful health check - only one request now (no /v1/run probe)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      })

      const customBase = 'https://custom.example.com/api'
      await probeCapability(customBase)

      // Verify fetch was called with custom base for health check only
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        `${customBase}/v1/health`,
        expect.objectContaining({ method: 'GET' })
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

      await probeCapability()

      // Verify fetch was called with env var base
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        `${customProxyBase}/v1/health`,
        expect.objectContaining({ method: 'GET' })
      )

      vi.unstubAllEnvs()
    })

    it('should default to /bff/engine when no base or env var provided', async () => {
      // Explicitly stub env var as empty string to test actual default
      vi.stubEnv('VITE_PLOT_PROXY_BASE', '')

      // Mock successful health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      })

      await probeCapability()

      // Verify fetch was called with default base (/bff/engine)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        '/bff/engine/v1/health',
        expect.objectContaining({ method: 'GET' })
      )

      vi.unstubAllEnvs()
    })

    it('should mark v1 as available when health check passes', async () => {
      // Mock successful health check - run is trusted to be available
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      })

      const result = await probeCapability('/test')

      expect(result.available).toBe(true)
      expect(result.healthStatus).toBe('ok')
      expect(result.endpoints.health).toBe(true)
      // Run endpoint is trusted when health passes (no separate probe)
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

    it('should try fallback health endpoint when v1/health returns non-ok', async () => {
      // Mock failed v1/health
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      // Mock successful fallback /health
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      })

      const result = await probeCapability('/test')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        '/test/v1/health',
        expect.objectContaining({ method: 'GET' })
      )
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/test/health',
        expect.objectContaining({ method: 'GET' })
      )
      expect(result.available).toBe(true)
      expect(result.endpoints.health).toBe(true)
      expect(result.endpoints.run).toBe(true)
    })
  })

  describe('PROBE_CACHE_KEY', () => {
    it('should export the cache key constant', () => {
      expect(PROBE_CACHE_KEY).toBe('plot_v1_capability_probe')
    })
  })
})

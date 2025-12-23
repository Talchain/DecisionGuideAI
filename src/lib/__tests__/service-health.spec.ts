/**
 * Tests for service-health.ts
 *
 * Verifies:
 * - Health endpoint fetching
 * - Response parsing
 * - Caching behavior
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  fetchServiceHealth,
  getAllServiceHealth,
  getAllServiceHealthArray,
  getCachedHealth,
  _clearHealthCache,
  isAnyServiceDown,
  isAnyServiceDegraded,
  getOverallHealth,
  type ServiceName,
  type ServiceHealthInfo,
} from '../service-health'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('service-health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _clearHealthCache()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchServiceHealth', () => {
    it('fetches health from correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', version: '1.0.0' }),
      })

      await fetchServiceHealth('bff')

      expect(mockFetch).toHaveBeenCalledWith(
        '/bff/health',
        expect.objectContaining({
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
      )
    })

    it('returns healthy status for ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', version: 'v1.2.3' }),
      })

      const health = await fetchServiceHealth('cee')

      expect(health.name).toBe('cee')
      expect(health.status).toBe('healthy')
      expect(health.version).toBe('v1.2.3')
    })

    it('parses version from various response formats', async () => {
      // Test 'build' field
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', build: 'abc123' }),
      })
      const health1 = await fetchServiceHealth('cee', { skipCache: true })
      expect(health1.version).toBe('abc123')

      // Test 'release' field
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', release: '2.0.0' }),
      })
      const health2 = await fetchServiceHealth('isl', { skipCache: true })
      expect(health2.version).toBe('2.0.0')
    })

    it('parses commit from various response formats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', git_sha: 'def456' }),
      })
      const health = await fetchServiceHealth('plot', { skipCache: true })
      expect(health.commit).toBe('def456')
    })

    it('returns degraded status for 4xx response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      })

      const health = await fetchServiceHealth('bff')

      expect(health.status).toBe('degraded')
      expect(health.error).toBe('HTTP 400')
    })

    it('returns down status for 5xx response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      })

      const health = await fetchServiceHealth('bff')

      expect(health.status).toBe('down')
      expect(health.error).toBe('HTTP 503')
    })

    it('returns unknown status for network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const health = await fetchServiceHealth('bff')

      expect(health.status).toBe('unknown')
      expect(health.error).toBe('Network error')
    })

    it('includes responseTimeMs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      })

      const health = await fetchServiceHealth('bff')

      expect(health.responseTimeMs).toBeDefined()
      expect(health.responseTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('includes checkedAt timestamp', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      })

      const before = Date.now()
      const health = await fetchServiceHealth('bff')
      const after = Date.now()

      const checkedAt = new Date(health.checkedAt).getTime()
      expect(checkedAt).toBeGreaterThanOrEqual(before)
      expect(checkedAt).toBeLessThanOrEqual(after)
    })
  })

  describe('caching', () => {
    it('caches successful responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', version: '1.0.0' }),
      })

      await fetchServiceHealth('bff')
      await fetchServiceHealth('bff')

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('returns cached result on second call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', version: '1.0.0' }),
      })

      const health1 = await fetchServiceHealth('bff')
      const health2 = await fetchServiceHealth('bff')

      expect(health1).toEqual(health2)
    })

    it('skips cache when skipCache is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', version: '1.0.0' }),
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', version: '2.0.0' }),
      })

      await fetchServiceHealth('bff')
      const health2 = await fetchServiceHealth('bff', { skipCache: true })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(health2.version).toBe('2.0.0')
    })

    it('getCachedHealth returns cached data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', version: '1.0.0' }),
      })

      await fetchServiceHealth('bff')
      const cached = getCachedHealth('bff')

      expect(cached).not.toBeNull()
      expect(cached?.version).toBe('1.0.0')
    })

    it('getCachedHealth returns null for uncached service', () => {
      const cached = getCachedHealth('cee')
      expect(cached).toBeNull()
    })
  })

  describe('getAllServiceHealth', () => {
    it('fetches all services in parallel', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', version: '1.0.0' }),
      })

      const healthMap = await getAllServiceHealth()

      expect(healthMap.size).toBe(4)
      expect(healthMap.has('bff')).toBe(true)
      expect(healthMap.has('cee')).toBe(true)
      expect(healthMap.has('isl')).toBe(true)
      expect(healthMap.has('plot')).toBe(true)
    })

    it('handles mixed success and failure', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'ok' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'ok' }),
        })
        .mockRejectedValueOnce(new Error('Network error'))

      const healthMap = await getAllServiceHealth({ skipCache: true })

      expect(healthMap.size).toBe(4)
      // At least one should be down/unknown
      const statuses = Array.from(healthMap.values()).map((h) => h.status)
      expect(statuses).toContain('down')
    })
  })

  describe('getAllServiceHealthArray', () => {
    it('returns array of health info', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      })

      const healthArray = await getAllServiceHealthArray()

      expect(Array.isArray(healthArray)).toBe(true)
      expect(healthArray.length).toBe(4)
    })
  })

  describe('status helpers', () => {
    it('isAnyServiceDown returns true when service is down', () => {
      const healthMap = new Map<ServiceName, ServiceHealthInfo>([
        ['bff', { name: 'bff', status: 'healthy', checkedAt: new Date().toISOString() }],
        ['cee', { name: 'cee', status: 'down', checkedAt: new Date().toISOString() }],
      ])

      expect(isAnyServiceDown(healthMap)).toBe(true)
    })

    it('isAnyServiceDown returns false when all healthy', () => {
      const healthMap = new Map<ServiceName, ServiceHealthInfo>([
        ['bff', { name: 'bff', status: 'healthy', checkedAt: new Date().toISOString() }],
        ['cee', { name: 'cee', status: 'healthy', checkedAt: new Date().toISOString() }],
      ])

      expect(isAnyServiceDown(healthMap)).toBe(false)
    })

    it('isAnyServiceDegraded returns true when service is degraded', () => {
      const healthMap = new Map<ServiceName, ServiceHealthInfo>([
        ['bff', { name: 'bff', status: 'healthy', checkedAt: new Date().toISOString() }],
        ['cee', { name: 'cee', status: 'degraded', checkedAt: new Date().toISOString() }],
      ])

      expect(isAnyServiceDegraded(healthMap)).toBe(true)
    })

    it('getOverallHealth returns correct status', () => {
      // All healthy
      const healthyMap = new Map<ServiceName, ServiceHealthInfo>([
        ['bff', { name: 'bff', status: 'healthy', checkedAt: new Date().toISOString() }],
        ['cee', { name: 'cee', status: 'healthy', checkedAt: new Date().toISOString() }],
      ])
      expect(getOverallHealth(healthyMap)).toBe('healthy')

      // One degraded
      const degradedMap = new Map<ServiceName, ServiceHealthInfo>([
        ['bff', { name: 'bff', status: 'healthy', checkedAt: new Date().toISOString() }],
        ['cee', { name: 'cee', status: 'degraded', checkedAt: new Date().toISOString() }],
      ])
      expect(getOverallHealth(degradedMap)).toBe('degraded')

      // One down
      const downMap = new Map<ServiceName, ServiceHealthInfo>([
        ['bff', { name: 'bff', status: 'healthy', checkedAt: new Date().toISOString() }],
        ['cee', { name: 'cee', status: 'down', checkedAt: new Date().toISOString() }],
      ])
      expect(getOverallHealth(downMap)).toBe('down')

      // Unknown
      const unknownMap = new Map<ServiceName, ServiceHealthInfo>([
        ['bff', { name: 'bff', status: 'healthy', checkedAt: new Date().toISOString() }],
        ['cee', { name: 'cee', status: 'unknown', checkedAt: new Date().toISOString() }],
      ])
      expect(getOverallHealth(unknownMap)).toBe('unknown')
    })
  })

  describe('health status parsing', () => {
    it('parses "ok" as healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      })

      const health = await fetchServiceHealth('bff')
      expect(health.status).toBe('healthy')
    })

    it('parses "healthy" as healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      })

      const health = await fetchServiceHealth('bff', { skipCache: true })
      expect(health.status).toBe('healthy')
    })

    it('parses healthy: true as healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ healthy: true }),
      })

      const health = await fetchServiceHealth('bff', { skipCache: true })
      expect(health.status).toBe('healthy')
    })

    it('parses "degraded" as degraded', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'degraded' }),
      })

      const health = await fetchServiceHealth('bff', { skipCache: true })
      expect(health.status).toBe('degraded')
    })

    it('parses healthy: false as down', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ healthy: false }),
      })

      const health = await fetchServiceHealth('bff', { skipCache: true })
      expect(health.status).toBe('down')
    })
  })
})

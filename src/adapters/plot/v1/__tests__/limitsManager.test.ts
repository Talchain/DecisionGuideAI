/**
 * Unit tests for limitsManager singleton
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { limitsManager } from '../limitsManager'
import * as v1http from '../http'

// Mock the http module
vi.mock('../http', () => ({
  limits: vi.fn(),
}))

describe('limitsManager', () => {
  beforeEach(() => {
    // Reset singleton to static fallback before each test
    limitsManager.reset()
    vi.clearAllMocks()
  })

  describe('getLimits()', () => {
    it('should return static fallback before hydration', () => {
      const limits = limitsManager.getLimits()

      expect(limits).toEqual({
        nodes: { max: 200 },
        edges: { max: 500 },
        label: { max: 120 },
        body: { max: 2000 },
        rateLimit: { rpm: 60 },
      })
    })

    it('should return copy (not reference) to prevent mutation', () => {
      const limits1 = limitsManager.getLimits()
      const limits2 = limitsManager.getLimits()

      expect(limits1).not.toBe(limits2) // Different objects
      expect(limits1).toEqual(limits2) // Same values
    })
  })

  describe('isHydrated()', () => {
    it('should return false before hydration', () => {
      expect(limitsManager.isHydrated()).toBe(false)
    })

    it('should return true after successful hydration', async () => {
      vi.mocked(v1http.limits).mockResolvedValue({
        nodes: { max: 300 },
        edges: { max: 600 },
      })

      await limitsManager.hydrate()

      expect(limitsManager.isHydrated()).toBe(true)
    })

    it('should return false after failed hydration', async () => {
      vi.mocked(v1http.limits).mockRejectedValue(new Error('Network error'))

      await limitsManager.hydrate()

      expect(limitsManager.isHydrated()).toBe(false)
    })
  })

  describe('hydrate()', () => {
    it('should fetch limits from API and update singleton', async () => {
      vi.mocked(v1http.limits).mockResolvedValue({
        nodes: { max: 300 },
        edges: { max: 600 },
      })

      await limitsManager.hydrate()

      const limits = limitsManager.getLimits()
      expect(limits.nodes.max).toBe(300)
      expect(limits.edges.max).toBe(600)
      // Label/body/rateLimit should remain static fallback
      expect(limits.label.max).toBe(120)
      expect(limits.body.max).toBe(2000)
      expect(limits.rateLimit.rpm).toBe(60)
    })

    it('should gracefully degrade on API failure', async () => {
      vi.mocked(v1http.limits).mockRejectedValue(new Error('Network error'))

      await limitsManager.hydrate()

      const limits = limitsManager.getLimits()
      // Should still return static fallback
      expect(limits).toEqual({
        nodes: { max: 200 },
        edges: { max: 500 },
        label: { max: 120 },
        body: { max: 2000 },
        rateLimit: { rpm: 60 },
      })
    })

    it('should not throw on API failure (graceful degradation)', async () => {
      vi.mocked(v1http.limits).mockRejectedValue(new Error('Network error'))

      // Should not throw
      await expect(limitsManager.hydrate()).resolves.toBeUndefined()
    })

    it('should reuse in-flight hydration promise', async () => {
      let resolveCount = 0
      vi.mocked(v1http.limits).mockImplementation(async () => {
        resolveCount++
        return { nodes: { max: 300 }, edges: { max: 600 } }
      })

      // Call hydrate() twice simultaneously
      await Promise.all([limitsManager.hydrate(), limitsManager.hydrate()])

      // API should only be called once (promise reused)
      expect(resolveCount).toBe(1)
      expect(v1http.limits).toHaveBeenCalledTimes(1)
    })

    it('should refresh (not reuse promise) if already hydrated', async () => {
      let callCount = 0
      vi.mocked(v1http.limits).mockImplementation(async () => {
        callCount++
        return { nodes: { max: 300 + callCount * 10 }, edges: { max: 600 } }
      })

      // First hydration
      await limitsManager.hydrate()
      expect(limitsManager.getLimits().nodes.max).toBe(310)

      // Second hydration (should refresh)
      await limitsManager.hydrate()
      expect(limitsManager.getLimits().nodes.max).toBe(320)

      expect(callCount).toBe(2)
    })
  })

  describe('refresh()', () => {
    it('should force re-fetch from API', async () => {
      vi.mocked(v1http.limits)
        .mockResolvedValueOnce({ nodes: { max: 300 }, edges: { max: 600 } })
        .mockResolvedValueOnce({ nodes: { max: 400 }, edges: { max: 700 } })

      await limitsManager.hydrate()
      expect(limitsManager.getLimits().nodes.max).toBe(300)

      await limitsManager.refresh()
      expect(limitsManager.getLimits().nodes.max).toBe(400)

      expect(v1http.limits).toHaveBeenCalledTimes(2)
    })
  })

  describe('reset()', () => {
    it('should reset to static fallback', async () => {
      vi.mocked(v1http.limits).mockResolvedValue({
        nodes: { max: 300 },
        edges: { max: 600 },
      })

      await limitsManager.hydrate()
      expect(limitsManager.getLimits().nodes.max).toBe(300)

      limitsManager.reset()

      expect(limitsManager.getLimits().nodes.max).toBe(200)
      expect(limitsManager.isHydrated()).toBe(false)
    })
  })
})

/**
 * Integration tests for useEngineLimits hook (singleton pattern)
 *
 * Tests core behaviors:
 * - Initial live fetch → store updated with {limits, source:'live'}
 * - Error handling → falls back after retries
 * - retry() function → triggers re-fetch
 * - DEV fallback mode → returns source:'fallback' with limits
 * - Singleton: multiple hook instances share one fetch
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useEngineLimits, __resetForTesting } from '../useEngineLimits'
import * as plotAdapter from '../../../adapters/plot'
import { useCanvasStore } from '../../store'
import type { LimitsFetch, LimitsV1 } from '../../../adapters/plot/types'

// Mock the plot adapter
vi.mock('../../../adapters/plot', () => ({
  plot: {
    limits: vi.fn(),
  },
}))

const mockLimits = vi.mocked(plotAdapter.plot.limits as any)

const createLiveResult = (data?: Partial<LimitsV1>): LimitsFetch => ({
  ok: true,
  source: 'live',
  data: {
    nodes: { max: 200 },
    edges: { max: 500 },
    engine_p95_ms_budget: 30000,
    ...data,
  },
  fetchedAt: Date.now(),
})

const createFallbackResult = (reason: string): LimitsFetch => ({
  ok: true,
  source: 'fallback',
  data: {
    nodes: { max: 200 },
    edges: { max: 500 },
  },
  fetchedAt: Date.now(),
  reason,
})

const createErrorResult = (_message: string): LimitsFetch => ({
  ok: false,
  error: new Error(_message),
  fetchedAt: Date.now(),
})

describe('useEngineLimits', () => {
  beforeEach(() => {
    mockLimits.mockClear()
    __resetForTesting()
    // Reset store engine limits fields
    useCanvasStore.setState({
      engineLimits: null,
      engineLimitsSource: null,
      engineLimitsLoading: true,
      engineLimitsError: null,
      engineLimitsFetchedAt: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    __resetForTesting()
  })

  describe('Initial fetch', () => {
    it('should fetch live limits on mount', async () => {
      mockLimits.mockResolvedValueOnce(createLiveResult())

      const { result } = renderHook(() => useEngineLimits())

      // Wait for fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 2000 })

      expect(result.current.limits).toEqual({
        nodes: { max: 200 },
        edges: { max: 500 },
        engine_p95_ms_budget: 30000,
      })
      expect(result.current.source).toBe('live')
      expect(result.current.error).toBeNull()
      expect(result.current.fetchedAt).toBeTypeOf('number')
    })

    it('should expose fetchedAt timestamp', async () => {
      const beforeFetch = Date.now()
      mockLimits.mockResolvedValueOnce(createLiveResult())

      const { result } = renderHook(() => useEngineLimits())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 2000 })

      expect(result.current.fetchedAt).toBeGreaterThanOrEqual(beforeFetch)
      expect(result.current.fetchedAt).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('Retry behavior', () => {
    it('should fall back after all retries fail', async () => {
      // All attempts fail — singleton falls back to FALLBACK_LIMITS
      mockLimits
        .mockResolvedValueOnce(createErrorResult('Attempt 1 failed'))
        .mockResolvedValueOnce(createErrorResult('Attempt 2 failed'))
        .mockResolvedValueOnce(createErrorResult('Attempt 3 failed'))

      const { result } = renderHook(() => useEngineLimits())

      // Wait for all retries to complete (0s + 2s + 5s = ~7s max)
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 10000 })

      // Singleton falls back to FALLBACK_LIMITS after all retries fail
      expect(result.current.source).toBe('fallback')
      expect(result.current.limits).toBeTruthy()
      expect(mockLimits).toHaveBeenCalledTimes(3)
    }, 12000)

    it('should succeed on later attempt after initial failures', async () => {
      mockLimits
        .mockResolvedValueOnce(createErrorResult('Attempt 1 failed'))
        .mockResolvedValueOnce(createLiveResult())

      const { result } = renderHook(() => useEngineLimits())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 5000 })

      expect(result.current.limits).toBeTruthy()
      expect(result.current.source).toBe('live')
      expect(result.current.error).toBeNull()
      expect(mockLimits).toHaveBeenCalledTimes(2)
    }, 6000)

    it('should stop retrying on first success', async () => {
      mockLimits.mockResolvedValueOnce(createLiveResult())

      const { result } = renderHook(() => useEngineLimits())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 2000 })

      // Should only call once (no retries)
      expect(mockLimits).toHaveBeenCalledTimes(1)
      expect(result.current.limits).toBeTruthy()
    })
  })

  describe('Manual retry', () => {
    it('should trigger re-fetch when retry() called', async () => {
      mockLimits
        .mockResolvedValueOnce(createLiveResult({ nodes: { max: 200 } }))
        .mockResolvedValueOnce(createLiveResult({ nodes: { max: 300 } }))

      const { result } = renderHook(() => useEngineLimits())

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 2000 })

      expect(result.current.limits?.nodes.max).toBe(200)
      expect(mockLimits).toHaveBeenCalledTimes(1)

      // Call retry()
      act(() => {
        result.current.retry()
      })

      await waitFor(() => {
        expect(result.current.limits?.nodes.max).toBe(300)
      }, { timeout: 2000 })

      expect(mockLimits).toHaveBeenCalledTimes(2)
    })
  })

  describe('Tab visibility refresh', () => {
    let originalDescriptor: PropertyDescriptor | undefined

    beforeEach(() => {
      // Capture original descriptor
      originalDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
    })

    afterEach(() => {
      // Restore original descriptor
      if (originalDescriptor) {
        Object.defineProperty(document, 'visibilityState', originalDescriptor)
      }
    })

    it('should refresh when tab becomes visible', async () => {
      mockLimits
        .mockResolvedValueOnce(createLiveResult({ nodes: { max: 200 } }))
        .mockResolvedValueOnce(createLiveResult({ nodes: { max: 300 } }))

      // Mock visibilityState
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get() {
          return 'visible'
        },
      })

      const { result } = renderHook(() => useEngineLimits())

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 2000 })

      expect(result.current.limits?.nodes.max).toBe(200)

      // Simulate tab becoming visible
      document.dispatchEvent(new Event('visibilitychange'))

      await waitFor(() => {
        expect(result.current.limits?.nodes.max).toBe(300)
      }, { timeout: 2000 })

      expect(mockLimits).toHaveBeenCalledTimes(2)
    })

    it('should NOT refresh when tab becomes hidden', async () => {
      mockLimits.mockResolvedValueOnce(createLiveResult())

      // Mock visibilityState as hidden
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get() {
          return 'hidden'
        },
      })

      const { result } = renderHook(() => useEngineLimits())

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 2000 })

      expect(mockLimits).toHaveBeenCalledTimes(1)

      // Simulate visibility change (but still hidden)
      document.dispatchEvent(new Event('visibilitychange'))

      // Wait a bit to ensure no additional fetch
      await new Promise(resolve => setTimeout(resolve, 200))

      // Should not trigger another fetch
      expect(mockLimits).toHaveBeenCalledTimes(1)
    })
  })

  describe('DEV fallback mode', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', true)
    })

    it('should return source:"fallback" with limits and no error', async () => {
      mockLimits.mockResolvedValueOnce(
        createFallbackResult('Live endpoint failed: Connection timeout')
      )

      const { result } = renderHook(() => useEngineLimits())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 2000 })

      expect(result.current.source).toBe('fallback')
      expect(result.current.limits).toEqual({
        nodes: { max: 200 },
        edges: { max: 500 },
      })
      expect(result.current.error).toBeNull()
      expect(result.current.fetchedAt).toBeTypeOf('number')
    })

    it('should log fallback reason in DEV mode', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockLimits.mockResolvedValueOnce(
        createFallbackResult('Live endpoint failed: Database unavailable')
      )

      renderHook(() => useEngineLimits())

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[useEngineLimits] Using fallback limits:'),
          expect.stringContaining('Database unavailable')
        )
      }, { timeout: 2000 })

      consoleWarnSpy.mockRestore()
    })
  })

  describe('Singleton behavior', () => {
    it('should only fetch once for multiple hook instances', async () => {
      mockLimits.mockResolvedValueOnce(createLiveResult())

      // Render two hooks — should share the same singleton fetch
      const { result: result1 } = renderHook(() => useEngineLimits())
      const { result: result2 } = renderHook(() => useEngineLimits())

      await waitFor(() => {
        expect(result1.current.loading).toBe(false)
      }, { timeout: 2000 })

      await waitFor(() => {
        expect(result2.current.loading).toBe(false)
      }, { timeout: 2000 })

      // Only one fetch call, not two
      expect(mockLimits).toHaveBeenCalledTimes(1)

      // Both hooks see the same data
      expect(result1.current.limits).toEqual(result2.current.limits)
      expect(result1.current.source).toBe(result2.current.source)
    })
  })

  describe('Error handling', () => {
    it('should handle adapter throwing exceptions', async () => {
      mockLimits
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockRejectedValueOnce(new Error('Network failure'))

      const { result } = renderHook(() => useEngineLimits())

      // Wait for all retries
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 10000 })

      // After all retries fail, falls back
      expect(result.current.source).toBe('fallback')
      expect(result.current.limits).toBeTruthy()
      expect(mockLimits).toHaveBeenCalledTimes(3)
    }, 12000)
  })
})

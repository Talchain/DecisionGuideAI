/**
 * Integration tests for useEngineLimits hook
 *
 * Tests core behaviors:
 * - Initial live fetch → {limits, source:'live', error:null}
 * - Error handling → exposes error after retries
 * - retry() function →triggers re-fetch
 * - DEV fallback mode → returns source:'fallback' with limits
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useEngineLimits } from '../useEngineLimits'
import * as plotAdapter from '../../../adapters/plot'
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

const createErrorResult = (message: string): LimitsFetch => ({
  ok: false,
  error: new Error(message),
  fetchedAt: Date.now(),
})

describe('useEngineLimits', () => {
  beforeEach(() => {
    mockLimits.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial fetch', () => {
    it('should fetch live limits on mount', async () => {
      mockLimits.mockResolvedValueOnce(createLiveResult())

      const { result } = renderHook(() => useEngineLimits())

      // Initially loading
      expect(result.current.loading).toBe(true)
      expect(result.current.limits).toBeNull()

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
    it('should retry on failures and eventually expose error', async () => {
      // All attempts fail
      mockLimits
        .mockResolvedValueOnce(createErrorResult('Attempt 1 failed'))
        .mockResolvedValueOnce(createErrorResult('Attempt 2 failed'))
        .mockResolvedValueOnce(createErrorResult('Attempt 3 failed'))

      const { result } = renderHook(() => useEngineLimits())

      // Wait for all retries to complete (0s + 2s + 5s = ~7s max)
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 10000 })

      // Should expose error after all retries fail
      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.error?.message).toBe('Attempt 3 failed')
      expect(result.current.limits).toBeNull()
      expect(result.current.source).toBeNull()
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
      result.current.retry()

      await waitFor(() => {
        expect(result.current.limits?.nodes.max).toBe(300)
      }, { timeout: 2000 })

      expect(mockLimits).toHaveBeenCalledTimes(2)
    })

    it('should clear error state on successful retry', async () => {
      mockLimits
        .mockResolvedValueOnce(createErrorResult('Initial error'))
        .mockResolvedValueOnce(createErrorResult('Retry 1'))
        .mockResolvedValueOnce(createErrorResult('Retry 2'))
        .mockResolvedValueOnce(createLiveResult())

      const { result } = renderHook(() => useEngineLimits())

      // Wait for initial fetch to fail
      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      }, { timeout: 10000 })

      const initialCallCount = mockLimits.mock.calls.length

      // Call retry() - should clear error and succeed
      result.current.retry()

      await waitFor(() => {
        expect(result.current.error).toBeNull()
        expect(result.current.limits).toBeTruthy()
      }, { timeout: 2000 })

      expect(mockLimits.mock.calls.length).toBeGreaterThan(initialCallCount)
    }, 15000)
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

      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.error?.message).toBe('Network failure')
      expect(mockLimits).toHaveBeenCalledTimes(3)
    }, 12000)
  })
})

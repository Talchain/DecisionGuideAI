/**
 * useKeyInsight Hook Unit Tests
 *
 * Tests for the hook that fetches key insights from CEE
 * after analysis completes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useKeyInsight, clearInsightCache } from '../useKeyInsight'

// Mock the httpV1Adapter
vi.mock('../../../adapters/plot/httpV1Adapter', () => ({
  httpV1Adapter: {
    keyInsight: vi.fn(),
  },
}))

import { httpV1Adapter } from '../../../adapters/plot/httpV1Adapter'

describe('useKeyInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearInsightCache()
  })

  afterEach(() => {
    clearInsightCache()
  })

  describe('initial state', () => {
    it('returns null insight when no responseHash is provided', () => {
      const { result } = renderHook(() =>
        useKeyInsight({ responseHash: null })
      )

      expect(result.current.insight).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('returns null insight when responseHash is undefined', () => {
      const { result } = renderHook(() =>
        useKeyInsight({ responseHash: undefined })
      )

      expect(result.current.insight).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('auto-fetch behavior', () => {
    it('fetches insight when responseHash is provided', async () => {
      const mockInsight = {
        headline: 'Option A leads to 25% higher success',
        primary_driver: {
          label: 'Market Demand',
          contribution_pct: 45,
          explanation: 'Strong market demand drives success',
          node_id: 'node-1',
        },
        confidence_statement: 'High confidence based on 3 validated factors',
        provenance: 'cee' as const,
      }
      vi.mocked(httpV1Adapter.keyInsight).mockResolvedValueOnce(mockInsight)

      const { result } = renderHook(() =>
        useKeyInsight({ responseHash: 'hash-123' })
      )

      // Should start loading
      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.insight).toEqual(mockInsight)
        expect(result.current.error).toBeNull()
      })
    })

    it('passes correct parameters to API', async () => {
      const mockInsight = {
        headline: 'Test insight',
        provenance: 'cee' as const,
      }
      vi.mocked(httpV1Adapter.keyInsight).mockResolvedValueOnce(mockInsight)

      renderHook(() =>
        useKeyInsight({
          responseHash: 'hash-456',
          scenarioName: 'Scenario A',
          includeDrivers: true,
        })
      )

      await waitFor(() => {
        expect(httpV1Adapter.keyInsight).toHaveBeenCalledWith({
          run_id: 'hash-456',
          scenario_name: 'Scenario A',
          include_drivers: true,
        })
      })
    })

    it('does not fetch when autoFetch is false', () => {
      renderHook(() =>
        useKeyInsight({
          responseHash: 'hash-789',
          autoFetch: false,
        })
      )

      expect(httpV1Adapter.keyInsight).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('sets error state on API failure', async () => {
      vi.mocked(httpV1Adapter.keyInsight).mockRejectedValueOnce({
        error: 'Failed to generate insight',
      })

      const { result } = renderHook(() =>
        useKeyInsight({ responseHash: 'hash-error' })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toBe('Failed to generate insight')
        expect(result.current.insight).toBeNull()
      })
    })

    it('handles error without error property', async () => {
      vi.mocked(httpV1Adapter.keyInsight).mockRejectedValueOnce({
        message: 'Network error',
      })

      const { result } = renderHook(() =>
        useKeyInsight({ responseHash: 'hash-error-2' })
      )

      await waitFor(() => {
        expect(result.current.error).toBe('Network error')
      })
    })

    it('uses fallback error message when no error/message provided', async () => {
      vi.mocked(httpV1Adapter.keyInsight).mockRejectedValueOnce({})

      const { result } = renderHook(() =>
        useKeyInsight({ responseHash: 'hash-error-3' })
      )

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to fetch key insight')
      })
    })
  })

  describe('caching', () => {
    it('uses cached result for same responseHash', async () => {
      const mockInsight = {
        headline: 'Cached insight',
        provenance: 'cee' as const,
      }
      vi.mocked(httpV1Adapter.keyInsight).mockResolvedValueOnce(mockInsight)

      // First render
      const { result, rerender } = renderHook(
        ({ hash }) => useKeyInsight({ responseHash: hash }),
        { initialProps: { hash: 'hash-cache' } }
      )

      await waitFor(() => {
        expect(result.current.insight?.headline).toBe('Cached insight')
      })

      expect(httpV1Adapter.keyInsight).toHaveBeenCalledTimes(1)

      // Re-render with same hash
      rerender({ hash: 'hash-cache' })

      // Should not call API again
      expect(httpV1Adapter.keyInsight).toHaveBeenCalledTimes(1)
      expect(result.current.insight?.headline).toBe('Cached insight')
    })

    it('fetches new insight when responseHash changes', async () => {
      const mockInsight1 = {
        headline: 'First insight',
        provenance: 'cee' as const,
      }
      const mockInsight2 = {
        headline: 'Second insight',
        provenance: 'cee' as const,
      }
      vi.mocked(httpV1Adapter.keyInsight)
        .mockResolvedValueOnce(mockInsight1)
        .mockResolvedValueOnce(mockInsight2)

      const { result, rerender } = renderHook(
        ({ hash }) => useKeyInsight({ responseHash: hash }),
        { initialProps: { hash: 'hash-1' } }
      )

      await waitFor(() => {
        expect(result.current.insight?.headline).toBe('First insight')
      })

      // Change hash
      rerender({ hash: 'hash-2' })

      await waitFor(() => {
        expect(result.current.insight?.headline).toBe('Second insight')
      })

      expect(httpV1Adapter.keyInsight).toHaveBeenCalledTimes(2)
    })
  })

  describe('refresh', () => {
    it('allows manual refresh', async () => {
      const mockInsight = {
        headline: 'Refreshed insight',
        provenance: 'cee' as const,
      }
      vi.mocked(httpV1Adapter.keyInsight).mockResolvedValue(mockInsight)

      const { result } = renderHook(() =>
        useKeyInsight({
          responseHash: 'hash-refresh',
          autoFetch: false,
        })
      )

      expect(result.current.insight).toBeNull()

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.insight?.headline).toBe('Refreshed insight')
    })

    it('refresh does nothing when responseHash is null', async () => {
      const { result } = renderHook(() =>
        useKeyInsight({ responseHash: null })
      )

      await act(async () => {
        await result.current.refresh()
      })

      expect(httpV1Adapter.keyInsight).not.toHaveBeenCalled()
      expect(result.current.insight).toBeNull()
    })
  })

  describe('cleanup', () => {
    it('clears insight when responseHash becomes null', async () => {
      const mockInsight = {
        headline: 'Test insight',
        provenance: 'cee' as const,
      }
      vi.mocked(httpV1Adapter.keyInsight).mockResolvedValueOnce(mockInsight)

      const { result, rerender } = renderHook(
        ({ hash }) => useKeyInsight({ responseHash: hash }),
        { initialProps: { hash: 'hash-cleanup' as string | null } }
      )

      await waitFor(() => {
        expect(result.current.insight?.headline).toBe('Test insight')
      })

      // Set hash to null
      rerender({ hash: null })

      expect(result.current.insight).toBeNull()
      expect(result.current.error).toBeNull()
    })
  })

  describe('insight structure', () => {
    it('returns complete insight with all fields', async () => {
      const fullInsight = {
        headline: 'Complete insight',
        primary_driver: {
          label: 'Key Factor',
          contribution_pct: 60,
          explanation: 'This factor explains most of the outcome',
          node_id: 'node-key',
        },
        confidence_statement: 'Very high confidence',
        caveat: 'Assumes stable market conditions',
        provenance: 'cee' as const,
      }
      vi.mocked(httpV1Adapter.keyInsight).mockResolvedValueOnce(fullInsight)

      const { result } = renderHook(() =>
        useKeyInsight({ responseHash: 'hash-full' })
      )

      await waitFor(() => {
        expect(result.current.insight).toEqual(fullInsight)
      })

      expect(result.current.insight?.headline).toBe('Complete insight')
      expect(result.current.insight?.primary_driver?.label).toBe('Key Factor')
      expect(result.current.insight?.primary_driver?.contribution_pct).toBe(60)
      expect(result.current.insight?.confidence_statement).toBe(
        'Very high confidence'
      )
      expect(result.current.insight?.caveat).toBe(
        'Assumes stable market conditions'
      )
      expect(result.current.insight?.provenance).toBe('cee')
    })

    it('handles insight without optional fields', async () => {
      const minimalInsight = {
        headline: 'Minimal insight',
        provenance: 'cee' as const,
      }
      vi.mocked(httpV1Adapter.keyInsight).mockResolvedValueOnce(minimalInsight)

      const { result } = renderHook(() =>
        useKeyInsight({ responseHash: 'hash-minimal' })
      )

      await waitFor(() => {
        expect(result.current.insight?.headline).toBe('Minimal insight')
      })

      expect(result.current.insight?.primary_driver).toBeUndefined()
      expect(result.current.insight?.confidence_statement).toBeUndefined()
      expect(result.current.insight?.caveat).toBeUndefined()
    })
  })
})

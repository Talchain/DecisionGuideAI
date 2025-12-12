/**
 * useRobustness Hook Tests
 *
 * Brief 10: Tests for robustness data fetch hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useRobustness, clearRobustnessCache } from '../useRobustness'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useRobustness', () => {
  beforeEach(() => {
    clearRobustnessCache()
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const mockApiResponse = {
    option_rankings: [
      { option_id: 'opt-1', option_label: 'Option A', rank: 1, expected_value: 0.75, confidence: 'high', robust_winner: true },
    ],
    recommendation: {
      option_id: 'opt-1',
      confidence: 'high',
      recommendation_status: 'clear',
    },
    sensitivity: [
      { node_id: 'node-1', label: 'Market Size', current_value: 0.6, flip_threshold: 0.45, direction: 'decrease', sensitivity: 0.8 },
    ],
    robustness_label: 'moderate',
    robustness_bounds: [],
    value_of_information: [
      { node_id: 'node-1', label: 'Market Size', evpi: 0.12, worth_investigating: true },
    ],
    narrative: 'Test narrative',
  }

  describe('Initial state', () => {
    it('returns null robustness when runId is not provided', () => {
      const { result } = renderHook(() => useRobustness({}))

      expect(result.current.robustness).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('Successful fetch', () => {
    it('fetches and returns robustness data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const { result } = renderHook(() =>
        useRobustness({ runId: 'test-run-123', autoFetch: true })
      )

      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.robustness).not.toBeNull()
      expect(result.current.robustness?.robustness_label).toBe('moderate')
      expect(result.current.robustness?.narrative).toBe('Test narrative')
      expect(result.current.error).toBeNull()
    })

    it('maps sensitivity data correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const { result } = renderHook(() =>
        useRobustness({ runId: 'test-run-123', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const sensitivity = result.current.robustness?.sensitivity[0]
      expect(sensitivity?.node_id).toBe('node-1')
      expect(sensitivity?.label).toBe('Market Size')
      expect(sensitivity?.current_value).toBe(0.6)
      expect(sensitivity?.flip_threshold).toBe(0.45)
    })

    it('maps VoI data correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const { result } = renderHook(() =>
        useRobustness({ runId: 'test-run-123', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const voi = result.current.robustness?.value_of_information[0]
      expect(voi?.node_id).toBe('node-1')
      expect(voi?.evpi).toBe(0.12)
      expect(voi?.worth_investigating).toBe(true)
    })
  })

  describe('Error handling', () => {
    it('generates fallback on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const { result } = renderHook(() =>
        useRobustness({ runId: 'test-run-123', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should return fallback, not error
      expect(result.current.robustness).not.toBeNull()
      expect(result.current.robustness?.robustness_label).toBe('moderate')
      expect(result.current.error).toBeNull()
    })

    it('sets error and fallback on other errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const { result } = renderHook(() =>
        useRobustness({ runId: 'test-run-123', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Failed to fetch robustness: 500')
      // Should still have fallback
      expect(result.current.robustness).not.toBeNull()
    })

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() =>
        useRobustness({ runId: 'test-run-123', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Network error')
      expect(result.current.robustness).not.toBeNull() // Fallback
    })
  })

  describe('Caching', () => {
    it('returns cached data on subsequent calls', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const { result, rerender } = renderHook(
        ({ runId }) => useRobustness({ runId, autoFetch: true }),
        { initialProps: { runId: 'test-run-123' } }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // First call should have fetched
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Rerender with same runId
      rerender({ runId: 'test-run-123' })

      // Should not fetch again (cached)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result.current.robustness?.narrative).toBe('Test narrative')
    })

    it('fetches new data when runId changes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const { result, rerender } = renderHook(
        ({ runId }) => useRobustness({ runId, autoFetch: true }),
        { initialProps: { runId: 'test-run-123' } }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Setup new mock for different runId
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockApiResponse, narrative: 'New narrative' }),
      })

      // Change runId
      rerender({ runId: 'test-run-456' })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should have fetched for new runId
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('autoFetch option', () => {
    it('does not fetch when autoFetch is false', async () => {
      const { result } = renderHook(() =>
        useRobustness({ runId: 'test-run-123', autoFetch: false })
      )

      // Wait a tick
      await new Promise((r) => setTimeout(r, 10))

      expect(mockFetch).not.toHaveBeenCalled()
      expect(result.current.robustness).toBeNull()
      expect(result.current.loading).toBe(false)
    })

    it('fetches when refetch is called manually', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const { result } = renderHook(() =>
        useRobustness({ runId: 'test-run-123', autoFetch: false })
      )

      expect(mockFetch).not.toHaveBeenCalled()

      // Call refetch manually
      await act(async () => {
        await result.current.refetch()
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result.current.robustness).not.toBeNull()
    })
  })

  describe('Request payload', () => {
    it('includes runId and responseHash in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      renderHook(() =>
        useRobustness({
          runId: 'test-run-123',
          responseHash: 'hash-abc',
          autoFetch: true,
        })
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('/bff/engine/v1/robustness')
      expect(options.method).toBe('POST')

      const body = JSON.parse(options.body)
      expect(body.run_id).toBe('test-run-123')
      expect(body.response_hash).toBe('hash-abc')
      expect(body.include_sensitivity).toBe(true)
      expect(body.include_voi).toBe(true)
      expect(body.include_pareto).toBe(true)
    })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { usePareto } from '../usePareto'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('usePareto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mockOptions = [
    { id: 'opt1', label: 'Option A', scores: { cost: 0.3, quality: 0.8 } },
    { id: 'opt2', label: 'Option B', scores: { cost: 0.5, quality: 0.9 } },
    { id: 'opt3', label: 'Option C', scores: { cost: 0.7, quality: 0.6 } },
  ]

  const mockCriteria = ['cost', 'quality']

  const mockParetoResponse = {
    frontier: ['opt1', 'opt2'],
    dominated: ['opt3'],
    dominance_pairs: [{ dominator: 'opt1', dominated: 'opt3' }],
    frontier_size: 2,
    total_options: 3,
  }

  describe('initial state', () => {
    it('returns empty arrays initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      const { result } = renderHook(() =>
        usePareto({ options: mockOptions, criteria: mockCriteria, enabled: false })
      )

      expect(result.current.frontier).toEqual([])
      expect(result.current.dominated).toEqual([])
      expect(result.current.dominancePairs).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('validation', () => {
    it('does not fetch when less than 3 options', () => {
      const { result } = renderHook(() =>
        usePareto({
          options: mockOptions.slice(0, 2),
          criteria: mockCriteria,
        })
      )

      expect(mockFetch).not.toHaveBeenCalled()
      expect(result.current.frontier).toEqual([])
      expect(result.current.isLoading).toBe(false)
    })

    it('does not fetch when less than 2 criteria', () => {
      const { result } = renderHook(() =>
        usePareto({
          options: mockOptions,
          criteria: ['cost'],
        })
      )

      expect(mockFetch).not.toHaveBeenCalled()
      expect(result.current.frontier).toEqual([])
    })

    it('does not fetch when disabled', () => {
      const { result } = renderHook(() =>
        usePareto({
          options: mockOptions,
          criteria: mockCriteria,
          enabled: false,
        })
      )

      expect(mockFetch).not.toHaveBeenCalled()
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('successful fetch', () => {
    it('fetches and returns Pareto data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockParetoResponse),
      })

      const { result } = renderHook(() =>
        usePareto({ options: mockOptions, criteria: mockCriteria })
      )

      // Should start loading
      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.frontier).toEqual(['opt1', 'opt2'])
      expect(result.current.dominated).toEqual(['opt3'])
      expect(result.current.dominancePairs).toEqual([
        { dominator: 'opt1', dominated: 'opt3' },
      ])
      expect(result.current.error).toBeNull()
    })

    it('sends correct request payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockParetoResponse),
      })

      renderHook(() => usePareto({ options: mockOptions, criteria: mockCriteria }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('/bff/engine/v1/analysis/pareto')
      expect(options.method).toBe('POST')
      expect(options.headers['Content-Type']).toBe('application/json')

      const body = JSON.parse(options.body)
      expect(body.options).toHaveLength(3)
      expect(body.options[0]).toEqual({
        option_id: 'opt1',
        option_label: 'Option A',
        scores: { cost: 0.3, quality: 0.8 },
      })
      expect(body.criteria).toEqual(['cost', 'quality'])
    })
  })

  describe('error handling', () => {
    it('handles HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        clone: () => ({
          json: () => Promise.resolve({ error: 'Internal error' }),
        }),
      })

      const { result } = renderHook(() =>
        usePareto({ options: mockOptions, criteria: mockCriteria })
      )

      await waitFor(() => {
        expect(result.current.error).not.toBeNull()
      })

      expect(result.current.error?.message).toContain('HTTP 500')
      expect(result.current.frontier).toEqual([])
      expect(result.current.dominated).toEqual([])
      expect(result.current.isLoading).toBe(false)
    })

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() =>
        usePareto({ options: mockOptions, criteria: mockCriteria })
      )

      await waitFor(() => {
        expect(result.current.error).not.toBeNull()
      })

      expect(result.current.error?.message).toBe('Network error')
      expect(result.current.isLoading).toBe(false)
    })

    it('ignores abort errors', async () => {
      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'
      mockFetch.mockRejectedValueOnce(abortError)

      const { result } = renderHook(() =>
        usePareto({ options: mockOptions, criteria: mockCriteria })
      )

      // Wait for any state updates
      await new Promise((r) => setTimeout(r, 100))

      // Should not set error for abort
      expect(result.current.error).toBeNull()
    })
  })

  describe('refetch', () => {
    it('allows manual refetch', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockParetoResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockParetoResponse,
              frontier: ['opt2'],
              dominated: ['opt1', 'opt3'],
            }),
        })

      const { result } = renderHook(() =>
        usePareto({ options: mockOptions, criteria: mockCriteria })
      )

      await waitFor(() => {
        expect(result.current.frontier).toEqual(['opt1', 'opt2'])
      })

      // Trigger refetch
      await act(async () => {
        await result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.frontier).toEqual(['opt2'])
      })
    })
  })

  describe('parameter changes', () => {
    it('refetches when options change', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockParetoResponse),
      })

      const { result, rerender } = renderHook(
        ({ options, criteria }) => usePareto({ options, criteria }),
        { initialProps: { options: mockOptions, criteria: mockCriteria } }
      )

      await waitFor(() => {
        expect(result.current.frontier).toEqual(['opt1', 'opt2'])
      })

      const newOptions = [
        ...mockOptions,
        { id: 'opt4', label: 'Option D', scores: { cost: 0.4, quality: 0.95 } },
      ]

      rerender({ options: newOptions, criteria: mockCriteria })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
    })
  })
})

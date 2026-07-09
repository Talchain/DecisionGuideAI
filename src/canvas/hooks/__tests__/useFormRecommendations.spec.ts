/**
 * useFormRecommendations Tests
 *
 * Brief 11.1: Tests for CEE form recommendations hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useFormRecommendations, clearFormRecommendationsCache } from '../useFormRecommendations'
import { useCanvasStore } from '../../store'

// Mock the canvas store
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn(),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useFormRecommendations', () => {
  const mockEdges = [
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      data: { functionType: 'linear' },
    },
    {
      id: 'edge-2',
      source: 'node-2',
      target: 'node-3',
      data: { functionType: 'linear' },
    },
  ]

  const mockNodes = [
    { id: 'node-1', type: 'factor', data: { label: 'Marketing Spend' } },
    { id: 'node-2', type: 'factor', data: { label: 'Revenue' } },
    { id: 'node-3', type: 'outcome', data: { label: 'Success' } },
  ]

  const mockUpdateEdgeData = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    clearFormRecommendationsCache()
    localStorage.clear()

    ;(useCanvasStore as any).mockImplementation((selector: any) => {
      const state = {
        edges: mockEdges,
        nodes: mockNodes,
        updateEdgeData: mockUpdateEdgeData,
      }
      return selector(state)
    })
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Initial state', () => {
    it('returns empty recommendations initially', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recommendations: [] }),
      })

      const { result } = renderHook(() =>
        useFormRecommendations({ autoFetch: false })
      )

      expect(result.current.recommendations).toEqual([])
      expect(result.current.appliedForms).toEqual([])
      expect(result.current.suggestions).toEqual([])
    })

    it('returns loading false when not fetching', () => {
      const { result } = renderHook(() =>
        useFormRecommendations({ autoFetch: false })
      )

      expect(result.current.loading).toBe(false)
    })

    it('returns null error initially', () => {
      const { result } = renderHook(() =>
        useFormRecommendations({ autoFetch: false })
      )

      expect(result.current.error).toBeNull()
    })
  })

  describe('Fetching recommendations', () => {
    it('fetches recommendations on mount when autoFetch is true', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            recommendations: [
              {
                edge_id: 'edge-1',
                recommended_form: 'diminishing_returns',
                confidence: 'medium',
                rationale: 'Test rationale',
              },
            ],
          }),
      })

      const { result } = renderHook(() => useFormRecommendations({ autoFetch: true }))

      await waitFor(() => {
        expect(result.current.recommendations.length).toBeGreaterThan(0)
      })
    })

    it('sets loading true while fetching', async () => {
      let resolvePromise: any
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          })
      )

      const { result } = renderHook(() => useFormRecommendations({ autoFetch: true }))

      // Should be loading
      await waitFor(() => {
        expect(result.current.loading).toBe(true)
      })

      // Resolve the promise
      resolvePromise({
        ok: true,
        json: () => Promise.resolve({ recommendations: [] }),
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })

    it('generates fallback recommendations when endpoint returns 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      })

      const { result } = renderHook(() => useFormRecommendations({ autoFetch: true }))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should have fallback recommendations based on node context
      // (depends on node types and labels)
    })

    it('sets error on fetch failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useFormRecommendations({ autoFetch: true }))

      await waitFor(() => {
        expect(result.current.error).toBe('Network error')
      })
    })
  })

  describe('Filtering recommendations', () => {
    it('separates high-confidence applied forms', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            recommendations: [
              {
                edge_id: 'edge-1',
                recommended_form: 'diminishing_returns',
                confidence: 'high',
                rationale: 'High confidence',
              },
              {
                edge_id: 'edge-2',
                recommended_form: 'threshold',
                confidence: 'medium',
                rationale: 'Medium confidence',
              },
            ],
          }),
      })

      const { result } = renderHook(() =>
        useFormRecommendations({ autoFetch: true, autoApply: false })
      )

      await waitFor(() => {
        expect(result.current.recommendations.length).toBe(2)
      })
    })

    it('filters medium-confidence as suggestions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            recommendations: [
              {
                edge_id: 'edge-1',
                current_form: 'linear',
                recommended_form: 'diminishing_returns',
                confidence: 'medium',
                rationale: 'Medium confidence',
              },
            ],
          }),
      })

      const { result } = renderHook(() =>
        useFormRecommendations({ autoFetch: true, autoApply: false })
      )

      await waitFor(() => {
        expect(result.current.suggestions.length).toBe(1)
      })
    })
  })

  describe('Auto-apply high confidence', () => {
    it('auto-applies high-confidence forms when enabled', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            recommendations: [
              {
                edge_id: 'edge-1',
                current_form: 'linear',
                recommended_form: 'diminishing_returns',
                confidence: 'high',
                rationale: 'High confidence recommendation',
              },
            ],
          }),
      })

      renderHook(() => useFormRecommendations({ autoFetch: true, autoApply: true }))

      await waitFor(() => {
        expect(mockUpdateEdgeData).toHaveBeenCalledWith('edge-1', {
          functionType: 'diminishing_returns',
          formConfidence: 'high',
          formProvenance: 'cee_recommended',
          formRationale: 'High confidence recommendation',
        })
      })
    })

    it('does not auto-apply when autoApply is false', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            recommendations: [
              {
                edge_id: 'edge-1',
                current_form: 'linear',
                recommended_form: 'diminishing_returns',
                confidence: 'high',
                rationale: 'High confidence',
              },
            ],
          }),
      })

      renderHook(() => useFormRecommendations({ autoFetch: true, autoApply: false }))

      await waitFor(() => {
        expect(mockUpdateEdgeData).not.toHaveBeenCalled()
      })
    })
  })

  describe('User actions', () => {
    it('confirmForm updates edge provenance', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recommendations: [] }),
      })

      const { result } = renderHook(() =>
        useFormRecommendations({ autoFetch: false })
      )

      act(() => {
        result.current.confirmForm('edge-1')
      })

      expect(mockUpdateEdgeData).toHaveBeenCalledWith('edge-1', {
        formProvenance: 'user_selected',
      })
    })

    it('changeForm updates edge with new form', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recommendations: [] }),
      })

      const { result } = renderHook(() =>
        useFormRecommendations({ autoFetch: false })
      )

      act(() => {
        result.current.changeForm('edge-1', 'threshold')
      })

      expect(mockUpdateEdgeData).toHaveBeenCalledWith('edge-1', {
        functionType: 'threshold',
        formProvenance: 'user_selected',
        formConfidence: undefined,
        formRationale: undefined,
      })
    })

    it('dismissSuggestion removes from suggestions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            recommendations: [
              {
                edge_id: 'edge-1',
                current_form: 'linear',
                recommended_form: 'threshold',
                confidence: 'medium',
                rationale: 'Test',
              },
            ],
          }),
      })

      const { result } = renderHook(() =>
        useFormRecommendations({ autoFetch: true, autoApply: false })
      )

      await waitFor(() => {
        expect(result.current.suggestions.length).toBe(1)
      })

      act(() => {
        result.current.dismissSuggestion('edge-1')
      })

      expect(result.current.suggestions.length).toBe(0)
    })

    it('persists dismissed suggestions to localStorage', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recommendations: [] }),
      })

      const { result } = renderHook(() =>
        useFormRecommendations({ autoFetch: false })
      )

      act(() => {
        result.current.dismissSuggestion('edge-1')
      })

      const stored = JSON.parse(
        localStorage.getItem('canvas.formSuggestions.dismissed.v1') || '[]'
      )
      expect(stored).toContain('edge-1')
    })
  })

  describe('Refetch', () => {
    it('refetch function triggers new fetch', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recommendations: [] }),
      })

      const { result } = renderHook(() =>
        useFormRecommendations({ autoFetch: false })
      )

      await act(async () => {
        await result.current.refetch()
      })

      expect(mockFetch).toHaveBeenCalled()
    })
  })

  describe('Empty edges', () => {
    it('returns empty when no edges', () => {
      // ROADMAP 1.26 chronic-CI-red triage: `edges` MUST be a referentially
      // stable array across mock invocations — the real zustand store
      // returns the same `edges` reference across reads until an actual
      // mutation. An inline `edges: []` here (the previous shape) creates a
      // fresh array on every store read; useFormRecommendations' auto-fetch
      // effect depends on the raw `edges` array (not just the derived
      // edgeHash string) via its `refetch` callback, so an unstable
      // reference makes that effect re-fire every render. On every fire,
      // the edges.length===0 branch of refetch() calls
      // setRecommendations([]) with a NEW empty array — React never bails
      // out on that (different reference each time) — producing an
      // infinite render loop that hung this spec (and, transitively, the
      // CI full-suite job) indefinitely. Same failure class as
      // InspectorPanel.test.tsx and usePareto.spec.ts, fixed in this lane.
      const EMPTY_EDGES: typeof mockEdges = []
      ;(useCanvasStore as any).mockImplementation((selector: any) => {
        const state = {
          edges: EMPTY_EDGES,
          nodes: mockNodes,
          updateEdgeData: mockUpdateEdgeData,
        }
        return selector(state)
      })

      const { result } = renderHook(() =>
        useFormRecommendations({ autoFetch: true })
      )

      expect(result.current.recommendations).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('ROADMAP 1.44 — unmemoized-caller infinite-fetch hazard', () => {
    // Root cause: refetch's useCallback depended on the RAW edges/nodes
    // array references (not just the content-based edgeHash string). A
    // store/selector that returns a new edges/nodes array reference on
    // every render (same values, new reference) forces a new refetch
    // identity on every render, which re-fires the auto-fetch effect
    // regardless of whether edgeHash actually changed. Bounded here via
    // EXPLICIT rerender() calls (not a self-sustaining loop) to reproduce
    // the symptom safely — see the "Empty edges" test above for why an
    // inline-recomputed array must never be handed to renderHook directly
    // in this file (hangs the job).
    it('issues exactly one fetch when the store returns new edges/nodes array references (same content) across re-renders', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recommendations: [] }),
      })

      ;(useCanvasStore as any).mockImplementation((selector: any) => {
        const state = {
          edges: [...mockEdges],
          nodes: [...mockNodes],
          updateEdgeData: mockUpdateEdgeData,
        }
        return selector(state)
      })

      const { rerender } = renderHook(() =>
        useFormRecommendations({ autoFetch: true })
      )

      // Simulate an unmemoized store/selector: same logical content, a
      // BRAND NEW array reference on every re-render — before the in-flight
      // mount fetch has had a chance to resolve and latch lastFetchHashRef.
      for (let i = 0; i < 5; i++) {
        rerender()
      }

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Let any pending microtasks/re-renders settle.
      await new Promise((r) => setTimeout(r, 50))

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('does not self-trigger extra renders on empty-edges early return across unmemoized re-renders', () => {
      ;(useCanvasStore as any).mockImplementation((selector: any) => {
        const state = {
          edges: [] as typeof mockEdges,
          nodes: [...mockNodes],
          updateEdgeData: mockUpdateEdgeData,
        }
        return selector(state)
      })

      let renderCount = 0
      const { rerender } = renderHook(() => {
        renderCount++
        return useFormRecommendations({ autoFetch: true })
      })

      const countAfterMount = renderCount
      for (let i = 0; i < 5; i++) {
        rerender()
      }

      // Each explicit rerender must cause exactly one render — the hook
      // must not schedule an additional self-triggered render (a fresh
      // empty-array state that's never `===` the previous one, re-firing
      // the effect) on top of the ones the test asked for.
      expect(renderCount).toBe(countAfterMount + 5)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    // Review follow-up (1.44): the dep-stabilisation fix above must not
    // suppress a LEGITIMATE refetch — i.e. edges genuinely changing content,
    // not just reference. edgeHash itself changes here, so the auto-fetch
    // effect's `edgeHash !== lastFetchHashRef.current` guard is satisfied
    // and a second fetch fires, mirroring usePareto.spec.ts's "refetches
    // when options change" coverage for the equivalent hook.
    it('still refetches when edges genuinely change content (not just reference)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recommendations: [] }),
      })

      let currentEdges = mockEdges
      ;(useCanvasStore as any).mockImplementation((selector: any) => {
        const state = {
          edges: currentEdges,
          nodes: mockNodes,
          updateEdgeData: mockUpdateEdgeData,
        }
        return selector(state)
      })

      const { rerender } = renderHook(() => useFormRecommendations({ autoFetch: true }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Genuine content change: a new edge added, so edgeHash actually differs.
      currentEdges = [
        ...mockEdges,
        { id: 'edge-3', source: 'node-3', target: 'node-1', data: { functionType: 'linear' } },
      ]
      rerender()

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
    })
  })
})

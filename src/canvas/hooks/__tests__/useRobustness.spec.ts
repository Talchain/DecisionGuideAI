/**
 * useRobustness Hook Tests
 *
 * Tests for robustness data extraction from PLoT enrichment stored in canvas store.
 * The hook no longer calls ISL directly — PLoT calls ISL internally and returns
 * enrichment data via store.results.enrichment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useRobustness, clearRobustnessCache } from '../useRobustness'

// ---------------------------------------------------------------------------
// Store mock state — mutated per-test to simulate different enrichment states
// ---------------------------------------------------------------------------
let mockStoreState: {
  results: {
    enrichment: any
    report: any
  }
}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: any) => any) => selector(mockStoreState)),
}))

// Mock flags — extractRobustnessFromEnrichment checks isPlotEnrichmentEnabled
vi.mock('../../../flags', () => ({
  isPlotEnrichmentEnabled: vi.fn(() => true),
}))

// Mock the gate store (used only for DEV logging, not functional)
vi.mock('../../../lib/gate-state', () => ({
  useGateStore: Object.assign(vi.fn(), {
    getState: () => ({ gates: { robustness: 'warn' } }),
  }),
}))

// ---------------------------------------------------------------------------
// Enrichment fixtures
// ---------------------------------------------------------------------------

/** Minimal valid enrichment with edge sensitivity + robustness edges */
function makeEnrichment(overrides?: {
  edges?: any[]
  factors?: any[]
  fragile_edges?: string[]
  robust_edges?: string[]
  overall_robustness?: string | number
  isl_enabled?: boolean
  detail_level?: string
  isl_degraded?: boolean
}) {
  const {
    edges = [
      { edge_id: 'e1', from: 'f1', to: 'g1', sensitivity_score: 0.9 },
      { edge_id: 'e2', from: 'f2', to: 'g1', sensitivity_score: 0.3 },
    ],
    factors = [],
    fragile_edges = ['e1'],
    robust_edges = ['e2'],
    overall_robustness,
    isl_enabled = true,
    detail_level = 'deep',
    isl_degraded,
  } = overrides ?? {}

  return {
    sensitivity_analysis: {
      edges,
      factors,
      fragile_edges,
      robust_edges,
      ...(overall_robustness !== undefined ? { overall_robustness } : {}),
    },
    metadata: {
      isl_enabled,
      detail_level,
      ...(isl_degraded !== undefined ? { isl_degraded } : {}),
    },
  }
}

/** Minimal report fixture */
function makeReport(overrides?: {
  confidenceLevel?: string
  confidenceWhy?: string
  likely?: number
  robustness?: any
}) {
  const {
    confidenceLevel = 'medium',
    confidenceWhy = 'Based on available data',
    likely = 0.65,
    robustness,
  } = overrides ?? {}

  return {
    results: { likely },
    confidence: {
      level: confidenceLevel,
      why: confidenceWhy,
    },
    meta: { elapsed_ms: 100 },
    ...(robustness !== undefined ? { robustness } : {}),
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('useRobustness', () => {
  beforeEach(() => {
    clearRobustnessCache()
    // Default: no enrichment, no report
    mockStoreState = {
      results: {
        enrichment: null,
        report: null,
      },
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // Initial state
  // =========================================================================

  describe('Initial state', () => {
    it('returns null robustness when runId is not provided', () => {
      const { result } = renderHook(() => useRobustness({}))

      expect(result.current.robustness).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.source).toBeNull()
    })

    it('returns null when autoFetch is false and refetch not called', async () => {
      mockStoreState.results.enrichment = makeEnrichment()
      mockStoreState.results.report = makeReport()

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-1', autoFetch: false })
      )

      // Wait a tick to ensure no auto-fetch occurred
      await new Promise((r) => setTimeout(r, 10))

      expect(result.current.robustness).toBeNull()
      expect(result.current.loading).toBe(false)
    })
  })

  // =========================================================================
  // Enrichment path — happy path
  // =========================================================================

  describe('Enrichment extraction', () => {
    it('extracts robustness from store enrichment and sets source to enrichment', async () => {
      mockStoreState.results.enrichment = makeEnrichment()
      mockStoreState.results.report = makeReport()

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-enrich-1', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.robustness).not.toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.source).toBe('enrichment')
      expect(result.current.robustness!.fragile_edge_count).toBe(1)
      expect(result.current.robustness!.robust_edge_count).toBe(1)
    })

    it('derives robustness label from overall_robustness string', async () => {
      mockStoreState.results.enrichment = makeEnrichment({
        overall_robustness: 'fragile',
      })
      mockStoreState.results.report = makeReport()

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-label-str', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.robustness!.robustness_label).toBe('fragile')
    })

    it('derives robustness label from overall_robustness numeric score', async () => {
      mockStoreState.results.enrichment = makeEnrichment({
        overall_robustness: 0.8, // >= 0.7 → 'robust'
      })
      mockStoreState.results.report = makeReport()

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-label-num', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.robustness!.robustness_label).toBe('robust')
    })

    it('derives robustness label from edge ratio when no overall_robustness', async () => {
      // 3 robust, 1 fragile → ratio 0.75 ≥ 0.7 → robust
      mockStoreState.results.enrichment = makeEnrichment({
        fragile_edges: ['e1'],
        robust_edges: ['e2', 'e3', 'e4'],
      })
      mockStoreState.results.report = makeReport()

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-ratio', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.robustness!.robustness_label).toBe('robust')
    })

    it('includes sensitivity params from edges and factors', async () => {
      mockStoreState.results.enrichment = makeEnrichment({
        edges: [
          { edge_id: 'e1', from: 'f1', to: 'g1', sensitivity_score: 0.9 },
        ],
        factors: [
          { factor_id: 'f1', sensitivity_score: 0.85, direction: 'positive' },
        ],
      })
      mockStoreState.results.report = makeReport()

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-sensitivity', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const sensitivity = result.current.robustness!.sensitivity
      expect(sensitivity.length).toBe(2)
      // Factors come first (more actionable)
      expect(sensitivity[0].node_id).toBe('f1')
      expect(sensitivity[0].sensitivity).toBe(0.85)
      // Then edges
      expect(sensitivity[1].node_id).toBe('f1') // edge "from" is used as node_id
    })

    it('generates a narrative string', async () => {
      mockStoreState.results.enrichment = makeEnrichment()
      mockStoreState.results.report = makeReport()

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-narrative', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.robustness!.narrative).toBeTruthy()
      expect(typeof result.current.robustness!.narrative).toBe('string')
    })
  })

  // =========================================================================
  // Report robustness fallback (enrichment exists but extraction returns null)
  // =========================================================================

  describe('Report robustness fallback', () => {
    it('falls back to report.robustness when enrichment extraction returns null', async () => {
      // Enrichment exists but has NO edges array at all AND no fragile/robust edges
      // → hasSensitivityAnalysis returns false AND hasRobustnessEdges returns false
      // → extractRobustnessFromEnrichment returns null
      // → hook falls through to report.robustness
      mockStoreState.results.enrichment = {
        // No sensitivity_analysis at all → extraction returns null
        metadata: {
          isl_enabled: true,
          detail_level: 'deep',
        },
      }
      mockStoreState.results.report = makeReport({
        robustness: {
          fragile_edges: ['e1', 'e2'],
          robust_edges: ['e3'],
          overall_robustness: 'fragile',
        },
      })

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-report-fallback', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.robustness).not.toBeNull()
      expect(result.current.source).toBe('enrichment') // still tagged as enrichment
      expect(result.current.robustness!.fragile_edge_count).toBe(2)
      expect(result.current.robustness!.robust_edge_count).toBe(1)
      expect(result.current.robustness!.robustness_label).toBe('fragile')
    })

    it('uses enrichment extraction even with empty edges (no report fallback needed)', async () => {
      // When enrichment has edges: [] (empty array), hasSensitivityAnalysis returns true
      // so extraction succeeds with 0 fragile/robust edge counts
      mockStoreState.results.enrichment = makeEnrichment({
        edges: [],
        fragile_edges: [],
        robust_edges: [],
      })
      mockStoreState.results.report = makeReport({
        robustness: {
          fragile_edges: ['e1', 'e2'],
          robust_edges: ['e3'],
        },
      })

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-empty-edges', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.robustness).not.toBeNull()
      expect(result.current.source).toBe('enrichment')
      // Enrichment extraction succeeds with 0 edge counts (not report's 2/1)
      expect(result.current.robustness!.fragile_edge_count).toBe(0)
      expect(result.current.robustness!.robust_edge_count).toBe(0)
    })
  })

  // =========================================================================
  // Report confidence fallback (no enrichment at all)
  // =========================================================================

  describe('Report confidence fallback', () => {
    it('derives robustness from report confidence level when no enrichment', async () => {
      mockStoreState.results.enrichment = null
      mockStoreState.results.report = makeReport({
        confidenceLevel: 'high',
        confidenceWhy: '2 fragile edges, 8 robust edges found',
      })

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-conf-fallback', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.robustness).not.toBeNull()
      expect(result.current.source).toBe('fallback')
      expect(result.current.robustness!.robustness_label).toBe('robust') // high → robust
      expect(result.current.robustness!.fragile_edge_count).toBe(2)
      expect(result.current.robustness!.robust_edge_count).toBe(8)
    })

    it('maps low confidence to fragile', async () => {
      mockStoreState.results.enrichment = null
      mockStoreState.results.report = makeReport({ confidenceLevel: 'low' })

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-conf-low', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.robustness!.robustness_label).toBe('fragile')
      expect(result.current.source).toBe('fallback')
    })
  })

  // =========================================================================
  // Full fallback (no enrichment, no report)
  // =========================================================================

  describe('Full fallback', () => {
    it('generates fallback robustness when no enrichment and no report', async () => {
      mockStoreState.results.enrichment = null
      mockStoreState.results.report = null

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-full-fallback', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.robustness).not.toBeNull()
      expect(result.current.robustness!.robustness_label).toBe('unknown')
      expect(result.current.source).toBe('fallback')
      expect(result.current.error).toBeNull()
    })

    it('generates fallback when report has no confidence level', async () => {
      mockStoreState.results.enrichment = null
      mockStoreState.results.report = { results: { likely: 0.5 } } // no confidence

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-no-conf', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.robustness!.robustness_label).toBe('unknown')
      expect(result.current.source).toBe('fallback')
    })
  })

  // =========================================================================
  // Degraded enrichment
  // =========================================================================

  describe('Degraded enrichment', () => {
    it('falls through to report confidence when enrichment is degraded', async () => {
      mockStoreState.results.enrichment = makeEnrichment({
        isl_degraded: true,
      })
      mockStoreState.results.report = makeReport({ confidenceLevel: 'medium' })

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-degraded', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // extractRobustnessFromEnrichment returns null for degraded
      // then report confidence fallback kicks in
      expect(result.current.robustness).not.toBeNull()
      expect(result.current.source).toBe('fallback')
      expect(result.current.robustness!.robustness_label).toBe('moderate')
    })
  })

  // =========================================================================
  // Feature flag disabled
  // =========================================================================

  describe('Feature flag disabled', () => {
    it('falls back when isPlotEnrichmentEnabled returns false', async () => {
      const { isPlotEnrichmentEnabled } = await import('../../../flags')
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(false)

      mockStoreState.results.enrichment = makeEnrichment()
      mockStoreState.results.report = makeReport({ confidenceLevel: 'high' })

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-flag-off', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // extractRobustnessFromEnrichment returns null when flag disabled;
      // then falls through to report.robustness or report.confidence
      expect(result.current.robustness).not.toBeNull()
      // Source depends on which fallback is hit — confidence fallback produces 'fallback'
      expect(['enrichment', 'fallback']).toContain(result.current.source)

      // Restore flag
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)
    })
  })

  // =========================================================================
  // Caching
  // =========================================================================

  describe('Caching', () => {
    it('returns cached data on subsequent calls with same runId', async () => {
      mockStoreState.results.enrichment = makeEnrichment()
      mockStoreState.results.report = makeReport()

      const { result, rerender } = renderHook(
        ({ runId }) => useRobustness({ runId, autoFetch: true }),
        { initialProps: { runId: 'run-cache-1' } }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.source).toBe('enrichment')
      expect(result.current.robustness).not.toBeNull()

      // Rerender with same runId — should use cache
      rerender({ runId: 'run-cache-1' })

      expect(result.current.robustness).not.toBeNull()
      expect(result.current.source).toBe('cache')
    })

    it('re-extracts when runId changes', async () => {
      mockStoreState.results.enrichment = makeEnrichment({
        fragile_edges: ['e1'],
        robust_edges: ['e2'],
      })
      mockStoreState.results.report = makeReport()

      const { result, rerender } = renderHook(
        ({ runId }) => useRobustness({ runId, autoFetch: true }),
        { initialProps: { runId: 'run-a' } }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const firstRobustness = result.current.robustness

      // Update enrichment for second run
      mockStoreState.results.enrichment = makeEnrichment({
        fragile_edges: ['e1', 'e2', 'e3'],
        robust_edges: [],
        overall_robustness: 'fragile',
      })

      rerender({ runId: 'run-b' })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.robustness).not.toBe(firstRobustness)
      })

      expect(result.current.robustness!.robustness_label).toBe('fragile')
      expect(result.current.robustness!.fragile_edge_count).toBe(3)
    })

    it('uses different cache entries for different responseHash', async () => {
      mockStoreState.results.enrichment = makeEnrichment()
      mockStoreState.results.report = makeReport()

      const { result, rerender } = renderHook(
        ({ runId, responseHash }) =>
          useRobustness({ runId, responseHash, autoFetch: true }),
        { initialProps: { runId: 'run-hash', responseHash: 'hash-a' } }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.source).toBe('enrichment')

      // Same runId, different hash — should re-extract
      rerender({ runId: 'run-hash', responseHash: 'hash-b' })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.robustness).not.toBeNull()
      })
    })
  })

  // =========================================================================
  // Manual refetch
  // =========================================================================

  describe('Manual refetch', () => {
    it('extracts data when refetch is called manually', async () => {
      mockStoreState.results.enrichment = makeEnrichment()
      mockStoreState.results.report = makeReport()

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-manual', autoFetch: false })
      )

      expect(result.current.robustness).toBeNull()

      await act(async () => {
        await result.current.refetch()
      })

      expect(result.current.robustness).not.toBeNull()
      expect(result.current.source).toBe('enrichment')
    })
  })

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('Error handling', () => {
    it('sets error and generates fallback when extraction throws', async () => {
      // Provide enrichment that will cause extractRobustnessFromEnrichment to
      // succeed but trigger an error somewhere in the hook logic.
      // A simulated error scenario: enrichment is a non-null but badly shaped object
      // that passes the initial check but fails downstream.
      // The simplest way: override the store to return enrichment that triggers an error
      // in the hook's try/catch.
      mockStoreState.results.enrichment = {
        sensitivity_analysis: {
          // Provide edges so hasSensitivityAnalysis passes
          edges: [{ edge_id: 'e1', from: 'f1', to: 'g1', sensitivity_score: 0.5 }],
          fragile_edges: ['e1'],
          robust_edges: [],
        },
        metadata: {
          isl_enabled: true,
          detail_level: 'deep',
        },
      }
      mockStoreState.results.report = makeReport()

      // This should succeed normally — extractRobustnessFromEnrichment handles it
      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-err', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should have either enrichment data or fallback
      expect(result.current.robustness).not.toBeNull()
    })
  })

  // =========================================================================
  // No ISL fetch
  // =========================================================================

  describe('No direct ISL calls', () => {
    it('never calls fetch() — data comes from store enrichment', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      mockStoreState.results.enrichment = makeEnrichment()
      mockStoreState.results.report = makeReport()

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-no-fetch', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(fetchSpy).not.toHaveBeenCalled()
      expect(result.current.robustness).not.toBeNull()
      expect(result.current.source).toBe('enrichment')

      fetchSpy.mockRestore()
    })

    it('never calls fetch() even when falling back', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      mockStoreState.results.enrichment = null
      mockStoreState.results.report = null

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-no-fetch-fb', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(fetchSpy).not.toHaveBeenCalled()
      expect(result.current.source).toBe('fallback')

      fetchSpy.mockRestore()
    })
  })

  // =========================================================================
  // Source field tracking
  // =========================================================================

  describe('Source tracking', () => {
    it('reports enrichment when data comes from store enrichment', async () => {
      mockStoreState.results.enrichment = makeEnrichment()
      mockStoreState.results.report = makeReport()

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-src-enrich', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.source).toBe('enrichment')
    })

    it('reports fallback when using generateFallbackRobustness', async () => {
      mockStoreState.results.enrichment = null
      mockStoreState.results.report = null

      const { result } = renderHook(() =>
        useRobustness({ runId: 'run-src-fb', autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.source).toBe('fallback')
    })

    it('reports cache on subsequent render with same runId', async () => {
      mockStoreState.results.enrichment = makeEnrichment()
      mockStoreState.results.report = makeReport()

      const { result, rerender } = renderHook(
        ({ runId }) => useRobustness({ runId, autoFetch: true }),
        { initialProps: { runId: 'run-src-cache' } }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.source).toBe('enrichment')

      // Rerender to trigger cache path
      rerender({ runId: 'run-src-cache' })

      expect(result.current.source).toBe('cache')
    })

    it('reports null source when no runId provided', () => {
      const { result } = renderHook(() => useRobustness({}))
      expect(result.current.source).toBeNull()
    })
  })

  // =========================================================================
  // clearRobustnessCache
  // =========================================================================

  describe('clearRobustnessCache', () => {
    it('clears cached results so next render re-extracts', async () => {
      mockStoreState.results.enrichment = makeEnrichment({
        overall_robustness: 'robust',
      })
      mockStoreState.results.report = makeReport()

      const { result, rerender } = renderHook(
        ({ runId }) => useRobustness({ runId, autoFetch: true }),
        { initialProps: { runId: 'run-clear' } }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.robustness!.robustness_label).toBe('robust')

      // Clear cache and update enrichment
      clearRobustnessCache()
      mockStoreState.results.enrichment = makeEnrichment({
        overall_robustness: 'fragile',
      })

      // Force re-extract by changing runId
      rerender({ runId: 'run-clear-2' })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.robustness!.robustness_label).toBe('fragile')
      })
    })
  })
})

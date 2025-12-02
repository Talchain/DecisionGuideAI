/**
 * useCompareData Hook Tests
 *
 * Tests for compare data fetching and calculation:
 * - Delta calculation from run outcomes
 * - Change drivers extraction from explain_delta
 * - Structural diff API integration
 * - Loading and error states
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCompareData } from '../useCompareData'
import * as runHistory from '../../../../canvas/store/runHistory'
import type { StoredRun } from '../../../../canvas/store/runHistory'

// Mock the runHistory module
vi.mock('../../../../canvas/store/runHistory', () => ({
  loadRuns: vi.fn(),
}))

// Mock fetch
global.fetch = vi.fn()

const mockRunA: StoredRun = {
  id: 'run-a',
  ts: Date.now() - 86400000,
  seed: 123,
  hash: 'hash-a',
  templateId: undefined,
  adapter: 'httpv1',
  summary: 'Baseline Run',
  graphHash: 'graph-hash-a',
  report: {
    outcome: {
      value: 15.5,
      confidence: { level: 'medium' },
    },
    explain_delta: {
      top_drivers: [
        {
          node_id: 'node-1',
          node_label: 'Market Demand',
          contribution: 0.6,
        },
      ],
    },
  } as any,
  graph: {
    nodes: [{ id: 'node-1', data: { label: 'Market Demand' } }],
    edges: [],
  } as any,
}

const mockRunB: StoredRun = {
  id: 'run-b',
  ts: Date.now(),
  seed: 456,
  hash: 'hash-b',
  templateId: undefined,
  adapter: 'httpv1',
  summary: 'Current Run',
  graphHash: 'graph-hash-b',
  report: {
    outcome: {
      value: 22.3,
      confidence: { level: 'high' },
    },
    explain_delta: {
      top_drivers: [
        {
          node_id: 'node-1',
          node_label: 'Market Demand',
          contribution: 0.5,
        },
        {
          node_id: 'node-2',
          node_label: 'Product Quality',
          contribution: -0.2,
        },
      ],
    },
  } as any,
  graph: {
    nodes: [
      { id: 'node-1', data: { label: 'Market Demand' } },
      { id: 'node-2', data: { label: 'Product Quality' } },
    ],
    edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }],
  } as any,
}

describe('useCompareData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(runHistory.loadRuns).mockReturnValue([mockRunA, mockRunB])

    // Default fetch mock to prevent errors in tests that don't explicitly test fetch
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        nodes_added: [],
        nodes_removed: [],
        edges_added: [],
        edges_removed: [],
      }),
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Run Selection', () => {
    it('returns null baseline and current when no runs selected', () => {
      const { result } = renderHook(() =>
        useCompareData({
          baselineRunId: null,
          currentRunId: null,
        })
      )

      expect(result.current.baseline).toBeNull()
      expect(result.current.current).toBeNull()
      expect(result.current.delta).toBeNull()
    })

    it('loads baseline and current runs from localStorage', () => {
      const { result } = renderHook(() =>
        useCompareData({
          baselineRunId: 'run-a',
          currentRunId: 'run-b',
        })
      )

      expect(result.current.baseline).toEqual(mockRunA)
      expect(result.current.current).toEqual(mockRunB)
    })
  })

  describe('Delta Calculation', () => {
    it('calculates positive delta correctly', () => {
      const { result } = renderHook(() =>
        useCompareData({
          baselineRunId: 'run-a',
          currentRunId: 'run-b',
        })
      )

      expect(result.current.delta).toMatchObject({
        value: expect.closeTo(6.8, 0.01),
        percentage: expect.closeTo(43.87, 0.01),
        direction: 'increase',
      })
    })

    it('calculates negative delta correctly', () => {
      const { result } = renderHook(() =>
        useCompareData({
          baselineRunId: 'run-b',
          currentRunId: 'run-a',
        })
      )

      expect(result.current.delta).toMatchObject({
        value: expect.closeTo(-6.8, 0.01),
        percentage: expect.closeTo(-30.49, 0.01),
        direction: 'decrease',
      })
    })

    it('handles zero delta', () => {
      const sameRun = { ...mockRunA, id: 'run-same' }
      vi.mocked(runHistory.loadRuns).mockReturnValue([mockRunA, sameRun])

      const { result } = renderHook(() =>
        useCompareData({
          baselineRunId: 'run-a',
          currentRunId: 'run-same',
        })
      )

      expect(result.current.delta?.direction).toBe('unchanged')
      expect(result.current.delta?.value).toBe(0)
    })

    it('handles missing outcome values', () => {
      const runWithoutOutcome = { ...mockRunA, report: {} } as any
      vi.mocked(runHistory.loadRuns).mockReturnValue([runWithoutOutcome, mockRunB])

      const { result } = renderHook(() =>
        useCompareData({
          baselineRunId: runWithoutOutcome.id,
          currentRunId: 'run-b',
        })
      )

      // Should default to 0 for missing values
      expect(result.current.delta).toBeDefined()
    })
  })

  describe('Change Drivers', () => {
    it('extracts change drivers from explain_delta', () => {
      const { result } = renderHook(() =>
        useCompareData({
          baselineRunId: 'run-a',
          currentRunId: 'run-b',
        })
      )

      expect(result.current.changeDrivers).toHaveLength(2)
      expect(result.current.changeDrivers[0]).toEqual({
        nodeId: 'node-1',
        nodeLabel: 'Market Demand',
        contribution: 0.5,
        direction: 'positive',
      })
      expect(result.current.changeDrivers[1]).toEqual({
        nodeId: 'node-2',
        nodeLabel: 'Product Quality',
        contribution: -0.2,
        direction: 'negative',
      })
    })

    it('returns empty array when explain_delta is missing', () => {
      const runWithoutExplain = {
        ...mockRunB,
        report: { outcome: { value: 20 } },
      } as any
      vi.mocked(runHistory.loadRuns).mockReturnValue([mockRunA, runWithoutExplain])

      const { result } = renderHook(() =>
        useCompareData({
          baselineRunId: 'run-a',
          currentRunId: runWithoutExplain.id,
        })
      )

      expect(result.current.changeDrivers).toEqual([])
    })

    it('handles missing node_label gracefully', () => {
      const runWithoutLabels = {
        ...mockRunB,
        report: {
          outcome: { value: 20 },
          explain_delta: {
            top_drivers: [{ node_id: 'node-x', contribution: 0.3 }],
          },
        },
      } as any
      vi.mocked(runHistory.loadRuns).mockReturnValue([mockRunA, runWithoutLabels])

      const { result } = renderHook(() =>
        useCompareData({
          baselineRunId: 'run-a',
          currentRunId: runWithoutLabels.id,
        })
      )

      // Should fall back to node_id, or 'Unknown Node' if node_id is missing
      expect(result.current.changeDrivers[0].nodeLabel).toBe('node-x')
    })
  })

  describe('Structural Diff API', () => {
    it('fetches structural diff from /v1/diff endpoint', async () => {
      const mockDiffResponse = {
        nodes_added: [{ id: 'node-2' }],
        nodes_removed: [],
        edges_added: [{ id: 'edge-1' }],
        edges_removed: [],
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDiffResponse,
      } as Response)

      const { result } = renderHook(() =>
        useCompareData({
          baselineRunId: 'run-a',
          currentRunId: 'run-b',
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(fetch).toHaveBeenCalledWith('/bff/engine/v1/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph_a: mockRunA.graph,
          graph_b: mockRunB.graph,
        }),
      })

      expect(result.current.structuralDiff).toEqual({
        nodesAdded: 1,
        nodesRemoved: 0,
        edgesAdded: 1,
        edgesRemoved: 0,
        details: mockDiffResponse,
      })
    })

    it('handles API errors gracefully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response)

      const { result } = renderHook(() =>
        useCompareData({
          baselineRunId: 'run-a',
          currentRunId: 'run-b',
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toContain('500')
      expect(result.current.structuralDiff).toBeNull()
    })

    it('does not fetch diff when runs are missing', () => {
      const { result } = renderHook(() =>
        useCompareData({
          baselineRunId: null,
          currentRunId: 'run-b',
        })
      )

      expect(fetch).not.toHaveBeenCalled()
      expect(result.current.structuralDiff).toBeNull()
    })
  })

  describe('Loading States', () => {
    it('sets loading to true while fetching', async () => {
      let resolvePromise: (value: any) => void
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(fetch).mockReturnValueOnce(fetchPromise as any)

      const { result } = renderHook(() =>
        useCompareData({
          baselineRunId: 'run-a',
          currentRunId: 'run-b',
        })
      )

      // Initially loading should be true
      await waitFor(() => {
        expect(result.current.loading).toBe(true)
      })

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => ({
          nodes_added: [],
          nodes_removed: [],
          edges_added: [],
          edges_removed: [],
        }),
      })

      // Loading should become false
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })
})

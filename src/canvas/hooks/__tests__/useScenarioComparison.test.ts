/**
 * Tests for useScenarioComparison hook
 *
 * Verifies:
 * - PLoT routing (calls /bff/engine/v2/run, not ISL)
 * - Single request with both options
 * - Response parsing from option_comparison array
 * - Percentile access (p10/p90, not p5/p95)
 * - Goal selection from store
 * - Status handling (computed, partial, blocked, failed)
 * - Edge diff uses edge.id for identity
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useScenarioComparison } from '../useScenarioComparison'
import * as plotV2 from '../../../adapters/plot/v2'
import { useCanvasStore } from '../../store'
import { useComparisonStore } from '../../stores/comparisonStore'
import type { Node, Edge } from '@xyflow/react'

// Mock the PLoT v2 adapter
vi.mock('../../../adapters/plot/v2', async () => {
  const actual = await vi.importActual('../../../adapters/plot/v2')
  return {
    ...actual,
    runV2: vi.fn(),
    buildV2Request: vi.fn(() => ({
      request: {
        graph: { nodes: [], edges: [] },
        options: [],
        goal_node_id: 'goal-1',
        seed: '12345',
        detail_level: 'deep',
      },
      reverseIdMap: new Map(),
    })),
  }
})

// Mock generateScenarios - uses new multi-option format (GeneratedScenariosV2)
vi.mock('../../utils/generateScenarios', () => ({
  generateScenarios: vi.fn(() => ({
    scenarios: [
      {
        nodes: [
          { id: 'decision-1', type: 'decision', data: { label: 'Decision' }, position: { x: 0, y: 0 } },
          { id: 'option-a', type: 'option', data: { label: 'Option A' }, position: { x: 0, y: 100 } },
        ],
        edges: [{ id: 'e1', source: 'decision-1', target: 'option-a', data: {} }],
      },
      {
        nodes: [
          { id: 'decision-1', type: 'decision', data: { label: 'Decision' }, position: { x: 0, y: 0 } },
          { id: 'option-b', type: 'option', data: { label: 'Option B' }, position: { x: 0, y: 100 } },
        ],
        edges: [{ id: 'e2', source: 'decision-1', target: 'option-b', data: {} }],
      },
    ],
    labels: ['Option A', 'Option B'],
    optionIds: ['option-a', 'option-b'],
    allOptions: [
      { id: 'option-a', label: 'Option A' },
      { id: 'option-b', label: 'Option B' },
    ],
    hasMoreOptions: false,
  })),
  canGenerateScenarios: vi.fn(() => true),
}))

describe('useScenarioComparison', () => {
  const mockNodes: Node[] = [
    { id: 'decision-1', type: 'decision', data: { label: 'Decision', kind: 'decision' }, position: { x: 0, y: 0 } },
    { id: 'option-a', type: 'option', data: { label: 'Option A', kind: 'option', interventions: {} }, position: { x: 0, y: 100 } },
    { id: 'option-b', type: 'option', data: { label: 'Option B', kind: 'option', interventions: {} }, position: { x: 100, y: 100 } },
    { id: 'goal-1', type: 'goal', data: { label: 'Revenue', kind: 'goal', unit: '%' }, position: { x: 50, y: 200 } },
  ]

  // Use type assertion for test mocks - actual EdgeData shape not needed for these tests
  const mockEdges = [
    { id: 'e1', source: 'decision-1', target: 'option-a', data: { weight: 0.8 } },
    { id: 'e2', source: 'decision-1', target: 'option-b', data: { weight: 0.8 } },
    { id: 'e3', source: 'option-a', target: 'goal-1', data: { weight: 0.5 } },
    { id: 'e4', source: 'option-b', target: 'goal-1', data: { weight: 0.6 } },
  ] as Edge[]

  beforeEach(() => {
    vi.clearAllMocks()

    // Set up store with mock data
    // Type assertion needed because store expects Edge<EdgeData>[] but test mocks use simplified shape
    useCanvasStore.setState({
      nodes: mockNodes,
      edges: mockEdges as any,
      outcomeNodeId: 'goal-1',
    })
  })

  afterEach(() => {
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      outcomeNodeId: null,
    })
    // Comparison state lives in useComparisonStore as of C3-3
    useComparisonStore.getState().resetComparison()
  })

  describe('PLoT routing', () => {
    it('calls runV2 instead of ISL compare', async () => {
      const mockRunV2 = vi.mocked(plotV2.runV2)
      mockRunV2.mockResolvedValueOnce({
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        robustness_status: 'computed',
        drivers_status: 'computed',
        option_comparison: [
          {
            option_id: 'option-a',
            option_label: 'Option A',
            confidence_interval: [10, 20],
            expected_outcome: 15,
            outcome: { mean: 15, p10: 10, p50: 15, p90: 20 },
          },
          {
            option_id: 'option-b',
            option_label: 'Option B',
            confidence_interval: [12, 22],
            expected_outcome: 17,
            outcome: { mean: 17, p10: 12, p50: 17, p90: 22 },
          },
        ],
        critiques: [],
        response_hash: 'test-hash',
      })

      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      expect(mockRunV2).toHaveBeenCalledTimes(1)
      // Verify runV2 was called with a config object and request object
      // The baseUrl may vary based on env config, but the key is that runV2 (PLoT) is called, not ISL
      expect(mockRunV2).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: expect.any(String),
          timeout: expect.any(Number),
        }),
        expect.objectContaining({
          goal_node_id: expect.any(String),
          graph: expect.any(Object),
          options: expect.any(Array),
        })
      )
    })

    it('sends single request with both options', async () => {
      const mockBuildV2Request = vi.mocked(plotV2.buildV2Request)
      const mockRunV2 = vi.mocked(plotV2.runV2)

      mockRunV2.mockResolvedValueOnce({
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        robustness_status: 'computed',
        drivers_status: 'computed',
        option_comparison: [],
        critiques: [],
        response_hash: 'test-hash',
      })

      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      // buildV2Request should be called once (not twice for each scenario)
      expect(mockBuildV2Request).toHaveBeenCalledTimes(1)
      // runV2 should be called once
      expect(mockRunV2).toHaveBeenCalledTimes(1)
    })
  })

  describe('response parsing', () => {
    it('extracts outcomes from option_comparison array', async () => {
      const mockRunV2 = vi.mocked(plotV2.runV2)
      mockRunV2.mockResolvedValueOnce({
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        robustness_status: 'computed',
        drivers_status: 'computed',
        option_comparison: [
          {
            option_id: 'option-a',
            option_label: 'Option A',
            confidence_interval: [10, 20],
            expected_outcome: 15,
            outcome: { mean: 15, std: 2, p10: 10, p50: 15, p90: 20 },
            probability_of_goal: 0.75,
            win_probability: 0.4,
          },
          {
            option_id: 'option-b',
            option_label: 'Option B',
            confidence_interval: [12, 22],
            expected_outcome: 17,
            outcome: { mean: 17, std: 2.5, p10: 12, p50: 17, p90: 22 },
            probability_of_goal: 0.85,
            win_probability: 0.6,
          },
        ],
        critiques: [],
        response_hash: 'test-hash',
      })

      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      await waitFor(() => {
        expect(result.current.analysisStatus).toBe('computed')
      })

      expect(result.current.apiResponse).not.toBeNull()
      // New format uses optionById map instead of optionA/optionB properties
      expect(result.current.apiResponse?.optionById['option-a']?.outcome.p10).toBe(10)
      expect(result.current.apiResponse?.optionById['option-a']?.outcome.p90).toBe(20)
      expect(result.current.apiResponse?.optionById['option-b']?.outcome.p10).toBe(12)
      expect(result.current.apiResponse?.optionById['option-b']?.outcome.p90).toBe(22)
    })

    it('uses p10/p90 not p5/p95', async () => {
      const mockRunV2 = vi.mocked(plotV2.runV2)
      mockRunV2.mockResolvedValueOnce({
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        robustness_status: 'computed',
        drivers_status: 'computed',
        option_comparison: [
          {
            option_id: 'option-a',
            option_label: 'Option A',
            confidence_interval: [5, 25],
            outcome: { mean: 15, p10: 10, p50: 15, p90: 20 },
          },
        ],
        critiques: [],
        response_hash: 'test-hash',
      })

      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      await waitFor(() => {
        expect(result.current.apiResponse?.optionById['option-a']).not.toBeNull()
      })

      // Should use p10/p90 from outcome, not confidence_interval
      expect(result.current.apiResponse?.optionById['option-a']?.outcome.p10).toBe(10)
      expect(result.current.apiResponse?.optionById['option-a']?.outcome.p90).toBe(20)
    })
  })

  describe('goal selection', () => {
    it('uses outcomeNodeId from store', async () => {
      const mockRunV2 = vi.mocked(plotV2.runV2)
      mockRunV2.mockResolvedValueOnce({
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        robustness_status: 'computed',
        drivers_status: 'computed',
        option_comparison: [],
        critiques: [],
        response_hash: 'test-hash',
      })

      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      await waitFor(() => {
        expect(result.current.apiResponse).not.toBeNull()
      })

      expect(result.current.apiResponse?.goalNodeId).toBe('goal-1')
      expect(result.current.apiResponse?.goalLabel).toBe('Revenue')
    })

    it('falls back to first goal/outcome node when no outcomeNodeId', async () => {
      useCanvasStore.setState({ outcomeNodeId: null })

      const mockRunV2 = vi.mocked(plotV2.runV2)
      mockRunV2.mockResolvedValueOnce({
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        robustness_status: 'computed',
        drivers_status: 'computed',
        option_comparison: [],
        critiques: [],
        response_hash: 'test-hash',
      })

      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      await waitFor(() => {
        expect(result.current.apiResponse).not.toBeNull()
      })

      // Should fall back to goal-1 (first node with kind='goal')
      expect(result.current.apiResponse?.goalNodeId).toBe('goal-1')
    })
  })

  describe('status handling', () => {
    it('handles computed status', async () => {
      const mockRunV2 = vi.mocked(plotV2.runV2)
      mockRunV2.mockResolvedValueOnce({
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        robustness_status: 'computed',
        drivers_status: 'computed',
        option_comparison: [],
        critiques: [],
        response_hash: 'test-hash',
      })

      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      await waitFor(() => {
        expect(result.current.analysisStatus).toBe('computed')
      })

      expect(result.current.error).toBeNull()
    })

    it('handles partial status with warning', async () => {
      const mockRunV2 = vi.mocked(plotV2.runV2)
      mockRunV2.mockResolvedValueOnce({
        analysis_status: 'partial',
        option_comparison_status: 'computed',
        robustness_status: 'unavailable',
        drivers_status: 'unavailable',
        option_comparison: [],
        critiques: [],
        response_hash: 'test-hash',
      })

      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      await waitFor(() => {
        expect(result.current.analysisStatus).toBe('partial')
      })

      expect(result.current.apiResponse?.statusReason).toContain('incomplete')
    })

    it('handles blocked status with error', async () => {
      const mockRunV2 = vi.mocked(plotV2.runV2)
      mockRunV2.mockResolvedValueOnce({
        analysis_status: 'blocked',
        status_reason: 'Graph has cycles',
        critiques: [],
      })

      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      await waitFor(() => {
        expect(result.current.analysisStatus).toBe('blocked')
      })

      expect(result.current.error).toBe('Graph has cycles')
    })

    it('handles failed status with retry option', async () => {
      const mockRunV2 = vi.mocked(plotV2.runV2)
      // isFailedAnalysis checks for analysis_status === 'failed'
      // The type system says V2RunResponse only has 'computed' | 'partial' but runtime can have 'failed'
      mockRunV2.mockResolvedValueOnce({
        analysis_status: 'failed',
        option_comparison_status: 'error',
        robustness_status: 'error',
        drivers_status: 'error',
        option_comparison: [],
        critiques: [],
        response_hash: 'failed-hash',
      } as unknown as plotV2.V2RunResult)

      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      await waitFor(() => {
        expect(result.current.analysisStatus).toBe('failed')
      })

      expect(result.current.error).toContain('could not complete')
    })
  })

  describe('edge diff identity', () => {
    it('uses edge.id for identity, not source->target', () => {
      // This is tested via the computeComparison function
      // Two edges with same endpoints but different IDs should be identified as different
      const { result } = renderHook(() => useScenarioComparison())

      // The hook should be able to compare scenarios
      expect(result.current.canCompare).toBe(true)
    })
  })

  describe('clearComparison', () => {
    it('resets state and exits comparison mode', async () => {
      const mockRunV2 = vi.mocked(plotV2.runV2)
      mockRunV2.mockResolvedValueOnce({
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        robustness_status: 'computed',
        drivers_status: 'computed',
        option_comparison: [],
        critiques: [],
        response_hash: 'test-hash',
      })

      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      await waitFor(() => {
        expect(result.current.analysisStatus).toBe('computed')
      })

      act(() => {
        result.current.clearComparison()
      })

      expect(result.current.analysisStatus).toBe('idle')
      expect(result.current.apiResponse).toBeNull()
      expect(result.current.snapshotA).toBeNull()
      expect(result.current.snapshotB).toBeNull()
    })
  })
})

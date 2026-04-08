/**
 * handleEnvelope arbitration — CEE analysis_ready primary path vs synthesis fallback.
 *
 * Tests that handleEnvelope:
 * 1. Uses CEE-provided analysis_ready when present and valid (does NOT call synthesis)
 * 2. Falls back to synthesis when analysis_ready is absent
 * 3. Falls back to synthesis when analysis_ready fails contract validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCallTurn = vi.fn()
vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  OrchestratorError: class OrchestratorError extends Error {
    status: number
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.name = 'OrchestratorError'
      this.status = status
      this.body = body
    }
  },
}))

vi.mock('../../../flags', () => ({
  isOrchestratorV2Enabled: () => true,
  isOrchestratorStreamingEnabled: () => false,
}))

vi.mock('../../../adapters/plot/v2', () => ({
  isSuccessfulAnalysis: () => false,
  isBlockedResponse: () => false,
  isFailedAnalysis: () => false,
  validateV2RunResponseFull: () => ({ softWarnings: [] }),
  sanitizeV2RunResponse: (r: unknown) => r,
  // buildRequest calls reconcileOptionsWithCanvasNodes when assembling
  // analysis_inputs. These tests don't exercise option reconciliation, so a
  // pass-through that returns the analysisReady options (or empty array) is
  // sufficient. Without this stub the import resolves to undefined and the
  // call throws "is not a function" before the orchestrator turn fires.
  reconcileOptionsWithCanvasNodes: (analysisReady: any) =>
    Array.isArray(analysisReady?.options) ? analysisReady.options : [],
}))

vi.mock('../../../adapters/plot/v2/responseMapper', () => ({
  mapV2ResponseToReportV1: () => ({ id: 'mock-report', graph_quality: null }),
  createEnrichmentFromV2Response: () => null,
  synthesizeCeeReviewFromV2: () => null,
  synthesizeCeeTraceFromV2: () => null,
}))

// Spy on applyAutoApplyPatch and synthesiseCeeAnalysisReady.
// applyAutoApplyPatch must return a valid result; synthesiseCeeAnalysisReady
// returns a synthesis so we can detect if it was called.
const mockSynthesise = vi.fn()
const mockApplyPatch = vi.fn()

vi.mock('../utils/applyPatch', () => ({
  applyAutoApplyPatch: (...args: unknown[]) => mockApplyPatch(...args),
  synthesiseCeeAnalysisReady: (...args: unknown[]) => mockSynthesise(...args),
}))

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const mockSetCeeAnalysisReady = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  mockCallTurn.mockReset()
  mockSynthesise.mockReset()
  mockApplyPatch.mockReset()
  mockSetCeeAnalysisReady.mockReset()

  // applyAutoApplyPatch must return a valid result so handleEnvelope proceeds
  mockApplyPatch.mockReturnValue({
    addedNodeCount: 1,
    addedEdgeCount: 0,
    modifiedIds: ['node-1'],
  })

  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    nodes: [],
    edges: [],
    results: { status: 'idle' } as any,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    ceeAnalysisReady: null,
    ceeAnalysisReadyNodeIds: null,
    outcomeNodeId: null,
    setCeeAnalysisReady: mockSetCeeAnalysisReady,
    pushHistory: vi.fn(),
    beginExternalGraphMutation: vi.fn(),
    endExternalGraphMutation: vi.fn(),
  } as any)
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleEnvelope — analysis_ready arbitration', () => {
  it('uses CEE-provided analysis_ready and does NOT call synthesis', async () => {
    const ceeAnalysisReady = {
      status: 'ready',
      goal_node_id: 'goal_1',
      options: [
        {
          id: 'opt_a',
          label: 'Option A',
          status: 'ready',
          interventions: { f1: { value: 1, source: 'brief_extraction' } },
        },
      ],
    }

    mockCallTurn.mockResolvedValue({
      assistant_text: 'Here is your model.',
      blocks: [
        {
          block_type: 'graph_patch',
          block_id: 'patch-1',
          data: {
            operations: [
              { op: 'add_node', target_id: 'node-1', data: { kind: 'goal', label: 'Goal' } },
            ],
            auto_apply: true,
            analysis_ready: ceeAnalysisReady,
          },
        },
      ],
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Build a model')
    })

    // Primary path: setCeeAnalysisReady called with CEE data
    expect(mockSetCeeAnalysisReady).toHaveBeenCalledTimes(1)
    const storedReady = mockSetCeeAnalysisReady.mock.calls[0][0]
    expect(storedReady.goal_node_id).toBe('goal_1')
    expect(storedReady.options[0].id).toBe('opt_a')

    // Synthesis should NOT have been called
    expect(mockSynthesise).not.toHaveBeenCalled()
  })

  it('falls back to synthesis when analysis_ready is absent', async () => {
    const synthesisResult = {
      status: 'ready',
      goal_node_id: 'goal_synth',
      options: [{ id: 'opt_synth', label: 'Synthesised', status: 'ready', interventions: { f1: { value: 0.5, source: 'cee_hypothesis' } } }],
    }
    mockSynthesise.mockReturnValue(synthesisResult)

    mockCallTurn.mockResolvedValue({
      assistant_text: 'Model built.',
      blocks: [
        {
          block_type: 'graph_patch',
          block_id: 'patch-1',
          data: {
            operations: [
              { op: 'add_node', target_id: 'node-1', data: { kind: 'goal', label: 'Goal' } },
            ],
            auto_apply: true,
            // No analysis_ready
          },
        },
      ],
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Build a model')
    })

    // Synthesis WAS called
    expect(mockSynthesise).toHaveBeenCalledTimes(1)

    // setCeeAnalysisReady called with synthesised data
    expect(mockSetCeeAnalysisReady).toHaveBeenCalledTimes(1)
    expect(mockSetCeeAnalysisReady.mock.calls[0][0].goal_node_id).toBe('goal_synth')
  })

  it('falls back to synthesis when analysis_ready fails contract validation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const synthesisResult = {
      status: 'ready',
      goal_node_id: 'goal_synth',
      options: [{ id: 'opt_synth', label: 'Synthesised', status: 'ready', interventions: { f1: { value: 0.5, source: 'cee_hypothesis' } } }],
    }
    mockSynthesise.mockReturnValue(synthesisResult)

    mockCallTurn.mockResolvedValue({
      assistant_text: 'Model built.',
      blocks: [
        {
          block_type: 'graph_patch',
          block_id: 'patch-1',
          data: {
            operations: [
              { op: 'add_node', target_id: 'node-1', data: { kind: 'goal', label: 'Goal' } },
            ],
            auto_apply: true,
            // Invalid analysis_ready — option missing status
            analysis_ready: {
              status: 'ready',
              goal_node_id: 'goal_1',
              options: [
                {
                  id: 'opt_bad',
                  label: 'Bad option',
                  // status missing → contract validator rejects
                  interventions: { f1: { value: 1, source: 'brief_extraction' } },
                },
              ],
            },
          },
        },
      ],
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Build a model')
    })

    // adaptCEEBlock should have rejected the invalid analysis_ready
    // → handleEnvelope falls back to synthesis
    expect(mockSynthesise).toHaveBeenCalledTimes(1)
    expect(mockSetCeeAnalysisReady).toHaveBeenCalledTimes(1)
    expect(mockSetCeeAnalysisReady.mock.calls[0][0].goal_node_id).toBe('goal_synth')
  })
})

/**
 * Tests for usePreAnalysisData hook
 *
 * Covers:
 * - Improvement categorisation (Fix, Verify, Add evidence, Strengthen)
 * - Evidence quality thresholds (0 confirmed = Low, 50% = Medium, 80% = High)
 * - Top Actions priority ordering (Fix first, then Verify, then Add evidence, then Strengthen)
 * - isReady and hasBlockers logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePreAnalysisData } from '../hooks/usePreAnalysisData'
import { useCanvasStore } from '../../../store'
import type { Node, Edge } from '@xyflow/react'

// Mock the canvas store
vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn(),
}))

// Mock the existing usePreAnalysisData hook that the new hook imports for canRun/hasBlockers
import { usePreAnalysisData as useExistingPreAnalysisData } from '../../../hooks/usePreAnalysisData'
vi.mock('../../../hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: vi.fn(() => ({
    canRun: true,
    hasBlockers: false,
    allIssues: [],
    fixFirstIssues: [],
    remainingCount: 0,
    limitingFactor: null,
    quality: null,
    readyOptionsCount: 0,
    totalOptionsCount: 0,
    edgeProvenance: null,
    isLoading: false,
  })),
}))

const mockExistingHook = useExistingPreAnalysisData as unknown as ReturnType<typeof vi.fn>

const mockUseCanvasStore = useCanvasStore as unknown as ReturnType<typeof vi.fn>

describe('usePreAnalysisData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockStore = (overrides: {
    nodes?: Node[]
    edges?: Edge[]
    ceeAnalysisReady?: { status?: string; goal_node_id?: string } | null
  } = {}) => {
    const nodes = overrides.nodes ?? []
    const edges = overrides.edges ?? []
    const ceeAnalysisReady = overrides.ceeAnalysisReady ?? null

    return (selector: (state: unknown) => unknown) => {
      const state = { nodes, edges, ceeAnalysisReady }
      return selector(state)
    }
  }

  describe('Improvement Categorisation', () => {
    it('adds missing_baseline to Fix when no baseline and ≥2 options', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.fix).toContainEqual(
        expect.objectContaining({
          key: 'missing_baseline',
          category: 'fix',
          bias: 'anchoring',
        })
      )
    })

    it('adds fewer_than_2_options to Fix when <2 options', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.fix).toContainEqual(
        expect.objectContaining({
          key: 'fewer_than_2_options',
          category: 'fix',
          bias: 'framing',
        })
      )
    })

    it('adds AI-inferred factors to Verify category', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: { label: 'AI Factor', observed_state: { source: 'ai', value: 0.75 } },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          category: 'verify',
          bias: 'confidence',
        })
      )
    })

    it('adds edges without evidence to Add evidence category', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: 'n2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Node 2' } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: {} },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.add_evidence).toContainEqual(
        expect.objectContaining({
          key: 'evidence_e1',
          category: 'add_evidence',
        })
      )
    })

    it('adds no_risks to Strengthen when no risk nodes', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.strengthen).toContainEqual(
        expect.objectContaining({
          key: 'no_risks',
          category: 'strengthen',
          bias: 'blind_spots',
        })
      )
    })
  })

  describe('Evidence Quality', () => {
    it('returns Low when 0% factors are confirmed', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'ai' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'ai' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.evidenceQuality.level).toBe('low')
      expect(result.current.evidenceQuality.ratio).toBe(0)
    })

    it('returns Medium when 50% factors are confirmed', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'user' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'ai' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.evidenceQuality.level).toBe('medium')
      expect(result.current.evidenceQuality.ratio).toBe(0.5)
    })

    it('returns High when ≥70% factors are confirmed', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'user' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'user' } } },
          { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3', observed_state: { source: 'user' } } },
          { id: 'f4', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F4', observed_state: { source: 'ai' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.evidenceQuality.level).toBe('high')
      expect(result.current.evidenceQuality.ratio).toBe(0.75)
    })
  })

  describe('Top Actions', () => {
    it('returns max 3 items', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'ai' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'ai' } } },
          { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3', observed_state: { source: 'ai' } } },
          { id: 'f4', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F4', observed_state: { source: 'ai' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.topActions.length).toBeLessThanOrEqual(3)
    })

    it('prioritises Fix items first', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'ai' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // First item should be from Fix category (fewer_than_2_options)
      expect(result.current.topActions[0]?.category).toBe('fix')
    })
  })

  describe('isReady and hasBlockers', () => {
    it('hasBlockers is true when existing hook reports hasBlockers', () => {
      // Configure existing hook mock to return hasBlockers: true
      mockExistingHook.mockReturnValue({
        canRun: false,
        hasBlockers: true,
        allIssues: [],
        fixFirstIssues: [],
        remainingCount: 0,
        limitingFactor: null,
        quality: null,
        readyOptionsCount: 0,
        totalOptionsCount: 0,
        edgeProvenance: null,
        isLoading: false,
      })

      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.hasBlockers).toBe(true)
    })

    it('isReady is false when existing hook reports canRun is false', () => {
      // Configure existing hook mock to return canRun: false
      mockExistingHook.mockReturnValue({
        canRun: false,
        hasBlockers: true,
        allIssues: [],
        fixFirstIssues: [],
        remainingCount: 0,
        limitingFactor: null,
        quality: null,
        readyOptionsCount: 0,
        totalOptionsCount: 0,
        edgeProvenance: null,
        isLoading: false,
      })

      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.isReady).toBe(false)
    })

    it('isReady is true when existing hook reports canRun is true', () => {
      // Configure existing hook mock to return canRun: true
      mockExistingHook.mockReturnValue({
        canRun: true,
        hasBlockers: false,
        allIssues: [],
        fixFirstIssues: [],
        remainingCount: 0,
        limitingFactor: null,
        quality: null,
        readyOptionsCount: 0,
        totalOptionsCount: 0,
        edgeProvenance: null,
        isLoading: false,
      })

      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1', is_baseline: true } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
        ],
        edges: [
          { id: 'e1', source: 'opt1', target: 'goal1' },
          { id: 'e2', source: 'opt2', target: 'goal1' },
        ],
        ceeAnalysisReady: { status: 'ready' },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.isReady).toBe(true)
    })
  })
})

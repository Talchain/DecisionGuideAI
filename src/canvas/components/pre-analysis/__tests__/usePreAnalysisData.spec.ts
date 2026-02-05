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

    it('adds no_risks to Strengthen when no risk nodes (coaching format)', () => {
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
          // Merged coaching format: question + context in one line
          label: 'Are there constraints you need to stay within? Budget limits or timeline boundaries make results more realistic.',
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

    it('returns High when 3/4 factors are brief_extraction (1 cee_inference)', () => {
      // Formula: nonAiFactors / totalFactors = 3/4 = 0.75 → High (≥0.7)
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'brief_extraction' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'brief_extraction' } } },
          { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3', observed_state: { source: 'brief_extraction' } } },
          { id: 'f4', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F4', observed_state: { source: 'cee_inference' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.evidenceQuality.level).toBe('high')
      expect(result.current.evidenceQuality.ratio).toBe(0.75)
    })

    it('returns Medium when 2/4 factors are brief_extraction (2 cee_inference)', () => {
      // Formula: nonAiFactors / totalFactors = 2/4 = 0.50 → Medium (≥0.4, <0.7)
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'brief_extraction' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'brief_extraction' } } },
          { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3', observed_state: { source: 'cee_inference' } } },
          { id: 'f4', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F4', observed_state: { source: 'cee_inference' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.evidenceQuality.level).toBe('medium')
      expect(result.current.evidenceQuality.ratio).toBe(0.5)
    })

    it('returns High when 1 factor is user_confirmed', () => {
      // Formula: nonAiFactors / totalFactors = 1/1 = 1.00 → High (≥0.7)
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'user_confirmed' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.evidenceQuality.level).toBe('high')
      expect(result.current.evidenceQuality.ratio).toBe(1)
    })

    it('returns Low when 1/4 factors are non-AI (1 brief_extraction + 3 cee_inference)', () => {
      // Formula: nonAiFactors / totalFactors = 1/4 = 0.25 → Low (<0.4)
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'brief_extraction' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'cee_inference' } } },
          { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3', observed_state: { source: 'cee_inference' } } },
          { id: 'f4', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F4', observed_state: { source: 'cee_inference' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.evidenceQuality.level).toBe('low')
      expect(result.current.evidenceQuality.ratio).toBe(0.25)
    })

    it('returns Low when 0 total factors (no data)', () => {
      // Edge case: 0 factors = Low confidence (no data to base confidence on)
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.evidenceQuality.level).toBe('low')
      expect(result.current.evidenceQuality.ratio).toBe(0)
    })

    it('returns Low when 0/3 factors are non-AI (all cee_inference)', () => {
      // Formula: nonAiFactors / totalFactors = 0/3 = 0 → Low (<0.4)
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'cee_inference' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'cee_inference' } } },
          { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3', observed_state: { source: 'cee_inference' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.evidenceQuality.level).toBe('low')
      expect(result.current.evidenceQuality.ratio).toBe(0)
    })

    it('returns High when factors have no observed_state (undefined source)', () => {
      // BLOCKLIST approach: undefined is NOT in AI_SOURCES, so counts as non-AI
      // Formula: nonAiFactors / totalFactors = 3/3 = 1.00 → High (≥0.7)
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1' } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2' } },
          { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3' } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.evidenceQuality.level).toBe('high')
      expect(result.current.evidenceQuality.ratio).toBe(1)
    })

    it('returns High when factors have default source', () => {
      // BLOCKLIST approach: 'default' is NOT in AI_SOURCES, so counts as non-AI
      // Formula: nonAiFactors / totalFactors = 2/2 = 1.00 → High (≥0.7)
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'default' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'default' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.evidenceQuality.level).toBe('high')
      expect(result.current.evidenceQuality.ratio).toBe(1)
    })
  })

  describe('Loading State', () => {
    it('returns isLoading=true when ceeAnalysisReady is null and nodes exist', () => {
      // Simulates browser refresh: CEE data hasn't loaded yet but nodes exist
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1' } },
        ],
        ceeAnalysisReady: null,
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.isLoading).toBe(true)
    })

    it('returns isLoading=false when ceeAnalysisReady is null and no nodes exist', () => {
      // Empty graph - not loading, just empty
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [],
        ceeAnalysisReady: null,
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.isLoading).toBe(false)
    })

    it('returns isLoading=false when ceeAnalysisReady has data', () => {
      // CEE data loaded - not loading anymore
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
        ],
        ceeAnalysisReady: { status: 'ready' },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.isLoading).toBe(false)
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

  describe('Value Formatting', () => {
    it('formats fractional percentage values correctly (0.04 → "4%")', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Conversion Rate',
              observed_state: { source: 'ai', value: 0.04, unit: '%' },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: '4%',
        })
      )
    })

    it('handles percentage values already in percent form (75 → "75%")', () => {
      // Guard: if value > 1, assume it's already a percentage
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Completion Rate',
              observed_state: { source: 'ai', value: 75, unit: '%' },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: '75%',
        })
      )
    })

    it('formats pound values correctly (20000 → "£20,000")', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Budget',
              observed_state: { source: 'ai', value: 20000, unit: '£' },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: '£20,000',
        })
      )
    })

    it('formats dollar values correctly (5000 → "$5,000")', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Revenue',
              observed_state: { source: 'ai', value: 5000, unit: '$' },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: '$5,000',
        })
      )
    })

    it('formats values without unit with reasonable precision (0.75 → "0.8")', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Score',
              observed_state: { source: 'ai', value: 0.75 },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: '0.8',
        })
      )
    })

    it('shows fallback text when value is null', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Unknown',
              observed_state: { source: 'ai', value: null },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'Value needed',
        })
      )
    })
  })

  describe('Success Threshold Auto-Population', () => {
    it('auto-fills threshold from goal_threshold', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'goal1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Goal', goal_threshold: 100 },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.successThreshold).toBe(100)
      expect(result.current.isThresholdAutoDerived).toBe(true)
    })

    it('auto-fills threshold from observed_state.value when goal_threshold missing', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'goal1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Goal', observed_state: { value: 75 } },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.successThreshold).toBe(75)
      expect(result.current.isThresholdAutoDerived).toBe(true)
    })

    it('prefers goal_threshold over observed_state.value', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'goal1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Goal', goal_threshold: 100, observed_state: { value: 75 } },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.successThreshold).toBe(100)
    })

    it('returns null when no threshold values exist', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'goal1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Goal' },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.successThreshold).toBeNull()
      expect(result.current.isThresholdAutoDerived).toBe(false)
    })

    it('isThresholdAutoDerived is false when threshold_source is user', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'goal1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: {
              label: 'Goal',
              observed_state: { value: 75 },
              threshold_source: 'user',
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.isThresholdAutoDerived).toBe(false)
    })
  })
})

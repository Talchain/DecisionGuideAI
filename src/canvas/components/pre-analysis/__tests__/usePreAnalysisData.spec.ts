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
    ceeAnalysisReady?: {
      status?: string
      goal_node_id?: string
      verification_prompts?: Record<string, string>
      goal_threshold?: number | null
      low_confidence_edges?: Array<{ edge_id: string; prompt: string }>
    } | null
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
    it('adds missing_baseline to Strengthen (optional) when no baseline and ≥2 options', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // missing_baseline is now optional (in strengthen category), not a blocker
      expect(result.current.improvementsByCategory.strengthen).toContainEqual(
        expect.objectContaining({
          key: 'missing_baseline',
          category: 'strengthen',
          bias: 'anchoring',
        })
      )
      // Should NOT be in fix category
      expect(result.current.improvementsByCategory.fix).not.toContainEqual(
        expect.objectContaining({ key: 'missing_baseline' })
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

  describe('P0-1: Header/Footer Blocked State Sync', () => {
    it('hasBlockers is true when mustAddress tier has items', () => {
      // When there's only 1 option, mustAddress.count > 0
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.tiers.mustAddress.count).toBeGreaterThan(0)
      expect(result.current.hasBlockers).toBe(true)
      expect(result.current.blockerCount).toBe(result.current.tiers.mustAddress.count)
    })

    it('hasBlockers is false when mustAddress tier is empty', () => {
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
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.tiers.mustAddress.count).toBe(0)
      expect(result.current.hasBlockers).toBe(false)
      expect(result.current.blockerCount).toBe(0)
    })

    it('isReady is false when mustAddress tier has items even if canRun is true', () => {
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
          // Missing baseline creates a mustAddress item
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.tiers.mustAddress.count).toBeGreaterThan(0)
      expect(result.current.isReady).toBe(false)
    })
  })

  describe('P0-2: Progress Counter Excludes brief_extraction', () => {
    it('excludes brief_extraction factors from totalReviewableFactorsCount', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'brief_extraction' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'cee_inference' } } },
          { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3', observed_state: { source: 'ai' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // Only cee_inference and ai should be counted as needing review
      expect(result.current.totalReviewableFactorsCount).toBe(2)
    })

    it('counts user_confirmed and user_assumption as reviewed', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'user_confirmed' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'user_assumption' } } },
          { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3', observed_state: { source: 'cee_inference' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // user_confirmed and user_assumption count toward total (they were AI, now reviewed)
      expect(result.current.totalReviewableFactorsCount).toBe(3)
      expect(result.current.reviewedFactorsCount).toBe(2)
    })

    it('returns 0/0 when only brief_extraction factors exist', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'brief_extraction' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'brief_extraction' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.totalReviewableFactorsCount).toBe(0)
      expect(result.current.reviewedFactorsCount).toBe(0)
    })
  })

  describe('P1-1: cleanFactorLabel Applied to Tier Items', () => {
    it('strips encoding notation from verify category labels', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Tech Lead Hired (0/1)',
              observed_state: { source: 'ai', value: 1 },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          label: 'Tech Lead Hired',
        })
      )
    })

    it('strips encoding notation from add_evidence category labels', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Budget (0–1, share of £20k cap)' } },
          { id: 'n2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Revenue' } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: {} },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.add_evidence).toContainEqual(
        expect.objectContaining({
          label: 'Budget → Revenue',
        })
      )
    })
  })

  describe('P1-2: Binary Factor Yes/No Display', () => {
    it('displays "Yes" for binary factor with value 1', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Tech Lead Hired (0/1)',
              observed_state: { source: 'ai', value: 1 },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'Yes',
        })
      )
    })

    it('displays "No" for binary factor with value 0', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Tech Lead Hired (0/1)',
              observed_state: { source: 'ai', value: 0 },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'No',
        })
      )
    })

    it('displays "No" for binary factor with value 0.5 or less', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Feature Enabled (yes/no)',
              observed_state: { source: 'ai', value: 0.3 },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'No',
        })
      )
    })

    it('displays "Yes" for binary factor with value greater than 0.5', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Feature Enabled (binary)',
              observed_state: { source: 'ai', value: 0.6 },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'Yes',
        })
      )
    })

    it('displays numeric value for non-binary factors', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Conversion Rate',
              observed_state: { source: 'ai', value: 0.75 },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: '0.8', // Rounded to 1 decimal
        })
      )
    })
  })

  describe('Phase 2.5: Controllable Factors with Interventions', () => {
    it('excludes controllable factors with interventions from verify category', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          // Controllable factor targeted by option intervention
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Ad Budget',
              category: 'controllable',
              observed_state: { source: 'ai', value: 5000 },
            },
          },
          // Option with intervention targeting factor1
          {
            id: 'opt1',
            type: 'option',
            position: { x: 0, y: 0 },
            data: {
              label: 'Option 1',
              interventions: { factor1: 10000 },
            },
          },
          {
            id: 'opt2',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Option 2', is_baseline: true },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // Controllable factor with intervention should NOT appear in verify
      expect(result.current.improvementsByCategory.verify).not.toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
      )
    })

    it('includes controllable factor without interventions in verify category', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          // Controllable factor NOT targeted by any intervention
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Ad Budget',
              category: 'controllable',
              observed_state: { source: 'ai', value: 5000 },
            },
          },
          // Option without interventions
          {
            id: 'opt1',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Option 1' },
          },
          {
            id: 'opt2',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Option 2', is_baseline: true },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // Controllable factor WITHOUT intervention should appear in verify
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
      )
    })

    it('includes external category factor with interventions in verify category', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          // External factor (not controllable) targeted by intervention
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Market Growth',
              category: 'external',
              observed_state: { source: 'ai', value: 0.05 },
            },
          },
          // Option with intervention targeting factor1
          {
            id: 'opt1',
            type: 'option',
            position: { x: 0, y: 0 },
            data: {
              label: 'Option 1',
              interventions: { factor1: 0.1 },
            },
          },
          {
            id: 'opt2',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Option 2', is_baseline: true },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // External factor (even with intervention) should appear in verify
      // because it's not controllable - it's an external assumption
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
      )
    })

    it('excludes controllable factor when multiple options have interventions', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Price',
              category: 'controllable',
              observed_state: { source: 'ai', value: 100 },
            },
          },
          {
            id: 'opt1',
            type: 'option',
            position: { x: 0, y: 0 },
            data: {
              label: 'Low Price',
              interventions: { factor1: 80 },
            },
          },
          {
            id: 'opt2',
            type: 'option',
            position: { x: 0, y: 0 },
            data: {
              label: 'High Price',
              interventions: { factor1: 120 },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // Factor targeted by ANY option intervention should be excluded
      expect(result.current.improvementsByCategory.verify).not.toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
      )
    })

    it('handles category case insensitively', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Budget',
              category: 'Controllable', // Mixed case
              observed_state: { source: 'ai', value: 5000 },
            },
          },
          {
            id: 'opt1',
            type: 'option',
            position: { x: 0, y: 0 },
            data: {
              label: 'Option 1',
              interventions: { factor1: 10000 },
            },
          },
          {
            id: 'opt2',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Option 2', is_baseline: true },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // Should handle mixed case category
      expect(result.current.improvementsByCategory.verify).not.toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
      )
    })

    it('excludes controllable factors with interventions from progress count', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          // Controllable factor with intervention - should NOT count toward progress
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Ad Budget',
              category: 'controllable',
              observed_state: { source: 'ai', value: 5000 },
            },
          },
          // Regular AI factor - should count toward progress
          {
            id: 'factor2',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Conversion Rate',
              observed_state: { source: 'ai', value: 0.04 },
            },
          },
          // Option with intervention targeting factor1
          {
            id: 'opt1',
            type: 'option',
            position: { x: 0, y: 0 },
            data: {
              label: 'Option 1',
              interventions: { factor1: 10000 },
            },
          },
          {
            id: 'opt2',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Option 2', is_baseline: true },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // Only factor2 should count - factor1 is controllable with intervention
      expect(result.current.totalReviewableFactorsCount).toBe(1)
      // Verify items should also only have factor2
      expect(result.current.improvementsByCategory.verify).toHaveLength(1)
      expect(result.current.improvementsByCategory.verify[0].key).toBe('verify_factor2')
    })
  })

  describe('Phase 3.1: verification_prompts from CEE', () => {
    it('uses verification_prompts as detail when available', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Conversion Rate',
              observed_state: { source: 'ai', value: 0.04 },
            },
          },
        ],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          verification_prompts: {
            factor1: 'Is the conversion rate around 4%?',
          },
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'Is the conversion rate around 4%?',
        })
      )
    })

    it('falls back to estimated value when verification_prompt not available', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Conversion Rate',
              observed_state: { source: 'ai', value: 0.04 },
            },
          },
        ],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          verification_prompts: {}, // No prompt for factor1
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: '0.0', // Numeric value
        })
      )
    })

    it('falls back to estimated value when ceeAnalysisReady is null', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Price',
              observed_state: { source: 'ai', value: 100 },
            },
          },
        ],
        ceeAnalysisReady: null,
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: '100.0',
        })
      )
    })

    it('uses verification_prompts with multiple factors', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Conversion Rate',
              observed_state: { source: 'ai', value: 0.04 },
            },
          },
          {
            id: 'factor2',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Customer Satisfaction',
              observed_state: { source: 'ai', value: 85 },
            },
          },
        ],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          verification_prompts: {
            factor1: 'Is the conversion rate around 4%?',
            // factor2 has no prompt - should fall back to value
          },
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // factor1 should use verification prompt
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'Is the conversion rate around 4%?',
        })
      )

      // factor2 should fall back to numeric value
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor2',
          detail: '85.0',
        })
      )
    })
  })

  describe('Phase 3.2: goal_threshold from CEE', () => {
    it('uses CEE goal_threshold as successThreshold when available', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'goal1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Revenue Goal' },
          },
        ],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          goal_threshold: 100000,
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.successThreshold).toBe(100000)
      expect(result.current.isThresholdAutoDerived).toBe(true)
    })

    it('prioritizes CEE goal_threshold over node goal_threshold', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'goal1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: {
              label: 'Revenue Goal',
              goal_threshold: 50000, // Node has different threshold
            },
          },
        ],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          goal_threshold: 100000, // CEE takes priority
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.successThreshold).toBe(100000)
    })

    it('falls back to node goal_threshold when CEE goal_threshold is null', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'goal1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: {
              label: 'Revenue Goal',
              goal_threshold: 50000,
            },
          },
        ],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          goal_threshold: null,
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.successThreshold).toBe(50000)
    })

    it('falls back to node threshold when ceeAnalysisReady is null', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'goal1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: {
              label: 'Revenue Goal',
              goal_threshold: 75000,
            },
          },
        ],
        ceeAnalysisReady: null,
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.successThreshold).toBe(75000)
    })

    it('marks CEE threshold as auto-derived', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'goal1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Goal' },
          },
        ],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          goal_threshold: 100,
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.isThresholdAutoDerived).toBe(true)
    })
  })

  describe('Phase 3.3: low_confidence_edges from CEE', () => {
    it('adds low-confidence edges to verify category', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'factor1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price' } },
          { id: 'factor2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Sales' } },
        ],
        edges: [
          { id: 'edge1', source: 'factor1', target: 'factor2' },
        ],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          low_confidence_edges: [
            { edge_id: 'edge1', prompt: 'Is the relationship between Price and Sales strong?' },
          ],
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_edge_edge1',
          category: 'verify',
          label: 'Price → Sales',
          detail: 'Is the relationship between Price and Sales strong?',
          focus: { type: 'edge', id: 'edge1', label: 'Price → Sales' },
          action: expect.objectContaining({ label: 'Edit', kind: 'edit', targetId: 'edge1', targetType: 'edge' }),
        })
      )
    })

    it('limits to max 3 low-confidence edges', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1' } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2' } },
          { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3' } },
          { id: 'f4', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F4' } },
          { id: 'f5', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F5' } },
        ],
        edges: [
          { id: 'e1', source: 'f1', target: 'f2' },
          { id: 'e2', source: 'f2', target: 'f3' },
          { id: 'e3', source: 'f3', target: 'f4' },
          { id: 'e4', source: 'f4', target: 'f5' },
        ],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          low_confidence_edges: [
            { edge_id: 'e1', prompt: 'Prompt 1' },
            { edge_id: 'e2', prompt: 'Prompt 2' },
            { edge_id: 'e3', prompt: 'Prompt 3' },
            { edge_id: 'e4', prompt: 'Prompt 4' }, // Should be excluded (max 3)
          ],
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      const edgeItems = result.current.improvementsByCategory.verify.filter(
        item => item.key.startsWith('verify_edge_')
      )
      expect(edgeItems).toHaveLength(3)
      expect(edgeItems.map(item => item.key)).toEqual([
        'verify_edge_e1',
        'verify_edge_e2',
        'verify_edge_e3',
      ])
    })

    it('skips edges that do not exist in the graph', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1' } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2' } },
        ],
        edges: [
          { id: 'e1', source: 'f1', target: 'f2' },
        ],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          low_confidence_edges: [
            { edge_id: 'nonexistent_edge', prompt: 'Should be skipped' },
            { edge_id: 'e1', prompt: 'Valid edge prompt' },
          ],
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      const edgeItems = result.current.improvementsByCategory.verify.filter(
        item => item.key.startsWith('verify_edge_')
      )
      expect(edgeItems).toHaveLength(1)
      expect(edgeItems[0].key).toBe('verify_edge_e1')
    })

    it('handles empty low_confidence_edges array', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1' } },
        ],
        edges: [
          { id: 'e1', source: 'f1', target: 'f2' },
        ],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          low_confidence_edges: [],
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      const edgeItems = result.current.improvementsByCategory.verify.filter(
        item => item.key.startsWith('verify_edge_')
      )
      expect(edgeItems).toHaveLength(0)
    })

    it('cleans factor labels in edge display', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Tech Lead Hired (0/1)' } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Team Productivity' } },
        ],
        edges: [
          { id: 'e1', source: 'f1', target: 'f2' },
        ],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          low_confidence_edges: [
            { edge_id: 'e1', prompt: 'Does hiring impact productivity?' },
          ],
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_edge_e1',
          label: 'Tech Lead Hired → Team Productivity', // Label cleaned
        })
      )
    })
  })
})

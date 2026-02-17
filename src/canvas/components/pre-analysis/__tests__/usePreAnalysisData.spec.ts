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
      options?: Array<{
        id: string
        label?: string
        status?: string
        interventions?: Record<string, number | { value: number | null }>
      }>
      verification_prompts?: Record<string, string>
      goal_threshold?: number | null
      low_confidence_edges?: Array<{ edge_id: string; prompt: string }>
    } | null
    runMeta?: {
      m1ReviewAssumptions?: {
        key_assumptions: string[]
        pre_mortem?: { failure_scenario: string; warning_signs: string[]; mitigation: string } | null
      } | null
    } | null
  } = {}) => {
    const nodes = overrides.nodes ?? []
    const edges = overrides.edges ?? []
    const ceeAnalysisReady = overrides.ceeAnalysisReady ?? null
    const runMeta = overrides.runMeta ?? null

    return (selector: (state: unknown) => unknown) => {
      const state = { nodes, edges, ceeAnalysisReady, runMeta }
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
    it('formats fractional percentage values correctly (0.04 → "0.04 (scale 0–1)")', () => {
      // contextLine: no raw_value, value present → normalised fallback
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
          detail: '0.04 (scale 0–1)',
        })
      )
    })

    it('handles percentage values already in percent form (75 → "75.00 (scale 0–1)")', () => {
      // contextLine: no raw_value, value present → normalised fallback
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
          detail: '75.00 (scale 0–1)',
        })
      )
    })

    it('formats pound values correctly (20000 → "20000.00 (scale 0–1)")', () => {
      // contextLine: no raw_value, value present → normalised fallback
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
          detail: '20000.00 (scale 0–1)',
        })
      )
    })

    it('formats dollar values correctly (5000 → "5000.00 (scale 0–1)")', () => {
      // contextLine: no raw_value, value present → normalised fallback
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
          detail: '5000.00 (scale 0–1)',
        })
      )
    })

    it('formats values without unit with reasonable precision (0.75 → "0.75 (scale 0–1)")', () => {
      // contextLine: no raw_value, value present → normalised fallback
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
          detail: '0.75 (scale 0–1)',
        })
      )
    })

    it('shows fallback text when value is null', () => {
      // contextLine: no raw_value, no cap, isAi → "Estimated by AI"
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
          detail: 'Estimated by AI',
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
    it('includes brief_extraction factors in totalReviewableFactorsCount', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'brief_extraction' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'cee_inference' } } },
          { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3', observed_state: { source: 'ai' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // brief_extraction is now reviewable (v1.1), so all 3 are counted
      expect(result.current.totalReviewableFactorsCount).toBe(3)
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

    it('counts brief_extraction factors as reviewable', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'brief_extraction' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'brief_extraction' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // brief_extraction is now reviewable (v1.1)
      expect(result.current.totalReviewableFactorsCount).toBe(2)
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

  describe('P1-2: Binary Factor Display', () => {
    it('displays normalised value for binary factor with value 1', () => {
      // contextLine: no raw_value, value present → normalised fallback
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
          detail: '1.00 (scale 0–1)',
        })
      )
    })

    it('displays normalised value for binary factor with value 0', () => {
      // contextLine: no raw_value, value present → normalised fallback
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
          detail: '0.00 (scale 0–1)',
        })
      )
    })

    it('displays normalised value for binary factor with value 0.3', () => {
      // contextLine: no raw_value, value present → normalised fallback
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
          detail: '0.30 (scale 0–1)',
        })
      )
    })

    it('displays normalised value for binary factor with value 0.6', () => {
      // contextLine: no raw_value, value present → normalised fallback
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
          detail: '0.60 (scale 0–1)',
        })
      )
    })

    it('displays normalised value for non-binary AI factors without raw_value', () => {
      // contextLine: no raw_value, value present → normalised fallback
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
          detail: '0.75 (scale 0–1)',
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

    it('excludes controllable factors with interventions from progress count but shows in verify', () => {
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

      // Only factor2 should count toward progress - factor1 is controllable with intervention
      expect(result.current.totalReviewableFactorsCount).toBe(1)
      // Verify items: factor1 appears as verify_intervention_factor1 (informational),
      // factor2 appears as verify_factor2 (reviewable)
      expect(result.current.improvementsByCategory.verify).toHaveLength(2)
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_intervention_factor1' })
      )
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_factor2' })
      )
    })

    it('excludes controllable factors with interventions from ceeAnalysisReady.options (primary path)', () => {
      // This tests the CEE V3 format where interventions live in ceeAnalysisReady.options[]
      // NOT in node.data.interventions (which is the legacy fallback path)
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          // Controllable factor with AI source
          {
            id: 'fac_investment',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Initial Investment',
              category: 'controllable',
              observed_state: { source: 'cee_inference', value: 50000 },
            },
          },
          // Non-controllable factor for comparison
          {
            id: 'fac_churn',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Churn Rate',
              category: 'external',
              observed_state: { source: 'cee_inference', value: 0.05 },
            },
          },
          // Options WITHOUT interventions in node.data
          {
            id: 'opt_expand',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Expansion Plan' },
          },
          {
            id: 'opt_baseline',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Status Quo', is_baseline: true },
          },
        ],
        // Interventions are in ceeAnalysisReady.options (CEE V3 format)
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          options: [
            {
              id: 'opt_expand',
              label: 'Expansion Plan',
              status: 'ready',
              interventions: {
                fac_investment: { value: 100000 },
              },
            },
            {
              id: 'opt_baseline',
              label: 'Status Quo',
              status: 'ready',
              interventions: {
                fac_investment: { value: 0 },
              },
            },
          ],
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // fac_investment should be EXCLUDED (controllable + has intervention in ceeAnalysisReady.options)
      expect(result.current.improvementsByCategory.verify).not.toContainEqual(
        expect.objectContaining({ key: 'verify_fac_investment' })
      )
      // fac_churn should be INCLUDED (external category, even though options don't target it)
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_fac_churn' })
      )
    })

    it('handles nested intervention format with null value (should not count as intervention)', () => {
      // Test that { value: null } doesn't incorrectly match as an intervention
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Budget',
              category: 'controllable',
              observed_state: { source: 'ai', value: 5000 },
            },
          },
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
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          options: [
            {
              id: 'opt1',
              interventions: { factor1: { value: null } }, // null value should NOT count
            },
            {
              id: 'opt2',
              interventions: {},
            },
          ],
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // factor1 should APPEAR in verify because { value: null } doesn't count as intervention
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
      )
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

    it('falls back to normalised value when verification_prompt not available', () => {
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
          detail: '0.04 (scale 0–1)',
        })
      )
    })

    it('falls back to normalised value when ceeAnalysisReady is null', () => {
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
          detail: '100.00 (scale 0–1)',
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
            // factor2 has no prompt - should fall back to contextLine
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

      // factor2 should fall back to normalised value (no raw_value, value=85 present)
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor2',
          detail: '85.00 (scale 0–1)',
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

  describe('Bug Fixes', () => {
    describe('Task 1: Nested intervention format', () => {
      it('excludes controllable factor with nested intervention format { value: number }', () => {
        mockUseCanvasStore.mockImplementation(createMockStore({
          nodes: [
            {
              id: 'fac_europe_entry',
              type: 'factor',
              position: { x: 0, y: 0 },
              data: {
                label: 'Europe Entry',
                category: 'controllable',
                observed_state: { source: 'ai', value: 1 },
              },
            },
            {
              id: 'opt1',
              type: 'option',
              position: { x: 0, y: 0 },
              data: {
                label: 'Option 1',
                // Nested format: { value: number }
                interventions: { fac_europe_entry: { value: 1 } },
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

        // Controllable factor with nested intervention should be excluded
        expect(result.current.improvementsByCategory.verify).not.toContainEqual(
          expect.objectContaining({ key: 'verify_fac_europe_entry' })
        )
      })

      it('excludes controllable factor with simple intervention format (number)', () => {
        mockUseCanvasStore.mockImplementation(createMockStore({
          nodes: [
            {
              id: 'fac_investment',
              type: 'factor',
              position: { x: 0, y: 0 },
              data: {
                label: 'Investment',
                category: 'controllable',
                observed_state: { source: 'ai', value: 0.2 },
              },
            },
            {
              id: 'opt1',
              type: 'option',
              position: { x: 0, y: 0 },
              data: {
                label: 'Option 1',
                // Simple format: number
                interventions: { fac_investment: 100000 },
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

        // Controllable factor with simple intervention should be excluded
        expect(result.current.improvementsByCategory.verify).not.toContainEqual(
          expect.objectContaining({ key: 'verify_fac_investment' })
        )
      })

      it('does not exclude factor when intervention key exists but value is null', () => {
        mockUseCanvasStore.mockImplementation(createMockStore({
          nodes: [
            {
              id: 'factor1',
              type: 'factor',
              position: { x: 0, y: 0 },
              data: {
                label: 'Factor 1',
                category: 'controllable',
                observed_state: { source: 'ai', value: 0.5 },
              },
            },
            {
              id: 'opt1',
              type: 'option',
              position: { x: 0, y: 0 },
              data: {
                label: 'Option 1',
                // Key exists but value is null
                interventions: { factor1: null },
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

        // Factor should be included because intervention value is null
        expect(result.current.improvementsByCategory.verify).toContainEqual(
          expect.objectContaining({ key: 'verify_factor1' })
        )
      })

      it('does not exclude factor when nested intervention has { value: null }', () => {
        mockUseCanvasStore.mockImplementation(createMockStore({
          nodes: [
            {
              id: 'factor1',
              type: 'factor',
              position: { x: 0, y: 0 },
              data: {
                label: 'Factor 1',
                category: 'controllable',
                observed_state: { source: 'ai', value: 0.5 },
              },
            },
            {
              id: 'opt1',
              type: 'option',
              position: { x: 0, y: 0 },
              data: {
                label: 'Option 1',
                // Nested format with null value (placeholder intervention)
                interventions: { factor1: { value: null } },
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

        // Factor should be included because nested intervention value is null
        expect(result.current.improvementsByCategory.verify).toContainEqual(
          expect.objectContaining({ key: 'verify_factor1' })
        )
      })
    })

    describe('Task 2: raw_value display for currency factors', () => {
      it('displays formatted raw_value with unit when raw_value is available', () => {
        mockUseCanvasStore.mockImplementation(createMockStore({
          nodes: [
            {
              id: 'factor1',
              type: 'factor',
              position: { x: 0, y: 0 },
              data: {
                label: 'Expansion Investment',
                observed_state: {
                  source: 'ai',
                  value: 0.2, // Normalized 0-1 value
                  raw_value: 100000, // Actual value
                  unit: '£',
                },
              },
            },
          ],
        }))

        const { result } = renderHook(() => usePreAnalysisData())

        // contextLine: raw_value exists with unit=£ → "£100,000"
        expect(result.current.improvementsByCategory.verify).toContainEqual(
          expect.objectContaining({
            key: 'verify_factor1',
            detail: '£100,000',
          })
        )
      })

      it('falls back to normalised value when raw_value not available', () => {
        mockUseCanvasStore.mockImplementation(createMockStore({
          nodes: [
            {
              id: 'factor1',
              type: 'factor',
              position: { x: 0, y: 0 },
              data: {
                label: 'Budget',
                observed_state: {
                  source: 'ai',
                  value: 5000, // No raw_value
                  unit: '$',
                },
              },
            },
          ],
        }))

        const { result } = renderHook(() => usePreAnalysisData())

        // contextLine: no raw_value, value present → normalised fallback
        expect(result.current.improvementsByCategory.verify).toContainEqual(
          expect.objectContaining({
            key: 'verify_factor1',
            detail: '5000.00 (scale 0–1)',
          })
        )
      })
    })

    describe('Task 3: factor_target_* success threshold fallback', () => {
      it('uses factor_target_* node value as success threshold when no other sources', () => {
        mockUseCanvasStore.mockImplementation(createMockStore({
          nodes: [
            {
              id: 'goal1',
              type: 'goal',
              position: { x: 0, y: 0 },
              data: { label: 'Revenue Goal' }, // No threshold on goal node
            },
            {
              id: 'factor_target_0',
              type: 'factor',
              position: { x: 0, y: 0 },
              data: {
                label: 'Target Revenue',
                observed_state: {
                  value: 800,
                  source: 'brief_extraction',
                },
              },
            },
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
            { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
          ],
          edges: [
            { id: 'e1', source: 'opt1', target: 'goal1' },
            { id: 'e2', source: 'opt2', target: 'goal1' },
          ],
        }))

        const { result } = renderHook(() => usePreAnalysisData())

        expect(result.current.successThreshold).toBe(800)
        expect(result.current.isThresholdAutoDerived).toBe(true)
      })

      it('uses factor_value_* node value as success threshold', () => {
        mockUseCanvasStore.mockImplementation(createMockStore({
          nodes: [
            {
              id: 'goal1',
              type: 'goal',
              position: { x: 0, y: 0 },
              data: { label: 'Revenue Goal' },
            },
            {
              id: 'factor_value_revenue',
              type: 'factor',
              position: { x: 0, y: 0 },
              data: {
                label: 'Revenue Target',
                value: 1000, // Direct value property
                source: 'brief_extraction',
              },
            },
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
            { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
          ],
          edges: [
            { id: 'e1', source: 'opt1', target: 'goal1' },
            { id: 'e2', source: 'opt2', target: 'goal1' },
          ],
        }))

        const { result } = renderHook(() => usePreAnalysisData())

        expect(result.current.successThreshold).toBe(1000)
      })

      it('ignores factor_target_* with non-brief_extraction source', () => {
        mockUseCanvasStore.mockImplementation(createMockStore({
          nodes: [
            {
              id: 'goal1',
              type: 'goal',
              position: { x: 0, y: 0 },
              data: { label: 'Revenue Goal' },
            },
            {
              id: 'factor_target_0',
              type: 'factor',
              position: { x: 0, y: 0 },
              data: {
                label: 'Target',
                observed_state: {
                  value: 500,
                  source: 'ai', // Not brief_extraction
                },
              },
            },
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
            { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
          ],
          edges: [
            { id: 'e1', source: 'opt1', target: 'goal1' },
            { id: 'e2', source: 'opt2', target: 'goal1' },
          ],
        }))

        const { result } = renderHook(() => usePreAnalysisData())

        expect(result.current.successThreshold).toBeNull()
      })

      it('prioritizes goal node threshold over factor_target_* fallback', () => {
        mockUseCanvasStore.mockImplementation(createMockStore({
          nodes: [
            {
              id: 'goal1',
              type: 'goal',
              position: { x: 0, y: 0 },
              data: {
                label: 'Revenue Goal',
                goal_threshold: 2000, // Goal node has threshold
              },
            },
            {
              id: 'factor_target_0',
              type: 'factor',
              position: { x: 0, y: 0 },
              data: {
                label: 'Target',
                observed_state: {
                  value: 800,
                  source: 'brief_extraction',
                },
              },
            },
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
            { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
          ],
          edges: [
            { id: 'e1', source: 'opt1', target: 'goal1' },
            { id: 'e2', source: 'opt2', target: 'goal1' },
          ],
        }))

        const { result } = renderHook(() => usePreAnalysisData())

        // Goal threshold takes priority
        expect(result.current.successThreshold).toBe(2000)
      })
    })

    describe('P2-3: thresholdProvenance', () => {
      it('returns provenance from factor_target_* node label when threshold from brief_extraction', () => {
        mockUseCanvasStore.mockImplementation(createMockStore({
          nodes: [
            {
              id: 'goal1',
              type: 'goal',
              position: { x: 0, y: 0 },
              data: { label: 'Revenue Goal' },
            },
            {
              id: 'factor_target_0',
              type: 'factor',
              position: { x: 0, y: 0 },
              data: {
                label: 'Target Revenue of $1M',
                observed_state: {
                  value: 1000000,
                  source: 'brief_extraction',
                },
              },
            },
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
            { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
          ],
          edges: [
            { id: 'e1', source: 'opt1', target: 'goal1' },
            { id: 'e2', source: 'opt2', target: 'goal1' },
          ],
        }))

        const { result } = renderHook(() => usePreAnalysisData())

        expect(result.current.thresholdProvenance).toBe('Target Revenue of $1M')
      })

      it('returns reasoning from factor_target_* node when available', () => {
        mockUseCanvasStore.mockImplementation(createMockStore({
          nodes: [
            {
              id: 'goal1',
              type: 'goal',
              position: { x: 0, y: 0 },
              data: { label: 'Revenue Goal' },
            },
            {
              id: 'factor_target_0',
              type: 'factor',
              position: { x: 0, y: 0 },
              data: {
                label: 'Target Revenue',
                observed_state: {
                  value: 1000000,
                  source: 'brief_extraction',
                  reasoning: 'User mentioned goal of $1M revenue in their brief',
                },
              },
            },
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
            { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
          ],
          edges: [
            { id: 'e1', source: 'opt1', target: 'goal1' },
            { id: 'e2', source: 'opt2', target: 'goal1' },
          ],
        }))

        const { result } = renderHook(() => usePreAnalysisData())

        // Reasoning takes priority over label
        expect(result.current.thresholdProvenance).toBe('User mentioned goal of $1M revenue in their brief')
      })

      it('returns null when no provenance available', () => {
        mockUseCanvasStore.mockImplementation(createMockStore({
          nodes: [
            {
              id: 'goal1',
              type: 'goal',
              position: { x: 0, y: 0 },
              data: {
                label: 'Revenue Goal',
                goal_threshold: 5000,
              },
            },
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
            { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
          ],
          edges: [
            { id: 'e1', source: 'opt1', target: 'goal1' },
            { id: 'e2', source: 'opt2', target: 'goal1' },
          ],
        }))

        const { result } = renderHook(() => usePreAnalysisData())

        expect(result.current.thresholdProvenance).toBeNull()
      })

      it('returns provenance.reasoning from goal node when available', () => {
        mockUseCanvasStore.mockImplementation(createMockStore({
          nodes: [
            {
              id: 'goal1',
              type: 'goal',
              position: { x: 0, y: 0 },
              data: {
                label: 'Revenue Goal',
                goal_threshold: 5000,
                provenance: {
                  reasoning: 'Based on previous quarter performance',
                },
              },
            },
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
            { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
          ],
          edges: [
            { id: 'e1', source: 'opt1', target: 'goal1' },
            { id: 'e2', source: 'opt2', target: 'goal1' },
          ],
        }))

        const { result } = renderHook(() => usePreAnalysisData())

        expect(result.current.thresholdProvenance).toBe('Based on previous quarter performance')
      })
    })
  })

  // ===========================================================================
  // V3 Field Format Tests
  // ===========================================================================

  describe('V3 field format: factors with category + observed_state', () => {
    it('shows observable factor with AI-sourced observedState in review tier', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'fac_churn',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Churn Rate',
              category: 'observable',
              // camelCase observedState — as DraftChat stores it after mapping from CEE
              observedState: { value: 0.05, source: 'cee_inference' },
            },
          },
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // Observable factor with AI source should appear in verify (review assumptions)
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_fac_churn',
          category: 'verify',
          label: 'Churn Rate',
        })
      )
      // Should also appear in reviewAssumptions tier
      expect(result.current.tiers.reviewAssumptions.items).toContainEqual(
        expect.objectContaining({ key: 'verify_fac_churn' })
      )
    })

    it('shows controllable factor without interventions in review tier', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'fac_budget',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Marketing Budget',
              category: 'controllable',
              observedState: { value: 50000, source: 'cee_inference' },
            },
          },
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // Controllable factor without interventions should still appear in verify
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_fac_budget' })
      )
    })

    it('excludes external factor with observed_state.value=None from verify when source is not AI', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'fac_market',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Market Conditions',
              category: 'external',
              // External factor with default source — not AI-inferred
              observedState: { value: null, source: 'default' },
            },
          },
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // External factor with 'default' source should NOT appear (not AI)
      expect(result.current.improvementsByCategory.verify).not.toContainEqual(
        expect.objectContaining({ key: 'verify_fac_market' })
      )
    })
  })

  describe('V3 field format: negative edge detection (direction field)', () => {
    it('suppresses no_negative_effects coaching when edges have direction=negative', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 1' } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 2' } },
        ],
        edges: [
          // Canvas edge format: direction='negative' + weight=0.7 (mapped by DraftChat from strength.mean=-0.7)
          { id: 'e1', source: 'f1', target: 'f2', data: { direction: 'negative', weight: 0.7 } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // Should NOT suggest adding negative effects — one already exists
      expect(result.current.improvementsByCategory.strengthen).not.toContainEqual(
        expect.objectContaining({ key: 'no_negative_effects' })
      )
    })

    it('shows no_negative_effects coaching when all edges have direction=positive', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 1' } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 2' } },
        ],
        edges: [
          // All positive edges
          { id: 'e1', source: 'f1', target: 'f2', data: { direction: 'positive', weight: 0.7 } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // Should suggest adding negative effects
      expect(result.current.improvementsByCategory.strengthen).toContainEqual(
        expect.objectContaining({ key: 'no_negative_effects' })
      )
    })

    it('shows no_negative_effects coaching when edges have no direction (legacy)', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 1' } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 2' } },
        ],
        edges: [
          // Legacy edge with no direction field
          { id: 'e1', source: 'f1', target: 'f2', data: { weight: 0.5 } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // Should suggest adding negative effects (no direction = no negative)
      expect(result.current.improvementsByCategory.strengthen).toContainEqual(
        expect.objectContaining({ key: 'no_negative_effects' })
      )
    })
  })

  describe('M1 Review: key_assumptions in Review assumptions tier', () => {
    it('adds key_assumptions items to verify category and reviewAssumptions tier', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
        ],
        runMeta: {
          m1ReviewAssumptions: {
            key_assumptions: [
              'Market demand remains stable',
              'Competitor pricing unchanged',
              'Implementation costs within 10%',
            ],
          },
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // All 3 assumptions should appear in verify category
      const m1Items = result.current.improvementsByCategory.verify.filter(
        (item) => item.key.startsWith('m1_assumption_')
      )
      expect(m1Items).toHaveLength(3)

      // Each assumption text is preserved as the label
      expect(m1Items[0].label).toBe('Market demand remains stable')
      expect(m1Items[1].label).toBe('Competitor pricing unchanged')
      expect(m1Items[2].label).toBe('Implementation costs within 10%')

      // Items have correct shape: category=verify, no focus, no action
      for (const item of m1Items) {
        expect(item.category).toBe('verify')
        expect(item.bias).toBe('confidence')
        expect(item.focus).toBeUndefined()
        expect(item.action).toBeUndefined()
      }

      // Items flow into reviewAssumptions tier
      const tierItems = result.current.tiers.reviewAssumptions.items.filter(
        (item) => item.key.startsWith('m1_assumption_')
      )
      expect(tierItems).toHaveLength(3)
    })

    it('renders no m1_assumption items when key_assumptions is empty', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
        ],
        runMeta: {
          m1ReviewAssumptions: {
            key_assumptions: [],
          },
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      const m1Items = result.current.improvementsByCategory.verify.filter(
        (item) => item.key.startsWith('m1_assumption_')
      )
      expect(m1Items).toHaveLength(0)
    })

    it('renders no m1_assumption items when m1ReviewAssumptions is null', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
        ],
        runMeta: null,
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      const m1Items = result.current.improvementsByCategory.verify.filter(
        (item) => item.key.startsWith('m1_assumption_')
      )
      expect(m1Items).toHaveLength(0)
    })

    it('exposes preMortem from m1ReviewAssumptions', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
        ],
        runMeta: {
          m1ReviewAssumptions: {
            key_assumptions: ['Test assumption'],
            pre_mortem: {
              failure_scenario: 'Project fails due to market shift',
              warning_signs: ['Revenue below target', 'Churn above 8%'],
              mitigation: 'Quarterly checkpoints with go/no-go criteria',
            },
          },
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.preMortem).toEqual({
        failure_scenario: 'Project fails due to market shift',
        warning_signs: ['Revenue below target', 'Churn above 8%'],
        mitigation: 'Quarterly checkpoints with go/no-go criteria',
      })
    })

    it('preMortem is null when not provided', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2', is_baseline: true } },
        ],
        runMeta: {
          m1ReviewAssumptions: {
            key_assumptions: ['Some assumption'],
          },
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.preMortem).toBeNull()
    })
  })
})

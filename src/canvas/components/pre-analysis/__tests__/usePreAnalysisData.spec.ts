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
    it('baseline nudge appears only in Model quality, not duplicated in Strengthen', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // missing_baseline is NOT in strengthen (surfaced only in decisionQuality)
      expect(result.current.improvementsByCategory.strengthen).not.toContainEqual(
        expect.objectContaining({ key: 'missing_baseline' })
      )
      // Nor in fix
      expect(result.current.improvementsByCategory.fix).not.toContainEqual(
        expect.objectContaining({ key: 'missing_baseline' })
      )
      // But present in qualityChecks
      expect(result.current.qualityChecks).toContainEqual(
        expect.objectContaining({ id: 'no_baseline' })
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

    it('returns nonAiCount and totalCount for source distribution tooltip', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'user' } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'ai' } } },
          { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3', observed_state: { source: 'ai' } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.evidenceQuality.nonAiCount).toBe(1)
      expect(result.current.evidenceQuality.totalCount).toBe(3)
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
      // value 0.04 with unit '%' → multiply by 100 for display
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
      // value 75 with unit '%' (already in percent form, > 1) → "75%"
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

    // Pin the percent + raw_value contract.
    //
    // Codebase convention (matches model-tab/utils.ts):
    //   - `value` is normalised 0–1 (the engine-facing form)
    //   - `raw_value` is the user-facing display value (already in scale)
    //
    // Therefore:
    //   - When raw_value is present, it is rendered LITERALLY: 0.5 → "0.5%",
    //     85 → "85%". No fractional-to-percent conversion is applied here.
    //   - When raw_value is absent and only `value` exists, the value-only
    //     branch assumes fractional 0–1 form and multiplies by 100, so
    //     0.04 → "4%". Values > 1 are passed through (75 → "75%").
    //
    // These tests pin both branches so future drift is caught.

    it('renders raw_value 0.04 with unit "%" literally as "0.04%" (not 4%)', () => {
      // raw_value is the user-facing value. A literal 0.04% should render as such.
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Tiny Percentage',
              observed_state: { source: 'ai', value: 0.0004, raw_value: 0.04, unit: '%' },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: '0.04%',
        })
      )
    })

    it('renders raw_value 0.5 with unit "%" literally as "0.5%" (not 50%)', () => {
      // ChatGPT review case: a literal 0.5% must not be misrendered as 50%.
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Half Percent',
              observed_state: { source: 'ai', value: 0.005, raw_value: 0.5, unit: '%' },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: '0.5%',
        })
      )
    })

    it('renders raw_value 85 with unit "%" as "85%" (canonical canvas pattern)', () => {
      // Canonical pattern from inspector tests: value=normalised, raw_value=display.
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Conversion Rate',
              observed_state: { source: 'ai', value: 0.85, raw_value: 85, unit: '%' },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: '85%',
        })
      )
    })

    it('formats pound values with thousand separators (20000 → "£20,000")', () => {
      // value 20000 with unit '£' → currency prefix + thousand separators
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

    it('formats dollar values with thousand separators (5000 → "$5,000")', () => {
      // value 5000 with unit '$' → currency prefix + thousand separators
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

    it('formats qualitative factors without unit as level names (0.75 → "high")', () => {
      // no raw_value, value in 0–1 range, no unit/cap → qualitative level
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
          detail: 'high',
        })
      )
    })

    it('formats factor with empty string unit and cap=1 as qualitative level', () => {
      // CEE sometimes sends cap: 1, unit: "" — treat as qualitative
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Integration Complexity',
              observed_state: { source: 'ai', value: 0.5, cap: 1, unit: '' },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'moderate',
        })
      )
    })

    it('formats factor with cap=1, unit="" and raw_value as qualitative level', () => {
      // When raw_value is present but unit is empty and cap is 1, still qualitative
      // 0.8 maps to 'high' with inclusive boundaries (<=0.2 very low, <=0.4 low, <=0.6 moderate, <=0.8 high, >0.8 very high)
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Product-Market Fit',
              observed_state: { source: 'ai', value: 0.8, raw_value: 0.8, cap: 1, unit: '' },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'high',
        })
      )
    })

    it('formats factor with cap=1, unit="" and out-of-range value as numeric (with thousand separators)', () => {
      // Value > 1 with cap=1, unit="" — range guard prevents qualitative mapping
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Large Factor',
              observed_state: { source: 'ai', value: 5000, cap: 1, unit: '' },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: '5,000',
        })
      )
    })

    // ── Inferred-zero "Not set" override ──────────────────────────────────
    //
    // When a factor is AI-inferred (extractionType === 'inferred') AND the
    // raw value is 0 AND there is no meaningful unit, the literal "0" is
    // misleading. The AI did not measure zero; it placed the value at the
    // bottom of the scale because it had nothing to ground on. The verify
    // card should read "Not set" so the user knows to provide a value.
    //
    // extractionType has two storage locations — we must check both:
    //   1. observedState.extractionType (canonical, CEE-derived factors)
    //   2. node.data.extractionType (inspector-edited factors)

    it('renders "Not set" for inferred-zero factor with observedState.extractionType', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Market Size',
              observed_state: {
                source: 'ai',
                value: 0,
                raw_value: 0,
                extractionType: 'inferred',
              },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'Not set',
        })
      )
    })

    it('renders "Not set" for inferred-zero factor with node.data.extractionType (inspector path)', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'User-edited factor',
              extractionType: 'inferred',
              observed_state: { source: 'ai', value: 0, raw_value: 0 },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'Not set',
        })
      )
    })

    it('renders "Not set" for inferred-zero factor with placeholder unit "index"', () => {
      // "index" is in GENERIC_PLACEHOLDER_UNITS alongside scale, score, norm.
      // All should collapse to "Not set" when the value is zero-and-inferred.
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Quality Index',
              observed_state: {
                source: 'ai',
                value: 0,
                raw_value: 0,
                unit: 'index',
                extractionType: 'inferred',
              },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'Not set',
        })
      )
    })

    it('renders "Not set" for inferred-zero factor with placeholder unit "score"', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Customer Satisfaction Score',
              observed_state: {
                source: 'ai',
                value: 0,
                raw_value: 0,
                unit: 'score',
                extractionType: 'inferred',
              },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'Not set',
        })
      )
    })

    it('does NOT render "Not set" when unit is a meaningful real-world unit (e.g. "users")', () => {
      // A zero-valued inferred factor with a meaningful unit should still show
      // the formatter output ("0 users"), because the user may have legitimately
      // inferred zero users. "Not set" only applies to placeholder units.
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Free users',
              observed_state: {
                source: 'ai',
                value: 0,
                raw_value: 0,
                unit: 'users',
                extractionType: 'inferred',
              },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      const item = result.current.improvementsByCategory.verify.find(
        (i) => i.key === 'verify_factor1',
      )
      expect(item).toBeDefined()
      expect(item?.detail).not.toBe('Not set')
    })

    it('does NOT render "Not set" when extractionType is "explicit" (user-provided zero)', () => {
      // Explicit zero is a real user decision and should render literally.
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Explicit zero',
              observed_state: {
                source: 'user_confirmed',
                value: 0,
                raw_value: 0,
                extractionType: 'explicit',
              },
            },
          },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      const item = result.current.improvementsByCategory.verify.find(
        (i) => i.key === 'verify_factor1',
      )
      expect(item).toBeDefined()
      expect(item?.detail).not.toBe('Not set')
    })

    it('excludes factors with null observed_state value from verify', () => {
      // Factors without a non-null observed_state value are excluded from verify
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

      expect(result.current.improvementsByCategory.verify).not.toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
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
    it('hasBlockers is true when the canonical readiness hook reports blockers', () => {
      mockExistingHook.mockReturnValue({
        canRun: false,
        hasBlockers: true,
        allIssues: [{ severity: 'blocker' }],
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

      expect(result.current.tiers.mustAddress.count).toBeGreaterThan(0)
      expect(result.current.hasBlockers).toBe(true)
      expect(result.current.blockerCount).toBe(1)
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

    it('isReady remains true when the canonical readiness hook allows running even if mustAddress tier has items', () => {
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
      expect(result.current.isReady).toBe(true)
    })
  })

  describe('P0-2: Progress Counter — observed_state value based', () => {
    it('counts factors with observed_state value in totalReviewableFactorsCount', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'brief_extraction', value: 0.5 } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'cee_inference', value: 0.3 } } },
          { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3', observed_state: { source: 'ai', value: 0.7 } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // All 3 factors have observed_state values
      expect(result.current.totalReviewableFactorsCount).toBe(3)
    })

    it('counts user_confirmed and user_assumption as reviewed', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'user_confirmed', value: 0.5 } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'user_assumption', value: 0.3 } } },
          { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3', observed_state: { source: 'cee_inference', value: 0.7 } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // user_confirmed and user_assumption count as reviewed
      expect(result.current.totalReviewableFactorsCount).toBe(3)
      expect(result.current.reviewedFactorsCount).toBe(2)
    })

    it('counts brief_extraction factors as reviewable', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { source: 'brief_extraction', value: 0.4 } } },
          { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { source: 'brief_extraction', value: 0.6 } } },
        ],
      }))

      const { result } = renderHook(() => usePreAnalysisData())

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
    it('displays qualitative level for binary factor with value 1', () => {
      // no raw_value, value in 0–1 range, no unit/cap → qualitative level
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
          detail: 'very high',
        })
      )
    })

    it('displays qualitative level for binary factor with value 0', () => {
      // no raw_value, value in 0–1 range, no unit/cap → qualitative level
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
          detail: 'very low',
        })
      )
    })

    it('displays qualitative level for binary factor with value 0.3', () => {
      // no raw_value, value in 0–1 range, no unit/cap → qualitative level
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
          detail: 'low',
        })
      )
    })

    it('displays qualitative level for binary factor with value 0.6', () => {
      // no raw_value, value in 0–1 range, no unit/cap → qualitative level
      // 0.6 maps to 'moderate' with inclusive boundaries (<=0.6 moderate)
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
          detail: 'moderate',
        })
      )
    })

    it('displays qualitative level for non-binary AI factors without raw_value', () => {
      // no raw_value, value in 0–1 range, no unit/cap → qualitative level
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
          detail: 'high',
        })
      )
    })
  })

  describe('Verify filter: observed_state value inclusion', () => {
    it('includes factors with observed_state value in verify regardless of interventions', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
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

      // Factor with observed_state value appears in verify even if targeted by interventions
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
      )
    })

    it('includes controllable factor without interventions in verify category', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
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

      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
      )
    })

    it('includes external factor with interventions in verify category', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
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

      // Factor with observed_state value is always included
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
      )
    })

    it('includes factors targeted by multiple options in verify', () => {
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

      // Factor with observed_state value always appears
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
      )
    })

    it('excludes factors with null observed_state value', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Budget',
              category: 'Controllable',
              observed_state: { source: 'ai', value: null },
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
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // Factor with null value should NOT appear in verify
      expect(result.current.improvementsByCategory.verify).not.toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
      )
    })

    it('counts all factors with observed_state values in progress', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
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
          {
            id: 'factor2',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Conversion Rate',
              observed_state: { source: 'ai', value: 0.04 },
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

      // Both factors have observed_state values — both count
      expect(result.current.totalReviewableFactorsCount).toBe(2)
      expect(result.current.improvementsByCategory.verify).toHaveLength(2)
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
      )
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_factor2' })
      )
    })

    it('includes factors from ceeAnalysisReady.options regardless of interventions', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
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

      // Both factors have observed_state values — both appear in verify
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_fac_investment' })
      )
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_fac_churn' })
      )
    })

    it('includes factor regardless of intervention format', () => {
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
              interventions: { factor1: { value: null } },
            },
            {
              id: 'opt2',
              interventions: {},
            },
          ],
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // factor1 has observed_state value — appears in verify
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
      )
    })
  })

  describe('Phase 3.1: verification_prompts from CEE', () => {
    it('uses verification_prompts as hint, raw_value/normalised as detail', () => {
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

      // detail uses qualitative level (no raw_value, value in 0–1); hint gets verification prompt
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'very low',
          hint: 'Is the conversion rate around 4%?',
        })
      )
    })

    it('falls back to qualitative level when verification_prompt not available', () => {
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
          detail: 'very low',
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
          detail: '100',
        })
      )
    })

    it('uses verification_prompts as hint with multiple factors', () => {
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

      // factor1: qualitative level (value 0.04 in 0–1), hint from verification prompt
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor1',
          detail: 'very low',
          hint: 'Is the conversion rate around 4%?',
        })
      )

      // factor2: value 85 is > 1, plain number (no scale suffix)
      expect(result.current.improvementsByCategory.verify).toContainEqual(
        expect.objectContaining({
          key: 'verify_factor2',
          detail: '85',
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
      it('includes factor with nested intervention format { value: number }', () => {
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

        // Factor with observed_state value appears in verify regardless of interventions
        expect(result.current.improvementsByCategory.verify).toContainEqual(
          expect.objectContaining({ key: 'verify_fac_europe_entry' })
        )
      })

      it('includes factor with simple intervention format (number)', () => {
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

        // Factor with observed_state value appears in verify regardless of interventions
        expect(result.current.improvementsByCategory.verify).toContainEqual(
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

        // contextLine: no raw_value, value present with currency unit → currency-formatted with thousand separators
        expect(result.current.improvementsByCategory.verify).toContainEqual(
          expect.objectContaining({
            key: 'verify_factor1',
            detail: '$5,000',
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

  describe('Task 5: many_ai_estimates suppression', () => {
    it('fires many_ai_estimates when all factors are AI-sourced with values', () => {
      // All factors have observed_state values — reviewable
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'goal1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Improve Productivity' },
          },
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Tech Lead Hired',
              category: 'controllable',
              observed_state: { source: 'cee_inference', value: 0 },
            },
          },
          {
            id: 'factor2',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Team Size',
              category: 'controllable',
              observed_state: { source: 'cee_inference', value: 0.2 },
            },
          },
          {
            id: 'opt1',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Hire Tech Lead' },
          },
          {
            id: 'opt2',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Status Quo', is_baseline: true },
          },
        ],
        edges: [
          { id: 'e1', source: 'factor1', target: 'goal1', type: 'default' },
          { id: 'e2', source: 'factor2', target: 'goal1', type: 'default' },
        ],
        ceeAnalysisReady: {
          status: 'analysis_ready',
          goal_node_id: 'goal1',
          options: [
            { id: 'opt1', interventions: { factor1: 1, factor2: 0.5 } },
            { id: 'opt2', interventions: { factor1: 0, factor2: 0.2 } },
          ],
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // factor1 excluded as binary lever (interventions all 0/1, no metadata)
      // factor2 included (interventions 0.5/0.2, not all binary)
      expect(result.current.totalReviewableFactorsCount).toBe(1)
      // many_ai_estimates check fires (all AI, no brief)
      expect(result.current.qualityChecks).toContainEqual(
        expect.objectContaining({ id: 'many_ai_estimates' })
      )
    })

    it('shows many_ai_estimates check when reviewable assumptions exist', () => {
      // factor2 is NOT an intervention target → reviewable
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'goal1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Grow Revenue' },
          },
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Ad Spend',
              category: 'controllable',
              observed_state: { source: 'cee_inference', value: 5000 },
            },
          },
          {
            id: 'factor2',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Market Demand',
              category: 'external',
              observed_state: { source: 'cee_inference', value: 0.7 },
            },
          },
          {
            id: 'factor3',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Competitor Strength',
              category: 'external',
              observed_state: { source: 'cee_inference', value: 0.5 },
            },
          },
          {
            id: 'opt1',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Increase Ads' },
          },
          {
            id: 'opt2',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Status Quo', is_baseline: true },
          },
        ],
        edges: [
          { id: 'e1', source: 'factor1', target: 'goal1', type: 'default' },
          { id: 'e2', source: 'factor2', target: 'goal1', type: 'default' },
          { id: 'e3', source: 'factor3', target: 'goal1', type: 'default' },
        ],
        ceeAnalysisReady: {
          status: 'analysis_ready',
          goal_node_id: 'goal1',
          options: [
            { id: 'opt1', interventions: { factor1: 10000 } },
            { id: 'opt2', interventions: {} },
          ],
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // factor2 and factor3 are reviewable (not intervention targets, AI-sourced)
      expect(result.current.totalReviewableFactorsCount).toBeGreaterThan(0)
      // many_ai_estimates check should be present (AI count > brief count)
      expect(result.current.qualityChecks).toContainEqual(
        expect.objectContaining({ id: 'many_ai_estimates' })
      )
    })

    it('fires many_ai_estimates even when all factors are binary levers', () => {
      // All factors are binary levers (intervention values are 0 or 1 only)
      // → totalReviewableFactorsCount === 0, but AI-sourced factors still warrant a nudge
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'goal1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Grow Revenue' },
          },
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Feature Enabled',
              category: 'controllable',
              observed_state: { source: 'cee_inference', value: 0 },
            },
          },
          {
            id: 'factor2',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Campaign Active',
              category: 'controllable',
              observed_state: { source: 'cee_inference', value: 0 },
            },
          },
          {
            id: 'opt1',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Launch Both' },
          },
          {
            id: 'opt2',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Status Quo', is_baseline: true },
          },
        ],
        edges: [
          { id: 'e1', source: 'factor1', target: 'goal1', type: 'default' },
          { id: 'e2', source: 'factor2', target: 'goal1', type: 'default' },
        ],
        ceeAnalysisReady: {
          status: 'analysis_ready',
          goal_node_id: 'goal1',
          options: [
            { id: 'opt1', interventions: { factor1: 1, factor2: 1 } },
            { id: 'opt2', interventions: { factor1: 0, factor2: 0 } },
          ],
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // Both factors are binary levers → 0 reviewable (unchanged)
      expect(result.current.totalReviewableFactorsCount).toBe(0)
      // many_ai_estimates DOES fire — binary AI-sourced factors still warrant a nudge
      expect(result.current.qualityChecks).toContainEqual(
        expect.objectContaining({ id: 'many_ai_estimates' })
      )
    })
  })

  describe('Task 1: brief_extraction intervention targets excluded', () => {
    it('excludes brief_extraction factors when targeted by interventions', () => {
      mockUseCanvasStore.mockImplementation(createMockStore({
        nodes: [
          {
            id: 'goal1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Improve Productivity' },
          },
          {
            id: 'factor1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Tech Lead Hired',
              category: 'controllable',
              observed_state: { source: 'brief_extraction', value: 0 },
            },
          },
          {
            id: 'opt1',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Hire Tech Lead' },
          },
          {
            id: 'opt2',
            type: 'option',
            position: { x: 0, y: 0 },
            data: { label: 'Status Quo', is_baseline: true },
          },
        ],
        ceeAnalysisReady: {
          status: 'analysis_ready',
          goal_node_id: 'goal1',
          options: [
            { id: 'opt1', interventions: { factor1: 1 } },
            { id: 'opt2', interventions: { factor1: 0 } },
          ],
        },
      }))

      const { result } = renderHook(() => usePreAnalysisData())

      // Binary lever factor excluded even with brief_extraction source —
      // no raw_value/cap/unit and all interventions are 0 or 1
      expect(result.current.improvementsByCategory.verify).not.toContainEqual(
        expect.objectContaining({ key: 'verify_factor1' })
      )
      expect(result.current.totalReviewableFactorsCount).toBe(0)
    })
  })

  // Task 3: CEE coaching.summary as primary coaching line
  describe('Task 3: coaching_summary from CEE', () => {
    it('uses CEE coaching_summary as primary coaching line when present', () => {
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A' } },
            { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Status Quo', is_baseline: true } },
          ],
          edges: [],
          ceeAnalysisReady: {
            status: 'ready',
            goal_node_id: 'goal1',
            options: [
              { id: 'opt1', interventions: {} },
              { id: 'opt2', interventions: {} },
            ],
            coaching_summary: 'Your decision hinges on the unverified impact of hiring on financial risk.',
          },
          runMeta: null,
        }
        return selector(state)
      })

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.coachingSummary).toBe(
        'Your decision hinges on the unverified impact of hiring on financial risk.'
      )
    })

    it('returns null fallback when coaching_summary is absent and no graph is loaded', () => {
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [],
          edges: [],
          ceeAnalysisReady: {
            status: 'ready',
            goal_node_id: 'goal1',
            options: [],
            // No coaching_summary field
          },
          runMeta: null,
        }
        return selector(state)
      })

      const { result } = renderHook(() => usePreAnalysisData())

      // No coaching_summary falls back to the derived blocker summary
      expect(result.current.coachingSummary).toBe('2 issues to fix before running analysis.')
      // Crucially: it is NOT the CEE summary string
      expect(result.current.coachingSummary).not.toBe(
        'Your decision hinges on the unverified impact of hiring on financial risk.'
      )
    })

    it('returns null coaching summary when coaching_summary is null', () => {
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [],
          edges: [],
          ceeAnalysisReady: {
            status: 'ready',
            goal_node_id: 'goal1',
            options: [],
            coaching_summary: null,
          },
          runMeta: null,
        }
        return selector(state)
      })
      mockExistingHook.mockReturnValue({
        canRun: false,
        hasBlockers: true,
        allIssues: [{ type: 'blocker', message: 'Fix first', action: null }],
        fixFirstIssues: [],
        remainingCount: 0,
        limitingFactor: null,
        quality: null,
        readyOptionsCount: 0,
        totalOptionsCount: 0,
        edgeProvenance: null,
        isLoading: false,
      })

      const { result } = renderHook(() => usePreAnalysisData())

      expect(result.current.coachingSummary).toBe('2 issues to fix before running analysis.')
    })
  })

  // Task 6: SAME_LEVER_OPTIONS detail field
  describe('Task 1 (v12): goal_baseline_missing fires when goal has no observed_state', () => {
    it('fires when goal node has NO observed_state at all', () => {
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [
            // Goal node with no observed_state — matches the mid-market debug scenario
            { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Reach 200 Mid-Market Customers' } },
          ],
          edges: [],
          ceeAnalysisReady: {
            status: 'ready',
            goal_node_id: 'goal1',
            options: [],
          },
          runMeta: null,
        }
        return selector(state)
      })

      const { result } = renderHook(() => usePreAnalysisData())

      const check = result.current.qualityChecks.find(c => c.id === 'goal_baseline_missing')
      expect(check).toBeDefined()
      expect(check?.cta).toBe('Set current value')
    })

    it('does NOT fire when goal has observed_state.value (even without explicit baseline)', () => {
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [
            { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: {
              label: 'Goal',
              observedState: { value: 0.5, baseline: null },
            }},
          ],
          edges: [],
          ceeAnalysisReady: {
            status: 'ready',
            goal_node_id: 'goal1',
            options: [],
          },
          runMeta: null,
        }
        return selector(state)
      })

      const { result } = renderHook(() => usePreAnalysisData())

      // value is present — PLoT can use it as implicit baseline, no warning needed
      const check = result.current.qualityChecks.find(c => c.id === 'goal_baseline_missing')
      expect(check).toBeUndefined()
    })

    it('does NOT fire when goal has an explicit baseline different from value', () => {
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [
            { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: {
              label: 'Goal',
              observedState: { value: 0.5, baseline: 0.2 }, // explicit baseline
            }},
          ],
          edges: [],
          ceeAnalysisReady: {
            status: 'ready',
            goal_node_id: 'goal1',
            options: [],
          },
          runMeta: null,
        }
        return selector(state)
      })

      const { result } = renderHook(() => usePreAnalysisData())

      const check = result.current.qualityChecks.find(c => c.id === 'goal_baseline_missing')
      expect(check).toBeUndefined()
    })
  })

  describe('Task 2 (v12): unchanged intervention suppression', () => {
    it('omits intervention when qualitative value equals current value', () => {
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Partner' } },
            // factor with observedState.value = 0.5 (qualitative, no cap/unit)
            { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: {
              label: 'Integration Complexity',
              observedState: { value: 0.5, cap: null, unit: null },
            }},
          ],
          edges: [],
          ceeAnalysisReady: {
            status: 'ready',
            goal_node_id: 'goal1',
            options: [
              { id: 'opt1', status: 'ready', interventions: { fac1: 0.5 } }, // same as current
            ],
          },
          runMeta: null,
        }
        return selector(state)
      })

      const { result } = renderHook(() => usePreAnalysisData())

      const option = result.current.optionPreviews.find(o => o.id === 'opt1')
      expect(option).toBeDefined()
      // Intervention should be filtered out (0.5 === 0.5)
      expect(option?.interventions).toHaveLength(0)
    })

    it('keeps intervention when qualitative value differs from current', () => {
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A' } },
            { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: {
              label: 'Sales Cycle',
              observedState: { value: 0.3, cap: null, unit: null },
            }},
          ],
          edges: [],
          ceeAnalysisReady: {
            status: 'ready',
            goal_node_id: 'goal1',
            options: [
              { id: 'opt1', status: 'ready', interventions: { fac1: 0.7 } }, // differs from 0.3
            ],
          },
          runMeta: null,
        }
        return selector(state)
      })

      const { result } = renderHook(() => usePreAnalysisData())

      const option = result.current.optionPreviews.find(o => o.id === 'opt1')
      expect(option?.interventions).toHaveLength(1)
      expect(option?.interventions[0].factorId).toBe('fac1')
    })

    it('keeps intervention when current value is unknown (no observed_state)', () => {
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A' } },
            { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Unknown Factor' } },
          ],
          edges: [],
          ceeAnalysisReady: {
            status: 'ready',
            goal_node_id: 'goal1',
            options: [
              { id: 'opt1', status: 'ready', interventions: { fac1: 0.5 } },
            ],
          },
          runMeta: null,
        }
        return selector(state)
      })

      const { result } = renderHook(() => usePreAnalysisData())

      const option = result.current.optionPreviews.find(o => o.id === 'opt1')
      // Unknown baseline → always show
      expect(option?.interventions).toHaveLength(1)
    })

    it('shows only changed intervention when one matches baseline and one does not', () => {
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A' } },
            { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: {
              label: 'Unchanged Factor',
              observedState: { value: 0.5, cap: null, unit: null },
            }},
            { id: 'fac2', type: 'factor', position: { x: 0, y: 0 }, data: {
              label: 'Changed Factor',
              observedState: { value: 0.3, cap: null, unit: null },
            }},
          ],
          edges: [],
          ceeAnalysisReady: {
            status: 'ready',
            goal_node_id: 'goal1',
            options: [
              { id: 'opt1', status: 'ready', interventions: { fac1: 0.5, fac2: 0.7 } },
            ],
          },
          runMeta: null,
        }
        return selector(state)
      })

      const { result } = renderHook(() => usePreAnalysisData())

      const option = result.current.optionPreviews.find(o => o.id === 'opt1')
      expect(option?.interventions).toHaveLength(1)
      expect(option?.interventions[0].factorId).toBe('fac2')
    })

    it('omits dimensional intervention when direction is same (currentRawValue known, equal)', () => {
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A' } },
            // dimensional factor: cap=100 (raw unit), value=0.5 → raw=50
            { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: {
              label: 'Revenue',
              observedState: { value: 0.5, cap: 100, unit: '$k' },
            }},
          ],
          edges: [],
          ceeAnalysisReady: {
            status: 'ready',
            goal_node_id: 'goal1',
            options: [
              // intervention = 0.5 normalised, same as current → direction='same'
              { id: 'opt1', status: 'ready', interventions: { fac1: 0.5 } },
            ],
          },
          runMeta: null,
        }
        return selector(state)
      })

      const { result } = renderHook(() => usePreAnalysisData())

      const option = result.current.optionPreviews.find(o => o.id === 'opt1')
      // direction='same' for dimensional factor with known baseline → should be omitted
      expect(option?.interventions).toHaveLength(0)
    })

    it('keeps dimensional intervention when currentRawValue is unknown', () => {
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A' } },
            // dimensional factor but no observed_state → currentRawValue unknown
            { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: {
              label: 'Revenue',
              observedState: { cap: 100, unit: '$k' }, // value absent
            }},
          ],
          edges: [],
          ceeAnalysisReady: {
            status: 'ready',
            goal_node_id: 'goal1',
            options: [
              { id: 'opt1', status: 'ready', interventions: { fac1: 0.5 } },
            ],
          },
          runMeta: null,
        }
        return selector(state)
      })

      const { result } = renderHook(() => usePreAnalysisData())

      const option = result.current.optionPreviews.find(o => o.id === 'opt1')
      // No baseline → always show
      expect(option?.interventions).toHaveLength(1)
    })
  })

  describe('Task 6: same_levers quality check detail', () => {
    it('includes detail text in same_levers quality check', () => {
      // Create two options that share >80% of affected factors
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A' } },
            { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option B' } },
            { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 1' } },
          ],
          edges: [],
          ceeAnalysisReady: {
            status: 'ready',
            goal_node_id: 'goal1',
            options: [
              { id: 'opt1', status: 'ready', interventions: { fac1: 0.8 } },
              { id: 'opt2', status: 'ready', interventions: { fac1: 0.3 } },
            ],
          },
          runMeta: null,
        }
        return selector(state)
      })

      const { result } = renderHook(() => usePreAnalysisData())

      const sameLeverCheck = result.current.qualityChecks.find(c => c.id === 'same_levers')
      expect(sameLeverCheck).toBeDefined()
      expect(sameLeverCheck?.detail).toBe(
        'When options change the same drivers, results may cluster together; consider whether your options represent genuinely different approaches'
      )
    })

    it('Task 2 (v13) many_ai_estimates + goal_baseline_missing both fire with total count 2', () => {
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [
            { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Revenue Growth' } },
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A' } },
            { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option B' } },
            { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F1', observed_state: { value: 0.5, source: 'cee_inference' } } },
            { id: 'fac2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F2', observed_state: { value: 0.3, source: 'cee_inference' } } },
            { id: 'fac3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F3', observed_state: { value: 0.7, source: 'cee_inference' } } },
            { id: 'fac4', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F4', observed_state: { value: 0.2, source: 'brief_extraction' } } },
            { id: 'fac5', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F5', observed_state: { value: 0.9, source: 'cee_inference' } } },
          ],
          edges: [
            { id: 'e1', source: 'fac1', target: 'goal1', data: { weight: 0.5, direction: 'positive' } },
          ],
          ceeAnalysisReady: {
            status: 'ready',
            goal_node_id: 'goal1',
            options: [
              { id: 'opt1', status: 'ready', interventions: {} },
              { id: 'opt2', status: 'ready', interventions: {} },
            ],
          },
          runMeta: null,
        }
        return selector(state)
      })

      const { result } = renderHook(() => usePreAnalysisData())

      const goalBaselineMissing = result.current.qualityChecks.find(c => c.id === 'goal_baseline_missing')
      const manyAiEstimates = result.current.qualityChecks.find(c => c.id === 'many_ai_estimates')

      expect(goalBaselineMissing).toBeDefined()
      expect(manyAiEstimates).toBeDefined()

      const bothPresent = result.current.qualityChecks.filter(
        c => c.id === 'goal_baseline_missing' || c.id === 'many_ai_estimates'
      )
      expect(bothPresent).toHaveLength(2)
    })

    it('Task 5 (v13) €49 currency suppression — shows €49 not €49 of 100', () => {
      mockUseCanvasStore.mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          nodes: [
            { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Revenue' } },
            { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A' } },
            { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option B' } },
            {
              id: 'fac1', type: 'factor', position: { x: 0, y: 0 },
              data: {
                label: 'Pro Plan Price',
                observed_state: { value: 0.49, raw_value: 49, unit: '€', cap: 100, source: 'brief_extraction' },
              },
            },
          ],
          edges: [],
          ceeAnalysisReady: null,
          runMeta: null,
        }
        return selector(state)
      })

      const { result } = renderHook(() => usePreAnalysisData())

      const verifyItem = result.current.improvementsByCategory.verify.find(i => i.key === 'verify_fac1')
      expect(verifyItem).toBeDefined()
      expect(verifyItem!.detail).toBe('€49')
      expect(verifyItem!.detail).not.toContain('of')
    })
  })
})

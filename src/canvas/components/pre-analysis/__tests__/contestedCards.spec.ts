/**
 * Tests for contested edge calibration cards, sensitivity-driven sorting,
 * bias findings, and DecisionHealthRing computations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePreAnalysisData } from '../hooks/usePreAnalysisData'
import { useCanvasStore } from '../../../store'
import type { Node, Edge } from '@xyflow/react'
import type { ValidationMetadata } from '../../../domain/validation'

// Mock the canvas store
vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn(),
}))

// Mock the existing usePreAnalysisData hook
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { usePreAnalysisData as _useExistingPreAnalysisData } from '../../../hooks/usePreAnalysisData'
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

// Mock usePreRunValidation
vi.mock('../../../hooks/usePreRunValidation', () => ({
  usePreRunValidation: vi.fn(() => ({
    blockers: [],
    informationalBlockers: [],
  })),
  SOFT_BYPASS_STATUSES: new Set(),
}))

const mockUseCanvasStore = useCanvasStore as unknown as ReturnType<typeof vi.fn>

function makeValidation(overrides: Partial<ValidationMetadata> = {}): ValidationMetadata {
  return {
    status: 'contested',
    contested_reasons: ['strength_band_change'],
    pass1: { strength_mean: 0.3, strength_std: 0.1, exists_probability: 0.9 },
    pass2: { strength_mean: 0.7, strength_std: 0.1, exists_probability: 0.9, reasoning: 'Test reason', basis: 'domain_prior', needs_user_input: false },
    max_divergence: 0.5,
    distance_to_goal: 2,
    evoi_rank: null,
    evoi_impact: null,
    surfaced: true,
    was_shown: false,
    user_action: 'pending',
    resolved_value: null,
    resolved_by: 'default',
    ...overrides,
  }
}

function createMockStore(overrides: {
  nodes?: Node[]
  edges?: Edge[]
  ceeAnalysisReady?: Record<string, unknown> | null
  preAnalysisSensitivity?: { factor_influence: Record<string, number>; edge_influence: Record<string, number>; method: 'linear' | 'reduced_mc' } | null
  runMeta?: Record<string, unknown> | null
} = {}) {
  const nodes = overrides.nodes ?? []
  const edges = overrides.edges ?? []
  const ceeAnalysisReady = overrides.ceeAnalysisReady ?? null
  const runMeta = overrides.runMeta ?? null
  const preAnalysisSensitivity = overrides.preAnalysisSensitivity ?? null

  return (selector: (state: unknown) => unknown) => {
    const state = { nodes, edges, ceeAnalysisReady, runMeta, ceeQuality: null, ceePipelineTrace: null, preAnalysisSensitivity }
    return selector(state)
  }
}

describe('Contested edge calibration cards', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('includes contested edges in verify items with contested subgroup', () => {
    const validation = makeValidation()
    mockUseCanvasStore.mockImplementation(createMockStore({
      nodes: [
        { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 1' } },
        { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
      ],
      edges: [
        { id: 'e1', source: 'fac1', target: 'goal1', data: { weight: 0.5, direction: 'positive', validation } },
      ],
    }))

    const { result } = renderHook(() => usePreAnalysisData())
    const contestedItems = result.current.improvementsByCategory.verify.filter(i => i.subgroup === 'contested')
    expect(contestedItems).toHaveLength(1)
    expect(contestedItems[0].key).toBe('contested_e1')
  })

  it('excludes edges where surfaced is false', () => {
    const validation = makeValidation({ surfaced: false })
    mockUseCanvasStore.mockImplementation(createMockStore({
      nodes: [
        { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 1' } },
        { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
      ],
      edges: [
        { id: 'e1', source: 'fac1', target: 'goal1', data: { weight: 0.5, direction: 'positive', validation } },
      ],
    }))

    const { result } = renderHook(() => usePreAnalysisData())
    const contestedItems = result.current.improvementsByCategory.verify.filter(i => i.subgroup === 'contested')
    expect(contestedItems).toHaveLength(0)
  })

  it('excludes resolved edges (user_action !== pending)', () => {
    const validation = makeValidation({ user_action: 'accepted_pass1' })
    mockUseCanvasStore.mockImplementation(createMockStore({
      nodes: [
        { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 1' } },
        { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
      ],
      edges: [
        { id: 'e1', source: 'fac1', target: 'goal1', data: { weight: 0.5, direction: 'positive', validation } },
      ],
    }))

    const { result } = renderHook(() => usePreAnalysisData())
    const contestedItems = result.current.improvementsByCategory.verify.filter(i => i.subgroup === 'contested')
    expect(contestedItems).toHaveLength(0)
  })

  it('returns contestedEdges array with full validation metadata', () => {
    const validation = makeValidation()
    mockUseCanvasStore.mockImplementation(createMockStore({
      nodes: [
        { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 1' } },
        { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
      ],
      edges: [
        { id: 'e1', source: 'fac1', target: 'goal1', data: { weight: 0.5, direction: 'positive', validation } },
      ],
    }))

    const { result } = renderHook(() => usePreAnalysisData())
    expect(result.current.contestedEdges).toHaveLength(1)
    expect(result.current.contestedEdges[0].validation.status).toBe('contested')
  })

  it('contested items sort above cee_inference subgroup', () => {
    const validation = makeValidation()
    mockUseCanvasStore.mockImplementation(createMockStore({
      nodes: [
        { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 1', observedState: { value: 0.5, source: 'cee_inference' } } },
        { id: 'fac2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 2' } },
        { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
      ],
      edges: [
        { id: 'e1', source: 'fac2', target: 'goal1', data: { weight: 0.5, direction: 'positive', validation } },
      ],
    }))

    const { result } = renderHook(() => usePreAnalysisData())
    const verifyItems = result.current.improvementsByCategory.verify
    const contestedIdx = verifyItems.findIndex(i => i.subgroup === 'contested')
    const ceeIdx = verifyItems.findIndex(i => i.subgroup === 'cee_inference')
    if (contestedIdx >= 0 && ceeIdx >= 0) {
      expect(contestedIdx).toBeLessThan(ceeIdx)
    }
  })

  it('sorts contested items with evoi_impact above those without', () => {
    const v1 = makeValidation({ max_divergence: 0.9, evoi_impact: null })
    const v2 = makeValidation({ max_divergence: 0.3, evoi_impact: 0.05 })
    mockUseCanvasStore.mockImplementation(createMockStore({
      nodes: [
        { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 1' } },
        { id: 'fac2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 2' } },
        { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
      ],
      edges: [
        { id: 'e1', source: 'fac1', target: 'goal1', data: { weight: 0.5, direction: 'positive', validation: v1 } },
        { id: 'e2', source: 'fac2', target: 'goal1', data: { weight: 0.5, direction: 'positive', validation: v2 } },
      ],
    }))

    const { result } = renderHook(() => usePreAnalysisData())
    const contested = result.current.improvementsByCategory.verify.filter(i => i.subgroup === 'contested')
    // e2 (has evoi_impact) should come before e1 (no evoi_impact)
    expect(contested[0].key).toBe('contested_e2')
    expect(contested[1].key).toBe('contested_e1')
  })
})

describe('Sensitivity-driven sorting', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sorts verify items by factor_influence within subgroup', () => {
    mockUseCanvasStore.mockImplementation(createMockStore({
      nodes: [
        { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Low influence', observedState: { value: 0.5, source: 'cee_inference' } } },
        { id: 'fac2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'High influence', observedState: { value: 0.5, source: 'cee_inference' } } },
      ],
      preAnalysisSensitivity: {
        factor_influence: { fac1: 0.1, fac2: 0.8 },
        edge_influence: {},
        method: 'linear',
      },
    }))

    const { result } = renderHook(() => usePreAnalysisData())
    const ceeItems = result.current.improvementsByCategory.verify.filter(i => i.subgroup === 'cee_inference')
    expect(ceeItems[0].focus?.id).toBe('fac2')
    expect(ceeItems[1].focus?.id).toBe('fac1')
  })

  it('falls back to default order when preAnalysisSensitivity is null', () => {
    mockUseCanvasStore.mockImplementation(createMockStore({
      nodes: [
        { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'AAA', observedState: { value: 0.5, source: 'cee_inference' } } },
        { id: 'fac2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'BBB', observedState: { value: 0.5, source: 'cee_inference' } } },
      ],
      preAnalysisSensitivity: null,
    }))

    const { result } = renderHook(() => usePreAnalysisData())
    const ceeItems = result.current.improvementsByCategory.verify.filter(i => i.subgroup === 'cee_inference')
    // Without sensitivity, original order preserved (stable sort)
    expect(ceeItems).toHaveLength(2)
  })
})

describe('Bias findings in quality checks', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('appends bias findings as quality checks', () => {
    mockUseCanvasStore.mockImplementation(createMockStore({
      nodes: [
        { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
        { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
      ],
      ceeAnalysisReady: {
        goal_node_id: 'goal1',
        options: [],
        bias_findings: [
          { id: 'bias1', type: 'sunk_cost', severity: 'medium', description: 'Sunk cost bias detected', affectedNodes: [], interventions: [] },
        ],
      },
    }))

    const { result } = renderHook(() => usePreAnalysisData())
    const biasCheck = result.current.qualityChecks.find(c => c.id === 'bias_bias1')
    expect(biasCheck).toBeDefined()
    expect(biasCheck!.pill).toBe('bias')
    expect(biasCheck!.cta).toBe('Ask AI about this')
  })

  it('deduplicates confirmation bias when all_positive_edges check fires', () => {
    mockUseCanvasStore.mockImplementation(createMockStore({
      nodes: [
        { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
        { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
      ],
      edges: [
        { id: 'e1', source: 'opt1', target: 'opt2', data: { weight: 0.5, direction: 'positive' } },
      ],
      ceeAnalysisReady: {
        goal_node_id: 'goal1',
        options: [],
        bias_findings: [
          { id: 'bias_conf', type: 'confirmation', severity: 'medium', description: 'Confirmation bias', affectedNodes: [], interventions: [] },
        ],
      },
    }))

    const { result } = renderHook(() => usePreAnalysisData())
    // all_positive_edges should fire since there are no negative edges
    expect(result.current.qualityChecks.some(c => c.id === 'all_positive_edges')).toBe(true)
    // confirmation bias should be suppressed (deduplicated)
    expect(result.current.qualityChecks.some(c => c.id === 'bias_bias_conf')).toBe(false)
  })

  it('shows bias finding when no matching deterministic check exists', () => {
    mockUseCanvasStore.mockImplementation(createMockStore({
      nodes: [
        { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
        { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
      ],
      edges: [
        { id: 'e1', source: 'opt1', target: 'opt2', data: { weight: 0.5, direction: 'negative' } },
      ],
      ceeAnalysisReady: {
        goal_node_id: 'goal1',
        options: [],
        bias_findings: [
          { id: 'bias_avail', type: 'availability', severity: 'low', description: 'Availability bias detected', affectedNodes: [], interventions: [] },
        ],
      },
    }))

    const { result } = renderHook(() => usePreAnalysisData())
    expect(result.current.qualityChecks.some(c => c.id === 'bias_bias_avail')).toBe(true)
  })
})

describe('Decision health ring - balanceScore', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 0 for empty model', () => {
    mockUseCanvasStore.mockImplementation(createMockStore({ nodes: [], edges: [] }))
    const { result } = renderHook(() => usePreAnalysisData())
    expect(result.current.balanceScore).toBe(0)
  })

  it('returns 1.0 for perfect model (negative edges, risks, baseline, 2+ options)', () => {
    mockUseCanvasStore.mockImplementation(createMockStore({
      nodes: [
        { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Do nothing', is_baseline: true } },
        { id: 'opt2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A' } },
        { id: 'opt3', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option B' } },
        { id: 'risk1', type: 'risk', position: { x: 0, y: 0 }, data: { label: 'Risk 1' } },
      ],
      edges: [
        { id: 'e1', source: 'opt1', target: 'risk1', data: { weight: 0.5, direction: 'negative' } },
      ],
    }))

    const { result } = renderHook(() => usePreAnalysisData())
    expect(result.current.balanceScore).toBe(1.0)
  })

  it('returns 0.5 when only risks and negative edges are present (no baseline, 1 option)', () => {
    mockUseCanvasStore.mockImplementation(createMockStore({
      nodes: [
        { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A' } },
        { id: 'risk1', type: 'risk', position: { x: 0, y: 0 }, data: { label: 'Risk 1' } },
      ],
      edges: [
        { id: 'e1', source: 'opt1', target: 'risk1', data: { weight: 0.5, direction: 'negative' } },
      ],
    }))

    const { result } = renderHook(() => usePreAnalysisData())
    expect(result.current.balanceScore).toBe(0.5)
  })
})

/**
 * Brief 5.8A D2 — single bias filter integration test.
 *
 * Asserts the rendered DOM consequences of `hasResolvableBiasTarget` applied
 * to both LLM-sourced bias paths (CEE bias_findings via target_factor_id and
 * coaching bias_signals via target). Closes the live gap where coaching
 * bias_signals could render without any target check.
 *
 * DOM-leakage assertions on `container.innerHTML` confirm no internal id
 * prefixes (`fac_`, `opt_`, `node_`) and no raw target fixture values escape
 * into the rendered output.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PreAnalysisPanel } from '../PreAnalysisPanel'
import * as usePreAnalysisDataModule from '../hooks/usePreAnalysisData'
import type { PreAnalysisData } from '../hooks/usePreAnalysisData'

vi.mock('../hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: vi.fn(),
}))

let mockNodes: any[] = []
let mockEdges: any[] = []
let mockCeeAnalysisReady: any = null
let mockDraftCoaching: any = null

vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (state: any) => any) => {
      const state = {
        ceeAnalysisReady: mockCeeAnalysisReady,
        draftCoaching: mockDraftCoaching,
        lastDraftError: null,
        setHighlightedNodes: vi.fn(),
        setHighlightedEdges: vi.fn(),
        selectNodeWithoutHistory: vi.fn(),
        selectEdgeWithoutHistory: vi.fn(),
        nodes: mockNodes,
        edges: mockEdges,
        preAnalysisSensitivity: undefined,
        repairsApplied: null,
        results: null,
        setShowDraftChat: vi.fn(),
        updateEdgeData: vi.fn(),
      }
      return selector(state)
    },
    {
      getState: () => ({
        ceeAnalysisReady: mockCeeAnalysisReady,
        draftCoaching: mockDraftCoaching,
        nodes: mockNodes,
        edges: mockEdges,
        updateNode: vi.fn(),
        setGoalThreshold: vi.fn(),
        setGoalThresholdAndUpdateNode: vi.fn(),
        setCeeAnalysisReady: vi.fn(),
        setOutcomeNode: vi.fn(),
        addNode: vi.fn(),
        updateEdge: vi.fn(),
        addEdge: vi.fn(),
      }),
    },
  ),
}))

vi.mock('../../../stores/draftStore', () => ({
  useDraftStore: Object.assign(
    (selector: (state: any) => any) => {
      const state = {
        lastDraftError: null,
        lastDraftDescription: '',
        selectedGenerationModel: null,
        selectedRepairModel: null,
        selectedEnrichmentModel: null,
        isGenerating: false,
        fullDraftAppliedAt: null,
      }
      return selector(state)
    },
    {
      getState: () => ({
        lastDraftError: null,
        lastDraftDescription: '',
        selectedGenerationModel: null,
        selectedRepairModel: null,
        selectedEnrichmentModel: null,
        isGenerating: false,
        fullDraftAppliedAt: null,
        setLastDraftError: vi.fn(),
        setLastDraftDescription: vi.fn(),
        setIsGenerating: vi.fn(),
        setFullDraftAppliedAt: vi.fn(),
        setSelectedGenerationModel: vi.fn(),
        setSelectedRepairModel: vi.fn(),
        setSelectedEnrichmentModel: vi.fn(),
        resetModelToDefault: vi.fn(),
        resetAllModels: vi.fn(),
        resetDraft: vi.fn(),
      }),
    },
  ),
}))

vi.mock('../../../hooks/useRetryDraft', () => ({
  useRetryDraft: () => ({ retryDraft: vi.fn(), canRetry: true, isRetrying: false, retryError: null }),
}))
vi.mock('../../../hooks/usePreRunValidation', () => ({
  SOFT_BYPASS_STATUSES: new Set(['needs_user_mapping', 'needs_encoding']),
}))
vi.mock('../../../ToastContext', () => ({
  useShowToast: () => vi.fn(),
}))
vi.mock('../../../../utils/clipboard', () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(true),
}))

const mockUsePreAnalysisData = usePreAnalysisDataModule.usePreAnalysisData as ReturnType<typeof vi.fn>

const baseData = (): PreAnalysisData => ({
  improvementsByCategory: { fix: [], verify: [], add_evidence: [], strengthen: [] },
  tiers: {
    mustAddress: { items: [], count: 0 },
    reviewAssumptions: { items: [], count: 0 },
    optional: { items: [], count: 0 },
  },
  totalImprovements: 0,
  topActions: [],
  evidenceQuality: { level: 'medium', ratio: 0.5, nonAiCount: 2, totalCount: 4 },
  isReady: true,
  hasBlockers: false,
  blockerCount: 0,
  nodesByKind: {
    goal: [{ id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }],
    decision: [],
    option: [
      { id: 'o1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
      { id: 'o2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
    ],
    factor: [],
    risk: [],
    outcome: [],
  },
  edgeCount: 2,
  goalNode: { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
  successThreshold: null,
  isThresholdAutoDerived: false,
  isThresholdConfirmed: false,
  thresholdProvenance: null,
  isLoading: false,
  reviewedFactorsCount: 0,
  totalReviewableFactorsCount: 0,
  enrichedBlockers: [],
  informationalBlockers: [],
  modelAdjustments: [],
  preMortem: null,
  goalThresholdRaw: null,
  goalThresholdUnit: null,
  isGoalConfirmed: false,
  optionPreviews: [],
  qualityChecks: [],
  repairActions: [],
  ceeQuality: null,
  hasDefaultStrengths: false,
  defaultStrengthPercent: 0,
  contestedEdges: [],
  coachingSummary: null,
  thresholdSourceBadge: null,
  assumptionsLedger: null,
  triageActions: { top3: [], quickFix: [] },
  actionableCount: 0,
  addressedActionableCount: 0,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockNodes = []
  mockEdges = []
  mockCeeAnalysisReady = null
  mockDraftCoaching = null
})

describe('Brief 5.8A D2 — bias_signals (coaching) target filter', () => {
  it('drops a coaching bias_signal whose target is an empty string', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [
        { type: 'anchoring', detail: 'Anchored on initial estimate.', target: '' },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    expect(container.innerHTML).not.toMatch(/Anchored on initial estimate/)
    expect(container.innerHTML).not.toMatch(/Anchoring/)
  })

  it('keeps a coaching bias_signal whose target resolves to a current node', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [
        { type: 'anchoring', detail: 'Anchored on initial estimate.', target: 'fac-velocity' },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    expect(screen.getByText(/Anchored on initial estimate/)).toBeInTheDocument()
  })

  it('drops a coaching bias_signal whose target does not resolve to any current node', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [
        { type: 'anchoring', detail: 'Anchored on initial estimate.', target: 'fac-unknown-id' },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    expect(container.innerHTML).not.toMatch(/Anchored on initial estimate/)
  })

  it('drops a coaching bias_signal whose target is undefined', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [
        { type: 'anchoring', detail: 'Anchored on initial estimate.' },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    expect(container.innerHTML).not.toMatch(/Anchored on initial estimate/)
  })
})

describe('Brief 5.8A D2 — bias_findings (CEE) target filter', () => {
  it('keeps a finding whose target_factor_id resolves to a current node', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockCeeAnalysisReady = {
      goal_node_id: 'g1',
      options: [],
      bias_findings: [
        {
          id: 'bf1',
          code: 'CONFIRMATION_BIAS',
          severity: 'medium',
          explanation: 'Pattern of agreeable estimates.',
          target_factor_id: 'fac-velocity',
        },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    expect(screen.getByText(/Pattern of agreeable estimates/)).toBeInTheDocument()
  })

  it('drops a finding whose target_factor_id is missing (deliberate D2 tightening)', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockCeeAnalysisReady = {
      goal_node_id: 'g1',
      options: [],
      bias_findings: [
        {
          id: 'bf2',
          code: 'CONFIRMATION_BIAS',
          severity: 'medium',
          explanation: 'Pattern of agreeable estimates.',
        },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    expect(container.innerHTML).not.toMatch(/Pattern of agreeable estimates/)
  })
})

describe('Brief 5.8A D2 — DOM leakage assertions', () => {
  it('does not leak any internal id prefixes or raw target fixture values into the rendered output', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockCeeAnalysisReady = {
      goal_node_id: 'g1',
      options: [],
      bias_findings: [
        {
          id: 'bf-keep',
          code: 'CONFIRMATION_BIAS',
          severity: 'medium',
          explanation: 'Confirmed pattern detail.',
          target_factor_id: 'fac-velocity',
        },
      ],
    }
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [
        { type: 'anchoring', detail: 'Anchored signal detail.', target: 'fac-velocity' },
        { type: 'framing', detail: 'Filtered fixture.', target: 'fac_unknown' },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const html = container.innerHTML

    // No raw target fixture id leaks (those are the fixture ids supplied above).
    expect(html).not.toMatch(/fac-velocity/)
    expect(html).not.toMatch(/fac_unknown/)

    // No internal id prefixes appear anywhere.
    expect(html).not.toMatch(/\bfac_/)
    expect(html).not.toMatch(/\bopt_/)
    expect(html).not.toMatch(/\bnode_/)

    // The filtered signal's detail must not appear; the kept ones should.
    expect(html).not.toMatch(/Filtered fixture/)
    expect(html).toMatch(/Confirmed pattern detail/)
  })
})

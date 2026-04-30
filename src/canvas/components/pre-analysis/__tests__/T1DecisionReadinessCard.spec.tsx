/**
 * Brief 5.8A D3a — T1 Decision readiness card render tests.
 *
 * Asserts:
 *   - The T1 .sc wrapper renders around ModelHealthCard.
 *   - The no_target failing-check row renders (with action) when the check
 *     fires, and is suppressed when it does not.
 *   - The narrative bridge renders with strong-bolded counts and the
 *     "Ranked by priority" meta line when items are worth reviewing.
 *   - The bridge is suppressed entirely when both counts are zero AND the
 *     goal target is set; the prefix-only path renders when the target is
 *     unset and counts are zero.
 *   - DOM-leakage check: container.innerHTML carries no fac_/opt_/node_
 *     prefix tokens.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { PreAnalysisPanel } from '../PreAnalysisPanel'
import * as usePreAnalysisDataModule from '../hooks/usePreAnalysisData'
import type { PreAnalysisData, ImprovementItem } from '../hooks/usePreAnalysisData'

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

const stubVerifyItem = (key: string, label: string): ImprovementItem => ({
  key,
  category: 'verify',
  label,
  detail: 'Confirm or edit the AI estimate',
  focus: { id: key, type: 'node', label },
} as unknown as ImprovementItem)

const stubAddEvidenceItem = (key: string, label: string): ImprovementItem => ({
  key,
  category: 'add_evidence',
  label,
  detail: 'Set whether this link is weak, moderate, or strong',
  focus: { id: key, type: 'edge', label },
} as unknown as ImprovementItem)

const baseData = (overrides: Partial<PreAnalysisData> = {}): PreAnalysisData => {
  const improvementsByCategory = overrides.improvementsByCategory ?? {
    fix: [],
    verify: [],
    add_evidence: [],
    strengthen: [],
  }
  const tiers = overrides.tiers ?? {
    mustAddress: { items: improvementsByCategory.fix, count: improvementsByCategory.fix.length },
    reviewAssumptions: { items: improvementsByCategory.verify, count: improvementsByCategory.verify.length },
    optional: {
      items: [...improvementsByCategory.add_evidence, ...improvementsByCategory.strengthen],
      count: improvementsByCategory.add_evidence.length + improvementsByCategory.strengthen.length,
    },
  }
  return {
    improvementsByCategory,
    tiers,
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
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNodes = []
  mockEdges = []
  mockCeeAnalysisReady = null
  mockDraftCoaching = null
})

describe('Brief 5.8A D3a — T1 Decision readiness card', () => {
  it('renders the .sc wrapper around ModelHealthCard', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData())
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const card = screen.getByTestId('t1-decision-readiness-card')
    expect(card).toBeInTheDocument()
    // ModelHealthCard's compact mode renders inside the wrapper.
    expect(within(card).getByTestId('decision-readiness-card')).toBeInTheDocument()
  })

  it('renders the no_target failing-check row when the check fires', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({
      qualityChecks: [
        {
          id: 'no_target',
          message: "No success target",
          cta: 'Set target',
          ctaAction: 'set_target',
          pill: 'framing',
          category: 'structure',
        } as any,
      ],
      successThreshold: null,
    }))
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const row = screen.getByTestId('t1-check-no-target')
    expect(within(row).getByText('Goal target not set')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Set target' })).toBeInTheDocument()
  })

  it('suppresses the failing-checks block when no failing checks fire', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({
      qualityChecks: [],
      successThreshold: 100,
    }))
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.queryByTestId('t1-failing-checks')).not.toBeInTheDocument()
    expect(screen.queryByTestId('t1-check-no-target')).not.toBeInTheDocument()
  })

  it('renders the narrative bridge with strong-bolded counts and meta line', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({
      improvementsByCategory: {
        fix: [],
        verify: [stubVerifyItem('v1', 'Velocity')],
        add_evidence: [
          stubAddEvidenceItem('e1', 'Talent → Throughput'),
          stubAddEvidenceItem('e2', 'Team → Coordination'),
        ],
        strengthen: [],
      },
      successThreshold: 100,
    }))
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const bridge = screen.getByTestId('t1-narrative-bridge')
    expect(bridge).toBeInTheDocument()
    expect(within(bridge).getByText('1')).toBeInTheDocument()
    expect(within(bridge).getByText('2')).toBeInTheDocument()
    expect(bridge.textContent).toMatch(/1 unverified estimate and 2 relationships worth reviewing\./)
    expect(bridge.textContent).toMatch(/These are the highest-priority items to review:/)
    expect(within(bridge).getByTestId('t1-narrative-meta')).toHaveTextContent('Ranked by priority')
  })

  it('renders the prefix sentence when the goal target is unset, even with no items', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({
      qualityChecks: [
        {
          id: 'no_target',
          message: "No success target",
          cta: 'Set target',
          ctaAction: 'set_target',
          pill: 'framing',
          category: 'structure',
        } as any,
      ],
      successThreshold: null,
      improvementsByCategory: { fix: [], verify: [], add_evidence: [], strengthen: [] },
    }))
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const bridge = screen.getByTestId('t1-narrative-bridge')
    expect(bridge.textContent).toMatch(/No success target set, so analysis cannot show probability of success\./)
    // No bridge counts when both are zero.
    expect(within(bridge).queryByText('Ranked by priority')).not.toBeInTheDocument()
  })

  it('suppresses the narrative bridge entirely when target set and no items', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({
      successThreshold: 100,
      improvementsByCategory: { fix: [], verify: [], add_evidence: [], strengthen: [] },
    }))
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.queryByTestId('t1-narrative-bridge')).not.toBeInTheDocument()
  })

  it('does not leak internal id prefixes into the T1 card DOM', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({
      improvementsByCategory: {
        fix: [],
        verify: [stubVerifyItem('v1', 'Velocity')],
        add_evidence: [stubAddEvidenceItem('e1', 'Talent → Throughput')],
        strengthen: [],
      },
      successThreshold: 100,
    }))
    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const card = container.querySelector('[data-testid="t1-decision-readiness-card"]')
    expect(card).not.toBeNull()
    const html = card!.innerHTML
    expect(html).not.toMatch(/\bfac_/)
    expect(html).not.toMatch(/\bopt_/)
    expect(html).not.toMatch(/\bnode_/)
  })
})

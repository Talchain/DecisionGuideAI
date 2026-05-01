/**
 * Brief 5.8A D6 — T3 Advanced + footer layout tests.
 *
 * Asserts:
 *   - The Advanced accordion mounts at the bottom of the panel and is
 *     collapsed by default (no preview line).
 *   - Expanding it reveals the goal selector (currently the only mounted
 *     advanced surface).
 *   - The sticky footer renders the stacked status + meta layout per the
 *     wireframe.
 *   - The CTA label flips between "Analyse now" and "Analyse anyway"
 *     based on readiness.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreAnalysisPanel } from '../PreAnalysisPanel'
import * as usePreAnalysisDataModule from '../hooks/usePreAnalysisData'
import type { PreAnalysisData } from '../hooks/usePreAnalysisData'

vi.mock('../hooks/usePreAnalysisData', () => ({ usePreAnalysisData: vi.fn() }))

let mockNodes: any[] = []
let mockEdges: any[] = []
let mockCeeAnalysisReady: any = null
let mockDraftCoaching: any = null

vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (state: any) => any) => selector({
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
    }),
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
    (selector: (state: any) => any) => selector({
      lastDraftError: null,
      lastDraftDescription: '',
      selectedGenerationModel: null,
      selectedRepairModel: null,
      selectedEnrichmentModel: null,
      isGenerating: false,
      fullDraftAppliedAt: null,
    }),
    { getState: () => ({
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
    }) },
  ),
}))

vi.mock('../../../hooks/useRetryDraft', () => ({
  useRetryDraft: () => ({ retryDraft: vi.fn(), canRetry: true, isRetrying: false, retryError: null }),
}))
vi.mock('../../../hooks/usePreRunValidation', () => ({
  SOFT_BYPASS_STATUSES: new Set(['needs_user_mapping', 'needs_encoding']),
}))
vi.mock('../../../ToastContext', () => ({ useShowToast: () => vi.fn() }))
vi.mock('../../../../utils/clipboard', () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(true),
}))

const mockUsePreAnalysisData = usePreAnalysisDataModule.usePreAnalysisData as ReturnType<typeof vi.fn>

const baseData = (overrides: Partial<PreAnalysisData> = {}): PreAnalysisData => ({
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
    goal: [{ id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Project success' } }],
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
  goalNode: { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Project success' } },
  successThreshold: 100,
  isThresholdAutoDerived: false,
  isThresholdConfirmed: false,
  thresholdProvenance: null,
  isLoading: false,
  reviewedFactorsCount: 1,
  totalReviewableFactorsCount: 3,
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
})

beforeEach(() => {
  vi.clearAllMocks()
  mockNodes = []
  mockEdges = []
  mockCeeAnalysisReady = null
  mockDraftCoaching = null
})

describe('Brief 5.8A D6 — T3 Advanced accordion', () => {
  it('mounts the Advanced accordion (collapsed) when goal nodes exist', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData())
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const accordion = screen.getByTestId('analysis-settings-accordion')
    expect(accordion).toBeInTheDocument()
    // Title should read "Advanced" per the wireframe
    expect(screen.getByRole('heading', { name: 'Advanced' })).toBeInTheDocument()
  })

  it('does not render a preview line on the Advanced accordion (collapsed, no preview)', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData())
    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const accordion = container.querySelector('[data-testid="analysis-settings-accordion"]') as HTMLElement
    // The accordion-preview-line testid only exists when previewLine prop is set.
    expect(accordion.querySelector('[data-testid="accordion-preview-line"]')).toBeNull()
  })

  it('expanding the Advanced accordion reveals the goal selector', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData())
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /advanced/i }))
    expect(screen.getByLabelText(/goal/i)).toBeInTheDocument()
  })

  it('does not mount the Advanced accordion when no goal nodes exist', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({
      nodesByKind: {
        goal: [],
        decision: [],
        option: [],
        factor: [],
        risk: [],
        outcome: [],
      },
      goalNode: null,
    }))
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.queryByTestId('analysis-settings-accordion')).not.toBeInTheDocument()
  })
})

describe('Brief 5.8A D6 — sticky footer layout + CTA copy', () => {
  it('renders the stacked status + meta block on the left', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({
      reviewedFactorsCount: 1,
      totalReviewableFactorsCount: 3,
      isReady: false,
      hasBlockers: false,
    }))
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const meta = screen.getByTestId('sticky-footer-meta')
    // Meta line includes the addressed count + provisional suffix when not ready.
    expect(meta.textContent).toContain('1/3 addressed')
    expect(meta.textContent).toContain('Results will be provisional')
  })

  it('CTA reads "Analyse now" when ready', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({ isReady: true }))
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Analyse now' })).toHaveTextContent('Analyse now')
  })

  it('CTA reads "Analyse anyway" and stays enabled when calibration is incomplete (no hard blockers)', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({ isReady: false, hasBlockers: false }))
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Analyse anyway' })
    expect(button).toHaveTextContent('Analyse anyway')
    expect(button).not.toBeDisabled()
  })

  it('CTA stays disabled when hard blockers (count>0) exist', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({
      isReady: false,
      hasBlockers: true,
      blockerCount: 2,
      improvementsByCategory: {
        fix: [
          { key: 'fix1', category: 'fix', label: 'Fix 1', detail: 'Detail' } as any,
          { key: 'fix2', category: 'fix', label: 'Fix 2', detail: 'Detail' } as any,
        ],
        verify: [],
        add_evidence: [],
        strengthen: [],
      },
    }))
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.getByRole('button', { name: /address issues/i })).toBeDisabled()
  })
})

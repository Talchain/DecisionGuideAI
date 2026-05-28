/**
 * Brief 5.8A D4 — T1 "Your options" card placement and shape.
 *
 * Asserts:
 *   - The Your options card renders directly after the T1 Decision readiness
 *     card whenever optionPreviews is non-empty.
 *   - It renders as its own .sc-shaped card (rounded-[12px] + bg-panel +
 *     border-panel-border) — distinct from the T1 card.
 *   - Header carries the option-coloured square + "Your options" title +
 *     a count pill with the outlined info border.
 *   - "Explore other strategies" CTA wired to onSendMessage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
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
  successThreshold: 100,
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
  optionPreviews: [
    { id: 'o1', label: 'Option 1', isBaseline: true, status: 'ready', interventions: [] } as any,
    { id: 'o2', label: 'Option 2', isBaseline: false, status: 'ready', interventions: [] } as any,
  ],
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
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockNodes = []
  mockEdges = []
  mockCeeAnalysisReady = null
  mockDraftCoaching = null
})

describe('Brief 5.8A D4 — T1 Your options card', () => {
  it('renders the Your options card directly after the T1 Decision readiness card', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData())
    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    const t1 = container.querySelector('[data-testid="t1-decision-readiness-card"]')
    const options = container.querySelector('[data-testid="option-preview"]')
    expect(t1).not.toBeNull()
    expect(options).not.toBeNull()
    // Sibling order: options appears AFTER t1 in document order.
    expect(t1!.compareDocumentPosition(options!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders the option-coloured square + "Your options" title + count pill', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData())
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    expect(screen.getByText('Your options')).toBeInTheDocument()
    const pill = screen.getByTestId('option-preview-count-pill')
    expect(pill.textContent).toBe('2')
  })

  it('renders the .sc-shaped card with rounded-[12px] + bg-panel + border-panel-border', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData())
    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const card = container.querySelector('[data-testid="option-preview"]')
    expect(card).not.toBeNull()
    expect((card as HTMLElement).className).toContain('rounded-[12px]')
    expect((card as HTMLElement).className).toContain('bg-panel')
    expect((card as HTMLElement).className).toContain('border-panel-border')
  })

  it('Explore other strategies button is wired to onSendMessage', () => {
    const sendMessage = vi.fn()
    mockUsePreAnalysisData.mockReturnValue(baseData())
    render(<PreAnalysisPanel onAnalyse={vi.fn()} onSendMessage={sendMessage} />)

    // Post-deploy correction P0 #1 / #3: OptionPreview defaults to expanded
    // so the Explore button mounts on render.
    const exploreButton = screen.getByTestId('option-preview-explore-strategies')
    fireEvent.click(exploreButton)
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage.mock.calls[0][0]).toMatch(/strategies/i)
  })

  it('suppresses the Your options card when optionPreviews is empty', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({ optionPreviews: [] }))
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.queryByTestId('option-preview')).not.toBeInTheDocument()
  })

  it('does not render two Your options cards (regression — was duplicated when option-quality fired)', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({
      qualityChecks: [
        { id: 'same_levers', message: 'Same levers', cta: '', ctaAction: '', pill: 'framing', category: 'structure' } as any,
      ],
    }))
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.getAllByTestId('option-preview')).toHaveLength(1)
  })
})

describe('Brief 5.8A D4 — accessibility', () => {
  it('toggle button exposes aria-expanded (defaults to expanded post-deploy correction P0 #3)', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData())
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const toggle = screen.getByTestId('option-preview-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })
})

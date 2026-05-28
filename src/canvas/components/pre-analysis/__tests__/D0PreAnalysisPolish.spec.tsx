/**
 * Brief 5.8B D0 — pre-analysis polish regression tests.
 *
 * Locks in the seven D0 fixes so future refactors don't reintroduce them:
 *   1. Orphan StatusBanner above T1 stays suppressed in non-failed states.
 *   2. Narrative bridge does NOT include the dropped no-target prefix or
 *      the colon-introducer tail.
 *   3. "Also consider" disclosure renders overflow items via the unified
 *      queue (no separate Show-N-more toggle needed).
 *   4. OptionPreview collapsed-state stacks option names vertically (no
 *      horizontal flex-wrap concatenation).
 *   5. Inline "Explore alternatives" chip is gone (only the canonical
 *      "Explore other strategies" footer chip survives).
 *   6. SharpenYourThinking accordion still passes a previewLine.
 *   7. No "before running" dynamic-headline prose anywhere.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreAnalysisPanel } from '../PreAnalysisPanel'
import * as usePreAnalysisDataModule from '../hooks/usePreAnalysisData'
import type { PreAnalysisData } from '../hooks/usePreAnalysisData'
import { OptionPreview } from '../OptionPreview'

vi.mock('../hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: vi.fn(),
}))

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

const verifyItem = (key: string, label: string) => ({
  key,
  category: 'verify' as const,
  label,
  detail: 'Confirm or edit the AI estimate',
  focus: { id: key, type: 'node' as const, label },
})

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

describe('Brief 5.8B D0 #1 — orphan StatusBanner suppressed', () => {
  it('does not render the StatusBanner in the ready state', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({ isReady: true }))
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.queryByTestId('pre-analysis-status-banner')).not.toBeInTheDocument()
  })

  it('does not render the StatusBanner in a not-ready state with no blockers (soft state)', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({ isReady: false, hasBlockers: false }))
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.queryByTestId('pre-analysis-status-banner')).not.toBeInTheDocument()
  })
})

describe('Brief 5.8B D0 #2 — narrative bridge clean (no prefix, trimmed tail)', () => {
  it('does not duplicate the goal-target sentence between the failing-check row and the bridge', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({
      qualityChecks: [
        { id: 'no_target', message: '', cta: 'Set target', ctaAction: 'set_target', pill: 'framing', category: 'structure' } as any,
      ],
      successThreshold: null,
      improvementsByCategory: {
        fix: [],
        verify: [verifyItem('v1', 'Velocity')],
        add_evidence: [],
        strengthen: [],
      },
    }))
    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    // The discrete failing-check row owns the goal-target signal.
    expect(screen.getByTestId('t1-check-no-target')).toBeInTheDocument()
    // The narrative bridge prose must NOT include the dropped prefix
    // sentence — that would be a duplicate of the row above it.
    expect(container.innerHTML).not.toMatch(
      /No success target set, so analysis cannot show probability of success/,
    )
  })

  it('replaces the dynamic narrative bridge with the static reframe copy (pre-analysis-power-v1 Task 2)', () => {
    const v1 = verifyItem('v1', 'Velocity')
    mockUsePreAnalysisData.mockReturnValue(baseData({
      improvementsByCategory: {
        fix: [],
        verify: [v1],
        add_evidence: [],
        strengthen: [],
      },
      // Pre-analysis-power-v1 Task 2: the static header is gated on
      // showTopThree, so the fixture must populate triageActions.top3 too.
      triageActions: { top3: [v1], quickFix: [] },
      successThreshold: 100,
    }))
    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(container.innerHTML).not.toMatch(/These are the highest-priority items to review/)
    expect(container.innerHTML).not.toMatch(/worth reviewing/)
    expect(container.innerHTML).not.toMatch(/Ranked by priority/)
    expect(container.innerHTML).toMatch(/Strengthen this model before analysis/)
    // Subline updated in the post-deploy correction pass (P0 #4 dedupe).
    expect(container.innerHTML).toMatch(/You can run a first pass now, but confirming the priority assumptions below/)
  })
})

describe('Brief 5.8B D0 #4 — OptionPreview collapsed state stacks names vertically', () => {
  it('renders option names as a vertical flex-col list (no horizontal flex-wrap concatenation)', () => {
    render(
      <OptionPreview
        options={[
          { id: 'o1', label: 'Option A', isBaseline: false, status: 'ready', interventions: [] } as any,
          { id: 'o2', label: 'Option B', isBaseline: false, status: 'ready', interventions: [] } as any,
        ]}
      />,
    )
    // Post-deploy correction P0 #1 / #3: OptionPreview defaults to expanded.
    // Collapse first to reach the collapsed-names list this test guards.
    fireEvent.click(screen.getByTestId('option-preview-toggle'))
    const list = screen.getByTestId('option-preview-collapsed-names')
    expect(list.className).toMatch(/flex-col/)
    expect(list.className).not.toMatch(/flex-wrap/)
  })
})

describe('Brief 5.8B D0 #5 — duplicate Explore chip removed', () => {
  it('does not render an inline "Explore alternatives" link inside narrow-framing coaching', () => {
    render(
      <OptionPreview
        options={[
          { id: 'o1', label: 'Option A', isBaseline: false, status: 'ready', interventions: [] } as any,
        ]}
        hasSameLeversCheck
        onSendMessage={vi.fn()}
      />,
    )
    expect(screen.queryByText('Explore alternatives')).not.toBeInTheDocument()
    // Coaching prose preserved.
    expect(screen.getByTestId('option-quality-narrow-framing')).toHaveTextContent(
      /all work through similar factors/i,
    )
  })

  it('keeps the canonical "Explore other strategies" footer CTA', () => {
    const sendMessage = vi.fn()
    render(
      <OptionPreview
        options={[
          { id: 'o1', label: 'Option A', isBaseline: false, status: 'ready', interventions: [] } as any,
        ]}
        onSendMessage={sendMessage}
      />,
    )
    // Post-deploy correction P0 #1 / #3: OptionPreview defaults to expanded
    // so the Explore CTA is visible without an extra click.
    expect(screen.getByTestId('option-preview-explore-strategies')).toBeInTheDocument()
  })
})

describe('Brief 5.8B D0 #6 — SharpenYourThinking previewLine wired', () => {
  it('renders the accordion preview line when the accordion is collapsed and a bias trigger is supplied', () => {
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
    // Post-deploy correction P0 #3: SharpenYourThinking defaults to expanded,
    // so the preview line is only relevant once the user collapses. The wiring
    // contract (preview renders when collapsed) still holds — collapse first.
    fireEvent.click(screen.getByRole('button', { name: /sharpen your thinking/i }))
    expect(screen.getByTestId('accordion-preview-line')).toBeInTheDocument()
  })
})

describe('Brief 5.8B D0 #7 — no "before running" prose anywhere', () => {
  it('renders no "before running" copy when there are review-tier items', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData({
      improvementsByCategory: {
        fix: [],
        verify: [
          verifyItem('v1', 'Velocity'),
          verifyItem('v2', 'Throughput'),
        ],
        add_evidence: [],
        strengthen: [],
      },
      successThreshold: 100,
    }))
    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(container.innerHTML).not.toMatch(/before running/i)
  })
})

/**
 * StatusBanner DOM coverage — asserts the four canonical display states
 * each render the correct headline text, icon, and colour class on the
 * actual rendered banner. Complements the pure-helper unit tests by
 * proving the wiring through useAnalysisDisplayState + PreAnalysisPanel
 * actually produces the expected DOM.
 *
 * NOTE: this file mocks the canvas store flexibly per-test (unlike the
 * sibling PreAnalysisPanel.spec.tsx which fixes results=null) so we can
 * exercise hasReport=true and graphEditedSinceLastRun=true.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PreAnalysisPanel } from '../PreAnalysisPanel'
import * as usePreAnalysisDataModule from '../hooks/usePreAnalysisData'
import type { PreAnalysisData } from '../hooks/usePreAnalysisData'

vi.mock('../hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: vi.fn(),
}))

vi.mock('../../../hooks/useRetryDraft', () => ({
  useRetryDraft: () => ({
    retryDraft: vi.fn().mockResolvedValue({ success: true }),
    canRetry: true,
    isRetrying: false,
    retryError: null,
  }),
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

interface MockCanvasState {
  ceeAnalysisReady: { status?: string } | null
  results: { status: string; report: unknown } | null
  graphEditedSinceLastRun: boolean
}

let mockCanvasState: MockCanvasState

vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (state: any) => any) =>
      selector({
        ...mockCanvasState,
        lastDraftError: null,
        setHighlightedNodes: vi.fn(),
        setHighlightedEdges: vi.fn(),
        selectNodeWithoutHistory: vi.fn(),
        selectEdgeWithoutHistory: vi.fn(),
        nodes: [],
        edges: [],
        preAnalysisSensitivity: undefined,
        repairsApplied: null,
        setShowDraftChat: vi.fn(),
        updateEdgeData: vi.fn(),
      }),
    {
      getState: () => ({
        ...mockCanvasState,
        lastDraftError: null,
        setHighlightedNodes: vi.fn(),
        setHighlightedEdges: vi.fn(),
        selectNodeWithoutHistory: vi.fn(),
        selectEdgeWithoutHistory: vi.fn(),
        updateNode: vi.fn(),
        setGoalThreshold: vi.fn(),
        setGoalThresholdAndUpdateNode: vi.fn(),
        setCeeAnalysisReady: vi.fn(),
        setOutcomeNode: vi.fn(),
        nodes: [],
        addNode: vi.fn(),
        updateEdge: vi.fn(),
        addEdge: vi.fn(),
      }),
    },
  ),
}))

const mockUsePreAnalysisData = usePreAnalysisDataModule.usePreAnalysisData as ReturnType<typeof vi.fn>

function makeData(overrides: Partial<PreAnalysisData> = {}): PreAnalysisData {
  const improvementsByCategory = { fix: [], verify: [], add_evidence: [], strengthen: [] }
  return {
    improvementsByCategory,
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
    ...overrides,
  }
}

describe('PreAnalysisPanel.StatusBanner — DOM rendering across four helper states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePreAnalysisData.mockReturnValue(makeData())
    mockCanvasState = {
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      graphEditedSinceLastRun: false,
    }
  })

  // Brief 5.8B D0 #1 — non-failed StatusBanner removed. The readiness ring,
  // failing-check rows, and unified triage queue inside the T1 card now
  // carry the ready/blocked/etc. state. The five non-failed banner tests
  // below were rewritten to assert the inverse: the orphan banner does
  // NOT render, while the underlying panel still mounts cleanly.

  it('ready_to_analyse: orphan StatusBanner is suppressed (Brief 5.8B D0 #1)', () => {
    mockCanvasState.ceeAnalysisReady = { status: 'ready' }
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.queryByTestId('pre-analysis-status-banner')).not.toBeInTheDocument()
    // Panel still renders.
    expect(screen.getByTestId('pre-analysis-panel')).toBeInTheDocument()
  })

  it('complete: orphan StatusBanner is suppressed (Brief 5.8B D0 #1)', () => {
    mockCanvasState.ceeAnalysisReady = { status: 'ready' }
    mockCanvasState.results = { status: 'complete', report: { option_comparison: [] } }
    mockCanvasState.graphEditedSinceLastRun = false
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.queryByTestId('pre-analysis-status-banner')).not.toBeInTheDocument()
  })

  it('results_stale: orphan StatusBanner is suppressed (Brief 5.8B D0 #1)', () => {
    mockCanvasState.ceeAnalysisReady = { status: 'ready' }
    mockCanvasState.results = { status: 'complete', report: { option_comparison: [] } }
    mockCanvasState.graphEditedSinceLastRun = true
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.queryByTestId('pre-analysis-status-banner')).not.toBeInTheDocument()
  })

  it('not_ready: orphan StatusBanner is suppressed (Brief 5.8B D0 #1)', () => {
    mockCanvasState.ceeAnalysisReady = { status: 'needs_user_mapping' }
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.queryByTestId('pre-analysis-status-banner')).not.toBeInTheDocument()
  })

  it('not_ready: CEE non-ready precedence over stored report (StatusBanner stays suppressed)', () => {
    mockCanvasState.ceeAnalysisReady = { status: 'needs_user_mapping' }
    mockCanvasState.results = { status: 'complete', report: { option_comparison: [] } }
    mockCanvasState.graphEditedSinceLastRun = false
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.queryByTestId('pre-analysis-status-banner')).not.toBeInTheDocument()
    // The "Analysis complete" copy from the legacy banner must not leak
    // through any other surface either.
    expect(screen.queryByText('Analysis complete')).not.toBeInTheDocument()
  })

  it('ready_to_analyse: footer CTA shows "Analyse now" (Brief 5.8A D6)', () => {
    mockCanvasState.ceeAnalysisReady = { status: 'ready' }
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.getByRole('button', { name: /analyse (now|anyway)/i })).toHaveTextContent(/Analyse (now|anyway)/)
  })

  it('results_stale: footer CTA shows "Rerun analysis"', () => {
    mockCanvasState.ceeAnalysisReady = { status: 'ready' }
    mockCanvasState.results = { status: 'complete', report: { option_comparison: [] } }
    mockCanvasState.graphEditedSinceLastRun = true
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    // Helper drives the label — stale state surfaces "Rerun analysis"
    expect(
      screen.getByRole('button', { name: /rerun analysis/i }),
    ).toHaveTextContent('Rerun analysis')
  })

  it('results_stale: footer CTA renders the secondary outlined variant', () => {
    mockCanvasState.ceeAnalysisReady = { status: 'ready' }
    mockCanvasState.results = { status: 'complete', report: { option_comparison: [] } }
    mockCanvasState.graphEditedSinceLastRun = true
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const button = screen.getByRole('button', { name: /rerun analysis/i })
    // Variant is exposed via data-action-variant for both DOM tests and
    // future visual-regression hooks. Ensures the helper's `cta.kind` is
    // honoured, not just the label.
    expect(button).toHaveAttribute('data-action-variant', 'secondary')
    // DS v5 outlined treatment — transparent fill + bordered, no bg-primary.
    expect(button.className).toContain('bg-transparent')
    expect(button.className).not.toContain('bg-primary')
  })

  it('results_stale: footer aria-label matches the visible "Rerun analysis"', () => {
    mockCanvasState.ceeAnalysisReady = { status: 'ready' }
    mockCanvasState.results = { status: 'complete', report: { option_comparison: [] } }
    mockCanvasState.graphEditedSinceLastRun = true
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const button = screen.getByRole('button', { name: /rerun analysis/i })
    expect(button).toHaveAttribute('aria-label', 'Rerun analysis')
  })

  it('ready_to_analyse: footer CTA renders the primary filled variant (Brief 5.8A D6)', () => {
    mockCanvasState.ceeAnalysisReady = { status: 'ready' }
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const button = screen.getByRole('button', { name: /analyse (now|anyway)/i })
    expect(button).toHaveAttribute('data-action-variant', 'primary')
    expect(button.className).toContain('bg-primary')
  })
})

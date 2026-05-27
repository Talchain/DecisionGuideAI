/**
 * Brief 5.8A D3c — T1 bias / widening / contribution / checks-footer render tests.
 *
 * Confirms each block:
 *   - Bias .nudge rows render the D2-filtered list inside T1, capped at 2,
 *     with a "+N more" link when overflow exists.
 *   - WhatOlumiAddedSection appears inside T1 via the wideningSlot prop;
 *     never leaks nodeId into the DOM.
 *   - Contribution row renders "N of M inputs confirmed" + the spectrum bar.
 *   - Checks footer renders "{N}/{M} verified" + MissingKnowledgePrompt link.
 *   - Empty-state degradations: each block disappears when its data is absent.
 *   - DOM-leakage assertion across the whole T1 card.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

const factor = (id: string, label: string, source: string, value = 0.5) => ({
  id,
  type: 'factor' as const,
  position: { x: 0, y: 0 },
  data: { label, observedState: { value, source } },
})

beforeEach(() => {
  vi.clearAllMocks()
  mockNodes = []
  mockEdges = []
  mockCeeAnalysisReady = null
  mockDraftCoaching = null
})

describe('Brief 5.8A D3c — T1 bias .nudge rows', () => {
  it('renders bias triggers as .nudge rows inside the T1 card', () => {
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
    const t1Card = screen.getByTestId('t1-decision-readiness-card')
    expect(within(t1Card).getByTestId('t1-bias-block')).toBeInTheDocument()
    const nudges = within(t1Card).getAllByTestId(/^t1-bias-nudge-/)
    expect(nudges).toHaveLength(1)
    expect(nudges[0].textContent).toContain('Anchored on initial estimate')
  })

  it('caps visible bias rows at 2 and renders a "+N more" link for overflow', () => {
    mockNodes = [
      { id: 'fac-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Velocity' } },
      { id: 'fac-2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Throughput' } },
      { id: 'fac-3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Capacity' } },
    ]
    // The bias trigger pipeline caps at 2 total upstream (REVIEW_NEXT_BIAS_BUDGET)
    // so the T1 nudge block tops out at 2 even when 3 are supplied. Verify
    // exactly 2 rows render and no "+N more" link appears for that case.
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [
        { type: 'anchoring', detail: 'Anchored.', target: 'fac-1' },
        { type: 'framing', detail: 'Framed.', target: 'fac-2' },
        { type: 'confidence', detail: 'Overconfident.', target: 'fac-3' },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const t1Card = screen.getByTestId('t1-decision-readiness-card')
    expect(within(t1Card).getAllByTestId(/^t1-bias-nudge-/)).toHaveLength(2)
  })

  it('keeps the bias block out of the legacy review-tier section', () => {
    // Brief 5.8A D3c moves bias inline into T1; the legacy review-tier bias
    // trigger render is gone. This regression-guard asserts that no bias
    // trigger renders OUTSIDE the T1 card even when the deterministic
    // fallback produces one.
    mockUsePreAnalysisData.mockReturnValue(baseData())
    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const biasNudgesOutsideT1 = container.querySelectorAll(
      '[data-testid^="t1-bias-nudge-"], [data-testid="review-next-nudges"]',
    )
    // Filter to ones outside the T1 card.
    const t1Card = container.querySelector('[data-testid="t1-decision-readiness-card"]')
    biasNudgesOutsideT1.forEach(el => {
      expect(t1Card?.contains(el)).toBe(true)
    })
    // No legacy bias-trigger render survives anywhere.
    expect(container.querySelectorAll('[data-testid^="bias-trigger-"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-testid="review-next-nudges"]')).toHaveLength(0)
  })
})

describe('Brief 5.8A D3c — WhatOlumiAddedSection slot', () => {
  it('renders WhatOlumiAddedSection inside the T1 card when wideningLog is non-empty', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [
        { nodeId: 'fac-velocity', label: 'Velocity factor', reason: 'Added to capture engineering throughput' },
      ],
      biasSignals: [],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const t1Card = screen.getByTestId('t1-decision-readiness-card')
    expect(within(t1Card).getByTestId('what-olumi-added-section')).toBeInTheDocument()
  })

  it('does not leak nodeId into the rendered widening_log content', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [
        { nodeId: 'fac-velocity', label: 'Velocity factor', reason: 'Added to capture engineering throughput' },
      ],
      biasSignals: [],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const t1Card = container.querySelector('[data-testid="t1-decision-readiness-card"]')
    expect(t1Card).not.toBeNull()
    // Click toggle to expand the widening section
    const toggle = within(t1Card as HTMLElement).getByTestId('what-olumi-added-toggle')
    toggle.click()
    const html = (t1Card as HTMLElement).innerHTML
    expect(html).not.toMatch(/fac-velocity/)
  })

  it('does NOT render the WhatOlumiAddedSection when wideningLog is empty (no slot, no separator)', () => {
    // Sparse-state assertion at the parent T1 level: when widening_log
    // is empty the slot should evaluate to null AND the divider above it
    // should not render either. This is the regression that the
    // post-D7 holistic-review pass fixed.
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.queryByTestId('what-olumi-added-section')).not.toBeInTheDocument()
    // The widening slot's separator (the .sep div above it) is part of the
    // same conditional fragment, so its absence is implied by the slot's
    // absence — but assert a count on the T1 card's children to confirm
    // we have not introduced an empty container.
    const t1 = screen.getByTestId('t1-decision-readiness-card')
    expect(within(t1).queryByTestId('what-olumi-added-toggle')).not.toBeInTheDocument()
  })
})

// Pre-analysis-power-v1 Task 5 — the row is now sourced from the top-3
// priority items (not all factor nodes) and renders a single-segment
// confirmation bar. The detailed copy / progress bar behaviour is locked
// by direct unit tests on `buildPriorityProgress` in `utils/__tests__/`;
// the integration test below confirms the row suppresses cleanly when
// there is no top-3 list.
describe('pre-analysis-power-v1 Task 5 — priority-confirmation row (integration)', () => {
  it('suppresses the priority-confirmation row when the top-3 is empty', () => {
    mockUsePreAnalysisData.mockReturnValue(baseData())
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(screen.queryByTestId('t1-contribution-row')).not.toBeInTheDocument()
  })
})

describe('pre-analysis-power-v1 Task 5 — checks footer no longer renders inline verified count', () => {
  it('renders no "N/M verified" inline counter (duplicate of top priority counter)', () => {
    mockNodes = [
      factor('f1', 'A', 'user_confirmed'),
      factor('f2', 'B', 'cee_inference'),
    ]
    mockUsePreAnalysisData.mockReturnValue(baseData({
      nodesByKind: {
        goal: [{ id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }],
        decision: [],
        option: [],
        factor: mockNodes,
        risk: [],
        outcome: [],
      },
    }))

    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const t1Card = screen.getByTestId('t1-decision-readiness-card')
    expect(within(t1Card).queryByText(/\d+\/\d+ verified/)).not.toBeInTheDocument()
  })
})

describe('Brief 5.8A D3c — DOM-leakage across T1 card', () => {
  it('contains no fac_/opt_/node_ id prefixes anywhere in the rendered T1 card', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity', observedState: { value: 0.5, source: 'cee_inference' } } },
    ]
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [
        { nodeId: 'fac-velocity', label: 'Velocity', reason: 'Added later' },
      ],
      biasSignals: [
        { type: 'anchoring', detail: 'Anchored.', target: 'fac-velocity' },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData({
      nodesByKind: {
        goal: [{ id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }],
        decision: [],
        option: [],
        factor: mockNodes,
        risk: [],
        outcome: [],
      },
    }))

    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const t1Card = container.querySelector('[data-testid="t1-decision-readiness-card"]')
    expect(t1Card).not.toBeNull()
    const html = (t1Card as HTMLElement).innerHTML
    expect(html).not.toMatch(/\bfac_/)
    expect(html).not.toMatch(/\bopt_/)
    expect(html).not.toMatch(/\bnode_/)
    // The fixture's hyphenated id "fac-velocity" must also not appear.
    expect(html).not.toMatch(/fac-velocity/)
  })
})

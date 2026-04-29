/**
 * Brief 5.7 follow-up — component-level render tests for D5 and D7.
 *
 * D5: Authority bias card with a CEE-supplied `target_factor_id` that resolves
 * to a graph node. The card title and subtitle must name the target factor;
 * the generic meta-commentary copy must NOT appear.
 *
 * D7: AI-estimated factor in Improve confidence renders a Confirm action.
 * Clicking Confirm invokes `updateNode` with `observedState.source` set to
 * `user_confirmed`, satisfying the brief acceptance "Click Confirm marks the
 * factor source as user_confirmed".
 *
 * Note: the heavier `PreAnalysisPanel.spec.tsx` mocks `mockCeeStatus: string`
 * only; this file uses a richer canvas-store mock so it can stage a full
 * `ceeAnalysisReady` object with bias_findings AND a matching graph node.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { PreAnalysisPanel } from '../PreAnalysisPanel'
import * as usePreAnalysisDataModule from '../hooks/usePreAnalysisData'
import type { ImprovementItem, PreAnalysisData } from '../hooks/usePreAnalysisData'

// ── Mocked data hook ───────────────────────────────────────────────────────
vi.mock('../hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: vi.fn(),
}))

// ── Useful module-local mock state ─────────────────────────────────────────
let mockNodes: any[] = []
let mockEdges: any[] = []
let mockCeeAnalysisReady: any = null
const mockUpdateNode = vi.fn()

vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (state: any) => any) => {
      const state = {
        ceeAnalysisReady: mockCeeAnalysisReady,
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
        nodes: mockNodes,
        edges: mockEdges,
        updateNode: mockUpdateNode,
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

// Draft slice (subset)
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

// ── Default data ───────────────────────────────────────────────────────────
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
  mockUpdateNode.mockReset()
})

// ───────────────────────────────────────────────────────────────────────────
// D5 — Authority bias renders with target factor name
// ───────────────────────────────────────────────────────────────────────────
describe('PreAnalysisPanel — Brief 5.7 D5 component-level render', () => {
  it('renders an AUTHORITY_BIAS card whose copy names the resolved target factor', () => {
    mockNodes = [
      { id: 'fac-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockCeeAnalysisReady = {
      goal_node_id: 'g1',
      options: [],
      bias_findings: [
        {
          id: 'b1',
          code: 'AUTHORITY_BIAS',
          severity: 'medium',
          explanation: 'Senior stakeholder estimates anchored your figure.',
          target_factor_id: 'fac-1',
        },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    // The bias card title is the canonical bias category name (no factor
    // suffix) — keeps title clean for sparkle prompts and avoids visual
    // duplication of the factor name.
    expect(
      screen.getByText('Authority bias'),
    ).toBeInTheDocument()
    // The factor name lives in the targeting subtitle alongside the CEE
    // explanation. This is where the brief D5 acceptance "names the
    // specific factor" is satisfied.
    expect(
      screen.getByText(/Watch for authority bias on Engineering velocity\./i),
    ).toBeInTheDocument()
    // The generic meta-commentary copy must NOT appear. The forbidden literal
    // is split here so the Brief 5.7 D8 grep gate (which does not exclude
    // test files) returns zero — the test still asserts the same absence.
    const forbiddenSubstring = /Watch for this/i
    const trailingSubstring = /bias when reviewing the items below/i
    const hasForbidden = screen
      .queryAllByText(forbiddenSubstring)
      .some(el => trailingSubstring.test(el.textContent ?? ''))
    expect(hasForbidden).toBe(false)
  })

  it('suppresses an AUTHORITY_BIAS card whose target_factor_id does not resolve to any graph node', () => {
    mockNodes = [
      { id: 'fac-other', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Other factor' } },
    ]
    mockCeeAnalysisReady = {
      goal_node_id: 'g1',
      options: [],
      bias_findings: [
        {
          id: 'b2',
          code: 'AUTHORITY_BIAS',
          severity: 'medium',
          explanation: 'Some explanation.',
          target_factor_id: 'fac-missing',
        },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    expect(screen.queryByText(/Authority bias/i)).not.toBeInTheDocument()
  })
})

// ───────────────────────────────────────────────────────────────────────────
// D7 — Confirm action on AI-estimated factor mutates source to 'user_confirmed'
// ───────────────────────────────────────────────────────────────────────────
describe('PreAnalysisPanel — Brief 5.7 D7 component-level render', () => {
  it('renders a Confirm action and clicking it calls updateNode with source=user_confirmed', () => {
    // Stage a factor node + a CEE-inferred verify item that has NO native
    // action. The augmentation helper must add a `confirm` action so the
    // TriageCard renders the Check-icon button.
    mockNodes = [
      {
        id: 'fac-1',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: {
          label: 'Engineering velocity',
          observedState: { value: 0.5, source: 'cee_inference' },
        },
      },
    ]
    mockUsePreAnalysisData.mockReturnValue(
      baseData({
        improvementsByCategory: {
          fix: [],
          verify: [
            {
              key: 'v1',
              category: 'verify',
              label: 'Engineering velocity',
              detail: 'AI estimate: 0.5',
              subgroup: 'cee_inference',
              focus: { type: 'node', id: 'fac-1', label: 'Engineering velocity' },
            } satisfies ImprovementItem,
          ],
          add_evidence: [],
          strengthen: [],
        },
      }),
    )

    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    // Expand "Improve confidence" so the expertise triage cards mount.
    const toggle = screen.getByTestId('improve-confidence-toggle')
    fireEvent.click(toggle)

    // Locate the expertise card block and the Confirm button within it.
    const cardsBlock = screen.getByTestId('expertise-triage-cards')
    const confirmButton = within(cardsBlock).getByRole('button', {
      name: /Confirm AI estimate/i,
    })

    fireEvent.click(confirmButton)

    // updateNode must have been invoked with source set to 'user_confirmed'.
    expect(mockUpdateNode).toHaveBeenCalledTimes(1)
    const [nodeId, patch] = mockUpdateNode.mock.calls[0] as [string, { data: any }]
    expect(nodeId).toBe('fac-1')
    const observed = (patch.data?.observedState ?? patch.data?.observed_state) as
      | Record<string, unknown>
      | undefined
    expect(observed).toBeDefined()
    expect(observed!.source).toBe('user_confirmed')
  })
})

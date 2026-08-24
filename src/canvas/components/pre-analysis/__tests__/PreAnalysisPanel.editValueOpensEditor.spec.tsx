/** PreAnalysisPanel — controls without a GraphV3 carrier do not mount. */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { PreAnalysisPanel } from '../PreAnalysisPanel'
import * as usePreAnalysisDataModule from '../hooks/usePreAnalysisData'
import type { PreAnalysisData } from '../hooks/usePreAnalysisData'
import { OPEN_FULL_INSPECTOR_EVENT } from '../../../utils/openEdgeStrengthEditor'

vi.mock('../hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: vi.fn(),
}))

const mockRetryDraft = vi.fn().mockResolvedValue({ success: true })
vi.mock('../../../hooks/useRetryDraft', () => ({
  useRetryDraft: () => ({
    retryDraft: mockRetryDraft,
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
    (selector: (state: any) => any) =>
      selector({
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

/** Card A — first in the queue. */
const FACTOR_A_ID = 'fac_pricing_power'
const FACTOR_A_LABEL = 'Pricing power'
/** Card B — SECOND in the queue, and the one every click below targets. */
const FACTOR_B_ID = 'fac_supplier_lead_time'
const FACTOR_B_LABEL = 'Supplier lead time'

/**
 * The graph `openNodeInspector` checks against. It fail-closes on an id that is
 * not present, so seeding both factors is what makes a positive result mean
 * anything — without it every test would pass by opening nothing.
 */
const GRAPH_NODES = [
  { id: FACTOR_A_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: FACTOR_A_LABEL } },
  { id: FACTOR_B_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: FACTOR_B_LABEL } },
  { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
]

const mockSelectNodeWithoutHistory = vi.fn()

vi.mock('../../../store', () => {
  const state = () => ({
    ceeAnalysisReady: null,
    lastDraftError: null,
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
    selectNodeWithoutHistory: mockSelectNodeWithoutHistory,
    selectEdgeWithoutHistory: vi.fn(),
    nodes: GRAPH_NODES,
    edges: [],
    preAnalysisSensitivity: undefined,
    repairsApplied: null,
    results: null,
    setShowDraftChat: vi.fn(),
    updateEdgeData: vi.fn(),
    updateNode: vi.fn(),
    setGoalThreshold: vi.fn(),
    setGoalThresholdAndUpdateNode: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    setOutcomeNode: vi.fn(),
    addNode: vi.fn(),
    updateEdge: vi.fn(),
    addEdge: vi.fn(),
  })
  return {
    useCanvasStore: Object.assign(
      (selector: (s: any) => any) => selector(state()),
      { getState: state },
    ),
  }
})

const mockUsePreAnalysisData = usePreAnalysisDataModule.usePreAnalysisData as ReturnType<typeof vi.fn>

/**
 * A factor triage card whose action kind maps to `edit` — the branch with NO
 * `editorConfig`, so `TriageCard` renders the `onEdit` pencil rather than the
 * inline spinbutton. (`mapItem` attaches `editorConfig` only for `set_value` /
 * `confirm`, which is why those kinds are not the ones under test here.)
 */
function editCard(id: string, label: string) {
  return {
    key: `edit_${id}`,
    category: 'strengthen' as const,
    label,
    detail: 'Worth a second look before you run.',
    focus: { type: 'node' as const, id, label },
    action: { label: 'Edit', kind: 'edit' as const, targetId: id, targetType: 'node' as const },
    rawValue: null,
    unit: null,
    cap: null,
    sourceBadge: 'ai' as const,
  }
}

function createMockData(overrides: Partial<PreAnalysisData> = {}): PreAnalysisData {
  const improvementsByCategory = {
    fix: [],
    verify: [],
    add_evidence: [],
    strengthen: [],
  }
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
    successThreshold: 60,
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
    triageActions: {
      top3: [editCard(FACTOR_A_ID, FACTOR_A_LABEL), editCard(FACTOR_B_ID, FACTOR_B_LABEL)],
      quickFix: [],
    },
    ...overrides,
  } as unknown as PreAnalysisData
}

/**
 * The card for a named factor, resolved as the DIRECT CHILD of the top-three
 * container that carries the label. Only the first card has a testid
 * (`t1-triage-emphasised`), so `closest` on the second climbs to the container
 * holding both and silently widens every within-card query.
 */
function cardFor(label: string): HTMLElement {
  const queue = screen.getByTestId('t1-triage-top-three')
  const card = Array.from(queue.children).find(
    child => within(child as HTMLElement).queryByText(label) != null,
  ) as HTMLElement | undefined
  expect(card, `no triage card found for "${label}"`).toBeDefined()
  return card!
}

function withInspectorWatch<T>(fn: (count: () => number) => T): T {
  let raised = 0
  const onOpen = () => {
    raised += 1
  }
  window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, onOpen)
  try {
    return fn(() => raised)
  } finally {
    window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, onOpen)
  }
}

describe('PreAnalysisPanel — local-only semantic actions fail closed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePreAnalysisData.mockReturnValue(createMockData())
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps the factor card visible but withholds its dead edit pencil', () => {
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const card = cardFor(FACTOR_B_LABEL)
    expect(card).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Edit value' })).not.toBeInTheDocument()
    expect(within(card).queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('raises no Inspector and mutates no selection while rendering the guidance', () => {
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    withInspectorWatch(count => {
      expect(count()).toBe(0)
    })
    expect(mockSelectNodeWithoutHistory).not.toHaveBeenCalled()
  })
})

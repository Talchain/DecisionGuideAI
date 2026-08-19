/**
 * PreAnalysisPanel — the pre-analysis half of the SAME "Edit value" lie.
 *
 * ## The corrected premise this file records
 *
 * The brief for this work held that the post-analysis pencil lied while THIS
 * consumer was honest, and warned that a shared-label fix would therefore make
 * an honest consumer lie. Derived at the tree, that is false: both consumers
 * lie, by two different routes to the same dead end.
 *
 *   - post-analysis: `onEdit={onFocusNode}` → `useFocusCamera.handleFocusNode`
 *   - pre-analysis:  `onEdit={handleSetValueForGap}` → `selectNodeWithoutHistory`
 *                    + `focusNodeById` (which is `handleFocusNode` again)
 *
 * Neither dispatches `olumi:open-full-inspector`, and that event is the ONLY
 * way `showFullInspector` — local React state in `ReactFlowGraph` — is ever
 * raised. `InspectorModal` has exactly one mount site, gated on it. So
 * selection alone opens no editing surface anywhere in the app, and this
 * handler's own comment ("opens the inspector for a factor") described
 * something it never did.
 *
 * That is why the fix is ONE owner used by both consumers, rather than a
 * bespoke handler here: two consumers of one shared control must not resolve
 * the same label two different ways.
 *
 * ## Identity binding (CLAUDE.md trap 19)
 *
 * Two factor cards are on screen, both carrying the pencil. The discriminating
 * test clicks the SECOND and asserts the FIRST was not opened, so a mutant
 * that ignores its argument cannot survive.
 *
 * ⚠ SCOPE (CLAUDE.md trap 3): DOM-presence, call-argument and window-event
 * assertions only. jsdom cannot prove the inspector is visible.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
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

describe('PreAnalysisPanel — "Edit value" opens the editor it names', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePreAnalysisData.mockReturnValue(createMockData())
  })

  afterEach(() => {
    cleanup()
  })

  /**
   * Precondition pin: the control exists on this surface at all. Without it,
   * the behavioural tests below could pass vacuously on a panel that stopped
   * rendering the card.
   */
  it('the pencil renders on the factor card', () => {
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(
      within(cardFor(FACTOR_B_LABEL)).getByRole('button', { name: 'Edit value' }),
    ).toBeInTheDocument()
  })

  /**
   * ⭐ THE PIN. RED at pristine: `handleSetValueForGap` selected the node and
   * moved the camera, dispatching no inspector-raise signal at all.
   */
  it('clicking it RAISES THE INSPECTOR, not just the camera', () => {
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    withInspectorWatch(count => {
      fireEvent.click(within(cardFor(FACTOR_B_LABEL)).getByRole('button', { name: 'Edit value' }))
      expect(count()).toBe(1)
    })
  })

  /**
   * ⭐ THE DISCRIMINATING HALF. Card B is deliberately second: a mutant that
   * ignores its argument and opens `nodes[0]` satisfies the test above and
   * must fail here.
   */
  it('opens THIS card’s factor, not the other card’s (discriminating pair)', () => {
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    fireEvent.click(within(cardFor(FACTOR_B_LABEL)).getByRole('button', { name: 'Edit value' }))

    expect(mockSelectNodeWithoutHistory).toHaveBeenCalledWith(FACTOR_B_ID)
    expect(mockSelectNodeWithoutHistory).not.toHaveBeenCalledWith(FACTOR_A_ID)
  })
})

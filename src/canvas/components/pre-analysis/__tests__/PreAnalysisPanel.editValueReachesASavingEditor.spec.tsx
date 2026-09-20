/**
 * ⭐ THE PRE-ANALYSIS "Edit value" ACT MUST REACH AN EDITOR THAT CAN SAVE —
 * FOR **EVERY** FACTOR CATEGORY, NOT TWO OF THE THREE.
 *
 * ## The gap this pins, derived at `219209ad` and stated narrowly
 *
 * `PreAnalysisPanel`'s `handleSetValueForGap` called `openNodeInspector`, and
 * the comment beside it justified that with: *"the inspector's factor panels
 * own their own authority and reach `factor_value_edit`"*. That sentence names
 * `factor-controllable` and `factor-external`. It does not name the third.
 *
 *   · `InspectorRouter.tsx:441` — `AUTHORITY_OWNING_PANELS` is
 *     `{'option','factor-controllable','factor-external'}`.
 *   · `InspectorRouter.tsx:118` — `category: 'observable'` resolves to
 *     `'factor-observable'`, which is NOT in that set.
 *   · `InspectorRouter.tsx:543-551` — every panel outside the set renders
 *     inside `<fieldset disabled>` under `INSPECTOR_READ_ONLY_REASON`
 *     ("…read-only… Use the Model tab for supported factor values").
 *
 * So the pencil on an OBSERVABLE factor landed the reader on a dead surface
 * holding a sentence telling them to go somewhere else and walk there
 * themselves. Nothing filters the cards by category on the way there:
 * `deriveExpertiseGroups.ts:88-105` admits any node whose kind is `factor`.
 * A real captured draft (`__fixtures__/realDraft.fundraising.json`) carries
 * one observable factor among four.
 *
 * ## Why the destination is the Model tab and not a fourth exempt panel
 *
 * `ModelTabV2Panel.tsx:639-646` derives `editConnectedIds` from
 * `nodeKind(node) === 'factor'` — **no category branch** — and the comment
 * above it states why: *"A factor's value has a wire carrier for EVERY
 * reachable value, so the factor arm can key on KIND alone."* One destination
 * therefore serves all three categories through one authority.
 *
 * ## Why this is not a flag flip
 *
 * `CANONICAL_EDIT_AUTHORITY.preAnalysisFactorValue` stays `'disabled'`. It
 * governs the INLINE editor (`handleInlineEditValue`, one local `updateNode`
 * that emits nothing), and that gate is correct. Navigation is not a mutation
 * — the rule `TriageActionCardsBody.tsx` already records for the post-run
 * sibling. Only the DESTINATION moves.
 *
 * ## The precedent, and why the fix is one shared owner
 *
 * `TriageActionCardsBody.openValueEditor` made exactly this move for the
 * POST-RUN card and wrote: *"This act must serve EVERY factor a triage card
 * can name, and `factor-observable` is NOT in the exempt set."* It then noted
 * that the pre-analysis surface "is NOT in this change's scope" — so the two
 * siblings have been answering the same question differently ever since. The
 * repair is one owner (`openModelValueEditor`), not a second copy here.
 */
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
  { id: FACTOR_A_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: FACTOR_A_LABEL, category: 'controllable' } },
  { id: FACTOR_B_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: FACTOR_B_LABEL, category: 'observable' } },
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


/**
 * The camera/outline hand-off. Spied rather than exercised: the real helper
 * fail-closes on an unregistered canvas, so a genuine call and a no-op would
 * be indistinguishable at the assertion.
 */
const mockFocusModelTarget = vi.fn((_nodeId: string) => true)
vi.mock('../../../utils/focusHelpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/focusHelpers')>()),
  focusModelTarget: (nodeId: string) => mockFocusModelTarget(nodeId),
}))

import { useUIStore } from '@/stores/uiStore'
import { fireEvent } from '@testing-library/react'

/** Reset the real UI store between cases so a stale tab cannot fake a pass. */
function resetUi(): void {
  useUIStore.setState({ activeOutputTab: 'results', pendingModelTabSection: null })
}

describe('PreAnalysisPanel — "Edit value" reaches an editor that can save, for every factor category', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetUi()
    mockUsePreAnalysisData.mockReturnValue(createMockData())
  })

  afterEach(() => {
    cleanup()
  })

  /**
   * POSITIVE CONTROL — without it every assertion below could pass on a panel
   * that rendered nothing at all, and the observable card is the whole subject.
   */
  it('renders both triage cards, and the subject card is the OBSERVABLE factor', () => {
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(cardFor(FACTOR_A_LABEL)).toBeInTheDocument()
    expect(cardFor(FACTOR_B_LABEL)).toBeInTheDocument()
    const subject = GRAPH_NODES.find(n => n.id === FACTOR_B_ID)
    expect((subject?.data as { category?: string }).category).toBe('observable')
    // Contrast, in the same run: the OTHER card is a category the Inspector
    // does serve. If both were observable this suite could not discriminate.
    const other = GRAPH_NODES.find(n => n.id === FACTOR_A_ID)
    expect((other?.data as { category?: string }).category).toBe('controllable')
  })

  it('routes the click to the Model tab factors section, bound to the clicked factor BY ID', () => {
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const card = cardFor(FACTOR_B_LABEL)
    fireEvent.click(within(card).getByRole('button', { name: 'Edit value' }))

    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')
    expect(useUIStore.getState().pendingModelTabSection).toBe('factors')
    // IDENTITY, not a value predicate another card could satisfy (trap 19).
    expect(mockFocusModelTarget).toHaveBeenCalledTimes(1)
    expect(mockFocusModelTarget).toHaveBeenCalledWith(FACTOR_B_ID)
    expect(mockFocusModelTarget).not.toHaveBeenCalledWith(FACTOR_A_ID)
  })

  it('raises NO read-only Inspector — the dead end the act used to reach', () => {
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const card = cardFor(FACTOR_B_LABEL)
    withInspectorWatch(count => {
      fireEvent.click(within(card).getByRole('button', { name: 'Edit value' }))
      expect(count()).toBe(0)
    })
    expect(mockSelectNodeWithoutHistory).not.toHaveBeenCalled()
  })

  /**
   * The CONTRAST ARM — the same act on the card the Inspector already served.
   * It must reach the SAME destination: one act, one owner. Without this the
   * suite would pass on a fix that special-cased `observable` and left the two
   * categories answering differently, which is the defect one level down.
   */
  it('sends the controllable card to the same destination — one act, one owner', () => {
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const card = cardFor(FACTOR_A_LABEL)
    fireEvent.click(within(card).getByRole('button', { name: 'Edit value' }))

    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')
    expect(useUIStore.getState().pendingModelTabSection).toBe('factors')
    expect(mockFocusModelTarget).toHaveBeenCalledWith(FACTOR_A_ID)
    expect(mockFocusModelTarget).not.toHaveBeenCalledWith(FACTOR_B_ID)
  })

  /**
   * ⛔ THE GATE THAT MUST NOT MOVE. The inline editor has no carrier, so the
   * spinbutton stays absent. Kept here so a future reader cannot mistake this
   * change for a licence to open the pre-analysis value editor.
   */
  it('still withholds the carrier-less inline editor', () => {
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    expect(within(cardFor(FACTOR_B_LABEL)).queryByRole('spinbutton')).not.toBeInTheDocument()
  })
})

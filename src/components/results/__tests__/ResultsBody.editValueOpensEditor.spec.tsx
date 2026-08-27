/** ResultsBody — controls with no GraphV3 carrier do not mount. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  EvidenceGapItem,
  ImprovementsSectionData,
  NextActionItem,
  OptionResult,
} from '../types'

/**
 * The camera seam is mocked so a pan cannot be mistaken for an open. This is
 * deliberately NOT the assertion — see the header note on uncalled spies. The
 * tests assert what the user GETS (the inspector-raise signal and the
 * selection), not what was skipped.
 */
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'
import { OPEN_FULL_INSPECTOR_EVENT } from '@/canvas/utils/openEdgeStrengthEditor'

/** Card 1 — an evidence gap. Carries the HONEST inline editor. */
const GAP_NODE_ID = 'node_gap_ramp_up'
const GAP_LABEL = 'Ramp-up time'

/** Card 2 — a next action. Carries the pencil under test. */
const ACTION_NODE_ID = 'node_action_channel_mix'
const ACTION_LABEL = 'Revisit the channel mix'

/** The testid of the mount path under test — the cockpit host, by identity. */
const LIVE_MOUNT = 'hero-arm-triage-actions'

function makeData(): ResultsSectionDataReturn {
  const winner = {
    id: 'opt_a',
    label: 'Option A',
    expected: 0.8,
    outcome: { mean: 0.8, p10: 0.6, p50: 0.78, p90: 0.95 },
    p10: 0.6,
    p50: 0.78,
    p90: 0.95,
    isRecommended: true,
    winProbability: 0.7,
    goalProbability: 0.7,
  } as unknown as OptionResult
  const runnerUp = {
    id: 'opt_b',
    label: 'Option B',
    expected: 0.4,
    outcome: { mean: 0.4, p10: 0.2, p50: 0.38, p90: 0.6 },
    p10: 0.2,
    p50: 0.38,
    p90: 0.6,
    isRecommended: false,
    winProbability: 0.3,
    goalProbability: 0.3,
  } as unknown as OptionResult

  const recommendation = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    goalThreshold: 0.6,
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.92,
    robustnessLevel: 'high',
    isNormalised: false,
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
  } as DecisionResultData

  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: false,
  }

  /**
   * An evidence gap mints a card carrying `editorConfig` (because `onSetValue`
   * is supplied), so `TriageCard` renders `InlineValueControls` — spinbutton
   * plus its own commit pencil. This is the honest control.
   */
  const gap: EvidenceGapItem = {
    factorId: 'fac_ramp',
    factorLabel: GAP_LABEL,
    confidence: 40,
    voi: 0.9,
    suggestion: 'This estimate is the AI’s, not yours.',
    targetNodeId: GAP_NODE_ID,
  }

  /**
   * A next action mints a card with `action.kind === 'edit'` and
   * `editorConfig: null` — so `TriageCard` renders the `onEdit` pencil. THIS
   * is the control under test. `influence` is null for next actions, so it
   * sorts below the gap (voi 0.9) and both land inside top3.
   */
  const nextAction: NextActionItem = {
    action: ACTION_LABEL,
    rationale: 'Two channels carry most of the downside.',
    priority: 1,
    targetType: 'node',
    targetId: ACTION_NODE_ID,
  }

  const confidence = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [gap],
    topEvidenceGaps: [gap],
    nextActions: [nextAction],
    topNextActions: [nextAction],
  } as unknown as ConfidenceSectionData

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  } as ImprovementsSectionData

  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
    completeness: { status: 'full', missing: [], reasons: [] },
    autoNoiseProvenance: null,
  } as unknown as ResultsSectionDataReturn
}

interface Handlers {
  onConfirmFactor: ReturnType<typeof vi.fn>
  onSetFactorValue: ReturnType<typeof vi.fn>
  onFocusNode: ReturnType<typeof vi.fn>
}

/**
 * ⚠ `onFocusNode` IS SUPPLIED DELIBERATELY, and the spec is worthless without
 * it. At pristine the pencil's render gate was `action.kind === 'edit' &&
 * onEdit && action.targetId`, with `onEdit` BEING `onFocusNode` — so a fixture
 * that omitted it rendered no pencil at all, and every test here would have
 * failed at pristine by proving the control ABSENT rather than proving it
 * lied. The deployed parent supplies it (`OutputsDock` →
 * `onFocusNode={handleFocusResultNode}`), so the fixture must too, or it is
 * not testing the input space real users load.
 */
function renderBody(): Handlers {
  const onConfirmFactor = vi.fn()
  const onSetFactorValue = vi.fn()
  const onFocusNode = vi.fn()
  render(
    <ResultsBody
      resultsSectionData={makeData()}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      onConfirmFactor={onConfirmFactor}
      onSetFactorValue={onSetFactorValue}
      onFocusNode={onFocusNode}
      nodeValueLookup={{
        [GAP_NODE_ID]: { value: 12, unit: 'weeks', cap: null },
      }}
    />,
  )
  return { onConfirmFactor, onSetFactorValue, onFocusNode }
}

/**
 * The triage card for a named factor, scoped to the live mount path.
 *
 * Resolved as the queue's DIRECT CHILD containing the label, not by
 * `closest('[data-testid^="unified-triage-"]')`: only the FIRST card carries a
 * testid (`unified-triage-emphasised`), so `closest` on any other card climbs
 * past it to `unified-triage-queue` — the container holding every card — and
 * silently widens the scope to the whole queue. The card under test here is
 * deliberately the second one, so that widening would have made every
 * within-card query ambiguous.
 */
function cardFor(label: string): HTMLElement {
  const root = screen.getByTestId(LIVE_MOUNT)
  const queue = within(root).getByTestId('unified-triage-queue')
  const card = Array.from(queue.children).find(
    child => within(child as HTMLElement).queryByText(label) != null,
  ) as HTMLElement | undefined
  expect(card, `no triage card found for "${label}" in the queue`).toBeDefined()
  return card!
}

/** Counts inspector-raise signals for the duration of one assertion. */
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

describe('ResultsBody — local-only value actions fail closed', () => {
  beforeEach(() => {
    localStorage.clear()
    useCanvasStore.setState({
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      draftCoaching: null,
      // Both targets are on the canvas: `openNodeInspector` fail-closes on an
      // id that is not, so a missing seed would fake a pass on the negative
      // tests and a fail on the positive ones.
      nodes: [
        { id: GAP_NODE_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: GAP_LABEL } },
        { id: ACTION_NODE_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: ACTION_LABEL } },
      ],
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    } as never)
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  /*
   * ⭐ THE PENCIL IS NO LONGER DEAD, AND THAT IS THE CHANGE.
   *
   * This case asserted the pencil was WITHHELD, on the correct premise that its
   * destination could not save: it called `openNodeInspector`, and the Inspector
   * is read-only by its own policy — `InspectorRouter` wraps every panel in an
   * unconditional `<fieldset disabled>`, and `INSPECTOR_READ_ONLY_REASON` says
   * so in user-facing copy: "these changes cannot yet be saved to the shared
   * model. Use the Model tab for supported factor values."
   *
   * ⚠ THE PREMISE WAS ORIGINALLY CITED TO TWO MANIFESTS —
   * `inspector-v2/useInspectorMutations.ts` `NODE_SETTER_AUTHORITY` (:119) and
   * `EDGE_SETTER_AUTHORITY` (:143). Both were deleted on 27 Aug 2026 (PR #886)
   * as unenforced mirrors with zero code consumers, and those line numbers now
   * point at unrelated code. The premise itself is unchanged and still true.
   *
   * The act now goes where that copy points. Withholding it was right while it
   * dead-ended; it is wrong now that it reaches the one path that writes.
   *
   * ⚠ NOTE WHAT IS NOT CHANGED, because it is the honest half: the INLINE editor
   * and Confirm stay withheld (next two cases), because those genuinely have no
   * working carrier. Only the NAVIGATION was re-pointed.
   */
  it('MOUNTS the pencil and routes it to the Model tab factors section', () => {
    renderBody()
    expect(cardFor(GAP_LABEL)).toBeInTheDocument()
    expect(cardFor(ACTION_LABEL)).toBeInTheDocument()

    const pencil = within(cardFor(ACTION_LABEL)).getByRole('button', { name: 'Edit value' })

    // No inspector raise — the dead destination must not be reached even once.
    withInspectorWatch(count => {
      pencil.click()
      expect(count(), 'the act must not raise the read-only Inspector').toBe(0)
    })

    // ⚠ Assert the SECTION KEY, not merely that something was requested. The
    // consumer coalesces an unknown key to the panel top
    // (`ModelTabBody.tsx:243`), so a wrong string routes silently — which is
    // exactly the defect caught on the sibling PR.
    expect(useUIStore.getState().pendingModelTabSection).toBe('factors')
    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')
  })

  it('withholds the inline editor even when a caller supplies local callbacks', () => {
    const { onSetFactorValue, onConfirmFactor } = renderBody()
    const card = cardFor(GAP_LABEL)
    expect(within(card).queryByRole('spinbutton', { name: `Value for ${GAP_LABEL}` }))
      .not.toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Confirm AI estimate' }))
      .not.toBeInTheDocument()
    expect(onSetFactorValue).not.toHaveBeenCalled()
    expect(onConfirmFactor).not.toHaveBeenCalled()
  })

  it('dispatches no inspector raise as a side effect of rendering the queue', () => {
    renderBody()
    withInspectorWatch(count => {
      expect(count()).toBe(0)
    })
  })
})

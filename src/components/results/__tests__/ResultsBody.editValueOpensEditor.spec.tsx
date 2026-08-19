/**
 * ResultsBody — a pencil labelled "Edit value" MUST OPEN AN EDITOR.
 *
 * ## The defect this file exists to prevent, stated bluntly
 *
 * `TriageActionCardsBody` wired the shared `TriageCard`'s edit affordance as
 * `onEdit={onFocusNode}`. `onFocusNode` resolves to `useFocusCamera`'s
 * `handleFocusNode`: it selects the node, sets a transient focus dim and
 * (conditionally) moves the camera. It opens NOTHING. The only surface that
 * can edit a factor's value is `InspectorModal`, whose visibility is LOCAL
 * React state in `ReactFlowGraph` (`showFullInspector`), reachable from
 * outside only through the `olumi:open-full-inspector` window event — which
 * `handleFocusNode` never dispatches. So a control that says "Edit value"
 * panned the camera and left the user to find the node and click it
 * themselves.
 *
 * This is the panel-side twin of the R5 defect already fixed on the canvas
 * (see `NodeQuickActions.spec.tsx`): there the on-node Edit pencil wrote
 * `showInspectorPanel`, a store field with zero render consumers. Same shape,
 * different dead end.
 *
 * ## The canonical rule this pins
 *
 * "Edit value" opens the node's inspector, via `openNodeInspector` — the one
 * owner of "raise the editor for this node". There is no per-consumer
 * variant. It fail-closes silently on a node that is not on the canvas.
 *
 * ## Identity binding (CLAUDE.md trap 19)
 *
 * Two factors are on screen and BOTH carry an affordance. Every assertion
 * names one of them by its `targetNodeId`, and the discriminating test clicks
 * the SECOND card's pencil and asserts the FIRST card's node was not selected
 * — a mutant that ignores its argument and opens `nodes[0]` must not survive.
 *
 * ## The honest consumer this must not break
 *
 * `InlineValueControls` (`TriageCard.tsx`) renders its OWN pencil, also
 * labelled "Edit value", whose click commits the number typed into the
 * adjacent spinbutton via `editorConfig.onSave`. That one is honest and does
 * not route through `onEdit` at all. The third test is its control: it must be
 * GREEN before and after the change, and it must NOT raise the inspector.
 *
 * ⚠ SCOPE (CLAUDE.md trap 3): DOM-presence, store-state and window-event
 * assertions only. jsdom cannot prove the inspector is visible, or that it
 * paints above the dock. A browser witness owns that claim.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
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
}

function renderBody(): Handlers {
  const onConfirmFactor = vi.fn()
  const onSetFactorValue = vi.fn()
  render(
    <ResultsBody
      resultsSectionData={makeData()}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      onConfirmFactor={onConfirmFactor}
      onSetFactorValue={onSetFactorValue}
      nodeValueLookup={{
        [GAP_NODE_ID]: { value: 12, unit: 'weeks', cap: null },
      }}
    />,
  )
  return { onConfirmFactor, onSetFactorValue }
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

describe('ResultsBody — "Edit value" opens the editor it names', () => {
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

  /**
   * Precondition pin (CLAUDE.md trap 13b): the control exists on the MOUNTED
   * surface. If a flag ever moves the cockpit host, this REDs here rather than
   * letting the behavioural tests below pass against a component the
   * deployment does not render.
   */
  it('the pencil renders on the next-action card, inside the live mount path', () => {
    renderBody()
    expect(
      within(cardFor(ACTION_LABEL)).getByRole('button', { name: 'Edit value' }),
    ).toBeInTheDocument()
  })

  /**
   * ⭐ THE PIN. RED at pristine: `onEdit={onFocusNode}` selects and pans, and
   * dispatches no inspector-raise signal at all, so `raised` stays 0.
   */
  it('clicking it RAISES THE INSPECTOR — the only surface that can edit a value', () => {
    renderBody()
    withInspectorWatch(count => {
      fireEvent.click(within(cardFor(ACTION_LABEL)).getByRole('button', { name: 'Edit value' }))
      expect(count()).toBe(1)
    })
  })

  /**
   * ⭐ THE DISCRIMINATING HALF. The next-action card is the SECOND card in the
   * queue, deliberately: a mutant that ignores its argument and opens
   * `nodes[0]` would satisfy the test above and must fail here.
   */
  it('opens THIS card’s node, not the other card’s (discriminating pair)', () => {
    renderBody()
    fireEvent.click(within(cardFor(ACTION_LABEL)).getByRole('button', { name: 'Edit value' }))

    const selected = useCanvasStore.getState().selection.nodeIds
    expect(selected.has(ACTION_NODE_ID)).toBe(true)
    expect(selected.has(GAP_NODE_ID)).toBe(false)
  })

  /**
   * ⭐ THE HONEST CONSUMER, GREEN BEFORE AND AFTER. `InlineValueControls` has
   * its own "Edit value" pencil that commits the adjacent spinbutton through
   * `editorConfig.onSave`. It must keep committing, and must NOT be collapsed
   * into the inspector route — a fix that routed every pencil through
   * `openNodeInspector` would destroy the one affordance that already worked.
   *
   * The negative half is not vacuous: it is asserted in the same act as the
   * positive commit, so a click that did nothing at all would fail the first
   * expectation before reaching the second.
   */
  it('leaves the inline value editor alone — it still commits, and opens nothing', () => {
    const { onSetFactorValue } = renderBody()
    const card = cardFor(GAP_LABEL)
    const input = within(card).getByRole('spinbutton', { name: `Value for ${GAP_LABEL}` })
    fireEvent.change(input, { target: { value: '20' } })

    withInspectorWatch(count => {
      fireEvent.click(within(card).getByRole('button', { name: 'Edit value' }))
      expect(onSetFactorValue).toHaveBeenCalledWith(GAP_NODE_ID, 20)
      expect(count()).toBe(0)
    })
  })
})

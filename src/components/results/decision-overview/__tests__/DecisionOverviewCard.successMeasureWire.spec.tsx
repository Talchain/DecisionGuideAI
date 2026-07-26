/**
 * C2 — one fact, two selectors, opposite answers.
 *
 * ─── THE DEFECT ────────────────────────────────────────────────────────────
 * "Does this decision have a success measure?" was answered independently in
 * two places, from two different sources, and they disagreed:
 *
 *  * `computeSuccessState.ts` (the pre-analysis hero selector) reads the WIRE:
 *    `goalNode.data.goal_threshold_raw ?? analysisReady.goal_threshold_raw`.
 *    A CEE-derived threshold makes it return `isSet: true` and it renders the
 *    value with its unit. This one is honest.
 *
 *  * `DecisionOverviewCard` read `store.goalThreshold`, which
 *    `deriveGoalThresholdFromNode` (canvas/store.ts) populates ONLY when
 *    `data.threshold_source === 'user'`. A CEE-derived threshold is invisible
 *    to it, so the card rendered "Success measure missing" — and drove its
 *    `liveState` to `thin` — for a decision that demonstrably HAS a measure.
 *
 * That is a false denial: the absence of a value in the wrong field was
 * rendered as positive evidence that the product captured nothing.
 *
 * ─── THE FIX IS REUSE, NOT ADDITION ────────────────────────────────────────
 * The card now routes through the SAME two existing selectors the pre-analysis
 * panel uses — `computeGraphFacts` for goal-node selection and
 * `computeSuccessState` for the measure — rather than carrying a third read of
 * its own. No new derivation was introduced: inventing a second goal-node
 * finder here would have created exactly the mirror this lane exists to retire.
 *
 * ─── HONEST SCOPE CAVEAT ───────────────────────────────────────────────────
 * For a goal with no numeric target the drafter is instructed to omit these
 * fields entirely, so for THAT goal the chip is more useless than wrong. The
 * selector divergence is a live latent bug regardless, and it is what this
 * spec pins. The wider "silence rather than a false denial" question is C4.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DecisionOverviewCard, OVERVIEW_COPY } from '../DecisionOverviewCard'
import { useCanvasStore } from '../../../../canvas/store'
import { computeSuccessState } from '../../../../canvas/components/pre-analysis-v3/selectors/computeSuccessState'
import { computeGraphFacts } from '../../../../canvas/components/pre-analysis-v3/selectors/graphFacts'

const READY = { status: 'ready', options: [{ id: 'o1' }], goal_node_id: 'g1' }

/** A goal node carrying a CEE-DERIVED display-scale anchor — no user target. */
const GOAL_NODE_CEE_DERIVED = {
  id: 'g1',
  type: 'goal',
  position: { x: 0, y: 0 },
  data: {
    label: 'Maximise Total Profit Over Three Years',
    goal_threshold_raw: 150000,
    goal_threshold_unit: 'GBP',
    // NOTE: no `threshold_source: 'user'`, so store.goalThreshold stays null.
  },
}

/**
 * Open the brief-dimension chips REGARDLESS of the card's starting state.
 * A blind `fireEvent.click(brief-bar)` is a trap here: the derived `thin`
 * state auto-expands, so clicking COLLAPSES it and the chips vanish. That
 * would make an assertion fail for a reason that has nothing to do with the
 * behaviour under test.
 */
function openBrief() {
  const bar = screen.getByTestId('brief-bar')
  if (bar.getAttribute('aria-expanded') === 'false') fireEvent.click(bar)
}

function resetCanvas(overrides: Record<string, unknown> = {}) {
  localStorage.setItem('feature.decisionOverview', '1')
  useCanvasStore.setState({
    ceeAnalysisReady: null,
    goalThreshold: null,
    nodes: [],
    goalConstraints: null,
    currentBriefText: null,
    graphHealth: null,
    ...overrides,
  } as never)
}

describe('C2: the Goal chip and the hero selector answer the same question the same way', () => {
  beforeEach(() => {
    resetCanvas()
  })

  // The premise, proven rather than asserted. If this ever fails, the rest of
  // this file is testing something other than the divergence it claims to.
  it('PREMISE: store.goalThreshold is null for a CEE-derived threshold, but computeSuccessState sees it', () => {
    resetCanvas({ ceeAnalysisReady: READY, nodes: [GOAL_NODE_CEE_DERIVED] })

    // The store field the card used to read: blind to a CEE-derived measure.
    expect(useCanvasStore.getState().goalThreshold).toBeNull()

    // The wire-reading selector: sees it.
    const facts = computeGraphFacts(useCanvasStore.getState().nodes as never)
    const success = computeSuccessState(facts.goalNode, READY as never, null, null)
    expect(success.isSet).toBe(true)
    expect(success.displayText).toBe('GBP 150,000')
  })

  it('renders the CEE-derived success measure instead of denying it exists', () => {
    resetCanvas({ ceeAnalysisReady: READY, nodes: [GOAL_NODE_CEE_DERIVED] })
    render(<DecisionOverviewCard title="t" />)
    openBrief()

    const goalChip = screen.getByTestId('brief-dim-goal')
    expect(goalChip).not.toHaveTextContent(OVERVIEW_COPY.goalNoteMissing)
    expect(goalChip).toHaveTextContent('150,000')
  })

  it('does not fall to the derived `thin` state when a CEE-derived measure exists', () => {
    resetCanvas({ ceeAnalysisReady: READY, nodes: [GOAL_NODE_CEE_DERIVED] })
    render(<DecisionOverviewCard title="t" />)

    // `thin` auto-expands and claims "The goal has no success measure yet".
    // With a measure on the wire that claim is false.
    expect(screen.queryByText(OVERVIEW_COPY.thinLiveNote)).toBeNull()
  })

  it('still honours a USER-set target (threshold_source: user) — the existing path is unbroken', () => {
    resetCanvas({
      ceeAnalysisReady: { ...READY, goal_threshold_unit: 'percent' },
      nodes: [
        {
          id: 'g1',
          type: 'goal',
          position: { x: 0, y: 0 },
          data: { label: 'G', threshold_source: 'user', success_threshold: 20 },
        },
      ],
    })
    render(<DecisionOverviewCard title="t" />)
    openBrief()
    expect(screen.getByTestId('brief-dim-goal')).toHaveTextContent('20%')
  })

  // POSITIVE CONTROL for the absence assertions above: this spec CAN observe
  // the "missing" copy. Without this, `not.toHaveTextContent(goalNoteMissing)`
  // could pass because the chip never renders at all.
  it('POSITIVE CONTROL: with genuinely no measure anywhere, the chip DOES say so', () => {
    resetCanvas({
      ceeAnalysisReady: READY,
      nodes: [{ id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'G' } }],
    })
    render(<DecisionOverviewCard title="t" />)

    const goalChip = screen.getByTestId('brief-dim-goal')
    expect(goalChip).toHaveTextContent(OVERVIEW_COPY.goalNoteMissing)
  })
})

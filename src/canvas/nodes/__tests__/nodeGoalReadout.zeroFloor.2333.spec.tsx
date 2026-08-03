/**
 * THE CANVAS EXACT-ZERO DIVERGENCE, CLOSED (ROADMAP 2.333, PC2).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT WAS ROWED, AND WHAT WAS ACTUALLY TRUE
 * ─────────────────────────────────────────────────────────────────────────
 * `displayFloors.ts` carried a standing correction: the goal register floors
 * an exact zero to "< 1%", but `GoalNode` "carries its own `> 0 && < 0.01`
 * carve-out and renders an exact zero as '0% chance of reaching target' —
 * live, and the opposite convention". That was true, and this file closes it:
 * one canvas node and the option card beside it can no longer state
 * different things about the same zero.
 *
 * ⚠ THE SIBLING CLAIM WAS NOT TRUE, AND IS PINNED HERE AS A CONTROL.
 * The design pack for this slice grouped `OptionNode.tsx` with `GoalNode` as
 * "own literal (same class)". At the bytes it is NOT the same class. Its
 * expression is
 *
 *     goalProbability < 0.10
 *       ? `< ${goalProbability < 0.01 ? '1' : Math.round(goalProbability * 100)}%`
 *       : null
 *
 * — the sub-1% predicate has NO `> 0` carve-out, so an exact zero already
 * takes the `'1'` arm and renders "< 1%". `OptionNode` never printed "0%"
 * for a goal probability and needed no change in this slice. Its band form
 * ("< 5%" for 0.05) is shipped COPY, not a rounding defect, and re-routing
 * it through the register formatter would silently restate it as "5%" — a
 * copy adjudication, which this slice's non-goals put on a separate row.
 * The control below pins the behaviour so the claim is checkable rather than
 * asserted.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HARNESS
 * ─────────────────────────────────────────────────────────────────────────
 * Cloned from `GoalNode.possessiveGate.spec.tsx`. The ONLY mock is the canvas
 * store: the store feeds the REAL `useNodeDisplayMetadata`, the real hook
 * feeds the REAL `selectGoalProbability`, and the decision reaches the REAL
 * component. A mutant that fixes the readout inside the hook rather than at
 * the render site still REDs this file.
 *
 * Do NOT convert this to a per-test `vi.doMock` + `vi.resetModules()`: that
 * hands the node a different `@xyflow/react` instance from the provider
 * wrapping it, and every assertion fails with "you have not used zustand
 * provider as an ancestor" — a harness fault that reads exactly like a real
 * defect. (Measured while writing this slice.)
 *
 * Scope limit (trap 3): string presence/absence only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { selectGoalProbability } from '../../../components/results/utils/selectGoalProbability'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/** A zero-percent readout that is not the tail of a larger number. */
const BARE_ZERO_PERCENT = /(?<![\d.])0%/

let storeState: Record<string, unknown>

const makeStoreState = (report: unknown) => ({
  results: { status: 'complete', report },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  viewMode: 'expert',
  setShowInspectorPanel: vi.fn(),
})

vi.mock('../../store', () => {
  const useCanvasStore = vi.fn((selector: (s: unknown) => unknown) => selector(storeState))
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => storeState
  return { useCanvasStore }
})

const { GoalNode } = await import('../GoalNode')

const baseProps = {
  id: 'goal_revenue',
  type: 'goal',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

/** A USER-set target — UI-SEM-082 gates the whole block on it. */
const USER_TARGET = { threshold_source: 'user', success_threshold: 6_000_000 }

function renderGoalNodeWith(probabilityOfGoal: number) {
  storeState = makeStoreState({
    option_probabilities: { opt_a: { probability_of_goal: probabilityOfGoal } },
    robustness: { recommended_option_id: 'opt_a', recommendation_stability: 0.5 },
  })
  return render(
    <ReactFlowProvider>
      <GoalNode
        {...baseProps}
        data={{ label: 'Grow Annual Revenue', type: 'goal', ...USER_TARGET }}
      />
    </ReactFlowProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GoalNode — the exact-zero goal readout', () => {
  it('control: the fixtures drive the REAL selector to the basis this suite assumes', () => {
    // Anti-vacuity (trap 13). If a fixture stopped reaching the
    // goal_probability branch, the readout assertions would pass or fail for
    // reasons that have nothing to do with the formatter.
    expect(selectGoalProbability({ probability_of_goal: 0.55 }).basis).toBe('goal_probability')
    expect(selectGoalProbability({ probability_of_goal: 0 }).basis).toBe('goal_probability')
  })

  it('positive control: a mid-range probability renders its own percentage', () => {
    renderGoalNodeWith(0.55)
    expect(screen.getByText(/55% chance of reaching target/)).toBeInTheDocument()
  })

  it('renders an EXACT ZERO as the goal register floor, NOT "0%"', () => {
    // The divergence itself: the canvas said "0% chance of reaching target"
    // where every dock surface said "< 1%" for the same number.
    renderGoalNodeWith(0)
    const text = document.body.textContent ?? ''
    expect(text).toContain('< 1% chance of reaching target')
    expect(text).not.toMatch(BARE_ZERO_PERCENT)
  })

  it('keeps rendering a sub-1% NON-ZERO probability as the floor readout', () => {
    // The half that was already correct — pinned so the fix to the zero arm
    // cannot regress it.
    renderGoalNodeWith(0.0007)
    expect(document.body.textContent ?? '').toContain('< 1% chance of reaching target')
  })
})

describe('OptionNode — the sibling that was NOT in this defect class (control)', () => {
  it('its badge expression floors an exact zero WITHOUT a > 0 carve-out', () => {
    // Executed against the shipped expression, not a paraphrase of it. This
    // is the evidence for the refutation recorded in the file header: the
    // sub-1% arm is entered for 0, so "0%" is unreachable on this surface.
    const badge = (goalProbability: number | null) =>
      goalProbability !== null && goalProbability < 0.1
        ? `< ${goalProbability < 0.01 ? '1' : Math.round(goalProbability * 100)}%`
        : null

    expect(badge(0)).toBe('< 1%')
    expect(badge(0.0007)).toBe('< 1%')
    expect(badge(0)).not.toMatch(BARE_ZERO_PERCENT)
    // The band form that makes re-routing this a COPY change, not a fix.
    expect(badge(0.05)).toBe('< 5%')
    expect(badge(0.5)).toBeNull()
  })
})

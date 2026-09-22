/**
 * ⭐⭐⭐ A GOAL WHOSE TARGET IS SET HAD NO ROUTE TO CHANGE IT.
 *
 * ## The measurement
 *
 * Driven on served `1f77130d`, the canonical pricing board, 15 nodes, every
 * node's controls inventoried at rest AND on hover (`gainedOnHoverOnly=0`, so
 * this is not a missed-hover artefact):
 *
 *     silentlyUneditable = 9/15
 *       decision:dec_pricing · goal:goal_pricing_transition ·
 *       option:opt_full_switch · opt_hybrid · opt_new_logos ·
 *       outcome:out_bottom_up_growth · out_nrr ·
 *       risk:risk_enterprise_churn · risk_pricing_complexity
 *
 * The goal card rendered `Target: 110%` — correct, well-formatted, and a plain
 * `<div>` (`GoalNode.tsx:886-890`). No affordance and no reason.
 *
 * ## ⛔ WHY THIS IS THE ONE ARM OF THAT FINDING THAT IS SAFE TO FIX TODAY
 *
 * `useModelEditAuthority` has SIX write carriers and they cover three node
 * kinds plus edges. `proposeGoalTarget` is one of them — a TYPED
 * `add_constraint`, `modelGoalMinimumTarget: 'server_graph'`. So for the goal
 * the capability EXISTS and only the card is silent. For decision, outcome and
 * risk there is NO carrier at all, and an affordance there would be a
 * fabrication — a different problem with a different owner.
 *
 * ## ⚠ AND THIS IS THE ROUTE, NOT THE EDITOR — deliberately
 *
 * An inline editor on the card writes the user's model, so it is NOT LOW RISK
 * and it must state `proposeGoalTarget`'s `direction`, which has no default and
 * must not acquire one (defaulting it records a floor over a deadline-shaped
 * goal). That is a separate, reviewed change. This one NAVIGATES, and
 * `openModelValueEditor`'s own header states the property that makes it safe:
 * *"NAVIGATION IS NOT A MUTATION, so this consults no key of
 * `CANONICAL_EDIT_AUTHORITY`."*
 *
 * ## ⛔ THE PROMISE IS DERIVED, SO IT CANNOT OUTLIVE ITS AUTHORITY
 *
 * The no-target chip already solved exactly this: its route clause is composed
 * from `GOAL_TARGET_ROUTE_IS_LIVE` so a regression DELETES the sentence rather
 * than leaving it lying, and `routeIsLive` is injectable for one reason — so
 * BOTH branches are driven BY EXECUTION rather than by whichever way the flag
 * happens to fall. A test written as `if (LIVE) … else …` is a tautology and a
 * mutant regressing the key SURVIVED it once already. This file drives both.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import {
  GoalNode,
  GOAL_TARGET_LIVE_ROUTE,
  GOAL_TARGET_ROUTE_IS_LIVE,
  GOAL_TARGET_ROUTE_TESTID,
  goalTargetRouteChannels,
} from '../GoalNode'
import { CANONICAL_EDIT_AUTHORITY, hasServerGraphAuthority } from '../../mutations/mutationAuthority'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const openModelValueEditor = vi.fn()
vi.mock('../shared/openModelValueEditor', () => ({
  openModelValueEditor: (...args: unknown[]) => openModelValueEditor(...args),
}))

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'goal_pricing_transition',
  type: 'goal',
  selected: false,
  isConnectable: true,
  position: { x: 0, y: 0 },
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

/** The pricing board's own goal, as the served card rendered it. */
const TARGET_SET = { goal_threshold_raw: 110, goal_threshold_unit: 'percent' }

function renderCard(data: Record<string, unknown>) {
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as never))
  const { container } = render(
    <ReactFlowProvider>
      <GoalNode {...baseProps} data={{ label: 'Transition to usage-based pricing', type: 'goal', ...data }} />
    </ReactFlowProvider>,
  )
  return container
}

describe('a goal with a target SET carries a route to change it', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    openModelValueEditor.mockReset()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as never))
  })

  it('renders the target as a real control, not a plain div', () => {
    const container = renderCard(TARGET_SET)
    const route = container.querySelector(`[data-testid="${GOAL_TARGET_ROUTE_TESTID}"]`)
    expect(route, 'a set target must offer a route to change it').not.toBeNull()
    expect(route?.tagName.toLowerCase()).toBe('button')
  })

  it('still renders the target VALUE unchanged — the contrast control', () => {
    // If this REDs, the change altered what the card ASSERTS, not merely what
    // it offers. That is the harm this whole lane exists to prevent.
    expect(renderCard(TARGET_SET).textContent ?? '').toContain('110%')
  })

  it('names the live destination in its accessible name, from the shared constant', () => {
    const route = renderCard(TARGET_SET).querySelector(`[data-testid="${GOAL_TARGET_ROUTE_TESTID}"]`)
    expect(route?.getAttribute('aria-label') ?? '').toContain(GOAL_TARGET_LIVE_ROUTE)
  })

  it('routes through the shared navigation owner, with THIS goal and the goal section', () => {
    const route = renderCard(TARGET_SET).querySelector(
      `[data-testid="${GOAL_TARGET_ROUTE_TESTID}"]`,
    ) as HTMLButtonElement
    route.click()
    // ⛔ BOUND BY IDENTITY: this goal's id and the section KEY, never "a call happened".
    expect(openModelValueEditor).toHaveBeenCalledWith('goal_pricing_transition', 'goal')
  })

  it('offers nothing when there is no target — that card has its own chip', () => {
    const container = renderCard({})
    expect(container.querySelector(`[data-testid="${GOAL_TARGET_ROUTE_TESTID}"]`)).toBeNull()
  })
})

/**
 * ⭐ THE DISCRIMINATING PAIR. `routeIsLive` is injected so the withheld branch
 * is reached BY EXECUTION. A mutant regressing `modelGoalMinimumTarget` to
 * `'disabled'` must delete the promise, and these two cases differ only in that
 * one argument.
 */
describe('the promise is composed from the authority, not asserted', () => {
  it('composes a route clause when the carrier is live', () => {
    const live = goalTargetRouteChannels({ targetLine: 'Target: 110%', routeIsLive: true })
    expect(live).not.toBeNull()
    expect(live?.['aria-label']).toContain(GOAL_TARGET_LIVE_ROUTE)
  })

  it('composes NOTHING when the carrier is not live', () => {
    expect(goalTargetRouteChannels({ targetLine: 'Target: 110%', routeIsLive: false })).toBeNull()
  })

  it('the production default IS the derivation — not a second copy of it', () => {
    expect(GOAL_TARGET_ROUTE_IS_LIVE).toBe(
      hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.modelGoalMinimumTarget),
    )
    // And the default argument agrees with it, so production cannot diverge
    // from the tested branches.
    expect(goalTargetRouteChannels({ targetLine: 'Target: 110%' }) === null).toBe(
      !GOAL_TARGET_ROUTE_IS_LIVE,
    )
  })
})

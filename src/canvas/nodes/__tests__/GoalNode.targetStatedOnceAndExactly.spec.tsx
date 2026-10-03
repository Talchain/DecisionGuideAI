/**
 * ⭐ THE GOAL CARD STATES THE USER'S TARGET ONCE, AND EXACTLY AS SET
 * (canvas audit 27 Sep 2026, edit-values F4 + F7; both reproduced by a skeptic
 * on served staging `23ff3ca8`).
 *
 * F4 — the target a user set is the number the card prints. "At least 99.5%"
 *   read `Target: 100%` (card text, its aria, and the inspector) while the
 *   limit pill beside it, Chat and the persisted `goal_threshold_raw` said
 *   99.5%. `formatGoalTarget` rounded every plain-percent target to whole
 *   points. The card is pinned here as one of that formatter's three callers
 *   (GoalNode, GoalPanel, SuccessTargetLine).
 *
 * F7 — a `goal_target_edit` upserts a `goal_constraints` row on the GOAL'S OWN
 *   node, labelled with the goal's title (CEE's canonical form (a) of the
 *   target). The card rendered it as a second limit pill — "<goal title>
 *   ≥115%", named "Limit you set" — beside `Target: 115%`.
 *
 *   ⛔ REVIEW r2 BLOCKER 1: the first filter dropped EVERY goal-node row while
 *   the Target line showed, which hid real limits — CEE's `at_most` goal edit
 *   lands a `<=` row with no threshold, and the headcount-allocation starter
 *   carries a `<=` "Delivery deadline" row on its goal. The row set aside is now
 *   identified (operator `>=`, figure and unit equal to the stated target), and
 *   the `<=` controls below keep the bound on the card beside a Target line.
 *
 * ⚠ IDENTITY, NOT A VALUE PREDICATE: pills are bound by test ids that carry the
 * goal id and the constraint id, and every absence sits beside a positive
 * control in the same render (the target line, and a real limit's pill).
 *
 * CLAIM SCOPE: jsdom — strings and test ids. Not pixels.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((s: (x: { layoutNodeWidth: number | null }) => unknown) =>
    s({ layoutNodeWidth: null })) as unknown as (...a: never[]) => unknown),
}))
vi.mock('../../ui/inspector-v2/useAnalysisResults', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../ui/inspector-v2/useAnalysisResults')>()),
  useHasAnyRealProbability: vi.fn(() => false),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { GoalNode } from '../GoalNode'
import { goalStatedLimits, constraintRestatesGoalTarget } from '../../domain/goalOwnTargetRow'

const baseProps = {
  selected: false, dragging: false, zIndex: 0, isConnectable: false,
  positionAbsoluteX: 0, positionAbsoluteY: 0, deletable: true, selectable: true, draggable: true,
}

const META = {
  sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
  achievementProbability: null as number | null, goalFitAvailable: false, stabilityPercentage: null,
  winRate: null, isResultsMode: false, predictedOutcome: null, valueOfInformation: null, voiRank: null,
}

const GOAL_ID = 'goal_pricing_transition'
const GOAL_TITLE = 'Achieve NRR Above 110% While Enabling Bottom-Up Adoption'
const NRR = { id: 'out_nrr', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'Net revenue retention', type: 'outcome' } }
/** The brief's own limit, on another node — must survive the filter (contrast). */
const NRR_LIMIT = { constraint_id: 'constraint_out_nrr_min', node_id: 'out_nrr', operator: '>=', value: 110, unit: '%', provenance: 'explicit' }
/** The row `goal_target_edit` writes: on the goal's own node, labelled with its title (served readback). */
const OWN_TARGET_ROW = { constraint_id: 'gc-37ae4757', node_id: GOAL_ID, operator: '>=', value: 115, unit: '%', label: GOAL_TITLE, provenance: 'explicit' }

function mockStore(over: Record<string, unknown> = {}) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector({
      hoveredOptionId: null,
      nodes: [NRR],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null,
      goalConstraints: [NRR_LIMIT],
      setHoveredOption: vi.fn(),
      viewMode: 'standard',
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
      analysisFreshnessDirty: false,
      ...over,
    } as never),
  )
}

function renderGoal(data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <GoalNode {...(baseProps as any)} id={GOAL_ID} type="goal" data={{ type: 'goal', label: GOAL_TITLE, ...data } as any} />
    </ReactFlowProvider>,
  )
}

const pill = (constraintId: string) => screen.queryByTestId(`goal-limit-pill-${GOAL_ID}-${constraintId}`)
const allPills = () => screen.queryAllByTestId(new RegExp(`^goal-limit-pill-${GOAL_ID}-`))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...META } as never)
})
afterEach(() => cleanup())

describe('F4 · the card prints the target the user set — 99.5% never reads 100%', () => {
  it('goal_threshold_raw 99.5 with unit % reads "Target: 99.5%" in the text AND the accessible name', () => {
    mockStore({ goalConstraints: [] })
    renderGoal({ goal_threshold_raw: 99.5, goal_threshold_unit: '%', threshold_source: 'user' })
    const route = screen.getByTestId('goal-target-route')
    expect(route.textContent).toBe('Target: 99.5%')
    expect(route.getAttribute('aria-label') ?? '').toContain('Target: 99.5%')
    expect(route.getAttribute('aria-label') ?? '').not.toContain('100%')
  })

  it('CONTRAST — a whole-number target is unchanged', () => {
    mockStore({ goalConstraints: [] })
    renderGoal({ goal_threshold_raw: 97, goal_threshold_unit: '%', threshold_source: 'user' })
    expect(screen.getByTestId('goal-target-route').textContent).toBe('Target: 97%')
  })
})

describe("F7 · the goal's own target row is not a limit pill", () => {
  it('after a target edit: "Target: 115%" and the brief limit pill — no pill repeating the goal title', () => {
    mockStore({ goalConstraints: [NRR_LIMIT, OWN_TARGET_ROW] })
    renderGoal({ goal_threshold_raw: 115, goal_threshold_unit: '%', threshold_source: 'user' })
    // Positive controls: the target line and the real limit are on the card.
    expect(screen.getByTestId('goal-target-route').textContent).toBe('Target: 115%')
    expect(pill('constraint_out_nrr_min')?.textContent).toBe('Net revenue retention ≥110%')
    // The target's own row is not restated as a limit.
    expect(pill('gc-37ae4757')).toBeNull()
    expect(allPills()).toHaveLength(1)
    expect(document.body.textContent ?? '').not.toContain(`${GOAL_TITLE} ≥115%`)
  })

  it('after a run the post-analysis constraint set is filtered the same way', () => {
    mockStore({
      goalConstraints: [NRR_LIMIT, OWN_TARGET_ROW],
      results: { status: 'complete', report: { goal_constraints: [{ ...NRR_LIMIT, probability: 0.6 }, { ...OWN_TARGET_ROW, probability: 0.4 }] } },
    })
    renderGoal({ goal_threshold_raw: 115, goal_threshold_unit: '%', threshold_source: 'user' })
    expect(pill('constraint_out_nrr_min')).not.toBeNull()
    expect(pill('gc-37ae4757')).toBeNull()
  })

  it('Detailed: the Layer 2 constraint list does not list the target as a limit either', () => {
    mockStore({ goalConstraints: [NRR_LIMIT, OWN_TARGET_ROW], viewMode: 'expert' })
    renderGoal({ goal_threshold_raw: 115, goal_threshold_unit: '%', threshold_source: 'user' })
    const badges = screen.queryAllByTestId('goal-constraint-badge')
    // Positive control: Detailed lists the real limit.
    expect(badges.map((b) => b.textContent ?? '').some((t) => t.includes('110%'))).toBe(true)
    expect(badges.map((b) => b.textContent ?? '').some((t) => t.includes(GOAL_TITLE))).toBe(false)
  })
})

/** headcount-allocation's own brief limit: a CEILING on the goal node, not its target (starter draft JSON). */
const DEADLINE_ROW = {
  constraint_id: 'constraint_goal_arr_max', node_id: GOAL_ID, operator: '<=', value: 2, unit: 'months',
  label: 'Delivery deadline', source_quote: 'by Q3', provenance: 'inferred',
}
/** CEE's `at_most` goal edit: a `<=` row on the goal node, with NO threshold stamped (manualGoalTarget.ts). */
const AT_MOST_ROW = { constraint_id: 'gc-at-most', node_id: GOAL_ID, operator: '<=', value: 130, unit: '%', label: GOAL_TITLE, provenance: 'explicit' }

describe("F7 · CONTROLS — a goal-node limit that is NOT the target stays beside the Target line (review r2 blocker 1)", () => {
  it("headcount-allocation's `<=` \"Delivery deadline ≤2 months\" stays a pill once a target is set", () => {
    mockStore({ goalConstraints: [DEADLINE_ROW, OWN_TARGET_ROW] })
    renderGoal({ goal_threshold_raw: 115, goal_threshold_unit: '%', threshold_source: 'user' })
    // Positive control: the Target line is showing — the state the first filter hid limits in.
    expect(screen.getByTestId('goal-target-route').textContent).toBe('Target: 115%')
    expect(pill('constraint_goal_arr_max')?.textContent).toBe('Delivery deadline ≤2 months · Inferred limit')
    // And the target's own row is still set aside in the same render.
    expect(pill('gc-37ae4757')).toBeNull()
    expect(allPills()).toHaveLength(1)
  })

  it('a user\'s "at most" goal edit beside a ">=" target stays a pill — and in Detailed', () => {
    mockStore({ goalConstraints: [AT_MOST_ROW, OWN_TARGET_ROW] })
    renderGoal({ goal_threshold_raw: 115, goal_threshold_unit: '%', threshold_source: 'user' })
    expect(screen.getByTestId('goal-target-route').textContent).toBe('Target: 115%')
    expect(pill('gc-at-most')?.textContent).toBe(`${GOAL_TITLE} ≤130%`)
    expect(pill('gc-37ae4757')).toBeNull()
    cleanup()
    mockStore({ goalConstraints: [AT_MOST_ROW, OWN_TARGET_ROW], viewMode: 'expert' })
    renderGoal({ goal_threshold_raw: 115, goal_threshold_unit: '%', threshold_source: 'user' })
    const badges = screen.queryAllByTestId('goal-constraint-badge').map((b) => b.textContent ?? '')
    expect(badges.some((t) => t.includes('≤ 130%'))).toBe(true)
    expect(badges.some((t) => t.includes('≥ 115%'))).toBe(false)
  })

  it('a ">=" goal-node row at a DIFFERENT figure from the target is a limit, not the target — kept', () => {
    const stale = { ...OWN_TARGET_ROW, constraint_id: 'gc-other', value: 110 }
    mockStore({ goalConstraints: [stale] })
    renderGoal({ goal_threshold_raw: 115, goal_threshold_unit: '%', threshold_source: 'user' })
    expect(screen.getByTestId('goal-target-route').textContent).toBe('Target: 115%')
    expect(pill('gc-other')?.textContent).toBe(`${GOAL_TITLE} ≥110%`)
  })
})

describe('goalStatedLimits — the rule, and its guard', () => {
  const TARGET = { raw: 115, unit: '%' }
  it('sets aside only the row that restates the stated target, and only while a target is stated', () => {
    const rows = [NRR_LIMIT, OWN_TARGET_ROW, DEADLINE_ROW, AT_MOST_ROW] as never[]
    expect(goalStatedLimits(rows, GOAL_ID, TARGET)?.map((c: any) => c.constraint_id))
      .toEqual(['constraint_out_nrr_min', 'constraint_goal_arr_max', 'gc-at-most'])
    // No target line: the row is the only statement of the target — kept.
    expect(goalStatedLimits(rows, GOAL_ID, null)?.map((c: any) => c.constraint_id))
      .toEqual(['constraint_out_nrr_min', 'gc-37ae4757', 'constraint_goal_arr_max', 'gc-at-most'])
    // A different goal id sets nothing aside.
    expect(goalStatedLimits(rows, 'goal-other', TARGET)).toHaveLength(4)
    expect(goalStatedLimits(null, GOAL_ID, TARGET)).toBeNull()
  })

  it('identity, not location: operator, figure and unit must all match the target', () => {
    const own = OWN_TARGET_ROW as never
    expect(constraintRestatesGoalTarget(own, GOAL_ID, TARGET)).toBe(true)
    // Each discriminator alone keeps the row.
    expect(constraintRestatesGoalTarget({ ...OWN_TARGET_ROW, operator: '<=' } as never, GOAL_ID, TARGET)).toBe(false)
    expect(constraintRestatesGoalTarget({ ...OWN_TARGET_ROW, value: 110 } as never, GOAL_ID, TARGET)).toBe(false)
    expect(constraintRestatesGoalTarget({ ...OWN_TARGET_ROW, unit: 'months' } as never, GOAL_ID, TARGET)).toBe(false)
    expect(constraintRestatesGoalTarget({ ...OWN_TARGET_ROW, node_id: 'out_nrr' } as never, GOAL_ID, TARGET)).toBe(false)
    // One unit, spelled two ways, is one unit (CEE's own sameUnit for currency; the percent words).
    expect(constraintRestatesGoalTarget(own, GOAL_ID, { raw: '115', unit: 'percent' })).toBe(true)
    expect(constraintRestatesGoalTarget({ ...OWN_TARGET_ROW, value: 20000, unit: 'GBP' } as never, GOAL_ID, { raw: 20000, unit: '£' })).toBe(true)
    // A rewritten-scale row is read at the reader's own figure (the audit trail).
    expect(constraintRestatesGoalTarget({
      ...OWN_TARGET_ROW, value: 1.15, unit: 'fraction',
      provenance_unit_normalised: { rule: 'percent_to_fraction', original_value: 115, original_unit: '%' },
    } as never, GOAL_ID, TARGET)).toBe(true)
    // Nothing to compare against → nothing set aside.
    expect(constraintRestatesGoalTarget(own, GOAL_ID, null)).toBe(false)
    expect(constraintRestatesGoalTarget(own, GOAL_ID, { raw: 'eleven', unit: '%' })).toBe(false)
  })
})

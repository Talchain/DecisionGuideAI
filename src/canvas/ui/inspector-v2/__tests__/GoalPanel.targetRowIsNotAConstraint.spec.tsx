/**
 * ⭐ THE GOAL INSPECTOR STATES THE TARGET ONCE — the inspector copy of the goal
 * card's F7 rule (canvas audit edit-values F7; review r2: "The Goal inspector's
 * Constraints list (`GoalPanel.tsx:751-760`) still lists the goal's own target
 * row. It also counts it in 'extracted from your brief (N)'").
 *
 * CEE's `at_least` goal edit writes the target twice by design: the goal node's
 * `goal_threshold_raw` / `success_threshold` AND a `>=` `goal_constraints` row on
 * the goal itself (`add-constraint.ts`, forms (a) and (b)). The panel states the
 * first above its Constraints list, and listed the second as a constraint "from
 * your brief".
 *
 * ⚠ IDENTITY, NOT LOCATION (review r2 blocker 1): only the row whose operator,
 * figure and unit restate the stated target is set aside. A `<=` bound on the
 * goal node — the headcount-allocation starter's own "Delivery deadline" row —
 * is a limit and is listed. Rows are bound by their value-input test ids, which
 * carry the constraint id, and every absence sits beside a positive control in
 * the same render (the target readout and a kept row).
 *
 * CLAIM SCOPE: jsdom — strings and test ids.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import headcountStarter from '../../../starters/data/headcount-allocation.draft.json'

const GOAL_ID = 'goal_arr'
const GOAL_TITLE = 'Achieve ARR Growth by Q3'
/** The row a `>=` goal edit lands: on the goal's own node, in user units (CEE add-constraint). */
const OWN_TARGET_ROW = { constraint_id: 'gc-own', node_id: GOAL_ID, operator: '>=', value: 115, unit: '%', label: GOAL_TITLE, provenance: 'explicit' }
/** headcount-allocation's own brief limit on the goal node — a ceiling, not the target. */
const DEADLINE_ROW = {
  constraint_id: 'constraint_goal_arr_max', node_id: GOAL_ID, operator: '<=', value: 2, unit: 'months',
  label: 'Delivery deadline', source_quote: 'by Q3', confidence: 0.85, provenance: 'inferred',
}
/** A limit on another node, for contrast. */
const NRR_ROW = { constraint_id: 'constraint_out_nrr_min', node_id: 'out_nrr', operator: '>=', value: 110, unit: '%', label: 'Net revenue retention', provenance: 'explicit' }

function seed(goalData: Record<string, unknown>, goalThreshold: number | null, constraints: unknown[]) {
  useCanvasStore.setState({
    nodes: [
      { id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: { label: GOAL_TITLE, ...goalData } },
      { id: 'out_nrr', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'Net revenue retention' } },
    ],
    edges: [],
    goalThreshold,
    goalThresholdRepresentation: goalThreshold == null ? null : 'normalised',
    goalConstraints: constraints,
    confirmedNodeIds: new Set(),
    touchedNodeIds: new Set(),
  } as never)
}

const TARGET_SET = { goal_threshold_raw: 115, goal_threshold_unit: '%', success_threshold: 115, threshold_source: 'user' }
const row = (id: string) => screen.queryByTestId(`goal-constraint-${id}-value-input`)
const text = () => document.body.textContent ?? ''

describe('GoalPanel — the target row is not listed as a constraint while the panel states the target', () => {
  beforeEach(() => cleanup())
  afterEach(() => cleanup())

  it('PROVENANCE PIN: the headcount starter still carries its `<=` deadline row on the goal node', () => {
    const rows = (headcountStarter as { goal_constraints?: Array<Record<string, unknown>> }).goal_constraints ?? []
    const deadline = rows.find((r) => r.constraint_id === 'constraint_goal_arr_max')
    expect(deadline, 'the starter no longer carries the deadline row — the control below is stranded').toBeDefined()
    expect(deadline).toMatchObject({ node_id: GOAL_ID, operator: '<=', value: 2, unit: 'months', label: 'Delivery deadline' })
  })

  it('readout arm: "≥ 115%" is stated once; the deadline and the other limit stay, and the count says 2', () => {
    seed(TARGET_SET, 0.8, [NRR_ROW, OWN_TARGET_ROW, DEADLINE_ROW])
    render(<GoalPanel nodeId={GOAL_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    // Positive controls: the target readout and the kept limits.
    expect(text()).toContain('Success means reaching ≥ 115%')
    expect(row('constraint_goal_arr_max')).not.toBeNull()
    expect(row('constraint_out_nrr_min')).not.toBeNull()
    // The target's own row is not a second statement of the target.
    expect(row('gc-own')).toBeNull()
    expect(text()).toContain('2 constraints extracted from your brief')
    expect(text()).not.toContain('3 constraints extracted from your brief')
  })

  it('a goal whose only row is its target: no Constraints section at all', () => {
    seed(TARGET_SET, 0.8, [OWN_TARGET_ROW])
    render(<GoalPanel nodeId={GOAL_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    expect(text()).toContain('Success means reaching ≥ 115%')
    expect(row('gc-own')).toBeNull()
    expect(text()).not.toMatch(/extracted from your brief/)
  })

  it('CONTROL — a `>=` goal-node row at a different figure is a limit, and is listed', () => {
    seed(TARGET_SET, 0.8, [{ ...OWN_TARGET_ROW, constraint_id: 'gc-other', value: 110 }])
    render(<GoalPanel nodeId={GOAL_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    expect(text()).toContain('Success means reaching ≥ 115%')
    expect(row('gc-other')).not.toBeNull()
    expect(text()).toContain('1 constraint extracted from your brief')
  })

  it('the arm a user sees (`readOnly`, the Router\'s): SuccessTargetLine states 115%, and the row is not listed again', () => {
    seed(TARGET_SET, 0.8, [OWN_TARGET_ROW, DEADLINE_ROW])
    render(<GoalPanel nodeId={GOAL_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} readOnly />)
    // Positive controls: the mounted target line states the figure; the deadline is listed.
    expect(screen.getByTestId('goal-panel-target').textContent).toContain('115%')
    expect(row('constraint_goal_arr_max')).not.toBeNull()
    expect(row('gc-own')).toBeNull()
    expect(text()).not.toContain(`${GOAL_TITLE} \u2265 115%`)
  })

  it('CONTROL — in the (unmounted) editor arm no readout states the figure, so the target row stays', () => {
    // Store holds no number → the editor renders, not the readout; its field is an
    // edit control, not a statement, and a doubled target beats a hidden one.
    seed(TARGET_SET, null, [OWN_TARGET_ROW, DEADLINE_ROW])
    render(<GoalPanel nodeId={GOAL_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    expect(text()).not.toContain('Success means reaching \u2265')
    expect(text()).toContain('Adding a specific target unlocks')
    expect(row('gc-own')).not.toBeNull()
    expect(row('constraint_goal_arr_max')).not.toBeNull()
    expect(text()).toContain('2 constraints extracted from your brief')
  })
})

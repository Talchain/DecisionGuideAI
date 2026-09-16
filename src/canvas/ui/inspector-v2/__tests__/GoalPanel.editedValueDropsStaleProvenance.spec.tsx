/**
 * ⭐⭐⭐ THE READER EDITS THEIR OWN LIMIT AND THE CARD SHOWS THE OLD ONE.
 *
 * Found by an INDEPENDENT POST-MERGE REVIEW of #1592 (Codex
 * `notice_record_integration_test`), reproduced by executing the real
 * formatter: an audited churn ceiling `{value: 0.04, original_value: 4,
 * original_unit: '%'}` renders `≤ 4%`; apply this panel's ACTUAL edit and set
 * the value to 5, and it STILL renders `≤ 4%`. Their words: *"it is historical
 * transformation provenance, not perpetual authority over later user edits."*
 *
 * ## ⚠ WHY THIS FILE EXISTS ALONGSIDE THE UNIT TESTS
 *
 * `goalConstraintText.rewrittenScale.spec.ts` pins the helper. **A helper test
 * alone would have passed against the unfixed product**, because the defect was
 * never in a helper — it was the spread `{ ...pc, value: parsed }` at this call
 * site, which quietly carried two statements about the OLD value forward.
 *
 * So this drives the REAL panel and reads what it actually wrote to the store.
 * It is the difference between "the invalidation function works" and "the edit
 * invalidates" — and only the second is a claim about the product.
 *
 * ⚠ THE NUMBER INPUT ONLY RENDERS PRE-ANALYSIS (`prob === null`), so the store
 * is seeded `results.status: 'idle'` deliberately. A fixture that seeded a
 * completed run would find no input and pass by testing nothing.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { goalConstraintText } from '../../../utils/goalConstraintText'

const GOAL_ID = 'goal_mrr'
const FACTOR_ID = 'fac_churn'
const QUOTE = 'while keeping monthly churn under 4%'

const nodes = [
  { id: FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Monthly churn rate', kind: 'factor' } },
  { id: GOAL_ID, type: 'goal', position: { x: 200, y: 0 }, data: { label: 'Reach £20k MRR', kind: 'goal' } },
]

/** An audited ceiling, in the exact shape the reviewer reproduced. */
const auditedConstraint = () => ({
  constraint_id: 'c_churn_ceiling',
  node_id: FACTOR_ID,
  label: 'Keep monthly churn at or below 4%',
  operator: 'lte',
  value: 0.04,
  unit: '%',
  source_quote: QUOTE,
  provenance_unit_normalised: { rule: 'percent_to_fraction', original_value: 4, original_unit: '%' },
})

function seed() {
  useCanvasStore.setState(
    {
      ...useCanvasStore.getState(),
      nodes,
      edges: [{ id: 'e1', source: FACTOR_ID, target: GOAL_ID, data: { weight: 0.5, direction: 'negative' } }],
      goalConstraints: [auditedConstraint()],
      goalThreshold: 0.6,
      results: { status: 'idle', report: null },
    } as never,
    true,
  )
}

/** Drive the real edit: find the panel's own number input and blur a new value. */
function editValueViaUI(next: string) {
  const { container } = render(
    <GoalPanel nodeId={GOAL_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />,
  )
  /**
   * ⛔ BOUND BY IDENTITY, AND THE FIRST CUT WAS NOT. `container.querySelector(
   * 'input[type="number"]')` picked the GOAL THRESHOLD — this panel renders
   * two number inputs and the threshold comes first. The positive control
   * ("an input exists") passed, the blur fired, and the test drove the wrong
   * object. It failed only because a discriminating assertion demanded the
   * CONSTRAINT's value change (trap 19: never a value predicate another object
   * could satisfy).
   */
  const input = screen.getByTestId('goal-constraint-c_churn_ceiling-value-input') as HTMLInputElement
  // ⚠ And assert it is the right box before driving it: the constraint's own
  // current value, not the threshold's.
  expect(input.value, 'bound to the wrong number input').toBe('0.04')
  expect(container.querySelectorAll('input[type="number"]').length, 'the two-input premise no longer holds').toBeGreaterThan(1)
  fireEvent.blur(input, { target: { value: next } })
  return useCanvasStore.getState().goalConstraints as Array<Record<string, unknown>> | null
}

describe('editing a constraint value invalidates the provenance that described the old one', () => {
  beforeEach(seed)

  it('⭐ THE REPRODUCTION: after the edit the limit no longer reads 4%', () => {
    const written = editValueViaUI('5')
    expect(written, 'the panel wrote nothing').not.toBeNull()
    const edited = (written as Array<Record<string, unknown>>)[0]
    expect(edited.value).toBe(5)

    const text = goalConstraintText(edited as never, nodes as never, { omitLabel: true })
    expect(text).toContain('5')
    // ⛔ The discriminating half: "contains 5" alone passes on "≤ 4% (was 5)".
    expect(text).not.toContain('4%')
    expect(text).not.toContain(QUOTE)
  })

  it('both stale statements are dropped by the WRITE, not by the formatter', () => {
    const edited = (editValueViaUI('5') as Array<Record<string, unknown>>)[0]
    expect(edited.provenance_unit_normalised).toBeUndefined()
    expect(edited.source_quote).toBeUndefined()
  })

  /**
   * ⛔ CONTRAST: invalidation is not data loss. Everything the edit did not
   * touch must survive — otherwise the remedy costs more than the defect.
   */
  it('⛔ CONTRAST: identity, label, operator and unit all survive the edit', () => {
    const edited = (editValueViaUI('5') as Array<Record<string, unknown>>)[0]
    expect(edited.constraint_id).toBe('c_churn_ceiling')
    expect(edited.node_id).toBe(FACTOR_ID)
    expect(edited.label).toBe('Keep monthly churn at or below 4%')
    expect(edited.operator).toBe('lte')
    expect(edited.unit).toBe('%')
  })

  /**
   * ⛔ CONTRAST: an UNEDITED constraint keeps its audit. Without this, simply
   * never reading provenance would satisfy every test above — and would
   * silently undo #1592.
   */
  it('⛔ CONTRAST: untouched, the audited constraint still states 4%', () => {
    const text = goalConstraintText(auditedConstraint() as never, nodes as never, { omitLabel: true })
    expect(text).toContain('4')
  })
})

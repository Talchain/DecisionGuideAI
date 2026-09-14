/**
 * ⭐⭐ A GOAL TARGET IS A NUMBER, A UNIT **AND A BOUND** — and the bound was
 * hardcoded, so this surface could only ever record a floor.
 *
 * ## Where this came from
 *
 * The founder's own brief, 14 Sep 2026: *"Given our goal of reaching £20k MRR
 * within 12 months **while keeping monthly churn under 4%** …"*. A ceiling. The
 * product replied on turn one *"You set a limit of 4% in your brief and I could
 * not match it to anything on the model"*, and the Model tab — the one surface
 * with a durable goal-target writer — dispatched `'at_least'` unconditionally
 * (`ModelTabV2Panel.confirmEdit`) beneath a review line that read *"At least
 * {draft} {unit}"*. The words and the wire agreed, and for a ceiling both were
 * wrong.
 *
 * ## Why this is a two-line change rather than a carrier build
 *
 * `buildManualGoalTarget` has taken a REQUIRED `direction: ConstraintType`
 * since 10 Sep, and both values were measured routing through CEE's real
 * `add_constraint` handler at `staging dcebc360`, with `'exactly'` refused as a
 * negative control (`manualGoalTarget.ts:56-67`). The carrier was already
 * there. Only this call site was pinned shut, under a comment that said so:
 * *"Offering the choice here … is NOT in this change's scope"*.
 *
 * ## What these tests are for
 *
 * The valuable mutant is not "does a select exist" — it is **does the chosen
 * bound reach the dispatch, or does something downstream quietly restore the
 * floor**. So the binding tests below assert the VALUE HANDED OUT, and the
 * contrast test asserts the other value is handed out on the other choice. One
 * alone would pass on a component that emits a constant.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelRowView } from '../ModelRowView'
import type { ModelRow } from '../types'
import { goalTargetBoundPhrase } from '../../conversation/manualGoalTarget'

function goalRow(over: Partial<ModelRow> = {}): ModelRow {
  return {
    id: 'g1',
    kind: 'goal',
    group: 'goal',
    label: 'Reach £20k MRR Within 12 Months',
    primaryValue: 'Not set',
    attention: [],
    editable: true,
    ...over,
  } as ModelRow
}

/** The editor only renders with the three callbacks its host supplies. */
function renderEditor(direction?: 'at_least' | 'at_most') {
  const onDraftChange = vi.fn()
  render(
    <ModelRowView
      row={goalRow()}
      tier="plain"
      commit={{ phase: 'editing', draft: '4', unit: '%', ...(direction ? { direction } : {}) }}
      onDraftChange={onDraftChange}
      onProposeEdit={vi.fn()}
      onDiscardEdit={vi.fn()}
    />,
  )
  return { onDraftChange }
}

describe('the goal target can carry a CEILING, not only a floor', () => {
  it('offers both bounds, and shows which one is currently selected', () => {
    renderEditor('at_least')
    const select = screen.getByLabelText('Target bound for Reach £20k MRR Within 12 Months')
    expect(select).toHaveValue('at_least')
    // Both, by the producer's own vocabulary — not a free-text pair.
    expect(select).toHaveTextContent('at least')
    expect(select).toHaveTextContent('at most')
  })

  it('⭐ hands the host `at_most` when the reader chooses a ceiling', () => {
    const { onDraftChange } = renderEditor('at_least')
    fireEvent.change(
      screen.getByLabelText('Target bound for Reach £20k MRR Within 12 Months'),
      { target: { value: 'at_most' } },
    )
    expect(onDraftChange).toHaveBeenCalledTimes(1)
    // (rowId, draft, unit, direction) — the draft and unit must ride along
    // unchanged, or choosing a bound would silently clear the number.
    expect(onDraftChange).toHaveBeenCalledWith('g1', '4', '%', 'at_most')
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN. Without it, a component hardcoded to emit
   * `'at_most'` would pass the test above — which is the same defect one
   * direction over, and exactly what this change exists to remove.
   */
  it('⛔ CONTRAST: hands the host `at_least` when the reader chooses a floor', () => {
    const { onDraftChange } = renderEditor('at_most')
    fireEvent.change(
      screen.getByLabelText('Target bound for Reach £20k MRR Within 12 Months'),
      { target: { value: 'at_least' } },
    )
    expect(onDraftChange).toHaveBeenCalledWith('g1', '4', '%', 'at_least')
  })

  it('the unit input does not clear the bound it did not touch', () => {
    const { onDraftChange } = renderEditor('at_most')
    fireEvent.change(
      screen.getByLabelText('Target unit for Reach £20k MRR Within 12 Months'),
      { target: { value: '£' } },
    )
    // Omitted-means-unchanged is the host's rule; the row must still SEND the
    // bound, or the spread has nothing to preserve.
    expect(onDraftChange).toHaveBeenCalledWith('g1', '4', '£', 'at_most')
  })

  /**
   * ⚠ THE WORDS AND THE WIRE COME FROM ONE MAP. `goalTargetBoundPhrase` is the
   * sibling of the `at_least → '>=' / at_most → '<='` map CEE's operator comes
   * from. A second vocabulary here is how a review line ends up attesting a
   * direction the payload does not carry.
   */
  it('names the bounds with the producer’s own vocabulary', () => {
    expect(goalTargetBoundPhrase('at_least')).toBe('at least')
    expect(goalTargetBoundPhrase('at_most')).toBe('at most')
  })
})
